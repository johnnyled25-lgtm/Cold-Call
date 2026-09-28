import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addStudentTurn, addSilenceTurn, applyExecTurn, recordRetry, endByStudent, endIfTimeUp, dropCall,
} from "../js/callState.js";
import { DELTA_MIN, DELTA_MAX, ACCEPTANCE_THRESHOLD, SILENCE_COST, CALL_TIME_CAP_MINUTES, OUTCOMES } from "../js/constants.js";
import { COPY } from "../js/copy.js";
import { ctx, newCall, reply } from "./helpers.js";

const say = (state, text = "Hi, quick question about your drivers.") => addStudentTurn(state, { text, at: 1 });
const lastTurn = (s) => s.turns[s.turns.length - 1];

test("patience never goes above 100", () => {
  const s = applyExecTurn(say(newCall(95)), reply({ patienceDelta: 15 }), ctx);
  assert.equal(s.patience, 100);
});

test("patience never goes below 0", () => {
  const s = applyExecTurn(say(newCall(10)), reply({ patienceDelta: -30 }), ctx);
  assert.equal(s.patience, 0);
});

test("each delta is clamped to the allowed range", () => {
  const up = applyExecTurn(say(newCall(50)), reply({ patienceDelta: 80 }), ctx);
  assert.equal(up.patience, 50 + DELTA_MAX);
  assert.equal(lastTurn(up).proposedDelta, 80);
  const down = applyExecTurn(say(newCall(90)), reply({ patienceDelta: -99 }), ctx);
  assert.equal(down.patience, 90 + DELTA_MIN);
});

test("the change is recorded on the exec turn with its reason", () => {
  const s = applyExecTurn(say(newCall(40)), reply({ patienceDelta: -12, reason: "Started a company history." }), ctx);
  const t = lastTurn(s);
  assert.deepEqual([t.patienceBefore, t.patienceAfter, t.delta, t.reason], [40, 28, -12, "Started a company history."]);
});

test("Hung up when patience reaches 0", () => {
  const s = applyExecTurn(say(newCall(8)), reply({ patienceDelta: -10, say: "I've got to go." }), ctx);
  assert.equal(s.ended, true);
  assert.equal(s.outcome, OUTCOMES.HUNG_UP);
  assert.equal(lastTurn(s).text, "I've got to go.");
});

test("not Hung up while patience stays above 0", () => {
  const s = applyExecTurn(say(newCall(31)), reply({ patienceDelta: -30 }), ctx);
  assert.equal(s.patience, 1);
  assert.equal(s.ended, false);
});

test("no other ending is ever Hung up", () => {
  const base = say(newCall(5));
  for (const s of [endByStudent(base, 10), endIfTimeUp(base, CALL_TIME_CAP_MINUTES * 60000), dropCall(base, 10)]) {
    assert.equal(s.ended, true);
    assert.notEqual(s.outcome, OUTCOMES.HUNG_UP);
  }
});

test("student ending the call: No ask made vs. Asked, no meeting", () => {
  assert.equal(endByStudent(say(newCall()), 5).outcome, OUTCOMES.NO_ASK);
  const asked = say(newCall(), "Could we find a time next week for 15 minutes?");
  assert.equal(endByStudent(asked, 5).outcome, OUTCOMES.ASKED_NO_MEETING);
});

test("acceptsMeeting is ignored before any ask", () => {
  const s = applyExecTurn(say(newCall(90)), reply({ acceptsMeeting: true }), ctx);
  assert.equal(s.meetingBooked, false);
  assert.equal(s.ended, false);
  assert.ok(lastTurn(s).ignored.includes("acceptance_ignored_no_ask"));
});

test("acceptsMeeting is ignored below the acceptance threshold", () => {
  const asked = say(newCall(ACCEPTANCE_THRESHOLD - 10), "Can I get 15 minutes on your calendar Thursday?");
  const s = applyExecTurn(asked, reply({ acceptsMeeting: true }), ctx);
  assert.equal(s.meetingBooked, false);
  assert.ok(lastTurn(s).ignored.includes("acceptance_ignored_below_threshold"));
});

test("the threshold is checked after this turn's change", () => {
  const asked = say(newCall(ACCEPTANCE_THRESHOLD + 2), "Can I get 15 minutes on your calendar?");
  const s = applyExecTurn(asked, reply({ acceptsMeeting: true, patienceDelta: -5 }), ctx);
  assert.equal(s.meetingBooked, false);
});

