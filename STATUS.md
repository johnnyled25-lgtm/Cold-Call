# Status

## Second round of fixes from Johnny's test calls (2026-09-30; done, not yet pushed)

The first round (below) was pushed as commit `f385eca`. This round is on the development computer only.

1. **SERIOUS, the exec agreeing while the app refuses: fixed.**
   - **(a)** Every turn now tells the exec plainly whether a meeting is possible. Below the threshold: *"You are NOT willing to agree to a meeting yet (your patience is 46; you'd need 60). Don't agree to any meeting, day, or time, even if asked."* At or above it: possible once the caller has asked, as long as the line doesn't drop patience below 60 (`meetingLine` in `js/execPrompt.js`).
   - **(b)** Before a reply is used, `js/meetingCheck.js` works out, with the same numbers the patience engine uses, whether the booking would be allowed. It also spots lines whose *words* agree to a time ("Fine. Thursday, ten o'clock."). If the exec accepts (flag or words) and the rules don't allow it, the model is asked **once** for a line that doesn't agree. If it still agrees, the app keeps the patience change and reason but replaces the line with *"I'm not putting anything on the calendar yet."* (`notReadyLine` in `copy.js`), and nothing is booked. If the rules allow it and the words agree but the flag was left off, the meeting is booked. Either way, the exec's words and the state match, so the debrief can't print an acceptance above "didn't agree". Each fix is recorded on the turn (`fixes`), visible in `?debug=1`.
2. **Silence timing by input mode: done.** Voice: 8 s (`SILENCE_TIMEOUT_SECONDS`). Typed: 20 s (`SILENCE_TIMEOUT_TYPED_MS = 20000`). Plus 10 s of grace before the student's first line (`FIRST_TURN_GRACE_MS`). The countdown **never runs out while the text box has content**, and every keystroke restarts it.
3. **Typed text is never lost to a silence.** A silence turn never touches the text box, and with #2 it can't fire while there's text in it.
4. **Silence shows live** as "You: (silence)", followed by the exec's actual reaction line.
5. **Voice privacy note once per browser.** It's stored in `localStorage` (wrapped in try/catch) and now survives **Clear everything**, which only clears keys, settings, and past calls, as its label says. Browsers keep storage per web address, so the note shows once on `coldcall-lab.vercel.app` and once on any other address (e.g. the old `r15wh22x6` link). That's likely why it reappeared.
6. **Student name and role on the briefing card:** "You are: Jordan, sales rep at {company}". The name and role are in `copy.js` (`student`), so they're easy to change. (This was #9 in the first list.)
- **#8 from the first list: the temperature control is hidden** (not just greyed out) when the selected model ignores temperature, e.g. `claude-sonnet-5`.
- The silence reaction no longer tells the exec "8 seconds" (the timing now varies).

**Tests: 108, all passing** (12 new), including the requested rejection-path test: an acceptance the code rejects triggers one repair, and the final line doesn't agree; if the repair also agrees, the line is replaced and nothing is booked. Also tested: the agreement detector on agreeing and refusing lines, the per-turn meeting line, the 8 s / 20 s / grace timings, silence never firing with text in the box, and the privacy note surviving Clear everything.

**Checked in headless Chrome:** the briefing starts "You are: Jordan, sales rep at…"; the temperature control is hidden for Sonnet 5 and shown for Haiku 4.5; before the first line the text box stays open through the full 30 s, then "You: (silence)" appears.

**Not yet verified in a real call** (needs an API key): the exec's reaction to a silence, and the meeting repair with the real model.

## Fixes from Johnny's Chrome test (2026-09-30; done, not yet pushed)

Johnny approved items 1–6 of his test list. #7 (default model → `claude-haiku-4-5`) is **on hold**: Haiku 4.5 may be retired as soon as Oct 15, 2026, so the default stays `claude-sonnet-5`. #8 (hide the temperature slider) and #9 (student name and role on the briefing) are **waiting** for a go-ahead.

