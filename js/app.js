// Cold Call Lab — the screens. This is the only file that touches the page.
// All model text is shown with textContent, never as HTML.

import { COPY, fill } from "./copy.js";
import {
  MOODS, DEFAULT_MODELS, MODELS_WITHOUT_TEMPERATURE, OUTCOMES, RING_SECONDS, SILENCE_TIMEOUT_SECONDS, STORAGE_KEYS,
  MAX_TALK_SECONDS, MIC_WAIT_SECONDS,
} from "./constants.js";
import { newSeed } from "./rng.js";
import { drawCall } from "./draw.js";
import {
  createCallState, addStudentTurn, addSilenceTurn, endByStudent, endIfTimeUp, dropCall, callDurationMs,
  setTurnLatency, latenciesByInputMode,
} from "./callState.js";
import { runExecTurn } from "./callController.js";
import { createSender, testConnection, droppedParamsFor } from "./provider.js";
import {
  getKey, setKey, loadSettings, saveSettings, currentCallSettings, clearEverything, loadPastCalls, savePastCall,
} from "./storage.js";
import { patienceBand } from "./bands.js";
import {
  recognitionSupported, synthesisSupported, requestMicAccess, createPushToTalk, loadVoices, speak, stopSpeaking,
} from "./voice.js";
import { pickVoice, deliveryFor, voiceTierLabel } from "./voicePick.js";
import { guardSpeech, createSilenceWatch, silenceTimeoutMs } from "./turnGate.js";
import { mountExec, buildExecPortraitSvg } from "./exec-drawing.js";
import { monogramInitials, monogramColor } from "./monogram.js";
import { renderGallery } from "./gallery.js";
import { analyzeCall, formatTranscriptText } from "./debrief.js";
import { renderDebrief as drawDebrief, renderPastCalls } from "./debrief-view.js";
import { execPose } from "./pose.js";

const $ = (id) => document.getElementById(id);
const DEBUG = new URLSearchParams(location.search).get("debug") === "1";

// Debug only: a record of main-thread tasks over 50 ms (and, in Chrome, long frames),
// so the "no task over 200 ms during a call" target can be checked on a real machine.
const perf = { tasks: [], frames: [] };
if (DEBUG && globalThis.PerformanceObserver) {
  const watch = (type, into) => {
    try {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) into.push({ at: e.startTime, ms: Math.round(e.duration) });
        renderDebug();
      }).observe({ type, buffered: true });
    } catch { /* not supported in this browser */ }
  };
  watch("longtask", perf.tasks);
  watch("long-animation-frame", perf.frames);
}
function perfSummary(since) {
  const tasks = perf.tasks.filter((t) => t.at >= since);
  const frames = perf.frames.filter((t) => t.at >= since);
  const max = (xs) => (xs.length ? Math.max(...xs.map((x) => x.ms)) : 0);
  return `main thread this call: tasks over 50 ms: ${tasks.length}, over 200 ms: ${tasks.filter((t) => t.ms > 200).length}, longest: ${max(tasks)} ms; long frames: ${frames.length}, worst: ${max(frames)} ms`;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  if (props.className) node.className = props.className;
  if (props.text != null) node.textContent = props.text;
  for (const child of [].concat(children)) if (child) node.append(child);
  return node;
}
const copyAt = (path) => path.split(".").reduce((o, k) => (o ? o[k] : undefined), COPY);
const formatTime = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};
const errorMessage = (kind) => COPY.errors[kind] || COPY.errors.other;

function applyCopy() {
  document.querySelectorAll("[data-copy]").forEach((node) => {
    const text = copyAt(node.dataset.copy);
    if (typeof text === "string") node.textContent = text;
  });
  // Icon-only buttons: the words become the button's accessible name and tooltip.
  document.querySelectorAll("[data-copy-label]").forEach((node) => setLabel(node, copyAt(node.dataset.copyLabel)));
  $("typed-input").placeholder = COPY.call.typePlaceholder;
}

function setLabel(node, text) {
  if (typeof text !== "string") return;
  node.setAttribute("aria-label", text);
  node.title = text;
}

function showScreen(name) {
  for (const id of ["briefing", "call", "debrief", "past", "gallery"]) $(`screen-${id}`).hidden = id !== name;
  window.scrollTo(0, 0);
}

function showMessage(text) {
  $("app-message").textContent = text || "";
  $("app-message").hidden = !text;
}

// ---------------------------------------------------------------------------
// Data and the current draw
// ---------------------------------------------------------------------------
let data = null;   // { personas, offers, objections }
let draw = null;   // { seed, persona, offer, mood, pickupLine }
let call = null;   // the call in progress (or just finished)

async function loadData() {
  const get = (p) => fetch(p).then((r) => { if (!r.ok) throw new Error(p); return r.json(); });
  const [personas, offers, objections] = await Promise.all([
    get("data/personas.json"), get("data/offers.json"), get("data/objections.json"),
  ]);
  return { personas, offers, objections };
}

function makeDraw(seed) {
  return drawCall(seed, { ...data, moods: MOODS, pickupLines: COPY.pickupLines });
}

// A new random draw, with a different exec from the current one when possible.
function newDraw() {
  for (let i = 0; i < 20; i++) {
    const d = makeDraw(newSeed());
    if (!draw || d.persona.id !== draw.persona.id) return d;
  }
  return makeDraw(newSeed());
}

