// Draws the debrief (brief §4.9) and the Past calls screen (§4.10) from debrief.js.
// Every piece of text is set with textContent or setAttribute, never as HTML.

import { COPY, fill } from "./copy.js";
import { ACCEPTANCE_THRESHOLD, OUTCOMES } from "./constants.js";
import { formatClock, formatDelta, recordSummary } from "./debrief.js";

const d = COPY.debrief;

// Outcomes carry an icon AND a word, so they never depend on color alone.
export const OUTCOME_ICON = {
  [OUTCOMES.MEETING_BOOKED]: "✓", [OUTCOMES.HUNG_UP]: "✕", [OUTCOMES.ASKED_NO_MEETING]: "–",
  [OUTCOMES.NO_ASK]: "–", [OUTCOMES.TIMES_UP]: "⏱", [OUTCOMES.DROPPED]: "!",
};

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  if (props.className) node.className = props.className;
  if (props.text != null) node.textContent = props.text;
  if (props.attrs) for (const [k, v] of Object.entries(props.attrs)) node.setAttribute(k, v);
  for (const child of [].concat(children)) if (child != null && child !== false) node.append(child);
  return node;
}

const SVG_NS = "http://www.w3.org/2000/svg";
function svgEl(tag, attrs = {}, text = null) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  if (text != null) node.textContent = text;
  return node;
}

function outcomeBadge(outcome) {
  return el("span", { className: `outcome-badge outcome-${outcome}` }, [
    el("span", { className: "outcome-icon", text: OUTCOME_ICON[outcome] || "", attrs: { "aria-hidden": "true" } }),
    ` ${COPY.outcomes[outcome] || ""}`,
  ]);
}

function section(heading, children, className = "") {
  return el("section", { className: `card debrief-section ${className}` }, [el("h3", { text: heading }), ...[].concat(children)]);
}

const quoteLine = (change) => (change.silence ? d.silence : change.studentText != null ? `${COPY.call.you}: “${change.studentText}”` : null);

