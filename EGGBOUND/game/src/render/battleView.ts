// @ts-nocheck
// Battle scene: plays battle-core TurnStart/ActionResult events as animation + VFX, and collects player commands.
import { Battle, REACTION_NAME } from '../core/battle';
import { SPECIES } from '../core/data';
import { PAL, PIV, ANCH, anchOf, TAU, spr, silOf, glowOf, GP, dot, portrait, IMG, fx, lookOf, poseKey, warpDraw } from './assets';
import { sfx } from './audio';
import {
  E, SQ, clamp, lerp, rnd, easeOut, easeIn, easeIO, easeBack, run, tween, waitAll, waitUntil, addP, burst, ring, text, dmgText, fxP, shake, flash,
  drawParts, drawDecals, drawProjs, drawGround, drawLantern, drawBush, drawLanternPools, drawFlies, LANTERNS, BUSHES, worldTransform, screenTransform, drawOverlays,
} from './engine';

const STATUS_TH = { burn: 'เผาไหม้', poison: 'พิษ', stun: 'มึน', sleep: 'หลับ', blind: 'ตาบอด', def_down: 'DEF ↓', atk_down: 'ATK ↓', spd_down: 'SPD ↓', atk_up: 'ATK ↑', def_up: 'DEF ↑', spd_up: 'SPD ↑', crit_up: 'คริ ↑', shield: 'โล่', regen: 'ฟื้นฟู' };
const STATUS_COL = { burn: '#ffae6a', poison: '#b8f06a', stun: '#ffe066', sleep: '#c9b8ff', blind: '#a8a8c8', def_down: '#ff8a7a', atk_down: '#ff8a7a', spd_down: '#9fd8ff', atk_up: '#ff7a5a', def_up: '#9fd0ff', spd_up: '#9fffcf', crit_up: '#ffd27a', shield: '#bfe6ff', regen: '#7dffb0' };
const ALLY_C = [-245, 165], ENEMY_C = [245, -115], PERP = [.6, .8];
const OFFS = { 1: [0], 2: [-60, 60], 3: [-110, 0, 110], 4: [-150, -50, 50, 150] };

export class BattleView {
  b: Battle; V = new Map(); phase = 'intro'; active = null; speed = 1; auto = false; skipUlt = false;
  pending = null; sel = 0; aim = null; focus = []; camF = null; camK = .45; cine = null; env = { x: 0, y: 0 }; wipe = 0; onEnd = null; onHud = null; ended = false; stage;
  constructor(b, stage, opts) { this.b = b; this.stage = stage; Object.assign(this, opts); }

  // ---------- views ----------
  makeView(u, pos, drop) {
    const s = SPECIES[u.sid];
    const v = { uid: u.uid, sid: lookOf(u.sid, u.stars), team: u.team, elem: u.elem, boss: u.boss, name: u.name, stars: u.stars, lvl: u.lvl,
      x: pos[0], y: pos[1], hx: pos[0], hy: pos[1], hop: drop ? -620 : 0, sx: 1, sy: 1, rot: 0, k: .4 * (s.scale || 1),
      back: u.team === 0, flip: u.team === 1, hb: u.team === 0, hf: u.team === 1, pose: 'idle', alpha: drop ? 0 : 1, flash: 0, ghosts: [], glowF: 0,
      dead: false, deathT: 0, hitT: 0, kvx: 0, kvy: 0, hp: u.hp, maxHp: u.maxHp, shown: u.hp, st: new Set(), marks: new Set(), busy: !!drop, ph: Math.random() * 9, emberT: 0, atb: 0, shieldAmt: 0,
      bend: 0, bendV: 0, bendT: 0, wave: 0, wph: 0, br: 0 }; // living-sprite springs (lean / recoil / ripple / breathing)
    this.V.set(u.uid, v); return v;
  }
  layout(team) {
    const units = this.b.units.filter(u => u.team === team);
    const port = E.W < E.H, PP = port ? [1, .12] : PERP;
    const C = port ? (team === 0 ? [0, 235] : [0, -120]) : team === 0 ? ALLY_C : ENEMY_C, n = units.length, bossIdx = units.findIndex(u => u.boss);
    let offs = OFFS[Math.min(4, n)] || OFFS[4];
    if (bossIdx >= 0 && n === 3) offs = [-160, 0, 160];
    if (port) return units.map((u, i) => [u, [C[0] + offs[i] * 1.18, C[1] + (n > 2 ? (i % 2 ? 26 : -26) * (team ? -1 : 1) : 0) + offs[i] * .05]]);
    return units.map((u, i) => [u, [C[0] + PP[0] * offs[i], C[1] + PP[1] * offs[i]]]);
  }
  P(v) { return PAL[v.elem]; }
  key(v) { return poseKey(v.sid, v.back ? 'back' : 'front', v.pose); }
  l2w(v, lx, ly) { const sx = v.sx * v.k * (v.flip ? -1 : 1), sy = v.sy * v.k, c = Math.cos(v.rot), s = Math.sin(v.rot); const x = lx * sx, y = ly * sy; return [v.x + x * c - y * s, v.y + v.hop + x * s + y * c]; }
  anc(v, n) { const a = anchOf(v.sid, this.key(v))[n]; return this.l2w(v, a[0], a[1]); }
  headY(v) { return v.y + v.hop - 385 * v.k; }
  face(v, t) { const dx = t.x - v.x, dy = t.y - v.y; if (Math.abs(dx) > 2) v.flip = dx < 0; if (Math.abs(dy) > Math.abs(dx) * .25) v.back = dy < 0; }
  ghost(v, life = .25) { v.ghosts.push({ key: this.key(v), x: v.x, y: v.y, hop: v.hop, sx: v.sx, sy: v.sy, rot: v.rot, flip: v.flip, k: v.k, life, max: life }); }
  sync() { for (const u of this.b.units) { const v = this.V.get(u.uid); if (!v) continue; v.atb = u.atb; if (!v.dead) { v.hp = u.hp; v.maxHp = u.maxHp; v.st = new Set(u.statuses.map(s => s.id)); v.marks = new Set(u.marks.map(m => m.elem)); const sh = u.statuses.find(s => s.id === 'shield'); v.shieldAmt = sh ? sh.value : 0; } } }

  // ---------- main loop ----------
  start() {
    for (const [u, p] of this.layout(0)) this.makeView(u, p, false);
    run(this.loop());
  }
  *loop() {
    yield* this.waveIntro(true);
    if (this.b.startEvents.length) { yield .2; yield* this.playEvents(this.b.startEvents); yield .3; }
    while (!this.b.over) {
      this.phase = 'turn';
      const ts = this.b.nextTurn(); if (!ts) break;
      this.active = ts.uid; this.sync(); this.hud();
      yield* this.playEvents(ts.events);
      if (ts.skip) { this.sync(); yield .25; continue; }
      const u = this.b.get(ts.uid);
      let cmd;
      if (u.team === 0 && !this.auto) cmd = yield* this.waitCommand(u);
      else { cmd = this.b.autoCommand(u.uid); yield .18; }
      const res = this.b.act(u.uid, cmd);
      this.phase = 'acting'; this.hud();
      yield* this.playAction(res);
      this.sync();
      yield* this.playEvents(res.after);
      this.sync(); this.hud();
      yield .12;
    }
    yield* this.finish();
  }
  *waitCommand(u) {
    this.phase = 'choose'; this.sel = this.b.canUse(u, this.sel) && this.lastUid === u.uid ? this.sel : 0; this.lastUid = u.uid; this.pending = null; this.hud();
    while (!this.pending) { if (this.auto) { this.pending = this.b.autoCommand(u.uid); break; } yield 0; }
    const cmd = this.pending; this.pending = null;
    if (u.skills[cmd.si].ult && !this.auto) { cmd.perfect = yield* this.perfectRing(u); }
    return cmd;
  }
  *perfectRing(u) {
    const v = this.V.get(u.uid); this.phase = 'aim'; this.hud();
    this.aim = { t: 0, dur: 1.05, hit: null, v };
    while (this.aim.hit === null && this.aim.t < this.aim.dur) { this.aim.t += (yield 0) / this.speed; }
    const ok = this.aim.hit === true;
    if (ok) { sfx.perfect(); addP({ type: 'banner', x: v.x, y: this.headY(v) - 30, str: 'PERFECT!', color: '#ffe066', size: 30, life: 1, keep: true }); flash(.25, '#fff2c0'); }
    this.aim = null; return ok;
  }
  tapAim() { if (this.aim && this.aim.hit === null) { const r = this.ringR(); this.aim.hit = Math.abs(r - 34) < 12; if (!this.aim.hit) text(this.aim.v.x, this.headY(this.aim.v) - 20, 'พลาดจังหวะ', '#cdbfa6', 15); } }
  ringR() { const a = this.aim; return lerp(130, 10, a.t / a.dur); }

