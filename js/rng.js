// Seeded random numbers. The same seed always gives the same sequence,
// which is how "Call again" reproduces the same exec, offer, and mood. Pure; no DOM.

// Returns a function that gives numbers from 0 (inclusive) to 1 (exclusive).
// Algorithm: mulberry32, small and well known.
export function seededRandom(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A fresh random seed (a whole number) for a new call.
export function newSeed() {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}

// Pick one item from a list using a seeded random function.
export function pickOne(random, list) {
  return list[Math.floor(random() * list.length)];
}
