// B2C sibling of meetingCheck.js: keeps the consumer's words and the call state in
// agreement about THE SALE, not a future meeting. Pure; no DOM.
//
// Same problem it prevents: the consumer says "Fine, sign me up" while the code
// (correctly) refuses because patience is too low, so the call goes on and the
// debrief contradicts itself. Unlike a meeting, a sale can close immediately, so
// there's no date/time requirement here — just a clear agreement to buy.

import { SILENCE_COST } from "./constants.js";
import { B2C_RULES, clampDelta, clampPatience } from "./callState.js";

const AGREE_WORDS = /\b(fine|sure|okay|ok|alright|all right|deal|yes|yeah|yep|works|let's do|sounds good|i'm in)\b/i;
const NEGATION = /\b(no|not|never|cannot)\b|n't\b/i;
// Phrases that agree to buy on their own, with no separate "yes" needed.
const STRONG_AGREEMENT = /\b(sign me up|i'll take it|go ahead (and )?(sign|charge|set)|charge (me|my card)|i'll buy it|count me in|let's do it|put me down for|i'm buying|set me up)\b/i;

// True when the consumer's line clearly agrees to buy, e.g. "Fine, sign me up."
// Deliberately cautious, same shape as meetingCheck.js's looksLikeAgreement: a
// strong agreement phrase counts on its own; a plain agree-word only counts when a
// nearby sentence doesn't negate it.
export function looksLikeClose(say) {
  const text = String(say || "").replace(/[‘’]/g, "'");
  const sentences = text.split(/(?<=[.!?])\s+/);
  return sentences.some((s, i) => {
    if (NEGATION.test(s)) return false;
    if (STRONG_AGREEMENT.test(s)) return true;
    if (!AGREE_WORDS.test(s)) return false;
    return i === 0 || !NEGATION.test(sentences[i - 1]);
  });
}

// Would callState.js close the sale for this reply? Plus whether the words and the
// flag disagree with that. Same return shape as meetingCheck.js's meetingDecision:
// { allowed, agreesInWords, contradiction }, contradiction one of
// "accept_not_allowed" / "agreed_without_flag" / null.
export function closeDecision(state, reply, { silence = false, rules = B2C_RULES } = {}) {
  const askMade = state.askMade || (!silence && reply.studentMadeAsk === true);
  const delta = silence ? SILENCE_COST : clampDelta(reply.patienceDelta);
  const after = clampPatience(state.patience + delta);
  const allowed = askMade && after >= rules.acceptanceThreshold && after > 0;
  const agreesInWords = looksLikeClose(reply.say);

  let contradiction = null;
  if ((reply.acceptsMeeting || agreesInWords) && !allowed) contradiction = "accept_not_allowed";
  else if (allowed && agreesInWords && !reply.acceptsMeeting) contradiction = "agreed_without_flag";
  return { allowed, agreesInWords, contradiction };
}
