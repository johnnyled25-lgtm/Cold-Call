// Checks the content rules in brief §4.11 and that the data files agree with each other.
import { test } from "node:test";
import assert from "node:assert/strict";
import { COPY } from "../js/copy.js";
import { APPEARANCE_OPTIONS, MOODS } from "../js/constants.js";
import { personas, offers, objections } from "./helpers.js";

const BANNED = /\b(leverage|seamless|robust|delve|powerful|unlock|supercharge|journey|crush|game-changer|synergy|level up|bot|prospect|lead)\b/gi;

const allStrings = (value, out = []) => {
  if (typeof value === "string") out.push(value);
  else if (value && typeof value === "object") Object.values(value).forEach((v) => allStrings(v, out));
  return out;
};

test("no banned words in student-facing copy or content", () => {
  const hits = allStrings([COPY, personas, offers, objections]).flatMap((s) => s.match(BANNED) || []);
  assert.deepEqual(hits, []);
});

test("every explainer paragraph is under 70 words", () => {
  for (const [screen, parts] of Object.entries(COPY.explainers)) {
    if (typeof parts !== "object") continue;
    for (const [key, text] of Object.entries(parts)) {
      assert.ok(text.split(/\s+/).length < 70, `${screen}.${key}`);
    }
  }
});

test("persona data uses only known ids and appearance values", () => {
  const moodIds = MOODS.map((m) => m.id);
  const objectionIds = objections.map((o) => o.id);
  const offerIds = offers.map((o) => o.id);
  for (const p of personas) {
    for (const [k, v] of Object.entries(p.appearance)) assert.ok(APPEARANCE_OPTIONS[k].includes(v), `${p.id} ${k}=${v}`);
    p.objections.forEach((id) => assert.ok(objectionIds.includes(id), `${p.id} objection ${id}`));
    p.moods.forEach((id) => assert.ok(moodIds.includes(id), `${p.id} mood ${id}`));
    p.painPoints.forEach((pp) => pp.addressedBy.forEach((id) => assert.ok(offerIds.includes(id), `${p.id}.${pp.id} offer ${id}`)));
  }
});

test("ids are unique", () => {
  for (const list of [personas, offers, objections, MOODS]) {
    const ids = list.map((x) => x.id);
    assert.equal(new Set(ids).size, ids.length);
  }
});