1. **Input stuck locked after the exec speaks: fixed.** The turn now goes back to the student when the exec's voice ends, errors, never starts (3 s, `SPEECH_START_TIMEOUT_SECONDS`), or runs past a limit based on the line's length, whichever comes first, exactly once (`js/turnGate.js` → `guardSpeech`). Also fixed a path in `voice.js` where an error while recording latency could skip the unlock. The debug panel notes when a fallback was needed.
   - **Found while testing:** the call also **rang forever if the browser's microphone pop-up was never answered**, because pickup waited on it. Now the exec picks up after at most 4 s (`MIC_WAIT_SECONDS`); the student can type right away, a note asks them to answer the pop-up, and the talk button turns on once the mic is allowed (or the call switches to typing if it's blocked).
   - Checked in headless Chrome, which has no audio (the "voice never starts" case): the call picks up, the exec's line shows, and the text box unlocks.
2. **Silence timer: fixed.** It never runs while input is locked (exec thinking or speaking, student recording, call over), and **every keystroke restarts the 8-second countdown** (`createSilenceWatch`). Words sitting in the text box also count as responding, so a slow typist is never charged.
3. **Exec lines showing "…": fixed.** Only the *student's* silence shows as "…"; the exec's reply to a silence was wrongly shown as "…" too. Exec text shows as soon as the reply arrives.
4. **Goodbyes above the lowest band: fixed in `js/execPrompt.js`.** At patience 30 or above, the exec must stay on the line (curt is fine; no goodbye, no "I have to go"). Below 30 it may warn it's about to go. A parting line only when patience reaches 0, when the app hangs up. Both the fixed rules and the per-turn state say so. (This is an instruction to the AI; it can still occasionally slip. The patience engine, not the AI, still decides the hang-up.)
5. **Scroll to top when a call starts: fixed.** The page scrolls to the top, and focusing the text box or talk button no longer scrolls it down.
6. **Crewbeam vs. Beth Olson's single plant: fixed in the offer copy.** "for teams that work in shifts across more than one site" → "for hourly teams that work in shifts, at one location or several"; "open shifts across every site" → "every open shift on one screen, across all shifts and locations". Duebird and Paperlight were checked against their execs; no changes needed.

**Tests: 96, all passing** (9 new), including the requested one: the silence timer does not fire while input is locked, or while the text box has changed in the last 8 seconds. Also tested: the speech guard releases on end, error, no-start, and timeout, and only once; and the goodbye rule is in the exec's instructions.

**Not yet verified:** #3 and #4 in a real call (they need an API key); the fixes aren't on the live site until pushed.

## Deployed (2026-09-28)
- **Live:** https://coldcall-lab.vercel.app (public; Vercel Authentication turned off).
- **Repo:** https://github.com/johnnyled25-lgtm/Cold-Call, branch `main`. Vercel redeploys on every push.
- Checked as a logged-out visitor: every file loads, the live files match the repo, and the briefing renders in Chrome with no console errors. A full call on the live site still needs a real key (Johnny).
- `docs/` (the build brief copy) is kept out of the repo because it names GCSU; it stays on the development computer.
- Anyone can open the site, but each visitor needs their own API key to call. The key-hiding proxy (brief §9) is the step before students use it.

## Phase 6 — Polish (done; build complete, awaiting final review)

### Done
- **"What is happening here" panels** on the Briefing, Call, and Debrief screens: two short paragraphs each ("What this does" / "Why it matters"), 38–55 words each, no banned words, goal always "book a meeting".
- **Accessibility pass** with axe-core (an automated WCAG checker, run from a throwaway page; not added to the app) on the briefing, Settings, a live call, the debrief, and Past calls. Two findings, both fixed: the phone panel was marked up as a nested sidebar, and the Past calls table had an empty column header. All app screens now report zero issues. Also in place: visible focus everywhere, keyboard-reachable chart points, outcomes shown with icon + word (never color alone), screen-reader descriptions of the exec's body language, reduced-motion support.
- **Cross-browser check** (automated, headless):
  - Chrome and Edge: app loads with no console errors, briefing renders, call screen fits a laptop screen.
  - Firefox: app loads, a call picks up, and it starts in typed mode with *"Voice input isn't available in this browser. You can type your side of the call."*
  - Safari: **not checked** (not available on Windows).
