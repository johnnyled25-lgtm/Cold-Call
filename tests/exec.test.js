import { test } from "node:test";
import assert from "node:assert/strict";
import { buildExecSvg } from "../js/exec-drawing.js";
import { execPose, poseClasses, describePose } from "../js/pose.js";
import { APPEARANCE_OPTIONS, BANDS, OUTCOMES } from "../js/constants.js";
import { COPY } from "../js/copy.js";
import { addStudentTurn, applyExecTurn } from "../js/callState.js";
import { personas, ctx, newCall, reply } from "./helpers.js";

function* everyAppearance() {
  const o = APPEARANCE_OPTIONS;
  for (const skinTone of o.skinTone) for (const hair of o.hair) for (const hairColor of o.hairColor)
    for (const attire of o.attire) for (const glasses of o.glasses) yield { skinTone, hair, hairColor, attire, glasses };
}

test("every appearance combination draws, with its colors as classes", () => {
  let count = 0;
  for (const a of everyAppearance()) {
    const svg = buildExecSvg(a);
    assert.ok(svg.startsWith("<svg") && svg.trimEnd().endsWith("</svg>"));
    for (const cls of [`skin-${a.skinTone}`, `hair-${a.hairColor}`, `attire-${a.attire}`]) assert.ok(svg.includes(cls));
    assert.equal(svg.includes('class="glasses"'), a.glasses);
    count++;
  }
  assert.equal(count, 5 * 6 * 5 * 5 * 2);
});

test("each hair style and outfit draws differently", () => {
  const base = personas[0].appearance;
  const hairs = new Set(APPEARANCE_OPTIONS.hair.map((hair) => buildExecSvg({ ...base, hair })));
  const outfits = new Set(APPEARANCE_OPTIONS.attire.map((attire) => buildExecSvg({ ...base, attire })));
  assert.equal(hairs.size, APPEARANCE_OPTIONS.hair.length);
  assert.equal(outfits.size, APPEARANCE_OPTIONS.attire.length);
});

test("unknown appearance values fall back instead of breaking; the label is escaped", () => {
  const svg = buildExecSvg({ skinTone: "blue", hair: "mohawk" }, { label: '"><script>' });
  assert.ok(svg.includes("skin-light"));
  assert.ok(!svg.includes("<script>"));
});

test("the drawing uses no hard-coded colors (all come from styles.css)", () => {
  const svg = buildExecSvg(personas[0].appearance);
  assert.doesNotMatch(svg, /#[0-9a-f]{3,6}\b|fill="|stroke="/i);
});

test("body language never shows Engaged below the upper band", () => {
  for (let p = 0; p <= 100; p++) {
    for (const speaking of [false, true]) {
      const state = { ...newCall(p), patience: p };
      const pose = execPose({ phase: "live", state, speaking });
      if (p < BANDS.ENGAGED_MIN) assert.notEqual(pose.mood, "engaged", `patience ${p}`);
      else assert.equal(pose.mood, "engaged");
      if (p < BANDS.IMPATIENT_BELOW) assert.equal(pose.mood, "impatient");
      assert.ok(!poseClasses(pose).includes("mood-engaged") || p >= BANDS.ENGAGED_MIN);
    }
  }
});

test("the pose follows the call: ringing, on the call, skeptical, hung up after the last line, booked", () => {
  assert.equal(execPose({ phase: "ringing", state: null }).base, "ringing");

  let s = addStudentTurn(newCall(40), { text: "Hi" });
  s = applyExecTurn(s, reply({ raiseObjectionId: "send-email" }), ctx);
  const skeptical = execPose({ phase: "live", state: s });
  assert.deepEqual([skeptical.base, skeptical.skeptical], ["on-call", true]);

  const hungUp = applyExecTurn(addStudentTurn(newCall(5), { text: "Let me tell you our history" }), reply({ patienceDelta: -20 }), ctx);
  assert.equal(hungUp.outcome, OUTCOMES.HUNG_UP);
  assert.equal(execPose({ phase: "live", state: hungUp, speaking: true }).base, "on-call"); // still saying goodbye
  assert.equal(execPose({ phase: "live", state: hungUp, speaking: false }).base, "hung-up");

  const booked = applyExecTurn(addStudentTurn(newCall(70), { text: "Could we find 15 minutes Thursday?" }), reply({ acceptsMeeting: true }), ctx);
  assert.equal(execPose({ phase: "live", state: booked }).base, "booked");
});

test("screen readers get the same cue in words", () => {
  const words = COPY.exec.describe;
  assert.equal(describePose({ base: "on-call", mood: "impatient", skeptical: false }, "Mike", words), "Mike is glancing at the screen, looking away.");
  assert.equal(describePose({ base: "on-call", mood: "neutral", skeptical: true }, "Anna", words), "Anna is listening. Anna raises an eyebrow.");
  assert.match(describePose({ base: "ringing", mood: "neutral" }, "Nina", words), /ringing/);
});
