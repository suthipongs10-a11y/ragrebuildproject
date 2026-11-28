/** Serializable RNG state: the whole run must round-trip through JSON. */
export interface RngState {
  readonly seed: number;
  readonly s: number;
}

export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform integer in [min, max], both inclusive. */
  int(min: number, max: number): number;
  getState(): RngState;
}

const UINT32_RANGE = 0x1_0000_0000;
// mulberry32 constants (public-domain generator by Tommy Ettinger).
const INCREMENT = 0x6d2b79f5;

export function createRngState(seed: number): RngState {
  const s = seed >>> 0;
  return { seed: s, s };
}

export function createRng(from: RngState | number): Rng {
  let state: RngState = typeof from === 'number' ? createRngState(from) : from;

  const next = (): number => {
    const s = (state.s + INCREMENT) >>> 0;
    state = { seed: state.seed, s };
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / UINT32_RANGE;
  };

  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    getState: () => state,
  };
}