- **Call screen fits an 800px-tall laptop window** again after adding the explainer (drawing capped at 38% of the window height).
- **`README.md`** for Johnny: running locally, deploying (Vercel or GitHub Pages), keys and privacy, a table of every setting and where to change it, editing execs/offers/objections, browser support, known limitations, tests, and a file map.
- **`.gitignore`** so `.env` and key files can't be committed by accident.
- **Key search** (success criterion 16): no API keys anywhere in the project; the only key-like strings are fake ones inside tests.
- **87 Node tests, all passing.**

### Success criteria (brief §7)

| # | Criterion | Status |
|---|---|---|
| 1 | Loads fast, no console errors, no key needed | ✅ Chrome, Edge, Firefox: loads with no app errors |
| 2 | No key → Call opens Settings with key copy | ✅ Built and in use |
| 3 | Test connection + full typed call, both providers | ✅ Anthropic (confirmed by Johnny) · ⚠️ OpenAI built and unit-tested, never run with a real key |
| 4 | Rambling → Hung up; turning point quotes the line | ✅ Tested in the engine and debrief; Johnny's call log showed a traced −30 hang-up |
| 5 | Discovery question reveals a pain point, listed in debrief | ✅ Tested with a sample call; depends on the AI in real calls |
| 6 | Ask above threshold can book; below cannot | ✅ Tested |
| 7 | Chrome voice works; Firefox falls back to typing | ⚠️ Firefox verified. Chrome voice input untested (no microphone). **Hold-spacebar replaced by click-to-talk at Johnny's request.** |
| 8 | 8 s silence → silence turn, fixed cost, "Silence on the line." | ✅ Built and tested in the engine; not yet observed in a live call |
| 9 | Pose follows patience bands; never Engaged below the band | ✅ Tested for every patience value; checked visually |
| 10 | 404 / 429 / missing key / network each get a plain message | ✅ Tested |
| 11 | Call again reproduces exec, offer, mood | ✅ Tested (same seed) |
| 12 | Median latency recorded; options if > 3 s | ⚠️ Typed: 3.9 s over 5 turns (brief asked for 10); voice not measured. Options recorded; Johnny chose to keep current speed |
| 13 | `node --test` passes | ✅ 87 of 87 |
| 14 | No banned words; explainers < 70 words; no "bot/prospect/lead" | ✅ Tested |
| 15 | Model, silence timeout, threshold each one commented line | ✅ `js/constants.js`; table in README |
| 16 | No key found in the repo after testing | ✅ Searched |

### Open items for later
- Voice input with a real microphone (plug one in, then Settings → Test microphone).
- OpenAI with a real key.
- Safari check (needs a Mac).
- Before students use it: the key-hiding proxy (brief §9), so students don't need their own keys.

## Phase 5 — The debrief and past calls (done, awaiting review)

### Johnny's request, added this phase
- **"Your briefing" on the call screen:** under the exec drawing, a collapsible panel (open by default) shows who you're calling, what you know about them, **who you work for**, what you're selling (value points and price), and the goal. It only repeats the briefing card, never hidden state. The briefing card also now says "You work for {company}."
- The call screen now fits a laptop screen without scrolling: the drawing is capped at 42% of the window height and the briefing scrolls inside its own box.

