// Fight data for the 3D prototype. Distances in cm, times in seconds.
// Every balance number lives here, not in sim.js.

// fr = [poseName, duration] frames. Frame 0 is the wind-up, frame 1 the strike
// (the hit resolves when frame 1 completes), the rest is recovery.
// eff = striking end effector, used by the presenter for aiming, trails and fx.
// gb = block chance multiplier (lower = harder to block). stun = stun weight.
export const MOVES = {
  jab:      {th:'หมัดแย็บ', en:'Jab', kind:'punch', sfx:'punch', lvl:'head', reach:104, min:60, dmg:5, st:3, push:4, eff:'handL', react:'hitHeadBack', gb:1, stun:.5,
             fr:[['jabW',.07],['jab',.07],['guard',.14]]},
  cross:    {th:'หมัดตรง', en:'Cross', kind:'punch', sfx:'punch', lvl:'head', reach:104, min:60, dmg:10, st:5, push:8, eff:'handR', react:'hitHeadBack', gb:1, stun:1,
             fr:[['crossW',.1],['cross',.09],['guard',.2]]},
  hook:     {th:'หมัดฮุก', en:'Hook', kind:'punch', sfx:'punch', lvl:'head', reach:90, min:46, dmg:12, st:6, push:5, eff:'handL', react:'hitHeadSide', gb:.75, stun:1.25,
             fr:[['hookW',.11],['hook',.09],['guard',.2]]},
  upper:    {th:'หมัดเสย', en:'Uppercut', kind:'punch', sfx:'punch', lvl:'head', reach:82, min:42, dmg:13, st:6, push:4, eff:'handR', react:'hitHeadUp', gb:.7, stun:1.35,
             fr:[['upperW',.12],['upper',.09],['guard',.22]]},
  bodyshot: {th:'หมัดลำตัว', en:'Body shot', kind:'punch', sfx:'punch', lvl:'body', reach:94, min:50, dmg:9, st:5, push:5, eff:'handR', react:'hitBody', gb:.9, stun:0,
             fr:[['bodyW',.1],['bodyShot',.09],['guard',.18]]},
  elbow:    {th:'ศอกตี', en:'Elbow', kind:'punch', sfx:'elbow', lvl:'head', reach:84, min:42, dmg:15, st:6, push:6, eff:'elbowR', react:'hitHeadSide', gb:.85, stun:1.2,
             fr:[['elbowW',.11],['elbow',.08],['guard',.22]]},
  spinElbow:{th:'ศอกกลับ', en:'Spinning elbow', kind:'punch', sfx:'elbow', lvl:'head', reach:84, min:44, dmg:18, st:9, push:8, eff:'elbowR', react:'hitHeadSide', gb:.8, stun:1.6,
             fr:[['spinW',.17],['spinElbow',.1],['guard',.3]]},
  knee:     {th:'เข่าตรง', en:'Knee', kind:'kick', sfx:'knee', lvl:'body', reach:86, min:42, dmg:14, st:5, push:8, eff:'kneeR', react:'hitBody', gb:.9, stun:0,
             fr:[['kneeW',.12],['knee',.1],['guard',.24]]},
  body:     {th:'เตะลำตัว', en:'Body kick', kind:'kick', sfx:'kick', lvl:'body', reach:106, min:74, dmg:11, st:7, push:10, eff:'footR', react:'hitBodySide', gb:1, stun:0,
             fr:[['kickW',.13],['kickBody',.1],['kickW',.1],['guard',.16]]},
  high:     {th:'เตะก้านคอ', en:'High kick', kind:'kick', sfx:'kick', lvl:'head', reach:102, min:76, dmg:17, st:9, push:10, eff:'footR', react:'hitHeadSide', gb:.9, stun:1.5,
             fr:[['kickW',.15],['kickHigh',.11],['kickW',.12],['guard',.18]]},
  low:      {th:'เตะขา', en:'Low kick', kind:'kick', sfx:'kick', lvl:'leg', reach:106, min:74, dmg:8, st:5, push:3, eff:'footR', react:'hitLeg', gb:.8, stun:0,
             fr:[['kickW',.11],['kickLow',.09],['kickW',.09],['guard',.14]]},
  teep:     {th:'ถีบท้อง', en:'Body teep', kind:'kick', sfx:'knee', lvl:'body', reach:108, min:80, dmg:6, st:4, push:28, eff:'footL', react:'hitBody', gb:1, stun:0, aimY:-.14,
             fr:[['teepW',.11],['teep',.09],['guard',.2]]},
  teepFace: {th:'ถีบหน้า', en:'Face teep', kind:'kick', sfx:'knee', lvl:'head', reach:106, min:78, dmg:9, st:6, push:24, eff:'footR', react:'hitHeadBack', gb:.9, stun:.6,
             fr:[['teepHiW',.14],['teepHi',.1],['teepHiW',.1],['guard',.18]]},

  // clinch and counters
  clinch:     {th:'กอดคอ', en:'Clinch', kind:'kick', lvl:'body', reach:84, min:34, dmg:0, st:4, grab:1, fr:[]},
  clinchKnee: {th:'กอดคอตีเข่า', en:'Clinch knee', kind:'kick', sfx:'knee', lvl:'body', reach:78, min:16, dmg:12, st:4, push:0, eff:'kneeR', react:'clinchHit', gb:.6, stun:0, inClinch:1,
               fr:[['clinchKneeW',.17],['clinchKnee',.1],['clinchHold',.16]]},
  clinchKneeHead: {th:'โน้มคอตีเข่า', en:'Neck-pull knee', kind:'kick', sfx:'knee', lvl:'head', reach:78, min:16, dmg:16, st:6, push:0, eff:'kneeR', react:'clinchHitHead', gb:.6, stun:1.1, inClinch:1, pull:1,
               fr:[['clinchKneeW',.2],['clinchKneeHi',.1],['clinchHold',.18]]},
  clinchThrow: {th:'เหวี่ยงล้ม', en:'Clinch dump', kind:'kick', sfx:'knee', lvl:'body', reach:90, min:10, dmg:4, st:7, push:0, eff:'handR', react:'fall1', gb:1, stun:0, inClinch:1, throw:1,
               fr:[['throwW',.2],['throw',.15],['guard',.34]]},
  catchPunch: {th:'จับขาชกหน้า', en:'Catch and punch', kind:'punch', sfx:'punch', lvl:'head', reach:140, min:16, dmg:9, st:4, push:24, eff:'handR', react:'hitHeadBack', gb:1, stun:0, noKd:1,
               fr:[['catchHold',.2],['catchPunch',.1],['catchHold',.1],['guard',.2]]},
  catchBody:  {th:'จับขาชกลำตัว', en:'Catch and body shot', kind:'punch', sfx:'punch', lvl:'body', reach:140, min:16, dmg:9, st:4, push:24, eff:'handR', react:'hitBody', gb:1, stun:0, noKd:1,
               fr:[['catchHold',.2],['catchBody',.1],['catchHold',.1],['guard',.2]]},

  spChop:   {th:'ศอกสับ', en:'Chopping Elbow', kind:'punch', sfx:'elbow', lvl:'head', reach:96, min:42, dmg:25, st:12, push:12, eff:'elbowR', react:'hitHeadBack', gb:1, stun:1.7, special:1, lunge:18,
             fr:[['chopW',.22],['chop',.08],['guard',.28]]},
  spKick:   {th:'เตะก้านคอสายฟ้า', en:'Lightning High Kick', kind:'kick', sfx:'kick', lvl:'head', reach:104, min:74, dmg:26, st:12, push:16, eff:'footR', react:'hitHeadSide', gb:1, stun:1.8, special:1,
             fr:[['kickW',.2],['kickHigh',.09],['kickW',.14],['guard',.2]]},
  spFly:    {th:'เข่าลอย', en:'Flying Knee', kind:'kick', sfx:'knee', lvl:'head', reach:124, min:60, dmg:26, st:12, push:16, eff:'kneeR', react:'hitHeadUp', gb:1, stun:1.7, special:1, lunge:36,
             fr:[['flyW',.2],['fly',.16],['guard',.32]]},
  spCroc:   {th:'จระเข้ฟาดหาง', en:'Crocodile Tail', kind:'kick', sfx:'kick', lvl:'head', reach:108, min:70, dmg:27, st:13, push:18, eff:'footR', react:'hitHeadSide', gb:1, stun:1.9, special:1,
             fr:[['crocW',.24],['croc',.12],['guard',.34]]},
  spHanu:   {th:'หนุมานถวายแหวน', en:"Hanuman's Ring", kind:'punch', sfx:'punch', lvl:'head', reach:100, min:44, dmg:25, st:12, push:10, eff:'handR', react:'hitHeadUp', gb:1, stun:1.8, special:1, lunge:26,
             fr:[['hanuW',.22],['hanu',.11],['guard',.32]]}
};

