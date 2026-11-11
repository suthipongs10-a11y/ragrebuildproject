// Deterministic fight simulation. No rendering, no Math.random, no clock.
// simulate({seed}) returns the full fight: per-tick fighter state, pose cues and an event log.
// The presenter only plays this back; it never decides an outcome.
import { MOVES, COMBOS, STYLES, FIRST, CAMP, STAT_TH, RULES, PLAN_DEFAULT, PLAN_RULES } from './data.js';

export const SIM_VERSION = 'proto-0.7';
export const TICK_FIELDS = 9; // x, hp, st, sp, state, wearHead, wearBody, wearLeg, points
export const STATE = {intro:0, idle:1, move:2, hit:3, block:4, stun:5, down:6, getup:7, ko:8, win:9, rest:10, cover:11, clinch:12, clinched:13, caught:14, thrown:15};

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function randomSpec(R, usedFirst) {
  const pick = a => a[Math.floor(R() * a.length)];
  let first;
  do { first = pick(FIRST); } while (usedFirst && usedFirst === first);
  const style = pick(STYLES), stats = {};
  Object.keys(STAT_TH).forEach(k => { stats[k] = Math.round(clamp(48 + R() * 24 + style.b[k], 30, 98)); });
  return {name: first + ' ' + pick(CAMP), first, style: style.id, stats, skin: Math.floor(R() * 4)};
}

// Ten-point must, as a Muay Thai judge marks a round: the winner gets 10, the loser 9; a round is 10:8 when the loser
// took a count or was clearly outclassed, 10:7 for two counts more than the other man, 10:10 when nothing separates them.
// eff = work done in the round by each fighter (knockdown bonus left out), c = counts each fighter took.
export function roundCard(eff0, eff1, c0, c1, K) {
  const s = [10, 10];
  if (c0 !== c1) s[c0 > c1 ? 0 : 1] = Math.max(7, 9 - Math.abs(c0 - c1));
  else {
    const hi = Math.max(eff0, eff1), lo = Math.min(eff0, eff1);
    if (hi > 0 && (hi - lo) / hi >= K.scoreEven) s[eff0 < eff1 ? 0 : 1] = (lo * K.scoreClear <= hi && hi - lo >= K.scoreClearMin) ? 8 : 9;
  }
  return s;
}

