// Everything the app keeps in the browser, in one place.
// - API keys: sessionStorage (this tab only; gone when the tab closes). Never localStorage.
// - Settings (provider, model names, temperature): localStorage.
// Every read and write is wrapped, so the app still works when storage is blocked
// (it falls back to memory for this page visit).

import { STORAGE_KEYS, DEFAULT_PROVIDER, DEFAULT_MODELS, DEFAULT_TEMPERATURE, PAST_CALLS_KEPT } from "./constants.js";

const memory = { session: {}, local: {} };

function read(area, key) {
  try {
    return (area === "session" ? sessionStorage : localStorage).getItem(key);
  } catch {
    return memory[area][key] ?? null;
  }
}
function write(area, key, value) {
  memory[area][key] = value;
  try {
    (area === "session" ? sessionStorage : localStorage).setItem(key, value);
  } catch {}
}
function remove(area, key) {
  delete memory[area][key];
  try {
    (area === "session" ? sessionStorage : localStorage).removeItem(key);
  } catch {}
}

const keyName = (provider) => (provider === "openai" ? STORAGE_KEYS.apiKeyOpenAI : STORAGE_KEYS.apiKeyAnthropic);

export function getKey(provider) {
  return read("session", keyName(provider)) || "";
}

export function setKey(provider, value) {
  if (value) write("session", keyName(provider), value);
  else remove("session", keyName(provider));
}

export function loadSettings() {
  let saved = {};
  try {
    saved = JSON.parse(read("local", STORAGE_KEYS.settings)) || {};
  } catch {}
  return {
    provider: saved.provider === "openai" || saved.provider === "anthropic" ? saved.provider : DEFAULT_PROVIDER,
    models: {
      anthropic: saved.models?.anthropic || saved.model || DEFAULT_MODELS.anthropic, // saved.model: Phase 1 format
      openai: saved.models?.openai || DEFAULT_MODELS.openai,
    },
    temperature: typeof saved.temperature === "number" ? saved.temperature : DEFAULT_TEMPERATURE,
  };
}

export function saveSettings(settings) {
  const { provider, models, temperature } = settings;
  write("local", STORAGE_KEYS.settings, JSON.stringify({ provider, models, temperature }));
}

// Everything a provider call needs, for the currently chosen provider.
export function currentCallSettings() {
  const s = loadSettings();
  return { provider: s.provider, key: getKey(s.provider), model: s.models[s.provider], temperature: s.temperature };
}

// ---------------------------------------------------------------------------
// Past calls: the last PAST_CALLS_KEPT calls, newest first, in localStorage.
// Each is { id, savedAt, state, ctx }: the call's text and patience history plus
// the exec, offer, mood, and objections as they were, so a debrief can be reopened
// even if the data files change later. No audio and no API key are ever in here.
// ---------------------------------------------------------------------------

export function loadPastCalls() {
  try {
    const list = JSON.parse(read("local", STORAGE_KEYS.pastCalls));
    return Array.isArray(list) ? list.filter((r) => r && r.state && r.ctx) : [];
  } catch {
    return [];
  }
}

export function savePastCall(state, ctx) {
  const record = { id: `${state.startedAt}-${state.seed}`, savedAt: Date.now(), state, ctx };
  const list = [record, ...loadPastCalls().filter((r) => r.id !== record.id)].slice(0, PAST_CALLS_KEPT);
  write("local", STORAGE_KEYS.pastCalls, JSON.stringify(list));
  return record;
}

// "Clear everything": keys, settings, and past calls (what the button says).
// The one-time voice privacy note and the mic tutorial's "don't show again" choice
// both stay as they were, so clearing everything doesn't bring back dialogs a
// student already dismissed.
export function clearEverything() {
  for (const key of Object.values(STORAGE_KEYS)) {
    if (key === STORAGE_KEYS.privacyNoteSeen || key === STORAGE_KEYS.micTutorialHidden) continue;
    remove("session", key);
    remove("local", key);
  }
}

// Phase 1 kept one Anthropic key under an older name; move it once.
(function migrateOldKey() {
  const old = read("session", STORAGE_KEYS.apiKey);
  if (old && !getKey("anthropic")) setKey("anthropic", old);
  if (old) remove("session", STORAGE_KEYS.apiKey);
})();
