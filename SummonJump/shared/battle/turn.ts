import type { ContentBundle } from '../content/types';
import { elementMultiplier } from '../formulas/elements';
import { createRng, type Rng } from '../rng';
import type { WaveSpawn } from '../rules/arena';
import type { RuneInst, SpiritInst } from '../spirits/model';
import { leaderEffects, monsterUnit, spiritUnit, tbc, type TbSkill, type TbUnit } from './units';

/**
 * SW-style turn battle: attack bars fill with SPD, the fullest unit acts. Spirits (left) vs monster waves (right).
 * Pure + seeded: the same team, waves and seed give the same fight (server re-sim later).
 * Flow: `nextTurn` → (player or `autoChoice`) → `act` → … until `b.result`.
 */
export const MAX_ENEMIES = 5;

export interface Battle {
  c: ContentBundle; rng: Rng; units: TbUnit[]; waves: WaveSpawn[][]; wave: number;
  active: TbUnit | null; result: 'win' | 'lose' | null; turnNo: number; summons: number;
  /** EXP of the monsters beaten (shared by the team on a win) */
  exp: number;
}

export type TbEvent =
  | { kind: 'turn'; unit: string } | { kind: 'stunned'; unit: string }
  | { kind: 'cast'; unit: string; skill: TbSkill; targets: string[] }
  | { kind: 'hit'; src: string; dst: string; amount: number; crit: boolean; mult: number; absorbed: number }
  | { kind: 'heal'; dst: string; amount: number } | { kind: 'shield'; dst: string; amount: number }
  | { kind: 'status'; dst: string; status: 'stun' | 'defdown' }
  | { kind: 'die'; unit: string } | { kind: 'phase'; unit: string } | { kind: 'summon'; unit: string }
  | { kind: 'wave'; n: number; max: number } | { kind: 'end'; result: 'win' | 'lose' };

/** Waves bigger than the field are split (tower floors list up to 7 monsters). */
export function splitWaves(waves: WaveSpawn[][]): WaveSpawn[][] {
  return waves.flatMap((w) => {
    if (w.length <= MAX_ENEMIES) return [w];
    const n = Math.ceil(w.length / 4), size = Math.ceil(w.length / n);
    return Array.from({ length: n }, (_, i) => w.slice(i * size, (i + 1) * size));
  });
}

export interface TeamMember { s: SpiritInst; runes: readonly RuneInst[] }

export function createBattle(c: ContentBundle, team: TeamMember[], waves: WaveSpawn[][], seed: number): Battle {
  const lead = leaderEffects(c, team[0]?.s);
  const b: Battle = { c, rng: createRng(seed), units: team.map((m, i) => spiritUnit(c, m.s, m.runes, i, lead)), waves: splitWaves(waves), wave: -1, active: null, result: null, turnNo: 0, summons: 0, exp: 0 };
  spawnWave(b);
  return b;
}

export const alive = (b: Battle, side: TbUnit['side']): TbUnit[] => b.units.filter((u) => u.side === side && !u.dead);
export const unitOf = (b: Battle, key: string): TbUnit | undefined => b.units.find((u) => u.key === key);

function spawnWave(b: Battle): TbEvent[] {
  b.wave++;
  b.units = b.units.filter((u) => u.side === 'ally');
  const list = b.waves[b.wave] ?? [];
  list.forEach((w, i) => { const m = b.c.monsters.find((x) => x.id === w.id); if (m) b.units.push(monsterUnit(b.c, m, w.scale, i, `e${b.wave}_${i}`)); });
  // a fresh wave starts with a little random bar so the order isn't always the same
  for (const u of b.units) if (u.side === 'enemy') u.bar = b.rng.range(0, 20);
  return [{ kind: 'wave', n: b.wave + 1, max: b.waves.length }];
}

/** Time until each bar is full, then move every bar by that much (exact, no tiny ticks). */
function fillBars(units: TbUnit[]): TbUnit {
  let next = units[0] as TbUnit, best = Infinity;
  for (const u of units) {
    const t = (100 - u.bar) / Math.max(1, u.spd);
    // ties: allies first, then the lower slot
    if (t < best - 1e-9 || (Math.abs(t - best) <= 1e-9 && (u.side === 'ally' && next.side === 'enemy'))) { best = t; next = u; }
  }
  const dt = Math.max(0, best);
  for (const u of units) u.bar += u.spd * dt;
  return next;
}

