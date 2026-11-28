export type Ease = (t: number) => number;

export const linear: Ease = (t) => t;
export const easeOut: Ease = (t) => 1 - (1 - t) * (1 - t);
export const easeIn: Ease = (t) => t * t;
/** Up and back down: 0 -> 1 -> 0. */
export const arc: Ease = (t) => 4 * t * (1 - t);

interface Tween {
  elapsed: number;
  duration: number;
  ease: Ease;
  update: (value: number) => void;
  resolve: () => void;
}

/** Time-based tweens driven by the game ticker, so game speed scales every animation at once. */
export class Tweener {
  speed = 1;
  private readonly active: Tween[] = [];

  /** Runs `update` with an eased 0..1 value for `duration` ms. Resolves when done. */
  run(duration: number, update: (value: number) => void, ease: Ease = linear): Promise<void> {
    if (duration <= 0) {
      update(ease(1));
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.active.push({ elapsed: 0, duration, ease, update, resolve });
    });
  }

  wait(duration: number): Promise<void> {
    return this.run(duration, noop);
  }

  tick(deltaMs: number): void {
    const step = deltaMs * this.speed;
    // Backwards so finished tweens can be removed without skipping a neighbour.
    for (let i = this.active.length - 1; i >= 0; i--) {
      const tween = this.active[i];
      if (!tween) continue;
      tween.elapsed += step;
      const t = Math.min(1, tween.elapsed / tween.duration);
      tween.update(tween.ease(t));
      if (t >= 1) {
        this.active.splice(i, 1);
        tween.resolve();
      }
    }
  }
}

function noop(): void {}
