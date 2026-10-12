// Deterministic turn-based battle simulation (ATB, skills, statuses, element marks, reactions).
// Same seed + same commands ⇒ identical results. No rendering here: callers read events.
import { Rng } from './rng';
import { SPECIES, statAt, spdAt, skillAt } from './data';
import type {
  Unit, Ev, Elem, StatusId, SkillDef, SkillEffect, TurnStart, ActionResult, Command, MonsterRef, EnemyRef, StageDef, ReactionId,
} from './types';
import { NEGATIVE } from './types';
import type { HomeMods } from './types';

const ADV: Partial<Record<Elem, Elem>> = { fire: 'wind', wind: 'earth', earth: 'water', water: 'fire', light: 'dark', dark: 'light' };
export function elemMult(a: Elem, d: Elem): number {
  if (ADV[a] === d) return 1.3;
  if (ADV[d] === a && a !== 'light' && a !== 'dark') return 0.85;
  return 1;
}
const REACT: Record<string, ReactionId> = {
  'fire>wind': 'wildfire', 'water>wind': 'storm', 'water>fire': 'steam', 'earth>fire': 'lava', 'light>dark': 'eclipse', 'dark>light': 'eclipse',
};
export const REACTION_NAME: Record<ReactionId, string> = { wildfire: 'ไฟลาม', storm: 'พายุฟ้าคะนอง', steam: 'ไอน้ำ', lava: 'ลาวา', eclipse: 'สุริยคราส' };
const TURN_LIMIT = 160;

export class Battle {
  rng: Rng;
  /** AI decisions use separate per-team RNGs so player commands (recorded) never shift combat rolls */
  aiRng: [Rng, Rng];
  units: Unit[] = [];
  wave = 0;
  over = false;
  win = false;
  turn = 0;
  reactions = 0;
  allyDeaths = 0;
  private nextUid = 10;
  private actor: Unit | null = null;

  /** events produced before the first turn (home relic etc.) — renderer plays them after the intro */
  startEvents: Ev[] = [];
  private rx = 1; // reaction damage multiplier while resolving an ally reaction
  constructor(public seed: number, public team: MonsterRef[], public stage: StageDef, public mods: HomeMods = {}) {
    this.rng = new Rng(seed);
    this.aiRng = [new Rng(seed ^ 0x9e3779b9), new Rng(seed ^ 0x85ebca6b)];
    team.slice(0, 4).forEach((m, i) => this.units.push(this.makeUnit(m, 0, i, i + 1)));
    const lead = SPECIES[team[0]?.sid]?.leader;
    if (lead) for (const u of this.allies()) this.applyLeader(u, lead.stat, lead.value);
    for (const u of this.allies()) { const p = mods.elemAtk?.[u.elem] || 0; if (p) u.atk = Math.round(u.atk * (1 + p)); }
    this.spawnWave(0);
    this.startEvents = this.relicWave(true);
  }
  /** home relic effect at the start of the battle / each new wave */
  private relicWave(first: boolean): Ev[] {
    const ev: Ev[] = [], r = this.mods.relic;
    if (!r) return ev;
    const al = this.allies();
    if (r === 'sun' && first) for (const u of al) { u.statuses = u.statuses.filter(s => s.id !== 'atk_up'); u.statuses.push({ id: 'atk_up', turns: 2, fresh: false }); ev.push({ t: 'status', tgt: u.uid, id: 'atk_up', add: true, turns: 2 }); }
    if (r === 'gourd' && !first) for (const u of al) { const amt = Math.min(u.maxHp - u.hp, Math.round(u.maxHp * 0.1)); if (amt > 0) { u.hp += amt; ev.push({ t: 'heal', tgt: u.uid, amt, hp: u.hp }); } }
    if (r === 'feather' && first) for (const u of al) { u.atb = Math.min(100, u.atb + 30); ev.push({ t: 'atb', tgt: u.uid, delta: 30, atb: u.atb }); }
    if (r === 'shell' && first) for (const u of al) { const amt = Math.round(u.maxHp * 0.15); u.statuses = u.statuses.filter(s => s.id !== 'shield'); u.statuses.push({ id: 'shield', turns: 3, value: amt, fresh: false }); ev.push({ t: 'shield', tgt: u.uid, amt }); }
    return ev;
  }

