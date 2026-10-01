// Cold Call Lab — settings you can change.
// Every number, name, and threshold the app uses lives in this file.
// Change the value after the "=" or ":" and save. Each line has a note above it.

// ---------------------------------------------------------------------------
// AI providers and models
// ---------------------------------------------------------------------------

// Which provider is selected the first time someone opens Settings.
// Either "openai" or "anthropic".
export const DEFAULT_PROVIDER = "anthropic";

// The model each provider uses unless changed in Settings.
// Providers retire model names; if calls start failing with "model not found",
// put the provider's current model name here (or type it in Settings).
// Checked against both providers' docs on 2026-09-28.
export const DEFAULT_MODELS = {
  // Claude Sonnet 5: listed as "Fast" by Anthropic, retirement not before June 30, 2027.
  // (Claude Haiku 4.5 is faster and cheaper but may retire as soon as Oct 15, 2026.)
  anthropic: "claude-sonnet-5",
  // GPT-6 Luna: OpenAI's fastest and cheapest current model.
  openai: "gpt-6-luna",
};

// Some newer models refuse a custom temperature and return an error if one is sent.
// For any model listed here, the app leaves temperature out of the request.
export const MODELS_WITHOUT_TEMPERATURE = ["claude-sonnet-5", "claude-opus-5", "claude-opus-5-5", "claude-fable-5-1"];

// How unpredictable the exec is. 0 = most predictable, 1 = most varied.
export const DEFAULT_TEMPERATURE = 0.8;

// The most words (roughly) the model may write per exec reply. Replies are short, so this stays small.
export const MAX_REPLY_TOKENS = 400;

// Turn the model's private "thinking" off, because thinking adds seconds to every reply.
// Some models can't turn it off and return an error if asked; those are listed below.
export const DISABLE_THINKING = true;
export const MODELS_THINKING_ALWAYS_ON = ["claude-opus-5-5", "claude-fable-5-1", "claude-fable-5"];

// Ask the provider to force every reply into the exact JSON shape the app expects.
// Leave true unless a model rejects it.
export const USE_STRUCTURED_OUTPUT = true;

// OpenAI only: how much private reasoning the model does before answering.
// "none" is fastest (OpenAI's own advice for low latency). Sent only to models whose
// names start with one of the prefixes below; older models reject it.
export const OPENAI_REASONING_EFFORT = "none";
export const OPENAI_REASONING_MODEL_PREFIXES = ["gpt-5", "gpt-6", "o1", "o3", "o4"];

// Seconds to wait for the provider before giving up on one request.
export const REQUEST_TIMEOUT_SECONDS = 20;

// Anthropic API version header. Only change this if Anthropic's docs say to.
export const ANTHROPIC_API_VERSION = "2023-06-01";

// Wait times, in seconds, between retries when a provider says "too many requests".
export const RATE_LIMIT_BACKOFF_SECONDS = [2, 5, 10];

// ---------------------------------------------------------------------------
// Patience — the exec's hidden willingness to stay on the call (0 to 100)
// ---------------------------------------------------------------------------

// Lowest and highest possible patience.
export const PATIENCE_MIN = 0;
export const PATIENCE_MAX = 100;

// The biggest drop and the biggest gain a single student line can cause.
export const DELTA_MIN = -30;
export const DELTA_MAX = 15;

// The exec can agree to a meeting only when patience is at or above this number
// AND the student has clearly asked for one.
export const ACCEPTANCE_THRESHOLD = 60;

// Body-language bands. These set what the student sees during the call.
// At or above ENGAGED_MIN: leans in, nods. Below IMPATIENT_BELOW: checks watch, looks away.
// Anything in between: neutral.
export const BANDS = {
  ENGAGED_MIN: 60,
  IMPATIENT_BELOW: 30,
};

// ---------------------------------------------------------------------------
// Timing
// ---------------------------------------------------------------------------

// Seconds of silence (after the exec finishes speaking) before the exec reacts,
// when the student is talking by voice.
export const SILENCE_TIMEOUT_SECONDS = 8;

// The same, in milliseconds, when the student is typing. Typing takes longer than
// talking, so a typist gets more time. Every keystroke starts the countdown over,
// and it never runs out while there's text in the box.
export const SILENCE_TIMEOUT_TYPED_MS = 20000;

// Extra time before the student's FIRST line, for getting the opener together.
export const FIRST_TURN_GRACE_MS = 10000;

// If the exec's voice hasn't started after this many seconds, the student gets the
// turn back anyway (the exec's line is already on screen).
export const SPEECH_START_TIMEOUT_SECONDS = 3;

// How much patience a silence costs.
export const SILENCE_COST = -8;

// The longest a call can run, in minutes, before it ends as "Time's up".
export const CALL_TIME_CAP_MINUTES = 6;

// How long the phone rings before the exec picks up, in seconds.
export const RING_SECONDS = 2;

// The longest the phone rings while waiting for the student to answer the browser's
// microphone pop-up. After this, the exec picks up anyway and the student can type
// until the pop-up is answered.
export const MIC_WAIT_SECONDS = 4;

// ---------------------------------------------------------------------------
// Voice
// ---------------------------------------------------------------------------

// The language the browser listens for and speaks in.
export const SPEECH_LANG = "en-US";

// Talking is click to start, click to send. If the student forgets to click Send,
// the line is sent automatically after this many seconds.
export const MAX_TALK_SECONDS = 30;

