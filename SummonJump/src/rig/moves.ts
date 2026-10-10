import type { Clip, Pose } from './clips';

/**
 * Action clips built in code from a fighting stance + per-key changes (anticipation → strike → follow-through → recover).
 * One combo per weapon (sword / staff / bow / mace) and one clip per skill type, so every job moves differently.
 *
 * Rig params (radians unless noted): bob = body drop (+ = crouch, sheet units) · dx = body shift forward (sheet units)
 * · sq = squash (+) / stretch (−) · lean (+ = forward) · ua upper arm (0 down, π up, ~4.7 forward) · fa forearm
 * · ba back forearm · sw weapon · tf/sf/tb/sb front/back thigh and shin · head · scarf · rot whole body.
 */
const PARAMS = ['bob', 'dx', 'sq', 'lean', 'ua', 'fa', 'ba', 'sw', 'tf', 'sf', 'tb', 'sb', 'head', 'scarf', 'rot'] as const;

/** Fighting stance: knees bent, weapon ready, slight forward lean. */
export const STANCE: Pose = { bob: 22, dx: 0, sq: 0, lean: 0.08, ua: 0.7, fa: -0.7, ba: 0.35, sw: -1.24, tf: -0.28, sf: 0.38, tb: 0.28, sb: 0.22, head: 0, scarf: 0.15, rot: 0 };

const full = (p: Pose): Pose => Object.fromEntries(PARAMS.map((k) => [k, p[k] ?? STANCE[k] ?? 0]));
/** Build a clip: keys are deltas over the stance (absolute values, missing params = stance). */
function clip(dur: number, keys: [number, Pose][], loop = false): Clip {
  return { dur, loop, ease: 'linear', keys: keys.map(([t, p]) => ({ t, ...full(p) })) };
}

// common pieces
const CROUCH: Pose = { bob: 48, sq: 0.07, tf: -0.5, sf: 0.75, tb: 0.45, sb: 0.45 };
const STEP: Pose = { tf: -0.7, sf: 0.45, tb: 0.55, sb: 0.15 };

const SWORD: Record<string, Clip> = {
  // overhead cut: small crouch + pull back, lunge with a step, follow through, settle
  attack1: clip(0.26, [
    [0, {}], [0.16, { ...CROUCH, ua: 2.5, fa: -1.0, lean: -0.08, dx: -10, head: -0.05, sw: -0.6 }],
    [0.38, { ...STEP, bob: 18, ua: 5.0, fa: -0.1, sw: 0.3, lean: 0.3, dx: 62, sq: -0.05, head: 0.06, scarf: 0.5 }],
    [0.62, { ...STEP, bob: 30, ua: 5.6, fa: 0.25, sw: 0.4, lean: 0.34, dx: 70, scarf: 0.6 }],
    [1, { ua: 4.4, fa: -0.3, sw: 0, lean: 0.12, dx: 20 }]]),
  // rising cut from low
  attack2: clip(0.26, [
    [0, { ua: 4.6, fa: -0.3, sw: 0, dx: 20 }], [0.18, { ...CROUCH, bob: 60, ua: 5.7, fa: 0.3, sw: 0.5, lean: 0.22, dx: 30 }],
    [0.42, { ...STEP, bob: -4, ua: 2.9, fa: -0.9, sw: -0.4, lean: -0.06, dx: 58, sq: -0.08, head: -0.1, scarf: 0.6 }],
    [0.66, { bob: 6, ua: 2.5, fa: -1.0, sw: -0.6, lean: -0.1, dx: 62, scarf: 0.7 }],
    [1, { ua: 3.0, fa: -0.6, lean: 0, dx: 30 }]]),
  // finisher: deep crouch, leap, smash down with a landing squash
  attack3: clip(0.36, [
    [0, { ua: 3.0, dx: 30 }], [0.16, { ...CROUCH, bob: 85, sq: 0.13, ua: 1.9, fa: -1.1, lean: -0.15, dx: 10, head: -0.1 }],
    [0.36, { bob: -55, sq: -0.1, ua: 3.4, fa: -0.6, lean: 0.05, dx: 55, tf: -1.0, sf: 1.2, tb: 0.2, sb: 1.0, rot: -0.12, scarf: 0.9 }],
    [0.58, { ...STEP, bob: 55, sq: 0.12, ua: 5.7, fa: 0.3, sw: 0.5, lean: 0.42, dx: 95, rot: 0.06, scarf: 0.4 }],
    [1, { ...STEP, bob: 30, ua: 5.2, fa: 0, sw: 0.3, lean: 0.2, dx: 70 }]]),
};