  // ---------- setup ----------
  private makeUnit(m: EnemyRef, team: 0 | 1, slot: number, uid: number): Unit {
    const s = SPECIES[m.sid];
    const hp = Math.round(statAt(s.base.hp, m.lvl, m.stars) * (m.hpMult || 1));
    return {
      uid, team, slot, sid: s.id, name: s.name, elem: s.elem, role: s.role, lvl: m.lvl, stars: m.stars, boss: !!s.boss,
      maxHp: hp, hp, atk: Math.round(statAt(s.base.atk, m.lvl, m.stars) * (m.atkMult || 1)), def: statAt(s.base.def, m.lvl, m.stars),
      spd: spdAt(s.base.spd, m.lvl, m.stars), crit: 0.15, critDmg: 0.5, res: s.boss ? 0.35 : 0.15, acc: 0,
      atb: 0, cds: [0, 0, 0], skills: s.skills.map((k, i) => skillAt(k, m.sk?.[i] || 1, i)), statuses: [], marks: [], alive: true, leader: team === 0 && slot === 0,
    };
  }
  private applyLeader(u: Unit, stat: string, v: number) {
    if (stat === 'hp') { u.maxHp = Math.round(u.maxHp * (1 + v)); u.hp = u.maxHp; }
    else if (stat === 'atk') u.atk = Math.round(u.atk * (1 + v));
    else if (stat === 'def') u.def = Math.round(u.def * (1 + v));
    else if (stat === 'spd') u.spd = Math.round(u.spd * (1 + v));
    else if (stat === 'crit') u.crit += v;
    else if (stat === 'res') u.res += v;
  }
  private spawnWave(i: number): Ev {
    this.wave = i;
    this.units = this.units.filter(u => u.team === 0);
    const ids: number[] = [];
    this.stage.waves[i].forEach((m, k) => { const u = this.makeUnit(m, 1, k, this.nextUid++); this.units.push(u); ids.push(u.uid); });
    return { t: 'wave', wave: i, units: ids };
  }

  // ---------- queries ----------
  get(uid: number) { return this.units.find(u => u.uid === uid)!; }
  allies() { return this.units.filter(u => u.team === 0 && u.alive); }
  enemies() { return this.units.filter(u => u.team === 1 && u.alive); }
  foes(u: Unit) { return this.units.filter(x => x.team !== u.team && x.alive); }
  friends(u: Unit) { return this.units.filter(x => x.team === u.team && x.alive); }
  has(u: Unit, id: StatusId) { return u.statuses.some(s => s.id === id); }
  effSpd(u: Unit) { return u.spd * (1 + (this.has(u, 'spd_up') ? 0.3 : 0) - (this.has(u, 'spd_down') ? 0.3 : 0)); }
  /** units sorted by time until their next turn (for the turn-order bar) */
  order(): number[] {
    return this.units.filter(u => u.alive).map(u => ({ u, t: (100 - u.atb) / this.effSpd(u) }))
      .sort((a, b) => a.t - b.t || b.u.spd - a.u.spd || a.u.uid - b.u.uid).map(o => o.u.uid);
  }