### Done
- **`js/debrief.js` (pure) + `js/debrief-view.js`:** the debrief in the brief's order:
  1. **Outcome**: icon + word, plus a one-line detail ("Hung up after 1:42.").
  2. **Who you called**: the exec, today's mood, starting patience, and personality, now revealed.
  3. **Patience over the call**: a hand-drawn SVG line chart with a dashed "Meeting possible (60+)" line. Each reaction is marked with a down triangle (drop), up triangle (gain), circle (no change), or hollow circle (technical retry), so shape carries the direction as well as color. Hovering over or tabbing to a point shows your line, the exec's reply, the move, and the reason. Under it: the "AI's judgment" note and **Call again**.
  4. **Where the call turned**: the largest single drop (earliest on ties), or "Patience never dropped".
  5. **Pain points**: "You uncovered 1 of 3", with each missed one's hint.
  6. **Objections**: each raised, handled or not, and what tends to work for unhandled ones.
  7. **The ask**: when, which line, how it was detected (phrase or AI), and the exec's answer.
  8. **Plain facts**: length, your lines, your share of words, silences, retries, spoken lines.
  9. **Full transcript**, with timestamps and each patience change, plus **Copy transcript** (plain text for notes or an assignment).
- **Past calls** (header link): the last 20 calls in this browser: date, exec, outcome, length, and **Open debrief**. Dropped calls are listed but left out of the Record.
- **Record**: calls per outcome, and pain points uncovered call by call. Tables, no scores or streaks.
- **Clear everything** also clears past calls.
- `dev/debrief-preview.html`: a sample call run through the real engine, shown as a debrief and a Past calls list (no API calls). `?tip=3` opens a chart tooltip.
- **87 Node tests, all passing** (10 new), including the brief's required cases: the turning point is the largest drop, earliest on ties, "none" when patience never dropped; the transcript text is stable for a fixed call; and dropped calls stay out of the Record.
- Chart colors were checked with the chart-color validator: red and green are distinguishable for colorblind viewers only with a second cue, which the triangle shapes and signed numbers provide.

### Decided on my own (please confirm)
- Past calls store a copy of the exec, offer, and mood with each call, so an old debrief still opens after the data files change.
- Outcome detail lines for student-ended calls avoid repeating the outcome word ("You ended the call after 2:05 without asking for a meeting.").

## Phase 4 — The exec on screen (done, awaiting review)

### Done
- **`js/exec-drawing.js`:** a flat SVG illustration built in code from each persona's `appearance`, with no image files. The exec sits at a desk, chest up, with a desk phone, a notepad, a monitor, and a window. All 300 skin/hair/outfit/glasses combinations draw; hair color doesn't change the shapes, so it isn't counted.
- **Poses** (brief §4.8): *Ringing* (phone buzzing, exec looking at the monitor) → *Picks up* (handset to ear) → *Listening* → *Talking* (mouth moves) → *Engaged* (leans in, raised brows, smile, nods) / *Neutral* / *Impatient* (looks away at the screen, frowns, sits back) / *Skeptical* (one eyebrow up after an objection) → *Hung up* (phone back on the desk, after the parting line) or *Meeting booked* (writes a note).
- **Honest body language:** `js/pose.js` takes the mood only from the patience band, so the exec can't lean in below the Engaged band. A test checks every patience value from 0 to 100.
- **Mouth:** follows the spoken words where the browser reports them (Chrome, Edge); otherwise a simple open-close loop while speaking.
- **Reduced motion:** with the computer's "reduce motion" setting on, nothing animates; poses change as still pictures, and a talking exec shows a still open mouth.
- **Screen readers** get the same cue in words (e.g., "Mike is glancing at the screen, looking away."), updated with each pose change.
- **All colors are CSS variables** in the `:root` block of `styles.css` (skin tones, hair, outfits, the office), so a brand palette swap still touches only that block.
- The phone panel beside the exec (name, title, company, elapsed timer) was already in place.
- `dev/exec-preview.html`: every exec in every pose on one page. Add `?only=kettle-creek-dental` (or any persona id) to see one exec large.
- **77 Node tests, all passing** (7 new).

### Decided on my own (please confirm)
- The debrief now appears 1.8 seconds after the call ends, so the student sees the exec hang up or write the note.
- Engaged is drawn clearly (bigger lean, raised brows): at a glance it looked too much like Neutral, and it's the student's only cue.

