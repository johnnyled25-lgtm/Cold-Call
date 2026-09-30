// Runs one exec turn: build the request, ask the provider, read the reply, apply it.
// No DOM. The provider call is passed in as `send`, so tests can use a fake one.
//
// send(request) must return the model's raw text, or throw a ProviderError.
// Provider errors are NOT caught here; the screen decides how to end the call.

import { buildExecRequest } from "./execPrompt.js";
import { parseExecReply } from "./replyParser.js";
import { applyExecTurn, recordRetry } from "./callState.js";
import { meetingDecision } from "./meetingCheck.js";
import { COPY } from "./copy.js";

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

  // One repair try if the reply couldn't be read (brief §4.5).
  if (!parsed.ok) {
    raw = await send(buildExecRequest(state, ctx, { silence, repair: true, now: startedAt }));
    parsed = parseExecReply(raw);
    attempts.push({ raw, error: parsed.ok ? null : parsed.error });
  }

  let reply = parsed.ok ? parsed.reply : null;
  const fixes = [];

  if (reply) {
    // The exec's words must never contradict the call state about the meeting.
    let decision = meetingDecision(state, reply, { silence });

    // Agreed to a meeting the rules don't allow: ask once for a line that doesn't agree.
    if (decision.contradiction === "accept_not_allowed") {
      raw = await send(buildExecRequest(state, ctx, { silence, meetingRepair: true, now: startedAt }));
      const again = parseExecReply(raw);
      attempts.push({ raw, error: again.ok ? null : again.error, repair: "meeting" });
      if (again.ok) {
        reply = again.reply;
        decision = meetingDecision(state, reply, { silence });
      }
      fixes.push("meeting_repair_requested");
    }

    // Still agreeing: keep the reply's patience change and reason, but replace the
    // line with one that doesn't agree, and don't book.
    if (decision.contradiction === "accept_not_allowed") {
      reply = { ...reply, acceptsMeeting: false, say: COPY.notReadyLine };
      fixes.push("line_replaced_not_ready");
    }
    // The rules allow it and the words agree, but the flag was left off: the exec
    // did agree, so book it.
    if (decision.contradiction === "agreed_without_flag") {
      reply = { ...reply, acceptsMeeting: true };
      fixes.push("accepted_from_words");
    }
  }

  const at = now();
  const latencyMs = at - startedAt;
  const next = reply
    ? applyExecTurn(state, reply, ctx, { silence, latencyMs, at, fixes })
    : recordRetry(state, { at, latencyMs });

  return { state: next, reply, attempts, latencyMs, fixes };
}
