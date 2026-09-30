// The call state engine (brief §4.5). Pure; no DOM, no network.
// The exec's patience lives here, in code. The model only PROPOSES a change with a reason.
// This file checks the proposal, clamps it, applies it, and decides how the call ends.
// Every function returns a NEW state object; nothing is changed in place.
//
// Where patience changes are recorded: on the EXEC turn that reacted, with the reason.
// The student line that caused the change is the student turn right before it.

import {
  PATIENCE_MIN, PATIENCE_MAX, DELTA_MIN, DELTA_MAX, ACCEPTANCE_THRESHOLD,
  SILENCE_COST, CALL_TIME_CAP_MINUTES, OUTCOMES,
} from "./constants.js";
import { COPY, fill } from "./copy.js";
import { detectAsk } from "./askDetect.js";

// Which event goes in a turn's single "event" field when several happen at once.
const EVENT_PRIORITY = ["meeting_accepted", "retry", "silence", "objection_handled", "pain_revealed", "objection_raised", "ask_made"];

export const clampPatience = (p) => Math.min(PATIENCE_MAX, Math.max(PATIENCE_MIN, Math.round(p)));
export const clampDelta = (d) => Math.min(DELTA_MAX, Math.max(DELTA_MIN, Math.round(d)));

function mainEvent(events) {
  for (const e of EVENT_PRIORITY) if (events.includes(e)) return e;
  return null;
}

function makeTurn(state, fields) {
  return {
    index: state.turns.length,
    speaker: fields.speaker,
    text: fields.text,
    inputMode: fields.inputMode ?? null,
    patienceBefore: fields.patienceBefore ?? state.patience,
    patienceAfter: fields.patienceAfter ?? state.patience,
    delta: fields.delta ?? 0,
    reason: fields.reason ?? null,
    event: mainEvent(fields.events || []),
    events: fields.events || [],
    latencyMs: fields.latencyMs ?? null,
    at: fields.at ?? null,
    ...(fields.extra || {}),
  };
}

function lastStudentTurnIndex(state) {
  for (let i = state.turns.length - 1; i >= 0; i--) if (state.turns[i].speaker === "student") return i;
  return null;
}

// A new call. The exec's pickup line is turn 0.
export function createCallState({ seed, persona, offer, mood, pickupLine, startedAt }) {
  const firstName = persona.name.split(" ")[0];
  const state = {
    seed,
    personaId: persona.id,
    offerId: offer.id,
    moodId: mood.id,
    startingPatience: mood.startingPatience,
    patience: clampPatience(mood.startingPatience),
    revealedPainIds: [],
    raisedObjections: [], // { id, handled, raisedAtTurn, handledAtTurn }
    askMade: false,
    askDetectedBy: null, // "phrase" | "model"
    askPhrase: null,
    askTurnIndex: null,
    meetingBooked: false,
    ended: false,
    outcome: null,
    outcomeDetail: null,
    startedAt,
    endedAt: null,
    turns: [],
  };
  const text = fill(pickupLine || "{first}.", { first: firstName, company: persona.company, name: persona.name });
  return { ...state, turns: [makeTurn(state, { speaker: "exec", text, at: startedAt })] };
}

// The student said (or typed) something. Detects the ask; never changes patience.
export function addStudentTurn(state, { text, inputMode = "typed", at = null }) {
  if (state.ended) return state;
  const clean = String(text || "").trim();
  const ask = state.askMade ? { asked: false } : detectAsk(clean);
  const events = ask.asked ? ["ask_made"] : [];
  const turn = makeTurn(state, { speaker: "student", text: clean, inputMode, events, at });
  const next = { ...state, turns: [...state.turns, turn] };
  if (ask.asked) {
    Object.assign(next, { askMade: true, askDetectedBy: "phrase", askPhrase: ask.phrase, askTurnIndex: turn.index });
  }
  return next;
}

// The student said nothing for the silence timeout. The fixed cost is applied on the
// exec's reaction (applyExecTurn with { silence: true }), like every other change.
export function addSilenceTurn(state, { at = null } = {}) {
  if (state.ended) return state;
  const turn = makeTurn(state, { speaker: "student", text: "", inputMode: null, events: ["silence"], at });
  return { ...state, turns: [...state.turns, turn] };
}

