// Cold Call Lab — every word a student sees.
// Edit the text between the quotes. Keep explainer paragraphs under 70 words.
// Words inside {curly braces} are filled in by the app; leave them as they are.
// Some text is still placeholder; final copy is written in Phase 6.

export const COPY = {
  appName: "Cold Call Lab",

  // Header tabs and moving around the app.
  nav: {
    home: "Home",
    briefing: "Briefing",
    backToPast: "← Back to Past calls",
    leaveCall: "End this call? It will be saved to Past calls.",
  },

  // Screen names for the browser tab and history ("Cold Call Lab · Debrief").
  titles: {
    home: "Cold Call Lab",
    briefing: "Briefing · Cold Call Lab",
    call: "On a call · Cold Call Lab",
    debrief: "Debrief · Cold Call Lab",
    past: "Past calls · Cold Call Lab",
    gallery: "Exec gallery · Cold Call Lab",
  },

  // The introduction page (home).
  home: {
    title: "Practice cold calls with an exec who can hang up on you.",
    tagline: "Call an AI executive, try to book a 15-minute meeting, and see exactly where the call turned.",
    start: "Start a call",
    seePast: "See past calls",
    howHeading: "How it works",
    steps: [
      { title: "Read the briefing", text: "Who you're calling, what you know about them, and what you're selling. The goal is a meeting, not a sale." },
      { title: "Make the call", text: "Talk or type. The exec has a patience level you can't see; their body language is your only clue." },
      { title: "Read the debrief", text: "See how patience moved line by line, why, which problems you uncovered, and where the call turned." },
    ],
    readyHeading: "Before you start",
    keyOk: "API key added ({provider}).",
    keyMissing: "No API key yet. Calls need one; it stays in this browser tab only.",
    keyAdd: "Add key",
    browserEdge: "You're in Microsoft Edge: the execs get its most natural voices.",
    browserOther: "Tip: Microsoft Edge has the most natural exec voices. Any modern browser works.",
    voiceYes: "Voice input works in this browser (a microphone is optional; you can always type).",
    voiceNo: "Voice input isn't available in this browser, so you'll type your side of the call.",
  },

  // Who the student plays on every call. Shown on the briefing card.
  student: {
    name: "Jordan",
    role: "sales rep",
  },

  briefing: {
    heading: "Briefing",
    youAreCalling: "Who you're calling",
    whatYouKnow: "What you know about them",
    whatYouSell: "What you're selling",
    price: "Price",
    goalHeading: "Your goal",
    goal: "Book a 15-minute meeting. You're not trying to make a sale on this call.",
    youAreHeading: "You are",
    youAre: "{name}, {role} at {company}",
    callButton: "Call",
    callButtonName: "Call {first}",
    randomButton: "Random exec",
    eyebrow: "You're calling",
    knowHeading: "What you know about them",
    knowSize: "Size",
    knowSetup: "How they work today",
    sellHeading: "What you're selling",
    sellFrom: "from {company}",
    loading: "Loading…",
    loadFailed: "The exec files couldn't be loaded. Open this app from a web server, not by double-clicking the file.",
  },

  call: {
    heading: "Call",
    ringing: "Ringing…",
    listening: "Listening…",
    thinking: "…",
    talkButton: "Talk (click, then click again to send)",
    typePlaceholder: "Type what you'd say, then press Enter",
    send: "Send",
    endCall: "End call",
    you: "You",
    connectionTrouble: "Call dropped (connection problem)",
    lineBusy: "Line busy, retrying in {seconds}…",
    talkRelease: "Send what you said",
    briefingToggle: "Your briefing",
    calling: "Calling…",
    goalChip: "Goal: book a 15-minute meeting",
    hangUp: "Hang up",
    execThinking: "{first} is thinking",
    briefYouAre: "You are",
    briefCalling: "Calling",
    briefKnow: "What you know",
    briefSetup: "Their setup",
    briefSelling: "Selling",
    briefPoints: "Key points",
    briefPrice: "Price",
  },

  // What the drawn exec is doing, for screen readers. Same cue as the picture, in words.
  exec: {
    describe: {
      ringing: "{first}'s desk phone is ringing. {first} is reading something on the desk.",
      engaged: "{first} is leaning in and nodding.",
      neutral: "{first} is listening.",
      impatient: "{first} is frowning and looking away.",
      skeptical: "{first} raises an eyebrow, unconvinced.",
      hungUp: "{first} lowers the phone.",
      booked: "{first} is writing a note.",
    },
  },

  voice: {
    privacyTitle: "Before your first voice call",
    privacyBody:
      "In Chrome and Edge, what you say is sent to Google's or Microsoft's speech service to be turned into text. This app never records, stores, or sends audio itself. Firefox can't do voice input, and Safari's support is partial. You can always type instead.",
    privacyOk: "Got it",
    recording: "Listening to you… click the mic again to send",
    didntCatch: "Didn't catch that. Click to talk and try again.",
    spoken: "(spoken)",
    unavailable: "Voice input isn't available in this browser. You can type your side of the call.",
    micBlocked:
      "The microphone is blocked for this site, so type your side of this call. To use voice: click the icon at the left end of the address bar, turn Microphone on, then reload the page.",
    serviceBlocked:
      "The microphone works, but this browser's speech-to-text service is turned off or blocked. This is common on work and school computers. Type your side of the call, or try another browser (Chrome or Edge).",
    noMic: "Voice input isn't available: no microphone was found. You can type your side of the call.",
    micPending: "To talk, answer the browser's microphone pop-up (Allow). You can type in the meantime.",
    serviceDown: "The browser's speech service couldn't be reached. You can type your side of the call.",
    // Settings → Test microphone
    testHeading: "Voice",
    test: "Test microphone",
    testStop: "Stop test",
    testListening: "Say something… (stops by itself in {seconds} seconds)",
    testAsking: "Asking the browser for the microphone…",
    testHeard: "Working. Heard: “{text}”",
    testNothing: "The microphone is on, but no words came through. Check that the right microphone is selected in your computer's sound settings, then try again.",
  },

  // What the exec says when they pick up. One is chosen per call.
  pickupLines: ["{first} speaking.", "This is {first}.", "{company}, this is {first}.", "{first}."],

  // What the exec says when the app can't read the AI's reply. The student isn't penalized.
  retryLine: "Sorry, you cut out. Say that again?",

  // What the exec says if the AI twice tried to agree to a meeting the app can't
  // allow yet (patience too low or no clear ask). Keeps words and state consistent.
  notReadyLine: "I'm not putting anything on the calendar yet.",

  // Reasons the app records itself (not written by the AI).
  reasons: {
    silence: "Silence on the line.",
    retry: "Technical issue: the AI's reply couldn't be read. This didn't count against you.",
    pickup: "Picked up the phone.",
  },

  debrief: {
    heading: "Debrief",
    judgmentNote:
      "Patience changes are the AI's judgment of how this exec would react. Call the same exec again and the same line may land differently.",
    callAgain: "Call again",
    callAgainHint: "Same exec, offer, and mood",
    newExec: "New exec",
    copyTranscript: "Copy transcript",
    copied: "Copied. Paste it into your notes.",
    copyFailed: "Couldn't copy automatically. Select the transcript below and copy it by hand.",

    // 1. Outcome: the word, then one line of detail.
    outcomeLines: {
      meetingBooked: "Meeting booked after {time}.",
      hungUp: "Hung up after {time}.",
      askedNoMeeting: "You asked, and ended the call after {time} without a meeting.",
      noAsk: "You ended the call after {time} without asking for a meeting.",
      timesUp: "Time's up after {time}.",
      dropped: "Call dropped (connection problem) after {time}. This wasn't your fault, and it isn't counted in your Record.",
    },

    outcomeEyebrow: "How it ended",
    bannerLength: "Length {time}",
    bannerPains: "Pain points {found} of {total}",
    bannerAsks: "Asks {n}",

    // 2. Who you called
    whoHeading: "Who you called",
    whoYouCalled: "{name} was {mood}. Starting patience: {start}.",
    personalityLabel: "What {first} is like",
    moodPill: "Mood: {mood}",
    startPill: "Starting patience {start}",

    // 3. Patience over the call
    chartHeading: "Patience over the call",
    chartCaption: "Each point is {first}'s reaction to one of your lines. Hover over or tab to a point to see why it moved.",
    chartStart: "Start",
    chartThreshold: "Meeting possible ({value}+)",
    chartTurnLabel: "Where the call turned",
    chartPointLabel: "Reaction {n}: patience {before} to {after} ({delta}). {line} Reason: {reason}",

    // 4. Where the call turned
    turnedHeading: "Where the call turned",
    turnedNone: "Patience never dropped on this call.",
    patienceMove: "Patience {before} → {after} ({delta})",
    reasonLabel: "Reason (AI's judgment)",
    turnPatience: "Patience",

    // 5. Pain points
    painsHeading: "Pain points",
    painSummary: "You uncovered {found} of {total} pain points.",
    painFound: "Uncovered",
    painMissed: "Missed",
    painHint: "a question that {earnedBy} would have brought this out",
    painHintCard: "Hint: a question that {earnedBy} would have brought this out.",

    // 6. Objections
    objectionsHeading: "Objections",
    objectionsNone: "{first} didn't raise any objections.",
    handled: "Handled",
    notHandled: "Not handled",
    whatWorks: "What tends to work: {text}",

    // 7. The ask
    askHeading: "The ask",
    askNone: "You didn't ask for a meeting. The goal of the call is a booked 15-minute meeting.",
    askCountOne: "You asked for a meeting once.",
    askCountMany: "You asked for a meeting {n} times.",
    askBookedBy: "Ask {n} booked the meeting.",
    askNoneBooked: "None of your asks booked a meeting.",
    askItem: "Ask {n}, at {time} (your line {line} of {total})",
    askReply: "{first}: “{text}”",
    askBooked: "Booked the meeting",
    askNotBooked: "No meeting",
    askByPhrase: "Counted as an ask because it included “{phrase}”.",
    askByModel: "Counted as an ask by the AI's reading of your line.",

    // 8. Plain facts
    factsHeading: "Plain facts",
    tileLength: "Call length",
    tileLines: "Your lines",
    tileShare: "Your share of the words",
    tileSilences: "Silences",
    tileRetries: "Technical retries (not counted against you)",
    tileVoice: "Spoken lines (check the transcript for mishearings)",

    // 9. Full transcript
    transcriptHeading: "Full transcript",
    silence: "(silence)",

    // Plain-text version (Copy transcript)
    textTitle: "Cold Call Lab: call transcript",
    textDate: "Date",
    textOutcome: "Outcome",
    textExec: "Exec",
    textMood: "Mood",
    textStarting: "starting patience",
    textSelling: "You were selling",
    textPatience: "Patience",
    textReason: "Reason (AI's judgment)",
  },

  pastCalls: {
    navLink: "Past calls",
    heading: "Past calls",
    note: "Your last 20 calls, saved in this browser only. Audio is never saved.",
    empty: "No calls yet. Your calls will appear here after you make them.",
    colDate: "Date",
    colExec: "Exec",
    colOutcome: "Outcome",
    colLength: "Length",
    open: "Open debrief",
    cardPains: "Pain points {found}/{total}",
    cardSpark: "Patience went from {start} to {end}.",
    cardAria: "{name}, {outcome}, {date}",
    colOpen: "Open",
    recordHeading: "Record",
    recordNote: "Counts only. Calls dropped for connection problems aren't included.",
    colCalls: "Calls",
    painsHeading: "Pain points uncovered, call by call",
    colPains: "Uncovered",
    painsCell: "{found} of {total}",
    back: "Back to briefing",
  },

  outcomes: {
    meetingBooked: "Meeting booked",
    hungUp: "Hung up",
    askedNoMeeting: "Asked, no meeting",
    noAsk: "No ask made",
    timesUp: "Time's up",
    dropped: "Call dropped",
  },

  // "What is happening here" panels: two short paragraphs per screen, each under 70 words.
  explainers: {
    toggle: "What is happening here",
    whatLabel: "What this does",
    whyLabel: "Why it matters",
    briefing: {
      what: "This card is everything you know before you dial: who the exec is, what their company does, and what you're selling. The exec has problems your offer could help with, but they won't mention them unless you ask the right kind of question. Your goal is a 15-minute meeting, not a sale.",
      why: "Real cold calls start with a few minutes of homework. Knowing the exec's world lets you open with a reason that matters to them instead of a script. Read the card, pick one question you'd ask, then call.",
    },
    call: {
      what: "The exec has a patience level you can't see. Every line you say moves it up or down. After the call, the debrief shows you the whole thing, line by line, so you can see exactly where you won or lost their attention.",
      why: "On a real call you can't see what the other person is thinking; you only get their words and their manner. Here, body language is your only clue. Leaning in means it's landing. Looking away means you're losing them. Keep it short, ask about their world, and ask for the meeting when it makes sense.",
    },
    debrief: {
      what: "This is the call again, with the exec's hidden side shown: how their patience moved after each of your lines and why, which problems you uncovered, and which objections came up. The reasons are the AI's judgment of how this exec would react, not a verdict on you.",
      why: "One call teaches more when you can see where it turned. Find the line that cost the most, think about what you'd say instead, and call the same exec again to test it. There's no score here on purpose: the skill is reading the person, not chasing a number.",
    },
  },

  settings: {
    heading: "Settings",
    close: "Close",
    provider: "AI provider",
    providerNames: { anthropic: "Anthropic (Claude)", openai: "OpenAI (ChatGPT)" },
    apiKey: "API key",
    showKey: "Show",
    hideKey: "Hide",
    keyWhat:
      "An API key is like a password that lets this app ask an AI provider for the exec's replies. Each reply is billed to whoever owns the key.",
    keyNotSubscription:
      "A ChatGPT Plus or Claude Pro subscription is not an API key. Those plans are for the chat apps. API keys come from a separate developer account with its own billing.",
    keyWhere: "Get a key:",
    keyLinks: {
      anthropic: { label: "console.anthropic.com → API keys", url: "https://console.anthropic.com/settings/keys" },
      openai: { label: "platform.openai.com → API keys", url: "https://platform.openai.com/api-keys" },
    },
    keyPrivacy:
      "Your key stays in this browser tab and is forgotten when you close it. It goes only to the provider you chose, and it's never saved in this app's files.",
    needKey: "Add an API key to place a call.",
    model: "Model name",
    modelNote: "If calls fail because a model was retired, type the provider's current model name here.",
    modelReset: "Use default ({model})",
    temperature: "Temperature",
    temperatureNote: "Higher = the same exec reacts less predictably",
    test: "Test connection",
    testing: "Testing…",
    testOk: "Connected. {provider} answered in {seconds} s.",
    testFailed: "Didn't connect: {message}",
    save: "Save",
    cancel: "Cancel",
    clearEverything: "Clear everything",
    clearNote: "Removes your keys, settings, and past calls from this browser.",
    clearConfirm: "Clear your keys, settings, and past calls from this browser?",
    cleared: "Cleared.",
  },

  // Plain messages for each kind of provider problem, each with a next step.
  errors: {
    missing_key: "Add an API key in Settings to place a call.",
    auth: "The provider didn't accept this API key. Check that it was copied whole, or make a new one, then paste it in Settings.",
    model: "This model name may have been retired. Change it in Settings.",
    quota: "This key's account is out of credit or over its spending limit. Add credit in the provider's billing page, then try again.",
    rate_limit: "The line stayed busy after three retries, so the call ended. This wasn't your fault. Wait a minute, then call again.",
    server: "The provider is having trouble right now, so the call ended. This wasn't your fault. Try again in a few minutes.",
    network: "Couldn't reach the provider. Check your internet connection, then try again.",
    timeout: "The provider took too long to answer, so the call ended. Try again in a moment.",
    empty: "The provider sent back an empty reply. Try again, or pick a different model in Settings.",
    bad_request: "The provider rejected the request. This model may not work with this app; try the default model in Settings.",
    other: "Something went wrong with the provider. Try again in a moment.",
  },
};

// Fill {placeholders} in a copy string: fill("Hi {name}", { name: "Mike" }) → "Hi Mike".
export function fill(template, values) {
  return template.replace(/\{(\w+)\}/g, (match, key) => (key in values ? String(values[key]) : match));
}
