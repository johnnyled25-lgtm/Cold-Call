// Detects "the ask": the student asking for a meeting or time on the calendar.
// Deliberately simple: a phrase list from constants.js, so anyone can see why a line counted.
// Pure; no DOM.

import { ASK_PHRASES } from "./constants.js";

// Lowercase, straight apostrophes, hyphens as spaces, single spaces.
export function normalizeForAsk(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[-–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Returns { asked: true, phrase } for the first matching phrase, or { asked: false, phrase: null }.
export function detectAsk(text, phrases = ASK_PHRASES) {
  const normalized = normalizeForAsk(text);
  for (const phrase of phrases) {
    if (normalized.includes(normalizeForAsk(phrase))) return { asked: true, phrase };
  }
  return { asked: false, phrase: null };
}
