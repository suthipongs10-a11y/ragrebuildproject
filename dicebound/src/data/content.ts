import { z } from 'zod';
import boardsJson from './game/boards.json';
import lapsJson from './game/laps.json';
import monstersJson from './game/monsters.json';
import rulesJson from './game/rules.json';
import synergiesJson from './game/synergies.json';
import tilesJson from './game/tiles.json';
import unitsJson from './game/units.json';
import wavesJson from './game/waves.json';
import {
  boardSchema, lapSchema, monsterSchema, rulesSchema, synergySchema, tileSchema, unitSchema, wavePoolSchema,
  type BoardDef, type LapDef, type MonsterDef, type Rules, type SynergyDef, type TileDef, type UnitDef, type WavePoolDef,
} from './gameSchema';

/** Everything the sim needs to know about the game, validated and indexed by id. */
export interface Content {
  rules: Rules;
  units: Record<string, UnitDef>;
  monsters: Record<string, MonsterDef>;
  tiles: Record<string, TileDef>;
  boards: Record<string, BoardDef>;
  synergies: SynergyDef[];
  wavePools: Record<string, WavePoolDef>;
  /** In play order; laps[0] is lap 1. */
  laps: LapDef[];
}

export interface RawContent {
  rules: unknown; units: unknown; monsters: unknown; tiles: unknown;
  boards: unknown; synergies: unknown; waves: unknown; laps: unknown;
}

export class ContentError extends Error {
  constructor(readonly problems: string[]) {
    super(`Invalid game data:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
  }
}

/** Validates shapes, then ids and cross-references. Throws ContentError listing every problem. */
export function parseContent(raw: RawContent): Content {
  const problems: string[] = [];
  const parse = <T>(file: string, schema: z.ZodType<T>, value: unknown, fallback: T): T => {
    const result = schema.safeParse(value);
    if (result.success) return result.data;
    for (const issue of result.error.issues) problems.push(`${file}: ${issue.path.join('.')} ${issue.message}`);
    return fallback;
  };
  const index = <T extends { id: string }>(file: string, list: T[]): Record<string, T> => {
    const out: Record<string, T> = {};
    for (const item of list) {
      if (item.id in out) problems.push(`${file}: duplicate id "${item.id}"`);
      out[item.id] = item;
    }
    return out;
  };

  const rules = parse('rules.json', rulesSchema, raw.rules, null as unknown as Rules);
  const units = index('units.json', parse('units.json', z.array(unitSchema), raw.units, []));
  const monsters = index('monsters.json', parse('monsters.json', z.array(monsterSchema), raw.monsters, []));
  const tiles = index('tiles.json', parse('tiles.json', z.array(tileSchema), raw.tiles, []));
  const boards = index('boards.json', parse('boards.json', z.array(boardSchema), raw.boards, []));
  const synergies = parse('synergies.json', z.array(synergySchema), raw.synergies, []);
  const wavePools = index('waves.json', parse('waves.json', z.array(wavePoolSchema), raw.waves, []));
  const laps = parse('laps.json', z.array(lapSchema), raw.laps, []);
  if (problems.length > 0 || !rules) throw new ContentError(problems);

  const need = (file: string, what: string, table: Record<string, unknown>, ref: string): void => {
    if (!(ref in table)) problems.push(`${file}: unknown ${what} "${ref}"`);
  };
  index('synergies.json', synergies);
  const tierCount = rules.unitXpForTier.length;
  if (rules.upgradeCosts.length !== rules.maxStars - 1) problems.push('rules.json: upgradeCosts needs maxStars - 1 entries');
  if (rules.die.critFace < rules.die.min || rules.die.critFace > rules.die.max) problems.push('rules.json: die.critFace is not a face of the die');
  need('rules.json', 'board', boards, rules.startingBoard);
  for (const unit of rules.startingUnits) need('rules.json', 'unit', units, unit);
  for (const unit of Object.values(units)) {
    if (unit.tiers.length !== tierCount) problems.push(`units.json: ${unit.id} needs ${tierCount} tiers`);
    if (unit.role === 'healer' && unit.tiers.some((t) => t.heal === undefined)) problems.push(`units.json: healer ${unit.id} needs "heal" on every tier`);
    if (unit.role === 'aoe' && unit.aoeShare === undefined) problems.push(`units.json: aoe unit ${unit.id} needs "aoeShare"`);
  }
  for (const monster of Object.values(monsters)) {
    if (monster.traits.includes('thief') && monster.stealGold === undefined) problems.push(`monsters.json: thief ${monster.id} needs "stealGold"`);
  }
  for (const tile of Object.values(tiles)) {
    const effect = tile.effect;
    if ('values' in effect && effect.values.length !== rules.maxStars) problems.push(`tiles.json: ${tile.id} needs ${rules.maxStars} values`);
    if (effect.kind === 'recruit') need('tiles.json', 'unit', units, effect.unit);
  }
  for (const board of Object.values(boards)) {
    for (const tile of board.tiles) need('boards.json', 'tile', tiles, tile);
    if (tiles[board.tiles[0] ?? '']?.type !== 'gate') problems.push(`boards.json: ${board.id} must start on a gate tile`);
    if (board.tiles.filter((t) => tiles[t]?.type === 'gate').length !== 1) problems.push(`boards.json: ${board.id} needs exactly one gate`);
    if (board.tiles.length <= rules.die.max) problems.push(`boards.json: ${board.id} must be longer than the highest die face`);
  }
  for (const synergy of synergies) {
    for (const tile of synergy.tiles) need('synergies.json', 'tile', tiles, tile);
    if (synergy.tiers.length > rules.maxStars - 1) problems.push(`synergies.json: ${synergy.id} has more tiers than star levels allow`);
  }
  for (const pool of Object.values(wavePools)) for (const wave of pool.waves) for (const m of wave) need('waves.json', 'monster', monsters, m);
  laps.forEach((lap, i) => {
    if (lap.lap !== i + 1) problems.push(`laps.json: entry ${i} should be lap ${i + 1}`);
    need('laps.json', 'wave pool', wavePools, lap.wavePool);
    for (const m of lap.gate.monsters) need('laps.json', 'monster', monsters, m);
  });
  if (laps.length === 0) problems.push('laps.json: at least one lap is required');
  if (problems.length > 0) throw new ContentError(problems);
  return { rules, units, monsters, tiles, boards, synergies, wavePools, laps };
}

export const RAW_CONTENT: RawContent = {
  rules: rulesJson, units: unitsJson, monsters: monstersJson, tiles: tilesJson,
  boards: boardsJson, synergies: synergiesJson, waves: wavesJson, laps: lapsJson,
};

export function loadContent(): Content {
  return parseContent(RAW_CONTENT);
}