export const COMBOS = {
  oneTwo:     {th:'หนึ่งสอง', seq:['jab','cross']},
  oneTwoKick: {th:'หนึ่งสองเตะ', seq:['jab','cross','body']},
  threePunch: {th:'สามหมัด', seq:['jab','cross','hook']},
  lowHigh:    {th:'เจาะล่างขึ้นบน', seq:['bodyshot','hook','upper']},
  legHead:    {th:'ล่างบน', seq:['low','high']},
  teepKick:   {th:'ถีบตามเตะ', seq:['teep','body','body']},
  elbows:     {th:'ศอกคู่', seq:['elbow','spinElbow']},
  kneeElbow:  {th:'เข่าตามศอก', seq:['knee','knee','elbow']},
  feintKick:  {th:'แย็บเปิดเตะ', seq:['jab','high']},
  jabLow:     {th:'แย็บตัดขา', seq:['jab','jab','low']},
  teepTeep:   {th:'ถีบท้องถีบหน้า', seq:['teep','teepFace']}
};

// w = move weights, sp = specials used in rotation, b = stat bias, cb = combos and chance.
// walk = footwork speed and tough = damage taken, for the styles that have to walk through fire to get close.
export const STYLES = [
  {id:'puncher', th:'หมัดหนัก', walk:1.1, tough:.94, sp:['spChop','spHanu'], cc:.34, cb:['oneTwo','threePunch','lowHigh','oneTwoKick'],
   w:{jab:3,cross:3,hook:2.2,upper:1.6,bodyshot:1.6,elbow:1.6,spinElbow:.3,knee:.8,body:1.2,high:.5,low:1.2,teep:1.1,teepFace:.4,clinch:1.6},
   b:{pow:22,kick:-8,spd:0,def:-4,end:4,chin:4}},
  {id:'kicker', th:'จอมเตะ', sp:['spKick','spCroc'], cc:.32, cb:['legHead','teepKick','feintKick','oneTwoKick','teepTeep'],
   w:{jab:2,cross:1.1,hook:.5,upper:.3,bodyshot:.4,elbow:.7,spinElbow:.3,knee:1,body:3.4,high:1.7,low:2.4,teep:2.3,teepFace:1.3,clinch:1.3},
   b:{pow:-8,kick:22,spd:4,def:0,end:-2,chin:-4}},
  {id:'clinch', th:'เข่าศอก', walk:1.2, tough:.86, sp:['spFly','spChop'], cc:.34, cb:['elbows','kneeElbow','oneTwo','lowHigh'],
   w:{jab:1.8,cross:1.4,hook:1.2,upper:1.2,bodyshot:.8,elbow:2.6,spinElbow:1.1,knee:3.2,body:1.5,high:.5,low:1.1,teep:1.3,teepFace:.6,clinch:4.6},
   b:{pow:8,kick:10,spd:-4,def:2,end:10,chin:10}},
  {id:'tech', th:'ฝีมือ', sp:['spKick','spFly'], cc:.3, cb:['feintKick','jabLow','oneTwoKick','teepKick','teepTeep'],
   w:{jab:3,cross:1.7,hook:1,upper:.6,bodyshot:.8,elbow:1.1,spinElbow:.6,knee:1.1,body:2.1,high:1,low:1.8,teep:2.7,teepFace:1.5,clinch:1.6},
   b:{pow:-4,kick:2,spd:14,def:16,end:0,chin:-2}}
];

