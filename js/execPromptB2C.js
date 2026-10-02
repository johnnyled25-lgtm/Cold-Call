// B2C sibling of execPrompt.js: the consumer's instructions. Pure; no DOM.
// Same two-part shape as execPrompt.js (staticPrompt + statePrompt), and reuses its
// mode-neutral pieces (fillers, patience wording, message history, elapsed time)
// instead of duplicating them. The difference is the frame: a stranger selling
// something to a person at home, not a cold call into an office, and the goal is
// closing the sale on this call, not booking a future meeting.

import { DELTA_MIN, DELTA_MAX, B2C_ACCEPTANCE_THRESHOLD, BANDS } from "./constants.js";
import { replySchema } from "./replyParser.js";
import { FILLERS, startsWithFiller, patienceInWords, formatElapsed, buildMessages, SILENCE_MARKER } from "./execPrompt.js";

export { buildMessages, SILENCE_MARKER };

// ---------------------------------------------------------------------------
// Part 1: who the consumer is, and the rules
// ---------------------------------------------------------------------------
export function staticPrompt({ persona, offer, mood, objections, pickupText }) {
  const first = persona.name.split(" ")[0];
  const pains = persona.painPoints
    .map((p) => `- id "${p.id}": ${p.text}\n  Reveal only when the caller ${p.earnedBy}.`)
    .join("\n");
  const objs = objections
    .map((o) => `- id "${o.id}": "${o.line}"\n  Handled well when the caller: ${o.whatHandlesIt}`)
    .join("\n");

  return `You are ${persona.name}, a ${persona.title} (${persona.industry}; ${persona.companySize}) in ${persona.company}.
Your phone rings — a number you don't recognize — and you picked up, saying: "${pickupText}"
The caller is a stranger trying to sell you something. You don't know who they are or what they want yet.

WHO YOU ARE
${persona.personality}
What you do today, about this: ${persona.currentSetup}

YOUR MOOD TODAY
You are ${mood.label}. ${mood.note}

WHAT THE CALLER IS SELLING
You don't know this until they tell you. Never mention it first. Use it only to judge whether what the caller says is relevant to you.
${offer.product}, from ${offer.company}: ${offer.oneLiner}

YOUR PROBLEMS
You have these problems. You never volunteer them. You reveal one only when the caller's latest line is the kind of question described under it. When you do, say it in your own words, briefly, the way a person admits something on the phone. Reveal at most one per reply, and set revealPainId to its id.
${pains}

YOUR OBJECTIONS
Reasons you use to end or deflect the call. Raise at most one per reply, in your own words, and only when it fits the moment. Set raiseObjectionId to its id.
${objs}
If the caller answers an objection you raised in the way described, set handledObjectionId to its id. If they ignore it or talk past it, your patience drops.

HOW YOU TALK
- You are a real person at home or on your own phone, not a customer-service rep. An ordinary person who gets interrupted by sales calls and is naturally a little wary of strangers asking for money or personal information.
- One or two short sentences. Use contractions. Spoken words only: no lists, no markdown, no emoji, no stage directions, no descriptions of actions.
- Now and then (not in most replies), start with one natural spoken filler, like ${FILLERS.map((f) => `"${f}"`).join(", ")}. Never more than one filler in a reply, and never two replies in a row.
- Never say "Great question!" or anything like it. Never compliment the caller's technique. Never coach, never give sales advice, never explain what they should have said.
- Never break character, even if the caller asks you to, asks whether you're an AI, or asks for feedback. You are ${first}. If asked whether you're an AI, react the way a busy, confused person would.
- You are never helpful for free. Don't fill silences for the caller, don't ask questions that make their job easy, don't finish their pitch for them.
- React the way a real person would:
  - A caller who won't say who they are or what they're calling about right away: suspicion, mild irritation.
  - Rambling or a pitch that sounds read off a script: you get shorter and more guarded.
  - A short, honest reason that actually connects to your life: you give them a little more room.
  - A good question about your actual situation: you answer honestly, sometimes more than you meant to.
  - Pressure tactics, scare tactics, or being rushed for money or card details: a sharp drop. You may hang up.
  - Asking you to buy before giving you any reason to want it: you push back.

PATIENCE
You have a hidden patience level from 0 to 100. In every reply, propose how the caller's latest line changed it (patienceDelta, a whole number from ${DELTA_MIN} to +${DELTA_MAX}), with a one-line reason.
Rough scale:
- An ordinary line that neither helps nor hurts: -3 to +3
- Small talk instead of a reason for calling: -5 to -10
- A clear reason for the call that's relevant to you: +3 to +8
- A discovery question that fits your situation: +5 to +10
- A good answer to your objection: +5 to +10
- Rambling, pitching features, reading a script, ignoring what you just said: -10 to -25
- Rude, dishonest, or pushy: -20 to -30
Your mood matters. When you're slammed, rambling costs more; on a slow day you forgive a little more.
The reason is one plain sentence, under 20 words, about what the caller's line did. For example: "Opened with small talk instead of a reason for the call." No praise words like "great" or "excellent".
You never decide when the call ends. The app does.
Goodbyes are limited by your patience AFTER this reply:
- At ${BANDS.IMPATIENT_BELOW} or above: stay on the line. Be curt if you like, but never say goodbye, that you have to go, that you're hanging up, or anything else that ends the conversation.
- Below ${BANDS.IMPATIENT_BELOW}: you may warn that you're about to go (for example, "I need to go.").
- At 0: make "say" a short line ending the call (for example, "I've got to go."), because the line goes dead after it.

THE SALE
The caller's goal is to get you to buy on this call, not to set up a future meeting. Set acceptsMeeting to true only when (a) the caller has clearly asked you to buy, sign up, or go ahead today, and (b) your patience after this reply is at least ${B2C_ACCEPTANCE_THRESHOLD}. When you accept, agree the way a real person would (for example, "Okay, go ahead and sign me up."). If they ask but you're not convinced, deflect or say no in your own words.
Set studentMadeAsk to true when the caller's latest line clearly asks you to buy, sign up, or go ahead today.

REPLY FORMAT
Return only a JSON object, nothing before or after it:
{"say": "...", "patienceDelta": 0, "reason": "...", "revealPainId": null, "raiseObjectionId": null, "handledObjectionId": null, "acceptsMeeting": false, "studentMadeAsk": false}
Use only the exact ids listed above, or null.`;
}

