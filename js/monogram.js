// A company "logo" made in code: up to two initials on a colored badge.
// Pure; no DOM. The same company always gets the same initials and color.

// Number of badge colors (--mono-1 … --mono-5 in styles.css).
export const MONOGRAM_COLORS = 5;

const SKIP = new Set(["the", "and", "of", "&", "co", "co.", "inc", "inc.", "llc", "group"]);

// "Kettle Creek Dental Group" → "KC", "Brasswell Freight" → "BF", "Northpaw Creative" → "NC".
export function monogramInitials(company) {
  const words = String(company || "").split(/\s+/).filter(Boolean);
  const meaningful = words.filter((w) => !SKIP.has(w.toLowerCase()));
  const use = (meaningful.length ? meaningful : words).slice(0, 2);
  return use.map((w) => w.replace(/[^A-Za-z0-9]/g, "").charAt(0).toUpperCase()).join("") || "?";
}

// 1 … MONOGRAM_COLORS, fixed per company name.
export function monogramColor(company) {
  // FNV-1a, then a final mix, so similar names spread across the colors.
  let h = 2166136261;
  for (const ch of String(company || "")) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return ((h >>> 0) % MONOGRAM_COLORS) + 1;
}
