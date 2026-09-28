// Draws the exec, offer, and mood for a call from a seed. Pure; no DOM.

import { MIN_FIT_PAIN_POINTS } from "./constants.js";
import { seededRandom, pickOne } from "./rng.js";

// An offer is a real fit for an exec when it could help with at least
// MIN_FIT_PAIN_POINTS of their pain points (brief §4.2).
export function isRealFit(persona, offer) {
  const helped = persona.painPoints.filter((p) => (p.addressedBy || []).includes(offer.id));
  return helped.length >= MIN_FIT_PAIN_POINTS;
}

// Every exec/offer pair the app is allowed to draw: listed in the offer's
// fitsPersonaIds AND a real fit. A pair listed by mistake is skipped, never drawn.
export function drawablePairs(personas, offers) {
  const pairs = [];
  for (const persona of personas) {
    for (const offer of offers) {
      if (offer.fitsPersonaIds.includes(persona.id) && isRealFit(persona, offer)) {
        pairs.push({ persona, offer });
      }
    }
  }
  return pairs;
}

// The same seed always returns the same persona, offer, mood, and pickup line.
export function drawCall(seed, { personas, offers, moods, pickupLines }) {
  const random = seededRandom(seed);
  const pairs = drawablePairs(personas, offers);
  if (pairs.length === 0) throw new Error("No exec/offer pair is a real fit. Check data/offers.json.");

  const { persona, offer } = pickOne(random, pairs);
  const allowedMoods = moods.filter((m) => persona.moods.includes(m.id));
  const mood = pickOne(random, allowedMoods.length ? allowedMoods : moods);
  const pickupLine = pickupLines && pickupLines.length ? pickOne(random, pickupLines) : "{first}.";

  return { seed, persona, offer, mood, pickupLine };
}
