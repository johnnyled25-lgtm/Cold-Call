// The exec on screen: a flat vector illustration built in code from the persona's
// `appearance`. No image files. (Brief §4.8.)
//
// Style: flat shapes with no outlines and soft shading. Each colored part has a base
// tone plus one darker shade and one lighter highlight (see the .exec rules in
// styles.css, which mix the shades from the base color variables).
//
// The picture is built from swappable layers:
//   backdrop · props · body · head (hair-back, face, expressions, hair-front, glasses)
//   · arms/phone · desk
// Poses are CSS classes on the root <svg> (see pose.js); each pose only shows,
// hides, or moves the layers it needs.
//
// buildExecSvg() is pure (fixed shapes + fixed appearance values, never model text),
// so it can be tested in Node. mountExec() puts it on the page and switches poses.

import { APPEARANCE_OPTIONS } from "./constants.js";
import { poseClasses, describePose } from "./pose.js";

// Head center. Face parts are placed relative to it.
const HX = 240;
const HY = 138;
const EYE_DX = 19; // eye distance from the center line
const EYE_Y = HY + 2;

// ---------------------------------------------------------------------------
// Backdrop and props
// ---------------------------------------------------------------------------

function backdrop() {
  return `
  <g class="layer-backdrop">
    <rect class="wall" x="0" y="0" width="480" height="360"/>
    <circle class="backdrop" cx="240" cy="178" r="152"/>
    <circle class="backdrop-ring" cx="240" cy="178" r="164"/>
    <circle class="confetti c1" cx="92" cy="70" r="5"/>
    <circle class="confetti c2" cx="400" cy="46" r="4"/>
    <path class="confetti c3" d="M70 150 l8 -4 l-2 9 z"/>
    <path class="confetti c1" d="M420 212 l7 3 l-6 5 z"/>
  </g>`;
}

function props() {
  return `
  <g class="layer-props">
    <g class="prop-poster">
      <rect class="paper" x="330" y="64" width="96" height="112" rx="6"/>
      <rect class="paper-shade" x="330" y="166" width="96" height="10" rx="3"/>
      <rect class="ink-soft" x="342" y="76" width="44" height="5" rx="2.5"/>
      <rect class="bar b1" x="344" y="130" width="11" height="30" rx="2"/>
      <rect class="bar b2" x="360" y="112" width="11" height="48" rx="2"/>
      <rect class="bar b3" x="376" y="122" width="11" height="38" rx="2"/>
      <rect class="bar b1" x="392" y="98" width="11" height="62" rx="2"/>
      <rect class="bar b2" x="408" y="88" width="11" height="72" rx="2"/>
    </g>
    <g class="prop-books">
      <rect class="book k1" x="366" y="276" width="78" height="14" rx="2"/>
      <rect class="book-pages" x="370" y="279" width="70" height="3"/>
      <rect class="book k2" x="372" y="262" width="66" height="14" rx="2"/>
      <rect class="book-pages" x="376" y="265" width="58" height="3"/>
      <rect class="book k3" x="368" y="249" width="72" height="13" rx="2"/>
      <rect class="book-pages" x="372" y="252" width="64" height="3"/>
    </g>
    <g class="prop-pencils">
      <rect class="pencil p1" x="52" y="222" width="5" height="40" rx="2" transform="rotate(-12 54 262)"/>
      <rect class="pencil p2" x="62" y="216" width="5" height="46" rx="2" transform="rotate(6 64 262)"/>
      <rect class="pencil p3" x="72" y="226" width="5" height="36" rx="2" transform="rotate(16 74 262)"/>
      <rect class="cup" x="44" y="248" width="40" height="42" rx="5"/>
      <rect class="cup-shade" x="44" y="248" width="12" height="42" rx="5"/>
    </g>
  </g>`;
}

// ---------------------------------------------------------------------------
// Hair: every style is layered (base, shade, highlight), with a back part behind
// the face and a front part over it.
// ---------------------------------------------------------------------------