export const FIRST = ['สิงห์แดง','พายุฟ้า','เพชรดำ','เสือสมิง','ฟ้าลั่น','ขุนศึก','ยอดเหล็ก','ศรเพชร','เดชฤทธิ์','ก้องหล้า','ทองแท้','น้ำเพชร'];
export const CAMP = ['ศ.เหล็กไหล','ลูกแม่มูล','ส.ฟ้าคะนอง','ค่ายพยัคฆ์','ว.ศรีทอง','เกียรติลำน้ำ','ศิษย์ครูเฒ่า'];
export const STAT_TH = {pow:'หมัดศอก', kick:'เตะเข่า', spd:'ความเร็ว', def:'ป้องกัน', end:'ความอึด', chin:'คาง'};

export const RULES = {
  dt: 1/60,
  roundTime: 35, rounds: 3, restTime: 3.4, introTime: 3.0,
  limit: 235,            // ring half width the fighters can use
  startX: 85,
  dmgScale: .137,          // global damage multiplier
  blockDmg: .06,         // share of base damage that gets through a block
  // how much more often than a style's own weights say each fist punch is chosen: fights are meant to have plenty of hands
  fistBias: {jab: 1.2, cross: 1.6, hook: 1.9, upper: 1.9, bodyshot: 1.6},
  blockBase: .5, dodgeBase: .12,
  evadeShare: .6,        // share of head-level blocks that become a slip or a duck (scaled by speed / 55)
  // raising the guard on reading an attack: chance, and how much it helps when the read is right or wrong
  coverBase: .2, coverDef: .4, coverRead: .75, coverBonus: .3, coverMul: 1.7, coverWrong: .5,
  critChance: .1, critMul: 1.5, counterMul: 1.3,
  chainChance: .14,      // chance to attack again right away without a named combo
  coolMin: .4, coolMax: 1.15,
  stRegen: 4.6, stRegenEnd: 5,
  spGain: 1.9, spTake: 1.1,
  // stun
  stunMin: 21, stunSpan: 34, stunWearDiv: 400, stunRest: 7, stunDurMin: 1.5, stunDurSpan: 1.1,
  // knockdown: only head shots put a fighter down
  kdRaw: 21, kdChance: .05, kdStunRaw: 10, kdStunChance: .17, kdLowHp: 25, kdLowChance: .03,
  kdWearDiv: 600, outBase: .4, outRawDiv: 50, outHpDiv: 300,
  // a clean shot (counter or flush) is what usually ends a Muay Thai fight
  kdClean: .09, outClean: .1, kdSpecialMul: .8,
  // clinch: knees thrown, time before the referee breaks it, chance the held fighter shakes loose after each knee
  clinchKneesMin: 2, clinchKneesSpan: 3, clinchMax: 3.8, clinchEscape: .12, clinchDist: 48,
  clinchStyleEscape: .45, clinchStyleKnees: 1, // a clinch specialist holds on better and gets an extra knee in
  clinchHeadKnee: .3,     // share of clinch knees that pull the head down onto the knee
  throwTry: .7, throwBase: .5, throwPoints: 3, throwDown: 1.35, // dumping the opponent out of the clinch: scores, no count
  // catching a body kick, then punching with the free hand
  catchBase: .09, catchDef: .12, catchHold: 1.15,
  countStep: .62,
  // Scoring, live: a clean strike scores by how hard it lands (index = severity: light, solid, heavy or signature move);
  // a strike is solid from sevSolid raw damage and heavy from sevBig. A blocked strike scores nothing.
  // A knockdown that draws a count is worth ten clean strikes: about one round's usual winning margin.
  hitPoints: [0, 1, 1, 2], sevSolid: 8, sevBig: 13, kdPoints: 10,
  restHp: 1.4, restSt: 12
};

