import { test } from "node:test";
import assert from "node:assert/strict";
import { drawCall, drawablePairs, isRealFit } from "../js/draw.js";
import { data, personas, offers } from "./helpers.js";

const summary = (d) => [d.persona.id, d.offer.id, d.mood.id, d.pickupLine].join("|");

test("the same seed always draws the same persona, offer, and mood", () => {
  for (const seed of [0, 1, 42, 123456789, 4294967295]) {
    assert.equal(summary(drawCall(seed, data)), summary(drawCall(seed, data)));
  }
});

test("different seeds reach every drawable pair", () => {
  const seen = new Set();
  for (let seed = 0; seed < 500; seed++) {
    const d = drawCall(seed, data);
    seen.add(`${d.persona.id}|${d.offer.id}`);
  }
  assert.equal(seen.size, drawablePairs(personas, offers).length);
});

test("every drawn persona/offer pair is a real fit", () => {
  for (let seed = 0; seed < 1000; seed++) {
    const d = drawCall(seed, data);
    assert.ok(isRealFit(d.persona, d.offer), `${d.persona.id} / ${d.offer.id}`);
    assert.ok(d.persona.moods.includes(d.mood.id));
  }
});

test("every pairing listed in offers.json is a real fit", () => {
  for (const offer of offers) {
    for (const id of offer.fitsPersonaIds) {
      const persona = personas.find((p) => p.id === id);
      assert.ok(persona, `${offer.id} lists unknown persona ${id}`);
      assert.ok(isRealFit(persona, offer), `${offer.id} is listed for ${id} but fits fewer than 2 pain points`);
    }
  }
});

test("a pair listed by mistake is never drawn", () => {
  const badOffers = offers.map((o) => (o.id === "crewbeam" ? { ...o, fitsPersonaIds: [...o.fitsPersonaIds, "northpaw-creative"] } : o));
  assert.ok(!drawablePairs(personas, badOffers).some((p) => p.persona.id === "northpaw-creative" && p.offer.id === "crewbeam"));
});

test("every persona can be drawn", () => {
  const drawable = new Set(drawablePairs(personas, offers).map((p) => p.persona.id));
  for (const p of personas) assert.ok(drawable.has(p.id), `${p.id} has no fitting offer`);
});
