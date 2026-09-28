// What the drawn exec is doing right now. Pure; no DOM.
// Body language is the only mid-call cue the student gets, so it comes ONLY from the
// hidden patience band (bands.js) and never contradicts it.

import { OUTCOMES } from "./constants.js";
import { patienceBand } from "./bands.js";

// phase: "ringing" | "live" | "done". state: the call state (null while ringing).
// speaking: the exec's voice is playing.
// Returns { base, mood, skeptical, talking }:
//   base: "ringing" | "on-call" | "hung-up" | "booked"
//   mood: "engaged" | "neutral" | "impatient" (from the patience band)
export function execPose({ phase, state, speaking = false }) {
  if (phase === "ringing" || !state) {
    return { base: "ringing", mood: "neutral", skeptical: false, talking: false };
  }
  const mood = patienceBand(state.patience);

  let base = "on-call";
  if (state.ended && state.outcome === OUTCOMES.MEETING_BOOKED) base = "booked";
  // The exec says the parting line first, then lowers the phone.
  else if (state.ended && !speaking) base = "hung-up";

  const lastExec = [...state.turns].reverse().find((t) => t.speaker === "exec");
  const skeptical = base === "on-call" && Boolean(lastExec?.events.includes("objection_raised"));

  return { base, mood, skeptical, talking: Boolean(speaking) };
}

// CSS classes for the drawing's root element.
export function poseClasses(pose) {
  return [
    `pose-${pose.base}`,
    `mood-${pose.mood}`,
    pose.skeptical ? "is-skeptical" : null,
    pose.talking ? "is-talking" : null,
  ].filter(Boolean);
}

// A short description for screen readers, so the same cue reaches everyone.
// words: COPY.exec.describe (see copy.js).
export function describePose(pose, firstName, words) {
  const fill = (t) => t.replace(/\{first\}/g, firstName);
  let text;
  if (pose.base === "ringing") text = words.ringing;
  else if (pose.base === "hung-up") text = words.hungUp;
  else if (pose.base === "booked") text = words.booked;
  else text = words[pose.mood];
  if (pose.skeptical) text += ` ${words.skeptical}`;
  return fill(text);
}
