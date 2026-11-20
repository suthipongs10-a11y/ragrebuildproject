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
  high:     {th:'เตะก้านคอ', en:'High kick', kind:'kick', sfx:'kick', lvl:'head', reach:102, min:76, dmg:17, st:9, push:10, eff:'footR', react:'hitHeadSide', gb:.9, stun:2, kd:.05,
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
  // elbows inside the clinch: the holder slashes down with the free arm; the held man can drive one up through the middle.
  // Both are thrown at arm's length from a raised guard, so they are stopped far more often than a knee (high gb).
  clinchElbow: {th:'ศอกตัดในวงกอด', en:'Clinch elbow', kind:'punch', sfx:'elbow', lvl:'head', reach:78, min:16, dmg:13, st:5, push:0, eff:'elbowR', react:'clinchHitHead', gb:2.5, stun:1.0, inClinch:1,
               fr:[['clinchElbowW',.15],['clinchElbow',.08],['clinchHold',.16]]},
  clinchElbowUp: {th:'ศอกงัดสวน', en:'Counter elbow', kind:'punch', sfx:'elbow', lvl:'head', reach:78, min:10, dmg:12, st:5, push:14, eff:'elbowR', react:'hitHeadUp', gb:1.6, stun:1.0, inClinch:1,
               fr:[['clinchElbowUpW',.13],['clinchElbowUp',.08],['clinchHeld',.16]]},
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
  oneTwoLow:  {th:'หนึ่งสองตัดขา', seq:['jab','cross','low']},
  teepTeep:   {th:'ถีบท้องถีบหน้า', seq:['teep','teepFace']}
};

// w = move weights, sp = specials used in rotation, b = stat bias, cb = combos and chance.
// walk = footwork speed and tough = damage taken. Rebalanced when the defender stopped backing away (proto-0.16): with the
// men standing their ground the in-fighter no longer needs a thick skin to get close, and the kicker needs a little help.
export const STYLES = [
  {id:'puncher', th:'หมัดหนัก', walk:1.1, tough:.94, sp:['spChop','spHanu'], cc:.34, cb:['oneTwo','threePunch','lowHigh','oneTwoKick'],
   w:{jab:3,cross:3,hook:2.2,upper:1.6,bodyshot:1.6,elbow:1.6,spinElbow:.3,knee:.8,body:1.2,high:.5,low:1.2,teep:1.1,teepFace:.4,clinch:1.6},
   b:{pow:22,kick:-8,spd:0,def:-4,end:4,chin:4}},
  {id:'kicker', th:'จอมเตะ', tough:.94, sp:['spKick','spCroc'], cc:.32, cb:['legHead','teepKick','feintKick','oneTwoKick','teepTeep'],
   w:{jab:2,cross:1.1,hook:.5,upper:.3,bodyshot:.4,elbow:.7,spinElbow:.3,knee:1,body:3.4,high:1.7,low:2.4,teep:2.3,teepFace:1.3,clinch:1.3},
   b:{pow:-8,kick:22,spd:4,def:4,end:2,chin:0}},
  {id:'clinch', th:'เข่าศอก', walk:1.2, tough:1.09, sp:['spFly','spChop'], cc:.34, cb:['elbows','kneeElbow','oneTwo','lowHigh'],
   w:{jab:1.8,cross:1.4,hook:1.2,upper:1.2,bodyshot:.8,elbow:2.6,spinElbow:1.1,knee:3.2,body:1.5,high:.5,low:1.1,teep:1.3,teepFace:.6,clinch:4.6},
   b:{pow:6,kick:8,spd:-4,def:2,end:6,chin:6}},
  {id:'tech', th:'ฝีมือ', tough:.92, sp:['spKick','spFly'], cc:.3, cb:['feintKick','jabLow','oneTwoKick','teepKick','teepTeep'],
   w:{jab:3,cross:1.7,hook:1,upper:.6,bodyshot:.8,elbow:1.1,spinElbow:.6,knee:1.1,body:2.1,high:1,low:1.8,teep:2.7,teepFace:1.5,clinch:1.6},
   b:{pow:-4,kick:2,spd:14,def:16,end:0,chin:-2}}
];