const HAIR_BACK = {
  long: `
    <path class="hair" d="M180 140 C178 86 212 70 240 70 C270 70 302 86 300 140 L308 238 Q290 250 272 238 L270 172 L210 172 L208 238 Q190 250 172 238 Z"/>
    <path class="hair-shade" d="M186 162 L180 236 Q190 244 200 236 L204 170 Z M294 162 L300 236 Q290 244 280 236 L276 170 Z"/>`,
  bob: `
    <path class="hair" d="M182 140 C182 88 212 72 240 72 C270 72 298 88 298 140 L302 200 Q286 208 270 200 L270 162 L210 162 L210 200 Q194 208 178 200 Z"/>
    <path class="hair-shade" d="M186 160 L184 198 Q192 203 200 198 L202 164 Z M294 160 L296 198 Q288 203 280 198 L278 164 Z"/>`,
  bun: `
    <circle class="hair" cx="${HX}" cy="68" r="23"/>
    <path class="hair-shade" d="M222 76 A23 23 0 0 0 262 78 A28 22 0 0 1 222 76 Z"/>
    <path class="hair-hi" d="M230 54 Q240 48 250 54 Q240 52 230 58 Z"/>`,
  curly: `
    <ellipse class="hair-shade" cx="${HX}" cy="${HY - 8}" rx="64" ry="68"/>`,
};

function curls() {
  const out = [];
  for (let i = 0; i <= 10; i++) {
    const a = Math.PI * (1.04 + (0.92 * i) / 10);
    const x = HX + Math.cos(a) * 52;
    const y = HY - 8 + Math.sin(a) * 58;
    const cls = i % 3 === 0 ? "hair-shade" : "hair";
    out.push(`<circle class="${cls}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="15"/>`);
    if (i % 2 === 1) out.push(`<circle class="hair-hi" cx="${(x - 3).toFixed(1)}" cy="${(y - 4).toFixed(1)}" r="4"/>`);
  }
  return out.join("");
}

const HAIR_FRONT = {
  short: `
    <path class="hair" d="M188 150 C184 96 214 78 240 78 C268 78 298 96 292 150 C290 128 280 110 262 104 C248 112 222 112 204 106 C196 118 190 134 188 150 Z"/>
    <path class="hair-shade" d="M200 112 C214 100 262 98 282 118 C272 108 250 104 240 104 C226 104 208 108 200 112 Z"/>
    <path class="hair-hi" d="M252 84 C266 86 278 94 284 106 C276 99 264 93 252 90 Z"/>`,
  "side-part": `
    <path class="hair" d="M188 154 C184 98 212 78 244 78 C272 80 296 98 292 150 C286 120 270 104 244 100 L226 98 C212 108 196 128 188 154 Z"/>
    <path class="hair-shade" d="M226 98 C240 92 262 100 278 118 C260 108 242 106 224 104 Z"/>
    <path class="hair-hi" d="M228 86 C242 82 262 86 276 96 C260 90 244 88 228 90 Z"/>`,
  bob: `
    <path class="hair" d="M188 142 C188 100 214 84 240 84 C268 84 292 100 292 142 C284 118 262 104 240 106 C220 104 198 116 188 142 Z"/>
    <path class="hair-shade" d="M196 118 C212 104 230 102 244 104 C226 108 208 116 196 132 Z"/>
    <path class="hair-hi" d="M246 90 C262 92 276 100 284 112 C274 104 262 98 246 96 Z"/>`,
  long: `
    <path class="hair" d="M188 152 C184 98 214 82 240 82 C270 82 296 98 292 150 C286 120 262 102 232 108 C214 114 198 130 188 152 Z"/>
    <path class="hair-shade" d="M232 108 C250 104 270 110 286 128 C272 116 254 110 236 112 Z"/>
    <path class="hair-hi" d="M212 94 C226 86 250 84 266 90 C250 88 230 90 214 98 Z"/>`,
  bun: `
    <path class="hair" d="M190 140 C190 98 214 82 240 82 C266 82 290 98 290 140 C284 114 264 100 240 100 C216 100 196 114 190 140 Z"/>
    <path class="hair-shade" d="M204 108 C218 98 262 98 278 114 C264 106 250 104 240 104 C226 104 212 106 204 108 Z"/>
    <path class="hair-hi" d="M226 88 C236 84 250 84 260 88 C250 87 236 88 226 92 Z"/>
    <path class="hair" d="M192 146 q-7 22 2 40 q1 -20 5 -38 Z M288 146 q7 22 -2 40 q-1 -20 -5 -38 Z"/>`,
  buzz: `
    <path class="hair" d="M194 138 C196 98 218 86 240 86 C262 86 284 98 286 138 C280 114 264 102 240 102 C216 102 200 114 194 138 Z"/>
    <path class="hair-shade" d="M196 132 C200 116 214 104 230 102 C214 108 202 120 198 136 Z M284 132 C280 116 266 104 250 102 C266 108 278 120 282 136 Z"/>
    <path class="hair-hi" d="M232 90 C242 88 254 90 262 94 C252 92 242 92 232 94 Z"/>`,
  curly: curls(),
  bald: `
    <path class="skin-hi" d="M222 92 C232 86 250 86 258 92 C248 90 234 90 222 96 Z"/>
    <path class="hair" d="M189 140 q2 -14 8 -20 q-3 12 -2 22 Z M291 140 q-2 -14 -8 -20 q3 12 2 22 Z"/>`,
};

