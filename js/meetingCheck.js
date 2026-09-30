// Keeps the exec's words and the call state in agreement about the meeting.
// Pure; no DOM.
//
// The problem it prevents: the exec says "Fine. Thursday, ten o'clock" while the
// code (correctly) refuses the booking because patience is too low, so the call
// goes on and the debrief contradicts itself. The rule here is the same one
// callState.js applies, worked out BEFORE the reply is used, so the controller
// can ask the model for a consistent line.

import { ACCEPTANCE_THRESHOLD, PATIENCE_MIN, SILENCE_COST } from "./constants.js";
import { clampDelta, clampPatience } from "./callState.js";

const TIME_WORDS = /\b(monday|tuesday|wednesday|thursday|friday|tomorrow|next week|this week|noon|o'clock|\d{1,2}(:\d{2})?\s?(am|pm|a\.m\.|p\.m\.)|at (one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|\d{1,2}))\b/i;
const AGREE_WORDS = /\b(fine|sure|okay|ok|alright|all right|deal|yes|yeah|yep|works|let's do|sounds good)\b/i;
const NEGATION = /\b(no|not|never|cannot)\b|n't\b/i;
// Phrases that agree to a meeting on their own, with or without a day or time.
const STRONG_AGREEMENT = /\b(send (me )?(an|the) invite|put (it|us|you|that) (on|down)|book it|pencil (it|you|us) in|see you then|talk (to you )?then|i'll take the meeting|let's meet)\b/i;

// True when the exec's line clearly agrees to a meeting time, e.g. "Fine. Thursday, ten o'clock."
// Deliberately cautious: a sentence with a day or time counts only when it has no
// negation and it (or the sentence before it) says yes.
export function looksLikeAgreement(say) {
  const text = String(say || "").replace(/[‘’]/g, "'");
  const sentences = text.split(/(?<=[.!?])\s+/);
  return sentences.some((s, i) => {
    if (NEGATION.test(s)) return false;
    if (STRONG_AGREEMENT.test(s)) return true;
    if (!TIME_WORDS.test(s)) return false;
    return AGREE_WORDS.test(s) || (i > 0 && AGREE_WORDS.test(sentences[i - 1]) && !NEGATION.test(sentences[i - 1]));
  });
}

// Would callState.js book the meeting for this reply? Plus whether the words and
// the flag disagree with that.
// Returns { allowed, agreesInWords, contradiction }, where contradiction is:
//   "accept_not_allowed"  – the exec accepts (flag or words) but the rules don't allow it
//   "agreed_without_flag" – the rules allow it and the words agree, but the flag is false
//   null                  – consistent
export function meetingDecision(state, reply, { silence = false } = {}) {
  const askMade = state.askMade || (!silence && reply.studentMadeAsk === true);
  const delta = silence ? SILENCE_COST : clampDelta(reply.patienceDelta);
  const after = clampPatience(state.patience + delta);
  const allowed = askMade && after >= ACCEPTANCE_THRESHOLD && after > PATIENCE_MIN;
  const agreesInWords = looksLikeAgreement(reply.say);

  let contradiction = null;
  if ((reply.acceptsMeeting || agreesInWords) && !allowed) contradiction = "accept_not_allowed";
  else if (allowed && agreesInWords && !reply.acceptsMeeting) contradiction = "agreed_without_flag";
  return { allowed, agreesInWords, contradiction };
}
