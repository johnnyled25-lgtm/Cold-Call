// B2C sibling of meeting.test.js: the consumer's words must never contradict the
// call state about THE SALE.
import { test } from "node:test";
import assert from "node:assert/strict";
import { looksLikeClose, closeDecision } from "../js/closeCheck.js";
import { runExecTurn } from "../js/callController.js";
import { addStudentTurn, B2C_RULES } from "../js/callState.js";
import { closeLine, buildExecRequest } from "../js/execPromptB2C.js";
import { analyzeCall } from "../js/debrief.js";
import { B2C_ACCEPTANCE_THRESHOLD, OUTCOMES } from "../js/constants.js";
import { B2C_COPY, copyFor } from "../js/copy.js";
import { ctxB2C, newCallB2C, reply } from "./helpers.js";

const ASK = "Can we go ahead and set you up today?";
const clock = () => { let t = 1000; return () => (t += 100); };
function fakeSend(answers) {
  const requests = [];
  return { requests, send: async (req) => { requests.push(req); return answers.shift(); } };
}
const b2cEngine = { buildExecRequest, closeDecision, notReadyLine: B2C_COPY.notReadyLine, rules: B2C_RULES };

test("spots lines that agree to buy", () => {
  for (const line of [
    "Fine, sign me up.",
    "Sure, go ahead and charge my card.",
    "OK, I'll take it.",
    "Alright, count me in.",
    "Yeah, let's do it.",
  ]) assert.equal(looksLikeClose(line), true, line);
});

test("doesn't mistake refusals or other talk for agreement", () => {
  for (const line of [
    "No, I don't think so.",
    "Today? No, I'm slammed this week.",
    "Fine, but I can't afford it right now.",
    "We already have someone who does that.",
    "Just mail me some information.",
    "How did you get this number?",
  ]) assert.equal(looksLikeClose(line), false, line);
});

test("closeDecision matches the rules the patience engine applies", () => {
  const asked = addStudentTurn(newCallB2C(B2C_ACCEPTANCE_THRESHOLD - 14), { text: ASK }, B2C_RULES);
  assert.equal(closeDecision(asked, reply({ acceptsMeeting: true, say: "Fine, sign me up." })).contradiction, "accept_not_allowed");
  assert.equal(closeDecision(asked, reply({ say: "Fine, sign me up." })).contradiction, "accept_not_allowed"); // words alone
  assert.equal(closeDecision(asked, reply({ say: "Not yet. Tell me more." })).contradiction, null);

  const high = addStudentTurn(newCallB2C(B2C_ACCEPTANCE_THRESHOLD + 10), { text: ASK }, B2C_RULES);
  assert.equal(closeDecision(high, reply({ acceptsMeeting: true, say: "Fine, go ahead." })).contradiction, null);
  assert.equal(closeDecision(high, reply({ say: "Fine, go ahead." })).contradiction, "agreed_without_flag");
  // Allowed only if this line doesn't drop patience below the threshold.
  assert.equal(closeDecision(high, reply({ acceptsMeeting: true, patienceDelta: -15, say: "Fine, sign me up." })).contradiction, "accept_not_allowed");
});

test("REJECTION PATH: an acceptance the code rejects is repaired, and words match the state", async () => {
  const state = addStudentTurn(newCallB2C(46), { text: ASK }, B2C_RULES);
  const { send, requests } = fakeSend([
    JSON.stringify(reply({ say: "Fine, sign me up.", acceptsMeeting: true, patienceDelta: 3, reason: "Clear ask." })),
    JSON.stringify(reply({ say: "Not yet. What does it actually cost?", acceptsMeeting: false, patienceDelta: 3, reason: "Clear ask, but too early." })),
  ]);
  const r = await runExecTurn(state, ctxB2C, send, { now: clock(), ...b2cEngine });

  assert.equal(requests.length, 2);
  assert.match(requests[1].system[1], /NOT willing to agree right now/); // the repair instruction
  assert.equal(r.state.meetingBooked, false);
  assert.equal(r.state.ended, false);
  const last = r.state.turns.at(-1);
  assert.equal(last.text, "Not yet. What does it actually cost?");
  assert.equal(looksLikeClose(last.text), false);
  assert.deepEqual(last.fixes, ["meeting_repair_requested"]);

  // The debrief can't print an acceptance above "didn't agree".
  const a = analyzeCall(r.state, ctxB2C, copyFor("b2c"));
  assert.equal(a.ask.accepted, false);
  assert.equal(a.ask.asks.length, 1);
  assert.equal(a.ask.asks[0].booked, false);
});

test("REJECTION PATH: if the repair still agrees, the line is replaced and nothing closes", async () => {
  const state = addStudentTurn(newCallB2C(40), { text: ASK }, B2C_RULES);
  const agree = JSON.stringify(reply({ say: "Fine, sign me up.", acceptsMeeting: true, patienceDelta: 4, reason: "Clear ask." }));
  const { send } = fakeSend([agree, agree]);
  const r = await runExecTurn(state, ctxB2C, send, { now: clock(), ...b2cEngine });
  const last = r.state.turns.at(-1);
  assert.equal(last.text, B2C_COPY.notReadyLine);
  assert.equal(r.state.meetingBooked, false);
  assert.equal(r.state.patience, 44); // the patience change and reason are kept
  assert.deepEqual(last.fixes, ["meeting_repair_requested", "line_replaced_not_ready"]);
});

test("an allowed acceptance closes the sale, with no repair", async () => {
  const state = addStudentTurn(newCallB2C(B2C_ACCEPTANCE_THRESHOLD + 5), { text: ASK }, B2C_RULES);
  const { send, requests } = fakeSend([JSON.stringify(reply({ say: "Fine, go ahead.", acceptsMeeting: true, patienceDelta: 2 }))]);
  const r = await runExecTurn(state, ctxB2C, send, { now: clock(), ...b2cEngine });
  assert.equal(requests.length, 1);
  assert.equal(r.state.outcome, OUTCOMES.SALE_CLOSED);
});

test("allowed, and the words agree but the flag was left off: the sale closes", async () => {
  const state = addStudentTurn(newCallB2C(B2C_ACCEPTANCE_THRESHOLD + 5), { text: ASK }, B2C_RULES);
  const { send } = fakeSend([JSON.stringify(reply({ say: "Fine, go ahead.", acceptsMeeting: false, patienceDelta: 2 }))]);
  const r = await runExecTurn(state, ctxB2C, send, { now: clock(), ...b2cEngine });
  assert.equal(r.state.meetingBooked, true);
  assert.equal(r.state.outcome, OUTCOMES.SALE_CLOSED);
  assert.deepEqual(r.state.turns.at(-1).fixes, ["accepted_from_words"]);
});

test("each turn tells the consumer plainly whether buying is possible", () => {
  assert.match(closeLine(newCallB2C(B2C_ACCEPTANCE_THRESHOLD - 1)), /You are NOT willing to buy yet/);
  assert.match(closeLine(newCallB2C(B2C_ACCEPTANCE_THRESHOLD)), /They haven't asked yet/);
  assert.match(closeLine({ ...newCallB2C(B2C_ACCEPTANCE_THRESHOLD), askMade: true }), /Buying is possible: the caller has asked/);
});