// ---------------------------------------------------------------------------
// Face: fixed features, plus one expression group per mood.
// ---------------------------------------------------------------------------

// An almond eye outline, centered on (0,0).
const ALMOND = "M-13 1 Q-2 -11 13 -1 Q1 9 -13 1 Z";

function eye(cx, id) {
  return `
    <g transform="translate(${cx} ${EYE_Y})">
      <path class="eye-white" d="${ALMOND}"/>
      <g clip-path="url(#${id})">
        <g class="iris-group">
          <circle class="iris" cx="0" cy="0" r="6.5"/>
          <circle class="pupil" cx="0" cy="0" r="3"/>
          <circle class="eye-glint" cx="2.2" cy="-2.4" r="1.9"/>
        </g>
      </g>
      <path class="lash" d="M-14 2 Q-2 -13 14 -1 Q1 -8 -14 2 Z"/>
    </g>`;
}

// Eyelids are skin-colored shapes over the eye: half-closed (impatient),
// a smiling lower lid (engaged), or one narrowed eye (skeptical).
const LID_HALF = "M-15 -13 L15 -13 L15 -1 Q0 -3 -15 1 Z";
const LID_HALF_LINE = "M-14 1 Q0 -4 14 -1 Q0 -1 -14 3 Z";
const LID_SMILE = "M-15 11 L15 11 L15 3 Q0 -3 -15 4 Z";

function lids(className, d, which = "both") {
  const at = (cx) => `<path class="${className}" transform="translate(${cx} ${EYE_Y})" d="${d}"/>`;
  return which === "both" ? at(HX - EYE_DX) + at(HX + EYE_DX) : at(which === "left" ? HX - EYE_DX : HX + EYE_DX);
}

// A tapered, filled eyebrow. dy moves it up (negative) or down; tilt rotates it,
// positive tilting its inner end down (a frown).
function brow(side, { dy = 0, tilt = 0, arch = 6 } = {}) {
  const cx = side === "left" ? HX - EYE_DX : HX + EYE_DX;
  const y = HY - 17 + dy;
  const d = `M-13 3 Q0 ${-arch} 13 1 L13 4 Q0 ${-arch + 4} -13 6 Z`;
  const rot = side === "left" ? tilt : -tilt;
  const flip = side === "left" ? "" : " scale(-1 1)";
  return `<path class="brow" transform="translate(${cx} ${y}) rotate(${rot})${flip}" d="${d}"/>`;
}

