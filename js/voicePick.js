// Voice decisions that don't need the browser. Pure; no DOM, so they can be tested.

import { SPEECH_LANG, VOICE_NAME_HINTS, VOICE_RATE_RANGE, VOICE_PITCH_RANGE } from "./constants.js";

const clamp = (v, [lo, hi]) => Math.min(hi, Math.max(lo, v));

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

// Picks one voice for an exec from what the browser offers.
// voices: [{ name, lang, localService }]. persona.voice: { type, rate, pitch }.
// Prefers: same language, then a name that matches the exec's voice type, then local voices.
// Returns { voice, rate, pitch }; voice is null if the browser offers no English voice.
export function pickVoice(voices, persona) {
  const settings = persona.voice || {};
  const rate = clamp(settings.rate ?? 1, VOICE_RATE_RANGE);
  const pitch = clamp(settings.pitch ?? 1, VOICE_PITCH_RANGE);
  const lang = SPEECH_LANG.toLowerCase();
  const base = lang.split("-")[0];

  const norm = (v) => String(v.lang || "").toLowerCase().replace("_", "-");
  const exact = voices.filter((v) => norm(v) === lang);
  const sameLanguage = voices.filter((v) => norm(v).split("-")[0] === base);
  const pool = exact.length ? exact : sameLanguage;
  if (!pool.length) return { voice: null, rate, pitch };

  // Best: a voice that matches the exec's type. Next: one that at least doesn't match
  // the other type. Last resort: any voice in the right language.
  const other = settings.type === "female" ? "male" : "female";
  const typed = settings.type ? pool.filter((v) => matchesHint(v, settings.type)) : [];
  const notOther = settings.type ? pool.filter((v) => !matchesHint(v, other)) : [];
  const candidates = typed.length ? typed : notOther.length ? notOther : pool;
  const local = candidates.filter((v) => v.localService);
  const finalList = (local.length ? local : candidates).slice().sort((a, b) => a.name.localeCompare(b.name));
  return { voice: finalList[hashString(persona.id) % finalList.length], rate, pitch };
}

// A guess at how long the browser will take to say a line, used as a safety net
// in case the browser never reports that speech ended (a known Chrome quirk).
export function estimatedSpeechMs(text, rate = 1) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean).length;
  return Math.round(((words / 2.6) * 1000) / rate) + 2500;
}
