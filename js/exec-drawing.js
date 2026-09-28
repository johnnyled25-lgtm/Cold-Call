// The exec on screen: a flat SVG illustration, built in code from the persona's
// `appearance`. No image files. (Brief §4.8.)
//
// buildExecSvg() is pure: it returns SVG markup made only from the fixed shapes
// below and the fixed appearance values in constants.js (never model text), so it
// can be tested in Node. mountExec() puts it on the page and switches poses.
//
// Colors are NOT set here. Each part has a class (skin, hair, attire, ...) and
// styles.css maps the appearance classes on the root to color variables.
// Poses are CSS classes on the root too (see pose.js and styles.css).

import { APPEARANCE_OPTIONS } from "./constants.js";
import { poseClasses, describePose } from "./pose.js";

// Head center and size. Everything on the face is placed relative to these.
const HX = 240;
const HY = 150;

// ---------------------------------------------------------------------------
// Parts
// ---------------------------------------------------------------------------

function room() {
  return `
  <rect class="wall" x="0" y="0" width="480" height="360"/>
  <g class="window">
    <rect class="window-glass" x="36" y="36" width="120" height="90" rx="4"/>
    <path class="window-frame" d="M96 36 V126 M36 81 H156" />
  </g>
  <g class="monitor">
    <rect class="monitor-body" x="344" y="156" width="112" height="86" rx="6"/>
    <rect class="monitor-screen" x="350" y="162" width="100" height="74" rx="3"/>
    <path class="monitor-lines" d="M358 176 H420 M358 188 H436 M358 200 H410 M358 212 H430"/>
    <rect class="monitor-body" x="394" y="242" width="12" height="42"/>
  </g>`;
}

function hairBack(style) {
  if (style === "long") {
    return `<path class="hair" d="M188 150 C184 94 214 82 240 82 C268 82 298 94 292 150 L298 236 C284 244 270 240 264 230 L216 230 C210 240 196 244 182 236 Z"/>`;
  }
  if (style === "curly") {
    return `<ellipse class="hair" cx="${HX}" cy="${HY - 6}" rx="58" ry="64"/>`;
  }
  if (style === "bun") {
    return `<circle class="hair" cx="${HX}" cy="84" r="20"/>`;
  }
  return "";
}

function hairFront(style) {
  switch (style) {
    case "short":
      return `<path class="hair" d="M194 152 C190 100 218 88 240 88 C264 88 292 100 286 152 C282 126 266 110 240 112 C214 110 198 126 194 152 Z"/>`;
    case "buzz":
      return `<path class="hair hair-thin" d="M196 138 C198 102 220 93 240 93 C262 93 284 102 284 138 C278 116 262 105 240 105 C218 105 202 116 196 138 Z"/>`;
    case "long":
      return `<path class="hair" d="M194 164 C188 100 218 86 240 86 C264 86 294 100 286 164 C282 128 262 108 232 112 C216 116 202 132 198 168 Z"/>`;
    case "bun":
      return `<path class="hair" d="M195 140 C196 102 220 92 240 92 C262 92 285 102 285 140 C278 116 262 106 240 106 C218 106 202 116 195 140 Z"/>`;
    case "curly": {
      // A ring of curls along the top of the head.
      const curls = [];
      for (let i = 0; i <= 8; i++) {
        const a = Math.PI * (1.08 + (0.84 * i) / 8);
        const x = HX + Math.cos(a) * 48;
        const y = HY - 8 + Math.sin(a) * 54;
        curls.push(`<circle class="hair" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="14"/>`);
      }
      return curls.join("");
    }
    default: // bald
      return `<path class="shine" d="M226 104 C232 100 244 100 250 104"/>`;
  }
}