// ---------------------------------------------------------------------------
// Briefing
// ---------------------------------------------------------------------------
// The briefing, as a dossier: who you're calling, the goal, what you know, and
// what you're selling. Only what the student is allowed to know; nothing hidden
// (patience, mood, pain points). Icons are fixed markup from ICONS below.
const ICONS = {
  goal: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/></svg>',
  know: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 16l5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  sell: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12V4h8l10 10-8 8z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="7.5" cy="8.5" r="1.6" fill="currentColor"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.15"/><path d="M7 12.5l3.2 3.2L17 9" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};
const icon = (name) => {
  const span = el("span", { className: "icon" });
  span.innerHTML = ICONS[name]; // fixed markup above; never model text
  return span.firstElementChild;
};
const monogramBadge = (company, size = "") =>
  el("span", { className: `monogram mono-${monogramColor(company)} ${size}`.trim(), text: monogramInitials(company), attrs: { "aria-hidden": "true" } });

function briefingDossier({ persona, offer }) {
  const b = COPY.briefing;
  const portrait = el("div", { className: "avatar" });
  portrait.innerHTML = buildExecPortraitSvg(persona.appearance, { idPrefix: "pb" }); // our own fixed markup

  const hero = el("section", { className: "dossier-hero", attrs: { "aria-label": b.youAreCalling } }, [
    portrait,
    el("div", { className: "dossier-who" }, [
      el("div", { className: "eyebrow", text: b.eyebrow }),
      el("h3", { className: "dossier-name", text: persona.name }),
      el("div", { className: "dossier-title", text: persona.title }),
      el("div", { className: "dossier-company" }, [
        monogramBadge(persona.company),
        el("strong", { text: persona.company }),
        el("span", { className: "pill", text: persona.industry }),
      ]),
    ]),
  ]);

  const goal = el("div", { className: "goal-banner" }, [icon("goal"), el("div", {}, [el("strong", { text: b.goalHeading }), el("span", { text: b.goal })])]);

  const fact = (label, value) => el("div", {}, [el("dt", { text: label }), el("dd", { text: value })]);
  const know = el("section", { className: "dossier-card" }, [
    el("h3", {}, [icon("know"), b.knowHeading]),
    el("dl", { className: "facts" }, [
      fact(b.knowSize, persona.companySize),
      fact(b.knowSetup, persona.currentSetup),
    ]),
  ]);

  const sell = el("section", { className: "dossier-card" }, [
    el("h3", {}, [icon("sell"), b.sellHeading]),
    el("div", { className: "product-head" }, [
      monogramBadge(offer.company, "small"),
      el("div", {}, [el("div", { className: "product-name", text: offer.product }), el("div", { className: "product-maker", text: fill(b.sellFrom, { company: offer.company }) })]),
    ]),
    el("p", { className: "product-pitch", text: offer.oneLiner }),
    el("ul", { className: "checks" }, offer.valuePoints.map((t) => el("li", {}, [icon("check"), el("span", { text: t })]))),
    el("div", { className: "price-chip" }, [el("b", { text: `${b.price}:` }), offer.priceHint]),
  ]);

  const youAre = el("p", { className: "you-are" }, [
    el("strong", { text: `${b.youAreHeading}: ` }),
    fill(b.youAre, { name: COPY.student.name, role: COPY.student.role, company: offer.company }),
  ]);

  return [hero, goal, el("div", { className: "dossier-grid" }, [know, sell]), youAre];
}

// The briefing as compact tiles, beside the exec during the call.
function briefingTiles({ persona, offer }) {
  const c = COPY.call;
  const tile = (label, body, wide = false) => el("div", { className: `brief-tile${wide ? " wide" : ""}` }, [el("b", { text: label }), body]);
  return [
    tile(c.briefYouAre, fill(COPY.briefing.youAre, { name: COPY.student.name, role: COPY.student.role, company: offer.company })),
    tile(c.briefCalling, `${persona.name}, ${persona.title}, ${persona.company}`),
    tile(c.briefKnow, `${persona.industry} · ${persona.companySize}`),
    tile(c.briefSetup, persona.currentSetup, true),
    tile(c.briefSelling, `${offer.product}: ${offer.oneLiner}`, true),
    tile(c.briefPoints, el("ul", {}, offer.valuePoints.map((t) => el("li", { text: t }))), true),
    tile(c.briefPrice, offer.priceHint),
  ];
}

let briefingActions = null;
function renderBriefing() {
  // The Call buttons sit in the hero, so they're on screen without scrolling. Keep
  // our own reference: the hero is rebuilt each time, which takes them off the page.
  briefingActions ??= $("briefing-actions");
  $("briefing-card").replaceChildren(...briefingDossier(draw));
  $("briefing-card").querySelector(".dossier-hero").append(briefingActions);
  $("btn-call-label").textContent = fill(COPY.briefing.callButtonName, { first: draw.persona.name.split(" ")[0] });
  showScreen("briefing");
}

// ---------------------------------------------------------------------------
// The call
// ---------------------------------------------------------------------------
// A call goes: ringing → live (the exec picked up) → done.
// While live, at most one of these is true at a time: the student holding the talk
// button (recording), the browser finishing the words (transcribing), the exec
// thinking (busy), or the exec speaking. When none is true, it's the student's turn.

function privacyNoteSeen() {
  try { return localStorage.getItem(STORAGE_KEYS.privacyNoteSeen) === "1"; } catch { return false; }
}
function markPrivacyNoteSeen() {
  try { localStorage.setItem(STORAGE_KEYS.privacyNoteSeen, "1"); } catch {}
}

// Shows the one-time voice privacy note, then resolves when the student clicks "Got it".
// It counts as seen as soon as it's shown, so closing the tab with the note open
// doesn't bring it back next time.
function showPrivacyNote() {
  return new Promise((resolve) => {
    const dialog = $("privacy-dialog");
    dialog.addEventListener("close", () => resolve(), { once: true });
    dialog.showModal();
    markPrivacyNoteSeen();
  });
}

async function startCall() {
  showMessage("");
  const settings = currentCallSettings();
  if (!settings.key) {
    openSettings(COPY.settings.needKey);
    return;
  }
  if (recognitionSupported() && !privacyNoteSeen()) await showPrivacyNote();

  const { persona, offer, mood } = draw;
  const ctx = {
    persona, offer, mood,
    objections: data.objections.filter((o) => persona.objections.includes(o.id)),
  };
  const thisCall = {
    phase: "ringing",
    state: null,
    ctx,
    settings, // provider, key, and model are fixed for the whole call
    voiceIn: recognitionSupported(),
    mic: null, // "granted" | "denied" | "no-mic" | "unsupported", checked while ringing
    voiceOut: null, // { voice, rate, pitch } once the browser's voices load
    recording: false,
    transcribing: false,
    busy: false,
    speaking: false,
    speech: null,
    ptt: null,
    interim: "",
    waitUntil: null,
    silence: null, // the silence countdown (turnGate.js)
    lastInputMode: "typed", // "voice" or "typed": sets how long a silence takes
    perfSince: performance.now(), // for the debug panel's main-thread record
    talkTimer: null,
    timer: null,
    abort: null,
    lastDebug: null,
    notes: [],
  };
  call = thisCall;
  thisCall.silence = createSilenceWatch({
    onSilence: () => onSilence(thisCall),
    holdWhile: () => Boolean($("typed-input").value.trim()), // text waiting in the box counts as responding
  });
  if (thisCall.voiceIn) thisCall.ptt = makePushToTalk(thisCall);

  call?.drawing?.destroy?.();
  thisCall.drawing = mountExec($("exec-stage"), persona, COPY.exec.describe);
  $("call-brief-body").replaceChildren(...briefingTiles(draw));
  $("calling-avatar").innerHTML = buildExecPortraitSvg(persona.appearance, { idPrefix: "pc" }); // our own fixed markup
  $("phone-avatar").innerHTML = buildExecPortraitSvg(persona.appearance, { idPrefix: "pp" });
  $("calling-name").textContent = persona.name;
  $("calling-sub").textContent = `${persona.title} · ${persona.company}`;
  $("typing").setAttribute("aria-label", fill(COPY.call.execThinking, { first: persona.name.split(" ")[0] }));
  $("phone-name").textContent = persona.name;
  $("phone-sub").textContent = `${persona.title} · ${persona.company}`;
  $("phone-timer").textContent = "0:00";
  setCallNote(thisCall.voiceIn ? "" : COPY.voice.unavailable);
  $("typed-input").value = "";
  showScreen("call"); // scrolls to the top
  renderCall();

  // Ring while the browser's voices load and the microphone permission is asked,
  // so the permission pop-up doesn't interrupt the student's first line. If the
  // pop-up isn't answered within MIC_WAIT_SECONDS, the exec picks up anyway: the
  // student can type, and voice turns on once the pop-up is answered.
  const wait = (ms, value) => new Promise((r) => setTimeout(() => r(value), ms));
  const micCheck = thisCall.voiceIn ? micAccess() : Promise.resolve("unsupported");
  const [voices, mic] = await Promise.all([
    loadVoices(),
    Promise.race([micCheck, wait(MIC_WAIT_SECONDS * 1000, "pending")]),
    wait(RING_SECONDS * 1000),
  ]);
  if (call !== thisCall || thisCall.phase !== "ringing") return; // ended while ringing
  applyMicResult(thisCall, mic);
  thisCall.lastInputMode = thisCall.voiceIn && mic === "granted" ? "voice" : "typed";
  if (mic === "pending") micCheck.then((late) => { if (call === thisCall && thisCall.phase === "live") { applyMicResult(thisCall, late); renderCall(); } });
  thisCall.voiceOut = pickVoice(voices, persona);
  thisCall.notes.push(`voice: ${thisCall.voiceOut.voice?.name || "browser default"} (${voiceTierLabel(thisCall.voiceOut.voice)}; rate ${thisCall.voiceOut.rate}, pitch ${thisCall.voiceOut.pitch})`);

  // The exec picks up. The call clock starts now.
  thisCall.phase = "live";
  thisCall.state = createCallState({ ...draw, startedAt: Date.now() });
  thisCall.timer = setInterval(tick, 250);
  renderCall();
  speakExec(thisCall, thisCall.state.turns[0].text);
  (thisCall.voiceIn ? $("btn-talk") : $("typed-input")).focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

// Records the microphone check's result on the call and adjusts voice input.
function applyMicResult(c, mic) {
  c.mic = mic;
  if (!c.voiceIn) return;
  if (mic === "denied") switchToTyping(c, COPY.voice.micBlocked);
  else if (mic === "no-mic") switchToTyping(c, COPY.voice.noMic);
  else if (mic === "pending") setCallNote(COPY.voice.micPending);
  else if ($("call-note").textContent === COPY.voice.micPending) setCallNote("");
}

let micGranted = false;
async function micAccess() {
  if (micGranted) return "granted";
  const result = await requestMicAccess();
  micGranted = result === "granted";
  return result;
}

// The plain message for a speech-recognition error. mic: what the permission check found.
function voiceErrorMessage(kind, mic) {
  if (kind === "not-allowed" || kind === "service-not-allowed") {
    // Mic allowed but recognition refused: the speech service itself is off or blocked.
    return mic === "granted" ? COPY.voice.serviceBlocked : COPY.voice.micBlocked;
  }
  if (kind === "audio-capture") return COPY.voice.noMic;
  if (kind === "network") return COPY.voice.serviceDown;
  return COPY.voice.didntCatch;
}

function setCallNote(text) {
  $("call-note").textContent = text || "";
  $("call-note").hidden = !text;
}

function tick() {
  if (!call || call.phase !== "live") return;
  $("phone-timer").textContent = formatTime(callDurationMs(call.state, Date.now()));
  renderStatus();
  const next = endIfTimeUp(call.state, Date.now());
  if (next !== call.state) {
    call.state = next;
    stopEverything(call);
    finishCall();
  }
}

const canAct = (c) => Boolean(c && c.phase === "live" && !c.state.ended && !c.busy && !c.speaking && !c.transcribing);

function renderStatus() {
  if (!call) return;
  let status = "";
  if (call.phase === "ringing") status = "";
  else if (call.waitUntil && Date.now() < call.waitUntil) {
    status = fill(COPY.call.lineBusy, { seconds: Math.ceil((call.waitUntil - Date.now()) / 1000) });
  } else if (call.recording) status = call.interim ? `“${call.interim}”` : COPY.voice.recording;
  else if (call.busy || call.transcribing || call.speaking || call.state?.ended) status = "";
  else status = COPY.call.listening;
  if ($("call-status").textContent !== status) $("call-status").textContent = status;
  // The exec "typing" dots while the reply is on its way.
  const thinking = call.phase === "live" && (call.busy || call.transcribing) && !(call.waitUntil && Date.now() < call.waitUntil);
  if ($("typing").hidden === thinking) {
    $("typing").hidden = !thinking;
    if (thinking) $("chat").scrollTop = $("chat").scrollHeight;
  }
}

function renderCall() {
  const c = call;
  const firstName = c.ctx.persona.name.split(" ")[0];
  const turns = c.state ? c.state.turns : [];
  const list = $("transcript");
  const transcriptKey = `${turns.length}|${turns.at(-1)?.text ?? ""}`;
  // Rebuild the transcript only when it changed (not on every status update).
  if (c.transcriptKey !== transcriptKey) {
    c.transcriptKey = transcriptKey;
    list.replaceChildren(
      ...turns.map((t) => {
        const who = t.speaker === "student" ? COPY.call.you : firstName;
        if (t.speaker === "student" && t.events.includes("silence")) {
          return el("li", { className: "bubble bubble-silence" }, [el("span", { className: "visually-hidden", text: `${who}: ` }), COPY.debrief.silence]);
        }
        const meta = el("span", { className: "meta" }, [
          t.inputMode === "voice" ? el("span", { className: "mic", text: "🎤 ", attrs: { "aria-hidden": "true" } }) : null,
          t.inputMode === "voice" ? el("span", { className: "visually-hidden", text: `${COPY.voice.spoken} ` }) : null,
          `${who}`,
        ]);
        return el("li", { className: `bubble bubble-${t.speaker}` }, [meta, el("span", { className: "visually-hidden", text: ": " }), t.text]);
      }),
    );
    $("chat").scrollTop = $("chat").scrollHeight;
  }
  renderStatus();
  $("calling").hidden = c.phase !== "ringing";
  $("call-live").hidden = c.phase === "ringing";

  const open = canAct(c);
  $("typed-input").disabled = !open;
  $("btn-send").disabled = !open;
  $("btn-talk").hidden = !c.voiceIn;
  $("btn-talk").disabled = (!open && !c.recording) || c.mic === "pending";
  setLabel($("btn-talk"), c.recording ? COPY.call.talkRelease : COPY.call.talkButton);
  $("btn-talk").classList.toggle("is-recording", c.recording);
  if (c.state) $("phone-timer").textContent = formatTime(callDurationMs(c.state, Date.now()));
  c.drawing?.setPose(execPose({ phase: c.phase, state: c.state, speaking: c.speaking }));
  renderDebug();
}

// The exec says a line. Its text is already on screen. When the voice starts,
// onStarted(time) runs (for latency). The turn goes back to the student when the
// voice ends, errors, never starts, or runs past its expected length, whichever
// comes first (guardSpeech), so the input can never stay locked.
function speakExec(c, text, onStarted) {
  c.speaking = true;
  c.silence.lock();
  renderCall();
  const v = c.voiceOut || {};
  // The exec's own rate and pitch, nudged by the patience band (impatient: faster, flatter).
  const delivery = deliveryFor(c.voiceOut, c.state?.patience ?? c.ctx.mood.startingPatience);
  const guard = guardSpeech({
    text,
    rate: delivery.rate,
    onRelease: (reason) => {
      if (reason === "no-start") c.speech?.cancel(); // don't let a late voice talk over the student
      if (reason !== "ended") c.notes.push(`exec voice: ${reason}; turn handed back anyway`);
      c.speaking = false;
      c.speech = null;
      if (call !== c) return;
      renderCall();
      if (c.state.ended) {
        setTimeout(finishCall, 1800); // a moment to read the last line and see the exec hang up or write the note
        return;
      }
      armSilence(c);
      if (!c.voiceIn) $("typed-input").focus({ preventScroll: true });
    },
  });
  c.speechGuard = guard;
  try {
    const handle = speak(text, {
      voice: v.voice, rate: delivery.rate, pitch: delivery.pitch,
      onStart: () => { guard.started(); onStarted?.(Date.now()); },
      onBoundary: () => c.drawing?.pulseMouth(),
      onEnd: () => guard.ended(),
    });
    if (!guard.released) c.speech = handle;
  } catch (err) {
    console.error(err);
    guard.ended();
  }
}

// --- Silence -----------------------------------------------------------------
// The countdown (createSilenceWatch) starts when the student's turn begins: 8 s by
// voice, 20 s typing, plus 10 s before the first line. It never runs while input is
// locked, starts over on every keystroke, and never runs out while text is waiting
// in the box, so a slow typist is never charged.
function onSilence(c) {
  if (call !== c || !canAct(c) || c.recording) return;
  takeTurn(c, { silence: true, releasedAt: Date.now() });
}
function armSilence(c) {
  if (!c?.silence) return;
  const firstTurn = !c.state?.turns.some((t) => t.speaker === "student" && !t.events.includes("silence"));
  c.silence.unlock(silenceTimeoutMs({ voice: c.lastInputMode === "voice", firstTurn }));
}
const disarmSilence = (c) => c?.silence?.lock();

// --- Push to talk -------------------------------------------------------------
function makePushToTalk(c) {
  return createPushToTalk({
    onInterim: (text) => { c.interim = text; renderStatus(); },
    onDone: ({ text, releasedAt }) => {
      c.transcribing = false;
      c.interim = "";
      if (call !== c || c.phase !== "live") return;
      if (!text) {
        setCallNote(COPY.voice.didntCatch);
        renderCall();
        armSilence(c);
        return;
      }
      setCallNote("");
      takeTurn(c, { text, inputMode: "voice", releasedAt });
    },
    onError: (kind) => {
      c.recording = false;
      c.transcribing = false;
      c.interim = "";
      if (call !== c) return;
      clearTimeout(c.talkTimer);
      const message = voiceErrorMessage(kind, c.mic);
      if (message === COPY.voice.didntCatch) setCallNote(message);
      else switchToTyping(c, DEBUG ? `${message} [${kind}]` : message);
      c.notes.push(`speech recognition error: ${kind} (mic permission: ${c.mic})`);
      renderCall();
      armSilence(c); // a fresh 8 seconds; the problem wasn't the student's
    },
  });
}

function switchToTyping(c, note) {
  c.voiceIn = false;
  c.lastInputMode = "typed";
  c.ptt?.cancel();
  setCallNote(note);
  $("typed-input").focus({ preventScroll: true });
}

function pressTalk() {
  const c = call;
  if (!c || !c.voiceIn || c.recording || !canAct(c) || c.mic === "pending") return;
  disarmSilence(c);
  setCallNote("");
  c.interim = "";
  if (!c.ptt.start()) return;
  c.recording = true;
  // If the student forgets to click Send, send what was heard after MAX_TALK_SECONDS.
  c.talkTimer = setTimeout(releaseTalk, MAX_TALK_SECONDS * 1000);
  renderCall();
}

function releaseTalk() {
  const c = call;
  if (!c || !c.recording) return;
  clearTimeout(c.talkTimer);
  c.recording = false;
  c.transcribing = true; // the browser takes a moment to finish the words
  c.ptt.stop();
  renderCall();
}

// Click to talk, click again to send. It's an ordinary button, so the keyboard
// (Tab to it, then Enter or Space) works the way it does for any button.
function wireTalkButton() {
  $("btn-talk").addEventListener("click", () => {
    if (call?.recording) releaseTalk();
    else pressTalk();
  });

  // Every keystroke starts the silence countdown over.
  $("typed-input").addEventListener("input", () => {
    if (call?.phase === "live") call.silence.activity();
  });
}

// --- One exchange ---------------------------------------------------------------
// The student's line (or a silence) goes in; the exec's reply comes back and is spoken.
async function takeTurn(c, { text = "", inputMode = "typed", silence = false, releasedAt = Date.now() }) {
  if (call !== c || !canAct(c)) return;
  if (!silence && !text.trim()) return;
  disarmSilence(c);
  // A silence never touches the text box: anything typed there stays, ready to send.
  c.state = silence ? addSilenceTurn(c.state, { at: releasedAt }) : addStudentTurn(c.state, { text, inputMode, at: releasedAt });
  if (!silence) c.lastInputMode = inputMode;
  c.busy = true;
  c.abort = new AbortController();
  renderCall();

  const send = createSender(c.settings, {
    signal: c.abort.signal,
    onWait: (seconds) => { c.waitUntil = Date.now() + seconds * 1000; renderStatus(); },
    onParamDropped: (param) => c.notes.push(`${c.settings.model} rejected "${param}"; sent without it.`),
  });

  let result;
  try {
    result = await runExecTurn(c.state, c.ctx, send, { silence });
  } catch (err) {
    c.busy = false;
    c.waitUntil = null;
    if (call !== c || c.abort.signal.aborted) return; // ended by the student or the clock
    c.state = dropCall(c.state, Date.now());
    c.lastDebug = { error: err?.kind || "other", status: err?.status ?? null, detail: err?.detail || String(err?.message || "") };
    showMessage(errorMessage(err?.kind));
    renderCall();
    setTimeout(finishCall, 1500);
    return;
  }
  c.busy = false;
  c.waitUntil = null;
  if (call !== c || c.state.ended) return; // the call ended while waiting

  c.state = result.state;
  c.lastDebug = { attempts: result.attempts, requestMs: result.latencyMs };
  const execIndex = c.state.turns.length - 1;
  speakExec(c, c.state.turns[execIndex].text, (startedAt) => {
    // The wait the student felt: release (or Enter) → the exec's first word.
    c.state = setTurnLatency(c.state, execIndex, startedAt - releasedAt);
    if (DEBUG) console.info(`[Cold Call Lab] ${silence ? "silence" : inputMode} turn: ${startedAt - releasedAt} ms to speech (provider ${result.latencyMs} ms)`);
    renderDebug();
  });
}

function stopEverything(c) {
  disarmSilence(c);
  c.speechGuard?.cancel();
  clearTimeout(c.talkTimer);
  c.abort?.abort();
  c.ptt?.cancel();
  c.speech?.cancel();
  c.speaking = false;
  c.recording = false;
  c.transcribing = false;
  stopSpeaking();
}

function endCallByStudent() {
  const c = call;
  if (!c || c.finished) return;
  if (c.phase === "ringing") {
    // Hung up before the exec answered: no call happened.
    c.phase = "done";
    stopEverything(c);
    call = null;
    setCallNote("");
    renderBriefing();
    return;
  }
  if (c.state.ended) return;
  stopEverything(c);
  c.state = endByStudent(c.state, Date.now());
  finishCall();
}

function finishCall() {
  const c = call;
  if (!c || c.finished || !c.state) return;
  c.finished = true;
  c.phase = "done";
  clearInterval(c.timer);
  disarmSilence(c);
  setCallNote("");
  // Show the debrief first; save the call a moment later so the two never share one long task.
  renderDebrief(c);
  setTimeout(() => savePastCall(c.state, { persona: c.ctx.persona, offer: c.ctx.offer, mood: c.ctx.mood, objections: c.ctx.objections }), 0);
}

// ---------------------------------------------------------------------------
// Debrief and past calls
// ---------------------------------------------------------------------------
const formatDate = (ms) =>
  new Date(ms).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

// Copies text to the clipboard; returns true if it worked.
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older browsers, or clipboard blocked: fall back to a hidden text box.
    const box = el("textarea");
    box.value = text;
    box.setAttribute("readonly", "");
    box.style.position = "fixed";
    box.style.opacity = "0";
    document.body.append(box);
    box.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch {}
    box.remove();
    return ok;
  }
}