### Johnny's review
- Exec drawings approved as they are.

## Latency (success criterion 12)

Measured 2026-09-28 by Johnny, Chrome, typed input, `claude-sonnet-5`, from pressing Enter to the exec's first spoken word:

| Input | Turns | Each (ms) | Median |
|---|---|---|---|
| Typed | 5 | 3290, 3414, 4297, 4020, 3907 | **3.9 s** |
| Voice | 0 | none (no microphone on this computer) | not measured |

**The typed median is above 3 seconds**, so the call can feel slow. Nearly all of it is the provider: in the last turn, Anthropic took 3.1 s of the 3.3 s; the browser's voice added about 0.2 s. (Brief asks for 10 typed turns; 5 were measured, which is enough to show the pattern.)

Options for Johnny to choose from:
1. **Faster model:** set Model name to `claude-haiku-4-5` in Settings (no code change) and re-measure. Tradeoff: may be retired as soon as Oct 15, 2026, and it's less capable.
2. **Streaming** (brief §9, deferred): start speaking as soon as the exec's line arrives, before the rest of the reply. Estimated 0.5–1.5 s saved with any model. Tradeoff: a focused build, and a bad reply is caught after the exec has started talking.
3. **OpenAI `gpt-6-luna`** (reasoning off): switch provider in Settings and re-measure; needs an OpenAI key.

Recommended: try option 1 first (free, tells us how much model speed matters), then decide on option 2.

**Johnny's decision (2026-09-28):** the current speed is fine for now. The app's purpose at this stage is showing the concept, so no latency work. The options above stay on file for later (e.g. before students use it).

## Phase 3 — Voice (done; typed calls confirmed. Spoken input untested: this computer has no working microphone)

### Done
- **Click to talk** (changed from the brief's hold-the-spacebar, at Johnny's request): click **Click to talk** to start and **Click to send** when done. It's an ordinary button, so the keyboard works too (Tab to it, then Enter). The spacebar has no special job. While listening, the button turns red and the words the browser is hearing show under the transcript. If Send isn't clicked, the line is sent after 30 seconds (`MAX_TALK_SECONDS`).
- **Microphone permission is asked while the phone rings**, so the browser's pop-up never interrupts the first line. If it's blocked, the call switches to typing and says how to fix it (turn the mic on from the address-bar icon, **then reload the page**).
- **Mic blocked vs. speech service blocked are told apart.** If the mic is allowed but the browser's speech-to-text still refuses, the message says the speech service is off or blocked, which is common on work and school computers, and suggests another browser.
- **Settings → Test microphone:** listens for 5 seconds and shows what it heard, or exactly what went wrong. With `?debug=1`, the browser's own error name is shown too.
- **What the browser heard goes into the transcript as-is**, marked with 🎤, so a mishearing is visible. If nothing was caught: *"Didn't catch that. Hold to talk and try again."* No penalty.
- **The exec speaks** through the browser's voices. Each exec keeps one voice for the whole call, matched to their voice type (male/female), with their own speed and pitch. The pickup line is spoken too, after a 2-second ring.
- **Typed input is always there.** Without speech recognition (Firefox), the call starts in typed mode with *"Voice input isn't available in this browser. You can type your side of the call."* If the mic is blocked, there's no mic, or the speech service is unreachable, the call switches to typing with a one-line note on how to fix it.
- **One-time privacy note** before the first voice call, with a **Got it** button. It says Chrome and Edge send speech to Google's or Microsoft's service, that this app never records or stores audio, and that typing always works.
- **Silence:** 8 seconds after the exec finishes speaking with no response, the exec reacts ("Hello? You still there?") and patience drops by the fixed cost, with the reason *"Silence on the line."* Holding the talk button, or having text in the box, counts as responding, so slow typists aren't penalized.
- **Latency** is now measured the way the brief asks: from releasing the talk button (or pressing Enter) to the exec's first spoken word. The provider's share is kept separately. The debug panel (`?debug=1`) shows medians for typed and voice turns separately, plus which browser voice was chosen.
- The exec can't be interrupted: talking and typing are off while the exec is thinking or speaking (hands-free and interruptions are deferred, brief §9).
- Hanging up during the ring cancels the call without a debrief.
- **70 Node tests, all passing** (new: voice choice, latency grouping, speech-length estimate).