  // ---------- commands from UI ----------
  selectSkill(i) { const u = this.active && this.b.get(this.active); if (this.phase !== 'choose' || !u || !this.b.canUse(u, i)) return; sfx.click();
    const sk = u.skills[i];
    if (this.sel === i && sk.target !== 'enemy') { this.pending = { si: i, target: sk.target === 'enemyAll' ? this.b.foes(u)[0].uid : u.uid }; return; }
    this.sel = i; this.hud(); }
  tapUnit(uid) {
    if (this.aim) { this.tapAim(); return; }
    const u = this.active && this.b.get(this.active); if (this.phase !== 'choose' || !u) return;
    const valid = this.b.validTargets(u, this.sel); if (!valid.includes(uid)) return;
    this.pending = { si: this.sel, target: uid };
  }
  unitAt(wx, wy) { let best = null, bd = 1e9; for (const v of this.V.values()) { if (v.dead) continue; if (Math.abs(wx - v.x) < 190 * v.k && wy < v.y + 30 && wy > v.y - 400 * v.k) { const d = Math.abs(wx - v.x) + Math.abs(wy - (v.y - 150 * v.k)); if (d < bd) { bd = d; best = v; } } } return best; }

  // ---------- event playback ----------
  *playEvents(evs) {
    for (const e of evs) {
      if (e.t === 'wave') { yield .5; yield* this.waveIntro(false); }
      else if (e.t === 'end') { /* handled in finish */ }
      else if (e.t === 'dot') { const v = this.V.get(e.tgt); const P = e.id === 'burn' ? PAL.fire : { aura: '#9be05a' }; for (let i = 0; i < 8; i++) addP({ type: e.id === 'burn' ? 'flame' : 'glow', x: v.x + rnd(-30, 30) * v.k / .4, y: v.y, z: rnd(10, 60) * v.k / .4, vz: rnd(60, 120), life: .6, size: rnd(12, 20), size2: 0, color: P.aura, drag: 1 }); v.hp = e.hp; v.flash = .6; text(v.x, this.headY(v) + 20, '' + e.dmg, e.id === 'burn' ? '#ffae6a' : '#b8f06a', 19); sfx.fire(); yield .4; }
      else if (e.t === 'skip') { const v = this.V.get(e.uid); text(v.x, this.headY(v), (STATUS_TH[e.reason] || '') + ' — ข้ามเทิร์น', '#ffe066', 15); yield .55; }
      else this.applyEv(e);
    }
  }
  applyEv(e) {
    const v = e.tgt != null ? this.V.get(e.tgt) : null;
    switch (e.t) {
      case 'hit': {
        if (!v) return; const src = this.V.get(e.src);
        if (e.miss) { text(v.x, this.headY(v) + 10, 'พลาด', '#c8c8d8', 18); return; }
        v.hp = e.hp; v.flash = 1; v.hitT = .3; if (src) { const dx = v.x - src.x, dy = v.y - src.y, l = Math.hypot(dx, dy) || 1; const k = v.boss ? .35 : 1; v.kvx += dx / l * 170 * k; v.kvy += dy / l * 110 * k; }
        v.bendV -= (e.crit ? 950 : 620) * (v.boss ? .45 : 1); v.wave = e.crit ? 22 : 13; v.wph = 0; // recoil + jelly ripple
        this.hitSpark(v, src, e.crit);
        const hy = this.headY(v) + 18;
        dmgText(v.x + rnd(-12, 12), hy, e.dmg, e.crit, { weak: e.em < 1 });
        if (e.em > 1) text(v.x + 34, hy - 12, 'ได้เปรียบธาตุ', '#9ff58a', 13, { vz: 50 }); else if (e.em < 1) text(v.x + 34, hy - 12, 'ต้านทาน', '#b9c3d6', 13, { vz: 50 });
        if (e.shieldAbs) { ring(v.x, v.y - 60 * v.k / .4, 20, 70, '#bfe6ff', .35, 4); }
        break;
      }
      case 'heal': if (!v) return; v.hp = e.hp; text(v.x, this.headY(v) + 18, '+' + e.amt, '#7dffb0', 21); for (let i = 0; i < 8; i++) addP({ x: v.x + rnd(-40, 40) * v.k / .4, y: v.y, z: rnd(0, 30), vz: rnd(60, 120), life: .8, size: rnd(8, 14), size2: 0, color: '#7dffb0' }); break;
      case 'status': if (!v) return; if (e.add) { v.st.add(e.id); text(v.x - 26, this.headY(v) - 4, STATUS_TH[e.id], STATUS_COL[e.id], 14, { vz: 40 }); if (e.id === 'atk_up' || e.id === 'crit_up') for (let i = 0; i < 5; i++) addP({ type: 'arrow', x: v.x + rnd(-40, 40), y: v.y, z: rnd(10, 60), vz: rnd(80, 140), life: .9, size: 9, color: '#ff6a4a', add: false }); if (e.id === 'sleep') text(v.x + 30, this.headY(v) - 20, 'Zz', '#c9b8ff', 22, { vz: 30, life: 1.4 }); } else v.st.delete(e.id); break;
      case 'resist': if (!v) return; text(v.x + 26, this.headY(v) - 4, 'ต้านทาน', '#b9c3d6', 13, { vz: 40 }); break;
      case 'mark': if (!v) return; if (e.add) { v.marks.add(e.elem); const P = PAL[e.elem]; ring(v.x, v.y, 10, 70 * v.k / .4, P.aura, .45, 4); addP({ x: v.x, y: v.y, z: 390 * v.k + 30, life: .5, size: 26, size2: 0, color: P.aura }); } else v.marks.delete(e.elem); break;
      case 'shield': if (!v) return; v.shieldAmt = e.amt; ring(v.x, v.y, 20, 90 * v.k / .4, '#bfe6ff', .5, 5); for (let i = 0; i < 10; i++) addP({ type: 'chip', add: false, x: v.x + rnd(-50, 50), y: v.y, z: rnd(0, 60), vz: rnd(40, 100), life: .7, size: rnd(5, 9), color: '#a8c88a', grav: 300, rot: rnd(0, 6), vr: rnd(-6, 6) }); break;
      case 'atb': if (!v) return; v.atb = e.atb; text(v.x + 28, this.headY(v) + 6, e.delta > 0 ? `เกจ +${e.delta}` : `เกจ ${e.delta}`, e.delta > 0 ? '#9fffcf' : '#9fd8ff', 14, { vz: 40 }); break;
      case 'cleanse': if (!v) return; text(v.x, this.headY(v) - 18, 'ล้างสถานะ', '#bff8ff', 14, { vz: 40 }); for (let i = 0; i < 6; i++) addP({ type: 'twinkle', x: v.x + rnd(-50, 50), y: v.y, z: rnd(20, 120), life: .7, size: rnd(6, 10), color: '#ffffff' }); break;
      case 'reaction': this.playReaction(e); break;
      case 'death': { const d = this.V.get(e.uid); if (d && !d.dead) { d.dead = true; d.deathT = 0; d.pose = 'down'; d.bendV -= 500; sfx.die(); burst(d.x, d.y, 60 * d.k / .4, 26, PAL[d.elem].aura, 280, 16, .8); } break; }
    }
  }
  playReaction(e) {
    const v = this.V.get(e.tgt), src = this.V.get(e.src); const name = REACTION_NAME[e.id];
    sfx.react();
    addP({ type: 'banner', x: v.x, y: this.headY(v) - 40, str: name + '!', color: { wildfire: '#ffb04a', storm: '#bfe6ff', steam: '#e8f4ff', lava: '#ff7a3a', eclipse: '#e2c8ff' }[e.id], size: 28, life: 1.2 });
    const hits = e.sub;
    if (e.id === 'wildfire') {
      for (const tv of this.enemyViewsOf(src)) { for (let i = 0; i < 10; i++) addP({ type: 'flame', x: tv.x + rnd(-40, 40), y: tv.y + rnd(-8, 8), z: 5, vz: rnd(90, 200), life: rnd(.5, .9), size: rnd(16, 28), color: '#ff8a2a', drag: 1 }); ring(tv.x, tv.y, 10, 110, '#ff8a2a', .5, 7); }
      shake(8); flash(.2, '#ff9a3a');
    } else if (e.id === 'storm') {
      const ids = [...new Set(hits.filter(h => h.t === 'hit').map(h => h.tgt))].map(id => this.V.get(id)).filter(Boolean);
      let prev = [v.x, this.headY(v) - 160];
      for (const tv of ids) { const to = [tv.x, tv.y - 60 * tv.k / .4]; addP({ type: 'bolt', pts: this.boltPts(prev, to), life: .45, color: '#a8e0ff', keep: true }); burst(tv.x, tv.y, 60, 14, '#bfe6ff', 300, 10, .35); prev = to; }
      sfx.zap(); shake(7); flash(.3, '#dff4ff');
    } else if (e.id === 'steam') {
      for (let i = 0; i < 18; i++) addP({ type: 'smoke', add: false, x: v.x + rnd(-40, 40), y: v.y, z: rnd(0, 60), vz: rnd(40, 110), vx: rnd(-30, 30), life: rnd(.8, 1.3), size: rnd(26, 40), size2: rnd(50, 80), color: '#eef6ff', alpha: .5 });
    } else if (e.id === 'lava') {
      E.decals.push({ type: 'crack', x: v.x, y: v.y, t: 0, life: 1.6, color: '#ff6a2a', pts: this.crackPts(v.x, v.y) });
      for (let i = 0; i < 12; i++) addP({ type: 'flame', x: v.x + rnd(-50, 50), y: v.y + rnd(-10, 10), z: 2, vz: rnd(120, 260), life: rnd(.4, .8), size: rnd(18, 30), color: '#ff5a1a', core: '#ffd27a', drag: 1 });
      shake(9); sfx.quake();
    } else if (e.id === 'eclipse') {
      E.dimT = .55; run((function* () { yield .25; flash(.5, '#ffffff'); ring(v.x, v.y, 10, 200, '#e2c8ff', .6, 10); ring(v.x, v.y, 10, 140, '#ffe58a', .5, 6); yield .2; E.dimT = 0; })());
    }
    for (const h of hits) this.applyEv(h);
  }
  enemyViewsOf(src) { return [...this.V.values()].filter(v => !v.dead && v.team !== src.team); }
  boltPts(a, b) { const pts = [a], n = 7; for (let i = 1; i < n; i++) { const t = i / n; pts.push([lerp(a[0], b[0], t) + rnd(-18, 18), lerp(a[1], b[1], t) + rnd(-14, 14)]); } pts.push(b); return pts; }
  crackPts(x, y) { const pts = [[x - 90, y + rnd(-10, 10)]]; for (let i = 1; i <= 8; i++) pts.push([x - 90 + i * 22, y + rnd(-14, 14)]); return pts; }

