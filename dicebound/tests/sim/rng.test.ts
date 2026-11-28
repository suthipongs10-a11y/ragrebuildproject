import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/sim/rng';

const D6_MIN = 1;
const D6_MAX = 6;

describe('seeded rng', () => {
  it('replays the same sequence from the same seed', () => {
    const a = createRng(12345);
    const b = createRng(12345);
    const seqA = Array.from({ length: 100 }, () => a.next());
    const seqB = Array.from({ length: 100 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('differs between seeds', () => {
    expect(createRng(1).next()).not.toBe(createRng(2).next());
  });

  it('resumes from a JSON-serialized state', () => {
    const a = createRng(777);
    for (let i = 0; i < 10; i++) a.next();
    const saved: unknown = JSON.parse(JSON.stringify(a.getState()));
    const b = createRng(saved as ReturnType<typeof a.getState>);
    expect(b.next()).toBe(a.next());
  });

  it('rolls a d6 inside its range and hits every face', () => {
    const rng = createRng(42);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) {
      const roll = rng.int(D6_MIN, D6_MAX);
      expect(roll).toBeGreaterThanOrEqual(D6_MIN);
      expect(roll).toBeLessThanOrEqual(D6_MAX);
      seen.add(roll);
    }
    expect(seen.size).toBe(D6_MAX);
  });
});
