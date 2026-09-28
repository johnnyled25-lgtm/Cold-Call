// Reads the exec's reply from the model and checks it has the right shape (brief §4.4).
// Pure; no DOM. This only checks shape. Whether a reveal or objection is allowed
// is decided by callState.js.

// The JSON shape the model must return. Also sent to the provider as a
// structured-output schema, so the provider enforces it where supported.
// "studentMadeAsk" is an addition to the brief's shape: the model's own flag
// for "the caller just asked for a meeting" (brief §4.5 allows this).
export function replySchema({ painIds = [], objectionIds = [] } = {}) {
  const idOrNull = (ids) => (ids.length ? { anyOf: [{ type: "string", enum: ids }, { type: "null" }] } : { type: "null" });
  return {
    type: "object",
    properties: {
      say: { type: "string" },
      patienceDelta: { type: "integer" },
      reason: { type: "string" },
      revealPainId: idOrNull(painIds),
      raiseObjectionId: idOrNull(objectionIds),
      handledObjectionId: idOrNull(objectionIds),
      acceptsMeeting: { type: "boolean" },
      studentMadeAsk: { type: "boolean" },
    },
    required: ["say", "patienceDelta", "reason", "revealPainId", "raiseObjectionId", "handledObjectionId", "acceptsMeeting", "studentMadeAsk"],
    additionalProperties: false,
  };
}

// Pulls the JSON object out of the text, even if the model wrapped it in ``` fences or added words around it.
export function extractJsonText(raw) {
  if (typeof raw !== "string") return null;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  return raw.slice(start, end + 1);
}

const isIdOrNull = (v) => v === null || v === undefined || (typeof v === "string" && v.length > 0);

// Returns { ok: true, reply } or { ok: false, error } with a short error code.
export function parseExecReply(raw) {
  const jsonText = extractJsonText(raw);
  if (!jsonText) return { ok: false, error: "not_json" };

  let data;
  try {
    data = JSON.parse(jsonText);
  } catch {
    return { ok: false, error: "not_json" };
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return { ok: false, error: "not_object" };

  if (typeof data.say !== "string" || data.say.trim() === "") return { ok: false, error: "missing_say" };
  if (typeof data.patienceDelta !== "number" || !Number.isFinite(data.patienceDelta)) return { ok: false, error: "missing_patienceDelta" };
  if (typeof data.reason !== "string" || data.reason.trim() === "") return { ok: false, error: "missing_reason" };
  if (typeof data.acceptsMeeting !== "boolean") return { ok: false, error: "missing_acceptsMeeting" };
  for (const field of ["revealPainId", "raiseObjectionId", "handledObjectionId"]) {
    if (!isIdOrNull(data[field])) return { ok: false, error: `bad_${field}` };
  }

  return {
    ok: true,
    reply: {
      say: data.say.trim(),
      patienceDelta: data.patienceDelta,
      reason: data.reason.trim(),
      revealPainId: data.revealPainId || null,
      raiseObjectionId: data.raiseObjectionId || null,
      handledObjectionId: data.handledObjectionId || null,
      acceptsMeeting: data.acceptsMeeting,
      studentMadeAsk: data.studentMadeAsk === true,
    },
  };
}