  // ---------- skill animations ----------
  *playAction(res) {
    const v = this.V.get(res.uid), sk = res.skill, P = this.P(v);
    const applied = new Set();
    const impact = (uid) => { if (applied.has(uid)) return; applied.add(uid); for (const e of res.impacts[uid] || []) this.applyEv(e); };
    const tv = res.targets.map(id => this.V.get(id)).filter(Boolean);
    this.actName(v, sk);
    if (res.ult && !this.skipUlt) yield* this.ultIntro(v, sk);
    else if (res.ult) { v.glowF = .8; }
    const custom = this['sk_' + sk.id]; // signature skill choreography (per monster) when it exists
    if (custom) yield* custom.call(this, v, tv, impact);
    else switch (sk.anim) {
      case 'melee': yield* this.aMelee(v, tv[0], impact); break;
      case 'shot': yield* this.aShot(v, tv[0], impact); break;
      case 'volley': yield* this.aVolley(v, tv, impact); break;
      case 'heal': yield* this.aSupport(v, tv, impact, 'heal'); break;
      case 'buff': yield* this.aSupport(v, tv, impact, 'buff'); break;
      case 'shield': yield* this.aSupport(v, tv, impact, 'shield'); break;
      case 'ult_dash': yield* this.uDash(v, tv, impact); break;
      case 'ult_rain': yield* this.uRain(v, tv, impact); break;
      case 'ult_vortex': yield* this.uVortex(v, tv[0], impact); break;
      case 'ult_quake': yield* this.uQuake(v, tv, impact); break;
      case 'ult_starlight': yield* this.uStarlight(v, tv, impact); break;
      case 'ult_nightwave': yield* this.uNightwave(v, tv, impact); break;
      case 'ult_roots': yield* this.uRoots(v, tv, impact); break;
      default: for (const t of tv) impact(t.uid);
    }
    for (const id of Object.keys(res.impacts)) impact(+id);
    if (res.ult) this.ultOutro(v);
    v.glowF = 0;
    yield .2;
  }
  actName(v, sk) { this.onAct && this.onAct(v.name + ' · ' + sk.name, v.team); }
  /** ultimate cinematic: the world darkens and the camera rushes in on the caster, it gathers power, snaps into its
   *  burst pose with a flash (speed lines, element rays behind it, skill-name cut-in), then the camera pulls back out */
  *ultIntro(v, sk) {
    const P = this.P(v), flame = (n = 1) => { for (let i = 0; i < n; i++) addP({ type: 'flame', x: v.x + rnd(-60, 60) * v.k / .4, y: v.y + rnd(-8, 8), z: rnd(0, 20), vz: rnd(120, 280), life: rnd(.4, .7), size: rnd(18, 32), color: P.aura, core: P.core, drag: .5 }); };
    this.focus = [v]; v.busy = true; v.glowF = .6; this.camK = 1; this.camF = { x: v.x, y: v.y - 70 * v.k / .4 };
    this.cine = { v, t: 0, col: P.aura, hot: P.hot, pose: 0 };
    v.pose = 'cast'; E.dimT = .86; E.zoomT = 2; sfx.charge();
    yield* tween(.42, p => { v.sx = 1 + .08 * p; v.sy = 1 - .1 * p; if (Math.random() < .8) flame(); });
    v.pose = 'burst'; v.glowF = 1; v.sx = v.sy = 1; this.cine.pose = 1e-6; flash(.55, P.hot); shake(10); sfx.whoosh(); sfx.perfect();
    ring(v.x, v.y, 10, 260, P.aura, .5, 12); ring(v.x, v.y, 10, 180, P.hot, .4, 6); burst(v.x, v.y, 60, 30, P.aura, 520, 18, .7);
    this.onCutin && this.onCutin(v.sid, sk.name, P.cut);
    yield* tween(.8, p => { v.sy = 1 + .025 * Math.sin(p * 24); v.sx = 2 - v.sy; if (Math.random() < .9) flame(2); });
    this.cine = null; this.camK = .45; this.camF = null; E.zoomT = 1.08; E.dimT = .3; v.busy = false;
  }
  ultOutro(v) { E.dimT = 0; E.zoomT = 1; this.focus = []; this.camF = null; this.camK = .45; this.cine = null; v.glowF = 0; }
  /** behind the caster during the cinematic: rotating element rays, a soft orb and the burst flash */
  drawCineBack() {
    const c = this.cine; if (!c) return; const v = c.v, ctx = E.ctx, k = v.k / .4, y = v.y - 70 * k, a = Math.min(1, c.t * 3);
    if (!fx(ctx, 'fx_rays', c.col, v.x, y, 760 * k, 760 * k, a * (c.pose ? .95 : .45), E.time * .6)) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(v.x, y);
      for (let i = 0; i < 16; i++) { const ang = i / 16 * TAU + E.time * .6, len = 380 * k, w = .06; ctx.globalAlpha = a * .35; ctx.fillStyle = c.col; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(ang - w) * len, Math.sin(ang - w) * len); ctx.lineTo(Math.cos(ang + w) * len, Math.sin(ang + w) * len); ctx.closePath(); ctx.fill(); }
      ctx.restore();
    }
    fx(ctx, 'fx_orb', c.col, v.x, y, 420 * k, 420 * k, a * .8);
    if (c.pose) fx(ctx, 'fx_burst', c.hot, v.x, y, (300 + c.pose * 1600) * k, (300 + c.pose * 1600) * k, Math.max(0, 1 - c.pose * 2.2), .3);
  }
  /** screen-space anime speed lines framing the zoomed-in caster */
  drawSpeedLines() {
    const c = this.cine; if (!c) return; const ctx = E.ctx, R = Math.max(E.W, E.H), a = Math.min(1, c.t * 4);
    ctx.save(); screenTransform();
    if (!fx(ctx, 'fx_speedlines', '#ffffff', E.W / 2, E.H / 2, R * 1.5, R * 1.5, a * .85, Math.floor(E.time * 20) * .21)) {
      ctx.globalCompositeOperation = 'lighter'; ctx.translate(E.W / 2, E.H / 2); let sd = Math.floor(E.time * 20) * 7919;
      const r = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 70; i++) { const ang = r() * TAU, r0 = R * (.32 + r() * .2), w = .004 + r() * .01; ctx.globalAlpha = a * (.25 + r() * .45); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(Math.cos(ang) * r0, Math.sin(ang) * r0); ctx.lineTo(Math.cos(ang - w) * R, Math.sin(ang - w) * R); ctx.lineTo(Math.cos(ang + w) * R, Math.sin(ang + w) * R); ctx.closePath(); ctx.fill(); }
    }
    ctx.restore(); worldTransform();
  }
  slashFx(x, y, dir, P, s = 1) { addP({ type: 'slash', x, y, z: 44, life: .28, size: 70 * s, rot: Math.atan2(dir[1], dir[0]) - .9, color: P.aura, w: 16 * s }); addP({ type: 'slash', x, y, z: 44, life: .22, size: 58 * s, rot: Math.atan2(dir[1], dir[0]) - .7, color: P.hot, w: 6 * s }); burst(x, y, 44, 16, P.aura, 420 * s, 16, .4); burst(x, y, 44, 8, P.hot, 300, 10, .3); ring(x, y, 10, 70 * s, P.core, .3, 5); }
  explode(x, y, P, big) { ring(x, y, 10, big ? 160 : 90, P.aura, .45, big ? 10 : 7); ring(x, y, 6, big ? 110 : 60, P.hot, .3, 4); burst(x, y, 30, big ? 44 : 22, P.aura, big ? 520 : 360, big ? 30 : 20, .6); burst(x, y, 30, big ? 20 : 10, P.hot, 300, 14, .4); for (let i = 0; i < (big ? 10 : 5); i++) addP({ type: 'flame', x: x + rnd(-30, 30), y: y + rnd(-12, 12), z: 10, vz: rnd(80, 180), life: rnd(.5, .9), size: rnd(16, 28), color: P.aura, core: P.core, drag: 1 }); }
  charge(v, P, n = 2) { const m = this.anc(v, 'mouth'); for (let i = 0; i < n; i++) { const a = Math.random() * TAU, r = rnd(60, 120); addP({ type: 'streak', x: m[0] + Math.cos(a) * r, y: v.y, z: v.y - m[1] + Math.sin(a) * r * .6, vx: -Math.cos(a) * r * 4, vz: -Math.sin(a) * r * .6 * 4, life: .25, size: 3, color: P.core }); } addP({ x: m[0], y: v.y, z: v.y - m[1], life: .12, size: 30, size2: 0, color: P.aura }); }
  proj(from, fromY, t, P, o = {}) {
    const p = { x: from[0], y: fromY, z: fromY - from[1], P, size: o.size || 22, dark: o.dark }; E.projs.push(p);
    const x0 = p.x, y0 = p.y, z0 = p.z, side = o.side || 0, h = o.h ?? 90;
    return run(function* () { yield* tween(o.dur || .5, q => { const e = q * q * (3 - 2 * q); p.x = lerp(x0, t.x, e) + Math.sin(q * Math.PI) * side; p.y = lerp(y0, t.y, e); p.z = lerp(z0, 40 * t.k / .4, e) + Math.sin(q * Math.PI) * h; addP({ x: p.x + rnd(-4, 4), y: p.y, z: p.z + rnd(-4, 4), life: .35, size: p.size, size2: 0, color: P.aura, vz: rnd(-10, 20) }); if (o.swirl) addP({ x: p.x + Math.cos(E.time * 20) * 14, y: p.y, z: p.z + Math.sin(E.time * 20) * 14, life: .3, size: 8, size2: 0, color: P.core }); }); E.projs.splice(E.projs.indexOf(p), 1); o.onHit && o.onHit(); }());
  }
  /** hit spark on a struck unit (fx_hit_spark art, alternating variants; code sparks otherwise) */
  hitSpark(t, src, crit) {
    const P = src ? this.P(src) : PAL.fire, z = 70 * t.k / .4, k = (crit ? 1.45 : 1) * (t.boss ? 1.3 : 1), name = (this.spk = !this.spk) ? 'fx_hit_spark' : 'fx_hit_spark_b';
    if (IMG[name]) { fxP(name, t.x, t.y, z, P.hot, 70 * k, 300 * k, .2, { rot: rnd(0, TAU) }); fxP(name, t.x, t.y, z, '#ffffff', 40 * k, 170 * k, .14, { rot: rnd(0, TAU) }); }
    else { for (let i = 0; i < (crit ? 12 : 7); i++) { const a = rnd(0, TAU), sp = rnd(500, 900) * k; addP({ type: 'streak', x: t.x, y: t.y, z, vx: Math.cos(a) * sp, vz: Math.sin(a) * sp * .8, life: .14, size: rnd(2, 4), color: i % 3 ? '#ffffff' : P.hot, drag: 6 }); } addP({ x: t.x, y: t.y, z, life: .12, size: 55 * k, size2: 10, color: '#ffffff' }); }
  }
  /** a quick swipe smear along the attack direction */
  smear(x, y, z, dir, P, s = 1) {
    if (IMG.fx_slash_arc) fxP('fx_slash_arc', x, y, z, P.hot, 140 * s, 230 * s, .2, { rot: Math.atan2(dir[1], dir[0]) - .6 });
    else addP({ type: 'slash', x, y, z, life: .2, size: 80 * s, rot: Math.atan2(dir[1], dir[0]) - 1.1, color: P.hot, w: 10 * s });
  }
  /** melee in three beats like a real key-pose animation: run in → WINDUP (coil back) → STRIKE (snap forward, smear,
   *  hit-stop) → FOLLOW-THROUGH (slide past, spring settles) → hop home. o.onImpact replaces the default impact effect. */
  *aMelee(v, t, impact, o = {}) {
    if (!t) return; v.busy = true; const P = this.P(v), ox = v.x, oy = v.y; this.face(v, t);
    const dx = t.x - v.x, dy = t.y - v.y, l = Math.hypot(dx, dy), dir = [dx / l, dy / l], stop = l - (80 + t.k * 220); const tx = v.x + dir[0] * stop, ty = v.y + dir[1] * stop;
    v.bendT = 16; // lean into the run
    yield* tween(clamp(stop / 1000, .2, .34), p => { const e = easeIO(p); v.x = lerp(ox, tx, e); v.y = lerp(oy, ty, e); v.hop = -Math.abs(Math.sin(p * Math.PI * 3)) * 14; v.pose = 'idle'; });
    v.pose = 'windup'; v.bendT = -38; v.bendV -= 300; v.hop = 0;
    yield* tween(.14, p => { const e = easeOut(p); v.x = tx - dir[0] * 16 * e; v.y = ty - dir[1] * 16 * e; v.sx = lerp(1, 1.12, e); v.sy = lerp(1, .86, e); });
    v.pose = 'strike'; v.bendT = 30; v.bendV += 900; sfx.whoosh(); const sx0 = v.x, sy0 = v.y;
    this.smear(t.x - dir[0] * 40, t.y - dir[1] * 40, 70 * v.k / .4, dir, P, t.boss ? 1.3 : 1);
    yield* tween(.075, p => { v.x = sx0 + dir[0] * 64 * p; v.y = sy0 + dir[1] * 64 * p; v.sx = 1.24; v.sy = .82; v.hop = -Math.sin(p * Math.PI) * 18; this.ghost(v, .22); });
    E.hitstop = .1;
    if (v.elem === 'earth') { E.decals.push({ type: 'crack', x: t.x, y: t.y, t: 0, life: 1.1, color: P.aura, pts: this.crackPts(t.x, t.y).map(q => [lerp(t.x, q[0], .6), q[1]]) }); burst(t.x, t.y, 10, 14, '#a08a6a', 260, 12, .6, { add: false, type: 'chip', grav: 700, vz: 200, color: '#8a7a5a' }); }
    if (o.onImpact) o.onImpact(t, dir); else this.slashFx(t.x, t.y - 10 * t.k / .4, dir, P, t.boss ? 1.3 : 1);
    impact(t.uid); shake(6); sfx.hit(false);
    v.pose = 'follow'; v.bendT = -8; const fx0 = v.x, fy0 = v.y;
    yield* tween(.18, p => { const e = easeOut(p); v.x = fx0 + dir[0] * 26 * e; v.y = fy0 + dir[1] * 26 * e; v.sx = lerp(1.18, 1, e); v.sy = lerp(.88, 1, e); v.hop = 0; });
    yield .12; v.pose = 'idle'; v.bendT = 0; const bx = v.x, by = v.y;
    yield* tween(.3, p => { v.x = lerp(bx, ox, easeOut(p)); v.y = lerp(by, oy, easeOut(p)); v.hop = -Math.sin(p * Math.PI) * 40; v.sx = lerp(1.08, 1, p); v.sy = lerp(.94, 1, p); });
    v.hop = 0; v.busy = false;
  }
  // ---------- signature skills (BATCH13 prototype: Dawnflame Fox). Art layers are used when present, code otherwise ----------
  /** S1 กัดพุ่ง: the three-beat melee with jaws of light snapping shut on the target */
  *sk_fox_bite(v, tv, impact) {
    const P = this.P(v);
    yield* this.aMelee(v, tv[0], impact, { onImpact: (t, dir) => {
      const z = 70 * t.k / .4;
      if (IMG.fx_bite) { fxP('fx_bite', t.x, t.y, z, P.hot, 90, 250, .28, { rot: Math.atan2(dir[1], dir[0]) * .3 }); fxP('fx_bite', t.x, t.y, z, '#ffffff', 60, 150, .16); }
      else { for (const sgn of [-1, 1]) addP({ type: 'slash', x: t.x, y: t.y + sgn * 18, z, life: .22, size: 60, rot: sgn > 0 ? -2.6 : .5, color: P.hot, w: 12 }); }
      burst(t.x, t.y, z, 20, P.aura, 420, 16, .45); for (let i = 0; i < 6; i++) addP({ type: 'flame', x: t.x + rnd(-24, 24), y: t.y, z: z - 20, vz: rnd(100, 200), life: rnd(.4, .7), size: rnd(14, 24), color: P.aura, core: P.core, drag: 1 });
    } });
  }
  /** S2 ลูกไฟจิ้งจอก: fox-fire wisps appear and circle the fox, then fly one by one in arcs at every enemy */
  *sk_fox_fireball(v, tv, impact) {
    v.busy = true; const P = this.P(v), k = v.k / .4; v.pose = 'cast2'; v.bendT = -14; sfx.charge();
    const orbs = tv.map((t, i) => ({ t, a: i / tv.length * TAU, r: 0, x: v.x, y: v.y, z: 130 * k, live: true }));
    const drawOrb = o => { if (IMG.fx_foxfire) fxP('fx_foxfire', o.x, o.y, o.z + 22 * k, P.aura, 62 * k, 62 * k, .05, { ar: 1.5, fade: false }); else { addP({ type: 'flame', x: o.x + rnd(-4, 4), y: o.y, z: o.z, vz: rnd(30, 80), life: .3, size: 22 * k, color: P.aura, core: P.core }); } addP({ x: o.x, y: o.y, z: o.z, life: .06, size: 26 * k, size2: 22 * k, color: P.hot }); };
    yield* tween(.75, p => { for (const o of orbs) { o.a += .09 + p * .12; o.r = 95 * k * easeOut(Math.min(1, p * 1.6)); o.x = v.x + Math.cos(o.a) * o.r; o.y = v.y + Math.sin(o.a) * o.r * .42; o.z = 130 * k + Math.sin(o.a * 2 + E.time * 3) * 10; drawOrb(o); } });
    v.bendT = 0; v.bendV += 700; sfx.fire();
    const flights = orbs.map((o, i) => run((function* () {
      yield i * .09; const x0 = o.x, y0 = o.y, z0 = o.z, t = o.t, side = (i % 2 ? 1 : -1) * 70;
      yield* tween(.42, q => { const e = q * q * (3 - 2 * q); o.x = lerp(x0, t.x, e) + Math.sin(q * Math.PI) * side; o.y = lerp(y0, t.y, e); o.z = lerp(z0, 50 * t.k / .4, e) + Math.sin(q * Math.PI) * 110; drawOrb(o); addP({ x: o.x, y: o.y, z: o.z, life: .3, size: 14 * k, size2: 0, color: P.aura }); });
      this.explode(t.x, t.y, P, false); impact(t.uid); sfx.hit(false); shake(3);
    }).call(this)));
    yield* waitAll(flights); yield .1; v.pose = 'idle'; v.busy = false;
  }
  /** ULT อรุณเพลิงทะยาน: coils, then streaks through every enemy leaving a trail of dawn fire, leaps and lands; the trail erupts */
  *sk_fox_dawn(v, tv, impact) {
    v.busy = true; const P = this.P(v), ox = v.x, oy = v.y, k = v.k / .4;
    v.pose = 'windup'; v.bendT = -40; v.bendV -= 400;
    yield* tween(.22, p => { v.sx = lerp(1, 1.14, p); v.sy = lerp(1, .84, p); for (let i = 0; i < 2; i++) addP({ type: 'flame', x: v.x + rnd(-50, 50) * k, y: v.y, z: rnd(0, 30), vz: rnd(150, 300), life: .5, size: rnd(16, 28), color: P.aura, core: P.core }); });
    const path = [];
    for (const t of tv) {
      if (!t) continue; const fx0 = v.x, fy0 = v.y, dx = t.x - fx0, dy = t.y - fy0, l = Math.hypot(dx, dy) || 1, ex = t.x + dx / l * 70, ey = t.y + dy / l * 40;
      this.face(v, t); v.pose = 'strike'; v.bendT = 34; v.bendV += 700; sfx.whoosh();
      yield* tween(.12, p => { const e = easeOut(p); v.x = lerp(fx0, ex, e); v.y = lerp(fy0, ey, e); v.sx = 1.26; v.sy = .8; v.hop = -Math.sin(p * Math.PI) * 26; this.ghost(v, .32); E.decals.push({ type: 'fire', x: v.x + rnd(-8, 8), y: v.y + rnd(-4, 4), t: 0, life: 1.6, color: P.aura, core: P.core }); });
      const ang = Math.atan2(ey - fy0, ex - fx0), len = Math.hypot(ex - fx0, ey - fy0); path.push(t);
      if (IMG.fx_fire_trail) fxP('fx_fire_trail', (fx0 + ex) / 2, (fy0 + ey) / 2, 40 * k, P.aura, len * 1.1, len * 1.15, .55, { ar: .33, rot: ang });
      E.hitstop = .06; this.hitSpark(t, v, true); this.explode(t.x, t.y, P, true); impact(t.uid); shake(10); sfx.hit(true); yield .05;
    }
    // leap up and land with the follow-through pose, then every trail point erupts
    v.pose = 'follow'; v.bendT = -10; const bx = v.x, by = v.y;
    yield* tween(.32, p => { v.x = lerp(bx, (bx + ox) / 2, p); v.y = lerp(by, (by + oy) / 2, p); v.hop = -Math.sin(p * Math.PI) * 90; v.sx = v.sy = 1; });
    v.pose = 'burst'; v.bendV -= 500; flash(.45, P.hot); shake(12); sfx.boom();
    for (const t of path) { ring(t.x, t.y, 10, 170, P.aura, .55, 10); for (let i = 0; i < 12; i++) addP({ type: 'flame', x: t.x + rnd(-40, 40), y: t.y + rnd(-10, 10), z: 5, vz: rnd(260, 520), life: rnd(.5, .9), size: rnd(22, 38), color: P.aura, core: P.core, drag: 1 }); if (IMG.fx_column) fxP('fx_column', t.x, t.y, 160 * k, P.aura, 120 * k, 150 * k, .55, { ar: 2.6 }); }
    yield .35; v.pose = 'idle'; v.back = v.hb; v.flip = v.hf; const cx = v.x, cy = v.y;
    yield* tween(.36, p => { v.x = lerp(cx, ox, easeOut(p)); v.y = lerp(cy, oy, easeOut(p)); v.hop = -Math.sin(p * Math.PI) * 50; }); v.hop = 0; v.sx = v.sy = 1; v.bendT = 0; v.busy = false;
  }
  *aShot(v, t, impact) {
    if (!t) return; v.busy = true; const P = this.P(v); this.face(v, t); v.pose = 'cast'; v.bendT = -22;
    yield* tween(.3, p => { v.hop = -p * 8; this.charge(v, P, 1); });
    const m = this.anc(v, 'mouth'); sfx.whoosh(); v.bendT = 0; v.bendV += 650;
    const s = this.proj(m, v.y, t, P, { dur: .38, h: 30, size: 18, swirl: v.elem === 'wind' || v.elem === 'dark', onHit: () => { this.explode(t.x, t.y, P, false); impact(t.uid); shake(3); sfx.hit(false); } });
    yield* waitAll([s]); v.pose = 'idle'; yield* tween(.15, p => { v.hop = lerp(-8, 0, p); }); v.busy = false;
  }
  *aVolley(v, tv, impact) {
    v.busy = true; const P = this.P(v); v.pose = 'cast2'; sfx.charge(); v.bendT = -26;
    yield* tween(.45, p => { v.hop = -p * 10; this.charge(v, P, 2); });
    const m = this.anc(v, 'mouth'), ps = []; sfx.fire(); v.bendT = 0; v.bendV += 800; burst(m[0], v.y, v.y - m[1], 16, P.aura, 300, 18, .4);
    tv.forEach((t, i) => ps.push(this.proj(m, v.y, t, P, { dur: .48 + i * .06, side: (i - 1.5) * 50, h: 70 + i * 20, swirl: v.elem === 'wind' || v.elem === 'dark', onHit: () => { this.explode(t.x, t.y, P, false); impact(t.uid); sfx.hit(false); } })));
    yield* waitAll(ps); shake(4); v.pose = 'idle'; yield* tween(.18, p => { v.hop = lerp(-10, 0, p); }); v.busy = false;
  }
  *aSupport(v, tv, impact, kind) {
    v.busy = true; const P = this.P(v); v.pose = 'cast'; sfx.charge(); E.decals.push({ type: 'rune', x: v.x, y: v.y, t: 0, life: 1.3, color: P.rune, R: 96 * v.k / .4 });
    yield* tween(.45, p => { v.hop = -p * 10; this.charge(v, P, 1); });
    kind === 'heal' ? sfx.heal() : kind === 'buff' ? sfx.buff() : sfx.shield();
    for (const t of tv) {
      if (kind === 'heal') { ring(t.x, t.y, 10, 90, '#7dffb0', .6, 4); for (let i = 0; i < 16; i++) addP({ x: t.x + rnd(-45, 45), y: t.y + rnd(-8, 8), z: rnd(0, 30), vz: rnd(60, 140), life: rnd(.7, 1.1), size: rnd(8, 16), size2: 0, color: i % 2 ? '#8ff0ff' : '#7dffb0' }); addP({ type: 'beam', x: t.x, y: t.y + 1, life: .7, size: 40, color: '#5fe0c0' }); }
      else if (kind === 'buff') { addP({ type: 'beam', x: t.x, y: t.y + 1, life: .8, size: 46, color: P.aura }); ring(t.x, t.y, 10, 90, P.aura, .5, 4); }
      else { ring(t.x, t.y, 10, 100, '#bfe6ff', .6, 6); }
      impact(t.uid); yield .06;
    }
    yield .35; v.pose = 'idle'; v.hop = 0; v.busy = false;
  }
  *uDash(v, tv, impact) {
    v.busy = true; const P = this.P(v), ox = v.x, oy = v.y;
    for (const t of tv) { if (!t) continue; const fx = v.x, fy = v.y; this.face(v, t); v.pose = 'attack'; sfx.whoosh();
      yield* tween(.14, p => { v.x = lerp(fx, t.x, easeOut(p)); v.y = lerp(fy, t.y + 4, easeOut(p)); v.sx = 1.2; v.sy = .85; v.hop = -Math.sin(p * Math.PI) * 30; this.ghost(v, .3); E.decals.push({ type: 'fire', x: v.x + rnd(-10, 10), y: v.y + rnd(-5, 5), t: 0, life: 1.4, color: P.aura, core: P.core }); });
      E.hitstop = .06; this.explode(t.x, t.y, P, true); impact(t.uid); shake(10); sfx.hit(true); yield .08; }
    flash(.5, P.hot); v.pose = 'burst'; yield .3; v.pose = 'idle'; const bx = v.x, by = v.y; v.back = v.hb; v.flip = v.hf;
    yield* tween(.42, p => { v.x = lerp(bx, ox, easeOut(p)); v.y = lerp(by, oy, easeOut(p)); v.hop = -Math.sin(p * Math.PI) * 70; }); v.hop = 0; v.sx = v.sy = 1; v.busy = false;
  }
  *uRain(v, tv, impact) {
    v.busy = true; const P = this.P(v); v.pose = 'cast'; sfx.wave();
    const all = [...this.V.values()].filter(x => !x.dead);
    yield* tween(1.1, p => { for (let i = 0; i < 6; i++) { const x = rnd(-520, 520), y = rnd(-320, 340); addP({ type: 'streak', x, y, z: rnd(300, 500), vx: -40, vz: -900, life: .45, size: 2, color: '#bfe6ff' }); } if (Math.random() < .5) { const t = all[(Math.random() * all.length) | 0]; ring(t.x + rnd(-40, 40), t.y + rnd(-20, 20), 4, 24, '#bfe6ff', .4, 2); } });
    sfx.heal(); for (const t of tv) { ring(t.x, t.y, 10, 100, '#7dffb0', .6, 5); addP({ type: 'beam', x: t.x, y: t.y + 1, life: .7, size: 40, color: '#5fe0c0' }); impact(t.uid); }
    yield .35; v.pose = 'idle'; v.busy = false;
  }
  *uVortex(v, t, impact) {
    if (!t) return; v.busy = true; const P = this.P(v); this.face(v, t); v.pose = 'cast'; sfx.wave();
    yield* tween(1.0, p => { for (let i = 0; i < 6; i++) { const a = E.time * 12 + i * TAU / 6 + p * 8, r = 30 + (1 - p) * 90 + i * 4, h = i * 30 + p * 120; addP({ x: t.x + Math.cos(a) * r, y: t.y + Math.sin(a) * r * .4, z: h, life: .25, size: 12, size2: 0, color: i % 2 ? P.core : P.aura }); } if (Math.random() < .4) addP({ type: 'chip', add: false, x: t.x + rnd(-60, 60), y: t.y, z: rnd(10, 120), vz: rnd(40, 120), life: .6, size: rnd(5, 9), color: '#6fbf5a', rot: rnd(0, 6), vr: 10 }); t.rot = Math.sin(E.time * 30) * .08 * p; });
    t.rot = 0; E.hitstop = .08; this.explode(t.x, t.y, P, true); impact(t.uid); shake(9); sfx.hit(true); flash(.25, P.hot);
    yield .3; v.pose = 'idle'; v.busy = false;
  }
  *uQuake(v, tv, impact) {
    v.busy = true; const P = this.P(v); v.pose = 'burst'; sfx.quake(); shake(6);
    yield* tween(.2, p => { v.hop = -p * 30; }); v.hop = 0; ring(v.x, v.y, 10, 260, P.aura, .7, 10);
    const sorted = tv.slice().sort((a, b) => Math.hypot(a.x - v.x, a.y - v.y) - Math.hypot(b.x - v.x, b.y - v.y));
    for (const t of sorted) { yield .12; E.decals.push({ type: 'crack', x: t.x, y: t.y, t: 0, life: 1.6, color: P.aura, pts: this.crackPts(t.x, t.y) }); for (let i = 0; i < 6; i++) addP({ type: 'chip', add: false, x: t.x + rnd(-40, 40), y: t.y, z: 0, vz: rnd(220, 420), vx: rnd(-80, 80), grav: 1000, life: 1.2, size: rnd(10, 18), color: '#8a7a5a', rot: rnd(0, 6), vr: rnd(-8, 8) }); burst(t.x, t.y, 6, 10, '#cbb895', 200, 22, .6, { add: false, type: 'smoke', alpha: .4, color: '#d8c8a8' }); impact(t.uid); shake(8); sfx.hit(true); }
    yield .3; v.pose = 'idle'; v.busy = false;
  }
  *uStarlight(v, tv, impact) {
    v.busy = true; const P = this.P(v); v.pose = 'cast'; sfx.buff();
    for (const t of tv) { run((function* () { const p = { x: t.x + 160, y: t.y, z: 600, P, size: 26 }; E.projs.push(p); yield* tween(.4, q => { const e = easeIn(q); p.x = lerp(t.x + 160, t.x, e); p.z = lerp(600, 40, e); addP({ x: p.x, y: p.y, z: p.z, life: .4, size: 16, size2: 0, color: P.aura }); }); E.projs.splice(E.projs.indexOf(p), 1); for (let i = 0; i < 8; i++) addP({ type: 'twinkle', x: t.x + rnd(-50, 50), y: t.y, z: rnd(20, 140), life: .8, size: rnd(7, 12), color: '#fff6c8' }); addP({ type: 'beam', x: t.x, y: t.y + 1, life: .6, size: 50, color: P.aura }); impact(t.uid); sfx.meteor(); })()); yield .15; }
    yield .7; v.pose = 'idle'; v.busy = false;
  }
  *uNightwave(v, tv, impact) {
    v.busy = true; const P = this.P(v); v.pose = 'cast'; sfx.dark(); E.dimT = .7;
    const dir = v.team === 0 ? [.8, -.6] : [-.8, .6], perp = [.6, .8], c0 = [v.x - dir[0] * 60, v.y - dir[1] * 60]; const hit = new Set();
    yield* tween(1.2, p => { const d = lerp(0, 900, easeIO(p)), cx = c0[0] + dir[0] * d, cy = c0[1] + dir[1] * d; for (let i = 0; i < 12; i++) { const s = rnd(-330, 330); addP({ x: cx + perp[0] * s, y: cy + perp[1] * s, z: rnd(0, 80), vz: rnd(30, 120), life: rnd(.4, .7), size: rnd(16, 28), size2: 0, color: Math.random() < .3 ? P.core : P.aura, drag: 1.5 }); }
      for (const t of tv) { if (hit.has(t)) continue; const pr = (t.x - c0[0]) * dir[0] + (t.y - c0[1]) * dir[1]; if (pr < d) { hit.add(t); ring(t.x, t.y, 10, 100, P.aura, .5, 6); impact(t.uid); sfx.hit(false); } } });
    E.dimT = .3; yield .3; v.pose = 'idle'; v.busy = false;
  }
  *uRoots(v, tv, impact) {
    v.busy = true; const P = this.P(v); v.pose = 'cast'; sfx.quake();
    for (const t of tv) { yield .14; for (let i = 0; i < 5; i++) addP({ type: 'streak', x: t.x + rnd(-40, 40), y: t.y, z: 0, vz: 900, vx: rnd(-60, 60), life: .3, size: 7, color: '#7a5a2a', add: false }); E.decals.push({ type: 'crack', x: t.x, y: t.y, t: 0, life: 1.4, color: '#9adf5a', pts: this.crackPts(t.x, t.y) }); burst(t.x, t.y, 10, 12, '#8adf5a', 260, 14, .5); impact(t.uid); shake(6); sfx.hit(true); }
    yield .3; const own = this.V.get(v.uid); impact(own.uid); for (let i = 0; i < 14; i++) addP({ type: 'streak', x: own.x + rnd(-200, 200), y: own.y + rnd(-60, 120), z: 20, vx: 0, vz: 0, life: .5, size: 3, color: '#9adf5a' });
    yield .3; v.pose = 'idle'; v.busy = false;
  }

  // ---------- waves / end ----------
  /** forward direction (allies → enemies), normalised */
  fwd() { const port = E.W < E.H, a = port ? [0, 235] : ALLY_C, e = port ? [0, -120] : ENEMY_C, dx = e[0] - a[0], dy = e[1] - a[1], d = Math.hypot(dx, dy); return [dx / d, dy / d]; }
  /** allies march in from behind the camera to their positions (our signature entrance) */
  *walkIn() {
    const [fx, fy] = this.fwd(), D = 560, al = [...this.V.values()].filter(v => v.team === 0 && !v.dead);
    for (const v of al) { v.busy = true; v.back = v.hb; v.flip = v.hf; v.x = v.hx - fx * D; v.y = v.hy - fy * D; v.alpha = 1; v.pose = 'idle'; }
    const jobs = al.map((v, i) => run(this.march(v, v.hx - fx * D, v.hy - fy * D, v.hx, v.hy, 1.25, i * .12, true)));
    yield* waitAll(jobs);
  }
  *march(v, x0, y0, x1, y1, dur, delay, settle) {
    if (delay) yield delay;
    let lastStep = 0;
    yield* tween(dur, p => {
      const e = settle ? easeOut(p) : p, ph = p * dur * 7.5;
      v.x = lerp(x0, x1, e); v.y = lerp(y0, y1, e);
      const hop = Math.abs(Math.sin(ph * Math.PI)); v.hop = -hop * 16 * (settle ? 1 - p * .6 : 1); v.sx = 1 + (1 - hop) * .06; v.sy = 1 - (1 - hop) * .06;
      const st = Math.floor(ph); if (st !== lastStep) { lastStep = st; burst(v.x, v.y, 2, 3, '#d8c8a8', 60, 10, .4, { add: false, type: 'smoke', alpha: .3 }); if (v.slot0) sfx.step(); }
    });
    v.hop = 0; v.sx = 1.1; v.sy = .9;
    if (settle) { yield* tween(.18, p => { v.sx = lerp(1.1, 1, p); v.sy = lerp(.9, 1, p); }); v.busy = false; }
  }
  /** after a wave: allies march forward, the world scrolls past, wipe to the next arena */
  *walkOut() {
    const [fx, fy] = this.fwd(), al = [...this.V.values()].filter(v => v.team === 0 && !v.dead);
    yield .35;
    for (const v of al) { v.busy = true; v.back = true; v.flip = fx < -.1; }
    const jobs = al.map((v, i) => run(this.march(v, v.x, v.y, v.x + fx * 260, v.y + fy * 260, 1.1, i * .06, false)));
    const self = this;
    run((function* () { yield* tween(1.1, p => { self.env.x = -fx * 340 * p; self.env.y = -fy * 340 * p; E.zoomT = 1 + p * .06; }); })());
    yield .55; sfx.whoosh();
    yield* tween(.4, p => { this.wipe = p; });
    yield* waitAll(jobs);
    this.env.x = this.env.y = 0; E.zoomT = 1; E.zoom = 1; E.parts.length = 0; E.decals.length = 0; E.projs.length = 0;
    yield .1;
    run((function* () { yield* tween(.45, p => { self.wipe = 1 - p; }); self.wipe = 0; })());
  }
  *waveIntro(first) {
    this.phase = 'intro'; this.active = null; this.hud();
    for (const [uid, v] of [...this.V]) if (v.team === 1) this.V.delete(uid);
    if (!first) yield* this.walkOut();
    const al = [...this.V.values()].filter(v => v.team === 0 && !v.dead); if (al[0]) al[0].slot0 = true;
    const lay = this.layout(1);
    this.onWave && this.onWave(this.b.wave, this.stage.waves.length, lay.some(([u]) => u.boss));
    yield* this.walkIn();
    const views = lay.map(([u, p]) => this.makeView(u, p, true));
    yield .25;
    for (const v of views) { run(this.dropIn(v)); yield .16; }
    yield .7;
    const boss = views.find(v => v.boss);
    if (boss) { boss.busy = true; boss.pose = 'cast'; boss.glowF = 1; sfx.dark(); ring(boss.x, boss.y, 10, 300, PAL[boss.elem].aura, .8, 10); shake(10); flash(.2, '#3a5a1a'); yield 1; boss.glowF = 0; boss.pose = 'idle'; boss.busy = false; }
    this.sync(); this.hud();
  }
  *dropIn(v) { v.alpha = 1; yield* tween(v.boss ? .55 : .42, p => { v.hop = -620 * (1 - easeIn(p)); }); v.hop = 0; v.sx = 1.25; v.sy = .75; ring(v.x, v.y, 10, v.boss ? 220 : 110, '#e8dcc0', .5, v.boss ? 8 : 4); burst(v.x, v.y, 4, v.boss ? 24 : 10, '#d8c8a8', v.boss ? 260 : 140, 22, .6, { add: false, type: 'smoke', alpha: .35 }); shake(v.boss ? 14 : 4); sfx.hit(v.boss); yield* tween(.25, p => { v.sx = lerp(1.25, 1, p); v.sy = lerp(.75, 1, p); }); v.busy = false; }
  *finish() {
    this.phase = 'end'; this.hud(); const win = this.b.win;
    if (win) { sfx.win(); for (const v of this.V.values()) if (v.team === 0 && !v.dead) run((function* () { v.busy = true; v.back = false; for (let i = 0; i < 3; i++) { v.pose = 'joy'; v.bendV += 400; yield* tween(.38, p => { v.hop = -Math.sin(p * Math.PI) * 44; v.sy = 1 + Math.sin(p * Math.PI) * .06; v.sx = 2 - v.sy; }); v.pose = 'idle'; v.sx = 1.12; v.sy = .88; v.wave = 10; yield .14; } v.busy = false; })()); }
    else sfx.lose();
    yield win ? 1.8 : 1.2;
    this.ended = true; this.onEnd && this.onEnd(win, this.b.stars());
  }
  hud() { this.onHud && this.onHud(this); }

  // ---------- per-frame ----------
  update(dt) {
    E.camT.x = this.camF ? this.camF.x * this.camK : 0; E.camT.y = this.camF ? lerp(-25, this.camF.y, this.camK) : -25;
    if (this.cine) { this.cine.t += dt; if (this.cine.pose) this.cine.pose += dt; E.cam.x = lerp(E.cam.x, E.camT.x, 1 - Math.exp(-dt * 9)); E.cam.y = lerp(E.cam.y, E.camT.y, 1 - Math.exp(-dt * 9)); E.zoom = lerp(E.zoom, E.zoomT, 1 - Math.exp(-dt * 6)); }
    for (const v of this.V.values()) {
      v.flash = Math.max(0, v.flash - dt * 5); for (let i = v.ghosts.length - 1; i >= 0; i--) { v.ghosts[i].life -= dt; if (v.ghosts[i].life <= 0) v.ghosts.splice(i, 1); }
      v.x += v.kvx * dt; v.y += v.kvy * dt; const dm = Math.exp(-dt * 10); v.kvx *= dm; v.kvy *= dm;
      v.shown = lerp(v.shown, v.hp, 1 - Math.exp(-dt * 4));
      if (v.dead) { v.deathT += dt; v.alpha = Math.max(0, 1 - v.deathT / .9); if (v.deathT < .9 && Math.random() < dt * 30) { const b = this.anc(v, 'body'); addP({ x: b[0] + rnd(-40, 40) * v.k / .4, y: v.y, z: v.y - b[1] + rnd(-30, 30), vz: rnd(60, 120), life: .8, size: rnd(6, 12), size2: 0, color: PAL[v.elem].aura }); } continue; }
      if (!v.busy) { v.x = lerp(v.x, v.hx, 1 - Math.exp(-dt * 7)); v.y = lerp(v.y, v.hy, 1 - Math.exp(-dt * 7)); v.back = v.hb; v.flip = v.hf; }
      if (v.hitT > 0) { v.hitT -= dt; if (!v.busy) v.pose = 'hit'; } else if (!v.busy) v.pose = (v.st.has('sleep') || v.st.has('stun')) ? 'hit' : 'idle';
      if (!v.busy) { v.hop = lerp(v.hop, 0, 1 - Math.exp(-dt * 14)); v.rot = lerp(v.rot, 0, 1 - Math.exp(-dt * 10)); const b = Math.sin(E.time * 2.6 + v.ph); v.sy = 1 + b * .008; v.sx = 1 - b * .005; }
      // living sprite: lean spring (overshoots = follow-through), idle sway, travelling ripple, breathing
      const sway = v.busy ? 0 : Math.sin(E.time * 1.15 + v.ph) * 5, sdt = Math.min(dt, 1 / 30);
      v.bendV += ((v.bendT + sway) - v.bend) * 170 * sdt - v.bendV * 12 * sdt; v.bend += v.bendV * sdt;
      v.wave *= Math.exp(-dt * 2.6); v.wph += dt * 12; v.br = Math.sin(E.time * 2.3 + v.ph) * (v.busy ? .015 : .035);
      if (v.stars >= 3 && v.alpha > .5) { v.emberT -= dt; while (v.emberT <= 0) { v.emberT += v.stars >= 5 ? .05 : .13; const b = this.anc(v, 'body'), P = PAL[v.elem]; addP({ x: b[0] + rnd(-40, 40) * v.k / .4, y: v.y + rnd(-5, 5), z: v.y - b[1] + rnd(-40, 30) * v.k / .4, vz: rnd(30, 70), vx: rnd(-10, 10), life: rnd(.6, 1.1), size: rnd(4, 9), size2: 0, color: v.stars >= 6 && Math.random() < .5 ? '#ffd24a' : Math.random() < .3 ? P.core : P.aura }); } }
    }
  }
  render() {
    const ctx = E.ctx; worldTransform();
    const ex = this.env.x, ey = this.env.y, envd = f => { ctx.save(); ctx.translate(ex, ey); f(); ctx.restore(); };
    envd(() => { drawGround(); drawDecals(); drawLanternPools(); });
    for (const v of this.V.values()) this.drawGroundFx(v);
    const ents = []; for (const v of this.V.values()) ents.push({ y: v.y, v }); for (const L of LANTERNS) ents.push({ y: L.y + ey, d: () => envd(() => drawLantern(L)) }); for (const b of BUSHES) ents.push({ y: b.y + ey, d: () => envd(() => drawBush(b)) });
    ents.sort((a, b) => a.y - b.y); const dimOn = E.dim > .02;
    for (const e of ents) { if (e.v) { if (dimOn && this.focus.includes(e.v)) continue; this.drawUnit(e.v); } else e.d(); }
    if (dimOn) { ctx.save(); screenTransform(); ctx.fillStyle = `rgba(8,6,14,${E.dim})`; ctx.fillRect(0, 0, E.W, E.H); ctx.restore(); worldTransform(); this.drawCineBack(); for (const v of this.focus) this.drawUnit(v); }
    drawProjs(); drawParts(); envd(drawFlies); this.drawSpeedLines();
    if (this.phase !== 'intro' && !this.cine) for (const v of this.V.values()) this.drawBars(v); // the cinematic keeps the screen clean
    const a = this.active && this.V.get(this.active);
    if (a && !a.dead && this.phase !== 'end' && !this.cine) { const y = this.headY(a) - 36 + Math.sin(E.time * 6) * 4; ctx.fillStyle = '#ffd27a'; ctx.beginPath(); ctx.moveTo(a.x - 9, y - 10); ctx.lineTo(a.x + 9, y - 10); ctx.lineTo(a.x, y); ctx.closePath(); ctx.fill(); }
    drawOverlays();
    if (this.wipe > 0) { const g = ctx.createLinearGradient(0, 0, E.W, E.H); g.addColorStop(0, `rgba(250,244,226,${this.wipe})`); g.addColorStop(1, `rgba(214,232,200,${this.wipe})`); ctx.fillStyle = g; ctx.fillRect(0, 0, E.W, E.H); }
    // boss bar
    const boss = [...this.V.values()].find(v => v.boss && !v.dead);
    if (boss) { const w = Math.min(420, E.W - 40), x = (E.W - w) / 2, y = E.H - (this.phase === 'choose' || this.phase === 'aim' ? 176 : 64); ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(x - 2, y - 2, w + 4, 14); ctx.fillStyle = '#f3e6c8'; ctx.fillRect(x, y, w * boss.shown / boss.maxHp, 10); ctx.fillStyle = '#8acb3a'; ctx.fillRect(x, y, w * boss.hp / boss.maxHp, 10); ctx.font = '500 13px Mitr, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#e8ffd0'; ctx.fillText(boss.name + '  ' + '★'.repeat(boss.stars), E.W / 2, y - 6); }
    // perfect ring
    if (this.aim) { const v = this.aim.v; const z = E.base * E.zoom; const sx = (v.x - E.cam.x) * z + E.W / 2, sy = (v.y - 150 * v.k - E.cam.y) * z + E.H / 2; const r = this.ringR(); ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,230,140,.9)'; ctx.beginPath(); ctx.arc(sx, sy, 34, 0, TAU); ctx.stroke(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(sx, sy, Math.max(2, r), 0, TAU); ctx.stroke(); ctx.font = '600 15px Mitr, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffe9a8'; ctx.fillText('แตะเมื่อวงซ้อนกัน', sx, sy + 64); }
  }
  drawGroundFx(v) {
    if (v.alpha < .05) return; const ctx = E.ctx, P = PAL[v.elem], t = E.time, rk = v.k / .4;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    if (v.stars >= 2 && !v.dead) { const pul = .5 + .5 * Math.sin(t * 3 + v.ph); ctx.strokeStyle = P.aura; ctx.globalAlpha = (.35 + .3 * pul) * v.alpha; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.ellipse(v.x, v.y, (58 + pul * 5) * rk, (21 + pul * 2) * rk, 0, 0, TAU); ctx.stroke(); }
    if (v.stars >= 5 && !v.dead) { ctx.globalAlpha = .45; ctx.strokeStyle = P.rune; ctx.lineWidth = 1.6; const R = 72 * rk, rot = t * .8; ctx.beginPath(); ctx.ellipse(v.x, v.y, R, R * .38, 0, 0, TAU); ctx.stroke(); for (let i = 0; i < 12; i++) { const a = i / 12 * TAU + rot, a2 = a + .18; ctx.beginPath(); ctx.moveTo(v.x + Math.cos(a) * R * .8, v.y + Math.sin(a) * R * .3); ctx.lineTo(v.x + Math.cos(a2) * R * .98, v.y + Math.sin(a2) * R * .375); ctx.stroke(); } }
    if (this.active === v.uid && !v.dead && this.phase !== 'end') { ctx.globalAlpha = .85; ctx.strokeStyle = '#ffd27a'; ctx.lineWidth = 3; const R = 78 * rk; ctx.beginPath(); ctx.ellipse(v.x, v.y, R, R * .38, 0, 0, TAU); ctx.stroke(); }
    if (this.phase === 'choose' && !v.dead) { const u = this.b.get(this.active); const valid = u && this.b.validTargets(u, this.sel); if (valid && valid.includes(v.uid)) { const ally = u.skills[this.sel].target === 'allyAll'; ctx.strokeStyle = ally ? '#7dffb0' : '#ff5a4a'; ctx.globalAlpha = .45 + .35 * Math.sin(t * 6); ctx.lineWidth = 2.5; const R = 66 * rk; ctx.beginPath(); ctx.ellipse(v.x, v.y, R, R * .38, 0, 0, TAU); ctx.stroke(); } }
    ctx.restore();
  }
  drawUnit(v) {
    if (v.alpha <= .01) return; const ctx = E.ctx, key = this.key(v), P = PAL[v.elem], t = E.time;
    const sh = 1 - Math.min(.5, -v.hop / 90); ctx.globalAlpha = v.alpha; ctx.fillStyle = 'rgba(18,12,6,.36)'; ctx.beginPath(); ctx.ellipse(v.x, v.y + 2, 115 * v.k * sh * v.sx, 34 * v.k * sh, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    for (const g of v.ghosts) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = (g.life / g.max) * .38; ctx.translate(g.x, g.y + g.hop); ctx.rotate(g.rot); ctx.scale(g.sx * g.k * (g.flip ? -1 : 1), g.sy * g.k); ctx.drawImage(silOf(v.sid, g.key, P.aura), -PIV[0], -PIV[1]); ctx.restore(); }
    ctx.save(); ctx.translate(v.x, v.y + v.hop); ctx.rotate(v.rot); ctx.scale(v.sx * v.k * (v.flip ? -1 : 1), v.sy * v.k);
    let gl = v.stars >= 4 ? .5 + .2 * Math.sin(t * 4 + v.ph) : 0; gl = Math.max(gl, v.glowF);
    if (gl > 0 && !v.dead) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = gl * v.alpha; ctx.drawImage(glowOf(v.sid, key, P.aura), -PIV[0] - GP, -PIV[1] - GP); if (v.stars >= 5 || v.glowF > .5) { ctx.save(); ctx.scale(1.07, 1.16 + .05 * Math.sin(t * 9)); ctx.globalAlpha = .32 * v.alpha; ctx.drawImage(glowOf(v.sid, key, P.aura), -PIV[0] - GP, -PIV[1] - GP); ctx.restore(); } ctx.globalCompositeOperation = 'source-over'; }
    const W = { bend: v.bend, breathe: v.br, wave: v.wave, wph: v.wph };
    ctx.globalAlpha = v.alpha; warpDraw(ctx, spr(v.sid, key), W);
    if (v.dead) { ctx.globalAlpha = Math.min(1, v.deathT * 1.5) * v.alpha; warpDraw(ctx, silOf(v.sid, key, P.aura), W); }
    if (v.flash > 0) { ctx.globalAlpha = v.flash * .85; warpDraw(ctx, silOf(v.sid, key, '#ffffff'), W); }
    ctx.restore(); ctx.globalAlpha = 1;
    if (v.shieldAmt > 0 && !v.dead) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .25 + .1 * Math.sin(t * 4); ctx.strokeStyle = '#bfe6ff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(v.x, v.y - 150 * v.k, 170 * v.k, 210 * v.k, 0, 0, TAU); ctx.stroke(); ctx.restore(); }
  }
  /** "Lv.N" plate under the feet: green rim = our team, red = enemy, dot = element */
  drawLevel(v) {
    const ctx = E.ctx, str = 'Lv.' + v.lvl, y = v.y + 16 + (v.boss ? 6 : 0);
    ctx.save(); ctx.font = `700 ${v.boss ? 15 : 13}px Mitr, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const tw = ctx.measureText(str).width, w = tw + 24, h = v.boss ? 21 : 19, x = v.x - w / 2;
    ctx.globalAlpha = v.alpha; ctx.fillStyle = 'rgba(12,10,8,.78)'; ctx.beginPath(); ctx.roundRect(x, y - h / 2, w, h, h / 2); ctx.fill();
    ctx.strokeStyle = v.boss ? '#ffd27a' : v.team === 0 ? '#5fd864' : '#ef4a3c'; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.fillStyle = PAL[v.elem].aura; ctx.beginPath(); ctx.arc(x + 9, y, 4, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff6e0'; ctx.fillText(str, v.x + 5, y + 1); ctx.restore();
  }
  drawBars(v) {
    if (v.dead || v.alpha < .5) return; const ctx = E.ctx, w = v.boss ? 120 : 74, x = v.x - w / 2, y = this.headY(v) - 12;
    ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(x - 1, y - 1, w + 2, 9); ctx.fillStyle = '#f3e6c8'; ctx.fillRect(x, y, w * Math.max(0, v.shown) / v.maxHp, 7); ctx.fillStyle = v.team === 0 ? '#5fd864' : '#ef4a3c'; ctx.fillRect(x, y, w * v.hp / v.maxHp, 7);
    if (v.shieldAmt > 0) { ctx.fillStyle = 'rgba(200,235,255,.85)'; ctx.fillRect(x, y, Math.min(w, w * v.shieldAmt / v.maxHp), 3); }
    ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(x - 1, y + 8, w + 2, 5); ctx.fillStyle = '#56cfe3'; ctx.fillRect(x, y + 9, w * Math.min(1, v.atb / 100), 3);
    let ix = x; const iy = y - 11;
    for (const m of v.marks) { ctx.fillStyle = PAL[m].aura; ctx.beginPath(); ctx.arc(ix + 5, iy, 5, 0, TAU); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2; ctx.stroke(); ix += 13; }
    for (const s of v.st) { if (s === 'shield') continue; ctx.fillStyle = STATUS_COL[s] || '#fff'; ctx.fillRect(ix, iy - 4, 9, 9); ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.font = '700 8px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(({ burn: 'F', poison: 'P', stun: '!', sleep: 'z', blind: 'B', def_down: 'D', atk_down: 'A', spd_down: 'S', atk_up: 'A', def_up: 'D', spd_up: 'S', crit_up: 'C', regen: '+' })[s] || '', ix + 4.5, iy + 3); ix += 11; }
    this.drawLevel(v);
    if (v.st.has('stun')) for (let i = 0; i < 3; i++) { const a = E.time * 4 + i * TAU / 3; ctx.fillStyle = '#ffe066'; ctx.beginPath(); ctx.arc(v.x + Math.cos(a) * 22, this.headY(v) + 8 + Math.sin(a) * 7, 3.2, 0, TAU); ctx.fill(); }
  }
}