/** Who acts next (n turns ahead), without changing the battle — for the turn-order strip. */
export function turnOrder(b: Battle, n: number): string[] {
  const sim = b.units.filter((u) => !u.dead).map((u) => ({ ...u }));
  const out: string[] = [];
  for (let i = 0; i < n && sim.length; i++) { const u = fillBars(sim); out.push(u.key); u.bar = 0; }
  return out;
}

/** Advance to the next unit that can act; stunned units lose their turn. */
export function nextTurn(b: Battle): TbEvent[] {
  const ev: TbEvent[] = [];
  for (let guard = 0; guard < 50 && !b.result; guard++) {
    const u = fillBars(b.units.filter((x) => !x.dead));
    u.bar = 0; u.turns++; b.turnNo++;
    for (let i = 0; i < u.cd.length; i++) u.cd[i] = Math.max(0, (u.cd[i] ?? 0) - 1);
    if (u.defDownT > 0 && --u.defDownT === 0) u.defDown = 0;
    if (u.shieldT > 0 && --u.shieldT === 0) u.shield = 0;
    if (u.stun > 0) { u.stun--; ev.push({ kind: 'stunned', unit: u.key }); continue; }
    b.active = u;
    ev.push({ kind: 'turn', unit: u.key });
    return ev;
  }
  return ev;
}

/** Skill usable now? */
export const ready = (u: TbUnit, i: number): boolean => !!u.skills[i] && (u.cd[i] ?? 0) <= 0;

function damage(b: Battle, src: TbUnit, dst: TbUnit, sk: TbSkill): TbEvent {
  const mult = elementMultiplier(src.el, dst.el);
  const crit = b.rng.chance(Math.min(100, src.crit + sk.crit) / 100);
  const def = dst.def * (1 - dst.defDown) * (sk.pierce ? 0.7 : 1);
  let amount = Math.max(1, Math.round(src.atk * sk.power * (crit ? 1 + src.critDmg / 100 : 1) * mult * (1000 / (1140 + 3.5 * def)) * b.rng.range(0.95, 1.05)));
  const absorbed = Math.min(dst.shield, amount);
  dst.shield -= absorbed; amount -= absorbed;
  dst.hp = Math.max(0, dst.hp - amount);
  if (src.lifesteal > 0) src.hp = Math.min(src.maxHp, src.hp + Math.round((amount + absorbed) * src.lifesteal / 100));
  return { kind: 'hit', src: src.key, dst: dst.key, amount, crit, mult, absorbed };
}

/** Use skill `i` of the active unit on `target` (an enemy of it; ignored for whole-team skills). */
export function act(b: Battle, i: number, target: string | null): TbEvent[] {
  const u = b.active;
  if (!u || b.result || !ready(u, i)) return [];
  const sk = u.skills[i] as TbSkill, foes = alive(b, u.side === 'ally' ? 'enemy' : 'ally'), friends = alive(b, u.side);
  const picked = foes.find((f) => f.key === target) ?? foes[0];
  if (!picked) return [];
  const targets = sk.target === 'all' ? foes : [picked];
  const ev: TbEvent[] = [{ kind: 'cast', unit: u.key, skill: sk, targets: targets.map((x) => x.key) }];
  u.cd[i] = sk.cd; // ticks down at the start of each of this unit's turns: cd 4 = usable every 4th turn
  for (const d of targets) {
    ev.push(damage(b, u, d, sk));
    if (d.hp > 0 && sk.stun > 0 && b.rng.chance(d.boss ? sk.stun * 0.3 : sk.stun)) { d.stun = 1; ev.push({ kind: 'status', dst: d.key, status: 'stun' }); }
    if (d.hp > 0 && sk.defDown > 0) { d.defDown = Math.max(d.defDown, sk.defDown); d.defDownT = 3; ev.push({ kind: 'status', dst: d.key, status: 'defdown' }); }
  }
  const helped = sk.kind === 'ult' ? friends : friends.length ? [friends.reduce((a, x) => (x.hp / x.maxHp < a.hp / a.maxHp ? x : a))] : [];
  for (const f of helped) {
    if (sk.heal > 0) { const n = Math.min(f.maxHp - f.hp, Math.round(f.maxHp * sk.heal)); f.hp += n; ev.push({ kind: 'heal', dst: f.key, amount: n }); }
    if (sk.shield > 0) { f.shield = Math.max(f.shield, Math.round(f.maxHp * sk.shield)); f.shieldT = 3; ev.push({ kind: 'shield', dst: f.key, amount: f.shield }); }
  }
  b.active = null;
  return [...ev, ...afterAction(b, u)];
}

