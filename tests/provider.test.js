import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  classifyError, redactKeys, openaiBody, anthropicBody, withBackoff, ProviderError,
  createSender, testConnection, rejectedOptionalParam,
} from "../js/provider.js";
import { getKey, setKey, loadSettings, saveSettings, currentCallSettings, clearEverything } from "../js/storage.js";
import { DEFAULT_MODELS, DEFAULT_PROVIDER, RATE_LIMIT_BACKOFF_SECONDS } from "../js/constants.js";

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

// A fake fetch that answers from a list and records each request body.
function fakeFetch(responses) {
  const bodies = [];
  globalThis.fetch = async (url, init) => {
    bodies.push({ url, headers: init.headers, body: JSON.parse(init.body) });
    const r = responses.shift();
    if (r instanceof Error) throw r;
    return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.body };
  };
  return bodies;
}
const anthropicOk = (text) => ({ status: 200, body: { content: [{ type: "text", text }], stop_reason: "end_turn" } });
const openaiOk = (text) => ({ status: 200, body: { choices: [{ message: { content: text }, finish_reason: "stop" }] } });
const request = { system: ["fixed", "now"], messages: [{ role: "user", content: "hi" }], schema: { type: "object" } };

test("errors are sorted into named kinds", () => {
  assert.equal(classifyError("openai", 401, {}), "auth");
  assert.equal(classifyError("anthropic", 403, {}), "auth");
  assert.equal(classifyError("anthropic", 404, {}), "model");
  assert.equal(classifyError("openai", 400, { error: { code: "model_not_found" } }), "model");
  assert.equal(classifyError("anthropic", 429, {}), "rate_limit");
  assert.equal(classifyError("anthropic", 529, {}), "rate_limit");
  assert.equal(classifyError("anthropic", 500, {}), "server");
  assert.equal(classifyError("anthropic", 400, { error: { message: "Your credit balance is too low to access the API." } }), "quota");
  assert.equal(classifyError("openai", 429, { error: { type: "insufficient_quota", code: "credit_balance_exhausted" } }), "quota");
  assert.equal(classifyError("openai", 400, { error: { message: "bad thing" } }), "bad_request");
});

test("anything that looks like a key is removed from error details", () => {
  const detail = "Incorrect API key provided: sk-proj-abc1****************wxyz. You can find your API key at ...";
  assert.doesNotMatch(new ProviderError("auth", 401, detail).detail, /sk-proj|abc1|wxyz/);
  assert.match(redactKeys("key sk-ant-api03-SECRETSECRET"), /\[key removed\]/);
});

test("OpenAI request: system messages first, structured output, reasoning effort only for newer models", () => {
  const luna = openaiBody({ ...request, model: "gpt-6-luna", temperature: 0.8 });
  assert.deepEqual(luna.messages.map((m) => m.role), ["system", "system", "user"]);
  assert.equal(luna.reasoning_effort, "none");
  assert.equal(luna.response_format.json_schema.strict, true);
  assert.equal(luna.temperature, 0.8);
  assert.equal("reasoning_effort" in openaiBody({ ...request, model: "gpt-4o-mini" }), false);
  assert.equal("temperature" in openaiBody({ ...request, model: "gpt-6-luna", temperature: 0.8 }, ["temperature"]), false);
});

test("a rejected optional parameter is recognized from the error message", () => {
  assert.equal(rejectedOptionalParam("openai", "Unsupported parameter: 'temperature' is not supported with this model."), "temperature");
  assert.equal(rejectedOptionalParam("anthropic", "thinking.type: Input should be 'adaptive'"), "thinking");
  assert.equal(rejectedOptionalParam("openai", "Something else"), null);
});

test("backoff waits 2, 5, 10 seconds on a busy line, then gives up", async () => {
  const waits = [];
  let calls = 0;
  await assert.rejects(
    withBackoff(async () => { calls++; throw new ProviderError("rate_limit", 429); }, {
      onWait: (s) => waits.push(s), wait: async () => {},
    }),
    (e) => e.kind === "rate_limit",
  );
  assert.deepEqual(waits, RATE_LIMIT_BACKOFF_SECONDS);
  assert.equal(calls, RATE_LIMIT_BACKOFF_SECONDS.length + 1);
});

test("backoff succeeds when the line frees up, and never retries non-busy errors", async () => {
  let calls = 0;
  const ok = await withBackoff(async () => { if (++calls < 3) throw new ProviderError("server", 503); return "done"; }, { wait: async () => {} });
  assert.equal(ok, "done");
  let authCalls = 0;
  await assert.rejects(withBackoff(async () => { authCalls++; throw new ProviderError("auth", 401); }, { wait: async () => {} }));
  assert.equal(authCalls, 1);
});

