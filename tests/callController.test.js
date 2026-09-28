import { test } from "node:test";
import assert from "node:assert/strict";
import { runExecTurn } from "../js/callController.js";
import { addStudentTurn } from "../js/callState.js";
import { ProviderError } from "../js/provider.js";
import { ctx, newCall, reply } from "./helpers.js";

const started = () => addStudentTurn(newCall(40), { text: "Hi, this is Jordan.", at: 1 });
const fakeSend = (answers) => {
  const requests = [];
  const send = async (req) => {
    requests.push(req);
    const a = answers.shift();
    if (a instanceof Error) throw a;
    return a;
  };
  return { send, requests };
};
const clock = () => { let t = 1000; return () => (t += 250); };

test("invalid model JSON twice produces a retry turn with no patience change", async () => {
  const { send, requests } = fakeSend(["not json", "{still not"]);
  const r = await runExecTurn(started(), ctx, send, { now: clock() });
  const last = r.state.turns.at(-1);
  assert.equal(last.event, "retry");
  assert.equal(r.state.patience, 40);
  assert.equal(requests.length, 2);
  assert.match(requests[1].system[1], /couldn't be read/); // the repair instruction
});

test("a bad reply followed by a good one is applied normally", async () => {
  const { send } = fakeSend(["oops", JSON.stringify(reply({ patienceDelta: -5 }))]);
  const r = await runExecTurn(started(), ctx, send, { now: clock() });
  assert.equal(r.state.patience, 35);
  assert.equal(r.attempts.length, 2);
});

test("an empty reply counts as unreadable, not a dropped call", async () => {
  const { send } = fakeSend([new ProviderError("empty"), new ProviderError("empty")]);
  const r = await runExecTurn(started(), ctx, send, { now: clock() });
  assert.equal(r.state.turns.at(-1).event, "retry");
  assert.equal(r.state.ended, false);
});

test("other provider errors are passed up to the screen", async () => {
  const { send } = fakeSend([new ProviderError("rate_limit", 429)]);
  await assert.rejects(runExecTurn(started(), ctx, send, { now: clock() }), (e) => e.kind === "rate_limit");
});

test("latency is recorded on the exec turn", async () => {
  const { send } = fakeSend([JSON.stringify(reply())]);
  const r = await runExecTurn(started(), ctx, send, { now: clock() });
  assert.equal(r.state.turns.at(-1).latencyMs, 250);
});
