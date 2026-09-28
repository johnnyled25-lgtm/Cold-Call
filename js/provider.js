// Talks to the AI provider (OpenAI or Anthropic), straight from the browser. No server.
//
// The API key is passed in for each call. This file never stores it or logs it,
// and removes anything that looks like a key from error details.
//
// EXTENSION POINT (deferred, brief §9): a key-hiding proxy for student use would
// replace the URLs and headers in sendAnthropicOnce / sendOpenAIOnce with the
// proxy's, and the key would no longer be needed here.

import {
  ANTHROPIC_API_VERSION, MAX_REPLY_TOKENS, MODELS_WITHOUT_TEMPERATURE,
  DISABLE_THINKING, MODELS_THINKING_ALWAYS_ON, USE_STRUCTURED_OUTPUT,
  OPENAI_REASONING_EFFORT, OPENAI_REASONING_MODEL_PREFIXES,
  RATE_LIMIT_BACKOFF_SECONDS, REQUEST_TIMEOUT_SECONDS,
} from "./constants.js";

export const PROVIDERS = ["anthropic", "openai"];

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

// kind is one of:
//   missing_key, auth, model, quota, rate_limit, server, network, timeout, empty, bad_request, other.
// The screen turns the kind into a plain message from copy.js. Raw text is never shown to students;
// `detail` is only for the ?debug=1 panel, with anything key-like removed.
export class ProviderError extends Error {
  constructor(kind, status = null, detail = "") {
    super(kind);
    this.kind = kind;
    this.status = status;
    this.detail = redactKeys(detail);
  }
}

// Removes API-key-looking text (OpenAI echoes part of a wrong key in its error message).
export function redactKeys(text) {
  return String(text || "").replace(/\b(sk|key)[-_][A-Za-z0-9_\-*.]{4,}/gi, "[key removed]");
}

const RETRYABLE = new Set(["rate_limit", "server"]);

// Turns a failed HTTP response into an error kind. Pure.
export function classifyError(provider, status, body) {
  const message = String(body?.error?.message || "");
  const code = String(body?.error?.code || "");
  const type = String(body?.error?.type || "");
  if (status === 401 || status === 403) return "auth";
  if (status === 404 || code === "model_not_found") return "model";
  // Out of credit or over a spending limit: waiting won't fix it, so don't retry.
  if (/credit balance|insufficient_quota|spend_limit|usage_limit|credit_balance/i.test(`${message} ${code} ${type}`)) return "quota";
  if (status === 429 || status === 529) return "rate_limit";
  if (status >= 500) return "server";
  if (status === 400) return "bad_request";
  return "other";
}

// ---------------------------------------------------------------------------
// Request bodies (pure, so they can be tested)
// ---------------------------------------------------------------------------

// options.drop: parameter names to leave out (a model rejected them earlier this session).
export function anthropicBody({ model, system, messages, schema, temperature, maxTokens = MAX_REPLY_TOKENS }, drop = []) {
  const body = {
    model,
    max_tokens: maxTokens,
    // The fixed part of the prompt is marked for caching; the per-turn part is not.
    system: [
      { type: "text", text: system[0], cache_control: { type: "ephemeral" } },
      ...(system[1] ? [{ type: "text", text: system[1] }] : []),
    ],
    messages,
  };
  if (!drop.includes("temperature") && !MODELS_WITHOUT_TEMPERATURE.includes(model) && typeof temperature === "number") body.temperature = temperature;
  if (!drop.includes("thinking") && DISABLE_THINKING && !MODELS_THINKING_ALWAYS_ON.includes(model)) body.thinking = { type: "disabled" };
  if (!drop.includes("output_config") && USE_STRUCTURED_OUTPUT && schema) body.output_config = { format: { type: "json_schema", schema } };
  return body;
}

export function openaiBody({ model, system, messages, schema, temperature, maxTokens = MAX_REPLY_TOKENS }, drop = []) {
  const body = {
    model,
    // OpenAI takes the instructions as system messages at the start.
    messages: [...system.filter(Boolean).map((content) => ({ role: "system", content })), ...messages],
    max_completion_tokens: maxTokens,
  };
  const isReasoningModel = OPENAI_REASONING_MODEL_PREFIXES.some((p) => model.startsWith(p));
  if (!drop.includes("reasoning_effort") && isReasoningModel && OPENAI_REASONING_EFFORT) body.reasoning_effort = OPENAI_REASONING_EFFORT;
  if (!drop.includes("temperature") && !MODELS_WITHOUT_TEMPERATURE.includes(model) && typeof temperature === "number") body.temperature = temperature;
  if (!drop.includes("response_format") && USE_STRUCTURED_OUTPUT && schema) {
    body.response_format = { type: "json_schema", json_schema: { name: "exec_reply", strict: true, schema } };
  }
  return body;
}

// If a 400 error names one of these optional parameters, the request is retried once without it,
// and it stays off for that model for the rest of the session. The names must match the
// `drop` checks in the body builders above.
const OPTIONAL_PARAMS = {
  anthropic: ["temperature", "thinking", "output_config"],
  openai: ["temperature", "reasoning_effort", "response_format"],
};

export function rejectedOptionalParam(provider, message) {
  return OPTIONAL_PARAMS[provider].find((p) => String(message).includes(p)) || null;
}

// ---------------------------------------------------------------------------
// One HTTP request
// ---------------------------------------------------------------------------

