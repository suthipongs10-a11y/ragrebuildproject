// Deterministic turn-based battle simulation (ATB, skills, statuses, element marks, reactions).
// Same seed + same commands ⇒ identical results. No rendering here: callers read events.
import { Rng } from './rng';
import { SPECIES, statAt, spdAt, skillAt, isMythic, mythicUlt, formOf, monName, awakeName } from './data';
import { applyRunes } from './runes';
import type {
  Unit, Ev, Elem, StatusId, SkillDef, SkillEffect, TurnStart, ActionResult, Command, MonsterRef, EnemyRef, StageDef, ReactionId,
} from './types';
import { NEGATIVE } from './types';
import type { HomeMods, PassiveDef } from './types';

const ADV: Partial<Record<Elem, Elem>> = { fire: 'wind', wind: 'earth', earth: 'water', water: 'fire', light: 'dark', dark: 'light' };
export function elemMult(a: Elem, d: Elem): number {
  if (ADV[a] === d) return 1.3;
  if (ADV[d] === a && a !== 'light' && a !== 'dark') return 0.85;
  return 1;
}
const REACT: Record<string, ReactionId> = {
  'fire>wind': 'wildfire', 'water>wind': 'storm', 'water>fire': 'steam', 'earth>fire': 'lava', 'light>dark': 'eclipse', 'dark>light': 'eclipse',
};
/** light/dark rare forms are "wild": their hits set off any other element's mark, and their own marks are set off by any
 *  other element — always as an eclipse (สุริยคราส). So a rare form keeps the team's element reactions going. */
