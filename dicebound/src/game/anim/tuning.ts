/** Every animation timing and feel value lives here (CLAUDE.md §4). Times are milliseconds. */
export const TUNING = {
  idle: { breathScale: 0.02, breathPeriod: 1200 },
  attack: { crouch: 70, lunge: 90, hold: 70, recover: 130, lungeDistance: 46, stagger: 150 },
  hurt: { knockback: 14, duration: 180, flashTint: 0xff7a7a, hitStop: 50 },
  death: { duration: 320 },
  spawn: { duration: 280, stagger: 90 },
  pawn: { hop: 150, hopHeight: 26 },
  dice: { tumble: 620, tumbleFrame: 70, settle: 220, critHold: 500 },
  tile: { pulse: 260, pulseScale: 1.14 },
  fx: { frame: 55 },
  floatText: { duration: 800, rise: 56 },
  banner: { in: 180, hold: 720, out: 220 },
  shake: { light: 6, heavy: 14, duration: 240 },
  hpBar: { tween: 160 },
  round: { gap: 120 },
  bossWindup: { hold: 620 },
  gold: { tick: 260 },
  speeds: [1, 2],
} as const;

/** Honour the OS "reduce motion" setting until the in-game toggle exists (M6). */
export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
