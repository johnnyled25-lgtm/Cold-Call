// Maps hidden patience to the body-language band the student can see. Pure; no DOM.
// The drawing (Phase 4) uses this, so body language never contradicts patience.

import { BANDS } from "./constants.js";

export function patienceBand(patience) {
  if (patience >= BANDS.ENGAGED_MIN) return "engaged";
  if (patience < BANDS.IMPATIENT_BELOW) return "impatient";
  return "neutral";
}
