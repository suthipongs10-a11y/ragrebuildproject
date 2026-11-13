// 3D pose library. Fighter-local frame, metres: x toward the opponent, y up, z to the fighter's right.
// Orthodox stance: left side (-z) leads.
// hip = pelvis position, turn = pelvis yaw (positive = left side forward), lean = pitch toward the opponent,
// side = roll to the right, twist = extra shoulder yaw, hdP/hdY = head pitch/yaw, jump = root height, spin = whole-body turn.
// hL/hR = glove targets, fL/fR = sole targets, eL/eR = elbow pole, kL/kR = knee pole.
const BASE = {
  hip: [0, .88, 0], turn: .42, lean: .07, side: 0, twist: .08, hdP: .06, hdY: 0, jump: 0, spin: 0,
  hL: [.40, 1.56, -.11], hR: [.25, 1.51, .12],
  fL: [.26, 0, -.12], fR: [-.22, 0, .16],
  eL: [-.2, -1, -.5], eR: [-.2, -1, .5],
  kL: [1, 0, -.2], kR: [.8, 0, .5]
};
const P = o => Object.assign({}, BASE, o);

export const POSES = {
  guard: P({}),
  wai: P({turn: 0, twist: 0, lean: .42, hdP: .3, hip: [0, .86, 0], hL: [.30, 1.24, -.03], hR: [.30, 1.24, .03], fL: [0, 0, -.11], fR: [0, 0, .11], kL: [1, 0, -.1], kR: [1, 0, .1]}),

  jabW: P({turn: .5, hip: [-.01, .86, 0], hL: [.34, 1.50, -.11]}),
  jab: P({turn: .9, twist: .25, lean: .18, hip: [.07, .86, 0], hL: [.82, 1.52, -.02], hR: [.2, 1.48, .12], fL: [.31, 0, -.13]}),
  crossW: P({turn: .72, twist: .2, hip: [-.02, .85, 0], hR: [.12, 1.44, .17]}),
  cross: P({turn: -.35, twist: -.35, lean: .26, hip: [.13, .84, 0], hR: [.86, 1.52, -.02], hL: [.22, 1.47, -.13], fR: [-.26, .04, .15], kR: [1, 0, .1]}),
  hookW: P({turn: .8, twist: .3, hip: [.02, .85, 0], hL: [.24, 1.45, -.32], eL: [-.3, -.2, -1]}),
  hook: P({turn: -.15, twist: -.35, lean: .16, hip: [.09, .85, 0], hL: [.50, 1.52, .06], eL: [-.7, .1, -1], hR: [.2, 1.48, .13], fL: [.26, .03, -.13]}),
  upperW: P({turn: .6, lean: .32, hip: [.05, .77, 0], hR: [.22, 1.06, .15], eR: [-1, -.3, .3]}),
  upper: P({turn: -.2, twist: -.2, lean: 0, hip: [.13, .91, 0], hR: [.50, 1.64, 0], eR: [-.3, -1, .3], hL: [.24, 1.46, -.13], fR: [-.22, .05, .15]}),
  bodyW: P({turn: .65, lean: .25, hip: [.02, .80, 0], hR: [.14, 1.28, .17]}),
  bodyShot: P({turn: -.3, twist: -.3, lean: .44, hdP: -.2, hip: [.13, .76, 0], hR: [.82, 1.12, -.02], hL: [.28, 1.42, -.1], fR: [-.26, .04, .15]}),

  elbowW: P({turn: .7, hip: [.08, .86, 0], hR: [.10, 1.50, .24], eR: [-.3, .4, 1], fL: [.32, 0, -.13]}),
  elbow: P({turn: -.45, twist: -.45, lean: .3, hip: [.22, .85, 0], hR: [.22, 1.50, -.12], eR: [1, .25, .1], hL: [.24, 1.45, -.14], fL: [.34, 0, -.13], fR: [-.2, .04, .15]}),
  chopW: P({turn: .5, lean: -.05, hip: [.10, .92, 0], hR: [.15, 1.98, .16], eR: [.3, 1, .3], fL: [.32, 0, -.13], fR: [-.2, .05, .15]}),
  chop: P({turn: -.4, twist: -.4, lean: .42, hip: [.26, .80, 0], hR: [.26, 1.34, -.06], eR: [1, .55, 0], hL: [.24, 1.4, -.15], fL: [.36, 0, -.13], fR: [-.16, .04, .15]}),
  spinW: P({spin: 3.3, turn: .3, lean: .1, hip: [.10, .85, 0], hR: [0, 1.45, .26], eR: [-.2, .3, 1], hL: [.2, 1.45, -.12]}),
  spinElbow: P({spin: 6.0, turn: -.3, twist: -.4, lean: .25, hip: [.20, .85, 0], hR: [.2, 1.5, -.1], eR: [1, .3, .2], hL: [.22, 1.45, -.14]}),

  kneeW: P({turn: .3, hip: [.08, .87, 0], hL: [.56, 1.55, -.12], hR: [.52, 1.50, .12], fR: [-.12, .10, .13]}),
  knee: P({turn: -.2, lean: -.2, hip: [.22, .93, 0], hL: [.46, 1.36, -.10], hR: [.44, 1.30, .10], fR: [.40, .63, .06], kR: [1, .6, 0], fL: [.2, .04, -.13]}),
  flyW: P({lean: .32, hip: [0, .72, 0], hL: [.3, 1.3, -.12], hR: [.26, 1.26, .12]}),
  fly: P({jump: .38, turn: -.1, lean: -.1, hip: [.30, .95, 0], hL: [.42, 1.42, -.1], hR: [.4, 1.38, .1], fR: [.5, .72, .05], kR: [1, .6, 0], fL: [-.1, .25, -.1], kL: [1, -.2, -.2]}),

  kickW: P({turn: -.2, lean: -.05, hip: [.05, .88, 0], fR: [-.05, .35, .30], kR: [.6, .3, 1], hR: [.10, 1.30, .30], fL: [.22, .03, -.13]}),
  kickBody: P({turn: -1.3, twist: .5, lean: -.30, side: -.25, hip: [.10, .90, 0], fR: [.92, 1.12, -.05], kR: [.5, .3, 1], hR: [-.25, 1.0, .35], hL: [.25, 1.5, -.05], fL: [.22, .04, -.13]}),
  kickHigh: P({turn: -1.3, twist: .5, lean: -.5, side: -.3, hip: [.08, .95, 0], fR: [.80, 1.58, -.03], kR: [.5, .3, 1], hR: [-.3, .95, .35], hL: [.22, 1.45, -.05], fL: [.22, .06, -.13]}),
  kickLow: P({turn: -1.1, twist: .4, lean: -.1, hip: [.10, .82, 0], fR: [.85, .42, -.08], kR: [.5, .3, 1], hR: [-.1, 1.1, .35], fL: [.22, .03, -.13]}),
  teepW: P({lean: -.1, hip: [-.05, .88, 0], fL: [.25, .55, -.10], kL: [1, .5, 0]}),
  teep: P({turn: .3, lean: -.35, hip: [.05, .90, 0], fL: [.95, 1.02, -.03], kL: [1, .4, 0], hL: [.2, 1.2, -.3], hR: [.18, 1.45, .12]}),
  teepHiW: P({turn: .1, lean: -.12, hip: [-.04, .90, 0], fR: [.15, .62, .10], kR: [1, .6, .1], fL: [.22, .03, -.13]}),
  teepHi: P({turn: -.2, lean: -.46, hip: [.08, .93, 0], fR: [.92, 1.50, 0], kR: [1, .5, .1], hR: [.1, 1.2, .3], hL: [.25, 1.5, -.1], fL: [.2, .04, -.13]}),
  crocW: P({spin: 3.0, lean: .2, hip: [0, .85, 0], fR: [-.1, .2, .2], hL: [.2, 1.4, -.15], hR: [.1, 1.4, .2]}),
  croc: P({spin: 5.6, turn: 0, lean: -.45, hip: [.05, .92, 0], fR: [.9, 1.5, 0], kR: [.3, 1, .3], hL: [.1, 1.2, -.3], hR: [-.1, 1.2, .3], fL: [.1, .04, -.1]}),
  hanuW: P({turn: .2, lean: .36, hip: [.05, .68, 0], hL: [.26, 1.0, -.13], hR: [.26, 1.0, .13], eL: [-1, -.2, -.3], eR: [-1, -.2, .3]}),
  hanu: P({jump: .30, turn: 0, twist: 0, lean: -.05, hdP: -.2, hip: [.25, .95, 0], hL: [.5, 1.68, -.07], hR: [.5, 1.68, .07], fL: [.1, .10, -.12], fR: [-.2, .15, .14]}),

  // clinch: the holder's gloves are aimed at the opponent's neck by the presenter
  clinchHold: P({turn: .12, twist: 0, lean: .14, hip: [.02, .88, 0], hL: [.44, 1.50, -.07], hR: [.44, 1.50, .07], eL: [-.1, -1, -.7], eR: [-.1, -1, .7], fL: [.14, 0, -.17], fR: [-.2, 0, .17]}),
  clinchHeld: P({turn: .15, twist: 0, lean: .4, hdP: .35, hip: [-.03, .84, 0], hL: [.34, 1.16, -.15], hR: [.32, 1.13, .15], fL: [.16, 0, -.2], fR: [-.22, 0, .2]}),
  clinchKneeW: P({turn: .3, twist: 0, lean: .08, hip: [0, .9, 0], hL: [.44, 1.46, -.07], hR: [.44, 1.46, .07], eL: [-.1, -1, -.7], eR: [-.1, -1, .7], fL: [.14, .02, -.17], fR: [-.34, .22, .17], kR: [.5, -.4, .3]}),
  clinchKnee: P({turn: -.25, twist: 0, lean: -.16, hip: [.1, .95, 0], hL: [.4, 1.36, -.07], hR: [.4, 1.36, .07], eL: [-.1, -1, -.7], eR: [-.1, -1, .7], fL: [.14, .05, -.17], fR: [.26, .6, .04], kR: [1, .6, 0]}),
  clinchHit: P({turn: .1, twist: 0, lean: .62, hdP: .4, hip: [-.07, .8, 0], hL: [.28, 1.04, -.13], hR: [.26, 1.02, .13], fL: [.16, 0, -.2], fR: [-.24, 0, .2]}),
  clinchPulled: P({turn: .1, twist: 0, lean: .78, hdP: .3, hip: [-.02, .8, 0], hL: [.3, .95, -.16], hR: [.28, .92, .16], fL: [.16, 0, -.22], fR: [-.24, 0, .22]}),
  clinchKneeHi: P({turn: -.25, twist: 0, lean: -.2, hip: [.12, .97, 0], hL: [.38, 1.2, -.07], hR: [.38, 1.2, .07], eL: [-.1, -1, -.7], eR: [-.1, -1, .7], fL: [.14, .06, -.17], fR: [.3, .78, .04], kR: [1, .7, 0]}),
  clinchHitHead: P({turn: .1, twist: 0, lean: -.05, hdP: -.55, hip: [-.08, .84, 0], hL: [.26, 1.1, -.2], hR: [.22, 1.05, .2], fL: [.16, 0, -.22], fR: [-.26, 0, .22]}),
  // elbows in the clinch: the holder keeps one glove on the neck and slashes with the other arm; the held man drives one up
  clinchElbowW: P({turn: .55, twist: .25, lean: .1, hip: [.02, .88, 0], hL: [.44, 1.5, -.07], hR: [.12, 1.6, .26], eL: [-.1, -1, -.7], eR: [-.3, .6, 1], fL: [.14, 0, -.17], fR: [-.2, 0, .17]}),
  clinchElbow: P({turn: -.35, twist: -.45, lean: .22, hip: [.08, .87, 0], hL: [.44, 1.48, -.07], hR: [.3, 1.5, -.1], eL: [-.1, -1, -.7], eR: [1, .35, .1], fL: [.14, 0, -.17], fR: [-.16, .03, .17]}),
  clinchCover: P({turn: .15, twist: 0, lean: .32, hdP: .3, hip: [-.02, .85, 0], hL: [.3, 1.5, -.1], hR: [.24, 1.56, .1], eL: [.4, -.6, -.6], eR: [.4, -.6, .6], fL: [.16, 0, -.2], fR: [-.22, 0, .2]}),
  clinchElbowUpW: P({turn: .4, twist: .2, lean: .36, hdP: .25, hip: [-.02, .82, 0], hL: [.32, 1.2, -.14], hR: [.14, 1.2, .2], eR: [-.6, -.4, .8], fL: [.16, 0, -.2], fR: [-.22, 0, .2]}),
  clinchElbowUp: P({turn: -.3, twist: -.35, lean: .12, hdP: 0, hip: [.06, .9, 0], hL: [.3, 1.3, -.14], hR: [.26, 1.62, 0], eR: [1, .7, .15], fL: [.16, 0, -.2], fR: [-.2, .03, .2]}),
  throwW: P({turn: .7, twist: .3, lean: .18, side: .1, hip: [.04, .84, 0], hL: [.44, 1.46, -.07], hR: [.44, 1.46, .07], eL: [-.1, -1, -.7], eR: [-.1, -1, .7], fL: [.2, 0, -.2], fR: [-.2, 0, .22]}),
  throw: P({turn: -.9, twist: -.5, lean: .32, side: -.25, hip: [.02, .8, .06], hL: [.3, 1.0, .25], hR: [.1, .95, .4], fL: [.26, 0, -.24], fR: [-.22, 0, .1]}),
  // kick caught: the kicker hops on one leg; the catcher clamps the ankle at his side and punches with the free hand
  caught: P({turn: -1.0, twist: .35, lean: -.25, side: -.1, hip: [.02, .9, 0], fR: [.85, 1.0, -.1], kR: [.5, .3, 1], fL: [.2, .03, -.13], hL: [.25, 1.42, -.32], hR: [-.1, 1.28, .42]}),
  catchHold: P({turn: .5, lean: .1, hip: [0, .86, 0], hL: [.22, 1.04, -.24], eL: [-.5, -.3, -1], hR: [.2, 1.46, .15]}),
  catchPunch: P({turn: -.3, twist: -.35, lean: .22, hip: [.1, .85, 0], hL: [.22, 1.04, -.24], eL: [-.5, -.3, -1], hR: [.82, 1.5, 0], fR: [-.24, .04, .16], kR: [1, 0, .1]}),
  catchBody: P({turn: -.3, twist: -.3, lean: .36, hdP: -.15, hip: [.1, .8, 0], hL: [.22, 1.04, -.24], eL: [-.5, -.3, -1], hR: [.78, 1.12, 0], fR: [-.24, .04, .16], kR: [1, 0, .1]}),

  block: P({lean: .2, hdP: .25, hip: [-.02, .84, 0], hL: [.27, 1.58, -.07], hR: [.21, 1.56, .08]}),
  blockBody: P({lean: .3, hip: [0, .82, 0], hL: [.26, 1.24, -.15], hR: [.2, 1.3, .15]}),
  // knee lifted to meet a body kick, elbow dropped onto it
  checkBody: P({lean: .12, hip: [-.04, .9, 0], fL: [.24, .6, -.08], kL: [1, .7, -.55], hL: [.3, 1.28, -.17], eL: [.3, -1, -.5], hR: [.22, 1.52, .1]}),
  check: P({lean: .05, hip: [-.04, .88, 0], fL: [.28, .42, -.12], kL: [1, .4, -.6], hL: [.3, 1.5, -.12]}),
  // head movement: duck under a swing, slip a straight punch to either side
  duck: P({turn: .3, lean: .56, hdP: .12, hip: [.03, .67, 0], hL: [.34, 1.22, -.1], hR: [.26, 1.2, .1], fL: [.28, 0, -.14], fR: [-.24, 0, .18]}),
  slipL: P({lean: .24, side: -.4, twist: .22, hdP: .1, hip: [.01, .81, -.08], hL: [.32, 1.42, -.17], hR: [.22, 1.44, .05]}),
  slipR: P({lean: .24, side: .4, twist: -.22, hdP: .1, hip: [.01, .81, .08], hL: [.34, 1.44, -.05], hR: [.2, 1.4, .17]}),
  dodge: P({lean: -.42, hdP: -.1, hip: [-.12, .86, 0], hL: [.2, 1.38, -.12], hR: [.1, 1.36, .13]}),
  // bending right back from a kick: weight sunk on the rear leg, lead foot light, chin tucked, rear glove by the face
  leanBack: P({turn: .55, lean: -.62, hdP: .12, hip: [-.2, .82, .02], hL: [-.14, 1.43, -.14], hR: [-.28, 1.35, .12], fL: [.3, .03, -.12], fR: [-.24, 0, .17], kR: [.8, 0, .6]}),

  hitHeadBack: P({lean: -.35, hdP: -.5, hip: [-.10, .86, 0], hL: [.2, 1.3, -.2], hR: [.1, 1.25, .2]}),
  hitHeadSide: P({lean: -.1, side: .35, hdP: -.1, hdY: .9, hip: [-.08, .84, .05], hL: [.22, 1.25, -.2], hR: [.1, 1.2, .25]}),
  hitHeadUp: P({lean: -.3, hdP: -.8, hip: [-.06, .90, 0], hL: [.25, 1.2, -.18], hR: [.15, 1.18, .2]}),
  hitBody: P({lean: .6, hdP: .3, hip: [-.12, .80, 0], hL: [.16, 1.05, -.1], hR: [.14, 1.0, .1]}),
  hitBodySide: P({lean: .25, side: -.4, hip: [-.05, .82, -.06], hL: [.1, 1.1, -.25], hR: [.2, 1.3, .15]}),
  hitLeg: P({lean: .3, hip: [-.06, .76, 0], fL: [.12, .08, -.02], kL: [1, 0, .4], hL: [.3, 1.35, -.15]}),
  stunA: P({lean: .25, side: .2, hdP: .3, hip: [-.05, .80, .06], hL: [.25, 1.15, -.2], hR: [.15, 1.1, .25], fL: [.2, 0, -.2], fR: [-.2, 0, .2]}),
  stunB: P({lean: -.1, side: -.2, hdP: -.2, hip: [-.08, .82, -.06], hL: [.3, 1.3, -.25], hR: [.1, 1.0, .3], fL: [.22, 0, -.16], fR: [-.3, 0, .25]}),

  fall1: P({turn: 0, twist: 0, lean: -1.0, hdP: -.4, hip: [-.35, .55, 0], hL: [-.3, 1.0, -.45], hR: [-.35, .95, .45], fL: [.15, .12, -.12], fR: [-.1, 0, .15]}),
  down: P({turn: 0, twist: 0, lean: -1.5, hdP: 0, hip: [-.75, .13, 0], hL: [-1.3, .04, -.6], hR: [-1.2, .04, .62], eL: [0, -.2, -1], eR: [0, -.2, 1], fL: [0, .02, -.16], fR: [.1, .02, .2], kL: [0, 1, -.2], kR: [0, 1, .2]}),
  getup: P({turn: .2, lean: .55, hip: [-.45, .50, 0], hL: [-.15, .2, -.25], hR: [-.2, .5, .2], fL: [-.15, 0, -.15], fR: [-.75, 0, .15], kR: [.5, -1, 0]}),
  // after the fight: standing square and tall, arms down; gloves reaching out to touch the other man's and a small bow
  cerStand: P({turn: 0, twist: 0, lean: .02, hdP: .04, hip: [0, .93, 0], hL: [.1, .93, -.27], hR: [.1, .93, .27], eL: [-.3, -1, -.4], eR: [-.3, -1, .4], fL: [.03, 0, -.13], fR: [-.03, 0, .13], kL: [1, 0, -.1], kR: [1, 0, .1]}),
  cerTouch: P({turn: 0, twist: 0, lean: .2, hdP: .3, hip: [-.02, .91, 0], hL: [.36, 1.17, -.07], hR: [.36, 1.15, .07], eL: [-.2, -1, -.5], eR: [-.2, -1, .5], fL: [.08, 0, -.13], fR: [-.1, 0, .13], kL: [1, 0, -.1], kR: [1, 0, .1]}),
  win: P({turn: 0, twist: 0, lean: -.05, hdP: -.2, hip: [0, .90, 0], hL: [.05, 2.0, -.35], hR: [.05, 2.0, .35], eL: [0, -.3, -1], eR: [0, -.3, 1], fL: [.05, 0, -.18], fR: [-.05, 0, .18], kL: [1, 0, -.2], kR: [1, 0, .2]})
};

