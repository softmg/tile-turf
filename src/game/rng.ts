export interface SeededRng {
  next: () => number;
  int: (maxExclusive: number) => number;
  range: (min: number, max: number) => number;
  pick: <T>(items: T[]) => T;
}

const hashSeed = (seed: string | number) => {
  const text = String(seed);
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

export const seedFromParts = (...parts: Array<string | number>) => parts.join(":");

export const createSeededRng = (seed: string | number): SeededRng => {
  let state = hashSeed(seed);

  const next = () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    int: (maxExclusive: number) => Math.floor(next() * maxExclusive),
    range: (min: number, max: number) => min + next() * (max - min),
    pick: <T>(items: T[]) => items[Math.floor(next() * items.length)],
  };
};
