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

  // Every ask, in order: when, how it was detected, how the exec answered, and
  // whether it booked the meeting. An ask is a student line the phrase list caught
  // (event "ask_made") or that the AI flagged in its reply (modelFlaggedAsk).
  const studentLines = state.turns.filter((t) => t.speaker === "student" && !t.events.includes("silence"));
  const asks = [];
  state.turns.forEach((t, i) => {
    if (t.speaker !== "student" || t.events.includes("silence")) return;
    const response = state.turns[i + 1]?.speaker === "exec" ? state.turns[i + 1] : null;
    const byPhrase = t.events.includes("ask_made");
    const byModel = Boolean(response?.modelFlaggedAsk);
    if (!byPhrase && !byModel) return;
    asks.push({
      number: asks.length + 1,
      text: t.text,
      atMs: at(t),
      lineNumber: studentLines.findIndex((x) => x.index === t.index) + 1,
      detectedBy: byPhrase ? "phrase" : "model",
      phrase: t.askPhrase || (t.index === state.askTurnIndex ? state.askPhrase : null),
      responseText: response?.text ?? null,
      booked: Boolean(response?.events.includes("meeting_accepted")),
    });
  });
  const ask = {
    made: asks.length > 0,
    asks,
    totalLines: studentLines.length,
    bookedAsk: asks.find((x) => x.booked)?.number ?? null,
    accepted: state.meetingBooked,
  };

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
    finalPatience: state.patience,
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

// "You asked for a meeting 3 times. Ask 3 booked the meeting."
export function askSummary(a) {
  const d = COPY.debrief;
  const count = a.ask.asks.length === 1 ? d.askCountOne : fill(d.askCountMany, { n: a.ask.asks.length });
  const booked = a.ask.bookedAsk ? fill(d.askBookedBy, { n: a.ask.bookedAsk }) : d.askNoneBooked;
  return `${count} ${booked}`;
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
  if (!a.ask.made) lines.push(`  ${d.askNone}`);
  else {
    lines.push(`  ${askSummary(a)}`);
    for (const x of a.ask.asks) {
      lines.push(`  ${fill(d.askItem, { n: x.number, time: formatClock(x.atMs), line: x.lineNumber, total: a.ask.totalLines })}: “${x.text}”`);
      if (x.responseText != null) lines.push(`    ${fill(d.askReply, { first: a.firstName, text: x.responseText })}`);
      lines.push(`    ${x.booked ? d.askBooked : d.askNotBooked}`);
    }
  }
  lines.push("");

  lines.push(`${d.transcriptHeading}:`);
  for (const t of a.transcript) {
    const change = t.change ? `  [${d.textPatience} ${t.change.before} → ${t.change.after}, ${formatDelta(t.change.delta)}: ${t.change.reason}]` : "";
    lines.push(`[${formatClock(t.atMs)}] ${t.who}: ${t.text}${change}`);
  }
  return lines.join("\n");
}

// Patience over a call, as numbers: the starting patience, then the value after each
// of the exec's reactions. Used for the small line on each Past calls card.
export function patienceSeries(state) {
  return [state.startingPatience, ...state.turns.filter((t) => t.speaker === "exec" && t.index > 0).map((t) => t.patienceAfter)];
}

// A sparkline's geometry for values on a 0–100 scale: the SVG path, the last
// point (for an end dot), and where a reference value (e.g. the meeting threshold)
// sits. pad keeps the line and dot inside the box.
export function sparkline(values, { width = 160, height = 40, pad = 3, reference = null } = {}) {
  const pts = values.length ? values : [0];
  const y = (v) => pad + ((100 - Math.max(0, Math.min(100, v))) / 100) * (height - 2 * pad);
  const x = (i) => (pts.length === 1 ? width / 2 : pad + (i * (width - 2 * pad)) / (pts.length - 1));
  const round = (n) => Math.round(n * 10) / 10;
  const d = pts.map((v, i) => `${i ? "L" : "M"}${round(x(i))} ${round(y(v))}`).join(" ");
  return {
    d,
    last: { x: round(x(pts.length - 1)), y: round(y(pts[pts.length - 1])) },
    referenceY: reference == null ? null : round(y(reference)),
  };
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
