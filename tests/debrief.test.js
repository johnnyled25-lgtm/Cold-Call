import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeCall, formatTranscriptText, recordSummary, formatDelta } from "../js/debrief.js";
import { addStudentTurn, addSilenceTurn, applyExecTurn, recordRetry, endByStudent, dropCall } from "../js/callState.js";
import { loadPastCalls, savePastCall, clearEverything } from "../js/storage.js";
import { OUTCOMES, PAST_CALLS_KEPT } from "../js/constants.js";
import { ctx, newCall, reply } from "./helpers.js";

// A fixed call: Mike, normal day, starting patience 40. Times in ms from 0.
function fixtureCall() {
  let s = newCall(40); // pickup "Mike." at 0
  s = addStudentTurn(s, { text: "Hi Mike, Jordan with Crewbeam. How do you cover driver call-outs?", at: 4000 });
  s = applyExecTurn(s, reply({ say: "Honestly? Mondays are a mess.", patienceDelta: 8, reason: "Asked a relevant question.", revealPainId: "monday-callouts" }), ctx, { at: 7000 });
  s = addStudentTurn(s, { text: "Let me tell you about our company history.", at: 12000 });
  s = applyExecTurn(s, reply({ say: "Just send me an email.", patienceDelta: -20, reason: "Started a company history.", raiseObjectionId: "send-email" }), ctx, { at: 15000 });
  s = addStudentTurn(s, { text: "Sure. Could we grab 15 minutes Thursday instead?", at: 20000 });
  s = applyExecTurn(s, reply({ say: "No. Send the email.", patienceDelta: -5, reason: "Pushed for a meeting without handling the objection." }), ctx, { at: 23000 });
  return endByStudent(s, 30000);
}

test("the turning point is the largest single drop", () => {
  const a = analyzeCall(fixtureCall(), ctx);
  assert.equal(a.turningPoint.delta, -20);
  assert.equal(a.turningPoint.studentText, "Let me tell you about our company history.");
  assert.equal(a.turningPoint.reason, "Started a company history.");
});

test("ties go to the earliest drop", () => {
  let s = addStudentTurn(newCall(60), { text: "first" });
  s = applyExecTurn(s, reply({ patienceDelta: -10, reason: "A" }), ctx);
  s = addStudentTurn(s, { text: "second" });
  s = applyExecTurn(s, reply({ patienceDelta: -10, reason: "B" }), ctx);
  assert.equal(analyzeCall(s, ctx).turningPoint.studentText, "first");
});

test("no turning point when patience never dropped", () => {
  let s = addStudentTurn(newCall(50), { text: "How do you handle overtime?" });
  s = applyExecTurn(s, reply({ patienceDelta: 5 }), ctx);
  s = recordRetry(addStudentTurn(s, { text: "..." }));
  assert.equal(analyzeCall(s, ctx).turningPoint, null);
});

test("silence can be the turning point, and it's labeled as silence", () => {
  let s = addSilenceTurn(newCall(50));
  s = applyExecTurn(s, reply({ say: "Hello?" }), ctx, { silence: true });
  const a = analyzeCall(s, ctx);
  assert.equal(a.turningPoint.silence, true);
  assert.equal(a.turningPoint.studentText, null);
});

test("pain points: found in order, missed ones keep their hint", () => {
  const a = analyzeCall(fixtureCall(), ctx);
  assert.deepEqual(a.pains.found.map((p) => p.id), ["monday-callouts"]);
  assert.deepEqual(a.pains.missed.map((p) => p.id), ["overtime-creep", "slow-shippers"]);
  assert.ok(a.pains.missed.every((p) => p.earnedBy));
  assert.equal(a.pains.total, 3);
});

