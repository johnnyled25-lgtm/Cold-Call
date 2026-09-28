import { test } from "node:test";
import assert from "node:assert/strict";
import { pickVoice, estimatedSpeechMs } from "../js/voicePick.js";
import { addStudentTurn, addSilenceTurn, applyExecTurn, recordRetry, setTurnLatency, latenciesByInputMode } from "../js/callState.js";
import { VOICE_RATE_RANGE } from "../js/constants.js";
import { personas, ctx, newCall, reply } from "./helpers.js";

// Voice lists like Chrome's and Edge's.
const chromeVoices = [
  { name: "Google US English", lang: "en-US", localService: false },
  { name: "Google UK English Male", lang: "en-GB", localService: false },
  { name: "Google UK English Female", lang: "en-GB", localService: false },
  { name: "Google Deutsch", lang: "de-DE", localService: false },
];
const edgeVoices = [
  { name: "Microsoft David - English (United States)", lang: "en-US", localService: true },
  { name: "Microsoft Zira - English (United States)", lang: "en-US", localService: true },
  { name: "Microsoft Guy Online (Natural) - English (United States)", lang: "en-US", localService: false },
  { name: "Microsoft Aria Online (Natural) - English (United States)", lang: "en-US", localService: false },
];
const male = { id: "m", voice: { type: "male", rate: 1.1, pitch: 0.9 } };
const female = { id: "f", voice: { type: "female", rate: 1, pitch: 1 } };

test("picks a voice matching the exec's voice type", () => {
  assert.match(pickVoice(edgeVoices, male).voice.name, /David|Guy/);
  assert.match(pickVoice(edgeVoices, female).voice.name, /Zira|Aria/);
});

test("prefers the exact language, then falls back to any English voice", () => {
  assert.equal(pickVoice(chromeVoices, female).voice.name, "Google US English");
  const gbOnly = chromeVoices.filter((v) => v.lang !== "en-US");
  assert.equal(pickVoice(gbOnly, male).voice.name, "Google UK English Male");
  assert.equal(pickVoice(gbOnly, female).voice.name, "Google UK English Female");
});

test("a name with 'Female' never counts as male", () => {
  const onlyFemaleNamed = [{ name: "Google UK English Female", lang: "en-US", localService: false }, { name: "Plain Voice", lang: "en-US", localService: false }];
  assert.equal(pickVoice(onlyFemaleNamed, male).voice.name, "Plain Voice");
});

test("the same exec always gets the same voice", () => {
  for (const p of personas) {
    assert.equal(pickVoice(edgeVoices, p).voice.name, pickVoice([...edgeVoices].reverse(), p).voice.name);
  }
});

test("no English voice → browser default; rate and pitch stay natural", () => {
  const r = pickVoice([{ name: "Google Deutsch", lang: "de-DE" }], { id: "x", voice: { rate: 9, pitch: 1 } });
  assert.equal(r.voice, null);
  assert.equal(r.rate, VOICE_RATE_RANGE[1]);
});

test("speech-length estimate grows with words and shrinks with speed", () => {
  assert.ok(estimatedSpeechMs("one two three four five six") > estimatedSpeechMs("one"));
  assert.ok(estimatedSpeechMs("one two three four five six", 1.3) < estimatedSpeechMs("one two three four five six", 1));
});

test("latency is replaced with the full wait, keeping the provider's share", () => {
  let s = addStudentTurn(newCall(), { text: "Hi", inputMode: "voice" });
  s = applyExecTurn(s, reply(), ctx, { latencyMs: 900 });
  s = setTurnLatency(s, 2, 1650);
  assert.equal(s.turns[2].latencyMs, 1650);
  assert.equal(s.turns[2].requestMs, 900);
});

test("latencies are grouped by how the student spoke, leaving out silences and retries", () => {
  let s = addStudentTurn(newCall(), { text: "Hi", inputMode: "typed" });
  s = applyExecTurn(s, reply(), ctx, { latencyMs: 1000 });
  s = addStudentTurn(s, { text: "How do you cover call-outs?", inputMode: "voice" });
  s = applyExecTurn(s, reply(), ctx, { latencyMs: 2000 });
  s = addSilenceTurn(s);
  s = applyExecTurn(s, reply(), ctx, { silence: true, latencyMs: 500 });
  s = addStudentTurn(s, { text: "Sorry, go on", inputMode: "typed" });
  s = recordRetry(s, { latencyMs: 700 });
  assert.deepEqual(latenciesByInputMode(s), { typed: [1000], voice: [2000] });
});

test("every persona has a voice type the app knows", () => {
  for (const p of personas) assert.ok(["male", "female"].includes(p.voice?.type), p.id);
});