// Mouths, all centered under the nose at (HX, 174).
const MY = 174;
const MOUTHS = {
  // Soft closed smile: two lip shapes with a darker line between them.
  neutral: `
    <path class="lip" d="M${HX - 11} ${MY} Q${HX} ${MY + 9} ${HX + 11} ${MY} Q${HX} ${MY + 4} ${HX - 11} ${MY} Z"/>
    <path class="lip-shade" d="M${HX - 11} ${MY} Q${HX - 5} ${MY - 4} ${HX} ${MY - 2} Q${HX + 5} ${MY - 4} ${HX + 11} ${MY} Q${HX} ${MY + 2} ${HX - 11} ${MY} Z"/>
    <path class="mouth-line" d="M${HX - 12} ${MY} Q${HX} ${MY + 4.5} ${HX + 12} ${MY} Q${HX} ${MY + 6} ${HX - 12} ${MY} Z"/>`,
  // Open smile with teeth.
  engaged: `
    <path class="mouth-dark" d="M${HX - 16} ${MY - 4} Q${HX} ${MY} ${HX + 16} ${MY - 4} Q${HX + 13} ${MY + 13} ${HX} ${MY + 14} Q${HX - 13} ${MY + 13} ${HX - 16} ${MY - 4} Z"/>
    <path class="teeth" d="M${HX - 14} ${MY - 3} Q${HX} ${MY + 1} ${HX + 14} ${MY - 3} L${HX + 13} ${MY + 2} Q${HX} ${MY + 5} ${HX - 13} ${MY + 2} Z"/>
    <path class="lip" d="M${HX - 9} ${MY + 12} Q${HX} ${MY + 17} ${HX + 9} ${MY + 12} Q${HX} ${MY + 14} ${HX - 9} ${MY + 12} Z"/>`,
  // Pressed flat, corners slightly down.
  impatient: `
    <path class="lip" d="M${HX - 11} ${MY + 3} Q${HX} ${MY} ${HX + 11} ${MY + 3} Q${HX} ${MY + 6} ${HX - 11} ${MY + 3} Z"/>
    <path class="mouth-line" d="M${HX - 12} ${MY + 3.5} Q${HX} ${MY + 0.5} ${HX + 12} ${MY + 3.5} Q${HX} ${MY + 2} ${HX - 12} ${MY + 3.5} Z"/>`,
  // Lopsided smirk.
  skeptical: `
    <path class="lip" d="M${HX - 11} ${MY + 3} Q${HX} ${MY + 5} ${HX + 12} ${MY - 3} Q${HX + 2} ${MY + 7} ${HX - 11} ${MY + 3} Z"/>
    <path class="mouth-line" d="M${HX - 12} ${MY + 3} Q${HX} ${MY + 4} ${HX + 13} ${MY - 3} Q${HX + 1} ${MY + 6} ${HX - 12} ${MY + 3} Z"/>`,
};

function expressions() {
  return `
    <g class="expr expr-neutral">
      ${brow("left")}${brow("right")}
      <g class="mouth">${MOUTHS.neutral}</g>
    </g>
    <g class="expr expr-engaged">
      ${brow("left", { dy: -4, arch: 8 })}${brow("right", { dy: -4, arch: 8 })}
      ${lids("lid", LID_SMILE)}
      <g class="mouth">${MOUTHS.engaged}</g>
    </g>
    <g class="expr expr-impatient">
      ${brow("left", { dy: 2, tilt: 12, arch: 3 })}${brow("right", { dy: 2, tilt: 12, arch: 3 })}
      ${lids("lid", LID_HALF)}${lids("lash", LID_HALF_LINE)}
      <g class="mouth">${MOUTHS.impatient}</g>
    </g>
    <g class="expr expr-skeptical">
      ${brow("left", { dy: 2, tilt: 6, arch: 3 })}${brow("right", { dy: -8, tilt: -8, arch: 9 })}
      ${lids("lid", LID_HALF, "left")}${lids("lash", LID_HALF_LINE, "left")}
      <g class="mouth">${MOUTHS.skeptical}</g>
    </g>
    <g class="mouth-open">
      <ellipse class="mouth-dark" cx="${HX}" cy="${MY + 3}" rx="9" ry="7.5"/>
      <ellipse class="lip" cx="${HX}" cy="${MY + 8}" rx="5" ry="2.5"/>
    </g>`;
}