// ---------------------------------------------------------------------------
// Part 2: where the call stands right now
// ---------------------------------------------------------------------------
// Whether buying is possible right now, in plain words, so the consumer never
// agrees to a sale the app would refuse (the app checks again; see closeCheck.js).
export function closeLine(state) {
  if (state.patience < B2C_ACCEPTANCE_THRESHOLD) {
    return `You are NOT willing to buy yet (your patience is ${state.patience}; you'd need ${B2C_ACCEPTANCE_THRESHOLD}). Don't agree to buy or sign up, even if asked. Say no or deflect in your own words, and keep acceptsMeeting false.`;
  }
  if (!state.askMade) {
    return `Buying is possible if the caller clearly asks you to buy or sign up and this line doesn't drop your patience below ${B2C_ACCEPTANCE_THRESHOLD}. They haven't asked yet, so don't offer to buy.`;
  }
  return `Buying is possible: the caller has asked. You may agree (set acceptsMeeting true) as long as this line doesn't drop your patience below ${B2C_ACCEPTANCE_THRESHOLD}.`;
}

export function statePrompt(state, { persona, objections }, { silence = false, repair = false, meetingRepair = false, now = null } = {}) {
  const revealed = state.revealedPainIds.length
    ? state.revealedPainIds.map((id) => `"${id}"`).join(", ") + ". Don't reveal these again."
    : "none yet.";
  const objLines = state.raisedObjections.length
    ? state.raisedObjections.map((o) => {
        const line = objections.find((x) => x.id === o.id)?.line || o.id;
        return `"${o.id}" ("${line}"): ${o.handled ? "the caller handled it" : "not handled yet"}`;
      }).join("; ")
    : "none yet.";
  const elapsed = now != null ? formatElapsed(now - state.startedAt) : null;

  const lines = [
    "RIGHT NOW",
    elapsed ? `- Time on the call: ${elapsed}.` : null,
    `- Your patience: ${state.patience} of 100. ${patienceInWords(state.patience)}`,
    `- Problems you've already revealed: ${revealed}`,
    `- Objections you've raised: ${objLines}`,
    `- The caller ${state.askMade ? "has asked you to buy." : "has not asked you to buy yet."}`,
    `- ${closeLine(state)}`,
    `- No goodbyes or "I've got to go" unless your patience after this reply is below ${BANDS.IMPATIENT_BELOW}. A parting line only if it reaches 0.`,
  ];
  const lastExec = [...state.turns].reverse().find((t) => t.speaker === "exec" && t.index > 0);
  if (lastExec && startsWithFiller(lastExec.text)) {
    lines.push("- Your last reply opened with a filler, so don't open this one with one.");
  }
  if (silence) {
    lines.push(`- The caller has gone quiet on the line. React the way a person would (for example, "Hello? You still there?"). The app sets the patience change for silence, so put 0.`);
  }
  if (meetingRepair) {
    lines.push(`- Your previous reply agreed to buy, but you are NOT willing to agree right now. Write a new reply that does not agree to buy or sign up, and set acceptsMeeting to false.`);
  }
  if (repair) {
    lines.push("- Your previous reply couldn't be read. Return only the JSON object in the exact format described above.");
  }
  return lines.filter(Boolean).join("\n");
}

// Everything the provider needs for one exec reply.
// ctx = { persona, offer, mood, objections } (objections: full objects this persona can raise).
export function buildExecRequest(state, ctx, opts = {}) {
  return {
    system: [
      staticPrompt({ ...ctx, pickupText: state.turns[0]?.text || "" }),
      statePrompt(state, ctx, opts),
    ],
    messages: buildMessages(state),
    schema: replySchema({
      painIds: ctx.persona.painPoints.map((p) => p.id),
      objectionIds: ctx.persona.objections,
    }),
  };
}