// A signal that fires on the caller's abort OR after the timeout.
function withTimeout(signal, seconds) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException("timeout", "TimeoutError")), seconds * 1000);
  const onAbort = () => controller.abort(signal.reason);
  if (signal) {
    if (signal.aborted) onAbort();
    else signal.addEventListener("abort", onAbort, { once: true });
  }
  return { signal: controller.signal, done: () => { clearTimeout(timer); signal?.removeEventListener("abort", onAbort); } };
}

async function postJson(url, headers, body, signal) {
  const t = withTimeout(signal, REQUEST_TIMEOUT_SECONDS);
  let res;
  try {
    res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal: t.signal });
  } catch (err) {
    if (signal?.aborted) throw err; // the student ended the call; not an error
    if (t.signal.aborted) throw new ProviderError("timeout");
    throw new ProviderError("network", null, err?.name || "");
  } finally {
    t.done();
  }
  const data = await res.json().catch(() => null);
  return { res, data };
}

async function sendAnthropicOnce({ key, signal, ...req }, drop) {
  const { res, data } = await postJson(
    "https://api.anthropic.com/v1/messages",
    {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": ANTHROPIC_API_VERSION,
      // Required for calls straight from a browser (checked in Phase 0).
      "anthropic-dangerous-direct-browser-access": "true",
    },
    anthropicBody(req, drop),
    signal,
  );
  if (!res.ok) throw new ProviderError(classifyError("anthropic", res.status, data), res.status, data?.error?.message);
  const text = (data?.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  if (!text.trim()) throw new ProviderError("empty", res.status, data?.stop_reason || "");
  return text;
}

async function sendOpenAIOnce({ key, signal, ...req }, drop) {
  const { res, data } = await postJson(
    "https://api.openai.com/v1/chat/completions",
    { "content-type": "application/json", authorization: `Bearer ${key}` },
    openaiBody(req, drop),
    signal,
  );
  if (!res.ok) throw new ProviderError(classifyError("openai", res.status, data), res.status, data?.error?.message);
  const message = data?.choices?.[0]?.message;
  const text = typeof message?.content === "string" ? message.content : "";
  if (!text.trim()) throw new ProviderError("empty", res.status, message?.refusal || data?.choices?.[0]?.finish_reason || "");
  return text;
}

// ---------------------------------------------------------------------------
// Retries
// ---------------------------------------------------------------------------

// Waits `ms`, or stops early (with an AbortError) if the call is ended.
export function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason ?? new DOMException("aborted", "AbortError"));
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => { clearTimeout(timer); reject(signal.reason ?? new DOMException("aborted", "AbortError")); }, { once: true });
  });
}

// Tries `attempt()`; on a busy line (rate limit or server trouble) waits 2, 5, then 10 seconds
// and tries again, calling onWait(seconds) before each wait so the screen can say so.
// After the last wait, the error is passed up.
export async function withBackoff(attempt, { backoff = RATE_LIMIT_BACKOFF_SECONDS, onWait = () => {}, wait = sleep, signal } = {}) {
  for (let i = 0; ; i++) {
    try {
      return await attempt();
    } catch (err) {
      if (!(err instanceof ProviderError) || !RETRYABLE.has(err.kind) || i >= backoff.length) throw err;
      onWait(backoff[i]);
      await wait(backoff[i] * 1000, signal);
    }
  }
}

// ---------------------------------------------------------------------------
// The sender the rest of the app uses
// ---------------------------------------------------------------------------

// Parameters a model rejected this session, e.g. { "gpt-6-luna": ["temperature"] }.
// Kept in memory only; a page reload starts fresh.
const droppedParams = {};
export const droppedParamsFor = (model) => droppedParams[model] || [];

// Returns send(request) → the model's text. settings = { provider, key, model, temperature }.
// hooks = { signal, onWait, onParamDropped }.
export function createSender(settings, hooks = {}) {
  const { provider, key, model, temperature } = settings;
  const once = provider === "openai" ? sendOpenAIOnce : sendAnthropicOnce;

  return async function send(request) {
    if (!key) throw new ProviderError("missing_key");
    const full = { ...request, key, model, temperature, signal: hooks.signal };
    const attempt = async () => {
      try {
        return await once(full, droppedParamsFor(model));
      } catch (err) {
        const param = err instanceof ProviderError && err.kind === "bad_request" ? rejectedOptionalParam(provider, err.detail) : null;
        if (!param || droppedParamsFor(model).includes(param)) throw err;
        droppedParams[model] = [...droppedParamsFor(model), param];
        hooks.onParamDropped?.(param);
        return once(full, droppedParamsFor(model));
      }
    };
    return withBackoff(attempt, { onWait: hooks.onWait, signal: hooks.signal });
  };
}

// Test connection: a one-word request with the same options a real call uses.
// Returns { ok: true, ms, reply } or { ok: false, kind }.
export async function testConnection(settings, { signal, onWait } = {}) {
  const send = createSender(settings, { signal, onWait });
  const schema = {
    type: "object",
    properties: { word: { type: "string" } },
    required: ["word"],
    additionalProperties: false,
  };
  const started = performance.now();
  try {
    const text = await send({
      system: ['Reply with a JSON object like {"word": "ready"}.', ""],
      messages: [{ role: "user", content: "Say one word: ready" }],
      schema,
      maxTokens: 50,
    });
    return { ok: true, ms: Math.round(performance.now() - started), reply: text.slice(0, 80) };
  } catch (err) {
    if (signal?.aborted) throw err;
    return { ok: false, kind: err instanceof ProviderError ? err.kind : "other", status: err?.status ?? null, detail: err?.detail || "" };
  }
}
