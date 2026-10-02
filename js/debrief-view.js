// Draws the debrief (brief §4.9) and the Past calls screen (§4.10) from debrief.js.
// Every piece of text is set with textContent or setAttribute, never as HTML.

import { COPY, fill } from "./copy.js";
import { ACCEPTANCE_THRESHOLD, OUTCOMES } from "./constants.js";
import { formatClock, formatDelta, recordSummary, askSummary, patienceSeries, sparkline } from "./debrief.js";
import { mountExec, buildExecPortraitSvg } from "./exec-drawing.js";
import { iconEl } from "./icons.js";
import { outcomePose } from "./pose.js";

// c: the resolved copy for the call currently being drawn (copyFor(mode)), d: its
// "debrief" section. Both default to COPY (B2B) and are reassigned at the top of
// renderDebrief/renderPastCalls, before any of the helper functions below run — so
// every helper in this file sees the right mode's words without taking its own
// "copy" parameter.
let c = COPY;
let d = COPY.debrief;
let threshold = ACCEPTANCE_THRESHOLD; // the chart/sparkline's dashed line; B2C uses its own number

// Outcomes carry an icon AND a word, so they never depend on color alone.
export const OUTCOME_ICON = {
  [OUTCOMES.MEETING_BOOKED]: "✓", [OUTCOMES.HUNG_UP]: "✕", [OUTCOMES.ASKED_NO_MEETING]: "–",
  [OUTCOMES.NO_ASK]: "–", [OUTCOMES.TIMES_UP]: "⏱", [OUTCOMES.DROPPED]: "!",
  [OUTCOMES.SALE_CLOSED]: "✓", [OUTCOMES.ASKED_NO_SALE]: "–",
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
    ` ${c.outcomes[outcome] || ""}`,
  ]);
}

function section(heading, children, className = "", icon = null) {
  const h = el("h3", { className: "section-head" }, [icon ? iconEl(icon) : null, heading]);
  return el("section", { className: `card debrief-section ${className}` }, [h, ...[].concat(children)]);
}

// A patience change as a chip: "−22" on red, "+8" on green, "0" plain. The sign is
// always in the text, so the color is never the only cue.
function deltaChip(delta) {
  const kind = delta < 0 ? "neg" : delta > 0 ? "pos" : "zero";
  return el("span", { className: `delta-chip delta-${kind}`, text: formatDelta(delta) });
}

function portraitOf(persona, idPrefix, size = "") {
  const box = el("div", { className: `avatar ${size}`.trim() });
  box.innerHTML = buildExecPortraitSvg(persona.appearance, { idPrefix }); // our own fixed markup
  return box;
}