  // ---------- turn flow ----------
  nextTurn(): TurnStart | null {
    if (this.over) return null;
    this.turn++;
    if (this.turn > TURN_LIMIT) { this.over = true; this.win = false; return { uid: 0, events: [{ t: 'end', win: false }], skip: true }; }
    const live = this.units.filter(u => u.alive);
    let best = live[0], bt = Infinity;
    for (const u of live) { const t = (100 - u.atb) / this.effSpd(u); if (t < bt - 1e-9 || (Math.abs(t - bt) < 1e-9 && (u.spd > best.spd || (u.spd === best.spd && u.uid < best.uid)))) { bt = t; best = u; } }
    for (const u of live) u.atb = Math.min(100, u.atb + this.effSpd(u) * bt);
    const a = best; a.atb = 0; this.actor = a;
    const ev: Ev[] = [];
    // damage / heal over time
    for (const s of a.statuses.slice()) {
      if (s.id === 'burn' || s.id === 'poison') {
        const dmg = Math.max(1, Math.round(a.maxHp * (a.boss ? 0.012 : 0.05)));
        a.hp = Math.max(0, a.hp - dmg); ev.push({ t: 'dot', tgt: a.uid, id: s.id, dmg, hp: a.hp });
      } else if (s.id === 'regen') {
        const amt = Math.round(a.maxHp * 0.1); a.hp = Math.min(a.maxHp, a.hp + amt); ev.push({ t: 'heal', tgt: a.uid, amt, hp: a.hp });
      }
    }
    for (let i = 0; i < 3; i++) if (a.cds[i] > 0) a.cds[i]--;
    if (a.hp <= 0) { this.kill(a, ev); ev.push(...this.endTurn(a)); ev.push(...this.checkEnd()); return { uid: a.uid, events: ev, skip: true }; }
    const cc = a.statuses.find(s => s.id === 'stun' || s.id === 'sleep');
    if (cc) { ev.push({ t: 'skip', uid: a.uid, reason: cc.id }); ev.push(...this.endTurn(a)); ev.push(...this.checkEnd()); return { uid: a.uid, events: ev, skip: true }; }
    return { uid: a.uid, events: ev, skip: false };
  }

  /** valid targets for a skill (for UI highlighting) */
  validTargets(u: Unit, si: number): number[] {
    const sk = u.skills[si];
    if (sk.target === 'enemy' || sk.target === 'enemyAll') return this.foes(u).map(x => x.uid);
    if (sk.target === 'allyAll') return this.friends(u).map(x => x.uid);
    return [u.uid];
  }
  canUse(u: Unit, si: number) { return !!u.skills[si] && u.cds[si] === 0; }

  act(uid: number, cmd: Command): ActionResult {
    const a = this.get(uid);
    let si = this.canUse(a, cmd.si) ? cmd.si : 0;
    const sk = a.skills[si];
    const perfect = !!cmd.perfect && !!sk.ult;
    a.cds[si] = sk.cd;
    const res: ActionResult = { uid, skillIndex: si, skill: sk, ult: !!sk.ult, perfect, targets: [], impacts: {}, after: [] };
    const imp = (id: number) => (res.impacts[id] ||= []);
    const elem = sk.elem || a.elem;
    const pm = perfect ? 1.15 : 1;

    // targets
    let targets: Unit[];
    if (sk.target === 'enemy') {
      const t = this.foes(a).find(x => x.uid === cmd.target) || this.foes(a)[0];
      targets = t ? [t] : [];
    } else if (sk.target === 'enemyAll') targets = this.foes(a);
    else if (sk.target === 'allyAll') targets = this.friends(a);
    else targets = [a];
    res.targets = targets.map(t => t.uid);

    let dealt = 0;
    if (sk.mult > 0) {
      for (const t of targets) {
        const ev = imp(t.uid);
        const h = this.hit(a, t, sk.mult * pm, elem, ev, { single: sk.target === 'enemy' });
        dealt += h.dmg;
        if (!h.miss) {
          this.tryReaction(a, t, elem, ev);
          for (const e of sk.effects) if (!e.to || e.to === 'target') this.applyEffect(a, t, e, ev, pm);
        }
        if (t.hp <= 0 && t.alive) this.kill(t, ev);
      }
    }
    for (const e of sk.effects) {
      if (e.to === 'allies') for (const f of this.friends(a)) this.applyEffect(a, f, e, imp(f.uid), pm);
      else if (e.to === 'self') this.applyEffect(a, a, e, imp(a.uid), pm, dealt);
      else if (e.to === 'enemies') for (const f of this.foes(a)) this.applyEffect(a, f, e, imp(f.uid), pm);
      else if (sk.mult === 0 && (!e.to || e.to === 'target')) for (const t of targets) this.applyEffect(a, t, e, imp(t.uid), pm);
    }
    res.after.push(...this.endTurn(a));
    res.after.push(...this.checkEnd());
    return res;
  }

