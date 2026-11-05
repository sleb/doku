export interface Rng {
  /** Next float in [0, 1). */
  next(): number;
  /** Integer in [0, n); RangeError unless n is an integer >= 1. */
  int(n: number): number;
  /** Fisher-Yates copy; draws int(i + 1) for i from len-1 down to 1. */
  shuffle<T>(items: readonly T[]): T[];
  /** Random member; RangeError when empty. */
  pick<T>(items: readonly T[]): T;
}

/** FNV-1a 32-bit over UTF-16 code units, finished with murmur3 fmix32. */
export function hashSeed(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Deterministic mulberry32 stream seeded from the hash of `seed`. */
export function makeRng(seed: string): Rng {
  let state = hashSeed(seed);
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (n: number): number => {
    if (!Number.isInteger(n) || n < 1) {
      throw new RangeError(`int(n) needs an integer >= 1, got ${n}`);
    }
    return Math.floor(next() * n);
  };
  const shuffle = <T>(items: readonly T[]): T[] => {
    const out = [...items];
    for (let i = out.length - 1; i >= 1; i--) {
      const j = int(i + 1);
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };
  const pick = <T>(items: readonly T[]): T => {
    if (items.length === 0) throw new RangeError("pick() of empty array");
    return items[int(items.length)];
  };
  return { next, int, shuffle, pick };
}
