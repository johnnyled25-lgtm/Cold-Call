// The exec gallery (open the app with ?gallery=1): every persona in every state,
// in one grid, for checking the drawing at a glance. For the owner, not students.
// No API calls.

import { mountExec } from "./exec-drawing.js";

// Each state as the call screen would show it. "Picks up" loops the lift of the
// handset so the motion can be seen; "Talking" runs the mouth loop.
export const GALLERY_STATES = [
  ["Ringing", { base: "ringing", mood: "neutral", skeptical: false, talking: false }],
  ["Picks up", { base: "on-call", mood: "neutral", skeptical: false, talking: false }, "demo-pickup"],
  ["Listening (neutral)", { base: "on-call", mood: "neutral", skeptical: false, talking: false }],
  ["Talking", { base: "on-call", mood: "neutral", skeptical: false, talking: true }],
  ["Engaged", { base: "on-call", mood: "engaged", skeptical: false, talking: false }],
  ["Impatient", { base: "on-call", mood: "impatient", skeptical: false, talking: false }],
  ["Skeptical", { base: "on-call", mood: "neutral", skeptical: true, talking: false }],
  ["Hung up", { base: "hung-up", mood: "impatient", skeptical: false, talking: false }],
  ["Meeting booked", { base: "booked", mood: "engaged", skeptical: false, talking: false }],
];

export function renderGallery(container, personas, words) {
  const el = (tag, className, text) => {
    const n = document.createElement(tag);
    if (className) n.className = className;
    if (text != null) n.textContent = text;
    return n;
  };
  const grid = el("div", "gallery-grid");
  grid.style.setProperty("--gallery-cols", String(GALLERY_STATES.length));
  grid.append(el("div", "gallery-corner"), ...GALLERY_STATES.map(([label]) => el("div", "gallery-head", label)));

  for (const persona of personas) {
    const a = persona.appearance;
    const name = el("div", "gallery-name");
    name.append(el("strong", "", persona.name), el("div", "muted small", `${a.skinTone} · ${a.hair} · ${a.hairColor} · ${a.attire}${a.glasses ? " · glasses" : ""}`));
    grid.append(name);
    for (const [label, pose, extra] of GALLERY_STATES) {
      const cell = el("div", "gallery-cell");
      cell.title = `${persona.name}: ${label}`;
      grid.append(cell);
      const exec = mountExec(cell, persona, words);
      exec.setPose(pose);
      if (extra) exec.svg.classList.add(extra);
    }
  }
  container.replaceChildren(
    el("h2", "", "Exec gallery"),
    el("p", "muted", "Every exec in every state. Colors come from the variables at the top of styles.css. Turn on your computer's reduce-motion setting to see the still versions."),
    grid,
  );
}
