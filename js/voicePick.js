// Voice decisions that don't need the browser. Pure; no DOM, so they can be tested.

import {
  SPEECH_LANG, VOICE_NAME_HINTS, VOICE_RATE_RANGE, VOICE_PITCH_RANGE,
  VOICE_QUALITY_TIERS, BAND_DELIVERY, DELIVERY_RATE_LIMITS, DELIVERY_PITCH_LIMITS, SENTENCE_GAP_MS,
} from "./constants.js";
import { patienceBand } from "./bands.js";

const clamp = (v, [lo, hi]) => Math.min(hi, Math.max(lo, v));
const round2 = (v) => Math.round(v * 100) / 100;

// A small stable number from a string, so the same exec always gets the same voice.
function hashString(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

// Whole-word match on the voice's name, e.g. "Microsoft Guy Online" matches "guy".
// A name containing "female" never counts as male (because "female" contains "male").
function matchesHint(voice, type) {
  const name = voice.name.toLowerCase();
  const words = VOICE_NAME_HINTS[type] || [];
  const hit = words.some((w) => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(name));
  if (type === "male" && /\bfemale\b/.test(name)) return false;
  return hit;
}

// How natural a voice is likely to sound, from its name: 0 is best.
// Edge's neural voices are named "... Online (Natural) ..."; then Google's; then the rest.
export function voiceTier(voice) {
  const name = String(voice?.name || "").toLowerCase();
  const i = VOICE_QUALITY_TIERS.findIndex((words) => words.some((w) => name.includes(w)));
  return i === -1 ? VOICE_QUALITY_TIERS.length : i;
}

// "natural", "Google", or "standard": how a voice ranks, in words (for the gallery and debug panel).
export function voiceTierLabel(voice) {
  if (!voice) return "browser default";
  return ["natural", "Google", "standard"][Math.min(voiceTier(voice), 2)];
}

// Picks one voice for an exec from what the browser offers, and keeps it for the call.
// voices: [{ name, lang, localService }]. persona.voice: { type, rate, pitch }.
// Order of preference:
//   1. the exec's voice type (male/female), in any English (a British man's voice
//      beats an American woman's for Mike)
//   2. the most natural-sounding tier: "Natural"/"Online", then "Google", then anything
//   3. within that tier, the call's exact language (en-US)
//   4. a fixed choice among equals, so the same exec always gets the same voice
// Returns { voice, rate, pitch, tier }; voice is null if the browser offers no English voice.
export function pickVoice(voices, persona) {
  const settings = persona.voice || {};
  const rate = clamp(settings.rate ?? 1, VOICE_RATE_RANGE);
  const pitch = clamp(settings.pitch ?? 1, VOICE_PITCH_RANGE);
  const lang = SPEECH_LANG.toLowerCase();
  const base = lang.split("-")[0];

  const norm = (v) => String(v.lang || "").toLowerCase().replace("_", "-");
  const exact = voices.filter((v) => norm(v) === lang);
  const sameLanguage = voices.filter((v) => norm(v).split("-")[0] === base);
  if (!sameLanguage.length) return { voice: null, rate, pitch, tier: null };

  // The first non-empty group wins. A voice of the exec's type comes first, even in
  // another English variant (a British man's voice beats an American woman's for Mike);
  // then one that at least isn't the other type; then any voice in the language.
  const other = settings.type === "female" ? "male" : "female";
  const isType = (v) => settings.type && matchesHint(v, settings.type);
  const notOther = (v) => settings.type && !matchesHint(v, other);
  const groups = [sameLanguage.filter(isType), sameLanguage.filter(notOther), sameLanguage];
  const candidates = groups.find((g) => g.length);

  // Then the most natural-sounding tier; within it, the exact language (en-US) if any.
  const bestTier = Math.min(...candidates.map(voiceTier));
  const inTier = candidates.filter((v) => voiceTier(v) === bestTier);
  const inTierExact = inTier.filter((v) => exact.includes(v));
  const finalList = (inTierExact.length ? inTierExact : inTier).sort((a, b) => a.name.localeCompare(b.name));
  return { voice: finalList[hashString(persona.id) % finalList.length], rate, pitch, tier: bestTier };
}

// How the exec sounds on this line: the persona's own rate and pitch, nudged by the
// patience band (impatient: a bit faster and flatter). Kept inside natural limits.
export function deliveryFor(voicePick, patience) {
  const nudge = BAND_DELIVERY[patienceBand(patience)] || { rate: 0, pitch: 0 };
  return {
    rate: round2(clamp((voicePick?.rate ?? 1) + nudge.rate, DELIVERY_RATE_LIMITS)),
    pitch: round2(clamp((voicePick?.pitch ?? 1) + nudge.pitch, DELIVERY_PITCH_LIMITS)),
  };
}

// Splits a reply into sentences, so each can be spoken as its own utterance with a
// short pause between (it sounds less like one block read aloud).
// "Hm. Look, I've got two minutes. What is this?" → ["Hm.", "Look, I've got two minutes.", "What is this?"]
export function splitSentences(text) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (!clean) return [];
  // Split only where sentence punctuation is followed by a space, so "$6.50" stays whole.
  return clean.split(/(?<=[.!?…]["'”’)]*)\s+/).map((p) => p.trim()).filter(Boolean);
}

// A pause between sentences: a fixed-looking but varied 150–250 ms, chosen from the
// sentence's position so it's the same every time the same line is spoken.
export function sentenceGapMs(index) {
  const [lo, hi] = SENTENCE_GAP_MS;
  return lo + ((index * 37) % (hi - lo + 1));
}

// A guess at how long the browser will take to say a line (including the pauses
// between sentences), used as a safety net in case the browser never reports that
// speech ended (a known Chrome quirk).
export function estimatedSpeechMs(text, rate = 1) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean).length;
  const gaps = Math.max(0, splitSentences(text).length - 1) * SENTENCE_GAP_MS[1];
  return Math.round(((words / 2.6) * 1000) / rate) + gaps + 2500;
}