function face(glasses, idPrefix) {
  const leftId = `${idPrefix}-eye-l`;
  const rightId = `${idPrefix}-eye-r`;
  return `
    <defs>
      <clipPath id="${leftId}"><path d="${ALMOND}"/></clipPath>
      <clipPath id="${rightId}"><path d="${ALMOND}"/></clipPath>
    </defs>
    <ellipse class="skin" cx="${HX - 50}" cy="${HY + 4}" rx="9" ry="13"/>
    <ellipse class="skin-shade" cx="${HX - 50}" cy="${HY + 5}" rx="4" ry="7"/>
    <ellipse class="skin" cx="${HX + 50}" cy="${HY + 4}" rx="9" ry="13"/>
    <ellipse class="skin-shade" cx="${HX + 50}" cy="${HY + 5}" rx="4" ry="7"/>
    <path class="skin" d="M${HX - 50} ${HY - 6} C${HX - 50} ${HY - 50} ${HX - 26} ${HY - 58} ${HX} ${HY - 58} C${HX + 26} ${HY - 58} ${HX + 50} ${HY - 50} ${HX + 50} ${HY - 6} C${HX + 50} ${HY + 34} ${HX + 26} ${HY + 58} ${HX} ${HY + 58} C${HX - 26} ${HY + 58} ${HX - 50} ${HY + 34} ${HX - 50} ${HY - 6} Z"/>
    <path class="skin-shade" d="M${HX + 34} ${HY + 30} C${HX + 26} ${HY + 50} ${HX + 12} ${HY + 56} ${HX} ${HY + 57} C${HX + 20} ${HY + 58} ${HX + 44} ${HY + 44} ${HX + 48} ${HY + 14} Z"/>
    <ellipse class="blush" cx="${HX - 27}" cy="${HY + 22}" rx="10" ry="6"/>
    <ellipse class="blush" cx="${HX + 27}" cy="${HY + 22}" rx="10" ry="6"/>
    <g class="eyes">
      ${eye(HX - EYE_DX, leftId)}
      ${eye(HX + EYE_DX, rightId)}
    </g>
    <path class="skin-shade" d="M${HX + 1} ${HY + 8} q-6 13 1 17 q5 1 8 -2 q-6 0 -9 -15 Z"/>
    ${expressions()}
    ${glasses ? `
    <g class="glasses">
      <rect class="frame" x="${HX - EYE_DX - 16}" y="${EYE_Y - 12}" width="32" height="24" rx="9"/>
      <rect class="frame" x="${HX + EYE_DX - 16}" y="${EYE_Y - 12}" width="32" height="24" rx="9"/>
      <path class="frame-line" d="M${HX - 3} ${EYE_Y - 3} q3 -3 6 0 M${HX - EYE_DX - 16} ${EYE_Y - 4} L${HX - 49} ${EYE_Y - 2} M${HX + EYE_DX + 16} ${EYE_Y - 4} L${HX + 49} ${EYE_Y - 2}"/>
    </g>` : ""}`;
}

// ---------------------------------------------------------------------------
// Body and clothing (all outfits share a torso; details differ)
// ---------------------------------------------------------------------------

const TORSO = "M128 300 C128 254 160 232 206 226 L274 226 C320 232 352 254 352 300 Z";
const TORSO_SHADE = "M128 300 C128 262 146 242 172 234 C158 252 152 276 154 300 Z";
const TORSO_HI = "M300 236 C322 244 340 258 346 280 C336 264 322 252 304 244 Z";

function neck() {
  return `
    <rect class="skin" x="222" y="176" width="36" height="58" rx="12"/>
    <path class="skin-shade" d="M222 192 Q240 206 258 192 L258 206 Q240 216 222 206 Z"/>`;
}