const STAFF: Record<string, Clip> = {
  // pull back, thrust the staff forward
  attack1: clip(0.26, [
    [0, {}], [0.2, { ...CROUCH, ua: 1.2, fa: -1.2, lean: -0.15, dx: -15, sw: -1.6 }],
    [0.45, { ...STEP, bob: 15, ua: 4.6, fa: 0.1, lean: 0.22, dx: 45, sq: -0.04, sw: -1.1 }],
    [1, { ua: 3.8, fa: -0.4, lean: 0.08, dx: 15 }]]),
  attack2: clip(0.26, [
    [0, { ua: 3.8, dx: 15 }], [0.2, { bob: 35, ua: 5.5, fa: 0.3, lean: 0.15, sw: -0.4 }],
    [0.45, { bob: 5, ua: 3.0, fa: -1.0, lean: -0.08, dx: 35, sq: -0.05, sw: -1.8 }], [1, { ua: 2.6, fa: -0.8, dx: 20 }]]),
  // twirl overhead and slam the staff: magic burst
  attack3: clip(0.36, [
    [0, { ua: 2.6, dx: 20 }], [0.2, { ...CROUCH, ua: 3.4, fa: -0.4, lean: -0.12, head: -0.15, sw: -2.4 }],
    [0.4, { bob: -10, ua: 6.2, fa: 0.2, lean: 0.05, sq: -0.08, sw: -0.4, head: -0.2 }],
    [0.6, { ...STEP, bob: 50, sq: 0.1, ua: 5.4, fa: 0.2, lean: 0.35, dx: 60, sw: 0.2 }], [1, { ua: 4.8, lean: 0.15, dx: 40 }]]),
};

const BOW: Record<string, Clip> = {
  // aim, draw (lean back, back hand pulls hard), release with a clear recoil hop
  attack1: clip(0.26, [
    [0, { ua: 4.7, fa: 0, ba: 0.3, sw: -0.4, lean: 0 }], [0.3, { ...CROUCH, bob: 38, ua: 4.8, fa: 0.05, ba: -1.8, lean: -0.2, dx: -10, sw: -0.4, head: 0.06, scarf: 0.4 }],
    [0.45, { bob: 26, ua: 4.6, fa: -0.1, ba: 0.8, lean: 0.12, dx: -30, sq: -0.05, sw: -0.4, scarf: 0.7 }], [1, { ua: 4.6, fa: -0.05, ba: 0.3, dx: -10, sw: -0.4 }]]),
  attack2: clip(0.26, [
    [0, { ua: 4.6, sw: -0.4 }], [0.3, { ...CROUCH, bob: 70, ua: 4.3, ba: -1.9, lean: 0.2, sw: -0.4, sq: 0.08 }],
    [0.45, { ...CROUCH, bob: 60, ua: 4.3, ba: 0.8, lean: 0.25, dx: -26, sw: -0.4 }], [1, { ua: 4.6, sw: -0.4, dx: -8 }]]),
  // hop back and shoot in the air
  attack3: clip(0.36, [
    [0, { ua: 4.6, sw: -0.4 }], [0.2, { ...CROUCH, bob: 75, ua: 4.4, ba: -1.2, sw: -0.4, sq: 0.1 }],
    [0.45, { bob: -55, ua: 5.0, ba: -1.9, lean: -0.2, dx: -55, rot: -0.14, tf: -0.9, sf: 1.1, tb: 0.1, sb: 0.9, sw: -0.4 }],
    [0.6, { bob: -50, ua: 5.0, ba: 0.8, lean: -0.1, dx: -75, rot: -0.1, sw: -0.4, sq: -0.05 }], [1, { bob: 40, ua: 4.6, sw: -0.4, dx: -60, sq: 0.08 }]]),
};