// Applies the exec's (already shape-checked) reply. ctx = { persona }.
// opts = { silence, latencyMs, at }.
export function applyExecTurn(state, reply, ctx, opts = {}) {
  if (state.ended) return state;
  const { persona } = ctx;
  const events = [];
  const ignored = [];

  // 1. Patience: the model proposes, the code clamps and applies.
  const before = state.patience;
  const proposed = opts.silence ? SILENCE_COST : clampDelta(reply.patienceDelta);
  const after = clampPatience(before + proposed);
  const reason = opts.silence ? COPY.reasons.silence : reply.reason;
  if (opts.silence) events.push("silence");
  const turnIndex = state.turns.length;

  // 2. Pain points: only real, not-yet-revealed ones.
  let revealedPainIds = state.revealedPainIds;
  if (reply.revealPainId) {
    const exists = persona.painPoints.some((p) => p.id === reply.revealPainId);
    if (exists && !revealedPainIds.includes(reply.revealPainId)) {
      revealedPainIds = [...revealedPainIds, reply.revealPainId];
      events.push("pain_revealed");
    } else {
      ignored.push(exists ? "pain_already_revealed" : "pain_unknown");
    }
  }

  // 3. Objections: handling first, then at most one new one.
  let raisedObjections = state.raisedObjections.map((o) => ({ ...o }));
  if (reply.handledObjectionId) {
    const open = raisedObjections.find((o) => o.id === reply.handledObjectionId && !o.handled);
    if (open) {
      open.handled = true;
      open.handledAtTurn = turnIndex;
      events.push("objection_handled");
    } else {
      ignored.push("handled_unknown_objection");
    }
  }
  if (reply.raiseObjectionId) {
    const allowed = persona.objections.includes(reply.raiseObjectionId);
    const alreadyOpen = raisedObjections.some((o) => o.id === reply.raiseObjectionId && !o.handled);
    if (allowed && !alreadyOpen) {
      raisedObjections.push({ id: reply.raiseObjectionId, handled: false, raisedAtTurn: turnIndex, handledAtTurn: null });
      events.push("objection_raised");
    } else {
      ignored.push(allowed ? "objection_already_open" : "objection_unknown");
    }
  }

  // 4. The ask: the phrase list may have caught it already; otherwise the model can flag it.
  let ask = { askMade: state.askMade, askDetectedBy: state.askDetectedBy, askPhrase: state.askPhrase, askTurnIndex: state.askTurnIndex };
  if (!opts.silence && reply.studentMadeAsk && !state.askMade) {
    ask = { askMade: true, askDetectedBy: "model", askPhrase: null, askTurnIndex: lastStudentTurnIndex(state) };
  }

  // 5. How the call ends. Only patience reaching 0 is "Hung up".
  let ending = {};
  if (after <= PATIENCE_MIN) {
    ending = { ended: true, outcome: OUTCOMES.HUNG_UP, endedAt: opts.at ?? null };
    if (reply.acceptsMeeting) ignored.push("acceptance_ignored_hung_up");
  } else if (reply.acceptsMeeting) {
    if (!ask.askMade) ignored.push("acceptance_ignored_no_ask");
    else if (after < ACCEPTANCE_THRESHOLD) ignored.push("acceptance_ignored_below_threshold");
    else {
      events.push("meeting_accepted");
      ending = { ended: true, meetingBooked: true, outcome: OUTCOMES.MEETING_BOOKED, endedAt: opts.at ?? null };
    }
  }

  const turn = makeTurn(state, {
    speaker: "exec",
    text: reply.say,
    patienceBefore: before,
    patienceAfter: after,
    delta: after - before,
    reason,
    events,
    latencyMs: opts.latencyMs,
    at: opts.at,
    extra: { proposedDelta: opts.silence ? null : reply.patienceDelta, ignored, fixes: opts.fixes || [] },
  });

  return { ...state, ...ask, ...ending, patience: after, revealedPainIds, raisedObjections, turns: [...state.turns, turn] };
}

// The AI's reply couldn't be read, even after one repair attempt.
// The exec asks the student to repeat; patience does not change.
export function recordRetry(state, { at = null, latencyMs = null } = {}) {
  if (state.ended) return state;
  const turn = makeTurn(state, { speaker: "exec", text: COPY.retryLine, reason: COPY.reasons.retry, events: ["retry"], at, latencyMs });
  return { ...state, turns: [...state.turns, turn] };
}

// The student pressed End call. Never "Hung up": that word means the exec hung up.
export function endByStudent(state, now) {
  if (state.ended) return state;
  return { ...state, ended: true, endedAt: now, outcome: state.askMade ? OUTCOMES.ASKED_NO_MEETING : OUTCOMES.NO_ASK };
}

// Ends the call if it has reached the time cap. Returns the state unchanged otherwise.
export function endIfTimeUp(state, now) {
  if (state.ended) return state;
  if (now - state.startedAt < CALL_TIME_CAP_MINUTES * 60 * 1000) return state;
  return { ...state, ended: true, endedAt: now, outcome: OUTCOMES.TIMES_UP };
}

// A provider failure mid-call. Excluded from the Record (brief §4.6).
export function dropCall(state, now) {
  if (state.ended) return state;
  return { ...state, ended: true, endedAt: now, outcome: OUTCOMES.DROPPED, outcomeDetail: COPY.call.connectionTrouble };
}

// Replaces a turn's latency with the full wait the student felt: from their release
// (or Enter) to the exec starting to speak. The provider's share is kept as requestMs.
export function setTurnLatency(state, index, latencyMs) {
  const turn = state.turns[index];
  if (!turn) return state;
  const updated = { ...turn, requestMs: turn.requestMs ?? turn.latencyMs, latencyMs: Math.max(0, Math.round(latencyMs)) };
  return { ...state, turns: state.turns.map((t, i) => (i === index ? updated : t)) };
}

// Latency of each exec reply, grouped by how the student spoke the line before it.
// Silence reactions, retries, and the pickup line are left out.
export function latenciesByInputMode(state) {
  const out = { typed: [], voice: [] };
  state.turns.forEach((turn, i) => {
    if (turn.speaker !== "exec" || turn.latencyMs == null || turn.event === "retry") return;
    const prev = state.turns[i - 1];
    if (!prev || prev.speaker !== "student" || prev.events.includes("silence")) return;
    if (out[prev.inputMode]) out[prev.inputMode].push(turn.latencyMs);
  });
  return out;
}

export function callDurationMs(state, now) {
  return (state.endedAt ?? now) - state.startedAt;
}