// Flat layout used for blending and baking.
export const NP = 35;
const VEC = {hip: 0, hL: 11, hR: 14, fL: 17, fR: 20, eL: 23, eR: 26, kL: 29, kR: 32};
const NUM = {turn: 3, lean: 4, side: 5, twist: 6, hdP: 7, hdY: 8, jump: 9, spin: 10};
export const IDX = Object.assign({}, VEC, NUM);
export function flat(p) {
  const a = new Float32Array(NP);
  for (const k in VEC) { a[VEC[k]] = p[k][0]; a[VEC[k] + 1] = p[k][1]; a[VEC[k] + 2] = p[k][2]; }
  for (const k in NUM) a[NUM[k]] = p[k];
  return a;
}
export const FLAT = {};
for (const k in POSES) FLAT[k] = flat(POSES[k]);

// Poses were authored for the default skeleton. A model with other proportions scales the heights:
// pelvis height by kHip, hand and foot heights by kY. scalePoses(1, 1) restores the originals.
const FLAT_BASE = {};
for (const k in FLAT) FLAT_BASE[k] = new Float32Array(FLAT[k]);
export function scalePoses(kHip, kY) {
  for (const k in FLAT) {
    const a = FLAT[k], b = FLAT_BASE[k]; a.set(b);
    a[IDX.hip + 1] = b[IDX.hip + 1] * kHip;
    for (const i of [IDX.hL, IDX.hR, IDX.fL, IDX.fR]) a[i + 1] = b[i + 1] * kY;
  }
}