export const FIRST = ['สิงห์แดง','พายุฟ้า','เพชรดำ','เสือสมิง','ฟ้าลั่น','ขุนศึก','ยอดเหล็ก','ศรเพชร','เดชฤทธิ์','ก้องหล้า','ทองแท้','น้ำเพชร'];
export const CAMP = ['ศ.เหล็กไหล','ลูกแม่มูล','ส.ฟ้าคะนอง','ค่ายพยัคฆ์','ว.ศรีทอง','เกียรติลำน้ำ','ศิษย์ครูเฒ่า'];
export const STAT_TH = {pow:'หมัดศอก', kick:'เตะเข่า', spd:'ความเร็ว', def:'ป้องกัน', end:'ความอึด', chin:'คาง'};

export const RULES = {
  dt: 1/60,
  roundTime: 60, rounds: 3, restTime: 3.4, introTime: 3.0,
  // footwork between exchanges: the walk eases in and out (gain, per second) and tops out at this share of a man's
  // walking speed, a little more when he is closing in to throw (the owner: moving and stepping far too quick)
  // and without a strike in mind he is content anywhere within walkDead (cm) of the distance he wants, so the two can stand
  walkGain: 5, walkK: .62, walkPlanK: .82, walkDead: 14,
  // standing his ground: a man lets the other come walkDeadIn (cm) inside the distance he likes before he gives way, and
  // then backs up at only walkBack of his walking speed (stepping out after a shot of his own is still quick). The owner:
  // the man defending sets his guard, pushes kicks and lifts the knee; he does not run, and nobody need chase.
  walkDeadIn: 30, walkBack: .45,
  // Instinct in the last round, when the corner has given no order to press or to wait (attitude 'balanced'): the man
  // behind on points throws a little sooner, covers a little less and stands a touch closer; the man ahead does the
  // opposite. Full effect when urgePts points apart. (The owner: what any fighter does unless told otherwise.)
  urgePts: 12, urgeCool: .16, urgeCover: .2, urgeDist: 6,
  planTime: 1.8,         // how long a man keeps closing in for the strike he has picked before he gives it up
  limit: 235,            // ring half width the fighters can use
  // off the ropes: within pivotNear (cm) of the limit a man looks to step out sideways, pivotRate times a second (quicker
  // men sooner); it takes pivotTime seconds and brings the pair pivotShift (cm) back toward the middle
  pivotNear: 30, pivotRate: 1.3, pivotTime: 1.9, pivotShift: 95,
  startX: 85,
  dmgScale: .137,          // global damage multiplier
  dmgStat: [.6, .8],       // a blow's power: this much whatever the stat, plus this much times the stat (0-1)
  statSpread: .56,         // how much of the gap between the two men's stats counts in the ring (sim.js ringStats)
  statGap: [.12, .4], statSpreadFar: 1, // ... for men within 12% of each other on paper; from there more of it counts, all of it from 40% apart
  blockDmg: .06,         // share of base damage that gets through a block
  // how much more often than a style's own weights say each fist punch is chosen: fights are meant to have plenty of hands
  fistBias: {jab: 1.2, cross: 1.6, hook: 1.9, upper: 1.9, bodyshot: 1.6},
  blockBase: .7, dodgeBase: .15, // more guard and more head movement (owner, round 62: blows were landing too easily; 56% landed, now about 45%)
  evadeShare: .6,        // share of head-level blocks that become a slip or a duck (scaled by speed / 55)
  // On top of that, a man standing his ground gets out of the way: he slips punches to the head left and right, and bends
  // back or sucks his body back from kicks to the body and head (scaled by speed / 55)
  slipBase: .17, kickDodge: .36,
  // a signature move trained up a level (spec.spLv, 1-3): harder to block or slip, and heavier, per level above the first
  spLvAcc: .15, spLvDmg: .1,
  // raising the guard on reading an attack: chance, and how much it helps when the read is right or wrong
  coverBase: .3, coverDef: .4, coverRead: .75, coverBonus: .3, coverMul: 1.7, coverWrong: .5,
  critChance: .1, critMul: 1.5, counterMul: 1.3,
  chainChance: .14,      // chance to attack again right away without a named combo
  coolMin: .4, coolMax: 1.15,
  stRegen: 4.6, stRegenEnd: 5,
  spGain: 2.3, spTake: 1.1, // fewer blows land since round 62, so each fills the gauge a little more
  // stun
  // (owner, round 62: men shook off clean shots too easily. A flush shot dazes more surely, the daze lasts longer, and for
  // a few seconds after it he is still groggy: slower hands and feet, easier to put down.)
  stunMin: 19, stunSpan: 30, stunWearDiv: 400, stunRest: 3.5, stunDurMin: 2.1, stunDurSpan: 1.5,
  stunClean: 1.35,       // a flush shot (a counter or right on the button) dazes this much more surely
  groggyTime: 4.5, groggyDef: .7, groggyKd: 1.25, groggyWalk: .75,
  rockHold: .25,         // a heavy shot to the head that does not daze still rocks him: this much longer before he is himself again
  kdMoveRaw: 13, kdMoveClean: 2, // a move's own knockdown chance (MOVES kd) needs this much behind it, and counts double when flush
  // knockdown: only head shots put a fighter down
  kdRaw: 21, kdChance: .015, kdStunRaw: 10, kdStunChance: .08, kdLowHp: 25, kdLowChance: .02,
  kdWearDiv: 600, outBase: .46, outRawDiv: 50, outHpDiv: 300,
  // a clean shot (counter or flush) is what usually ends a Muay Thai fight
  kdClean: .04, outClean: .1, kdSpecialMul: .8,
  // clinch: knees thrown, time before the referee breaks it, chance the held fighter shakes loose after each knee
  clinchKneesMin: 2, clinchKneesSpan: 3, clinchMax: 3.8, clinchEscape: .12, clinchDist: 48,
  clinchEnter: .7, clinchShove: 22, // chance a reach for the neck ties the other man up; otherwise he is shoved back this far (cm)
  clinchStyleEscape: .45, clinchStyleKnees: 1, // a clinch specialist holds on better and gets an extra knee in
  clinchHeadKnee: .3,     // share of clinch knees that pull the head down onto the knee
  clinchElbow: .28, clinchElbowStyle: .1,   // share of the holder's clinch strikes that are elbows (more for a clinch specialist)
  // chance the held man answers one of those strikes with an elbow of his own: base, plus his power / 100 times the second number
  clinchCounter: .14, clinchCounterPow: .12, clinchCounterStyle: 1.4,
  throwTry: .7, throwBase: .5, throwPoints: 3, throwDown: 1.35, // dumping the opponent out of the clinch: scores, no count
  // catching a body kick, then punching with the free hand
  catchBase: .09, catchDef: .12, catchHold: 1.15,
  countStep: .62,
  // Scoring, live: a clean strike scores by how hard it lands (index = severity: light, solid, heavy or signature move);
  // a strike is solid from sevSolid raw damage and heavy from sevBig. A blocked strike scores nothing.
  // A knockdown that draws a count is worth ten clean strikes: about one round's usual winning margin.
  hitPoints: [0, 1, 1, 2], sevSolid: 8, sevBig: 13, kdPoints: 10,
  // Pace: how hard both men are going, 0..1, from the start to the end of each round (index = round - 1). The first round
  // is for reading the other man: single shots, light touches, a kick and straight back out. It builds toward each bell
  // and from the second round on. ramp > 1 keeps the build late in the round.
  pace: {start: [.12, .62, .85], end: [.6, 1, 1], ramp: 1.5},
  paceCool: [3.2, .85],   // gap between attacks, times the usual, at pace 0 and at full pace
  paceCombo: .12,         // named combos and quick follow-ups at pace 0: this share of their usual rate
  paceFeel: .4,           // at pace 0, chance a fighter opens with a short feeler instead of a single shot
  feelCombos: ['oneTwo', 'oneTwoLow', 'jabLow'],
  paceHeavy: .28,         // heavy close weapons and the clinch at pace 0: this share of their usual weight
  heavyMoves: ['hook', 'upper', 'elbow', 'spinElbow', 'knee', 'high', 'clinch'],
  probeUp: 1.7, probeMoves: ['jab', 'low', 'teep', 'body'], // the reading weapons, this much more likely at pace 0
  // a light touch (jab, push kick, low kick thrown at a low pace) lands with this share of the power and push
  paceLight: .5, lightShare: .85, lightMoves: ['jab', 'cross', 'low', 'teep'],
  paceBack: .75, backDist: 162, // at pace 0, chance to step straight back out of range after a single shot, and to how far
  paceRange: 16,          // extra distance kept at pace 0
  paceDmg: [.85, 1.2],    // power of a full shot at pace 0 and at full pace
  leanBackHold: .34,      // leaning back from a kick: how long the defender stays back
  restHp: 1.4, restSt: 12
};