function face(glasses) {
  const eyeY = HY - 2;
  return `
    <ellipse class="skin" cx="${HX - 46}" cy="${HY + 2}" rx="8" ry="12"/>
    <ellipse class="skin" cx="${HX + 46}" cy="${HY + 2}" rx="8" ry="12"/>
    <ellipse class="skin" cx="${HX}" cy="${HY}" rx="46" ry="54"/>
    <g class="eyes">
      <circle class="pupil" cx="${HX - 17}" cy="${eyeY}" r="4.5"/>
      <circle class="pupil" cx="${HX + 17}" cy="${eyeY}" r="4.5"/>
    </g>
    <path class="brow brow-left" d="M${HX - 27} ${HY - 16} q10 -6 20 0"/>
    <path class="brow brow-right" d="M${HX + 7} ${HY - 16} q10 -6 20 0"/>
    <path class="nose" d="M${HX} ${HY + 2} q-5 12 2 14"/>
    <g class="mouth">
      <path class="mouth-line mouth-neutral" d="M${HX - 12} ${HY + 28} q12 4 24 0"/>
      <path class="mouth-line mouth-engaged" d="M${HX - 13} ${HY + 26} q13 9 26 0"/>
      <path class="mouth-line mouth-impatient" d="M${HX - 11} ${HY + 30} q11 -3 22 0"/>
      <ellipse class="mouth-open" cx="${HX}" cy="${HY + 29}" rx="8" ry="6"/>
    </g>
    ${glasses ? `
    <g class="glasses">
      <rect x="${HX - 30}" y="${eyeY - 11}" width="26" height="21" rx="7"/>
      <rect x="${HX + 4}" y="${eyeY - 11}" width="26" height="21" rx="7"/>
      <path d="M${HX - 4} ${eyeY - 3} h8"/>
    </g>` : ""}`;
}

// Clothing on the torso. The base shape is the same for everyone; details differ.
function attire(kind) {
  const torso = `<path class="attire" d="M140 300 C140 248 170 226 240 224 C310 226 340 248 340 300 Z"/>`;
  switch (kind) {
    case "blazer":
      return `${torso}
        <path class="shirt" d="M222 226 L240 266 L258 226 Z"/>
        <path class="shade" d="M222 226 L240 266 L228 300 L204 238 Z M258 226 L240 266 L252 300 L276 238 Z"/>`;
    case "button-down":
      return `${torso}
        <path class="light" d="M222 226 L232 246 L240 230 Z M258 226 L248 246 L240 230 Z"/>
        <path class="seam" d="M240 232 V300"/>
        <circle class="button" cx="240" cy="252" r="2.2"/><circle class="button" cx="240" cy="272" r="2.2"/><circle class="button" cx="240" cy="292" r="2.2"/>`;
    case "polo":
      return `${torso}
        <path class="light" d="M220 226 C228 238 236 240 240 238 C244 240 252 238 260 226 L256 221 L224 221 Z"/>
        <rect class="light" x="236" y="238" width="8" height="24" rx="2"/>
        <circle class="button" cx="240" cy="246" r="2"/><circle class="button" cx="240" cy="256" r="2"/>`;
    case "sweater":
      return `${torso}
        <path class="band" d="M221 228 C230 238 250 238 259 228"/>
        <path class="band band-thin" d="M150 298 H330"/>`;
    case "cardigan":
      return `${torso}
        <path class="shirt" d="M224 226 L256 226 L262 300 L218 300 Z"/>
        <path class="shade" d="M218 300 L224 226 L230 226 L228 300 Z M262 300 L256 226 L250 226 L252 300 Z"/>
        <circle class="button" cx="226" cy="258" r="2.4"/><circle class="button" cx="226" cy="280" r="2.4"/>`;
    default:
      return torso;
  }
}

function desk() {
  return `
  <rect class="desk-top" x="0" y="282" width="480" height="18"/>
  <rect class="desk-front" x="0" y="300" width="480" height="60"/>
  <g class="desk-phone">
    <g class="ring-waves">
      <path d="M74 236 q12 -12 24 0"/><path d="M66 228 q20 -20 40 0"/>
    </g>
    <rect class="phone" x="40" y="262" width="92" height="26" rx="8"/>
    <path class="phone-keys" d="M100 270 h4 M110 270 h4 M120 270 h4 M100 278 h4 M110 278 h4 M120 278 h4"/>
    <rect class="phone handset-cradle" x="42" y="249" width="84" height="15" rx="7"/>
  </g>
  <g class="notepad-group">
    <rect class="notepad" x="262" y="286" width="64" height="34" rx="3" transform="rotate(5 294 303)"/>
    <path class="notepad-lines" d="M270 296 H316 M269 304 H313 M268 312 H300" transform="rotate(5 294 303)"/>
  </g>`;
}