const MACE: Record<string, Clip> = {
  // heavy overhead smash with an impact squash
  attack1: clip(0.28, [
    [0, {}], [0.25, { bob: 30, ua: 2.9, fa: -0.8, lean: -0.18, dx: -8, sq: 0.04, head: -0.06 }],
    [0.45, { ...STEP, bob: 50, ua: 5.4, fa: 0.1, lean: 0.36, dx: 50, sq: 0.1, sw: 0.3 }], [1, { bob: 32, ua: 5.0, lean: 0.2, dx: 30, sw: 0.2 }]]),
  attack2: clip(0.28, [
    [0, { ua: 5.0, dx: 30 }], [0.25, { bob: 30, ua: 1.6, fa: -0.6, lean: 0.05, sw: -1.6 }],
    [0.48, { ...STEP, bob: 25, ua: 4.4, fa: -0.2, lean: 0.25, dx: 55, sq: -0.04 }], [1, { ua: 4.0, lean: 0.1, dx: 30 }]]),
  attack3: clip(0.38, [
    [0, { ua: 4.0, dx: 30 }], [0.2, { ...CROUCH, bob: 70, ua: 3.1, fa: -0.6, lean: -0.2, sq: 0.1, head: -0.1 }],
    [0.4, { bob: -40, ua: 3.3, lean: -0.05, dx: 40, sq: -0.08, rot: -0.08, tf: -0.9, sf: 1.0, sb: 0.9 }],
    [0.6, { ...STEP, bob: 75, sq: 0.15, ua: 5.8, fa: 0.3, lean: 0.45, dx: 75, sw: 0.5 }], [1, { bob: 40, ua: 5.2, lean: 0.25, dx: 60 }]]),
};