// Shows the debrief for a call (just finished, or reopened from Past calls).
function renderDebrief({ state, ctx }) {
  const analysis = analyzeCall(state, ctx);
  const transcriptText = formatTranscriptText(analysis, { dateText: formatDate(state.startedAt) });
  drawDebrief($("debrief-body"), analysis, {
    onCallAgain: callAgain,
    onCopy: () => copyText(transcriptText),
    transcriptText,
  });
  debriefSeed = state.seed;
  showScreen("debrief");
  renderDebug();
}

// "Call again": same exec, offer, and mood (same seed) as the debrief on screen.
let debriefSeed = null;
function callAgain() {
  if (debriefSeed == null) return;
  draw = makeDraw(debriefSeed);
  startCall();
}

function showPastCalls() {
  showMessage("");
  renderPastCalls($("past-body"), loadPastCalls(), {
    formatDate,
    onOpen: (record) => { call = null; renderDebrief(record); },
  });
  showScreen("past");
}

// ---------------------------------------------------------------------------
// Settings drawer
// ---------------------------------------------------------------------------
// While the drawer is open, edits go into `draft`; Save writes them, Cancel drops them.
let draft = null;
let testAbort = null;

function openSettings(alertText = "") {
  const saved = loadSettings();
  draft = { ...saved, models: { ...saved.models }, keys: { anthropic: getKey("anthropic"), openai: getKey("openai") } };
  $("settings-alert").textContent = alertText;
  $("settings-alert").hidden = !alertText;
  $("test-result").textContent = "";
  $("mic-test-result").textContent = "";
  document.querySelector(`input[name="provider"][value="${draft.provider}"]`).checked = true;
  $("set-temp").value = String(draft.temperature);
  showDraftProvider();
  $("settings-drawer").returnValue = ""; // so Esc after an earlier Save doesn't save again
  $("settings-drawer").showModal();
  (alertText ? $("set-key") : $("settings-heading")).focus?.();
}