function arms() {
  return `
  <g class="arm arm-down-left">
    <path class="sleeve" d="M172 252 C150 262 130 274 116 284"/>
    <circle class="skin" cx="112" cy="284" r="11"/>
  </g>
  <g class="arm arm-up">
    <rect class="phone" x="176" y="128" width="18" height="74" rx="9" transform="rotate(-12 185 165)"/>
    <path class="sleeve" d="M172 252 C150 236 162 196 194 180"/>
    <circle class="skin" cx="198" cy="176" r="12"/>
  </g>
  <g class="arm arm-right">
    <path class="sleeve" d="M308 252 C318 266 312 280 300 292"/>
    <g class="writing-hand">
      <path class="pen" d="M298 300 L288 282"/>
      <circle class="skin" cx="298" cy="296" r="11"/>
    </g>
  </g>`;
}

// ---------------------------------------------------------------------------
// The whole picture
// ---------------------------------------------------------------------------

// appearance: { skinTone, hair, hairColor, attire, glasses } (values from APPEARANCE_OPTIONS).
// Unknown values fall back to the first option, so any persona file still draws.
export function buildExecSvg(appearance, { label = "" } = {}) {
  const pick = (key) => (APPEARANCE_OPTIONS[key].includes(appearance?.[key]) ? appearance[key] : APPEARANCE_OPTIONS[key][0]);
  const skin = pick("skinTone");
  const hair = pick("hair");
  const hairColor = pick("hairColor");
  const clothes = pick("attire");
  const glasses = appearance?.glasses === true;
  const safeLabel = String(label).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  return `<svg class="exec skin-${skin} hair-${hairColor} attire-${clothes} pose-ringing mood-neutral" viewBox="0 0 480 360" role="img" aria-label="${safeLabel}" xmlns="http://www.w3.org/2000/svg">
  ${room()}
  <g class="body">
    <rect class="skin" x="224" y="178" width="32" height="54" rx="10"/>
    ${attire(clothes)}
    <g class="head">
      ${hairBack(hair)}
      ${face(glasses)}
      ${hairFront(hair)}
    </g>
  </g>
  ${desk()}
  ${arms()}
</svg>`;
}

// ---------------------------------------------------------------------------
// On the page
// ---------------------------------------------------------------------------

const reducedMotion = () => globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

// Draws the exec in `container` and returns controls for the call screen.
// words: COPY.exec.describe, for the screen-reader description.
export function mountExec(container, persona, words) {
  const firstName = persona.name.split(" ")[0];
  container.innerHTML = buildExecSvg(persona.appearance); // our own fixed markup; no model text
  const svg = container.querySelector("svg");
  let lastPose = "";
  let mouthTimer = null;
  let boundaryMode = false;

  return {
    // Applies a pose from pose.js. Only touches the page when something changed.
    setPose(pose) {
      const key = JSON.stringify(pose);
      if (key === lastPose) return;
      lastPose = key;
      svg.setAttribute("class", [...svg.classList].filter((c) => !/^(pose-|mood-|is-)/.test(c)).concat(poseClasses(pose)).join(" "));
      if (pose.talking && !reducedMotion() && !boundaryMode) svg.classList.add("talking-loop");
      if (!pose.talking) { svg.classList.remove("talking-loop", "mouth-is-open"); boundaryMode = false; }
      svg.setAttribute("aria-label", describePose(pose, firstName, words));
    },
    // Called on each word the browser speaks (where supported): open the mouth briefly.
    // The first one switches from the simple loop to following the words.
    pulseMouth() {
      if (reducedMotion()) return;
      boundaryMode = true;
      svg.classList.remove("talking-loop");
      svg.classList.add("mouth-is-open");
      clearTimeout(mouthTimer);
      mouthTimer = setTimeout(() => svg.classList.remove("mouth-is-open"), 140);
    },
  };
}