### Decided on my own (please confirm)
- **Added a `voice` field to each persona** (male/female, speed, pitch; see `data/SCHEMA.md`). Browsers don't label voices by gender, so the app matches on voice names (list in `constants.js`, easy to extend). Without it, Mike could get a female voice at random.
- **Typing counts as responding** for the silence timer, as above.
- **2-second ring** before pickup (`RING_SECONDS` in `constants.js`); it also gives the browser's voices time to load.
- **No mute button** for the exec's voice. Not in the brief; easy to add if students practice in shared spaces.

### Needed from you (success criterion 12)
Once voice works (Settings → Test microphone), using Chrome with `?debug=1`, make **10 typed turns and 10 voice turns** (across calls is fine), then send me the **"median latency"** line from the gray panel. It shows both medians. If the voice median is above 3 seconds, I'll record that here and list options (smaller model, streaming).

### Not verified yet
- Not tested in a real browser here; the speech features only exist in a browser. Checked: every file's syntax, every import, every element the code uses, and every copy string.
- Safari's speech recognition is partial; it may work, or may fall back to typing.

## Phase 2 — The provider layer (done; confirmed working)

### Done
- **Settings drawer** (slides in from the right): provider (Anthropic or OpenAI), API key with Show/Hide, model name with a "Use default" link, temperature slider labeled *"Higher = the same exec reacts less predictably"*, **Test connection**, Save/Cancel, and **Clear everything** (asks first).
- **Key-entry copy** in `copy.js`: what a key is, that a ChatGPT Plus or Claude Pro subscription isn't one, where to get one for each provider (link changes with the provider), that the key stays in this tab and goes only to that provider, and that usage is billed to the key's owner.
- **One key per provider**, both in `sessionStorage` (this tab only). Your Phase 1 key and model carry over automatically. Settings (provider, model names, temperature) go in `localStorage`. All storage lives in `js/storage.js`, wrapped so the app still works when storage is blocked.
- **OpenAI** added (Chat Completions, `gpt-6-luna`, reasoning effort `none`, forced JSON reply shape).
- **Every error has its own plain message and next step**: missing key, bad key, retired model, out of credit, busy line, provider trouble, network, timeout, empty reply, rejected request. No raw error text is shown to students.
- **Busy line:** on a 429 (or provider overload / server error), the app waits 2, 5, then 10 seconds and shows *"Line busy, retrying in N…"* with a live countdown. If it's still busy after that, the call ends cleanly as *Call dropped (connection problem)*, with a message saying it wasn't the student's fault.
- **20-second timeout** per request, so a stuck request can't freeze the call.
- **Debug panel** (`?debug=1`): provider, model, each turn's latency, **median latency**, and any options a model rejected. In debug mode, latency is also written to the browser console. Test connection shows the provider's error detail only in debug mode.
- **61 Node tests, all passing** (11 new: error sorting, key redaction, backoff timing, both request formats, retry without a rejected option, Test connection, storage).

### Decided on my own (please confirm)
- **Out-of-credit errors are their own case** ("add credit on the billing page") and are never retried, because waiting won't fix them. The brief didn't list this one, but a new key with no credit is the most likely first-time failure.
- **Automatic fallback for rejected options:** if a model rejects temperature, reasoning effort, thinking, or the forced JSON format, the app resends once without it and remembers that for the session. This covers OpenAI's docs not saying whether `gpt-6-luna` accepts temperature. The debug panel lists what was dropped, and the temperature slider greys out with a note.
- **Server errors (5xx) and Anthropic "overloaded" (529)** get the same busy-line retries as a 429.
- **Anything that looks like a key is removed from error details** before they're kept anywhere. OpenAI echoes part of a wrong key in its error message.
- Provider, key, and model are fixed when a call starts, so changing Settings mid-call affects the next call.