// Copies the key and model fields into the draft (before switching provider or saving).
function captureFields() {
  draft.keys[draft.provider] = $("set-key").value.trim();
  draft.models[draft.provider] = $("set-model").value.trim() || DEFAULT_MODELS[draft.provider];
  draft.temperature = Number($("set-temp").value);
}

// Shows the fields for the provider selected in the draft.
function showDraftProvider() {
  const p = draft.provider;
  const link = COPY.settings.keyLinks[p];
  $("key-link").textContent = link.label;
  $("key-link").href = link.url;
  $("set-key").value = draft.keys[p];
  $("set-key").type = "password";
  $("btn-show-key").textContent = COPY.settings.showKey;
  $("set-model").value = draft.models[p];
  $("btn-model-reset").textContent = fill(COPY.settings.modelReset, { model: DEFAULT_MODELS[p] });
  $("test-result").textContent = "";
  renderTemperature();
}

function renderTemperature() {
  $("temp-value").textContent = Number($("set-temp").value).toFixed(1);
  const model = $("set-model").value.trim();
  const ignored = MODELS_WITHOUT_TEMPERATURE.includes(model) || droppedParamsFor(model).includes("temperature");
  $("temp-field").hidden = ignored;
  $("temp-note").textContent = COPY.settings.temperatureNote;
}