  autoCommand(uid: number): Command {
    const a = this.get(uid);
    const R = this.aiRng[a.team];
    let si = 0;
    const ready = (i: number) => this.canUse(a, i);
    const healS = (i: number) => a.skills[i].effects.some(e => e.kind === 'heal');
    const lowAlly = this.friends(a).some(f => f.hp / f.maxHp < 0.65);
    if (ready(2) && (!healS(2) || lowAlly || R.chance(0.4)) && R.chance(0.85)) si = 2;
    else if (ready(1)) { if (healS(1)) { if (lowAlly) si = 1; } else if (R.chance(0.7)) si = 1; }
    const sk = a.skills[si];
    let target = a.uid;
    if (sk.target === 'enemy' || sk.target === 'enemyAll') {
      const fs = this.foes(a);
      const adv = fs.filter(f => elemMult(sk.elem || a.elem, f.elem) > 1);
      const markHit = fs.filter(f => f.marks.some(m => REACT[`${m.elem}>${sk.elem || a.elem}`]));
      const pick = markHit.length && R.chance(0.8) ? markHit : adv.length && R.chance(0.6) ? adv : fs;
      target = pick.slice().sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp || x.uid - y.uid)[0]?.uid ?? fs[0]?.uid;
    } else if (sk.target === 'allyAll') target = this.friends(a)[0].uid;
    return { si, target };
  }

  // ---------- mechanics ----------
  private hit(a: Unit, t: Unit, mult: number, elem: Elem, ev: Ev[], o: { single?: boolean; noCrit?: boolean; trueDmg?: boolean } = {}) {
    if (o.single && this.has(a, 'blind') && this.rng.chance(0.5)) { ev.push({ t: 'hit', src: a.uid, tgt: t.uid, dmg: 0, crit: false, em: 1, miss: true, hp: t.hp }); return { dmg: 0, miss: true }; }
    const atk = a.atk * (1 + (this.has(a, 'atk_up') ? 0.3 : 0) - (this.has(a, 'atk_down') ? 0.3 : 0));
    const def = o.trueDmg ? 0 : t.def * (this.has(t, 'def_up') ? 1.4 : 1) * (this.has(t, 'def_down') ? 0.5 : 1);
    const em = elemMult(elem, t.elem);
    const crit = !o.noCrit && this.rng.chance(Math.min(0.8, a.crit + (this.has(a, 'crit_up') ? 0.2 : 0)));
    let dmg = mult * atk * 3 * (100 / (100 + def)) * em * (crit ? 1 + a.critDmg : 1) * this.rng.range(0.92, 1.08) * this.rx;
    dmg = Math.max(1, Math.round(dmg));
    let shieldAbs = 0;
    const sh = t.statuses.find(s => s.id === 'shield');
    if (sh && sh.value) { shieldAbs = Math.min(sh.value, dmg); sh.value -= shieldAbs; if (sh.value <= 0) { t.statuses = t.statuses.filter(s => s !== sh); ev.push({ t: 'status', tgt: t.uid, id: 'shield', add: false }); } }
    const real = dmg - shieldAbs;
    t.hp = Math.max(0, t.hp - real);
    ev.push({ t: 'hit', src: a.uid, tgt: t.uid, dmg, crit, em, hp: t.hp, shieldAbs: shieldAbs || undefined });
    if (real > 0 && this.has(t, 'sleep')) { t.statuses = t.statuses.filter(s => s.id !== 'sleep'); ev.push({ t: 'status', tgt: t.uid, id: 'sleep', add: false }); }
    return { dmg: real, miss: false };
  }

  private tryReaction(a: Unit, t: Unit, elem: Elem, ev: Ev[]) {
    const m = t.marks.find(mk => REACT[`${mk.elem}>${elem}`]);
    if (!m) return;
    const id = REACT[`${m.elem}>${elem}`];
    t.marks = t.marks.filter(x => x !== m);
    ev.push({ t: 'mark', tgt: t.uid, elem: m.elem, add: false });
    const sub: Ev[] = [];
    this.reactions++;
    if (a.team === 0) this.rx = 1 + (this.mods.react?.[elem] || 0);
    if (id === 'wildfire') {
      this.hit(a, t, 0.3, 'fire', sub, { noCrit: true });
      for (const f of this.foes(a)) this.addStatus(a, f, 'burn', 2, 1, sub, true);
    } else if (id === 'storm') {
      const chain = [t, ...this.foes(a).filter(f => f !== t)].slice(0, 3);
      for (const c of chain) { if (!c.alive) continue; this.hit(a, c, 0.6, 'wind', sub, { noCrit: true }); this.addStatus(a, c, 'spd_down', 2, 1, sub, true); if (c.hp <= 0 && c.alive) this.kill(c, sub); }
    } else if (id === 'steam') {
      this.hit(a, t, 0.4, 'fire', sub, { noCrit: true }); this.addStatus(a, t, 'blind', 2, 1, sub, true);
    } else if (id === 'lava') {
      this.hit(a, t, 0.4, 'fire', sub, { noCrit: true }); this.addStatus(a, t, 'def_down', 2, 1, sub, true); this.addStatus(a, t, 'burn', 2, 1, sub, true);
    } else if (id === 'eclipse') {
      this.hit(a, t, 0.9, elem, sub, { noCrit: true, trueDmg: true });
    }
    this.rx = 1;
    ev.push({ t: 'reaction', id, src: a.uid, tgt: t.uid, sub });
  }

  private applyEffect(a: Unit, t: Unit, e: SkillEffect, ev: Ev[], pm: number, dealt = 0) {
    if (!t.alive) return;
    const ch = e.chance ?? 1;
    switch (e.kind) {
      case 'mark':
        if (this.rng.chance(ch)) { t.marks = t.marks.filter(m => m.elem !== e.elem); t.marks.push({ elem: e.elem!, turns: 2, fresh: t === this.actor }); ev.push({ t: 'mark', tgt: t.uid, elem: e.elem!, add: true }); }
        break;
      case 'status': this.addStatus(a, t, e.status!, e.turns || 2, ch, ev, false); break;
      case 'heal': { const amt = Math.round(t.maxHp * (e.value || 0) * pm); t.hp = Math.min(t.maxHp, t.hp + amt); ev.push({ t: 'heal', tgt: t.uid, amt, hp: t.hp }); break; }
      case 'shield': {
        const amt = Math.round(t.maxHp * (e.value || 0) * pm);
        t.statuses = t.statuses.filter(s => s.id !== 'shield');
        t.statuses.push({ id: 'shield', turns: e.turns || 2, value: amt, fresh: t === this.actor });
        ev.push({ t: 'shield', tgt: t.uid, amt }); break;
      }
      case 'atb': {
        const d = e.value || 0; t.atb = Math.max(0, Math.min(100, t.atb + d)); ev.push({ t: 'atb', tgt: t.uid, delta: d, atb: t.atb }); break;
      }
      case 'cleanse': {
        const had = t.statuses.filter(s => NEGATIVE.includes(s.id));
        if (had.length) { t.statuses = t.statuses.filter(s => !NEGATIVE.includes(s.id)); for (const s of had) ev.push({ t: 'status', tgt: t.uid, id: s.id, add: false }); ev.push({ t: 'cleanse', tgt: t.uid }); }
        break;
      }
      case 'drain': { const amt = Math.round(dealt * (e.value || 0)); if (amt > 0) { t.hp = Math.min(t.maxHp, t.hp + amt); ev.push({ t: 'heal', tgt: t.uid, amt, hp: t.hp }); } break; }
    }
  }

  private addStatus(a: Unit, t: Unit, id: StatusId, turns: number, chance: number, ev: Ev[], guaranteed: boolean) {
    if (!t.alive) return;
    const neg = NEGATIVE.includes(id);
    if (neg && t.boss && (id === 'stun' || id === 'sleep')) { ev.push({ t: 'resist', tgt: t.uid, id }); return; }
    if (neg && !guaranteed) {
      const p = chance >= 1 ? 1 : Math.max(0.15, chance - t.res + a.acc);
      if (!this.rng.chance(p)) { if (chance > 0) ev.push({ t: 'resist', tgt: t.uid, id }); return; }
    }
    const ex = t.statuses.find(s => s.id === id);
    if (ex) ex.turns = Math.max(ex.turns, turns);
    else t.statuses.push({ id, turns, fresh: t === this.actor });
    ev.push({ t: 'status', tgt: t.uid, id, add: true, turns });
  }

  private kill(u: Unit, ev: Ev[]) {
    u.alive = false; u.hp = 0; u.statuses = []; u.marks = [];
    if (u.team === 0) this.allyDeaths++;
    ev.push({ t: 'death', uid: u.uid });
  }

  private endTurn(u: Unit): Ev[] {
    const ev: Ev[] = [];
    if (!u.alive) return ev;
    for (const s of u.statuses.slice()) {
      if (s.fresh) { s.fresh = false; continue; }
      s.turns--;
      if (s.turns <= 0) { u.statuses = u.statuses.filter(x => x !== s); ev.push({ t: 'status', tgt: u.uid, id: s.id, add: false }); }
    }
    for (const m of u.marks.slice()) {
      if (m.fresh) { m.fresh = false; continue; }
      m.turns--;
      if (m.turns <= 0) { u.marks = u.marks.filter(x => x !== m); ev.push({ t: 'mark', tgt: u.uid, elem: m.elem, add: false }); }
    }
    this.actor = null;
    return ev;
  }

  private checkEnd(): Ev[] {
    if (this.over) return [];
    if (!this.allies().length) { this.over = true; this.win = false; return [{ t: 'end', win: false }]; }
    if (!this.enemies().length) {
      if (this.wave < this.stage.waves.length - 1) return [this.spawnWave(this.wave + 1), ...this.relicWave(false)];
      this.over = true; this.win = true; return [{ t: 'end', win: true }];
    }
    return [];
  }

  /** stars for the stage result: clear, no ally deaths, at least one reaction */
  stars(): number { return this.win ? 1 + (this.allyDeaths === 0 ? 1 : 0) + (this.reactions > 0 ? 1 : 0) : 0; }
}

/** Run a whole battle with AI on both sides (used by tests and balance sims). */
export function simulate(seed: number, team: MonsterRef[], stage: StageDef) {
  const b = new Battle(seed, team, stage);
  const log: string[] = [];
  let guard = 0;
  while (!b.over && guard++ < 2000) {
    const ts = b.nextTurn(); if (!ts) break;
    if (ts.skip) { log.push(`${ts.uid}:skip`); continue; }
    const cmd = b.autoCommand(ts.uid);
    const r = b.act(ts.uid, cmd);
    log.push(`${ts.uid}:${r.skillIndex}>${r.targets.join(',')}`);
  }
  return { win: b.win, turns: b.turn, stars: b.stars(), reactions: b.reactions, rng: b.rng.state, log };
}
