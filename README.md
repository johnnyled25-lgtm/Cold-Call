# Cold Call Lab

A practice lab where a student cold-calls an AI executive, drawn on screen, who answers the phone and reacts to exactly what the student says. The goal of every call is a booked 15-minute meeting. Afterward, a debrief shows how the exec's hidden patience moved line by line and why.

It's a static website: plain HTML, CSS, and JavaScript. No build step, no server, no accounts, no analytics.

**Live:** https://coldcall-lab.vercel.app (deployed on Vercel from the `main` branch of https://github.com/johnnyled25-lgtm/Cold-Call; every push to `main` redeploys it).

---

## Run it on your computer

The app must be opened from a web server; double-clicking `index.html` won't load the exec files.

```
cd cold-call-lab
python -m http.server 8000
```

Then open **http://localhost:8000** in Chrome or Edge. Stop the server with Ctrl+C.

## Deploy it

The repo is public, and that's safe: API keys are never saved in any file (see *Keys and privacy*).

**Vercel**
1. Push this folder to a GitHub repository.
2. In Vercel: **Add New → Project**, import the repository.
3. Framework preset: **Other**. Leave **Build Command** empty. Output directory: the repository root.
4. Deploy. The `package.json` only exists so the tests can run; it has no dependencies or build script.

**GitHub Pages**
1. Push this folder to a GitHub repository.
2. **Settings → Pages → Deploy from a branch**, choose `main` and `/ (root)`.
3. The site appears at `https://<your-user>.github.io/<repo-name>/`.

## Using it

1. Click **Settings**, choose a provider (Anthropic or OpenAI), and paste an API key. Get one at [console.anthropic.com](https://console.anthropic.com/settings/keys) or [platform.openai.com](https://platform.openai.com/api-keys). A Claude Pro or ChatGPT Plus subscription is **not** an API key.
2. Click **Test connection** to check the key. Use **Test microphone** to check voice input.
3. Read the briefing, click **Call**, and talk (click to talk, click to send) or type.
4. After the call, read the debrief. **Call again** repeats the same exec, offer, and mood. **Past calls** lists your last 20.

Add `?debug=1` to the address (e.g. `http://localhost:8000/?debug=1`) to see the hidden patience, the raw AI reply, and response times during a call. That's for you, not students.

---

## Changing things

Every setting is one commented line; edit, save, and reload the page.

| To change… | Edit | Look for |
|---|---|---|
| The default model name | `js/constants.js` | `DEFAULT_MODELS` |
| The default provider | `js/constants.js` | `DEFAULT_PROVIDER` |
| When the exec can agree to a meeting | `js/constants.js` | `ACCEPTANCE_THRESHOLD` (default 60) |
| Seconds of silence before the exec reacts | `js/constants.js` | `SILENCE_TIMEOUT_SECONDS` (default 8) |
| Patience lost to silence | `js/constants.js` | `SILENCE_COST` |
| Biggest drop / gain per line | `js/constants.js` | `DELTA_MIN`, `DELTA_MAX` |
| Body-language bands | `js/constants.js` | `BANDS` |
| Call time limit | `js/constants.js` | `CALL_TIME_CAP_MINUTES` |
| Moods and starting patience | `js/constants.js` | `MOODS` |
| Phrases that count as "the ask" | `js/constants.js` | `ASK_PHRASES` |
| Any words a student sees | `js/copy.js` | (all copy lives here) |
| How the exec behaves | `js/execPrompt.js` | the instructions sent to the AI, as plain text |

**If calls fail with "This model name may have been retired"**, the provider has renamed its models. Type the provider's current model name in **Settings → Model name**, or change `DEFAULT_MODELS` in `js/constants.js`.

### Editing execs, offers, and objections

The content is in `data/` (field-by-field notes in `data/SCHEMA.md`):

- `personas.json`: the execs. Each has 3 pain points; `earnedBy` says what kind of question reveals one, and `addressedBy` lists which offers could help with it. `appearance` and `voice` must use the values listed in `js/constants.js` (`APPEARANCE_OPTIONS`, male/female).
- `offers.json`: what the student sells. `fitsPersonaIds` may only list execs with **at least two** pain points the offer addresses; other pairs are never drawn.
- `objections.json`: the lines execs use to end or deflect a call, and what handles each.

Keep everything fictional: no real companies, products, or people. After editing, run the tests (below); they check that ids match, every pairing is a real fit, and no banned words slipped into student-facing text.

To see how an exec will look: `http://localhost:8000/dev/exec-preview.html`. To see a sample debrief: `http://localhost:8000/dev/debrief-preview.html`.

---

## Keys and privacy

- The API key is kept in the browser tab's `sessionStorage` only. It's forgotten when the tab closes, and it's never written to any file, log, or URL. It goes only to the provider you chose.
- Settings and past calls are kept in this browser's `localStorage`. **Settings → Clear everything** removes keys, settings, and past calls.
- Audio is never recorded, stored, or sent by this app. In Chrome and Edge, the browser's own speech-to-text sends your voice to Google's or Microsoft's speech service; students see a one-time note about this.
- **Before students use it:** each student would need their own API key, billed to them. The planned fix is a small key-hiding proxy (a serverless function holding your key with a daily limit per user); it isn't built yet.

## Browser support

| Browser | Typed calls | Voice input | Exec's voice |
|---|---|---|---|
| Chrome, Edge (desktop) | Yes | Yes (needs a microphone) | Yes |
| Firefox | Yes | No: starts in typed mode and says so | Yes |
| Safari | Yes | Partial (may fall back to typing) | Yes |

Desktop and laptop first; tablets work; phones aren't supported yet.

## Known limitations

- **Response time:** about 3–4 seconds per exec reply with `claude-sonnet-5` (measured 2026-09-28). Options to speed it up are in `STATUS.md`.
- The exec can't be interrupted while talking; you click to talk, then click to send (hands-free is deferred).
- Voice input depends on the browser's speech service; managed school or work computers may block it. Typing always works.
- Patience changes are the AI's judgment, so the same line can land differently on another call. The debrief says so.
- Voice input hasn't been tested with a real microphone yet (the development computer had none).

## Tests

```
node --test
```

Runs the checks for every pure module: the patience engine, the AI-reply checker, ask detection, the seeded draw, the prompt builder, body-language bands, the debrief analysis, the transcript text, storage, and the content rules. Requires Node 18 or newer.

## Files

```
index.html          the page: briefing, call, debrief, past calls, settings
styles.css          all styling; every color is a variable at the top
js/constants.js     every number, threshold, and model name
js/copy.js          every word a student sees
js/execPrompt.js    the exec's instructions to the AI
js/callState.js     the patience engine (patience lives here, not in the AI)
js/provider.js      talking to OpenAI or Anthropic
js/voice.js         speech in and out
js/exec-drawing.js  the drawn exec (SVG, no images)
js/debrief*.js      the debrief analysis and screen
js/app.js           ties the screens together
data/               execs, offers, objections
dev/                developer pages (previews, provider check)
tests/              Node tests
```
