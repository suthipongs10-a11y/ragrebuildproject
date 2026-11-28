import { describe, expect, it } from 'vitest';
import { fitViewport } from '../src/app/viewport';

describe('fitViewport', () => {
  it('is 1:1 at the design resolution', () => {
    expect(fitViewport(1920, 1080)).toEqual({ cssWidth: 1920, cssHeight: 1080 });
  });

  it('uses an integer scale at 4K', () => {
    expect(fitViewport(3840, 2160)).toEqual({ cssWidth: 3840, cssHeight: 2160 });
  });

  it('letterboxes Steam Deck 1280x800 to a full 16:9 frame', () => {
    expect(fitViewport(1280, 800)).toEqual({ cssWidth: 1280, cssHeight: 720 });
  });

  it('pillarboxes ultrawide', () => {
    expect(fitViewport(3440, 1440)).toEqual({ cssWidth: 1920, cssHeight: 1080 });
  });
});
