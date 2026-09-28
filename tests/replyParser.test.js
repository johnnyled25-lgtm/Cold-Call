import { test } from "node:test";
import assert from "node:assert/strict";
import { parseExecReply } from "../js/replyParser.js";
import { reply } from "./helpers.js";

test("reads a well-formed reply", () => {
  const r = parseExecReply(JSON.stringify(reply({ say: "  What's this about?  ", patienceDelta: -5 })));
  assert.equal(r.ok, true);
  assert.equal(r.reply.say, "What's this about?");
  assert.equal(r.reply.patienceDelta, -5);
});

test("reads a reply wrapped in code fences or extra words", () => {
  const wrapped = "Here you go:\n```json\n" + JSON.stringify(reply()) + "\n```";
  assert.equal(parseExecReply(wrapped).ok, true);
});

test("rejects text that isn't JSON", () => {
  assert.deepEqual(parseExecReply("Look, I've got two minutes."), { ok: false, error: "not_json" });
  assert.deepEqual(parseExecReply('{"say": "hi", '), { ok: false, error: "not_json" });
  assert.equal(parseExecReply("").ok, false);
  assert.equal(parseExecReply(null).ok, false);
});

test("rejects replies missing required fields or with wrong types", () => {
  const cases = [
    [{ say: "" }, "missing_say"],
    [{ patienceDelta: "-5" }, "missing_patienceDelta"],
    [{ patienceDelta: null }, "missing_patienceDelta"],
    [{ reason: "" }, "missing_reason"],
    [{ acceptsMeeting: "yes" }, "missing_acceptsMeeting"],
    [{ revealPainId: 7 }, "bad_revealPainId"],
  ];
  for (const [fields, error] of cases) {
    assert.deepEqual(parseExecReply(JSON.stringify(reply(fields))), { ok: false, error });
  }
});

test("studentMadeAsk is optional and defaults to false", () => {
  const { studentMadeAsk, ...rest } = reply();
  const r = parseExecReply(JSON.stringify(rest));
  assert.equal(r.ok, true);
  assert.equal(r.reply.studentMadeAsk, false);
});
