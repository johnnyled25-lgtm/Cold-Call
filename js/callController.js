// Runs one exec turn: build the request, ask the provider, read the reply, apply it.
// No DOM. The provider call is passed in as `send`, so tests can use a fake one.
//
// send(request) must return the model's raw text, or throw a ProviderError.
// Provider errors are NOT caught here; the screen decides how to end the call.

import { buildExecRequest } from "./execPrompt.js";
import { parseExecReply } from "./replyParser.js";
import { applyExecTurn, recordRetry } from "./callState.js";

export async function runExecTurn(state, ctx, sendToProvider, { silence = false, now = () => Date.now() } = {}) {
  const startedAt = now();
  const attempts = [];

  // An empty reply is treated like an unreadable one (repair, then a retry turn),
  // not as a dropped call.
  const send = async (request) => {
    try {
      return await sendToProvider(request);
    } catch (err) {
      if (err?.kind === "empty") return "";
      throw err;
    }
  };

  // First try.
  let raw = await send(buildExecRequest(state, ctx, { silence, now: startedAt }));
  let parsed = parseExecReply(raw);
  attempts.push({ raw, error: parsed.ok ? null : parsed.error });

  // One repair try with a short instruction (brief §4.5).
  if (!parsed.ok) {
    raw = await send(buildExecRequest(state, ctx, { silence, repair: true, now: startedAt }));
    parsed = parseExecReply(raw);
    attempts.push({ raw, error: parsed.ok ? null : parsed.error });
  }

  const at = now();
  const latencyMs = at - startedAt;
  const next = parsed.ok
    ? applyExecTurn(state, parsed.reply, ctx, { silence, latencyMs, at })
    : recordRetry(state, { at, latencyMs });

  return { state: next, reply: parsed.ok ? parsed.reply : null, attempts, latencyMs };
}
