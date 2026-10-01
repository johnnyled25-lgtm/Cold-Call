import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRoute, activeTab } from "../js/routes.js";

test("addresses map to screens; anything else is home", () => {
  assert.equal(parseRoute("#past"), "past");
  assert.equal(parseRoute("#/debrief"), "debrief");
  assert.equal(parseRoute("#BRIEFING"), "briefing");
  assert.equal(parseRoute(""), "home");
  assert.equal(parseRoute("#nowhere"), "home");
  assert.equal(parseRoute(undefined), "home");
});

test("the selected tab follows the screen", () => {
  assert.equal(activeTab("home"), "home");
  assert.equal(activeTab("call"), "briefing");
  assert.equal(activeTab("debrief"), "briefing");
  assert.equal(activeTab("debrief", { debriefFromPast: true }), "past");
  assert.equal(activeTab("past"), "past");
});
