// The exec gallery (open the app with ?gallery=1): every persona in every state,
// in one grid, for checking the drawing at a glance. For the owner, not students.
// No API calls.

import { mountExec } from "./exec-drawing.js";
import { loadVoices } from "./voice.js";
import { pickVoice, voiceTierLabel, deliveryFor } from "./voicePick.js";
import { BANDS } from "./constants.js";

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
  const voiceLines = [];
  grid.style.setProperty("--gallery-cols", String(GALLERY_STATES.length));
  grid.append(el("div", "gallery-corner"), ...GALLERY_STATES.map(([label]) => el("div", "gallery-head", label)));

  for (const persona of personas) {
    const a = persona.appearance;
    const name = el("div", "gallery-name");
    const voiceLine = el("div", "small gallery-voice", "Voice: checking…");
    voiceLines.push([persona, voiceLine]);
    name.append(el("strong", "", persona.name), el("div", "muted small", `${a.skinTone} · ${a.hair} · ${a.hairColor} · ${a.attire}${a.glasses ? " · glasses" : ""}`), voiceLine);
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
  // Still poses by default: 45 animated drawings at once is a lot of work for a
  // computer without graphics acceleration. The button turns animation on and off.
  const toggle = el("button", "btn", "Play animations");
  toggle.type = "button";
  toggle.setAttribute("aria-pressed", "false");
  grid.classList.add("gallery-static");
  toggle.addEventListener("click", () => {
    const playing = grid.classList.toggle("gallery-static") === false;
    toggle.textContent = playing ? "Stop animations" : "Play animations";
    toggle.setAttribute("aria-pressed", String(playing));
  });
  // The voice each exec gets in THIS browser (voices differ between Edge, Chrome, and
  // computers), with its rate and pitch, and how an impatient exec sounds.
  loadVoices().then((voices) => {
    for (const [persona, line] of voiceLines) {
      const pick = pickVoice(voices, persona);
      const impatient = deliveryFor(pick, BANDS.IMPATIENT_BELOW - 1);
      line.textContent = `Voice: ${pick.voice?.name || "browser default"} (${voiceTierLabel(pick.voice)}) · rate ${pick.rate}, pitch ${pick.pitch}; impatient: rate ${impatient.rate}, pitch ${impatient.pitch}`;
    }
  });
  container.replaceChildren(
    el("h2", "", "Exec gallery"),
    el("p", "muted small", "Voices shown are the ones this browser picks. Edge's “Natural” voices rank first, then Google's, then any other; the exec's voice type (male/female) comes first where the browser has a match."),
    el("p", "muted", "Every exec in every state, shown still. Use Play animations to see them move. Colors come from the variables at the top of styles.css."),
    toggle,
    grid,
  );
}
