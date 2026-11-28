import { z } from 'zod';

const id = z.string().regex(/^[a-z][a-z0-9_]*$/, 'ids are snake_case');
const pct = z.number().nonnegative();

export const rulesSchema = z.object({
  hearts: z.number().int().positive(),
  teamMax: z.number().int().positive(),
  die: z.object({
    min: z.number().int(),
    max: z.number().int(),
    critFace: z.number().int(),
    critMultiplier: z.number().positive(),
    forcedDieCanCrit: z.boolean(),
  }),
  rerollsPerLap: z.number().int().nonnegative(),
  startForceDice: z.number().int().nonnegative(),
  forceDicePerGateWon: z.number().int().nonnegative(),
  startGold: z.number().int().nonnegative(),
  battleRoundsPerTurn: z.number().int().positive(),
  gateMaxRounds: z.number().int().positive(),
  maxStars: z.number().int().positive(),
  /** Cost to go from star n to n+1; length = maxStars - 1. */
  upgradeCosts: z.array(z.number().int().positive()),
  /** XP a unit needs to be at tier n+1; length = number of tiers. */
  unitXpForTier: z.array(z.number().int().nonnegative()),
  minDamage: z.number().int().nonnegative(),
  startingBoard: id,
  startingUnits: z.array(id),
});

const unitTier = z.object({ hp: z.number().positive(), atk: z.number().nonnegative(), armor: z.number().nonnegative(), heal: z.number().positive().optional() });
export const unitSchema = z.object({
  id,
  /** Asset id prefix: frames are `<sprite>_t<tier>_<pose>`. */
  sprite: id,
  /** Formation slot: lower rows stand in front and get hit first. */
  row: z.number().int().nonnegative(),
  role: z.enum(['melee', 'backline', 'aoe', 'healer']),
  aoeShare: z.number().positive().max(1).optional(),
  tiers: z.array(unitTier).min(1),
});

export const monsterSchema = z.object({
  id,
  /** Asset id prefix: frames are `<sprite>_<pose>`. */
  sprite: id,
  act: z.number().int().positive(),
  hp: z.number().positive(),
  atk: z.number().nonnegative(),
  armor: z.number().nonnegative(),
  gold: z.number().int().nonnegative(),
  traits: z.array(z.enum(['flying', 'thief', 'elite', 'boss'])),
  stealGold: z.number().int().positive().optional(),
  /** Bosses telegraph for one round, then hit the whole team. */
  special: z.object({ period: z.number().int().min(2), damageMultiplier: z.number().positive() }).optional(),
});

const values = z.array(z.number().nonnegative());
export const tileEffectSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('none') }),
  z.object({ kind: z.literal('recruit'), unit: id, values }),
  z.object({ kind: z.literal('team_atk_pct'), values }),
  z.object({ kind: z.literal('team_shield'), values }),
  z.object({ kind: z.literal('gold'), values }),
  z.object({ kind: z.literal('heal_pct'), values }),
  z.object({ kind: z.literal('damage_pct'), values }),
  z.object({ kind: z.literal('enemy_atk_pct'), values }),
  z.object({ kind: z.literal('gamble'), winChance: z.number().min(0).max(1), values, loseGold: z.number().int().nonnegative() }),
]);
export const tileSchema = z.object({
  id,
  /** Asset id of the tile picture (assets/manifest.json). */
  icon: id,
  type: z.enum(['gate', 'recruit', 'buff', 'economy', 'heal', 'risk']),
  upgradable: z.boolean(),
  effect: tileEffectSchema,
});

export const boardSchema = z.object({ id, tiles: z.array(id).min(2) });

export const synergySchema = z.object({
  id,
  icon: id,
  tiles: z.tuple([id, id]),
  /** tiers[0] needs both tiles at 2 stars, tiers[1] at 3 stars, and so on. */
  tiers: z.array(z.object({ teamAtkPct: pct.optional(), teamHpPct: pct.optional(), healPct: pct.optional(), goldPct: pct.optional() })).min(1),
});

export const wavePoolSchema = z.object({ id, waves: z.array(z.array(id).min(1)).min(1) });

export const lapSchema = z.object({
  lap: z.number().int().positive(),
  act: z.number().int().positive(),
  wavePool: id,
  /** Multiplies enemy HP and attack: the sawtooth difficulty curve (CLAUDE.md §5). */
  enemyScale: z.number().positive(),
  gate: z.object({ kind: z.enum(['elite', 'boss']), monsters: z.array(id).min(1) }),
});

export type Rules = z.infer<typeof rulesSchema>;
export type UnitDef = z.infer<typeof unitSchema>;
export type MonsterDef = z.infer<typeof monsterSchema>;
export type TileDef = z.infer<typeof tileSchema>;
export type TileEffect = z.infer<typeof tileEffectSchema>;
export type BoardDef = z.infer<typeof boardSchema>;
export type SynergyDef = z.infer<typeof synergySchema>;
export type WavePoolDef = z.infer<typeof wavePoolSchema>;
export type LapDef = z.infer<typeof lapSchema>;