async function runTest() {
  captureFields();
  testAbort?.abort();
  testAbort = new AbortController();
  const button = $("btn-test");
  button.disabled = true;
  $("test-result").textContent = COPY.settings.testing;
  const settings = { provider: draft.provider, key: draft.keys[draft.provider], model: draft.models[draft.provider], temperature: draft.temperature };
  try {
    const result = await testConnection(settings, {
      signal: testAbort.signal,
      onWait: (seconds) => { $("test-result").textContent = fill(COPY.call.lineBusy, { seconds }); },
    });
    $("test-result").textContent = result.ok
      ? fill(COPY.settings.testOk, { provider: COPY.settings.providerNames[settings.provider], seconds: (result.ms / 1000).toFixed(1) })
      : fill(COPY.settings.testFailed, { message: errorMessage(result.kind) });
    if (DEBUG && !result.ok) $("test-result").append(el("code", { className: "debug-detail", text: ` [${result.status ?? "-"} ${result.detail}]` }));
    renderTemperature(); // the test may have found that this model rejects temperature
  } catch {
    // Drawer closed during the test; nothing to show.
  } finally {
    button.disabled = false;
  }
}

// Test microphone: asks for the mic, listens for up to 5 seconds (or until clicked
// again), and reports what it heard or exactly what went wrong.
let micTest = null;
const MIC_TEST_SECONDS = 5;

