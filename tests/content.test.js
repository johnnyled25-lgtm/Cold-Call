// Checks the content rules in brief §4.11 and that the data files agree with each other.
// Runs over both B2B and B2C content, since both are real student-facing data.
import { test } from "node:test";
import assert from "node:assert/strict";
import { COPY, B2C_COPY, copyFor } from "../js/copy.js";
import { APPEARANCE_OPTIONS, MOODS, MOODS_B2C } from "../js/constants.js";
import { personas, offers, objections, personasB2C, offersB2C, objectionsB2C } from "./helpers.js";

const BANNED = /\b(leverage|seamless|robust|delve|powerful|unlock|supercharge|journey|crush|game-changer|synergy|level up|bot|prospect|lead)\b/gi;

const allStrings = (value, out = []) => {
  if (typeof value === "string") out.push(value);
  else if (value && typeof value === "object") Object.values(value).forEach((v) => allStrings(v, out));
  return out;
};

const SETS = [
  { label: "B2B", personas, offers, objections, moods: MOODS },
  { label: "B2C", personas: personasB2C, offers: offersB2C, objections: objectionsB2C, moods: MOODS_B2C },
];

test("no banned words in student-facing copy or content", () => {
  const hits = allStrings([COPY, B2C_COPY, personas, offers, objections, personasB2C, offersB2C, objectionsB2C]).flatMap((s) => s.match(BANNED) || []);
  assert.deepEqual(hits, []);
});

test("every explainer paragraph is under 70 words, in both modes", () => {
  for (const copy of [COPY, copyFor("b2c")]) {
    for (const [screen, parts] of Object.entries(copy.explainers)) {
      if (typeof parts !== "object") continue;
      for (const [key, text] of Object.entries(parts)) {
        assert.ok(text.split(/\s+/).length < 70, `${screen}.${key}`);
      }
    }
  }
});

for (const { label, personas: ps, offers: os, objections: xs, moods } of SETS) {
  test(`${label}: persona data uses only known ids and appearance values`, () => {
    const moodIds = moods.map((m) => m.id);
    const objectionIds = xs.map((o) => o.id);
    const offerIds = os.map((o) => o.id);
    for (const p of ps) {
      for (const [k, v] of Object.entries(p.appearance)) assert.ok(APPEARANCE_OPTIONS[k].includes(v), `${p.id} ${k}=${v}`);
      p.objections.forEach((id) => assert.ok(objectionIds.includes(id), `${p.id} objection ${id}`));
      p.moods.forEach((id) => assert.ok(moodIds.includes(id), `${p.id} mood ${id}`));
      p.painPoints.forEach((pp) => pp.addressedBy.forEach((id) => assert.ok(offerIds.includes(id), `${p.id}.${pp.id} offer ${id}`)));
    }
  });

  test(`${label}: ids are unique`, () => {
    for (const list of [ps, os, xs, moods]) {
      const ids = list.map((x) => x.id);
      assert.equal(new Set(ids).size, ids.length);
    }
  });
}