function attire(kind) {
  const base = `<path class="attire" d="${TORSO}"/><path class="attire-shade" d="${TORSO_SHADE}"/><path class="attire-hi" d="${TORSO_HI}"/>`;
  switch (kind) {
    case "blazer":
      return `${base}
        <path class="shirt" d="M218 226 L240 272 L262 226 Z"/>
        <path class="shirt-shade" d="M218 226 L230 236 L240 272 Z"/>
        <path class="attire-shade" d="M216 226 L240 272 L226 300 L198 236 Z"/>
        <path class="attire-hi" d="M264 226 L240 272 L254 300 L282 236 Z"/>
        <circle class="button" cx="240" cy="284" r="3"/>`;
    case "button-down":
      return `${base}
        <path class="attire-hi" d="M220 226 L232 248 L240 230 Z"/>
        <path class="attire-hi" d="M260 226 L248 248 L240 230 Z"/>
        <path class="attire-shade" d="M238 232 L242 232 L242 300 L238 300 Z"/>
        <circle class="button" cx="240" cy="256" r="2.2"/><circle class="button" cx="240" cy="276" r="2.2"/><circle class="button" cx="240" cy="294" r="2.2"/>`;
    case "polo":
      return `${base}
        <path class="attire-hi" d="M218 227 C228 240 236 242 240 240 C244 242 252 240 262 227 L258 221 L222 221 Z"/>
        <rect class="attire-shade" x="236" y="240" width="8" height="26" rx="2"/>
        <circle class="button" cx="240" cy="248" r="2"/><circle class="button" cx="240" cy="258" r="2"/>`;
    case "sweater":
      return `${base}
        <path class="shirt" d="M226 226 L240 240 L254 226 Z"/>
        <path class="attire-shade" d="M218 227 C228 242 252 242 262 227 L258 233 C250 244 230 244 222 233 Z"/>
        <rect class="attire-shade" x="150" y="292" width="180" height="6" rx="3"/>`;
    case "cardigan":
      return `${base}
        <path class="shirt" d="M222 226 L258 226 L264 300 L216 300 Z"/>
        <path class="shirt-shade" d="M222 226 L240 242 L258 226 Z"/>
        <path class="attire-shade" d="M216 300 L222 226 L230 226 L228 300 Z"/>
        <path class="attire-hi" d="M264 300 L258 226 L250 226 L252 300 Z"/>
        <circle class="button" cx="225" cy="262" r="2.6"/><circle class="button" cx="225" cy="284" r="2.6"/>`;
    default:
      return base;
  }
}

// ---------------------------------------------------------------------------
// Arms, phone, desk
// ---------------------------------------------------------------------------

function sleeve(d) {
  return `<path class="sleeve" d="${d}"/><path class="sleeve-shade" d="${d}"/>`;
}

function arms() {
  return `
  <g class="layer-arms">
    <g class="arm arm-down-left">
      ${sleeve("M172 254 C150 266 132 278 118 286")}
      <circle class="skin" cx="114" cy="284" r="12"/>
      <path class="skin-shade" d="M104 288 q10 6 20 0 q-10 3 -20 0 Z"/>
    </g>
    <g class="arm arm-up">
      <rect class="phone" x="172" y="118" width="20" height="82" rx="10" transform="rotate(-10 182 160)"/>
      <rect class="phone-hi" x="176" y="124" width="5" height="70" rx="2.5" transform="rotate(-10 182 160)"/>
      ${sleeve("M184 248 L162 282 L190 186")}
      <circle class="skin" cx="194" cy="176" r="13"/>
      <path class="skin-shade" d="M184 182 q10 7 20 -2 q-10 4 -20 2 Z"/>
    </g>
    <g class="arm arm-right">
      ${sleeve("M310 256 C324 270 318 284 302 292")}
      <g class="writing-hand">
        <rect class="pen" x="290" y="266" width="4" height="30" rx="2" transform="rotate(-28 292 296)"/>
        <circle class="skin" cx="298" cy="294" r="12"/>
        <path class="skin-shade" d="M288 298 q10 6 20 0 q-10 3 -20 0 Z"/>
      </g>
    </g>
  </g>`;
}