// Fight plan: what the corner tells the fighter for a round. Each choice trades one thing for another.
export const PLAN = {
  ag: {attack: 'เดินตี', balanced: 'ดูเชิง', counter: 'ตั้งรับ'},
  range: {out: 'วงนอก', mixed: 'ตามจังหวะ', in: 'วงใน'},
  target: {head: 'หัว', body: 'ลำตัว', leg: 'ขา', mixed: 'ผสม'}
};
export const PLAN_DEFAULT = {ag: 'balanced', range: 'mixed', target: 'mixed'};
export const PLAN_RULES = {
  attackCool: .72, counterCool: 1.3, attackCover: .65, counterCover: 1.25, attackSt: 1.08, counterSt: .92, attackDmg: 1.05, counterBonus: .3,
  jam: .94, keepAway: .8, outRegen: .93, inCover: .8, outVsIn: 1.12, // walking in leaves the guard open, and a fighter kept outside eats long weapons // crowding blunts kicks; staying outside blunts close weapons but costs legs
  outDist: 12, inDist: -16,
  // how each attitude moves: the counter fighter barely advances and keeps the push kick going, the attacker walks forward and ties up more
  counterAdvance: .22, counterStepIn: .75, attackAdvance: 1.12, counterTeep: 1.9, counterPush: 1.3, attackClinch: 1.25,
  // chance that a landed push kick sits the opponent down (scores like a dump, no count)
  teepDump: .03, teepDumpCounter: .05, teepDumpVsAttack: .04, teepDumpCaught: .08, teepDumpTired: .06,
  outMoves: ['body', 'high', 'low', 'teep', 'teepFace', 'jab'], inMoves: ['elbow', 'spinElbow', 'knee', 'hook', 'upper', 'bodyshot'],
  rangeUp: 1.3, rangeDown: .65, clinchOut: .5, clinchIn: 1.3, targetUp: 1.8, targetDown: .7, legUp: 3.4
};

// How a computer-run fighter of each style fights. The player's corner advice is measured against these (tools/plans.mjs).
export const STYLE_PLAN = {
  puncher: {ag: 'attack', range: 'mixed', target: 'head'}, kicker: {ag: 'balanced', range: 'out', target: 'mixed'},
  clinch: {ag: 'balanced', range: 'mixed', target: 'body'}, tech: {ag: 'counter', range: 'mixed', target: 'mixed'}
};

// Rules that differ by venue. Rope-bound fists instead of gloves: every blow does more, and a guard stops less of it.
export const VENUE_RULES = {
  chuek: {dmgScale: RULES.dmgScale * 1.12, blockDmg: .1}
};