async function runMicTest() {
  const out = $("mic-test-result");
  const button = $("btn-mic-test");
  if (micTest) { micTest.ptt.stop(); return; } // second click: stop early
  if (!recognitionSupported()) { out.textContent = COPY.voice.unavailable; return; }

  out.textContent = COPY.voice.testAsking;
  const mic = await micAccess();
  if (mic !== "granted") {
    out.textContent = mic === "no-mic" ? COPY.voice.noMic : COPY.voice.micBlocked;
    return;
  }
  const finish = (text) => {
    if (!micTest) return;
    clearTimeout(micTest.timer);
    micTest = null;
    out.textContent = text;
    button.textContent = COPY.voice.test;
  };
  const ptt = createPushToTalk({
    onInterim: (t) => { if (t) out.textContent = `“${t}”`; },
    onDone: ({ text }) => finish(text ? fill(COPY.voice.testHeard, { text }) : COPY.voice.testNothing),
    onError: (kind) => finish(voiceErrorMessage(kind, mic) + (DEBUG ? ` [${kind}]` : "")),
  });
  micTest = { ptt, timer: null };
  if (!ptt.start()) { finish(COPY.voice.didntCatch); return; }
  out.textContent = fill(COPY.voice.testListening, { seconds: MIC_TEST_SECONDS });
  button.textContent = COPY.voice.testStop;
  micTest.timer = setTimeout(() => micTest?.ptt.stop(), MIC_TEST_SECONDS * 1000);
}

