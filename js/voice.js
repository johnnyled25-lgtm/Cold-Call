// Voice in and out, using the browser's built-in speech features.
// - In: SpeechRecognition (Chrome, Edge; partial in Safari; not in Firefox), push-to-talk.
//   In Chrome and Edge the browser sends the audio to its maker's speech service.
//   This app never records, stores, or sends audio itself.
// - Out: speechSynthesis (most browsers), one steady voice per exec.
//
// EXTENSION POINT (deferred, brief §9): hands-free open mic would replace
// createPushToTalk with continuous listening; premium provider voices would replace speak().

import { SPEECH_LANG } from "./constants.js";
import { estimatedSpeechMs } from "./voicePick.js";

const Recognition = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;

export const recognitionSupported = () => Boolean(Recognition);
export const synthesisSupported = () => "speechSynthesis" in globalThis && "SpeechSynthesisUtterance" in globalThis;

// ---------------------------------------------------------------------------
// Microphone permission
// ---------------------------------------------------------------------------

// Asks for the microphone up front (while the phone rings), so the browser's
// permission pop-up doesn't interrupt the student's first line.
// The mic is opened and closed again immediately: nothing is captured or kept.
// Returns "granted", "denied", "no-mic", or "unsupported".
export async function requestMicAccess() {
  if (!globalThis.navigator?.mediaDevices?.getUserMedia) return "unsupported";
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    return "granted";
  } catch (err) {
    if (err?.name === "NotFoundError" || err?.name === "OverconstrainedError") return "no-mic";
    return "denied"; // NotAllowedError, SecurityError, or blocked by the computer's settings
  }
}

// ---------------------------------------------------------------------------
// Click to talk
// ---------------------------------------------------------------------------

// start() on the first click of the Talk button; stop() on the second.
// onInterim(text): what the recognizer thinks it's hearing so far.
// onDone({ text, releasedAt }): the final words (may be "" if nothing was caught).
// onError(kind): the browser's error name, e.g. "not-allowed" (mic blocked),
//   "audio-capture" (no mic), "network" (speech service unreachable).
export function createPushToTalk({ onInterim, onDone, onError }) {
  let rec = null;
  let active = false;

  function start() {
    if (!Recognition || active) return false;
    const r = new Recognition();
    r.lang = SPEECH_LANG;
    r.continuous = true;      // keep listening until the student clicks Send
    r.interimResults = true;  // show words as they're recognized
    r.maxAlternatives = 1;

    const finals = [];
    let interim = "";
    let errorKind = null;
    let releasedAt = null;
    let settled = false;
    let fallback = null;

    const settle = () => {
      if (settled) return;
      settled = true;
      active = false;
      clearTimeout(fallback);
      if (r.cancelled) return;
      if (errorKind && errorKind !== "no-speech" && errorKind !== "aborted") onError?.(errorKind);
      else onDone?.({ text: [...finals, interim].join(" ").replace(/\s+/g, " ").trim(), releasedAt: releasedAt ?? Date.now() });
    };

    r.onresult = (e) => {
      interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        if (result.isFinal) finals.push(result[0].transcript);
        else interim += result[0].transcript;
      }
      onInterim?.([...finals, interim].join(" ").replace(/\s+/g, " ").trim());
    };
    r.onerror = (e) => { errorKind = e.error || "unknown"; };
    r.onend = settle;
    r.markReleased = () => {
      releasedAt = Date.now();
      // Safety net: if the browser never reports the end, finish anyway.
      fallback = setTimeout(settle, 4000);
    };

    try {
      r.start();
    } catch {
      onError?.("start-failed");
      return false;
    }
    rec = r;
    active = true;
    return true;
  }

  function stop() {
    if (!active || !rec) return;
    rec.markReleased();
    try { rec.stop(); } catch {}
  }

  // Ends listening without reporting anything (e.g. the call ended).
  function cancel() {
    if (!rec) return;
    rec.cancelled = true;
    try { rec.abort(); } catch {}
    active = false;
  }

  return { start, stop, cancel, isActive: () => active };
}

// ---------------------------------------------------------------------------
// The exec's voice
// ---------------------------------------------------------------------------

// Resolves with the browser's voice list. Some browsers load voices a moment
// after the page, so this waits briefly for them.
export function loadVoices(timeoutMs = 1500) {
  if (!synthesisSupported()) return Promise.resolve([]);
  const now = speechSynthesis.getVoices();
  if (now.length) return Promise.resolve(now);
  return new Promise((resolve) => {
    const done = () => { clearTimeout(timer); speechSynthesis.removeEventListener("voiceschanged", done); resolve(speechSynthesis.getVoices()); };
    const timer = setTimeout(done, timeoutMs);
    speechSynthesis.addEventListener("voiceschanged", done);
  });
}

let currentUtterance = null; // kept so the browser doesn't discard it mid-sentence (a Chrome quirk)

// Says one line. onStart fires when the voice actually begins (used for latency),
// onBoundary on each word where the browser supports it (for the mouth, Phase 4),
// onEnd when finished. Returns { cancel } which stops speech without calling onEnd.
// Without speech support, onStart and onEnd fire right away.
export function speak(text, { voice = null, rate = 1, pitch = 1, onStart, onBoundary, onEnd } = {}) {
  if (!synthesisSupported()) {
    onStart?.();
    onEnd?.();
    return { cancel() {} };
  }
  // Cancel only if something is playing: Chrome can drop a line spoken right after a cancel.
  if (speechSynthesis.speaking || speechSynthesis.pending) speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  if (voice) u.voice = voice;
  u.lang = voice?.lang || SPEECH_LANG;
  u.rate = rate;
  u.pitch = pitch;

  let started = false;
  let finished = false;
  const begin = () => { if (!started) { started = true; onStart?.(); } };
  const finish = () => {
    if (finished) return;
    finished = true;
    clearTimeout(safety);
    begin();
    onEnd?.();
  };
  u.onstart = begin;
  u.onboundary = (e) => onBoundary?.(e);
  u.onend = finish;
  u.onerror = finish;
  // Safety net in case the browser never reports the end.
  const safety = setTimeout(finish, estimatedSpeechMs(text, rate) + 3000);

  currentUtterance = u;
  speechSynthesis.speak(u);
  return {
    cancel() {
      if (finished) return;
      finished = true;
      clearTimeout(safety);
      speechSynthesis.cancel();
    },
  };
}

export function stopSpeaking() {
  if (synthesisSupported()) speechSynthesis.cancel();
  currentUtterance = null;
}
