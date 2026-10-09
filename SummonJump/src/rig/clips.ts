/** Keyframe clip sampling for cut-out rigs (pure, testable). Clips live in JSON next to the rig. */
export type Pose = Record<string, number>;
export interface Clip { dur: number; loop: boolean; ease: 'linear' | 'smooth' | 'out'; keys: ({ t: number } & Pose)[] }

const EASE = {
  linear: (k: number) => k,
  smooth: (k: number) => k * k * (3 - 2 * k),
  out: (k: number) => 1 - (1 - k) * (1 - k),
};

/** Pose of `clip` at `time` seconds since it started. Non-looping clips hold their last key. */
export function sampleClip(clip: Clip, time: number): Pose {
  const keys = clip.keys;
  let k = clip.dur > 0 ? time / clip.dur : 1;
  k = clip.loop ? k - Math.floor(k) : Math.min(1, Math.max(0, k));
  if (!clip.loop) k = EASE[clip.ease](k);
  let i = 0;
  while (i < keys.length - 2 && (keys[i + 1] as { t: number }).t <= k) i++;
  const a = keys[i] as Pose & { t: number }, b = (keys[i + 1] ?? a) as Pose & { t: number };
  const span = b.t - a.t;
  let f = span > 0 ? (k - a.t) / span : 0;
  if (clip.loop) f = EASE[clip.ease](Math.min(1, Math.max(0, f)));
  const out: Pose = {};
  for (const j of Object.keys(a)) if (j !== 't') out[j] = (a[j] as number) + ((b[j] as number) - (a[j] as number)) * f;
  return out;
}

/** Blend two poses (cross-fade between clips). */
export function blendPose(a: Pose, b: Pose, f: number): Pose {
  const out: Pose = {};
  for (const j of Object.keys(b)) out[j] = (a[j] ?? (b[j] as number)) + ((b[j] as number) - (a[j] ?? (b[j] as number))) * f;
  return out;
}