test("objections, the ask, and plain facts", () => {
  const a = analyzeCall(fixtureCall(), ctx);
  assert.deepEqual(a.objections.map((o) => [o.id, o.handled]), [["send-email", false]]);
  assert.equal(a.ask.made, true);
  assert.equal(a.ask.asks.length, 1);
  const [first] = a.ask.asks;
  assert.equal(first.lineNumber, 3);
  assert.equal(first.atMs, 20000);
  assert.equal(first.detectedBy, "phrase");
  assert.equal(first.phrase, "15 minute");
  assert.equal(first.responseText, "No. Send the email.");
  assert.equal(first.booked, false);
  assert.equal(a.ask.bookedAsk, null);
  assert.equal(a.ask.accepted, false);
  assert.equal(a.facts.studentLines, 3);
  assert.equal(a.facts.durationMs, 30000);
  assert.ok(a.facts.studentWordShare > 50 && a.facts.studentWordShare < 100);
  assert.equal(a.outcome, OUTCOMES.ASKED_NO_MEETING);
  assert.equal(a.chart.length, 4); // start + 3 reactions
});

test("the transcript text is stable for a fixed call", () => {
  const text = formatTranscriptText(analyzeCall(fixtureCall(), ctx), { dateText: "Sep 28, 2:05 PM" });
  assert.equal(text, [
    "Cold Call Lab: call transcript",
    "Date: Sep 28, 2:05 PM",
    "Outcome: You asked, and ended the call after 0:30 without a meeting.",
    "Exec: Mike Brooks, VP of Operations, Brasswell Freight",
    "Mood: having a normal day (starting patience 40)",
    "You were selling: Crewbeam (Lanternfield Software)",
    "",
    "Where the call turned:",
    '  You: "Let me tell you about our company history."',
    "  Patience 48 → 28 (−20)",
    "  Reason (AI's judgment): Started a company history.",
    "",
    "You uncovered 1 of 3 pain points.",
    "  Uncovered: Monday mornings are a mess. When drivers call out, he or a terminal manager spends an hour on the phone finding cover.",
    "  Missed: Overtime is over budget three quarters running, and he only finds out after payroll closes. (a question that asks about overtime, labor costs, or how he tracks hours across terminals would have brought this out)",
    "  Missed: Two big shippers pay at 60 days or later, and it squeezes cash for fuel and repairs. (a question that asks about getting paid, invoicing, or cash flow would have brought this out)",
    "",
    "Objections:",
    '  "Just send me an email.": Not handled',
    "",
    "The ask:",
    "  You asked for a meeting once. None of your asks booked a meeting.",
    "  Ask 1, at 0:20 (your line 3 of 3): “Sure. Could we grab 15 minutes Thursday instead?”",
    "    Mike: “No. Send the email.”",
    "    No meeting",
    "",
    "Full transcript:",
    "[0:00] Mike: Mike.",
    "[0:04] You: Hi Mike, Jordan with Crewbeam. How do you cover driver call-outs?",
    "[0:07] Mike: Honestly? Mondays are a mess.  [Patience 40 → 48, +8: Asked a relevant question.]",
    "[0:12] You: Let me tell you about our company history.",
    "[0:15] Mike: Just send me an email.  [Patience 48 → 28, −20: Started a company history.]",
    "[0:20] You: Sure. Could we grab 15 minutes Thursday instead?",
    "[0:23] Mike: No. Send the email.  [Patience 28 → 23, −5: Pushed for a meeting without handling the objection.]",
  ].join("\n"));
});

test("deltas are shown with a real minus sign", () => {
  assert.deepEqual([formatDelta(-5), formatDelta(5), formatDelta(0)], ["−5", "+5", "0"]);
});

test("the Record counts outcomes, leaves out dropped calls, and lists pain points oldest first", () => {
  const booked = { state: { ...fixtureCall(), outcome: OUTCOMES.MEETING_BOOKED, startedAt: 2000 }, ctx };
  const asked = { state: { ...fixtureCall(), startedAt: 1000 }, ctx };
  const dropped = { state: dropCall(addStudentTurn(newCall(), { text: "hi" }), 5), ctx };
  const r = recordSummary([booked, dropped, asked]);
  assert.equal(r.byOutcome[OUTCOMES.MEETING_BOOKED], 1);
  assert.equal(r.byOutcome[OUTCOMES.ASKED_NO_MEETING], 1);
  assert.equal(r.byOutcome[OUTCOMES.HUNG_UP], 0);
  assert.equal("dropped" in r.byOutcome, false);
  assert.equal(r.dropped, 1);
  assert.deepEqual(r.painRows.map((p) => p.startedAt), [1000, 2000]);
});