// The exec's speaking speed and pitch are set per exec in personas.json ("voice").
// These keep them in a range that still sounds natural.
export const VOICE_RATE_RANGE = [0.92, 1.08];
export const VOICE_PITCH_RANGE = [0.9, 1.1];

// Voices are ranked by how natural they sound, from words in their names.
// First: Edge's neural voices ("... Online (Natural)"). Then Google's. Then anything else.
// The exec's voice type (male/female) still comes first where the browser has a match.
export const VOICE_QUALITY_TIERS = [["natural", "online"], ["google"]];

// How the patience band changes delivery, added to the exec's own rate and pitch.
// Impatient: a little faster and flatter (lower pitch).
export const BAND_DELIVERY = {
  engaged: { rate: 0, pitch: 0.02 },
  neutral: { rate: 0, pitch: 0 },
  impatient: { rate: 0.06, pitch: -0.05 },
};
// Limits for the final rate and pitch after the band's change.
export const DELIVERY_RATE_LIMITS = [0.88, 1.15];
export const DELIVERY_PITCH_LIMITS = [0.85, 1.12];

// Each reply is spoken sentence by sentence, with a pause of this many milliseconds
// (somewhere in the range) between sentences.
export const SENTENCE_GAP_MS = [150, 250];

// Browsers don't label their voices as male or female, so the app looks for these
// words in the voice's name. Add names here if your browser's voices aren't matched.
export const VOICE_NAME_HINTS = {
  female: ["female", "zira", "aria", "jenny", "michelle", "emma", "ava", "samantha", "victoria", "karen",
    "moira", "tessa", "susan", "hazel", "libby", "sonia", "natasha", "allison", "joanna", "google us english"],
  male: ["male", "david", "mark", "guy", "andrew", "brian", "christopher", "eric", "roger", "steffan",
    "daniel", "alex", "fred", "tom", "aaron", "arthur", "george", "ryan", "matthew"],
};

// ---------------------------------------------------------------------------
// Outcomes and content rules
// ---------------------------------------------------------------------------

// How a call can end. The words students see are in copy.js under "outcomes".
// "dropped" means a connection problem; it is left out of the Record.
export const OUTCOMES = {
  MEETING_BOOKED: "meetingBooked",
  HUNG_UP: "hungUp",
  ASKED_NO_MEETING: "askedNoMeeting",
  NO_ASK: "noAsk",
  TIMES_UP: "timesUp",
  DROPPED: "dropped",
};

// An offer "fits" an exec only if it could help with at least this many of their pain points.
export const MIN_FIT_PAIN_POINTS = 2;

// ---------------------------------------------------------------------------
// Moods — drawn at the start of each call, revealed only in the debrief
// ---------------------------------------------------------------------------

export const MOODS = [
  { id: "slammed", label: "slammed before a big meeting", startingPatience: 35, note: "Has maybe two minutes and knows it." },
  { id: "between-meetings", label: "between meetings and distracted", startingPatience: 45, note: "Half-reading email while listening." },
  { id: "normal-day", label: "having a normal day", startingPatience: 55, note: "Busy, but will hear a good reason out." },
  { id: "slow-friday", label: "on a slow Friday afternoon", startingPatience: 70, note: "Has a little time and a little curiosity." },
];

// ---------------------------------------------------------------------------
// Detecting "the ask"
// ---------------------------------------------------------------------------

// If a student line contains any of these phrases (not case-sensitive), it counts as
// asking for a meeting. The model can also flag an ask; the debrief records which one caught it.
// Hyphens count as spaces, so "15 minute" also catches "15-minute" and "15 minutes".
export const ASK_PHRASES = [
  "15 minute", "fifteen minute", "20 minute", "twenty minute", "30 minute", "half hour",
  "set up a meeting", "set up a call", "set up a time", "book a meeting", "book a time",
  "schedule a meeting", "schedule a call", "schedule a time", "grab a time",
  "on your calendar", "on the calendar", "find a time", "meet next week", "meet this week",
  "would you be open to a meeting", "open to a meeting", "open to a call", "open to meeting",
  "does tuesday work", "does wednesday work", "does thursday work", "does monday work", "does friday work",
];

// ---------------------------------------------------------------------------
// The exec's appearance — the only allowed values (the drawing supports each one)
// ---------------------------------------------------------------------------

export const APPEARANCE_OPTIONS = {
  skinTone: ["light", "medium-light", "medium", "medium-dark", "dark"],
  hair: ["short", "long", "bun", "curly", "buzz", "bald", "bob", "side-part"],
  hairColor: ["black", "brown", "blonde", "red", "gray"],
  attire: ["blazer", "button-down", "polo", "sweater", "cardigan"],
  glasses: [true, false],
};

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

// How many past calls to keep in this browser.
export const PAST_CALLS_KEPT = 20;

// Names used in browser storage. API keys go in sessionStorage (this tab only),
// one per provider: "ccl.apiKey.anthropic" and "ccl.apiKey.openai".
export const STORAGE_KEYS = {
  apiKey: "ccl.apiKey",
  apiKeyAnthropic: "ccl.apiKey.anthropic",
  apiKeyOpenAI: "ccl.apiKey.openai",
  settings: "ccl.settings",
  pastCalls: "ccl.pastCalls",
  privacyNoteSeen: "ccl.privacyNoteSeen",
};