## Phase 1 — The call, in text only (done; confirmed working with a real Anthropic key)

### How to try it
1. In this folder, run `python -m http.server 8000`, then open http://localhost:8000. (The page needs a web server; double-clicking `index.html` won't load the exec files.)
2. Click **Settings** and paste an Anthropic API key. The key stays in this browser tab only.
3. Read the briefing, click **Call**, and type your side of the call.
4. Add `?debug=1` to the address (http://localhost:8000/?debug=1) to see hidden patience, the reply the model sent, and latency during the call. This is for you, not students.
5. Tests: run `node --test` in this folder.

### Done
- `js/callState.js`: the state engine. Patience lives in code. The model's proposed change is clamped to −30…+15 and patience to 0…100. Only patience reaching 0 is **Hung up**. A meeting is booked only after a clear ask with patience at or above 60 after that turn's change. Pain point reveals and objections are checked against the exec's own list. Student end, time cap, and dropped call each have their own outcome. Silence and retry turns are ready for Phase 3.
- `js/execPrompt.js`: the exec's instructions, in plain editable text. A fixed part (who the exec is, the rules) plus a part rebuilt every turn (patience in words and number, what's revealed, objections, whether an ask was made).
- `js/replyParser.js`: reads and checks the model's JSON reply.
- `js/callController.js`: one exec turn. If the reply can't be read, it retries once with a repair instruction; if that fails, the exec says "Sorry, you cut out" and patience doesn't change.
- `js/askDetect.js`: the ask phrase list (from `constants.js`); the model can also flag an ask, and the app records which one caught it.
- `js/draw.js` + `js/rng.js`: seeded draw of exec, offer, mood, and pickup line. **Call again** reuses the seed.
- `js/bands.js`: patience → Engaged / Neutral / Impatient, for the drawing in Phase 4.
- `js/provider.js`: Anthropic only, with plain error messages (missing key, bad key, retired model, busy, network). Rate-limit retries, OpenAI, and Test connection come in Phase 2.
- `js/app.js`: briefing card, typed call screen with a phone timer and "Listening… / …" status, a minimal Settings dialog, a line-by-line review after the call (a stand-in for the Phase 5 debrief), and the `?debug=1` panel.
- **50 Node tests, all passing**, covering every Phase 1 case the brief lists: clamping, Hung up only at 0, meeting acceptance rules, pain point reveals, same seed → same draw, every drawn pair a real fit, invalid JSON → retry turn with no patience change, band mapping. They also check the content (banned words, valid ids).

### Not verified yet
- **No real call has been run**, because there was no API key on this machine. All logic is tested with a fake provider. The first real call will confirm that Sonnet 5 accepts the request as built: forced JSON reply shape, thinking off, no temperature. If it doesn't, the error shows plainly in the debug panel.
- Not yet opened in a real browser. Files serve correctly from a local server, every module passes a syntax check, and every import resolves.
- Latency: not measured yet (needs a key). The first turn with each exec may be slower while the provider prepares that exec's reply format.

### Decided on my own (please confirm)
- **Forced JSON reply (structured output).** Anthropic is told the exact reply shape, and the allowed pain point and objection ids are listed in it. That should make unreadable replies rare. The code still checks every reply. Can be turned off in `constants.js` (`USE_STRUCTURED_OUTPUT`).
- **Thinking turned off** for speed (`DISABLE_THINKING` in `constants.js`).
- **Prompt caching:** the fixed part of the exec's instructions is marked for caching, which should make turns after the first faster and cheaper.
- **Added `studentMadeAsk` to the model's reply** so it can flag an ask the phrase list misses (brief §4.5 allows the model to mark it).
- **Where patience changes are recorded:** on the exec's reply, with the reason. The student line that caused it is the one just before. Silence works the same way: the fixed cost and "Silence on the line." sit on the exec's reaction.
- An **empty reply** from the provider is treated like an unreadable reply (retry turn), not a dropped call.
- Added `package.json` with only `"type": "module"`, so `node --test` can load the files. No dependencies and no build script; Vercel serves the folder as-is.
- The ask phrase list now matches "15 minute" (so it also catches "15-minute" and "15 minutes") and a few more phrasings.

