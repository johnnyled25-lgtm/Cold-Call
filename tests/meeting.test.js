// The exec's words must never contradict the call state about the meeting.
import { test } from "node:test";
import assert from "node:assert/strict";
import { looksLikeAgreement, meetingDecision } from "../js/meetingCheck.js";
import { runExecTurn } from "../js/callController.js";
import { addStudentTurn } from "../js/callState.js";
import { meetingLine } from "../js/execPrompt.js";
import { analyzeCall } from "../js/debrief.js";
import { ACCEPTANCE_THRESHOLD, OUTCOMES } from "../js/constants.js";
import { COPY } from "../js/copy.js";
import { ctx, newCall, reply } from "./helpers.js";

const ASK = "Could we find 15 minutes on Thursday?";
const clock = () => { let t = 1000; return () => (t += 100); };
function fakeSend(answers) {
  const requests = [];
  return { requests, send: async (req) => { requests.push(req); return answers.shift(); } };
}

test("spots lines that agree to a meeting time", () => {
  for (const line of [
    "Fine. Thursday, ten o'clock.",
    "Sure, Thursday at 2pm works.",
    "OK. Tomorrow at ten, fifteen minutes.",
    "Send me an invite.",
    "Alright, put it on my calendar.",
  ]) assert.equal(looksLikeAgreement(line), true, line);
});

test("doesn't mistake refusals or other talk for agreement", () => {
  for (const line of [
    "No. Send me an email.",
    "Thursday? No, I'm slammed all week.",
    "Fine, but I don't have time on Thursday.",
    "Mondays are a mess.",
    "Just send me an email.",
    "What's this about?",
  ]) assert.equal(looksLikeAgreement(line), false, line);
});

test("meetingDecision matches the rules the patience engine applies", () => {
  const asked = addStudentTurn(newCall(ACCEPTANCE_THRESHOLD - 14), { text: ASK });
  assert.equal(meetingDecision(asked, reply({ acceptsMeeting: true, say: "Fine. Thursday, ten o'clock." })).contradiction, "accept_not_allowed");
  assert.equal(meetingDecision(asked, reply({ say: "Fine. Thursday, ten o'clock." })).contradiction, "accept_not_allowed"); // words alone
  assert.equal(meetingDecision(asked, reply({ say: "Not yet. Tell me more." })).contradiction, null);

  const high = addStudentTurn(newCall(ACCEPTANCE_THRESHOLD + 10), { text: ASK });
  assert.equal(meetingDecision(high, reply({ acceptsMeeting: true, say: "Fine. Thursday at ten." })).contradiction, null);
  assert.equal(meetingDecision(high, reply({ say: "Fine. Thursday at ten." })).contradiction, "agreed_without_flag");
  // Allowed only if this line doesn't drop patience below the threshold.
  assert.equal(meetingDecision(high, reply({ acceptsMeeting: true, patienceDelta: -15, say: "Fine. Thursday." })).contradiction, "accept_not_allowed");
});

test("REJECTION PATH: an acceptance the code rejects is repaired, and words match the state", async () => {
  const state = addStudentTurn(newCall(46), { text: ASK });
  const { send, requests } = fakeSend([
    JSON.stringify(reply({ say: "Fine. Thursday, ten o'clock.", acceptsMeeting: true, patienceDelta: 3, reason: "Clear ask." })),
    JSON.stringify(reply({ say: "Not yet. What does it actually cost?", acceptsMeeting: false, patienceDelta: 3, reason: "Clear ask, but too early." })),
  ]);
  const r = await runExecTurn(state, ctx, send, { now: clock() });

  assert.equal(requests.length, 2);
  assert.match(requests[1].system[1], /NOT willing to agree to one right now/); // the repair instruction
  assert.equal(r.state.meetingBooked, false);
  assert.equal(r.state.ended, false);
  const last = r.state.turns.at(-1);
  assert.equal(last.text, "Not yet. What does it actually cost?");
  assert.equal(looksLikeAgreement(last.text), false);
  assert.deepEqual(last.fixes, ["meeting_repair_requested"]);

  // The debrief can't print an acceptance above "didn't agree".
  const a = analyzeCall(r.state, ctx);
  assert.equal(a.ask.accepted, false);
  assert.equal(a.ask.asks.length, 1);
  assert.equal(a.ask.asks[0].booked, false);
  assert.equal(looksLikeAgreement(a.ask.asks[0].responseText), false);
});

test("REJECTION PATH: if the repair still agrees, the line is replaced and nothing is booked", async () => {
  const state = addStudentTurn(newCall(40), { text: ASK });
  const agree = JSON.stringify(reply({ say: "Fine. Thursday, ten o'clock.", acceptsMeeting: true, patienceDelta: 4, reason: "Clear ask." }));
  const { send } = fakeSend([agree, agree]);
  const r = await runExecTurn(state, ctx, send, { now: clock() });
  const last = r.state.turns.at(-1);
  assert.equal(last.text, COPY.notReadyLine);
  assert.equal(r.state.meetingBooked, false);
  assert.equal(r.state.patience, 44); // the patience change and reason are kept
  assert.deepEqual(last.fixes, ["meeting_repair_requested", "line_replaced_not_ready"]);
});

test("an allowed acceptance goes through with no repair", async () => {
  const state = addStudentTurn(newCall(ACCEPTANCE_THRESHOLD + 5), { text: ASK });
  const { send, requests } = fakeSend([JSON.stringify(reply({ say: "Fine. Thursday at ten.", acceptsMeeting: true, patienceDelta: 2 }))]);
  const r = await runExecTurn(state, ctx, send, { now: clock() });
  assert.equal(requests.length, 1);
  assert.equal(r.state.outcome, OUTCOMES.MEETING_BOOKED);
});

test("allowed, and the words agree but the flag was left off: the meeting is booked", async () => {
  const state = addStudentTurn(newCall(ACCEPTANCE_THRESHOLD + 5), { text: ASK });
  const { send } = fakeSend([JSON.stringify(reply({ say: "Fine. Thursday at ten.", acceptsMeeting: false, patienceDelta: 2 }))]);
  const r = await runExecTurn(state, ctx, send, { now: clock() });
  assert.equal(r.state.meetingBooked, true);
  assert.deepEqual(r.state.turns.at(-1).fixes, ["accepted_from_words"]);
});

test("each turn tells the exec plainly whether a meeting is possible", () => {
  assert.match(meetingLine(newCall(ACCEPTANCE_THRESHOLD - 1)), /You are NOT willing to agree to a meeting yet/);
  assert.match(meetingLine(newCall(ACCEPTANCE_THRESHOLD)), /They haven't asked yet/);
  assert.match(meetingLine({ ...newCall(ACCEPTANCE_THRESHOLD), askMade: true }), /A meeting is possible: the caller has asked/);
});