/** Deaths, boss rage + minions, next wave, win / lose. */
function afterAction(b: Battle, u: TbUnit): TbEvent[] {
  const ev: TbEvent[] = [];
  for (const x of b.units) if (!x.dead && x.hp <= 0) { x.dead = true; ev.push({ kind: 'die', unit: x.key }); if (x.side === 'enemy') b.exp += x.exp; }
  for (const x of alive(b, 'enemy')) {
    if (!x.boss) continue;
    if (x.phase === 1 && x.hp < x.maxHp / 2) { x.phase = 2; x.spd = Math.round(x.spd * tbc(b.c, 'boss_rage', 1.3)); ev.push({ kind: 'phase', unit: x.key }); ev.push(...callMinion(b, x)); }
    else if (x === u && x.phase === 2 && x.turns % 3 === 0) ev.push(...callMinion(b, x));
  }
  if (!alive(b, 'ally').length) { b.result = 'lose'; ev.push({ kind: 'end', result: 'lose' }); }
  else if (!alive(b, 'enemy').length) {
    if (b.wave + 1 < b.waves.length) ev.push(...spawnWave(b));
    else { b.result = 'win'; ev.push({ kind: 'end', result: 'win' }); }
  }
  return ev;
}

function callMinion(b: Battle, boss: TbUnit): TbEvent[] {
  const m = boss.minion ? b.c.monsters.find((x) => x.id === boss.minion) : undefined;
  const used = new Set(alive(b, 'enemy').map((x) => x.slot));
  const slot = [0, 1, 2, 3, 4].find((s) => !used.has(s));
  if (!m || slot === undefined) return [];
  const unit = monsterUnit(b.c, m, 1, slot, `e${b.wave}_s${b.summons++}`);
  unit.exp = 0; // called minions give nothing (same rule as the field)
  b.units = b.units.filter((x) => !(x.dead && x.side === 'enemy' && x.slot === slot));
  b.units.push(unit);
  return [{ kind: 'summon', unit: unit.key }];
}

/**
 * AUTO / monster brain: ultimate or boss skill when ready (allies: always; it's what SW auto does), else skill 1.
 * Allies hit the foe they beat on element first, then the weakest; monsters pick the weakest half the time.
 */
export function autoChoice(b: Battle, u: TbUnit): { skill: number; target: string | null } {
  const foes = alive(b, u.side === 'ally' ? 'enemy' : 'ally');
  const skill = u.skills.length > 1 && ready(u, 1) ? 1 : 0;
  if (!foes.length) return { skill, target: null };
  const frac = (x: TbUnit) => x.hp / x.maxHp;
  let t: TbUnit;
  if (u.side === 'enemy') t = b.rng.chance(0.5) ? foes.reduce((a, x) => (frac(x) < frac(a) ? x : a)) : (foes[Math.floor(b.rng.next() * foes.length) % foes.length] as TbUnit);
  else t = foes.reduce((a, x) => (score(u, x) > score(u, a) ? x : a));
  return { skill, target: t.key };
}
const score = (u: TbUnit, x: TbUnit) => elementMultiplier(u.el, x.el) * 2 - x.hp / x.maxHp + (x.boss ? -0.3 : 0);

/** Play a whole battle on AUTO (tests, balance). */
export function autoBattle(b: Battle, maxTurns = 600): Battle {
  for (let i = 0; i < maxTurns && !b.result; i++) {
    nextTurn(b);
    const u = b.active;
    if (!u) continue;
    const ch = autoChoice(b, u);
    act(b, ch.skill, ch.target);
  }
  return b;
}