test("sender: Anthropic call carries the browser header and returns the text", async () => {
  const sent = fakeFetch([anthropicOk('{"say":"Yeah?"}')]);
  const send = createSender({ provider: "anthropic", key: "k-test", model: "claude-sonnet-5", temperature: 0.8 });
  assert.equal(await send(request), '{"say":"Yeah?"}');
  assert.equal(sent[0].headers["anthropic-dangerous-direct-browser-access"], "true");
  assert.equal(sent[0].url, "https://api.anthropic.com/v1/messages");
});

test("sender: a model that rejects temperature gets the request again without it", async () => {
  const notes = [];
  const sent = fakeFetch([
    { status: 400, body: { error: { message: "Unsupported parameter: 'temperature' is not supported with this model." } } },
    openaiOk("{}"),
    openaiOk("{}"),
  ]);
  const send = createSender({ provider: "openai", key: "k", model: "test-model-a", temperature: 0.8 }, { onParamDropped: (p) => notes.push(p) });
  await send(request);
  assert.equal("temperature" in sent[0].body, true);
  assert.equal("temperature" in sent[1].body, false);
  assert.deepEqual(notes, ["temperature"]);
  await send(request); // remembered for the rest of the session
  assert.equal("temperature" in sent[2].body, false);
});

test("sender: missing key, network failure, and empty reply are named errors", async () => {
  await assert.rejects(createSender({ provider: "anthropic", key: "", model: "m" })(request), (e) => e.kind === "missing_key");
  fakeFetch([new TypeError("Failed to fetch")]);
  await assert.rejects(createSender({ provider: "openai", key: "k", model: "m" })(request), (e) => e.kind === "network");
  fakeFetch([openaiOk("")]);
  await assert.rejects(createSender({ provider: "openai", key: "k", model: "m" })(request), (e) => e.kind === "empty");
});

test("Test connection reports success or a named error, never raw text", async () => {
  fakeFetch([anthropicOk('{"word":"ready"}')]);
  const ok = await testConnection({ provider: "anthropic", key: "k", model: "claude-sonnet-5" });
  assert.equal(ok.ok, true);
  fakeFetch([{ status: 404, body: { error: { message: "model: nope" } } }]);
  const bad = await testConnection({ provider: "anthropic", key: "k", model: "nope" });
  assert.deepEqual([bad.ok, bad.kind], [false, "model"]);
});

test("Test connection request has no empty system block", () => {
  const body = anthropicBody({ system: ["fixed", ""], messages: [], model: "claude-sonnet-5" });
  assert.equal(body.system.length, 1);
});

test("storage: one key per provider, settings with defaults, and Clear everything", () => {
  clearEverything();
  assert.equal(loadSettings().provider, DEFAULT_PROVIDER);
  assert.equal(loadSettings().models.openai, DEFAULT_MODELS.openai);
  setKey("anthropic", "a-key");
  setKey("openai", "o-key");
  saveSettings({ provider: "openai", models: { anthropic: "claude-x", openai: "gpt-y" }, temperature: 0.4 });
  assert.deepEqual(currentCallSettings(), { provider: "openai", key: "o-key", model: "gpt-y", temperature: 0.4 });
  assert.equal(getKey("anthropic"), "a-key");
  clearEverything();
  assert.equal(getKey("anthropic"), "");
  assert.equal(getKey("openai"), "");
  assert.equal(loadSettings().provider, DEFAULT_PROVIDER);
});

test("Clear everything keeps the one-time privacy note dismissed", async () => {
  const { STORAGE_KEYS } = await import("../js/constants.js");
  // In Node there's no localStorage, so storage.js falls back to memory; check via its own API.
  const storage = await import("../js/storage.js");
  globalThis.localStorage = {
    data: {}, getItem(k) { return this.data[k] ?? null; }, setItem(k, v) { this.data[k] = String(v); }, removeItem(k) { delete this.data[k]; },
  };
  try {
    localStorage.setItem(STORAGE_KEYS.privacyNoteSeen, "1");
    localStorage.setItem(STORAGE_KEYS.settings, "{}");
    storage.clearEverything();
    assert.equal(localStorage.getItem(STORAGE_KEYS.privacyNoteSeen), "1");
    assert.equal(localStorage.getItem(STORAGE_KEYS.settings), null);
  } finally {
    delete globalThis.localStorage;
  }
});
