// Timing rules for the student's turn. No DOM; timers are passed in so tests can
// control the clock.
//
// 1. guardSpeech: the exec's line must ALWAYS hand the turn back to the student:
//    when the voice ends, when it errors, when it never starts, or after a
//    length-based limit, whichever comes first, and exactly once.
// 2. createSilenceWatch: the silence countdown (8 s by voice, 20 s typing, plus
//    grace before the first line). It never runs while the student's input is
//    locked, never runs out while text is waiting in the box, and every keystroke
//    starts it over.

import { SILENCE_TIMEOUT_SECONDS, SILENCE_TIMEOUT_TYPED_MS, FIRST_TURN_GRACE_MS, SPEECH_START_TIMEOUT_SECONDS } from "./constants.js";
import { estimatedSpeechMs } from "./voicePick.js";

const defaultTimers = {
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (h) => globalThis.clearTimeout(h),
};

// onRelease(reason) runs once: "ended" (voice finished or errored), "no-start"
// (the voice never began), or "timeout" (took longer than the line should).
// Returns { started, ended, cancel }: call started() when the voice begins,
// ended() when it finishes or errors, cancel() if the call ends first.
export function guardSpeech({ text, rate = 1, onRelease, timers = defaultTimers, startTimeoutMs = SPEECH_START_TIMEOUT_SECONDS * 1000 }) {
  let done = false;
  const release = (reason) => {
    if (done) return;
    done = true;
    timers.clearTimeout(noStart);
    timers.clearTimeout(tooLong);
    onRelease(reason);
  };
  const noStart = timers.setTimeout(() => release("no-start"), startTimeoutMs);
  const tooLong = timers.setTimeout(() => release("timeout"), estimatedSpeechMs(text, rate) + startTimeoutMs);
  return {
    started() { if (!done) timers.clearTimeout(noStart); },
    ended() { release("ended"); },
    cancel() {
      done = true;
      timers.clearTimeout(noStart);
      timers.clearTimeout(tooLong);
    },
    get released() { return done; },
  };
}

// How long the student has before a silence: 8 s talking by voice, 20 s typing,
// plus 10 s of grace before their first line.
export function silenceTimeoutMs({ voice, firstTurn }) {
  return (voice ? SILENCE_TIMEOUT_SECONDS * 1000 : SILENCE_TIMEOUT_TYPED_MS) + (firstTurn ? FIRST_TURN_GRACE_MS : 0);
}

// onSilence runs when the countdown finishes while unlocked.
//   lock():         the student can't act (exec thinking or speaking, recording, call over)
//   unlock(ms):     the student's turn begins; a countdown of ms starts
//   activity():     a keystroke (or anything else the student does); the countdown starts over
// holdWhile(): if it returns true when the countdown ends (e.g. text is waiting in
// the box), there's no silence; the countdown just starts over.
export function createSilenceWatch({ onSilence, holdWhile = () => false, timers = defaultTimers, timeoutMs = SILENCE_TIMEOUT_SECONDS * 1000 }) {
  let locked = true;
  let handle = null;
  let currentMs = timeoutMs;
  const clear = () => {
    if (handle != null) timers.clearTimeout(handle);
    handle = null;
  };
  const restart = () => {
    clear();
    if (locked) return;
    handle = timers.setTimeout(() => {
      handle = null;
      if (locked) return;
      if (holdWhile()) restart();
      else onSilence();
    }, currentMs);
  };
  return {
    lock() { locked = true; clear(); },
    unlock(ms = timeoutMs) { locked = false; currentMs = ms; restart(); },
    activity() { restart(); },
    get locked() { return locked; },
    get counting() { return handle != null; },
  };
}
