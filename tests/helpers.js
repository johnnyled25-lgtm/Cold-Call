// Shared test fixtures. Loads the real data files so the tests check the real content.
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { MOODS, MOODS_B2C } from "../js/constants.js";
import { COPY, copyFor } from "../js/copy.js";
import { createCallState } from "../js/callState.js";

const read = (name) => JSON.parse(fs.readFileSync(fileURLToPath(new URL(`../data/${name}`, import.meta.url)), "utf8"));

export const personas = read("personas.json");
export const offers = read("offers.json");
export const objections = read("objections.json");
export const data = { personas, offers, objections, moods: MOODS, pickupLines: COPY.pickupLines };

export const persona = personas.find((p) => p.id === "brasswell-freight");
export const offer = offers.find((o) => o.id === "crewbeam");
export const mood = MOODS.find((m) => m.id === "normal-day");
export const ctx = { persona, offer, mood, objections: objections.filter((o) => persona.objections.includes(o.id)) };

// A call that starts at the given patience (default 55).
export function newCall(patience = 55) {
  const state = createCallState({ seed: 1, persona, offer, mood, pickupLine: "{first}.", startedAt: 0 });
  return { ...state, patience, startingPatience: patience };
}

// A well-formed exec reply; override any field.
export function reply(fields = {}) {
  return {
    say: "Go ahead.", patienceDelta: 0, reason: "Neutral line.", revealPainId: null,
    raiseObjectionId: null, handledObjectionId: null, acceptsMeeting: false, studentMadeAsk: false,
    ...fields,
  };
}

// --- B2C fixtures, same shape as above ---------------------------------------
export const personasB2C = read("personas-b2c.json");
export const offersB2C = read("offers-b2c.json");
export const objectionsB2C = read("objections-b2c.json");
export const dataB2C = { personas: personasB2C, offers: offersB2C, objections: objectionsB2C, moods: MOODS_B2C, pickupLines: copyFor("b2c").pickupLines };

export const personaB2C = personasB2C.find((p) => p.id === "ruiz-household");
export const offerB2C = offersB2C.find((o) => o.id === "northgate-shield");
export const moodB2C = MOODS_B2C.find((m) => m.id === "normal-evening");
export const ctxB2C = { persona: personaB2C, offer: offerB2C, mood: moodB2C, objections: objectionsB2C.filter((o) => personaB2C.objections.includes(o.id)) };

export function newCallB2C(patience = 55) {
  const state = createCallState({ seed: 1, persona: personaB2C, offer: offerB2C, mood: moodB2C, pickupLine: "{first}.", startedAt: 0 });
  return { ...state, patience, startingPatience: patience };
}