const LD = (e: Elem) => e === 'light' || e === 'dark';
export function reactionOf(a: { rare?: boolean; elem: Elem }, mk: { elem: Elem; wild?: boolean }, elem: Elem): ReactionId | undefined {
  return REACT[`${mk.elem}>${elem}`] || (mk.elem !== elem && (mk.wild || (a.rare && LD(elem) && elem === a.elem)) ? 'eclipse' : undefined);
}
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
  myReactions = 0; reactKinds = new Set<string>(); // player-caused reactions (adventure-book quests)
  allyDeaths = 0;
  private nextUid = 10;
  private actor: Unit | null = null;

  /** events produced before the first turn (home relic etc.) — renderer plays them after the intro */
  startEvents: Ev[] = [];
  private rx = 1; // reaction damage multiplier while resolving an ally reaction
  private curSi = 0; private stolen = 0; // the skill being used (team cooldown cuts skip it) · turn gauge stolen this action
  private actorCrit = false; // the acting unit landed a critical hit this action (จังหวะทอง)
  constructor(public seed: number, public team: MonsterRef[], public stage: StageDef, public mods: HomeMods = {}) {
    this.rng = new Rng(seed);
    this.aiRng = [new Rng(seed ^ 0x9e3779b9), new Rng(seed ^ 0x85ebca6b)];
    team.slice(0, 4).forEach((m, i) => this.units.push(this.makeUnit(m, 0, i, i + 1)));
    const lead = SPECIES[team[0]?.sid]?.leader;
    if (lead) for (const u of this.allies()) this.applyLeader(u, lead.stat, lead.value);
    for (const u of this.allies()) { const p = mods.elemAtk?.[u.elem] || 0; if (p) u.atk = Math.round(u.atk * (1 + p)); }
    this.spawnWave(0);
    this.startEvents = [...this.relicWave(true), ...this.passiveStart()];
  }
  /** home relic effect at the start of the battle / each new wave */
  private relicWave(first: boolean): Ev[] {
    const ev: Ev[] = [], r = this.mods.relic;
    if (!r) return ev;
    const al = this.allies();
    if (r === 'sun' && first) for (const u of al) { u.statuses = u.statuses.filter(s => s.id !== 'atk_up'); u.statuses.push({ id: 'atk_up', turns: 2, fresh: false }); ev.push({ t: 'status', tgt: u.uid, id: 'atk_up', add: true, turns: 2 }); }
    if (r === 'gourd' && !first) for (const u of al) { const amt = Math.min(u.maxHp - u.hp, Math.round(u.maxHp * 0.1)); if (amt > 0) this.healBy(u, amt, ev); }
    if (r === 'feather' && first) for (const u of al) { u.atb = Math.min(100, u.atb + 30); ev.push({ t: 'atb', tgt: u.uid, delta: 30, atb: u.atb }); }
    if (r === 'shell' && first) for (const u of al) { const amt = Math.round(u.maxHp * 0.15); u.statuses = u.statuses.filter(s => s.id !== 'shield'); u.statuses.push({ id: 'shield', turns: 3, value: amt, fresh: false }); ev.push({ t: 'shield', tgt: u.uid, amt }); }
    return ev;
  }

  // ---------- passives (signature passive of every form + the rare-form passive) ----------
  private pk(u: Unit, kind: string): PassiveDef | undefined { return u.passives?.find(p => p.kind === kind); }
  private pev(u: Unit, p: PassiveDef, ev: Ev[]) { ev.push({ t: 'passive', uid: u.uid, name: p.name }); }
  /** once-per-battle passives: true the first time (and marks it spent) */
  private once(u: Unit, kind: string) { if (u.used?.includes(kind)) return false; (u.used ||= []).push(kind); return true; }
  private spent(u: Unit, kind: string) { return !!u.used?.includes(kind); }
  /** team aura total for a stat (every living teammate with an aura of that stat, itself included) */
  private aura(u: Unit, stat: string) { let v = 0; for (const f of this.units) if (f.team === u.team && f.alive) for (const p of f.passives || []) if (p.kind === 'aura' && p.stat === stat) v += p.value || 0; return v; }
  /** passives that fire once when the battle starts */
  private passiveStart(): Ev[] {
    const ev: Ev[] = [];
    for (const u of this.allies()) {
      let p = this.pk(u, 'startAtb'); if (p) { this.pev(u, p, ev); for (const f of this.allies()) { f.atb = Math.min(100, f.atb + p.value!); ev.push({ t: 'atb', tgt: f.uid, delta: p.value!, atb: f.atb }); } }
      p = this.pk(u, 'startShield'); if (p) { this.pev(u, p, ev); for (const f of this.allies()) { const amt = Math.round(f.maxHp * p.value!); f.statuses = f.statuses.filter(x => x.id !== 'shield'); f.statuses.push({ id: 'shield', turns: 2, value: amt, fresh: false }); ev.push({ t: 'shield', tgt: f.uid, amt }); } }
    }
    return ev;
  }
  /** a lethal blow: endure saves the unit once (1 HP + shield), or a teammate's ไฟอุ่นใจ (allyEndure) keeps it at 1 HP.
   *  Returns true when saved. */
  private endure(t: Unit, ev: Ev[]): boolean {
    if (t.hp > 0) return false;
    const p = this.pk(t, 'endure');
    if (p && this.once(t, 'endure')) {
      t.hp = 1; this.pev(t, p, ev);
      const amt = Math.round(t.maxHp * p.value!); t.statuses = t.statuses.filter(x => x.id !== 'shield'); t.statuses.push({ id: 'shield', turns: 2, value: amt, fresh: t === this.actor });
      ev.push({ t: 'heal', tgt: t.uid, amt: 1, hp: 1 }); ev.push({ t: 'shield', tgt: t.uid, amt }); return true;
    }
    const g = this.units.find(x => x.team === t.team && x.alive && this.pk(x, 'allyEndure') && !this.spent(x, 'allyEndure'));
    if (g && this.once(g, 'allyEndure')) { t.hp = 1; this.pev(g, this.pk(g, 'allyEndure')!, ev); ev.push({ t: 'heal', tgt: t.uid, amt: 1, hp: 1 }); return true; }
    return false;
  }

  // ---------- setup ----------
  private makeUnit(m: EnemyRef, team: 0 | 1, slot: number, uid: number): Unit {
    const s = SPECIES[m.sid], form = formOf(s.id, !!(m as MonsterRef).rare);
    const hp = Math.round(statAt(s.base.hp, m.lvl, m.stars) * (m.hpMult || 1)), boss = !!s.boss || !!m.boss; // elite / Starborn zone bosses
    const u: Unit = {
      uid, team, slot, sid: s.id, name: m.awake ? awakeName(s.id, m.name) : m.name || monName(s.id, m.stars, !!(m as MonsterRef).rare), ...(m.awake ? { awake: true } : {}), elem: form.elem, role: s.role, lvl: m.lvl, stars: m.stars, boss, ...(m.scale ? { scale: m.scale } : {}),
      maxHp: hp, hp, atk: Math.round(statAt(s.base.atk, m.lvl, m.stars) * (m.atkMult || 1)), def: statAt(s.base.def, m.lvl, m.stars),
      spd: spdAt(s.base.spd, m.lvl, m.stars), crit: 0.15, critDmg: 0.5, res: boss ? 0.35 : 0.15, acc: 0,
      atb: 0, cds: [0, 0, 0], skills: form.skills.map((k, i) => { const sk = skillAt(k, m.sk?.[i] || 1, i); return k.ult && isMythic(s.id, !!(m as MonsterRef).rare) ? mythicUlt(sk) : sk; }), statuses: [], marks: [], alive: true, leader: team === 0 && slot === 0,
      rare: !!(m as MonsterRef).rare, passives: [s.passive, (m as MonsterRef).rare ? s.rarePassive : undefined].filter((p): p is PassiveDef => !!p),
    };
    const rb = (m as MonsterRef).rb; if (rb) applyRunes(u, rb);
    for (const p of u.passives!) if (p.kind === 'leech') u.leech = (u.leech || 0) + (p.value || 0); // ดูดเลือด stacks with the blood runes
    return u;
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
  effSpd(u: Unit) { return u.spd * (1 + (this.has(u, 'spd_up') ? 0.3 : 0) - (this.has(u, 'spd_down') ? 0.3 : 0) + this.aura(u, 'spd')); }
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
      if ((s.id === 'burn' || s.id === 'poison') && !this.has(a, 'invincible')) {
        const dmg = Math.max(1, Math.round(a.maxHp * (a.boss ? 0.012 : 0.05)));
        a.hp = Math.max(0, a.hp - dmg); ev.push({ t: 'dot', tgt: a.uid, id: s.id, dmg, hp: a.hp }); this.endure(a, ev);
      } else if (s.id === 'regen') this.healBy(a, Math.round(a.maxHp * 0.1), ev);
    }
    for (let i = 0; i < 3; i++) if (a.cds[i] > 0) a.cds[i]--;
    const th = this.pk(a, 'turnHeal');
    if (a.hp > 0 && th) { const w = this.friends(a).filter(f => f.hp < f.maxHp).sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp || x.uid - y.uid)[0];
      if (w) { this.pev(a, th, ev); this.healBy(w, Math.round(w.maxHp * th.value!), ev); } }
    if (a.hp <= 0) { this.kill(a, ev); ev.push(...this.endTurn(a)); ev.push(...this.checkEnd()); return { uid: a.uid, events: ev, skip: true }; }
    const cc = a.statuses.find(s => s.id === 'stun' || s.id === 'sleep' || s.id === 'freeze');
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
  /** silenced units can only use skill 1 */
  canUse(u: Unit, si: number) { return !!u.skills[si] && u.cds[si] === 0 && !(si > 0 && this.has(u, 'silence')); }
  /** a provoked unit must hit its provoker with skill 1 (the command it was given is ignored) */
  forced(u: Unit): Command | null {
    const p = u.statuses.find(x => x.id === 'provoke'), pu = p && this.units.find(x => x.uid === p.value && x.alive && x.team !== u.team);
    return pu ? { si: 0, target: pu.uid } : null;
  }

  act(uid: number, cmd: Command): ActionResult {
    const a = this.get(uid);
    cmd = this.forced(a) || cmd;
    let si = this.canUse(a, cmd.si) ? cmd.si : 0;
    // สับสน: half the time it strikes one of its own team with skill 1 instead (never lethal)
    let confusedAt: Unit | undefined;
    if (this.has(a, 'confuse') && this.rng.chance(0.5)) { const fr = this.friends(a).filter(f => f !== a); if (fr.length) { si = 0; confusedAt = fr[Math.floor(this.rng.next() * fr.length)]; } }
    const sk = a.skills[si];
    this.curSi = si; this.stolen = 0; this.actorCrit = false;
    const perfect = !!cmd.perfect && !!sk.ult;
    a.cds[si] = sk.cd;
    const res: ActionResult = { uid, skillIndex: si, skill: sk, ult: !!sk.ult, perfect, targets: [], impacts: {}, after: [] };
    const imp = (id: number) => (res.impacts[id] ||= []);
    const elem = sk.elem || a.elem;
    const pm = perfect ? 1.15 : 1;

    // targets
    let targets: Unit[];
    if (confusedAt) targets = [confusedAt];
    else if (sk.target === 'enemy') {
      const t = this.foes(a).find(x => x.uid === cmd.target) || this.foes(a)[0];
      targets = t ? [t] : [];
    } else if (sk.target === 'enemyAll') targets = this.foes(a);
    else if (sk.target === 'allyAll') targets = this.friends(a);
    else targets = [a];
    res.targets = targets.map(t => t.uid);

    if (confusedAt) { // the confused blow: skill 1 on a teammate, no effects, no reaction
      const ev = imp(confusedAt.uid); ev.push({ t: 'confused', uid: a.uid });
      if (sk.mult > 0) this.hit(a, confusedAt, sk.mult * pm, elem, ev, { single: true, noKill: true });
      res.after.push(...this.endTurn(a)); res.after.push(...this.checkEnd()); return res;
    }
    let dealt = 0;
    const strike = (t: Unit, mult: number, ev: Ev[], single: boolean) => { // one target: every hit of a ตีรัว skill rolls its effects
      const n = Math.max(1, sk.hits || 1);
      for (let k = 0; k < n && (k === 0 || (t.alive && t.hp > 0)); k++) { // the first hit lands as it always did
        const h = this.hit(a, t, mult / n, elem, ev, { single, ignoreDef: sk.ignoreDef, scale: sk.scale, execute: sk.execute, primary: true });
        dealt += h.dmg; if (h.crit) this.actorCrit = true;
        if (!h.miss) {
          if (k === 0) this.tryReaction(a, t, elem, ev);
          for (const e of sk.effects) if (!e.to || e.to === 'target') this.applyEffect(a, t, e, ev, pm);
        }
      }
      if (t.hp <= 0 && t.alive && !this.endure(t, ev)) this.kill(t, ev);
    };
    if (sk.mult > 0) {
      for (const t of targets) strike(t, sk.mult * pm, imp(t.uid), sk.target === 'enemy');
      if (sk.chain && sk.target === 'enemy' && targets.length) { // สายฟ้ากระโดด: jumps on to other enemies, weaker each time
        let k = 0.7;
        for (let c = 0; c < sk.chain; c++) {
          const nx = this.foes(a).filter(f => !targets.includes(f)).sort((x, y) => x.slot - y.slot || x.uid - y.uid)[0]; if (!nx) break;
          targets.push(nx); res.targets.push(nx.uid); strike(nx, sk.mult * pm * k, imp(nx.uid), false); k *= 0.7;
        }
      }
    }
    for (const e of sk.effects) {
      if (e.kind === 'revive') { this.revive(a, e, imp, pm); continue; }
      if (e.to === 'allies') for (const f of this.friends(a)) this.applyEffect(a, f, e, imp(f.uid), pm);
      else if (e.to === 'self') this.applyEffect(a, a, e, imp(a.uid), pm, dealt);
      else if (e.to === 'enemies') for (const f of this.foes(a)) this.applyEffect(a, f, e, imp(f.uid), pm);
      else if (sk.mult === 0 && (!e.to || e.to === 'target')) for (const t of targets) this.applyEffect(a, t, e, imp(t.uid), pm);
    }
    if (this.stolen > 0) { // stolen turn gauge is shared out to the caster's team
      const fr = this.friends(a), each = Math.round(this.stolen / fr.length);
      if (each > 0) for (const f of fr) { f.atb = Math.min(100, f.atb + each); imp(f.uid).push({ t: 'atb', tgt: f.uid, delta: each, atb: f.atb }); }
    }
    // passives reacting to this action: the struck strike back / curse, a kill grants another turn
    const foesHit = targets.filter(t => t.team !== a.team);
    for (const t of foesHit) {
      if (!t.alive || !a.alive) continue;
      const cp = this.pk(t, 'counter');
      if (cp && this.rng.chance(cp.chance!)) { this.pev(t, cp, res.after); this.hit(t, a, t.skills[0].mult * cp.value!, t.elem, res.after, { single: true }); if (a.hp <= 0 && a.alive && !this.endure(a, res.after)) this.kill(a, res.after); }
      const cu = this.pk(t, 'curseOnHit');
      if (a.alive && cu && this.rng.chance(cu.chance!)) { this.pev(t, cu, res.after); this.addStatus(t, a, cu.status!, 2, 1, res.after, true); }
    }
    const kt = this.pk(a, 'killTurn'), ct = this.pk(a, 'critTurn');
    if (a.alive && kt && foesHit.some(t => !t.alive) && this.foes(a).length) { this.pev(a, kt, res.after); a.atb = 100; res.after.push({ t: 'atb', tgt: a.uid, delta: 100, atb: 100 }); }
    else if (a.alive && ct && this.actorCrit && this.foes(a).length && this.rng.chance(ct.chance ?? 1)) { this.pev(a, ct, res.after); a.atb = 100; res.after.push({ t: 'atb', tgt: a.uid, delta: 100, atb: 100 }); }
    res.after.push(...this.endTurn(a));
    res.after.push(...this.checkEnd());
    return res;
  }

  autoCommand(uid: number): Command {
    const a = this.get(uid);
    const fc = this.forced(a); if (fc) return fc;
    const R = this.aiRng[a.team];
    let si = 0;
    const ready = (i: number) => this.canUse(a, i);
    const healS = (i: number) => a.skills[i].effects.some(e => e.kind === 'heal' || e.kind === 'revive');
    const lowAlly = this.friends(a).some(f => f.hp / f.maxHp < 0.65) || this.units.some(x => x.team === a.team && !x.alive);
    if (ready(2) && (!healS(2) || lowAlly || R.chance(0.4)) && R.chance(0.85)) si = 2;
    else if (ready(1)) { if (healS(1)) { if (lowAlly) si = 1; } else if (R.chance(0.7)) si = 1; }
    const sk = a.skills[si];
    let target = a.uid;
    if (sk.target === 'enemy' || sk.target === 'enemyAll') {
      const fs = this.foes(a);
      const adv = fs.filter(f => elemMult(sk.elem || a.elem, f.elem) > 1);
      const markHit = fs.filter(f => f.marks.some(m => reactionOf(a, m, sk.elem || a.elem)));
      const pick = markHit.length && R.chance(0.8) ? markHit : adv.length && R.chance(0.6) ? adv : fs;
      target = pick.slice().sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp || x.uid - y.uid)[0]?.uid ?? fs[0]?.uid;
    } else if (sk.target === 'allyAll') target = this.friends(a)[0].uid;
    return { si, target };
  }

  // ---------- mechanics ----------
  /** o.scale: พลังตามกาย (HP / DEF / SPD adds to ATK) · o.execute: ประหาร bonus under half HP · o.primary: the action's own
   *  hit (procs ทุบสะท้าน) · o.noKill: leaves at least 1 HP (confused blows) */
  private hit(a: Unit, t: Unit, mult: number, elem: Elem, ev: Ev[], o: { single?: boolean; noCrit?: boolean; trueDmg?: boolean; ignoreDef?: number; scale?: 'hp' | 'def' | 'spd'; execute?: number; primary?: boolean; noKill?: boolean } = {}) {
    if (o.single && this.has(a, 'blind') && this.rng.chance(0.5)) { ev.push({ t: 'hit', src: a.uid, tgt: t.uid, dmg: 0, crit: false, em: 1, miss: true, hp: t.hp }); return { dmg: 0, miss: true }; }
    const evp = o.single && a.team !== t.team ? this.pk(t, 'evade') : undefined; // ร่างเงาลม
    if (evp && this.rng.chance(evp.chance!)) { this.pev(t, evp, ev); ev.push({ t: 'hit', src: a.uid, tgt: t.uid, dmg: 0, crit: false, em: 1, miss: true, hp: t.hp }); return { dmg: 0, miss: true }; }
    if (this.has(t, 'invincible')) { ev.push({ t: 'hit', src: a.uid, tgt: t.uid, dmg: 0, crit: false, em: 1, hp: t.hp, inv: true }); return { dmg: 0, miss: false }; }
    let atk = a.atk * (1 + (this.has(a, 'atk_up') ? 0.3 : 0) - (this.has(a, 'atk_down') ? 0.3 : 0) + this.aura(a, 'atk'));
    if (o.scale === 'hp') atk = atk * 0.5 + a.maxHp * 0.07;
    else if (o.scale === 'def') atk = atk * 0.5 + a.def * 1.3;
    else if (o.scale === 'spd') atk *= 0.55 + this.effSpd(a) / 250;
    const def = o.trueDmg ? 0 : t.def * (this.has(t, 'def_up') ? 1.4 : 1) * (this.has(t, 'def_down') ? 0.5 : 1) * (1 + this.aura(t, 'def')) * (1 - (o.ignoreDef || 0));
    const em = elemMult(elem, t.elem);
    const crit = !o.noCrit && this.rng.chance(Math.min(0.8, a.crit + (this.has(a, 'crit_up') ? 0.2 : 0) + this.aura(a, 'crit')));
    let dmg = mult * atk * 3 * (100 / (100 + def)) * em * (crit ? 1 + a.critDmg : 1) * this.rng.range(0.92, 1.08) * this.rx;
    if (o.execute && t.hp < t.maxHp / 2) dmg *= 1 + o.execute;
    const gp = this.pk(t, 'guard'); if (gp && t.hp > t.maxHp / 2) dmg *= 1 - gp.value!;
    if (this.has(t, 'brand')) dmg *= 1.25;
    const shatter = a.team !== t.team && this.has(t, 'freeze'); if (shatter) dmg *= 1.3; // a frozen target takes +30% and thaws
    dmg = Math.max(1, Math.round(dmg));
    const pr = a.team !== t.team ? t.statuses.find(s => s.id === 'protect') : undefined, pu = pr && this.units.find(x => x.uid === pr.value && x.alive && x !== t);
    if (pu && dmg > 1) { // a protector takes half (it cannot fall to it)
      const share = Math.floor(dmg / 2), inv = this.has(pu, 'invincible'); dmg -= share;
      if (!inv) pu.hp = Math.max(1, pu.hp - share);
      ev.push({ t: 'hit', src: a.uid, tgt: pu.uid, dmg: inv ? 0 : share, crit: false, em: 1, hp: pu.hp, inv: inv || undefined });
    }
    let shieldAbs = 0;
    const sh = t.statuses.find(s => s.id === 'shield');
    if (sh && sh.value) { shieldAbs = Math.min(sh.value, dmg); sh.value -= shieldAbs; if (sh.value <= 0) { t.statuses = t.statuses.filter(s => s !== sh); ev.push({ t: 'status', tgt: t.uid, id: 'shield', add: false }); } }
    const real = dmg - shieldAbs;
    t.hp = Math.max(o.noKill ? Math.min(1, t.hp) : 0, t.hp - real);
    ev.push({ t: 'hit', src: a.uid, tgt: t.uid, dmg, crit, em, hp: t.hp, shieldAbs: shieldAbs || undefined });
    if (a.leech && a.team !== t.team && real > 0 && a.alive && a.hp < a.maxHp && !this.has(a, 'unheal')) this.healBy(a, Math.max(1, Math.round(real * a.leech)), ev); // blood rune set
    if (real > 0 && this.has(t, 'sleep')) { t.statuses = t.statuses.filter(s => s.id !== 'sleep'); ev.push({ t: 'status', tgt: t.uid, id: 'sleep', add: false }); }
    if (shatter) { t.statuses = t.statuses.filter(s => s.id !== 'freeze'); ev.push({ t: 'status', tgt: t.uid, id: 'freeze', add: false }); }
    if (a.team !== t.team) {
      const tp = this.pk(t, 'thorns'); if (tp && real > 0 && a.alive) { const th = Math.round(real * tp.value!); if (th > 0) { a.hp = Math.max(1, a.hp - th); this.pev(t, tp, ev); ev.push({ t: 'hit', src: t.uid, tgt: a.uid, dmg: th, crit: false, em: 1, hp: a.hp }); } }
      const dp = this.pk(a, 'hitAtbDrain'); if (dp && t.hp > 0) { const d = dp.value!; t.atb = Math.max(0, t.atb - d); ev.push({ t: 'atb', tgt: t.uid, delta: -d, atb: t.atb }); }
      const cd = this.pk(a, 'critDebuff'); if (crit && cd && t.hp > 0) { this.pev(a, cd, ev); this.addStatus(a, t, cd.status!, 2, 1, ev, true); }
      const hs = this.pk(a, 'hitStatusAtb'); if (hs && this.has(t, hs.status!) && this.rng.chance(hs.chance!)) { this.pev(a, hs, ev); a.atb = Math.min(100, a.atb + hs.value!); ev.push({ t: 'atb', tgt: a.uid, delta: hs.value!, atb: a.atb }); }
      const bp = this.pk(a, 'bash'); if (bp && o.primary && t.hp > 0 && real > 0 && this.rng.chance(bp.chance!)) { this.pev(a, bp, ev); this.addStatus(a, t, 'stun', 1, 1, ev, true); } // ทุบสะท้าน
    }
    return { dmg: real, miss: false, crit };
  }

  private tryReaction(a: Unit, t: Unit, elem: Elem, ev: Ev[]) {
    const m = t.marks.find(mk => REACT[`${mk.elem}>${elem}`]) || t.marks.find(mk => reactionOf(a, mk, elem));
    if (!m) return;
    const id = reactionOf(a, m, elem)!, wild = !REACT[`${m.elem}>${elem}`]; // a wild eclipse is a lighter one
    t.marks = t.marks.filter(x => x !== m);
    ev.push({ t: 'mark', tgt: t.uid, elem: m.elem, add: false });
    const sub: Ev[] = [];
    this.reactions++;
    if (a.team === 0) { this.myReactions++; this.reactKinds.add(id); }
    if (a.team === 0) this.rx = 1 + (this.mods.react?.[elem] || 0);
    if (a.runeReact) this.rx *= 1 + a.runeReact; // storm rune set
    if (id === 'wildfire') {
      this.hit(a, t, 0.3, 'fire', sub, { noCrit: true });
      for (const f of this.foes(a)) this.addStatus(a, f, 'burn', 2, 1, sub, true);
    } else if (id === 'storm') {
      const chain = [t, ...this.foes(a).filter(f => f !== t)].slice(0, 3);
      for (const c of chain) { if (!c.alive) continue; this.hit(a, c, 0.6, 'wind', sub, { noCrit: true }); this.addStatus(a, c, 'spd_down', 2, 1, sub, true); if (c.hp <= 0 && c.alive && !this.endure(c, sub)) this.kill(c, sub); }
    } else if (id === 'steam') {
      this.hit(a, t, 0.4, 'fire', sub, { noCrit: true }); this.addStatus(a, t, 'blind', 2, 1, sub, true);
    } else if (id === 'lava') {
      this.hit(a, t, 0.4, 'fire', sub, { noCrit: true }); this.addStatus(a, t, 'def_down', 2, 1, sub, true); this.addStatus(a, t, 'burn', 2, 1, sub, true);
    } else if (id === 'eclipse') {
      this.hit(a, t, wild ? 0.6 : 0.9, elem, sub, { noCrit: true, trueDmg: true });
    }
    this.rx = 1;
    ev.push({ t: 'reaction', id, src: a.uid, tgt: t.uid, sub });
  }

  private applyEffect(a: Unit, t: Unit, e: SkillEffect, ev: Ev[], pm: number, dealt = 0) {
    if (!t.alive) return;
    const ch = e.chance ?? 1;
    switch (e.kind) {
      case 'mark':
        if (this.rng.chance(Math.min(1, ch + (a.markUp || 0)))) { t.marks = t.marks.filter(m => m.elem !== e.elem); t.marks.push({ elem: e.elem!, turns: 2, fresh: t === this.actor, wild: (a.rare && LD(e.elem!) && e.elem === a.elem) || undefined }); ev.push({ t: 'mark', tgt: t.uid, elem: e.elem!, add: true }); }
        break;
      case 'status': {
        const id = e.status!, v = id === 'bomb' ? Math.round(a.atk * 3 * (e.value || 1) * pm) : id === 'provoke' || id === 'protect' ? a.uid : undefined;
        if (id === 'protect' && t === a) break; // a protector shields the others
        this.addStatus(a, t, id, e.turns || 2, ch, ev, false, v); break;
      }
      case 'heal': {
        if (this.has(t, 'unheal')) { ev.push({ t: 'resist', tgt: t.uid, id: 'unheal' }); break; }
        const amt = Math.round(t.maxHp * (e.value || 0) * pm), over = t.hp + amt - t.maxHp; t.hp = Math.min(t.maxHp, t.hp + amt); ev.push({ t: 'heal', tgt: t.uid, amt, hp: t.hp });
        const op = this.pk(a, 'overheal'), hc = this.pk(a, 'healCleanse');
        if (over > 0 && op) { const cur = t.statuses.find(x => x.id === 'shield'), add = Math.min(over, Math.round(t.maxHp * op.value!)); if (cur) cur.value = (cur.value || 0) + add; else t.statuses.push({ id: 'shield', turns: 2, value: add, fresh: t === this.actor }); ev.push({ t: 'shield', tgt: t.uid, amt: cur ? cur.value! : add }); }
        if (hc) { const bad = t.statuses.find(x => NEGATIVE.includes(x.id)); if (bad && this.rng.chance(hc.chance!)) { t.statuses = t.statuses.filter(x => x !== bad); ev.push({ t: 'status', tgt: t.uid, id: bad.id, add: false }); ev.push({ t: 'cleanse', tgt: t.uid }); } }
        break;
      }
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
      case 'drain': { const amt = Math.round(dealt * (e.value || 0)); if (amt > 0) this.healBy(t, amt, ev); break; }
      case 'strip': {
        if (ch < 1 && !this.rng.chance(ch)) break;
        const good = t.statuses.filter(x => !NEGATIVE.includes(x.id)).reverse(), take = e.n ? good.slice(0, e.n) : good;
        if (take.length) { t.statuses = t.statuses.filter(x => !take.includes(x)); for (const x of take) ev.push({ t: 'status', tgt: t.uid, id: x.id, add: false }); ev.push({ t: 'strip', tgt: t.uid }); }
        break;
      }
      case 'cdTeam': {
        const d = e.value || 1; let cut = false;
        t.cds = t.cds.map((c, i) => { if ((t === a && i === this.curSi) || t.skills[i]?.ult) return c; const n = Math.max(0, c - d); if (n !== c) cut = true; return n; });
        if (cut) ev.push({ t: 'cd', tgt: t.uid, delta: -d });
        break;
      }
      case 'steal': { const take = Math.min(t.atb, e.value || 0); if (take > 0) { t.atb -= take; this.stolen += take; ev.push({ t: 'atb', tgt: t.uid, delta: -take, atb: t.atb }); } break; }
      case 'assist': { // ร่วมรบ: teammates strike the same target with their skill 1 (it can set off marks)
        if (ch < 1 && !this.rng.chance(ch)) break;
        for (const f of this.friends(a).filter(x => x !== a).sort((x, y) => x.slot - y.slot || x.uid - y.uid).slice(0, e.n || 1)) {
          if (!t.alive || t.hp <= 0) break; const k = f.skills[0], fe = k.elem || f.elem;
          const h = this.hit(f, t, k.mult * (e.value || 0.6), fe, ev, { single: true }); if (!h.miss) this.tryReaction(f, t, fe, ev);
        }
        break;
      }
      case 'dreamEat': { // กินฝันร้าย: every harmful status eaten heals `value` of max HP
        const had = t.statuses.filter(s => NEGATIVE.includes(s.id));
        if (had.length) { t.statuses = t.statuses.filter(s => !NEGATIVE.includes(s.id)); for (const s of had) ev.push({ t: 'status', tgt: t.uid, id: s.id, add: false }); ev.push({ t: 'cleanse', tgt: t.uid }); this.healBy(t, Math.round(t.maxHp * (e.value || 0) * had.length * pm), ev); }
        break;
      }
    }
  }

  private addStatus(a: Unit, t: Unit, id: StatusId, turns: number, chance: number, ev: Ev[], guaranteed: boolean, value?: number) {
    if (!t.alive) return;
    const neg = NEGATIVE.includes(id);
    if (neg && a.team !== t.team && this.has(t, 'immunity')) { ev.push({ t: 'resist', tgt: t.uid, id: 'immunity' }); return; }
    if (neg && t.boss && (id === 'stun' || id === 'sleep' || id === 'freeze' || id === 'confuse')) { ev.push({ t: 'resist', tgt: t.uid, id }); return; }
    if (neg && !guaranteed) {
      const p = chance >= 1 ? 1 : Math.max(0.15, chance - t.res + a.acc);
      if (!this.rng.chance(p)) { if (chance > 0) ev.push({ t: 'resist', tgt: t.uid, id }); return; }
    }
    const de = this.pk(a, 'debuffExtend'); if (neg && a.team !== t.team && de) turns += de.value!;
    const ex = t.statuses.find(s => s.id === id);
    if (ex) { ex.turns = Math.max(ex.turns, turns); if (value != null) ex.value = value; }
    else t.statuses.push({ id, turns, value, fresh: t === this.actor });
    ev.push({ t: 'status', tgt: t.uid, id, add: true, turns });
  }

  private kill(u: Unit, ev: Ev[]) {
    const rv = this.units.find(x => x.team === u.team && (x.alive || x === u) && this.pk(x, 'revive') && !this.spent(x, 'revive'));
    if (rv && this.once(rv, 'revive')) { // a lantern of souls brings the first fallen ally back
      const p = this.pk(rv, 'revive')!; u.statuses = []; u.marks = []; u.hp = Math.round(u.maxHp * p.value!);
      this.pev(rv, p, ev); ev.push({ t: 'cleanse', tgt: u.uid }); ev.push({ t: 'heal', tgt: u.uid, amt: u.hp, hp: u.hp }); return;
    }
    const rb = this.pk(u, 'rebirth');
    if (rb && this.once(u, 'rebirth')) { // เกิดใหม่จากเถ้า: rises again by itself, once
      u.statuses = []; u.marks = []; u.hp = Math.max(1, Math.round(u.maxHp * rb.value!));
      this.pev(u, rb, ev); ev.push({ t: 'cleanse', tgt: u.uid }); ev.push({ t: 'heal', tgt: u.uid, amt: u.hp, hp: u.hp }); return;
    }
    u.alive = false; u.hp = 0; u.statuses = []; u.marks = [];
    if (u.team === 0) this.allyDeaths++;
    ev.push({ t: 'death', uid: u.uid });
    const dg = this.pk(u, 'deathGift'); if (dg) { this.pev(u, dg, ev); for (const f of this.friends(u)) { this.healBy(f, Math.round(f.maxHp * dg.value!), ev); f.atb = Math.min(100, f.atb + 30); ev.push({ t: 'atb', tgt: f.uid, delta: 30, atb: f.atb }); } }
  }

  private endTurn(u: Unit): Ev[] {
    const ev: Ev[] = [];
    if (!u.alive) return ev;
    for (const s of u.statuses.slice()) {
      if (!u.alive) break;
      if (s.fresh) { s.fresh = false; continue; }
      s.turns--;
      if (s.turns <= 0) { u.statuses = u.statuses.filter(x => x !== s); ev.push({ t: 'status', tgt: u.uid, id: s.id, add: false }); if (s.id === 'bomb') this.explode(u, s, ev); }
    }
    if (!u.alive) { this.actor = null; return ev; }
    for (const m of u.marks.slice()) {
      if (m.fresh) { m.fresh = false; continue; }
      m.turns--;
      if (m.turns <= 0) { u.marks = u.marks.filter(x => x !== m); ev.push({ t: 'mark', tgt: u.uid, elem: m.elem, add: false }); }
    }
    this.actor = null;
    return ev;
  }

  /** a shadow bomb runs out: damage (DEF counts) and a 1-turn stun */
  private explode(u: Unit, s: { value?: number }, ev: Ev[]) {
    const dmg = this.has(u, 'invincible') ? 0 : Math.max(1, Math.round((s.value || 0) * 100 / (100 + u.def)));
    u.hp = Math.max(0, u.hp - dmg); ev.push({ t: 'dot', tgt: u.uid, id: 'bomb', dmg, hp: u.hp });
    if (u.hp <= 0) { if (!this.endure(u, ev)) this.kill(u, ev); return; }
    if (!u.boss && !this.has(u, 'immunity')) { u.statuses = u.statuses.filter(x => x.id !== 'stun'); u.statuses.push({ id: 'stun', turns: 1, fresh: false }); ev.push({ t: 'status', tgt: u.uid, id: 'stun', add: true, turns: 1 }); }
  }
  /** heal unless the target is cursed with unheal; returns HP actually restored */
  private healBy(t: Unit, amt: number, ev: Ev[]): number {
    if (this.has(t, 'unheal')) { ev.push({ t: 'resist', tgt: t.uid, id: 'unheal' }); return 0; }
    const h0 = t.hp; t.hp = Math.min(t.maxHp, t.hp + amt); ev.push({ t: 'heal', tgt: t.uid, amt, hp: t.hp }); return t.hp - h0;
  }
  /** fallen allies stand back up (the earliest slots first) */
  private revive(a: Unit, e: SkillEffect, imp: (id: number) => Ev[], pm: number) {
    const dead = this.units.filter(x => x.team === a.team && !x.alive).sort((x, y) => x.slot - y.slot || x.uid - y.uid);
    for (const u of e.n ? dead.slice(0, e.n) : dead) {
      u.alive = true; u.hp = Math.max(1, Math.round(u.maxHp * (e.value || 0.3) * pm)); u.statuses = []; u.marks = []; u.atb = 0;
      imp(u.uid).push({ t: 'revive', tgt: u.uid, hp: u.hp });
    }
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
