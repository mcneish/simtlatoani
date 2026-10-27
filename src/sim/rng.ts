/** mulberry32: small, fast, seedable PRNG. */
export function mulberry32(seed: number): () => number {
  const s = { rng: seed | 0 };
  return () => rand(s);
}

/** Advances the RNG stored on an object (so it survives save/load). */
export function rand(s: { rng: number }): number {
  s.rng = (s.rng + 0x6d2b79f5) | 0;
  let t = Math.imul(s.rng ^ (s.rng >>> 15), 1 | s.rng);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
