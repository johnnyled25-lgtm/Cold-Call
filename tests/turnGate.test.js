import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { createSilenceWatch, guardSpeech } from "../js/turnGate.js";
import { SILENCE_TIMEOUT_SECONDS, SPEECH_START_TIMEOUT_SECONDS } from "../js/constants.js";
import { estimatedSpeechMs } from "../js/voicePick.js";

const SILENCE_MS = SILENCE_TIMEOUT_SECONDS * 1000;

// Runs a test body with a fake clock; tick(ms) moves time forward.
function withClock(body) {
  return () => {
    mock.timers.enable({ apis: ["setTimeout"] });
    try {
      body((ms) => mock.timers.tick(ms));
    } finally {
      mock.timers.reset();
    }
  };
}

// --- Silence (the requested test) ------------------------------------------------

test("silence never fires while input is locked", withClock((tick) => {
  let fired = 0;
  const watch = createSilenceWatch({ onSilence: () => fired++ });
  // Starts locked (the exec is picking up / speaking).
  tick(SILENCE_MS * 5);
  assert.equal(fired, 0);
  // Keystrokes while locked don't start a countdown either.
  watch.activity();
  tick(SILENCE_MS * 2);
  assert.equal(fired, 0);
  // Unlock, then lock again (exec thinking) before 8 s: no silence.
  watch.unlock();
  tick(SILENCE_MS - 1);
  watch.lock();
  tick(SILENCE_MS * 3);
  assert.equal(fired, 0);
}));

test("silence never fires while the text box has changed in the last 8 seconds", withClock((tick) => {
  let fired = 0;
  const watch = createSilenceWatch({ onSilence: () => fired++ });
  watch.unlock();
  // A slow typist: a keystroke every 7 seconds for a minute.
  for (let i = 0; i < 9; i++) {
    tick(SILENCE_MS - 1000);
    watch.activity();
  }
  assert.equal(fired, 0);
  // Then nothing for just under 8 seconds: still no silence.
  tick(SILENCE_MS - 1);
  assert.equal(fired, 0);
  // At a full 8 seconds with no change: one silence.
  tick(1);
  assert.equal(fired, 1);
}));

test("silence fires once, 8 seconds after the student's turn begins with no response", withClock((tick) => {
  let fired = 0;
  const watch = createSilenceWatch({ onSilence: () => fired++ });
  watch.unlock();
  tick(SILENCE_MS);
  assert.equal(fired, 1);
  tick(SILENCE_MS * 3);
  assert.equal(fired, 1); // not again until the next turn
}));

// --- The exec's line always hands the turn back ------------------------------------

test("the turn comes back when the voice ends", withClock((tick) => {
  const reasons = [];
  const g = guardSpeech({ text: "Busy. What's this about?", onRelease: (r) => reasons.push(r) });
  tick(500);
  g.started();
  tick(1500);
  g.ended();
  g.ended(); // a second report changes nothing
  tick(60000);
  assert.deepEqual(reasons, ["ended"]);
}));

test("the turn comes back if the voice never starts", withClock((tick) => {
  const reasons = [];
  guardSpeech({ text: "Busy. What's this about?", onRelease: (r) => reasons.push(r) });
  tick(SPEECH_START_TIMEOUT_SECONDS * 1000);
  assert.deepEqual(reasons, ["no-start"]);
}));

test("the turn comes back if the voice starts but never reports ending", withClock((tick) => {
  const text = "Look, I've got a board meeting in five minutes, so just send me an email.";
  const reasons = [];
  const g = guardSpeech({ text, onRelease: (r) => reasons.push(r) });
  tick(200);
  g.started();
  tick(estimatedSpeechMs(text, 1) + SPEECH_START_TIMEOUT_SECONDS * 1000);
  assert.deepEqual(reasons, ["timeout"]);
}));

test("a speech error hands the turn back like an ending", withClock((tick) => {
  const reasons = [];
  const g = guardSpeech({ text: "Hello?", onRelease: (r) => reasons.push(r) });
  g.ended(); // voice.js reports errors through the same path
  tick(60000);
  assert.deepEqual(reasons, ["ended"]);
}));

test("cancel (the call ended) releases nothing", withClock((tick) => {
  const reasons = [];
  const g = guardSpeech({ text: "Hello?", onRelease: (r) => reasons.push(r) });
  g.cancel();
  tick(60000);
  assert.deepEqual(reasons, []);
}));