function desk() {
  return `
  <g class="layer-desk">
    <rect class="desk" x="26" y="290" width="428" height="20" rx="10"/>
    <rect class="desk-shade" x="34" y="302" width="412" height="8" rx="4"/>
    <g class="desk-phone">
      <g class="ring-waves"><path d="M126 232 q12 -12 24 0"/><path d="M118 224 q20 -20 40 0"/></g>
      <rect class="phone" x="98" y="266" width="84" height="26" rx="9"/>
      <rect class="phone-hi" x="104" y="270" width="30" height="4" rx="2"/>
      <rect class="phone handset-cradle" x="100" y="252" width="80" height="16" rx="8"/>
    </g>
    <g class="notepad-group">
      <path class="paper" d="M262 290 L328 290 L336 300 L256 300 Z"/>
      <path class="paper-shade" d="M268 294 L324 294 M266 297 L316 297"/>
    </g>
  </g>`;
}

// ---------------------------------------------------------------------------
// The whole picture
// ---------------------------------------------------------------------------

// appearance: { skinTone, hair, hairColor, attire, glasses } (values from APPEARANCE_OPTIONS).
// Unknown values fall back to the first option, so any persona file still draws.
// idPrefix keeps the eye clip-path ids unique when several drawings share a page.
export function buildExecSvg(appearance, { label = "", idPrefix = "ex" } = {}) {
  const pick = (key) => (APPEARANCE_OPTIONS[key].includes(appearance?.[key]) ? appearance[key] : APPEARANCE_OPTIONS[key][0]);
  const skin = pick("skinTone");
  const hair = pick("hair");
  const hairColor = pick("hairColor");
  const clothes = pick("attire");
  const glasses = appearance?.glasses === true;
  const safeLabel = String(label).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const safeId = String(idPrefix).replace(/[^a-z0-9-]/gi, "");

  return `<svg class="exec skin-${skin} hair-${hairColor} hairstyle-${hair} attire-${clothes} pose-ringing mood-neutral" viewBox="0 0 480 360" role="img" aria-label="${safeLabel}" xmlns="http://www.w3.org/2000/svg">
  ${backdrop()}
  ${props()}
  <g class="layer-body">
    ${neck()}
    ${attire(clothes)}
    <g class="head">
      <g class="hair-back">${HAIR_BACK[hair] || ""}</g>
      <g class="face">${face(glasses, safeId)}</g>
      <g class="hair-front">${HAIR_FRONT[hair] || ""}</g>
    </g>
  </g>
  ${desk()}
  ${arms()}
</svg>`;
}

// A round portrait: the same drawing cropped to the head (arms, desk, props, and
// backdrop hidden by the .exec-portrait rules in styles.css).
export function buildExecPortraitSvg(appearance, { idPrefix = "pt" } = {}) {
  return buildExecSvg(appearance, { idPrefix })
    .replace('viewBox="0 0 480 360"', 'viewBox="170 42 140 140"')
    .replace('class="exec ', 'class="exec exec-portrait ')
    .replace("pose-ringing mood-neutral", "pose-on-call mood-neutral")
    .replace('role="img" aria-label=""', 'aria-hidden="true"');
}

// ---------------------------------------------------------------------------
// On the page
// ---------------------------------------------------------------------------

const reducedMotion = () => globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
let mountCount = 0;

// One shared observer pauses the animations of any drawing that's off-screen
// (class "offscreen"; see styles.css), so drawings nobody can see cost nothing.
const offscreenObserver = globalThis.IntersectionObserver
  ? new IntersectionObserver((entries) => {
      for (const e of entries) e.target.classList.toggle("offscreen", !e.isIntersecting);
    })
  : null;

// Draws the exec in `container` and returns controls for the call screen.
// words: COPY.exec.describe, for the screen-reader description.
export function mountExec(container, persona, words) {
  const firstName = persona.name.split(" ")[0];
  container.innerHTML = buildExecSvg(persona.appearance, { idPrefix: `ex${++mountCount}` }); // our own fixed markup; no model text
  const svg = container.querySelector("svg");
  offscreenObserver?.observe(svg);
  let lastPose = "";
  let mouthTimer = null;
  let boundaryMode = false;

  return {
    svg,
    // Stops watching this drawing (call before replacing it).
    destroy() {
      offscreenObserver?.unobserve(svg);
      clearTimeout(mouthTimer);
    },
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