const quoteLine = (change) => (change.silence ? d.silence : change.studentText != null ? `${c.call.you}: “${change.studentText}”` : null);

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
  svg.append(svgEl("line", { class: "chart-threshold", x1: m.l, x2: W - m.r, y1: y(threshold), y2: y(threshold) }));
  svg.append(svgEl("text", { class: "chart-axis", x: W - m.r, y: y(threshold) - 6, "text-anchor": "end" }, fill(d.chartThreshold, { value: threshold })));

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
// copy: the resolved copy for this call's mode (copyFor(mode)); acceptanceThreshold:
// that mode's threshold (ACCEPTANCE_THRESHOLD or B2C_ACCEPTANCE_THRESHOLD). Both
// default to B2B so existing callers are unaffected.
export function renderDebrief(container, a, { onCallAgain, onNewExec, onPastCalls, onCopy, transcriptText, copy = COPY, acceptanceThreshold = ACCEPTANCE_THRESHOLD }) {
  c = copy;
  d = copy.debrief;
  threshold = acceptanceThreshold;
  const first = a.firstName;

  // What to do next, right in the banner (no scrolling to the bottom).
  function bannerActions() {
    const again = el("button", { className: "btn btn-primary", text: d.callAgain, attrs: { type: "button", title: d.callAgainHint } });
    again.addEventListener("click", onCallAgain);
    const fresh = el("button", { className: "btn", text: d.newExec, attrs: { type: "button" } });
    fresh.addEventListener("click", onNewExec);
    const past = el("button", { className: "btn", text: c.pastCalls.navLink, attrs: { type: "button" } });
    past.addEventListener("click", onPastCalls);
    return el("div", { className: "banner-actions" }, [again, fresh, past]);
  }

  // 1. Outcome: a banner with the exec in their final pose (writing the note, or the
  // phone back on the desk), the outcome word with its icon, and three plain facts.
  const art = el("div", { className: "outcome-art" });
  mountExec(art, a.persona, c.exec.describe).setPose(outcomePose(a.outcome, a.finalPatience));
  const outcome = el("section", { className: `outcome-banner outcome-${a.outcome}`, attrs: { "aria-label": d.outcomeEyebrow } }, [
    art,
    el("div", { className: "outcome-text" }, [
      el("div", { className: "eyebrow", text: d.outcomeEyebrow }),
      el("p", { className: "outcome outcome-word" }, outcomeBadge(a.outcome)),
      el("p", { className: "outcome-line", text: a.outcomeLine }),
      el("div", { className: "outcome-facts" }, [
        el("span", { className: "pill", text: fill(d.bannerLength, { time: formatClock(a.facts.durationMs) }) }),
        el("span", { className: "pill", text: fill(d.bannerPains, { found: a.pains.found.length, total: a.pains.total }) }),
        el("span", { className: "pill", text: fill(d.bannerAsks, { n: a.ask.asks.length }) }),
      ]),
      bannerActions(),
    ]),
  ]);

  // 2. Who you called: portrait, name, today's mood, and what they're like.
  const who = section(d.whoHeading, [
    el("div", { className: "who-row" }, [
      portraitOf(a.persona, "pw", "who-avatar"),
      el("div", {}, [
        el("strong", { className: "who-name", text: a.persona.name }),
        el("div", { className: "muted", text: `${a.persona.title} · ${a.persona.company}` }),
        el("div", { className: "who-pills" }, [
          el("span", { className: "pill", text: fill(d.moodPill, { mood: a.mood.label }) }),
          el("span", { className: "pill", text: fill(d.startPill, { start: a.startingPatience }) }),
        ]),
      ]),
    ]),
    el("p", { className: "who-personality" }, [el("strong", { text: `${fill(d.personalityLabel, { first })}: ` }), a.persona.personality]),
  ], "", "person");

  // 3. Patience over the call
  const callAgainNear = el("button", { className: "btn", text: d.callAgain, attrs: { type: "button" } });
  callAgainNear.addEventListener("click", onCallAgain);
  const chart = section(d.chartHeading, [
    el("p", { className: "muted small", text: fill(d.chartCaption, { first }) }),
    buildPatienceChart(a),
    el("div", { className: "judgment-row" }, [el("p", { className: "muted", text: d.judgmentNote }), callAgainNear]),
  ], "", "chart");

  // 4. Where the call turned: your line as a pull-quote, the exec's reaction, the drop.
  const t = a.turningPoint;
  const turned = section(d.turnedHeading, t
    ? el("div", { className: "turn-grid" }, [
        el("figure", { className: "turn-quote" }, [
          el("blockquote", { text: t.silence ? d.silence : `“${t.studentText ?? ""}”` }),
          el("figcaption", { className: "muted small", text: c.call.you }),
        ]),
        el("div", { className: "turn-side" }, [
          el("div", { className: "turn-react" }, [
            portraitOf(a.persona, "pt", "turn-avatar"),
            el("div", { className: "bubble bubble-exec" }, [el("span", { className: "meta", text: first }), t.execText]),
          ]),
          el("div", { className: "turn-move", attrs: { "aria-label": fill(d.patienceMove, { before: t.before, after: t.after, delta: formatDelta(t.delta) }) } }, [
            el("span", { className: "turn-label muted small", text: d.turnPatience }),
            el("span", { className: "turn-num", text: String(t.before) }),
            el("span", { className: "turn-arrow", text: "→", attrs: { "aria-hidden": "true" } }),
            el("span", { className: "turn-num turn-after", text: String(t.after) }),
            deltaChip(t.delta),
          ]),
        ]),
        el("p", { className: "turn-reason" }, [el("strong", { text: `${d.reasonLabel}: ` }), t.reason]),
      ])
    : el("p", { text: d.turnedNone }), "", "turn");

  // 5. Pain points: a checklist. Found: green check. Missed: a hint card.
  const pains = section(d.painsHeading, [
    el("p", { text: fill(d.painSummary, { found: a.pains.found.length, total: a.pains.total }) }),
    el("ul", { className: "checklist" }, [
      ...a.pains.found.map((p) => el("li", { className: "item-found" }, [
        iconEl("check"),
        el("div", {}, [el("span", { className: "visually-hidden", text: `${d.painFound}: ` }), p.text]),
      ])),
      ...a.pains.missed.map((p) => el("li", { className: "item-missed" }, [
        iconEl("hint"),
        el("div", {}, [
          el("span", { className: "visually-hidden", text: `${d.painMissed}: ` }),
          el("span", { className: "missed-text", text: p.text }),
          el("div", { className: "hint-card", text: fill(d.painHintCard, { earnedBy: p.earnedBy }) }),
        ]),
      ])),
    ]),
  ], "", "know");

  // 6. Objections: each one with a Handled / Not handled chip, and what tends to work.
  const objections = section(d.objectionsHeading, a.objections.length
    ? el("ul", { className: "checklist" }, a.objections.map((o) =>
        el("li", { className: o.handled ? "item-found" : "item-open" }, [
          iconEl(o.handled ? "check" : "cross"),
          el("div", {}, [
            el("span", { className: "objection-line", text: `“${o.line}”` }),
            el("span", { className: `status-chip ${o.handled ? "status-ok" : "status-open"}`, text: o.handled ? d.handled : d.notHandled }),
            !o.handled && o.whatHandlesIt ? el("div", { className: "hint-card", text: fill(d.whatWorks, { text: o.whatHandlesIt }) }) : null,
          ]),
        ])))
    : el("p", { text: fill(d.objectionsNone, { first }) }), "", "shield");

  // 7. The ask: every ask in order, with the exec's reply, and which one booked the meeting.
  const ask = a.ask;
  const askSection = section(d.askHeading, ask.made
    ? [
        el("p", { text: askSummary(a, c) }),
        el("ol", { className: "ask-list" }, ask.asks.map((x) =>
          el("li", { className: x.booked ? "ask-booked" : "" }, [
            el("div", {}, [el("strong", { text: fill(d.askItem, { n: x.number, time: formatClock(x.atMs), line: x.lineNumber, total: ask.totalLines }) }), `: “${x.text}”`]),
            el("div", { className: "muted small", text: x.detectedBy === "phrase" && x.phrase ? fill(d.askByPhrase, { phrase: x.phrase }) : d.askByModel }),
            x.responseText != null ? el("div", { text: fill(d.askReply, { first, text: x.responseText }) }) : null,
            x.booked
              ? el("div", { className: `outcome-badge outcome-${a.outcome}` }, [el("span", { className: "outcome-icon", text: "✓", attrs: { "aria-hidden": "true" } }), ` ${d.askBooked}`])
              : el("div", { className: "muted small", text: d.askNotBooked }),
          ]))),
      ]
    : [el("p", { text: d.askNone })], "", "calendar");

  // 8. Plain facts, as tiles: a number and what it is. No scores.
  const f = a.facts;
  const tile = (value, label) => el("div", { className: "fact-tile" }, [el("span", { className: "fact-value", text: value }), el("span", { className: "fact-label", text: label })]);
  const facts = section(d.factsHeading, el("div", { className: "fact-tiles" }, [
    tile(formatClock(f.durationMs), d.tileLength),
    tile(String(f.studentLines), d.tileLines),
    tile(`${f.studentWordShare}%`, d.tileShare),
    f.silences ? tile(String(f.silences), d.tileSilences) : null,
    f.retries ? tile(String(f.retries), d.tileRetries) : null,
    f.voiceLines ? tile(String(f.voiceLines), d.tileVoice) : null,
  ]), "", "list");

  // 9. Full transcript: chat bubbles like the call, with each patience change under the exec's line.
  const copyStatus = el("span", { className: "muted small copy-status", attrs: { role: "status" } });
  const copyBtn = el("button", { className: "btn", text: d.copyTranscript, attrs: { type: "button" } });
  copyBtn.addEventListener("click", async () => { copyStatus.textContent = (await onCopy()) ? d.copied : d.copyFailed; });
  const transcript = section(d.transcriptHeading, [
    el("div", { className: "actions" }, [copyBtn, copyStatus]),
    el("ol", { className: "debrief-chat" }, a.transcript.map((line) => {
      const silent = Boolean(line.silence);
      const meta = el("span", { className: "meta" }, [
        line.inputMode === "voice" ? el("span", { className: "mic", text: "🎤 ", attrs: { "aria-hidden": "true" } }) : null,
        `${line.who} · ${formatClock(line.atMs)}`,
      ]);
      return el("li", { className: `debrief-turn debrief-turn-${line.speaker}` }, [
        el("div", { className: `bubble ${silent ? "bubble-silence" : `bubble-${line.speaker}`}` }, [meta, el("span", { className: "visually-hidden", text: ": " }), line.text]),
        line.change
          ? el("div", { className: "turn-change" }, [
              deltaChip(line.change.delta),
              el("span", { className: "turn-change-move", text: `${line.change.before} → ${line.change.after}` }),
              el("span", { className: "muted", text: line.change.reason || "" }),
            ])
          : null,
      ]);
    })),
    el("details", { className: "plain-text" }, [el("summary", { className: "muted small", text: d.copyTranscript }), el("pre", { text: transcriptText })]),
  ], "", "chat");

  container.replaceChildren(outcome, who, chart, turned, pains, objections, askSection, facts, transcript);
}

