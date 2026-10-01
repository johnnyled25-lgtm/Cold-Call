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

// --- Voice realism ----------------------------------------------------------------
import { voiceTier, voiceTierLabel, deliveryFor, splitSentences, sentenceGapMs } from "../js/voicePick.js";
import { BANDS, VOICE_PITCH_RANGE, SENTENCE_GAP_MS } from "../js/constants.js";
import { buildExecRequest, startsWithFiller, FILLERS } from "../js/execPrompt.js";

const mixedVoices = [
  { name: "Microsoft David - English (United States)", lang: "en-US", localService: true },
  { name: "Google US English", lang: "en-US", localService: false },
  { name: "Microsoft Guy Online (Natural) - English (United States)", lang: "en-US", localService: false },
  { name: "Microsoft Zira - English (United States)", lang: "en-US", localService: true },
  { name: "Microsoft Aria Online (Natural) - English (United States)", lang: "en-US", localService: false },
];

test("voices rank Natural/Online first, then Google, then the rest", () => {
  assert.deepEqual(mixedVoices.map(voiceTier), [2, 1, 0, 2, 0]);
  assert.equal(voiceTierLabel(mixedVoices[2]), "natural");
  assert.equal(voiceTierLabel(mixedVoices[1]), "Google");
  assert.equal(voiceTierLabel(mixedVoices[0]), "standard");
  assert.equal(voiceTierLabel(null), "browser default");
  assert.match(pickVoice(mixedVoices, male).voice.name, /Guy Online \(Natural\)/);
  assert.match(pickVoice(mixedVoices, female).voice.name, /Aria Online \(Natural\)/);
  assert.equal(pickVoice(mixedVoices, female).tier, 0);
});

test("a matching voice type beats a more natural voice of the other type", () => {
  const voices = [
    { name: "Microsoft Aria Online (Natural) - English (United States)", lang: "en-US" },
    { name: "Microsoft David - English (United States)", lang: "en-US" },
  ];
  assert.match(pickVoice(voices, male).voice.name, /David/);
});

test("Google ranks above a standard voice when no natural voice matches", () => {
  const voices = [
    { name: "Microsoft Zira - English (United States)", lang: "en-US" },
    { name: "Google US English", lang: "en-US" },
  ];
  assert.equal(pickVoice(voices, female).voice.name, "Google US English");
});

test("impatient execs speak a little faster and flatter; others keep their own delivery", () => {
  const pick = { rate: 1.0, pitch: 1.0 };
  assert.deepEqual(deliveryFor(pick, 50), { rate: 1, pitch: 1 });
  const impatient = deliveryFor(pick, BANDS.IMPATIENT_BELOW - 1);
  assert.ok(impatient.rate > 1 && impatient.pitch < 1);
  const engaged = deliveryFor(pick, BANDS.ENGAGED_MIN);
  assert.equal(engaged.rate, 1);
  // Never outside natural limits, even from the ends of the persona ranges.
  const extreme = deliveryFor({ rate: 9, pitch: -3 }, 5);
  assert.ok(extreme.rate <= 1.15 && extreme.pitch >= 0.85);
});

test("replies are split into sentences to speak separately", () => {
  assert.deepEqual(splitSentences("Hm. Look, I've got two minutes. What is this about?"), ["Hm.", "Look, I've got two minutes.", "What is this about?"]);
  assert.deepEqual(splitSentences("Fine! Thursday at ten... Send the invite"), ["Fine!", "Thursday at ten...", "Send the invite"]);
  assert.deepEqual(splitSentences("About $6.50 a driver. That's it."), ["About $6.50 a driver.", "That's it."]);
  assert.deepEqual(splitSentences("\"Send an email.\" That's what they all say."), ["\"Send an email.\"", "That's what they all say."]);
  assert.deepEqual(splitSentences(""), []);
  assert.deepEqual(splitSentences("No punctuation at all"), ["No punctuation at all"]);
});

test("pauses between sentences stay within 150–250 ms", () => {
  for (let i = 0; i < 20; i++) {
    const gap = sentenceGapMs(i);
    assert.ok(gap >= SENTENCE_GAP_MS[0] && gap <= SENTENCE_GAP_MS[1], String(gap));
  }
});

test("the speech-length safety net allows for the pauses", () => {
  const oneSentence = "Look I have two minutes so tell me what this is about";
  const threeSentences = "Look. I have two minutes. So tell me what this is about.";
  assert.ok(estimatedSpeechMs(threeSentences) > estimatedSpeechMs(oneSentence));
});

test("every persona's rate and pitch sit in the natural ranges", () => {
  for (const p of personas) {
    assert.ok(p.voice.rate >= 0.92 && p.voice.rate <= 1.08, `${p.id} rate ${p.voice.rate}`);
    assert.ok(p.voice.pitch >= VOICE_PITCH_RANGE[0] && p.voice.pitch <= VOICE_PITCH_RANGE[1], `${p.id} pitch ${p.voice.pitch}`);
  }
});

test("fillers are allowed now and then, never twice in a row", () => {
  assert.equal(startsWithFiller("Look, I've got two minutes."), true);
  assert.equal(startsWithFiller("Looking at it now."), false);
  assert.equal(startsWithFiller("Hm. Maybe."), true);
  let s = addStudentTurn(newCall(), { text: "Hi Mike." });
  const fixed = buildExecRequest(s, ctx).system[0];
  for (const f of FILLERS) assert.ok(fixed.includes(`"${f}"`));
  assert.match(fixed, /Never more than one filler in a reply, and never two replies in a row/);

  s = applyExecTurn(s, reply({ say: "Look, I've got two minutes." }), ctx);
  s = addStudentTurn(s, { text: "Quick question." });
  assert.match(buildExecRequest(s, ctx).system[1], /opened with a filler, so don't open this one with one/);

  s = applyExecTurn(s, reply({ say: "Go ahead." }), ctx);
  s = addStudentTurn(s, { text: "How do you cover call-outs?" });
  assert.doesNotMatch(buildExecRequest(s, ctx).system[1], /opened with a filler/);
});

test("Chrome-like voices: a male exec gets a male English voice before a female US one", () => {
  const chromeLike = [
    { name: "Google US English", lang: "en-US" },
    { name: "Google UK English Female", lang: "en-GB" },
    { name: "Google UK English Male", lang: "en-GB" },
  ];
  assert.equal(pickVoice(chromeLike, male).voice.name, "Google UK English Male");
  assert.equal(pickVoice(chromeLike, female).voice.name, "Google US English");
});

test("quality ranks above accent: Google UK male beats an older US male voice; US wins ties", () => {
  const windowsChrome = [
    { name: "Microsoft David - English (United States)", lang: "en-US", localService: true },
    { name: "Microsoft Zira - English (United States)", lang: "en-US", localService: true },
    { name: "Google US English", lang: "en-US" },
    { name: "Google UK English Female", lang: "en-GB" },
    { name: "Google UK English Male", lang: "en-GB" },
  ];
  assert.equal(pickVoice(windowsChrome, male).voice.name, "Google UK English Male");
  assert.equal(pickVoice(windowsChrome, female).voice.name, "Google US English"); // same tier: US wins
});
