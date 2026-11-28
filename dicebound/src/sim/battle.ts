import type { Content } from '../data/content';
import { changeGold } from './instant';
import { critMultiplier, mod } from './mods';
import { formation, maxHp, tierStats, unitDef } from './team';
import type { EnemyState, GameEvent, RunState, UnitState } from './types';

const PERCENT = 100;

export type RoundOutcome = 'ongoing' | 'enemiesDead' | 'teamDead';

const living = (state: RunState): EnemyState[] => state.enemies.filter((e) => e.hp > 0);

/** Takes HP off an enemy; pays its bounty if that kills it. */
function woundEnemy(content: Content, state: RunState, target: EnemyState, damage: number, events: GameEvent[]): void {
  target.hp = Math.max(0, target.hp - damage);
  if (target.hp > 0) return;
  events.push({ type: 'UnitDied', side: 'enemy', uid: target.uid });
  changeGold(content, state, content.monsters[target.monsterId]?.gold ?? 0, 'kill', events);
}

function hitEnemy(content: Content, state: RunState, source: UnitState, target: EnemyState, raw: number, area: boolean, events: GameEvent[]): void {
  const damage = Math.max(content.rules.minDamage, Math.round(raw) - target.armor);
  events.push({ type: 'UnitAttacked', side: 'team', source: source.uid, target: target.uid, damage, absorbed: 0, area });
  woundEnemy(content, state, target, damage, events);
}

function hitUnit(content: Content, state: RunState, source: EnemyState, target: UnitState, raw: number, area: boolean, events: GameEvent[]): void {
  const armor = tierStats(content, target).armor + mod(content, state, 'teamArmor');
  const damage = Math.max(content.rules.minDamage, Math.round(raw) - armor);
  const absorbed = Math.min(target.shield, damage);
  target.shield -= absorbed;
  target.hp = Math.max(0, target.hp - (damage - absorbed));
  events.push({ type: 'UnitAttacked', side: 'enemy', source: source.uid, target: target.uid, damage: damage - absorbed, absorbed, area });
  if (target.hp === 0) events.push({ type: 'UnitDied', side: 'team', uid: target.uid });
  const thorns = mod(content, state, 'thorns');
  if (thorns > 0 && source.hp > 0) {
    events.push({ type: 'ThornsDamage', source: target.uid, target: source.uid, damage: thorns });
    woundEnemy(content, state, source, thorns, events);
  }
}

function unitActs(content: Content, state: RunState, unit: UnitState, events: GameEvent[]): void {
  const def = unitDef(content, unit);
  const stats = tierStats(content, unit);
  const critMult = state.turnState.crit ? critMultiplier(content, state) : 1;
  const atk = stats.atk * (1 + (mod(content, state, 'teamAtkPct') + state.turnState.teamAtkPct) / PERCENT) * critMult;
  const targets = living(state);
  if (targets.length === 0) return;

  if (def.role === 'healer' && stats.heal !== undefined) {
    const hurt = formation(content, state)
      .map((ally) => ({ ally, missing: maxHp(content, state, ally) - ally.hp, ratio: ally.hp / maxHp(content, state, ally) }))
      .filter((entry) => entry.missing > 0)
      .sort((a, b) => a.ratio - b.ratio || a.ally.uid - b.ally.uid)[0];
    if (hurt) {
      const amount = Math.min(hurt.missing, Math.round(stats.heal * (1 + mod(content, state, 'healPct') / PERCENT)));
      hurt.ally.hp += amount;
      events.push({ type: 'UnitHealed', source: unit.uid, target: hurt.ally.uid, amount });
      return;
    }
  }
  if (def.role === 'aoe') {
    for (const target of targets) hitEnemy(content, state, unit, target, atk * (def.aoeShare ?? 1), true, events);
    return;
  }
  const target = def.role === 'backline' ? targets[targets.length - 1] : targets[0];
  if (target) hitEnemy(content, state, unit, target, atk, false, events);
}

function enemyActs(content: Content, state: RunState, enemy: EnemyState, events: GameEvent[]): void {
  const def = content.monsters[enemy.monsterId];
  if (!def) throw new Error(`unknown monster "${enemy.monsterId}"`);
  const line = formation(content, state);
  if (line.length === 0) return;
  const atk = enemy.atk * (1 + state.turnState.enemyAtkPct / PERCENT);
  enemy.age++;

  if (def.special) {
    if (enemy.windingUp) {
      enemy.windingUp = false;
      events.push({ type: 'BossSpecial', uid: enemy.uid });
      for (const target of line) hitUnit(content, state, enemy, target, atk * def.special.damageMultiplier, true, events);
      return;
    }
    // The round before the special is spent telegraphing it instead of attacking.
    if (enemy.age % def.special.period === def.special.period - 1) {
      enemy.windingUp = true;
      events.push({ type: 'BossWindup', uid: enemy.uid });
      return;
    }
  }
  const target = def.traits.includes('flying') ? line[line.length - 1] : line[0];
  if (!target) return;
  hitUnit(content, state, enemy, target, atk, false, events);
  if (def.stealGold !== undefined) changeGold(content, state, -def.stealGold, 'stolen', events);
}

/** One combat round: the whole team acts front to back, then every surviving enemy. */
export function playRound(content: Content, state: RunState, round: number, events: GameEvent[]): RoundOutcome {
  events.push({ type: 'RoundStarted', round });
  for (const unit of formation(content, state)) {
    if (unit.hp > 0) unitActs(content, state, unit, events);
  }
  if (living(state).length === 0) return 'enemiesDead';
  for (const enemy of living(state)) {
    // Thorns can drop an enemy that was alive when the round's list was made.
    if (enemy.hp > 0) enemyActs(content, state, enemy, events);
  }
  if (living(state).length === 0) return 'enemiesDead';
  if (formation(content, state).length === 0) return 'teamDead';
  return 'ongoing';
}