// ---------------------------------------------------------------------------
// Past calls and the Record
// ---------------------------------------------------------------------------
// records: newest first. onOpen(record) reopens a debrief. formatDate(ms) → text.
// copy/acceptanceThreshold: the one mode these records belong to (Past calls shows
// one mode at a time); both default to B2B.
export function renderPastCalls(container, records, { onOpen, formatDate, onStart, copy = COPY, acceptanceThreshold = ACCEPTANCE_THRESHOLD, outcomeKeys }) {
  c = copy;
  threshold = acceptanceThreshold;
  const p = c.pastCalls;
  if (!records.length) {
    const start = el("button", { className: "btn btn-primary btn-big", attrs: { type: "button" } }, [iconEl("phone"), el("span", { text: p.emptyStart })]);
    start.addEventListener("click", onStart);
    container.replaceChildren(
      el("div", { className: "empty-state" }, [
        el("div", { className: "empty-icon" }, iconEl("chat")),
        el("h3", { text: p.emptyTitle }),
        el("p", { className: "muted", text: p.emptyText }),
        start,
      ]),
      el("p", { className: "muted small empty-note", text: p.note }),
    );
    return;
  }

  // One card per call: portrait, exec, date, outcome, a small patience line, and
  // facts. The whole card opens the debrief (its "Open debrief" button stretches
  // over the card, so keyboard and screen readers get one clear button).
  const cards = records.map((r, i) => {
    const persona = r.ctx.persona;
    const length = formatClock((r.state.endedAt ?? r.state.startedAt) - r.state.startedAt);
    const series = patienceSeries(r.state);
    const spark = sparkline(series, { width: 220, height: 44, reference: threshold });
    const sparkSvg = svgEl("svg", { viewBox: "0 0 220 44", class: "spark", "aria-hidden": "true", preserveAspectRatio: "none" });
    sparkSvg.append(
      svgEl("line", { class: "spark-ref", x1: 0, x2: 220, y1: spark.referenceY, y2: spark.referenceY }),
      svgEl("path", { class: "spark-line", d: spark.d }),
      svgEl("circle", { class: `spark-end spark-end-${r.state.outcome}`, cx: spark.last.x, cy: spark.last.y, r: 3.5 }),
    );
    const portrait = el("div", { className: "avatar" });
    portrait.innerHTML = buildExecPortraitSvg(persona.appearance, { idPrefix: `pk${i}` }); // our own fixed markup

    const open = el("button", { className: "card-open", text: p.open, attrs: {
      type: "button",
      "aria-label": `${p.open}: ${fill(p.cardAria, { name: persona.name, outcome: c.outcomes[r.state.outcome] || "", date: formatDate(r.state.startedAt) })}`,
    } });
    open.addEventListener("click", () => onOpen(r));

    return el("li", { className: `call-card call-card-${r.state.outcome}` }, [
      el("div", { className: "call-card-head" }, [
        portrait,
        el("div", { className: "call-card-who" }, [
          el("strong", { text: persona.name }),
          el("span", { className: "muted small", text: persona.company }),
        ]),
      ]),
      outcomeBadge(r.state.outcome),
      el("div", { className: "spark-wrap" }, [
        sparkSvg,
        el("span", { className: "visually-hidden", text: fill(p.cardSpark, { start: series[0], end: series[series.length - 1] }) }),
      ]),
      el("div", { className: "call-card-facts" }, [
        el("span", { className: "muted small call-card-date", text: formatDate(r.state.startedAt) }),
        el("span", { className: "pill", text: length }),
        el("span", { className: "pill", text: fill(p.cardPains, { found: r.state.revealedPainIds.length, total: persona.painPoints.length }) }),
        open,
      ]),
    ]);
  });
  const list = el("ul", { className: "call-cards" }, cards);

  const summary = recordSummary(records, outcomeKeys);
  const outcomeRows = Object.entries(summary.byOutcome).map(([outcome, count]) =>
    el("tr", {}, [el("td", {}, outcomeBadge(outcome)), el("td", { className: "num", text: String(count) })]));
  const painRows = summary.painRows.map((r) =>
    el("tr", {}, [el("td", { text: formatDate(r.startedAt) }), el("td", { text: r.exec }), el("td", { className: "num", text: fill(p.painsCell, { found: r.found, total: r.total }) })]));

  // The Record: counts only, as tables (never a score), in two matching cards.
  container.replaceChildren(
    el("p", { className: "muted", text: p.note }),
    list,
    el("h3", { className: "record-head" }, [iconEl("list"), p.recordHeading]),
    el("p", { className: "muted small", text: p.recordNote }),
    el("div", { className: "record-grid" }, [
      el("div", { className: "record-card" }, el("table", { className: "record-table" }, [
        el("thead", {}, el("tr", {}, [p.colOutcome, p.colCalls].map((h) => el("th", { text: h })))),
        el("tbody", {}, outcomeRows),
      ])),
      el("div", { className: "record-card" }, [
        el("h4", { text: p.painsHeading }),
        el("table", { className: "record-table" }, [
          el("thead", {}, el("tr", {}, [p.colDate, p.colExec, p.colPains].map((h) => el("th", { text: h })))),
          el("tbody", {}, painRows),
        ]),
      ]),
    ]),
  );
}