## Phase 0 — Scaffold, content, provider check (done, reviewed)

### Johnny's decisions (2026-09-28)
- Content approved, with simpler exec names: Mike Brooks, Anna Reyes, Nina Shah, Beth Olson, Marcus Hill.
- Default provider: Anthropic.
- App name: Cold Call Lab.
- Anthropic model left to the builder: `claude-sonnet-5`. Haiku 4.5 may retire as soon as Oct 15, 2026; Sonnet 5 is safe until at least June 30, 2027. Temperature is left out of requests for Sonnet 5 because it rejects the setting. The Settings temperature control will say so when that model is selected.

### Done
- Folder structure: `index.html`, `styles.css`, `js/` (`app.js`, `constants.js`, `copy.js`), `data/`, `dev/`, `docs/`.
- `index.html` shell with the three screens (Briefing, Call, Debrief). All text comes from `js/copy.js`.
- `styles.css`: every color is a variable in the `:root` block. Outcome colors on white: green 5.0:1, red 6.6:1.
- `js/constants.js`: models, patience ranges, thresholds, bands, timings, moods, ask phrases, appearance options, storage keys. Each has a plain-language comment.
- Content drafted for review: 5 personas, 3 offers, 8 objections in `data/`. A check script confirmed all ids, appearance values, and persona/offer fits, and found no banned words.
- `data/SCHEMA.md`: plain-language schema reference.
- `dev/provider-check.html`: a one-word test from the browser to either provider, using your own key.
- A copy of the build brief is in `docs/`.

### Provider findings (checked 2026-09-28)
- **Anthropic accepts direct browser calls.** The preflight allows the `anthropic-dangerous-direct-browser-access` header. With the header, responses carry `access-control-allow-origin: *`. Without it, there are no CORS headers, so the browser would block the response. The header is required.
- **OpenAI accepts direct browser calls.** The preflight echoes the origin and allows `authorization, content-type`. Error responses (401) also reach the page.
- **Anthropic models:** Claude Haiku 4.5 (`claude-haiku-4-5`) is the fastest and cheapest, but retirement is listed as "not sooner than October 15, 2026," 17 days from now. Claude Sonnet 5 (`claude-sonnet-5`) is listed as "Fast" and is safe until at least June 30, 2027, **but returns a 400 error if `temperature` is set.** Default set to `claude-sonnet-5`. The provider layer will leave temperature out for models in `MODELS_WITHOUT_TEMPERATURE`.
- **OpenAI models:** GPT-6 Luna (`gpt-6-luna`) is listed as the cheapest and fastest, and works with Chat Completions. OpenAI recommends reasoning effort `none` for the lowest latency. The docs don't say whether it accepts `temperature`. `dev/provider-check.html` has a checkbox to test that.
- Not yet run: a real one-word call with a valid key. The check was done with an invalid key and CORS preflights only. Run `dev/provider-check.html` with your keys to close this out.

### Decided on my own (please confirm)
- Added `addressedBy` to each pain point, so the "real fit" rule can be tested (see `data/SCHEMA.md`).
- Added a fourth mood ("between meetings and distracted", 45) to the three in the brief.
- Engaged band and acceptance threshold both start at 60. The Impatient band is below 30.
- Named the exec and product differently from the brief's example (Dana/Harlan Freight/RouteWise), because "RouteWise" is used by real businesses. No trademark search was done on the new names.