test("past calls keep the newest 20 and hold no key", () => {
  clearEverything();
  for (let i = 0; i < PAST_CALLS_KEPT + 5; i++) {
    savePastCall({ ...fixtureCall(), startedAt: i, seed: i }, ctx);
  }
  const list = loadPastCalls();
  assert.equal(list.length, PAST_CALLS_KEPT);
  assert.equal(list[0].state.startedAt, PAST_CALLS_KEPT + 4); // newest first
  assert.doesNotMatch(JSON.stringify(list), /apiKey|sk-/);
  clearEverything();
  assert.deepEqual(loadPastCalls(), []);
});

test("every ask is listed in order with the exec's reply; the third is marked as the one that booked", () => {
  let s = newCall(40);
  const turn = (text, r, at) => {
    s = addStudentTurn(s, { text, at });
    s = applyExecTurn(s, reply(r), ctx, { at: at + 2000 });
  };
  turn("Could we set up a meeting this week?", { say: "No. I don't even know what you do.", patienceDelta: -5 }, 5000);
  turn("How do you cover call-outs now?", { say: "Mondays are a mess.", patienceDelta: 15, revealPainId: "monday-callouts" }, 12000);
  turn("Fair enough. Would you be open to a call next week?", { say: "Maybe. What's the price?", patienceDelta: 15 }, 20000);
  turn("About $6 a driver. Tell me more about overtime?", { say: "It's over budget.", patienceDelta: 10 }, 28000);
  // The third ask is caught only by the AI (no phrase from the list), and it's accepted.
  turn("Let's get you and me in a room Thursday and settle this.", { say: "Fine. Thursday at ten.", patienceDelta: 5, acceptsMeeting: true, studentMadeAsk: true }, 36000);
  assert.equal(s.meetingBooked, true);

  const a = analyzeCall(s, ctx);
  assert.equal(a.ask.asks.length, 3);
  assert.deepEqual(a.ask.asks.map((x) => x.number), [1, 2, 3]);
  assert.deepEqual(a.ask.asks.map((x) => x.lineNumber), [1, 3, 5]);
  assert.deepEqual(a.ask.asks.map((x) => x.responseText), ["No. I don't even know what you do.", "Maybe. What's the price?", "Fine. Thursday at ten."]);
  assert.deepEqual(a.ask.asks.map((x) => x.booked), [false, false, true]);
  assert.deepEqual(a.ask.asks.map((x) => x.detectedBy), ["phrase", "phrase", "model"]);
  assert.equal(a.ask.bookedAsk, 3);

  const text = formatTranscriptText(a);
  assert.match(text, /You asked for a meeting 3 times\. Ask 3 booked the meeting\./);
  const askBlock = text.slice(text.indexOf("The ask:"), text.indexOf("Full transcript:"));
  assert.equal((askBlock.match(/No meeting/g) || []).length, 2);
  assert.equal((askBlock.match(/Booked the meeting/g) || []).length, 1);
  assert.ok(askBlock.indexOf("Ask 3") < askBlock.indexOf("Booked the meeting"));
});

test("Past calls cards: the patience series and its small line", async () => {
  const { patienceSeries, sparkline } = await import("../js/debrief.js");
  const s = fixtureCall();
  assert.deepEqual(patienceSeries(s), [40, 48, 28, 23]);
  const spark = sparkline([0, 50, 100], { width: 100, height: 40, pad: 0, reference: 60 });
  assert.equal(spark.d, "M0 40 L50 20 L100 0");
  assert.deepEqual(spark.last, { x: 100, y: 0 });
  assert.equal(spark.referenceY, 16);
  // One point (no reactions yet) still draws, centered; values outside 0–100 are kept in the box.
  assert.equal(sparkline([55], { width: 100, height: 40, pad: 0 }).last.x, 50);
  assert.equal(sparkline([150, -20], { width: 100, height: 40, pad: 0 }).d, "M0 0 L100 40");
});
