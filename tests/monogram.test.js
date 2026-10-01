import { test } from "node:test";
import assert from "node:assert/strict";
import { monogramInitials, monogramColor, MONOGRAM_COLORS } from "../js/monogram.js";
import { personas, offers } from "./helpers.js";

test("company badges use up to two meaningful initials", () => {
  assert.equal(monogramInitials("Kettle Creek Dental Group"), "KC");
  assert.equal(monogramInitials("Brasswell Freight"), "BF");
  assert.equal(monogramInitials("The Northpaw Co."), "N");
  assert.equal(monogramInitials(""), "?");
});

test("each company always gets the same badge color, within the palette", () => {
  for (const c of [...personas.map((p) => p.company), ...offers.map((o) => o.company)]) {
    const n = monogramColor(c);
    assert.equal(n, monogramColor(c));
    assert.ok(n >= 1 && n <= MONOGRAM_COLORS, `${c}: ${n}`);
  }
});

test("the five exec companies don't all share one color", () => {
  const colors = new Set(personas.map((p) => monogramColor(p.company)));
  assert.ok(colors.size >= 3, `only ${colors.size} colors`);
});