// Fight plan: what the corner tells the fighter for a round. Each choice trades one thing for another.
export const PLAN = {
  ag: {attack: 'เดินตี', balanced: 'ดูเชิง', counter: 'ตั้งรับ'},
  range: {out: 'วงนอก', mixed: 'ตามจังหวะ', in: 'วงใน'},
  target: {head: 'หัว', body: 'ลำตัว', leg: 'ขา', mixed: 'ผสม'}
};
export const PLAN_DEFAULT = {ag: 'balanced', range: 'mixed', target: 'mixed'};
// signature moves a fighter can carry, and the highest level of one
export const SPECIALS = ['spChop', 'spHanu', 'spKick', 'spCroc', 'spFly'], SP_MAX = 3;
// The rest between rounds of the player's own fight: the next round starts by itself after this many seconds, unless he asks it to wait
export const REST_AUTO = 30;
// The players' cup (cup.js): what each place wins [money, fame]: champion, runner-up, semi-finalist, the rest of the field
export const CUP_PRIZE = [[3000, 30], [1200, 12], [500, 5], [150, 2]];
// A match between two players: the game and the server both read these. Seconds unless said otherwise.
export const LIVE = {
  ready: 30,        // the bell no sooner than this after the challenge is accepted
  quickWait: 90,    // how long a "fight now" challenge waits for its answer
  quitUntil: 3,     // no withdrawing this close to the bell
  rest: 20, pick: 13, read: 16, // the rest between rounds; the next round's plan can be changed for the first `pick` of it; every screen reads both plans at `read`
  cornerIn: 2.3,    // from the bell that ends a round to the fighters being in their corners (where the rest starts on the clock)
  matchLen: 300,    // a match counts as under way for this long after its bell
  keepDays: 3,      // finished matches stay on the list this long
  reward: {win: [400, 10], lose: [100, 2], draw: [250, 6]} // money, fame
};
export const PLAN_RULES = {
  attackCool: .72, counterCool: 1.3, attackCover: .65, counterCover: 1.25, attackSt: 1.08, counterSt: .92, attackDmg: 1.05, counterBonus: .3,
  jam: .94, keepAway: .9, outRegen: .93, inCover: .8, outVsIn: 1.05, // walking in leaves the guard open, and a fighter kept outside eats long weapons // crowding blunts kicks; staying outside blunts close weapons but costs legs
  outDist: 8, outBack: .55, inDist: -16,
  // how each attitude moves: the counter fighter barely advances and keeps the push kick going; the attacker ties up more
  // and throws more (attackCool), but walks no faster than anyone else (owner: going forward means more weapons, not quicker feet)
  counterAdvance: .22, counterStepIn: .75, attackAdvance: 1, counterTeep: 1.9, counterPush: 1.3, attackClinch: 1.25,
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

// "Skip to the result" on the player's own fights: so many a day (the real day, at midnight), more for an advert in the
// app (adCap adverts, `ad` skips each). Watching other people's fights is never counted. Owner, 20 Nov 2026: one player
// skipped 109 of 117 fights and made half a million baht in 88 minutes.
export const SKIP = {free: 10, ad: 5, adCap: 3};

// What money buys besides the camp's five levels (owner, 20 Nov 2026: players had far more money than things to buy).
// build: bought once, a lasting help, open from a camp level (gym). daily: once per game day, priced by the league
// (base + perLeague x league index). merit: as often as he likes, each gift dearer than the last (base x grow^n,
// rounded to 50).
export const SHOP = {
  build: [
    {id: 'sauna', th: 'ห้องซาวน่า', price: 15000, gym: 2, night: 10, note: 'นอนพักแล้วความล้าลดเพิ่มอีก 10'},
    {id: 'weights', th: 'ห้องยกน้ำหนัก', price: 30000, gym: 3, train: .1, note: 'ซ้อมได้ผลเพิ่มอีก 10%'},
    {id: 'ring', th: 'เวทีซ้อมในค่าย', price: 60000, gym: 4, slots: 1, note: 'แรงซ้อมวันละ 4 ครั้ง (จาก 3)'},
    {id: 'shrine', th: 'ศาลพ่อครู', price: 100000, gym: 5, note: 'ทุกเช้าอารมณ์ดีขึ้นหนึ่งขั้น จนถึง "ดี"'}
  ],
  daily: [
    {id: 'massage', th: 'นวดแผนไทยเต็มชั่วโมง', base: 200, perLeague: 150, fat: 30, note: 'ความล้า −30 ไม่เสียแรงซ้อม'},
    {id: 'meal', th: 'เลี้ยงข้าวทั้งค่าย', base: 150, perLeague: 120, mood: 1, note: 'อารมณ์ดีขึ้นหนึ่งขั้น'}
  ],
  merit: {th: 'ทำบุญถวายวัดประจำหมู่บ้าน', base: 500, grow: 1.6, fame: 5, mood: 1}
};

// Beating a much weaker opponent pays less (owner, 20 Nov 2026: a fighter trained far past a tournament's entrants won
// 106 tournament fights for half a million baht). Only fights against opponents of fixed strength (tournaments, title
// fights); the others are already matched to the fighter. ratio = his stat total / the opponent's; at or below `from`
// the full purse and fame, then `slope` less per 1.0 of ratio, never below `min`.
export const EASY = {from: 1.15, slope: 2, min: .2, kinds: ['tour', 'title']};

// Titles (ฉายา): bought in the camp, shown before the fighter's name in the ranking and the chat. A fixed list: nobody
// types one, so there is nothing to moderate. need: belts he must hold to buy it. Made-up words, no real fighter's nickname.
export const TITLES = [
  {id: 'mo', th: 'ลูกหม้อค่าย', price: 2000},
  {id: 'teep', th: 'จอมถีบ', price: 5000},
  {id: 'kick', th: 'จอมเตะ', price: 5000},
  {id: 'punch', th: 'หมัดหนัก', price: 5000},
  {id: 'knee', th: 'เข่าเหล็ก', price: 8000},
  {id: 'elbow', th: 'ศอกกลับ', price: 8000},
  {id: 'tiger', th: 'พยัคฆ์หนุ่ม', price: 15000},
  {id: 'dragon', th: 'มังกรไฟ', price: 25000},
  {id: 'lion', th: 'ราชสีห์สังเวียน', price: 50000, need: 1},
  {id: 'general', th: 'ขุนพลสังเวียน', price: 100000, need: 2},
  {id: 'lord', th: 'จ้าวสังเวียน', price: 200000, need: 3}
];