function onSettingsClose() {
  testAbort?.abort();
  if (micTest) { micTest.ptt.cancel(); clearTimeout(micTest.timer); micTest = null; $("btn-mic-test").textContent = COPY.voice.test; }
  if ($("settings-drawer").returnValue === "save" && draft) {
    captureFields();
    setKey("anthropic", draft.keys.anthropic);
    setKey("openai", draft.keys.openai);
    saveSettings(draft);
    showMessage("");
  }
  $("set-key").value = ""; // don't leave the key sitting in the page
  draft = null;
}

function wireSettings() {
  $("open-settings").addEventListener("click", () => openSettings());
  $("btn-close-settings").addEventListener("click", () => $("settings-drawer").close("cancel"));
  $("settings-drawer").addEventListener("close", onSettingsClose);
  document.querySelectorAll('input[name="provider"]').forEach((radio) =>
    radio.addEventListener("change", () => {
      captureFields();
      draft.provider = radio.value;
      showDraftProvider();
    }),
  );
  $("btn-show-key").addEventListener("click", () => {
    const hidden = $("set-key").type === "password";
    $("set-key").type = hidden ? "text" : "password";
    $("btn-show-key").textContent = hidden ? COPY.settings.hideKey : COPY.settings.showKey;
  });
  $("btn-model-reset").addEventListener("click", () => {
    $("set-model").value = DEFAULT_MODELS[draft.provider];
    renderTemperature();
  });
  $("set-model").addEventListener("input", renderTemperature);
  $("set-temp").addEventListener("input", renderTemperature);
  $("btn-test").addEventListener("click", runTest);
  $("btn-mic-test").addEventListener("click", runMicTest);
  $("btn-clear").addEventListener("click", () => {
    if (!window.confirm(COPY.settings.clearConfirm)) return;
    clearEverything();
    const fresh = loadSettings();
    draft = { ...fresh, models: { ...fresh.models }, keys: { anthropic: "", openai: "" } };
    document.querySelector(`input[name="provider"][value="${draft.provider}"]`).checked = true;
    $("set-temp").value = String(draft.temperature);
    showDraftProvider();
    $("test-result").textContent = COPY.settings.cleared;
    if (!$("screen-past").hidden) showPastCalls();
  });
}

