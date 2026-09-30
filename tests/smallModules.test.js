// Ask detection, patience bands, the prompt builder, and the provider request body.
import { test } from "node:test";
import assert from "node:assert/strict";
import { detectAsk } from "../js/askDetect.js";
import { patienceBand } from "../js/bands.js";
import { BANDS, ACCEPTANCE_THRESHOLD } from "../js/constants.js";
import { buildExecRequest, buildMessages, SILENCE_MARKER } from "../js/execPrompt.js";
import { addStudentTurn, addSilenceTurn, applyExecTurn } from "../js/callState.js";
import { anthropicBody } from "../js/provider.js";
import { ctx, newCall, reply } from "./helpers.js";

test("detectAsk catches common meeting asks", () => {
  for (const line of [
    "Could I get 15 minutes on your calendar?",
    "Would a 15-minute call next week work?",
    "Are you open to a meeting Thursday?",
    "Can we find a time to talk properly?",
    "Does Tuesday work for a quick chat?",
    "Could we grab a time – maybe twenty minutes?",
  ]) assert.equal(detectAsk(line).asked, true, line);
});

test("detectAsk ignores lines that aren't asks", () => {
  for (const line of ["Hi, how are you today?", "Do you have 30 seconds?", "How do you schedule drivers now?", ""]) {
    assert.equal(detectAsk(line).asked, false, line);
  }
});

test("the band mapping never returns Engaged below the upper band", () => {
  for (let p = 0; p <= 100; p++) {
    const band = patienceBand(p);
    if (p < BANDS.ENGAGED_MIN) assert.notEqual(band, "engaged", `patience ${p}`);
    else assert.equal(band, "engaged");
    if (p < BANDS.IMPATIENT_BELOW) assert.equal(band, "impatient");
  }
});

test("messages start with the caller and alternate", () => {
  let s = addStudentTurn(newCall(), { text: "Hi Mike, Jordan here." });
  s = applyExecTurn(s, reply({ say: "Yeah?" }), ctx);
  s = addSilenceTurn(s);
  const msgs = buildMessages(s);
  assert.deepEqual(msgs.map((m) => m.role), ["user", "assistant", "user"]);
  assert.equal(msgs[2].content, SILENCE_MARKER);
});

test("the prompt carries persona, state in words, and the rules; the schema limits ids", () => {
  const s = applyExecTurn(addStudentTurn(newCall(40), { text: "How do you cover call-outs?" }), reply({ revealPainId: "monday-callouts" }), ctx);
  const req = buildExecRequest(s, ctx, { now: 72000 });
  const [fixed, current] = req.system;
  assert.match(fixed, /Mike Brooks/);
  assert.match(fixed, /never volunteer/i);
  assert.match(fixed, new RegExp(`at least ${ACCEPTANCE_THRESHOLD}`));
  assert.match(current, /Your patience: 40 of 100\. You're guarded/);
  assert.match(current, /"monday-callouts"\. Don't reveal these again/);
  assert.match(current, /Time on the call: 1:12/);
  assert.deepEqual(req.schema.properties.revealPainId.anyOf[0].enum, ctx.persona.painPoints.map((p) => p.id));
});

test("the fixed part of the prompt doesn't change during a call (so it can be cached)", () => {
  const a = buildExecRequest(addStudentTurn(newCall(55), { text: "Hi" }), ctx);
  const b = buildExecRequest(addStudentTurn(newCall(20), { text: "Hello again" }), ctx, { silence: true });
  assert.equal(a.system[0], b.system[0]);
});

test("Anthropic request: temperature left out where the model rejects it; thinking off; fixed part cached", () => {
  const base = { system: ["fixed", "now"], messages: [{ role: "user", content: "hi" }], schema: { type: "object" }, temperature: 0.8 };
  const sonnet = anthropicBody({ ...base, model: "claude-sonnet-5" });
  assert.equal("temperature" in sonnet, false);
  assert.deepEqual(sonnet.thinking, { type: "disabled" });
  assert.deepEqual(sonnet.system[0].cache_control, { type: "ephemeral" });
  assert.equal(sonnet.system[1].cache_control, undefined);
  assert.equal(sonnet.output_config.format.type, "json_schema");
  assert.equal(anthropicBody({ ...base, model: "claude-haiku-4-5" }).temperature, 0.8);
  assert.equal("thinking" in anthropicBody({ ...base, model: "claude-opus-5-5" }), false);
});

test("the exec may not say goodbye above the lowest band", () => {
  const req = buildExecRequest(addStudentTurn(newCall(46), { text: "Let me tell you about us." }), ctx);
  assert.match(req.system[0], new RegExp(`At ${BANDS.IMPATIENT_BELOW} or above: stay on the line`));
  assert.match(req.system[0], /never say goodbye/);
  assert.match(req.system[1], new RegExp(`No goodbyes .* unless your patience after this reply is below ${BANDS.IMPATIENT_BELOW}`));
});