// ---------------------------------------------------------------------------
// The patience chart: one line, hand-drawn SVG, with a tooltip per point.
// ---------------------------------------------------------------------------
export function buildPatienceChart(a) {
  const W = 640, H = 240;
  const m = { l: 40, r: 24, t: 20, b: 30 };
  const plotW = W - m.l - m.r, plotH = H - m.t - m.b;
  const n = a.chart.length;
  const x = (i) => m.l + (n <= 1 ? plotW / 2 : (i * plotW) / (n - 1));
  const y = (p) => m.t + ((100 - p) / 100) * plotH;

  const wrap = el("div", { className: "chart-wrap" });
  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, class: "patience-chart", role: "group", "aria-label": d.chartHeading });

  // Recessive grid and axis labels.
  for (const v of [0, 25, 50, 75, 100]) {
    svg.append(svgEl("line", { class: "chart-grid", x1: m.l, x2: W - m.r, y1: y(v), y2: y(v) }));
    svg.append(svgEl("text", { class: "chart-axis", x: m.l - 8, y: y(v) + 4, "text-anchor": "end" }, String(v)));
  }
  svg.append(svgEl("text", { class: "chart-axis", x: x(0), y: H - 8, "text-anchor": n <= 1 ? "middle" : "start" }, d.chartStart));

  // Where a meeting becomes possible.
  svg.append(svgEl("line", { class: "chart-threshold", x1: m.l, x2: W - m.r, y1: y(ACCEPTANCE_THRESHOLD), y2: y(ACCEPTANCE_THRESHOLD) }));
  svg.append(svgEl("text", { class: "chart-axis", x: W - m.r, y: y(ACCEPTANCE_THRESHOLD) - 6, "text-anchor": "end" }, fill(d.chartThreshold, { value: ACCEPTANCE_THRESHOLD })));

  const crosshair = svgEl("line", { class: "chart-crosshair", x1: 0, x2: 0, y1: m.t, y2: H - m.b, visibility: "hidden" });
  svg.append(crosshair);

  // The line itself (2px).
  svg.append(svgEl("path", { class: "chart-line", d: a.chart.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.patience).toFixed(1)}`).join(" ") }));

  // Markers: shape AND color show the direction (down triangle = drop, up = gain,
  // circle = no change, hollow = technical retry), so color is never the only cue.
  const marks = svgEl("g", { class: "chart-marks" });
  a.chart.forEach((p, i) => {
    const cx = x(i), cy = y(p.patience), s = 6.5;
    const c = p.change;
    if (!c) marks.append(svgEl("circle", { class: "marker marker-start", cx, cy, r: 5 }));
    else if (c.retry) marks.append(svgEl("circle", { class: "marker marker-retry", cx, cy, r: 5 }));
    else if (c.delta < 0) marks.append(svgEl("polygon", { class: "marker marker-drop", points: `${cx - s},${cy - s * 0.6} ${cx + s},${cy - s * 0.6} ${cx},${cy + s * 0.9}` }));
    else if (c.delta > 0) marks.append(svgEl("polygon", { class: "marker marker-gain", points: `${cx - s},${cy + s * 0.6} ${cx + s},${cy + s * 0.6} ${cx},${cy - s * 0.9}` }));
    else marks.append(svgEl("circle", { class: "marker marker-flat", cx, cy, r: 4.5 }));
  });
  svg.append(marks);

  // One direct label, on the turning point only.
  if (a.turningPoint) {
    const i = a.chart.findIndex((p) => p.change === a.turningPoint);
    const cx = x(i), cy = y(a.turningPoint.after);
    const anchor = cx > W - 140 ? "end" : cx < m.l + 100 ? "start" : "middle";
    // Below the point (the line arrives from above on a drop), unless that runs off the chart.
    const below = cy + 24 <= H - m.b + 6;
    svg.append(svgEl("text", { class: "chart-label", x: cx, y: below ? cy + 24 : cy - 14, "text-anchor": anchor }, d.chartTurnLabel));
  }

  // Tooltip: shown on hover or keyboard focus. Hit targets are bigger than the marks.
  const tip = el("div", { className: "chart-tip", attrs: { role: "status" } });
  tip.hidden = true;
  const show = (i) => {
    const p = a.chart[i];
    const c = p.change;
    const lines = [quoteLine(c), `${a.firstName}: “${c.execText}”`, fill(d.patienceMove, { before: c.before, after: c.after, delta: formatDelta(c.delta) }), `${d.reasonLabel}: ${c.reason}`].filter(Boolean);
    tip.replaceChildren(...lines.map((t, k) => el("div", { className: k === 2 ? "tip-strong" : "", text: t })));
    tip.hidden = false;
    crosshair.setAttribute("x1", x(i));
    crosshair.setAttribute("x2", x(i));
    crosshair.setAttribute("visibility", "visible");
    // Position above the point, kept inside the chart.
    const box = svg.getBoundingClientRect();
    const scale = box.width / W;
    const tipW = tip.offsetWidth;
    const left = Math.min(Math.max(x(i) * scale, tipW / 2 + 4), box.width - tipW / 2 - 4);
    tip.style.left = `${left}px`;
    tip.style.top = `${y(p.patience) * scale}px`;
    tip.classList.toggle("tip-below", y(p.patience) * scale < tip.offsetHeight + 12);
  };
  const hide = () => { tip.hidden = true; crosshair.setAttribute("visibility", "hidden"); };

  a.chart.forEach((p, i) => {
    if (!p.change) return;
    const c = p.change;
    const label = fill(d.chartPointLabel, {
      n: i, before: c.before, after: c.after, delta: formatDelta(c.delta),
      line: quoteLine(c) ? `${quoteLine(c)}.` : "", reason: c.reason,
    });
    const hit = svgEl("circle", { class: "chart-hit", cx: x(i), cy: y(p.patience), r: 14, tabindex: 0, role: "img", "aria-label": label });
    hit.addEventListener("pointerenter", () => show(i));
    hit.addEventListener("focus", () => show(i));
    hit.addEventListener("pointerleave", hide);
    hit.addEventListener("blur", hide);
    svg.append(hit);
  });

  wrap.append(svg, tip);
  return wrap;
}

// ---------------------------------------------------------------------------
// The debrief, in the brief's order
// ---------------------------------------------------------------------------
// handlers: { onCallAgain, onCopy } ; transcriptText: the plain-text version.
export function renderDebrief(container, a, { onCallAgain, onCopy, transcriptText }) {
  const first = a.firstName;

  // 1. Outcome
  const outcome = el("div", { className: `card outcome-block outcome-${a.outcome}` }, [
    el("p", { className: "outcome" }, outcomeBadge(a.outcome)),
    el("p", { text: a.outcomeLine }),
  ]);

  // 2. Who you called
  const who = section(d.whoHeading, [
    el("p", {}, [el("strong", { text: `${a.persona.name}, ${a.persona.title}, ${a.persona.company}` })]),
    el("p", { text: fill(d.whoYouCalled, { name: first, mood: a.mood.label, start: a.startingPatience }) }),
    el("p", { className: "muted", text: `${fill(d.personalityLabel, { first })}: ${a.persona.personality}` }),
  ]);

  // 3. Patience over the call
  const callAgainNear = el("button", { className: "btn", text: d.callAgain, attrs: { type: "button" } });
  callAgainNear.addEventListener("click", onCallAgain);
  const chart = section(d.chartHeading, [
    el("p", { className: "muted small", text: fill(d.chartCaption, { first }) }),
    buildPatienceChart(a),
    el("div", { className: "judgment-row" }, [el("p", { className: "muted", text: d.judgmentNote }), callAgainNear]),
  ]);

  // 4. Where the call turned
  const t = a.turningPoint;
  const turned = section(d.turnedHeading, t
    ? [
        el("blockquote", { text: quoteLine(t) || "" }),
        el("p", { className: "turn-move", text: fill(d.patienceMove, { before: t.before, after: t.after, delta: formatDelta(t.delta) }) }),
        el("p", {}, [el("strong", { text: `${d.reasonLabel}: ` }), t.reason]),
      ]
    : [el("p", { text: d.turnedNone })]);

  // 5. Pain points
  const pains = section(d.painsHeading, [
    el("p", { text: fill(d.painSummary, { found: a.pains.found.length, total: a.pains.total }) }),
    el("ul", { className: "plain-list" }, [
      ...a.pains.found.map((p) => el("li", {}, [el("strong", { text: `${d.painFound}: ` }), p.text])),
      ...a.pains.missed.map((p) => el("li", {}, [el("strong", { text: `${d.painMissed}: ` }), `${p.text} `, el("span", { className: "muted", text: `(${fill(d.painHint, { earnedBy: p.earnedBy })})` })])),
    ]),
  ]);

  // 6. Objections
  const objections = section(d.objectionsHeading, a.objections.length
    ? el("ul", { className: "plain-list" }, a.objections.map((o) =>
        el("li", {}, [
          `“${o.line}” `,
          el("strong", { text: o.handled ? d.handled : d.notHandled }),
          !o.handled && o.whatHandlesIt ? el("div", { className: "muted small", text: fill(d.whatWorks, { text: o.whatHandlesIt }) }) : null,
        ])))
    : el("p", { text: fill(d.objectionsNone, { first }) }));

  // 7. The ask
  const ask = a.ask;
  const askSection = section(d.askHeading, ask.made
    ? [
        el("p", { text: fill(d.askMadeText, { time: formatClock(ask.atMs), text: ask.text }) }),
        el("p", { className: "muted small", text: `${fill(d.askLine, { n: ask.lineNumber, total: ask.totalLines })} ${ask.detectedBy === "phrase" ? fill(d.askByPhrase, { phrase: ask.phrase }) : d.askByModel}` }),
        ask.responseText ? el("p", { text: fill(d.askResponse, { first, text: ask.responseText }) }) : null,
        el("p", { text: fill(ask.accepted ? d.askAccepted : d.askDeclined, { first }) }),
      ]
    : [el("p", { text: d.askNone })]);

  // 8. Plain facts
  const f = a.facts;
  const facts = section(d.factsHeading, el("ul", { className: "plain-list" }, [
    el("li", { text: fill(d.factLength, { time: formatClock(f.durationMs) }) }),
    el("li", { text: fill(d.factLines, { n: f.studentLines }) }),
    el("li", { text: fill(d.factShare, { pct: f.studentWordShare }) }),
    f.silences ? el("li", { text: fill(d.factSilences, { n: f.silences }) }) : null,
    f.retries ? el("li", { text: fill(d.factRetries, { n: f.retries }) }) : null,
    f.voiceLines ? el("li", { text: fill(d.factVoice, { n: f.voiceLines }) }) : null,
  ]));

  // 9. Full transcript, with Copy transcript
  const copyStatus = el("span", { className: "muted small copy-status", attrs: { role: "status" } });
  const copyBtn = el("button", { className: "btn", text: d.copyTranscript, attrs: { type: "button" } });
  copyBtn.addEventListener("click", async () => { copyStatus.textContent = (await onCopy()) ? d.copied : d.copyFailed; });
  const transcript = section(d.transcriptHeading, [
    el("div", { className: "actions" }, [copyBtn, copyStatus]),
    el("ol", { className: "debrief-transcript" }, a.transcript.map((line) =>
      el("li", { className: `line line-${line.speaker}` }, [
        el("span", { className: "muted small", text: `[${formatClock(line.atMs)}] ` }),
        line.inputMode === "voice" ? el("span", { className: "mic", text: "🎤 ", attrs: { "aria-hidden": "true" } }) : null,
        el("span", { className: "line-who", text: `${line.who}: ` }),
        line.text,
        line.change ? el("div", { className: "muted small", text: `${fill(d.patienceMove, { before: line.change.before, after: line.change.after, delta: formatDelta(line.change.delta) })}. ${line.change.reason || ""}` }) : null,
      ]))),
    el("details", { className: "plain-text" }, [el("summary", { className: "muted small", text: d.copyTranscript }), el("pre", { text: transcriptText })]),
  ]);

  container.replaceChildren(outcome, who, chart, turned, pains, objections, askSection, facts, transcript);
}

// ---------------------------------------------------------------------------
// Past calls and the Record
// ---------------------------------------------------------------------------
// records: newest first. onOpen(record) reopens a debrief. formatDate(ms) → text.
export function renderPastCalls(container, records, { onOpen, formatDate }) {
  const p = COPY.pastCalls;
  if (!records.length) {
    container.replaceChildren(el("p", { className: "muted", text: p.note }), el("p", { className: "card", text: p.empty }));
    return;
  }

  const rows = records.map((r) => {
    const open = el("button", { className: "link-button", text: p.open, attrs: { type: "button" } });
    open.addEventListener("click", () => onOpen(r));
    const length = formatClock((r.state.endedAt ?? r.state.startedAt) - r.state.startedAt);
    return el("tr", {}, [
      el("td", { text: formatDate(r.state.startedAt) }),
      el("td", { text: `${r.ctx.persona.name}, ${r.ctx.persona.company}` }),
      el("td", {}, outcomeBadge(r.state.outcome)),
      el("td", { className: "num", text: length }),
      el("td", {}, open),
    ]);
  });
  const list = el("div", { className: "table-wrap" }, el("table", { className: "turns" }, [
    el("thead", {}, el("tr", {}, [
      ...[p.colDate, p.colExec, p.colOutcome, p.colLength].map((h) => el("th", { text: h })),
      el("th", {}, el("span", { className: "visually-hidden", text: p.colOpen })),
    ])),
    el("tbody", {}, rows),
  ]));

  const summary = recordSummary(records);
  const outcomeRows = Object.entries(summary.byOutcome).map(([outcome, count]) =>
    el("tr", {}, [el("td", {}, outcomeBadge(outcome)), el("td", { className: "num", text: String(count) })]));
  const painRows = summary.painRows.map((r) =>
    el("tr", {}, [el("td", { text: formatDate(r.startedAt) }), el("td", { text: r.exec }), el("td", { className: "num", text: fill(p.painsCell, { found: r.found, total: r.total }) })]));

  container.replaceChildren(
    el("p", { className: "muted", text: p.note }),
    list,
    el("h3", { text: p.recordHeading }),
    el("p", { className: "muted small", text: p.recordNote }),
    el("div", { className: "table-wrap" }, el("table", { className: "turns record-table" }, [
      el("thead", {}, el("tr", {}, [p.colOutcome, p.colCalls].map((h) => el("th", { text: h })))),
      el("tbody", {}, outcomeRows),
    ])),
    el("h3", { text: p.painsHeading }),
    el("div", { className: "table-wrap" }, el("table", { className: "turns record-table" }, [
      el("thead", {}, el("tr", {}, [p.colDate, p.colExec, p.colPains].map((h) => el("th", { text: h })))),
      el("tbody", {}, painRows),
    ])),
  );
}