export function simulate(opts) {
  const seed = opts.seed >>> 0;
  const R = mulberry32(seed);
  const rnd = (a, b) => a + R() * (b - a);
  const pick = a => a[Math.floor(R() * a.length)];
  const K = opts.rules ? Object.assign({}, RULES, opts.rules) : RULES, DT = K.dt, LIM = K.limit; // a venue may change a few rules

  let specs = opts.specs;
  if (!specs) { const a = randomSpec(R); specs = [a, randomSpec(R, a.first)]; }
  if (opts.names) specs.forEach((sp, i) => { if (opts.names[i]) sp.name = opts.names[i]; }); // the owner's own name for the fighter

  const events = [], poses = [], ticks = [];
  let T = 0;
  let moveSeq = 0;
  const emit = e => { e.t = T; events.push(e); return e; };
  const say = html => emit({type: 'say', html});

  function mk(i, spec) {
    return {i, dir: i ? -1 : 1, x: i ? K.startX : -K.startX, name: spec.name, stats: spec.stats,
      style: STYLES.find(s => s.id === spec.style),
      spList: (spec.sp || []).filter(k => MOVES[k] && MOVES[k].special).slice(0, 3), // the owner's chosen signature moves, else the style's
      hp: 100, st: 100, sp: 0, kd: 0, pts: 0, pts0: 0, kdR: 0, card: 0, state: 'intro', cool: 0, plan: null, planT: 0,
      pt: 0, pd: .001, to: 'guard', q: [], qi: 0, mv: null, mvKey: null, hold: 0, inv: 0, lunge: 0,
      combo: null, ci: 0, chain: 0, chainT: 0, lastRes: null, spi: 0,
      wearHead: 0, wearBody: 0, wearLeg: 0, stunT: 0, stunCd: 0, stunFlip: 0, tough: 0,
      landed: 0, thrown: 0, used: {}, seen: 0, moveId: 0, coverLvl: null, guards: 0, grab: null};
  }
  const F = [mk(0, specs[0]), mk(1, specs[1])];
  const G = {cards: [], phase: 'intro', t: 0, round: 1, clock: K.roundTime, count: null, clinch: null, restT: 0, koT: 0, over: null, lead: -1, leadChanges: 0};

  // the corner's plan for the current round; opts.plans[fighter] is a list with one plan per round
  const PR = PLAN_RULES;
  function planOf(f) { const p = opts.plans && opts.plans[f.i]; return (p && (p[G.round - 1] || p[p.length - 1])) || PLAN_DEFAULT; }

  function setPose(f, name, d, extra) {
    f.to = name; f.pt = 0; f.pd = Math.max(.001, d);
    const p = {t: T, f: f.i, pose: name, d: f.pd};
    if (f.grab) p.grab = f.grab; // presenter aims the hands at the opponent's neck
    if (extra) Object.assign(p, extra);
    poses.push(p);
  }
  const speedOf = f => (0.82 + f.stats.spd / 100 * 0.42) * (f.st < 25 ? 0.82 : 1);
  const moveSpeed = (f, m) => speedOf(f) * (m.kind === 'kick' ? 1 - Math.min(.22, f.wearLeg / 380) : 1);

  function startMove(f, o, key) {
    const m = MOVES[key];
    f.mv = m; f.mvKey = key; f.q = m.fr; f.qi = 0; f.state = 'move'; f.plan = null; f.lastRes = null;
    const pl = planOf(f);
    f.st = Math.max(0, f.st - m.st * (pl.ag === 'attack' ? PR.attackSt : pl.ag === 'counter' ? PR.counterSt : 1)); f.thrown++; f.moveId = ++moveSeq;
    f.used[key] = (f.used[key] || 0) + 1;
    const sp = moveSpeed(f, m), tHit = T + (m.fr[0][1] + m.fr[1][1]) / sp;
    emit({type: 'move', by: f.i, move: key, tHit, special: !!m.special});
    if (m.special) { f.sp = 0; say('ท่าไม้ตาย! <b>' + f.name + '</b> ออก<b>' + m.th + '</b>'); }
    f.lunge = m.lunge || 0;
    setPose(f, m.fr[0][0], m.fr[0][1] / sp);
  }

  function choose(f, o) {
    if (f.sp >= 100 && f.st > 14) { const list = f.spList.length ? f.spList : f.style.sp, k = list[f.spi % list.length]; f.spi++; return k; }
    const stunned = o.state === 'stun';
    if (!stunned && R() < f.style.cc && f.st > 30) {
      const id = pick(f.style.cb);
      f.combo = {id, seq: COMBOS[id].seq}; f.ci = 0;
      emit({type: 'combo', by: f.i, id, n: f.combo.seq.length});
      return f.combo.seq[0];
    }
    const w = f.style.w, keys = Object.keys(w), pl = planOf(f);
    let tot = 0;
    const ws = keys.map(k => {
      const m = MOVES[k]; let v = w[k];
      if (f.st < 30 && m.st > 5) v *= .35;
      if (m.grab) { if (G.clinch || f.st < 20) v = 0; else if (stunned) v *= 1.3; }
      else if (stunned) v *= m.lvl === 'head' ? (m.dmg >= 10 ? 2.4 : 1) : .25;
      else if (o.hp < 30 && (k === 'high' || k === 'elbow' || k === 'knee' || k === 'hook')) v *= 1.6;
      if (o.wearLeg > 50 && k === 'low') v *= 1.5;
      if (pl.range === 'out') v *= m.grab ? PR.clinchOut : PR.outMoves.includes(k) ? PR.rangeUp : PR.inMoves.includes(k) ? PR.rangeDown : 1;
      else if (pl.range === 'in') v *= m.grab ? PR.clinchIn : PR.inMoves.includes(k) ? PR.rangeUp : PR.outMoves.includes(k) ? PR.rangeDown : 1;
      if (pl.ag === 'counter' && (k === 'teep' || k === 'teepFace')) v *= PR.counterTeep; // the man waiting keeps the other off with the push kick
      if (pl.ag === 'attack' && m.grab) v *= PR.attackClinch;
      if (!m.grab && pl.target !== 'mixed') v *= pl.target === 'leg' ? (k === 'low' ? PR.legUp : .85) : m.lvl === pl.target ? PR.targetUp : PR.targetDown;
      tot += v; return v;
    });
    let r = R() * tot;
    for (let i = 0; i < keys.length; i++) { r -= ws[i]; if (r <= 0) return keys[i]; }
    return 'jab';
  }

  function resolve(f, o) {
    const m = f.mv, key = f.mvKey, d = Math.abs(o.x - f.x);
    const base = {type: 'hit', by: f.i, on: o.i, move: key, lvl: m.lvl, special: !!m.special, raw: 0, dmg: 0, sev: 0, counter: false, crit: false, chain: 0};
    if (m.throw) { // dump out of the clinch: strength and balance decide it
      const p = clamp(K.throwBase + (f.stats.pow + f.stats.kick - o.stats.def - o.stats.end) / 220 + (o.st < 30 ? .15 : 0), .15, .8);
      const ok = G.clinch && G.clinch.a === f && R() < p;
      emit({type: 'throw', by: f.i, on: o.i, ok});
      if (!ok) { f.lastRes = 'miss'; say('<b>' + o.name + '</b> ยืนหลักแน่น เหวี่ยงไม่ล้ม'); endClinch('escape'); return; }
      dropClinch();
      f.pts += K.throwPoints; f.lastRes = 'hit'; f.cool = 1.3;
      o.hp = Math.max(1, o.hp - m.dmg * K.dmgScale * 2); o.st = Math.max(0, o.st - 8);
      o.state = 'thrown'; o.hold = K.throwDown; o.q = []; o.mv = null; o.combo = null; o.plan = null;
      setPose(o, 'fall1', .22);
      say('<b>' + f.name + '</b> เหวี่ยง <b>' + o.name + '</b> ลงไปนอนกับพื้น');
      return;
    }
    if (o.state === 'down' || o.state === 'getup' || o.state === 'ko' || o.state === 'thrown' || o.inv > 0) { f.lastRes = 'miss'; emit(Object.assign(base, {res: 'miss'})); return; }
    const slack = m.special ? 14 : 0;
    if (d > m.reach + 6 + slack || d < m.min - 14 - slack) {
      f.lastRes = 'miss'; f.chain = 0; emit(Object.assign(base, {res: 'miss'}));
      if (m.special) say('<b>' + f.name + '</b> ออก' + m.th + 'แต่พลาดเป้า');
      return;
    }
    // a body kick can be caught: the kicker is stuck on one leg and eats a punch from the free hand
    if (key === 'body' && !G.clinch && (o.state === 'idle' || o.state === 'cover' || o.state === 'block') &&
        R() < K.catchBase + o.stats.def / 100 * K.catchDef + (o.style.id === 'tech' ? .05 : 0)) {
      f.lastRes = 'catch'; f.chain = 0; f.combo = null; f.q = []; f.mv = null; f.lunge = 0; f.state = 'caught'; f.hold = K.catchHold;
      setPose(f, 'caught', .1, {hold: 'leg'});
      emit(Object.assign(base, {res: 'catch'}));
      say('<b>' + o.name + '</b> จับขาไว้ได้ แล้วสวนด้วยหมัด');
      o.combo = null; o.plan = null; startMove(o, f, R() < .55 ? 'catchPunch' : 'catchBody');
      o.lunge = Math.max(0, d - 72); // step in while holding the leg, to punching range
      return;
    }
    const held = o.state === 'clinched';
    let pB = o.stats.def / 100 * K.blockBase * m.gb, pD = o.stats.spd / 100 * K.dodgeBase;
    if (o.state === 'move') { pB *= .2; pD = 0; }
    else if (o.state === 'hit') { pB *= .35; pD = 0; }
    else if (o.state === 'stun') { pB *= .3; pD = 0; }
    else if (held) { pB *= .6; pD = 0; }
    else if (o.state === 'caught') { pB = 0; pD = 0; }
    else if (o.state === 'cover') { pD = 0; pB = o.coverLvl === m.lvl ? Math.min(.92, pB * K.coverMul + K.coverBonus) : pB * K.coverWrong; }
    if (o.st < 25) pB *= .7;
    if (m.special) { pB *= .45; pD *= .4; }
    if (f.chain > 0) pB *= Math.max(.5, 1 - f.chain * .15);
    pD *= 1 - Math.min(.5, o.wearLeg / 160);
    // upstairs, part of what would have been blocked is slipped or ducked instead, more so for a quick fighter
    if (m.lvl === 'head' && (o.state === 'idle' || o.state === 'block' || o.state === 'cover')) { const sh = Math.min(.8, K.evadeShare * o.stats.spd / 55) * pB; pD += sh; pB -= sh; }
    const r = R();
    if (r < pD && m.lvl !== 'leg') {
      o.state = 'block'; o.hold = .24; o.q = []; o.combo = null;
      setPose(o, 'dodge', .07);
      f.lastRes = 'dodge'; f.chain = 0; emit(Object.assign(base, {res: 'dodge'}));
      return;
    }
    if (r < pD + pB) {
      const dm = m.dmg * K.blockDmg;
      o.hp = Math.max(1, o.hp - dm); f.pts += dm * .5; o.st = Math.max(0, o.st - 2);
      if (m.lvl === 'leg') o.wearLeg += m.dmg * .25;
      if (!held) {
        o.state = 'block'; o.hold = .2; o.q = []; o.combo = null;
        setPose(o, m.lvl === 'leg' ? 'check' : m.lvl === 'body' ? 'blockBody' : 'block', .06);
        o.x = clamp(o.x - o.dir * m.push * .4, -LIM, LIM);
      }
      f.lastRes = 'block'; emit(Object.assign(base, {res: 'block', dmg: dm}));
      if (m.special) say('<b>' + o.name + '</b> บัง' + m.th + 'ไว้ได้');
      return;
    }
    const stat = (m.kind === 'punch' ? f.stats.pow : f.stats.kick) / 100;
    let raw = m.dmg * (.6 + .8 * stat) * rnd(.85, 1.15) * (f.st < 25 ? .8 : 1);
    const counter = o.state === 'move', crit = R() < K.critChance, wasStun = o.state === 'stun';
    if (counter) raw *= K.counterMul + (planOf(f).ag === 'counter' ? PR.counterBonus : 0);
    if (planOf(f).ag === 'attack') raw *= PR.attackDmg;
    raw *= o.style.tough || 1;
    if (planOf(o).range === 'in' && m.kind === 'kick' && PR.outMoves.includes(key)) raw *= PR.jam;
    if (planOf(o).range === 'out' && PR.inMoves.includes(key)) raw *= PR.keepAway;
    if (planOf(f).range === 'out' && planOf(o).range === 'in' && PR.outMoves.includes(key)) raw *= PR.outVsIn;
    if (crit) raw *= K.critMul;
    if (f.combo && f.ci === f.combo.seq.length - 1 && f.chain >= 1) raw *= 1.15; // combo finisher
    const dm = raw * K.dmgScale;
    o.hp -= dm; f.pts += dm; f.landed++;
    f.sp = Math.min(100, f.sp + dm * K.spGain * (G.round === K.rounds && f.pts < o.pts ? 1.3 : 1));
    o.sp = Math.min(100, o.sp + dm * K.spTake);
    o.st = Math.max(0, o.st - dm * .25);
    if (m.lvl === 'head') o.wearHead += raw; else if (m.lvl === 'body') { o.wearBody += raw; o.st = Math.max(0, o.st - raw * .25); } else o.wearLeg += raw;
    const isTeep = key === 'teep' || key === 'teepFace';
    if (!held) o.x = clamp(o.x - o.dir * m.push * (isTeep && planOf(f).ag === 'counter' ? PR.counterPush : 1), -LIM, LIM);
    f.chain = (T - f.chainT < 1.1) ? f.chain + 1 : 1; f.chainT = T;
    const big = raw >= 13 || !!m.special, sev = big ? 3 : raw >= 8 ? 2 : 1;
    o.q = []; o.mv = null; o.combo = null; o.plan = null;
    if (!wasStun && !held) { o.state = 'hit'; o.hold = .2 + raw / 60; }
    setPose(o, held ? (m.lvl === 'head' ? 'clinchHitHead' : 'clinchHit') : m.react, .06, {amp: held ? 1 : sev === 1 ? .55 : sev === 2 ? .8 : 1});
    f.lastRes = 'hit';
    emit(Object.assign(base, {res: 'hit', raw, dmg: dm, sev, counter, crit, chain: f.chain}));
    const where = m.lvl === 'head' ? 'เข้าหน้า' : m.lvl === 'body' ? 'เข้าลำตัว' : 'เข้าขา';
    if (big || counter) say('<b>' + f.name + '</b> ' + m.th + where + (counter ? ' สวนเต็มๆ' : '') + (crit ? ' โดนจังๆ' : ''));
    else if (f.chain === 3) say('<b>' + f.name + '</b> เข้าเป็นชุด');

    const lead = F[0].pts === F[1].pts ? G.lead : F[0].pts > F[1].pts ? 0 : 1;
    if (lead !== G.lead) { if (G.lead >= 0) G.leadChanges++; G.lead = lead; }

    if (o.hp <= 0) { o.hp = 0; knockout(f, o, 'น็อก', key); return; }
    // a push kick that catches a man coming forward can sit him down: no count, but it scores and everyone sees it
    if (isTeep && !held && !wasStun) {
      const pT = PR.teepDump + (planOf(f).ag === 'counter' ? PR.teepDumpCounter : 0) + (planOf(o).ag === 'attack' ? PR.teepDumpVsAttack : 0) + (counter ? PR.teepDumpCaught : 0) + (o.st < 30 ? PR.teepDumpTired : 0);
      if (R() < pT) {
        f.pts += K.throwPoints; o.st = Math.max(0, o.st - 6);
        o.state = 'thrown'; o.hold = K.throwDown; setPose(o, 'fall1', .22);
        emit({type: 'throw', by: f.i, on: o.i, ok: true, teep: true});
        say('<b>' + f.name + '</b> ถีบ <b>' + o.name + '</b> กระเด็นล้มก้นจ้ำเบ้า');
        return;
      }
    }
    if (m.lvl !== 'head' || m.noKd) return;
    const clean = (crit || counter) && raw >= 11 && m.dmg >= 10; // flush on the button
    const chin = .65 + o.stats.chin / 100 * .7, tough = o.tough > 0 ? .5 : 1;
    let pK = 0;
    if (raw >= K.kdRaw) pK += K.kdChance;
    if (wasStun && raw >= K.kdStunRaw) pK += K.kdStunChance;
    if (o.hp < K.kdLowHp && raw >= 12) pK += K.kdLowChance;
    if (clean) pK += K.kdClean;
    if (m.special) pK *= K.kdSpecialMul;
    pK *= (1 + o.wearHead / K.kdWearDiv) / chin * tough;
    if (pK > 0 && R() < pK) { knockdown(f, o, key, raw, clean); return; }
    if (!wasStun) {
      const score = o.stunCd > 0 ? 0 : raw * (m.stun || 0) * (1 + o.wearHead / K.stunWearDiv) / chin;
      if (score > K.stunMin && R() < (score - K.stunMin) / K.stunSpan) {
        o.state = 'stun'; o.stunT = K.stunDurMin + R() * K.stunDurSpan; o.stunFlip = 0; o.stunCd = o.stunT + K.stunRest;
        emit({type: 'stun', on: o.i, by: f.i, dur: o.stunT});
        say('<b>' + o.name + '</b> เมาหมัด! <b>' + f.name + '</b> ตามถล่ม');
        f.cool = Math.min(f.cool, .05);
      }
    }
  }

  function knockdown(f, o, key, raw, clean) {
    dropClinch();
    o.kd++; o.kdR++; f.pts += K.kdPoints; o.state = 'down'; o.q = []; o.combo = null;
    setPose(o, 'fall1', .18);
    if (o.kd >= 3) { knockout(f, o, 'ทีเคโอ', key); return; }
    const ratio = o.hp / 100;
    let up = ratio > .35 ? 4 : ratio > .18 ? 6 : 8;
    const pOut = clamp(K.outBase + (raw - 20) / K.outRawDiv - o.hp / K.outHpDiv + o.wearHead / 900 + (clean ? K.outClean : 0), .02, .8) * (1.25 - o.stats.chin / 200);
    if (R() < pOut) up = 99; // will not beat the count
    G.count = {who: o, by: f, n: 0, t: -.6, up, move: key};
    emit({type: 'kd', on: o.i, by: f.i, move: key, up: up === 99 ? 10 : up, out: up === 99, clean: !!clean});
    say('<b>' + o.name + '</b> ล้มลงไป กรรมการเริ่มนับ');
    f.plan = null; f.combo = null;
  }

  // ---- clinch ----
  function dropClinch() { if (G.clinch) { G.clinch.a.grab = null; G.clinch = null; } }
  function startClinch(f, o) {
    const spec = f.style.id === 'clinch';
    G.clinch = {a: f, b: o, t: K.clinchMax + (spec ? .7 : 0), knees: K.clinchKneesMin + Math.floor(R() * K.clinchKneesSpan) + (spec ? K.clinchStyleKnees : 0), next: .4};
    if (o.state === 'stun') emit({type: 'stun_end', on: o.i});
    f.state = 'clinch'; o.state = 'clinched'; f.plan = o.plan = null; f.combo = o.combo = null; o.q = []; o.mv = null;
    f.st = Math.max(0, f.st - MOVES.clinch.st); f.grab = 'neck';
    setPose(f, 'clinchHold', .2); setPose(o, 'clinchHeld', .22);
    emit({type: 'clinch', by: f.i, on: o.i}); say('<b>' + f.name + '</b> เข้ากอดคอ');
  }
  function endClinch(reason) {
    const c = G.clinch; if (!c) return;
    dropClinch();
    for (const x of [c.a, c.b]) {
      if (x.state === 'ko' || x.state === 'down') continue;
      x.state = 'idle'; x.q = []; x.mv = null; x.cool = rnd(.5, .9); setPose(x, 'guard', .28);
      x.x = clamp(x.x - x.dir * 30, -LIM, LIM);
    }
    emit({type: 'break', reason, by: c.a.i, on: c.b.i});
    say(reason === 'escape' ? '<b>' + c.b.name + '</b> สะบัดหลุดจากวงกอด' : 'กรรมการเข้าแยก');
  }

  function knockout(f, o, how, key) {
    dropClinch();
    o.state = 'ko'; o.q = []; o.combo = null;
    if (o.to !== 'down' && o.to !== 'fall1') setPose(o, 'fall1', .2);
    G.phase = 'ko'; G.koT = 0; G.count = null;
    G.over = {w: f.i, l: o.i, how, round: G.round, time: K.roundTime - G.clock, move: key};
    emit({type: 'ko', on: o.i, by: f.i, how, move: key});
    emit({type: 'bell', n: 3});
    say('<b>' + o.name + '</b> ลุกไม่ขึ้น <b>' + f.name + '</b> ชนะ' + how + 'ด้วย' + MOVES[key].th);
  }

  function sep(f, o) {
    const d = Math.abs(o.x - f.x);
    if (d < 44) { const p = (44 - d) / 2; f.x = clamp(f.x - f.dir * p, -LIM, LIM); o.x = clamp(o.x - o.dir * p, -LIM, LIM); }
  }

  function stepFighter(f, o, dt) {
    if (f.inv > 0) f.inv -= dt;
    if (f.tough > 0) f.tough -= dt;
    if (f.stunCd > 0) f.stunCd -= dt;
    f.pt += dt;
    const done = f.pt >= f.pd, d = Math.abs(o.x - f.x);
    if (f.state === 'move') {
      if (f.lunge !== 0 && f.qi <= 1) {
        const s = Math.sign(f.lunge) * Math.min(Math.abs(f.lunge), 230 * dt);
        f.x = clamp(f.x + f.dir * s, -LIM, LIM); f.lunge -= s; sep(f, o);
      }
      if (done) {
        if (f.qi === 1) {
          resolve(f, o);
          if (f.state !== 'move') return;
          if (G.phase !== 'fight') f.combo = null; // the blow ended the fight: just recover
          if (f.combo) {
            const nextKey = f.combo.seq[f.ci + 1];
            const ok = nextKey && (f.lastRes === 'hit' || f.lastRes === 'block') && o.state !== 'down' && o.state !== 'ko' && !G.count;
            if (ok) {
              const nm = MOVES[nextKey], d2 = Math.abs(o.x - f.x);
              if (f.st > nm.st && d2 <= nm.reach + 34) {
                f.ci++; startMove(f, o, nextKey);
                f.lunge = d2 > nm.reach - 8 ? d2 - (nm.reach - 8) : d2 < nm.min ? -(nm.min - d2 + 4) : 0;
                return;
              }
            }
            f.combo = null;
          }
        }
        if (f.qi === 1 && G.clinch && G.clinch.a === f && R() < (K.clinchEscape + o.stats.pow / 100 * .1) * (f.style.id === 'clinch' ? K.clinchStyleEscape : 1)) { endClinch('escape'); return; }
        f.qi++;
        if (f.qi >= f.q.length && G.clinch && G.clinch.a === f) { f.state = 'clinch'; f.mv = null; return; }
        if (f.qi >= f.q.length) {
          f.state = 'idle'; f.mv = null;
          const ag = planOf(f).ag;
          f.cool = (o.state === 'stun' || R() < K.chainChance) ? .05 : rnd(K.coolMin, K.coolMax) / (0.8 + f.stats.spd / 250) * (ag === 'attack' ? PR.attackCool : ag === 'counter' ? PR.counterCool : 1);
        } else setPose(f, f.q[f.qi][0], f.q[f.qi][1] / moveSpeed(f, f.mv), f.qi === 1 ? {strike: f.mvKey} : null);
      }
      return;
    }
    if (f.state === 'clinch') {
      const c = G.clinch; if (!c) { f.state = 'idle'; return; }
      const gap = clamp(d - K.clinchDist, -150 * dt, 150 * dt) / 2; // pull in to knee range
      f.x = clamp(f.x + f.dir * gap, -LIM, LIM); o.x = clamp(o.x + o.dir * gap, -LIM, LIM);
      c.t -= dt; c.next -= dt;
      if (c.t <= 0 || (c.knees <= 0 && c.next <= -.15) || f.st < 6) {
        if (!c.threw && f.st >= 10 && R() < K.throwTry + (f.style.id === 'clinch' ? .15 : 0)) { c.threw = true; c.t = 1; startMove(f, o, 'clinchThrow'); return; }
        endClinch('ref'); return;
      }
      if (c.knees > 0 && c.next <= 0) {
        c.knees--; c.next = .5 + R() * .25;
        const head = R() < K.clinchHeadKnee + (f.style.id === 'clinch' ? .12 : 0);
        startMove(f, o, head ? 'clinchKneeHead' : 'clinchKnee');
        if (head) setPose(o, 'clinchPulled', .18); // the head is dragged down onto the knee
      }
      return;
    }
    if (f.state === 'clinched') { if (done && (f.to === 'clinchHit' || f.to === 'clinchHitHead' || f.to === 'clinchPulled') && !(o.state === 'move' && o.qi <= 1)) setPose(f, 'clinchHeld', .22); return; }
    if (f.state === 'thrown') {
      if (done && f.to === 'fall1') setPose(f, 'down', .22);
      f.hold -= dt;
      if (f.hold <= 0) { f.state = 'getup'; setPose(f, 'getup', .3); emit({type: 'getup', on: f.i, thrown: true}); }
      return;
    }
    if (f.state === 'caught') { f.hold -= dt; if (f.hold <= 0) { f.state = 'idle'; setPose(f, 'guard', .22); f.cool = .4; } return; }
    if (f.state === 'hit' || f.state === 'block' || f.state === 'cover') {
      f.hold -= dt;
      if (f.hold <= 0) { const riposte = f.state !== 'hit' && planOf(f).ag === 'counter'; f.state = 'idle'; setPose(f, 'guard', .16); f.cool = riposte ? .06 : Math.max(f.cool, rnd(.1, .35)); }
      return;
    }
    if (f.state === 'stun') {
      f.stunT -= dt; f.stunFlip -= dt;
      f.x = clamp(f.x - f.dir * 26 * dt, -LIM, LIM);
      if (f.stunT <= 0) {
        f.state = 'idle'; setPose(f, 'guard', .3); f.cool = rnd(.3, .6);
        emit({type: 'stun_end', on: f.i}); say('<b>' + f.name + '</b> ตั้งหลักได้');
      } else if (f.stunFlip <= 0 && done) { f.stunFlip = .42; setPose(f, f.to === 'stunA' ? 'stunB' : 'stunA', .38); }
      return;
    }
    if (f.state === 'down' || f.state === 'ko') { if (done && f.to === 'fall1') setPose(f, 'down', .26); return; }
    if (f.state === 'getup') {
      if (done) { if (f.to === 'getup') setPose(f, 'guard', .32); else { f.state = 'idle'; f.inv = .5; f.tough = 6; f.cool = .6; } }
      return;
    }
    if (f.state === 'win' || f.state === 'intro' || f.state === 'rest') return;

    // idle: recover, move, decide
    f.st = Math.min(100, f.st + dt * (K.stRegen + f.stats.end / 100 * K.stRegenEnd) * (1 - Math.min(.5, f.wearBody / 220)) * (planOf(f).range === 'out' ? PR.outRegen : 1));
    if (done && f.to !== 'guard') setPose(f, 'guard', .14);
    if (G.phase !== 'fight') return;
    if (G.count) { const want = f.i ? LIM - 60 : -LIM + 60; f.x += clamp(want - f.x, -80 * dt, 80 * dt); return; }
    // read the incoming attack and raise the guard
    if (o.state === 'move' && o.qi === 0 && o.moveId !== f.seen) {
      f.seen = o.moveId;
      const om = o.mv;
      const ag = planOf(f).ag;
      if (d <= om.reach + 30 && R() < (K.coverBase + f.stats.def / 100 * K.coverDef + (f.hp < 35 ? .15 : 0)) * (ag === 'attack' ? PR.attackCover : ag === 'counter' ? PR.counterCover : 1) * (planOf(f).range === 'in' ? PR.inCover : 1)) {
        const lv = ['head', 'body', 'leg'];
        f.coverLvl = R() < K.coverRead ? om.lvl : lv[(lv.indexOf(om.lvl) + 1 + Math.floor(R() * 2)) % 3];
        f.state = 'cover'; f.plan = null; f.combo = null; f.guards++;
        f.hold = (om.fr[0][1] + om.fr[1][1]) / moveSpeed(o, om) + .22;
        setPose(f, f.coverLvl === 'leg' ? 'check' : f.coverLvl === 'body' ? 'blockBody' : 'block', .12);
        emit({type: 'guard', by: f.i, lvl: f.coverLvl});
        return;
      }
    }
    f.cool -= dt;
    if (!f.plan && f.cool <= 0) { f.combo = null; f.plan = choose(f, o); f.planT = 1.4; }
    const rg = planOf(f).range;
    let want = 114 + (rg === 'out' ? PR.outDist : rg === 'in' ? PR.inDist : 0) + Math.sin(G.t * 1.6 + f.i * 2.1) * 9;
    if (f.plan) {
      const m = MOVES[f.plan]; want = Math.max(m.min + 8, m.reach - 12); f.planT -= dt;
      if (d <= m.reach - 4 && d >= m.min) {
        if (!m.grab) { startMove(f, o, f.plan); return; }
        if (!G.clinch && ['idle', 'block', 'cover', 'hit', 'stun'].includes(o.state)) { startClinch(f, o); return; }
        f.plan = null; f.cool = .12;
      }
      if (f.planT <= 0) { f.plan = null; f.combo = null; f.cool = .15; }
    }
    const walk = (54 + f.stats.spd * .5) * (f.st < 25 ? .7 : 1) * (1 - Math.min(.45, f.wearLeg / 200)) * (f.style.walk || 1);
    // the man told to wait holds his ground and lets the other come; the man told to go forward walks him down
    const ag2 = planOf(f).ag, fwd = walk * (ag2 === 'counter' ? (f.plan ? PR.counterStepIn : PR.counterAdvance) : ag2 === 'attack' ? PR.attackAdvance : 1);
    f.x = clamp(f.x + f.dir * clamp(d - want, -walk * dt, fwd * dt), -LIM, LIM); sep(f, o);
  }

  function scoreRound() {
    const eff = [0, 1].map(i => F[i].pts - F[i].pts0 - K.kdPoints * F[1 - i].kdR), s = roundCard(eff[0], eff[1], F[0].kdR, F[1].kdR, K);
    F[0].card += s[0]; F[1].card += s[1]; G.cards.push(s);
    return s;
  }
  function endRound() {
    dropClinch();
    emit({type: 'bell', n: 2});
    const card = scoreRound();
    emit({type: 'score', round: G.round, card, total: [F[0].card, F[1].card], pts: [F[0].pts, F[1].pts]});
    F.forEach(f => {
      f.q = []; f.mv = null; f.plan = null; f.combo = null;
      if (f.state === 'stun') emit({type: 'stun_end', on: f.i, bell: true});
      f.grab = null;
      if (f.state !== 'down' && f.state !== 'getup') { f.state = 'rest'; setPose(f, 'guard', .25); }
    });
    if (G.round >= K.rounds) {
      const w = F[0].card !== F[1].card ? (F[0].card > F[1].card ? 0 : 1) : F[0].pts >= F[1].pts ? 0 : 1; // level on the card: the one who did more damage gets the nod
      G.over = {w, l: 1 - w, how: 'คะแนน', round: G.round, time: K.roundTime, move: null};
      G.phase = 'dec'; G.koT = 0;
      emit({type: 'phase', phase: 'dec', round: G.round});
      say('ครบ ' + K.rounds + ' ยก รอฟังคำตัดสิน');
    } else {
      G.phase = 'rest'; G.restT = K.restTime;
      emit({type: 'phase', phase: 'rest', round: G.round});
      say('หมดยกที่ ' + G.round + ' พักยก');
    }
  }

  function update(dt) {
    G.t += dt;
    const a = F[0], b = F[1];
    if (G.phase === 'intro') {
      if (G.t > K.introTime - 1 && a.to === 'wai') { setPose(a, 'guard', .4); setPose(b, 'guard', .4); }
      if (G.t > K.introTime) {
        G.phase = 'fight'; F.forEach(f => { f.state = 'idle'; f.cool = rnd(.7, 1.4); });
        emit({type: 'phase', phase: 'fight', round: 1}); F.forEach(x => { x.pts0 = x.pts; x.kdR = 0; emit({type: 'plan', by: x.i, round: 1, ag: planOf(x).ag}); }); emit({type: 'bell', n: 1}); say('ระฆังยกแรกดังขึ้น');
      }
    } else if (G.phase === 'fight') {
      if (G.count) {
        const c = G.count; c.t += dt;
        if (c.t >= K.countStep) {
          c.t = 0; c.n++; emit({type: 'count', n: c.n, on: c.who.i});
          const o = c.who;
          if (c.up === 99) {
            if (c.n === 6) setPose(o, 'getup', .5);
            if (c.n === 8) setPose(o, 'down', .45);
            if (c.n >= 10) { knockout(c.by, o, 'น็อก', c.move); }
          } else if (c.n >= c.up) {
            o.state = 'getup'; setPose(o, 'getup', .36); o.hp = Math.max(o.hp, 8); G.count = null;
            emit({type: 'getup', on: o.i}); say('<b>' + o.name + '</b> ลุกขึ้นมาสู้ต่อ');
          }
        }
      } else {
        G.clock -= dt;
        if (G.clock <= 0) { G.clock = 0; endRound(); }
      }
    } else if (G.phase === 'rest') {
      G.restT -= dt;
      F.forEach(f => {
        const want = f.i ? LIM - 40 : -LIM + 40;
        f.x += clamp(want - f.x, -110 * dt, 110 * dt);
        f.st = Math.min(100, f.st + dt * K.restSt); f.hp = Math.min(100, f.hp + dt * K.restHp);
      });
      if (G.restT <= 0) {
        G.round++; G.clock = K.roundTime; G.phase = 'fight';
        F.forEach(f => { f.state = 'idle'; f.cool = rnd(.6, 1.2); f.plan = null; });
        emit({type: 'phase', phase: 'fight', round: G.round}); F.forEach(x => { x.pts0 = x.pts; x.kdR = 0; emit({type: 'plan', by: x.i, round: G.round, ag: planOf(x).ag}); }); emit({type: 'bell', n: 1}); say('เริ่มยกที่ ' + G.round);
      }
    } else if (G.phase === 'ko') {
      G.koT += dt;
      const w = F[G.over.w];
      if (G.koT > 1.7 && w.state !== 'win') { w.state = 'win'; w.q = []; setPose(w, 'win', .45); }
      if (G.koT > 2.8) { G.phase = 'over'; emit({type: 'phase', phase: 'over'}); }
    } else if (G.phase === 'dec') {
      G.koT += dt;
      const w = F[G.over.w];
      if (G.koT > 1.6 && w.state !== 'win') {
        w.state = 'win'; setPose(w, 'win', .45);
        emit({type: 'decision', w: w.i}); say('<b>' + w.name + '</b> ชนะคะแนน');
      }
      if (G.koT > 2.8) { G.phase = 'over'; emit({type: 'phase', phase: 'over'}); }
    }
    stepFighter(a, b, dt); stepFighter(b, a, dt);
  }

  // ---- run ----
  emit({type: 'phase', phase: 'intro', round: 1});
  F.forEach(f => setPose(f, 'wai', .6));
  say('ไหว้ครูก่อนชก <b>' + specs[0].name + '</b> พบ <b>' + specs[1].name + '</b>');
  const roundAt = [];
  let guard = 0, tail = -1;
  while (guard++ < 60 * 600) {
    update(DT);
    for (const f of F) ticks.push(f.x, f.hp, f.st, f.sp, STATE[f.state], f.wearHead, f.wearBody, f.wearLeg, f.pts);
    roundAt.push(G.round, G.clock);
    T += DT;
    if (G.phase === 'over') { if (tail < 0) tail = 150; else if (--tail === 0) break; }
  }
  const o = G.over || {w: 0, l: 1, how: 'คะแนน', round: K.rounds, time: K.roundTime, move: null};
  return {
    version: SIM_VERSION, seed, specs, dt: DT, nTicks: roundAt.length / 2, duration: T,
    ticks: Float32Array.from(ticks), clock: Float32Array.from(roundAt), poses, events,
    result: {w: o.w, l: o.l, how: o.how, round: o.round, time: o.time, move: o.move,
      pts: [F[0].pts, F[1].pts], cards: [F[0].card, F[1].card], rounds: G.cards, kd: [F[0].kd, F[1].kd], landed: [F[0].landed, F[1].landed], thrown: [F[0].thrown, F[1].thrown],
      used: [F[0].used, F[1].used], guards: [F[0].guards, F[1].guards], leadChanges: G.leadChanges}
  };
}