// ---------------------------------------------------------------------------
// Debug panel (?debug=1). For the owner, not students. Never shows the key.
// ---------------------------------------------------------------------------
function renderDebug() {
  const panel = $("debug-panel");
  if (!DEBUG || !call || !call.state) return;
  const s = call.state;
  const byMode = latenciesByInputMode(s);
  const lines = [
    `provider: ${call.settings.provider}  model: ${call.settings.model}  dropped params: ${droppedParamsFor(call.settings.model).join(", ") || "none"}`,
    `seed: ${s.seed}  mood: ${s.moodId}  patience: ${s.patience}  band: ${patienceBand(s.patience)}`,
    `revealed: ${s.revealedPainIds.join(", ") || "none"}`,
    `objections: ${s.raisedObjections.map((o) => `${o.id}${o.handled ? " (handled)" : ""}`).join(", ") || "none"}`,
    `ask: ${s.askMade ? `yes, by ${s.askDetectedBy}${s.askPhrase ? ` ("${s.askPhrase}")` : ""}` : "no"}`,
    `outcome: ${s.outcome || "-"}`,
    `latency, release/Enter → exec's voice (ms): typed [${byMode.typed.join(", ")}]  voice [${byMode.voice.join(", ")}]`,
    `median latency (ms): typed ${median(byMode.typed) ?? "-"} (${byMode.typed.length} turns)  voice ${median(byMode.voice) ?? "-"} (${byMode.voice.length} turns)`,
    perfSummary(call.perfSince ?? 0),
    ...call.notes.map((n) => `note: ${n}`),
    "",
    "last result:",
    JSON.stringify(call.lastDebug, null, 2),
  ];
  panel.replaceChildren(el("pre", { text: lines.join("\n") }));
  panel.hidden = false;
}

// ---------------------------------------------------------------------------
// Start up
// ---------------------------------------------------------------------------
async function init() {
  applyCopy();
  wireSettings();
  $("btn-call").addEventListener("click", startCall);
  $("btn-random").addEventListener("click", () => { draw = newDraw(); renderBriefing(); });
  $("typed-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const text = $("typed-input").value;
    if (!call || !canAct(call) || !text.trim()) return;
    $("typed-input").value = "";
    takeTurn(call, { text, inputMode: "typed", releasedAt: Date.now() });
  });
  wireTalkButton();
  $("btn-end").addEventListener("click", endCallByStudent);
  $("btn-calling-end").addEventListener("click", endCallByStudent);
  $("btn-call-again").addEventListener("click", callAgain);
  $("btn-new-exec").addEventListener("click", () => { draw = newDraw(); call = null; showMessage(""); renderBriefing(); });
  $("open-past").addEventListener("click", showPastCalls);
  $("btn-past-back").addEventListener("click", () => { if (draw) renderBriefing(); });
  window.addEventListener("pagehide", () => { if (call) stopEverything(call); });

  $("briefing-card").textContent = COPY.briefing.loading;
  try {
    data = await loadData();
  } catch {
    $("briefing-card").textContent = COPY.briefing.loadFailed;
    return;
  }
  // ?gallery=1: every exec in every state, for checking the drawing.
  if (new URLSearchParams(location.search).get("gallery") === "1") {
    // Add &only=<persona id> (e.g. &only=kettle-creek-dental) to see one exec large.
    const only = new URLSearchParams(location.search).get("only");
    renderGallery($("screen-gallery"), data.personas.filter((p) => !only || p.id === only), COPY.exec.describe);
    if (only) $("screen-gallery").classList.add("gallery-large");
    showScreen("gallery");
    return;
  }
  draw = newDraw();
  renderBriefing();
}

init();