test("a clear ask at or above the threshold can book the meeting", () => {
  const asked = say(newCall(ACCEPTANCE_THRESHOLD), "Would you be open to a meeting Thursday?");
  const s = applyExecTurn(asked, reply({ acceptsMeeting: true }), ctx);
  assert.equal(s.meetingBooked, true);
  assert.equal(s.outcome, OUTCOMES.MEETING_BOOKED);
  assert.equal(lastTurn(s).event, "meeting_accepted");
});

test("the model can flag an ask the phrase list missed, and it's recorded as such", () => {
  const s = applyExecTurn(say(newCall(70), "Let's talk properly, you and me, Thursday."), reply({ studentMadeAsk: true, acceptsMeeting: true }), ctx);
  assert.equal(s.askDetectedBy, "model");
  assert.equal(s.askTurnIndex, 1);
  assert.equal(s.meetingBooked, true);
});

test("the phrase list's detection is recorded as such", () => {
  const s = say(newCall(), "Could I grab 15 minutes with you next week?");
  assert.equal(s.askDetectedBy, "phrase");
  assert.equal(s.askPhrase, "15 minute");
  assert.equal(lastTurn(s).event, "ask_made");
});

test("a pain point is revealed once", () => {
  const once = applyExecTurn(say(newCall()), reply({ revealPainId: "monday-callouts" }), ctx);
  assert.deepEqual(once.revealedPainIds, ["monday-callouts"]);
  assert.equal(lastTurn(once).event, "pain_revealed");
  const twice = applyExecTurn(say(once), reply({ revealPainId: "monday-callouts" }), ctx);
  assert.deepEqual(twice.revealedPainIds, ["monday-callouts"]);
  assert.ok(lastTurn(twice).ignored.includes("pain_already_revealed"));
});

test("a pain point that doesn't exist can't be revealed", () => {
  const s = applyExecTurn(say(newCall()), reply({ revealPainId: "made-up" }), ctx);
  assert.deepEqual(s.revealedPainIds, []);
  assert.ok(lastTurn(s).ignored.includes("pain_unknown"));
});

test("objections: only this exec's; raised then handled", () => {
  const unknown = applyExecTurn(say(newCall()), reply({ raiseObjectionId: "not-my-call" }), ctx); // not in Brasswell's list
  assert.deepEqual(unknown.raisedObjections, []);
  const raised = applyExecTurn(say(newCall()), reply({ raiseObjectionId: "send-email" }), ctx);
  assert.equal(raised.raisedObjections[0].handled, false);
  const handled = applyExecTurn(say(raised), reply({ handledObjectionId: "send-email" }), ctx);
  assert.equal(handled.raisedObjections[0].handled, true);
  assert.equal(lastTurn(handled).event, "objection_handled");
});

test("silence costs the fixed amount with the fixed reason, whatever the model says", () => {
  const silent = addSilenceTurn(newCall(50), { at: 2 });
  const s = applyExecTurn(silent, reply({ say: "Hello? You still there?", patienceDelta: 10 }), ctx, { silence: true });
  assert.equal(s.patience, 50 + SILENCE_COST);
  assert.equal(lastTurn(s).reason, COPY.reasons.silence);
  assert.equal(lastTurn(s).event, "silence");
});

test("a retry turn leaves patience unchanged", () => {
  const s = recordRetry(say(newCall(42)));
  assert.equal(s.patience, 42);
  assert.equal(lastTurn(s).event, "retry");
  assert.equal(lastTurn(s).delta, 0);
  assert.equal(lastTurn(s).text, COPY.retryLine);
});

test("time cap ends the call as Time's up, not before", () => {
  const s = say(newCall());
  assert.equal(endIfTimeUp(s, CALL_TIME_CAP_MINUTES * 60000 - 1), s);
  assert.equal(endIfTimeUp(s, CALL_TIME_CAP_MINUTES * 60000).outcome, OUTCOMES.TIMES_UP);
});

test("nothing changes after the call has ended", () => {
  const ended = endByStudent(say(newCall()), 5);
  assert.equal(applyExecTurn(ended, reply({ patienceDelta: -30 }), ctx), ended);
  assert.equal(addStudentTurn(ended, { text: "hello?" }), ended);
});

test("state is never changed in place", () => {
  const before = say(newCall(50));
  const snapshot = JSON.stringify(before);
  applyExecTurn(before, reply({ patienceDelta: -20, revealPainId: "overtime-creep", raiseObjectionId: "no-time" }), ctx);
  assert.equal(JSON.stringify(before), snapshot);
});