/** Skill clips by skills.csv `target` (weapon-neutral; the weapon follows the arm). */
const SKILLS: Record<string, Clip> = {
  skill_front: clip(0.42, [
    [0, {}], [0.2, { ...CROUCH, bob: 80, sq: 0.12, ua: 1.7, fa: -1.2, lean: -0.2, head: -0.1, dx: -15 }],
    [0.42, { ...STEP, bob: -25, sq: -0.1, ua: 4.9, fa: 0.1, sw: 0.3, lean: 0.4, dx: 110, scarf: 0.9 }],
    [0.62, { ...STEP, bob: 45, sq: 0.08, ua: 5.8, fa: 0.3, sw: 0.5, lean: 0.4, dx: 120 }], [1, { ua: 4.6, lean: 0.15, dx: 60 }]]),
  skill_aoe: clip(0.45, [
    [0, {}], [0.25, { ...CROUCH, bob: 70, ua: 3.1, fa: -0.5, lean: -0.15, sq: 0.1, head: -0.15 }],
    [0.45, { bob: -30, ua: 3.4, lean: -0.05, sq: -0.1, rot: -0.1, tf: -0.9, sf: 1.1, sb: 1.0 }],
    [0.62, { bob: 95, sq: 0.18, ua: 5.9, fa: 0.3, lean: 0.45, dx: 30, sw: 0.5, tf: -0.8, sf: 1.2, tb: 0.7, sb: 0.9 }], [1, { bob: 50, ua: 5.2, lean: 0.25, dx: 20 }]]),
  skill_bolt: clip(0.42, [
    [0, {}], [0.3, { bob: 15, ua: 3.4, fa: -0.3, lean: -0.15, head: -0.15, sq: -0.04, sw: -2.2 }],
    [0.5, { ...STEP, bob: 25, ua: 4.75, fa: 0.1, lean: 0.2, dx: 30, sw: -1.0 }], [0.7, { bob: 25, ua: 4.7, lean: 0.12, dx: 18 }], [1, { ua: 4.2, dx: 10 }]]),
  skill_rain: clip(0.5, [
    [0, {}], [0.3, { ...CROUCH, ua: 2.0, lean: -0.1 }],
    [0.55, { bob: -8, ua: 3.35, fa: 0, lean: -0.22, head: -0.35, sq: -0.06, sw: -2.5, ba: -2.4 }], [1, { bob: 0, ua: 3.3, lean: -0.18, head: -0.3, sw: -2.5, ba: -2.2 }]]),
  skill_heal: clip(0.5, [
    [0, {}], [0.35, { bob: -12, ua: 3.0, fa: -0.3, ba: -2.6, lean: -0.12, head: -0.25, sq: -0.05, sw: -2.4, tf: -0.05, sf: 0.05, tb: 0.05, sb: 0.05 }],
    [1, { bob: -8, ua: 2.9, fa: -0.2, ba: -2.5, lean: -0.1, head: -0.2, sw: -2.4, tf: -0.05, sf: 0.05, tb: 0.05, sb: 0.05 }]]),
  skill_buff: clip(0.45, [
    [0, {}], [0.3, { ...CROUCH, bob: 65, ua: 0.6, fa: -1.4, ba: 0.6, lean: 0.15, head: 0.1, sq: 0.1 }],
    [0.6, { bob: -15, ua: 3.6, fa: -0.6, ba: -2.0, lean: -0.1, head: -0.2, sq: -0.08 }], [1, { bob: 10, ua: 3.0, ba: -0.5 }]]),
  skill_dash: clip(0.35, [
    [0, {}], [0.15, { ...CROUCH, bob: 60, lean: 0.3, ua: 1.2 }],
    [0.4, { bob: 40, lean: 0.55, dx: 90, ua: 1.0, fa: -0.4, tf: -1.0, sf: 0.4, tb: 0.8, sb: 0.7, scarf: 1.1, sq: -0.05 }],
    [0.7, { ...STEP, bob: 30, lean: 0.4, dx: 80, ua: 5.2, sw: 0.4 }], [1, { lean: 0.15, dx: 30, ua: 4.6 }]]),
  skill_zone: clip(0.45, [
    [0, {}], [0.3, { bob: 10, ua: 3.3, lean: -0.1, sw: -2.0, head: -0.1 }],
    [0.55, { ...CROUCH, bob: 70, sq: 0.1, ua: 4.9, fa: 0.4, sw: 0.8, lean: 0.3, dx: 25 }], [1, { bob: 45, ua: 4.8, sw: 0.7, lean: 0.25, dx: 20 }]]),
  /** held while a skill's cast time runs: arm raised, gathering power */
  channel: clip(0.6, [
    [0, { bob: 10, ua: 3.2, ba: -1.8, lean: -0.08, head: -0.15, sw: -2.3 }], [0.5, { bob: 4, ua: 3.3, ba: -2.0, lean: -0.1, head: -0.2, sw: -2.3, sq: -0.03 }],
    [1, { bob: 10, ua: 3.2, ba: -1.8, lean: -0.08, head: -0.15, sw: -2.3 }]], true),
  /** landing from a big fall */
  land: clip(0.16, [[0, { ...CROUCH, bob: 70, sq: 0.14 }], [1, {}]]),
  /** fight-ready idle (replaces the relaxed idle) */
  idle: clip(1.6, [[0, {}], [0.5, { bob: 30, ua: 0.76, head: 0.02, scarf: 0.2 }], [1, {}]], true),
  hurt: clip(0.32, [
    [0, { bob: 30, lean: -0.38, head: -0.3, dx: -24, ua: -1.2, fa: -0.8, sq: 0.08, tf: 0.3, sf: 0.5, tb: -0.2, sb: 0.4, scarf: 0.8 }],
    [0.4, { bob: 26, lean: -0.25, head: -0.2, dx: -18, ua: -0.6, fa: -0.7, scarf: 0.6 }], [1, {}]]),
};

export type WeaponKind = 'sword' | 'staff' | 'bow' | 'mace';
const BY_WEAPON: Record<WeaponKind, Record<string, Clip>> = { sword: SWORD, staff: STAFF, bow: BOW, mace: MACE };

/** The clip to play for `name` with this weapon, or null to use the rig's JSON clip. */
export function moveFor(weapon: WeaponKind, name: string): Clip | null {
  return BY_WEAPON[weapon][name] ?? SKILLS[name] ?? null;
}

export const weaponKind = (subtype: string): WeaponKind => (subtype === 'staff' || subtype === 'bow' || subtype === 'mace' ? subtype : 'sword');
