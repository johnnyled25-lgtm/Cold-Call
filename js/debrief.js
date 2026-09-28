// The debrief: the call replayed with the exec's hidden state made visible (brief §4.9).
// Pure; no DOM. debrief-view.js draws what this returns.
// No scores and no totals-as-progress anywhere: only what happened.

import { OUTCOMES } from "./constants.js";
import { COPY, fill } from "./copy.js";

export function formatClock(ms) {
  const s = Math.max(0, Math.floor((ms || 0) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// "+5", "−22" (a real minus sign), "0".
export function formatDelta(d) {
  if (d > 0) return `+${d}`;
  if (d < 0) return `−${Math.abs(d)}`;
  return "0";
}

export const wordCount = (text) => String(text || "").trim().split(/\s+/).filter(Boolean).length;

// ctx: { persona, offer, mood, objections }. Returns everything the debrief shows.
export function analyzeCall(state, ctx) {
  const { persona, offer, mood } = ctx;
  const firstName = persona.name.split(" ")[0];
  const start = state.startedAt;
  const lastAt = [...state.turns].reverse().find((t) => t.at != null)?.at ?? start;
  const durationMs = Math.max(0, (state.endedAt ?? lastAt) - start);
  const at = (t) => Math.max(0, (t?.at ?? start) - start);

  // Every patience change, tied to the student line that caused it (the turn before).
  const changes = state.turns
    .filter((t) => t.speaker === "exec" && t.index > 0)
    .map((t) => {
      const prev = state.turns[t.index - 1];
      const fromStudent = prev && prev.speaker === "student";
      return {
        execIndex: t.index,
        studentIndex: fromStudent ? prev.index : null,
        silence: Boolean(fromStudent && prev.events.includes("silence")),
        studentText: fromStudent && !prev.events.includes("silence") ? prev.text : null,
        execText: t.text,
        before: t.patienceBefore,
        after: t.patienceAfter,
        delta: t.delta,
        reason: t.reason,
        retry: t.event === "retry",
        events: t.events,
        atMs: at(t),
      };
    });

  // Chart: the starting patience, then one point per exec reaction.
  const chart = [{ x: 0, patience: state.startingPatience, change: null }, ...changes.map((c, i) => ({ x: i + 1, patience: c.after, change: c }))];

  // Where the call turned: the largest single drop; earliest wins a tie; null if none.
  let turningPoint = null;
  for (const c of changes) if (c.delta < 0 && (!turningPoint || c.delta < turningPoint.delta)) turningPoint = c;

  // Pain points, in the order they were uncovered.
  const found = state.revealedPainIds.map((id) => persona.painPoints.find((p) => p.id === id)).filter(Boolean);
  const missed = persona.painPoints.filter((p) => !state.revealedPainIds.includes(p.id));

  const objections = state.raisedObjections.map((o) => {
    const def = ctx.objections.find((x) => x.id === o.id) || { line: o.id, whatHandlesIt: "" };
    return { id: o.id, line: def.line, whatHandlesIt: def.whatHandlesIt, handled: o.handled };
  });

  // The ask: when, how it was detected, and how the exec answered.
  const studentLines = state.turns.filter((t) => t.speaker === "student" && !t.events.includes("silence"));
  let ask = { made: false };
  if (state.askMade && state.askTurnIndex != null) {
    const askTurn = state.turns[state.askTurnIndex];
    const response = state.turns.slice(state.askTurnIndex + 1).find((t) => t.speaker === "exec");
    ask = {
      made: true,
      text: askTurn?.text || "",
      atMs: at(askTurn),
      lineNumber: studentLines.findIndex((t) => t.index === state.askTurnIndex) + 1,
      totalLines: studentLines.length,
      detectedBy: state.askDetectedBy,
      phrase: state.askPhrase,
      responseText: response?.text || null,
      accepted: state.meetingBooked,
    };
  }

  const studentWords = studentLines.reduce((n, t) => n + wordCount(t.text), 0);
  const execWords = state.turns.filter((t) => t.speaker === "exec").reduce((n, t) => n + wordCount(t.text), 0);
  const facts = {
    durationMs,
    studentLines: studentLines.length,
    silences: state.turns.filter((t) => t.events.includes("silence") && t.speaker === "student").length,
    retries: state.turns.filter((t) => t.event === "retry").length,
    voiceLines: studentLines.filter((t) => t.inputMode === "voice").length,
    studentWordShare: studentWords + execWords ? Math.round((100 * studentWords) / (studentWords + execWords)) : 0,
  };

  const transcript = state.turns.map((t) => ({
    speaker: t.speaker,
    who: t.speaker === "student" ? COPY.call.you : firstName,
    text: t.events.includes("silence") && t.speaker === "student" ? COPY.debrief.silence : t.text,
    atMs: at(t),
    inputMode: t.inputMode,
    change: t.speaker === "exec" && t.index > 0 ? { before: t.patienceBefore, after: t.patienceAfter, delta: t.delta, reason: t.reason } : null,
  }));

  return {
    outcome: state.outcome,
    outcomeWord: COPY.outcomes[state.outcome] || "",
    outcomeLine: fill(COPY.debrief.outcomeLines[state.outcome] || "{time}", { time: formatClock(durationMs) }),
    countsInRecord: state.outcome !== OUTCOMES.DROPPED,
    startedAt: start,
    firstName,
    persona,
    offer,
    mood,
    startingPatience: state.startingPatience,
    seed: state.seed,
    changes,
    chart,
    turningPoint,
    pains: { found, missed, total: persona.painPoints.length },
    objections,
    ask,
    facts,
    transcript,
  };
}

// The plain-text version for "Copy transcript". dateText is passed in so the
// output doesn't depend on the computer's clock or time zone.
export function formatTranscriptText(a, { dateText = "" } = {}) {
  const d = COPY.debrief;
  const lines = [];
  lines.push(d.textTitle);
  if (dateText) lines.push(`${d.textDate}: ${dateText}`);
  lines.push(`${d.textOutcome}: ${a.outcomeLine}`);
  lines.push(`${d.textExec}: ${a.persona.name}, ${a.persona.title}, ${a.persona.company}`);
  lines.push(`${d.textMood}: ${a.mood.label} (${d.textStarting} ${a.startingPatience})`);
  lines.push(`${d.textSelling}: ${a.offer.product} (${a.offer.company})`);
  lines.push("");

  lines.push(`${d.turnedHeading}:`);
  if (a.turningPoint) {
    const t = a.turningPoint;
    lines.push(`  ${COPY.call.you}: ${t.silence ? d.silence : `"${t.studentText ?? ""}"`}`);
    lines.push(`  ${d.textPatience} ${t.before} → ${t.after} (${formatDelta(t.delta)})`);
    lines.push(`  ${d.textReason}: ${t.reason}`);
  } else {
    lines.push(`  ${d.turnedNone}`);
  }
  lines.push("");

  lines.push(fill(d.painSummary, { found: a.pains.found.length, total: a.pains.total }));
  for (const p of a.pains.found) lines.push(`  ${d.painFound}: ${p.text}`);
  for (const p of a.pains.missed) lines.push(`  ${d.painMissed}: ${p.text} (${fill(d.painHint, { earnedBy: p.earnedBy })})`);
  lines.push("");

  lines.push(`${d.objectionsHeading}:`);
  if (!a.objections.length) lines.push(`  ${fill(d.objectionsNone, { first: a.firstName })}`);
  for (const o of a.objections) lines.push(`  "${o.line}": ${o.handled ? d.handled : d.notHandled}`);
  lines.push("");

  lines.push(`${d.askHeading}:`);
  lines.push(`  ${a.ask.made ? fill(d.askMadeText, { time: formatClock(a.ask.atMs), text: a.ask.text }) : d.askNone}`);
  lines.push("");

  lines.push(`${d.transcriptHeading}:`);
  for (const t of a.transcript) {
    const change = t.change ? `  [${d.textPatience} ${t.change.before} → ${t.change.after}, ${formatDelta(t.change.delta)}: ${t.change.reason}]` : "";
    lines.push(`[${formatClock(t.atMs)}] ${t.who}: ${t.text}${change}`);
  }
  return lines.join("\n");
}

// The Record: calls per outcome (connection drops left out) and pain points
// uncovered, call by call, oldest first. A table, not a score.
// records: saved past calls ({ savedAt, state, ctx }), newest first.
export function recordSummary(records) {
  const counted = records.filter((r) => r.state.outcome !== OUTCOMES.DROPPED);
  const byOutcome = {};
  for (const key of [OUTCOMES.MEETING_BOOKED, OUTCOMES.HUNG_UP, OUTCOMES.ASKED_NO_MEETING, OUTCOMES.NO_ASK, OUTCOMES.TIMES_UP]) {
    byOutcome[key] = counted.filter((r) => r.state.outcome === key).length;
  }
  const painRows = [...counted]
    .sort((a, b) => a.state.startedAt - b.state.startedAt)
    .map((r) => ({ startedAt: r.state.startedAt, exec: r.ctx.persona.name, found: r.state.revealedPainIds.length, total: r.ctx.persona.painPoints.length }));
  return { byOutcome, painRows, dropped: records.length - counted.length };
}
