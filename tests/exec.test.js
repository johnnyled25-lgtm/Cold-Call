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
  const o = APPEARANCE_OPTIONS;
  assert.equal(count, o.skinTone.length * o.hair.length * o.hairColor.length * o.attire.length * o.glasses.length);
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
  assert.equal(describePose({ base: "on-call", mood: "impatient", skeptical: false }, "Mike", words), "Mike is frowning and looking away.");
  assert.equal(describePose({ base: "on-call", mood: "neutral", skeptical: true }, "Anna", words), "Anna is listening. Anna raises an eyebrow, unconvinced.");
  assert.match(describePose({ base: "ringing", mood: "neutral" }, "Nina", words), /ringing/);
});

test("the drawing is built from swappable layers, with one face per expression", () => {
  const svg = buildExecSvg(personas[0].appearance);
  for (const layer of ["layer-backdrop", "layer-props", "layer-body", "hair-back", "face", "hair-front", "layer-arms", "layer-desk"]) {
    assert.ok(svg.includes(`class="${layer}"`), layer);
  }
  for (const expr of ["expr-neutral", "expr-engaged", "expr-impatient", "expr-skeptical"]) {
    assert.ok(svg.includes(`expr ${expr}`), expr);
  }
  for (const part of ["arm-up", "arm-down-left", "handset-cradle", "mouth-open", "writing-hand", "prop-poster", "prop-books", "prop-pencils"]) {
    assert.ok(svg.includes(part), part);
  }
});

test("hair is layered (base, shade, highlight) for every style except bald", () => {
  for (const hair of APPEARANCE_OPTIONS.hair) {
    const svg = buildExecSvg({ ...personas[0].appearance, hair });
    if (hair === "bald") continue;
    assert.ok(svg.includes('class="hair"') && svg.includes('class="hair-shade"') && svg.includes('class="hair-hi"'), hair);
  }
});

test("eye clip-path ids are unique per drawing, so many can share a page", () => {
  const a = buildExecSvg(personas[0].appearance, { idPrefix: "ex1" });
  const b = buildExecSvg(personas[0].appearance, { idPrefix: "ex2" });
  assert.ok(a.includes('id="ex1-eye-l"') && b.includes('id="ex2-eye-l"'));
  assert.ok(!b.includes("ex1-"));
});

test("the debrief's final pose: writing the note if booked, phone down otherwise, face from the final band", async () => {
  const { outcomePose } = await import("../js/pose.js");
  assert.deepEqual(outcomePose(OUTCOMES.MEETING_BOOKED, 70), { base: "booked", mood: "engaged", skeptical: false, talking: false });
  assert.equal(outcomePose(OUTCOMES.HUNG_UP, 0).base, "hung-up");
  assert.equal(outcomePose(OUTCOMES.HUNG_UP, 0).mood, "impatient");
  assert.equal(outcomePose(OUTCOMES.NO_ASK, 50).mood, "neutral");
  assert.equal(outcomePose(OUTCOMES.ASKED_NO_MEETING, 65).mood, "engaged");
  for (let p = 0; p < BANDS.ENGAGED_MIN; p++) assert.notEqual(outcomePose(OUTCOMES.TIMES_UP, p).mood, "engaged");
});
