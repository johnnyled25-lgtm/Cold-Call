# Data schemas

Plain-language reference for the files in `data/` and the in-memory call data. Brief §4.2.

## personas.json — one entry per exec

| Field | Meaning |
|---|---|
| `id` | Unique, lowercase-with-dashes |
| `name`, `title`, `company` | Shown on the briefing card and the phone screen |
| `industry`, `companySize`, `currentSetup` | Shown on the briefing card ("what you know") |
| `personality` | Given to the model. Not shown until the debrief |
| `appearance` | `{ skinTone, hair, hairColor, attire, glasses }`. Values must come from `APPEARANCE_OPTIONS` in `js/constants.js` |
| `voice` **(added beyond the brief)** | `{ type: "male" or "female", rate, pitch }`. Picks the browser voice and how it sounds. Rate and pitch are kept inside `VOICE_RATE_RANGE` / `VOICE_PITCH_RANGE` |
| `painPoints` | `[{ id, text, earnedBy, addressedBy }]`, hidden during the call |
| `objections` | Ids from `objections.json` this exec may raise |
| `moods` | Ids from `MOODS` in `js/constants.js` this exec can be in |

`earnedBy` describes, in plain language, the kind of question that earns the reveal.
The debrief shows it for pain points the student missed.

`addressedBy` **(added beyond the brief)**: the offer ids that could help with this pain point.
Without it, the rule "every drawn persona/offer pair is a real fit (≥ 2 addressable pain points)" can't be checked by a test.

## offers.json — what the student sells

`{ id, company, product, oneLiner, valuePoints[], priceHint, fitsPersonaIds[] }`

`fitsPersonaIds` must list only personas with at least two pain points whose `addressedBy` includes this offer. A test enforces this (Phase 1).

## objections.json

`{ id, line, whatHandlesIt }`. `whatHandlesIt` is used by the model to judge whether the objection was handled, and by the debrief.

## Moods (in `js/constants.js`)

`{ id, label, startingPatience, note }`. Drawn at call start, shown only in the debrief.

## Call state (in memory during a call)

`{ seed, personaId, offerId, moodId, patience, revealedPainIds[], raisedObjections[{ id, handled }], askMade, meetingBooked, ended, outcome, turns[] }`

## Turn

`{ index, speaker ("student"|"exec"), text, inputMode ("voice"|"typed"), patienceBefore, patienceAfter, delta, reason, event, latencyMs, at }`

`latencyMs` on an exec turn is the wait the student felt: from releasing the talk button (or pressing Enter) to the exec's first spoken word. `requestMs` is the provider's share of it.

`event` is one of `null`, `pain_revealed`, `objection_raised`, `objection_handled`, `ask_made`, `meeting_accepted`, `silence`, `retry`.
