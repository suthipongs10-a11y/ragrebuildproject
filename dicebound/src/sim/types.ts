import type { RngState } from './rng';

export interface UnitState {
  uid: number;
  unitId: string;
  xp: number;
  /** 1-based. */
  tier: number;
  hp: number;
  /** Absorbs damage before HP; cleared at the end of every turn. */
  shield: number;
}

export interface EnemyState {
  uid: number;
  monsterId: string;
  hp: number;
  maxHp: number;
  atk: number;
  armor: number;
  /** Rounds this enemy has fought; drives the boss special cycle. */
  age: number;
  windingUp: boolean;
}

export interface TileState {
  tileId: string;
  /** 1-based star level. */
  stars: number;
}

/** Modifiers that only last for the turn being played. */
export interface TurnState {
  roll: number | null;
  crit: boolean;
  /** Special die face that came up, if any. */
  face: string | null;
  /** Multiplies what the landed tile gives (a crit and the Twin Face both raise it). */
  tileBoost: number;
  /** The Warp Face lets this roll be replaced by any face for free. */
  warp: boolean;
  teamAtkPct: number;
  enemyAtkPct: number;
  passedGate: boolean;
}

export type Phase = 'roll' | 'decide' | 'shop' | 'upgrade' | 'reward' | 'placeTile' | 'placeFace' | 'ended';

export type RewardOption = { kind: 'tile'; tileId: string } | { kind: 'relic'; relicId: string } | { kind: 'face'; faceId: string };

export interface ShopOffer {
  itemId: string;
  /** Set when the item is a relic crate: the relic inside is shown before buying. */
  relicId: string | null;
  cost: number;
  sold: boolean;
}

/** The whole run. Plain JSON: `JSON.parse(JSON.stringify(state))` is a valid save. */
export interface RunState {
  seed: number;
  rng: RngState;
  leaderId: string;
  relics: string[];
  /** Special face installed on each side of the die (index = pips - 1), or null. */
  dieFaces: Array<string | null>;
  /** Wipes that will not cost a heart (Phoenix Feather). */
  wipeShields: number;
  /** What the current reward / shop / placement phase is offering. */
  rewardOptions: RewardOption[];
  shop: ShopOffer[];
  pendingTile: string | null;
  pendingFace: string | null;
  phase: Phase;
  result: 'won' | 'lost' | null;
  /** 1-based lap being played. */
  lap: number;
  turn: number;
  hearts: number;
  gold: number;
  rerollsLeft: number;
  forceDice: number;
  position: number;
  board: TileState[];
  team: UnitState[];
  enemies: EnemyState[];
  /** Monster ids of the wave after the current one (the NEXT WAVE panel). */
  nextWave: string[];
  /** Synergy id -> active tier (1-based); absent = inactive. */
  synergies: Record<string, number>;
  turnState: TurnState;
  nextUid: number;
}

export type Action =
  | { type: 'roll' }
  | { type: 'move' }
  | { type: 'reroll' }
  | { type: 'forceDie'; face: number }
  | { type: 'warp'; face: number }
  | { type: 'buy'; index: number }
  | { type: 'leaveShop' }
  | { type: 'chooseReward'; index: number }
  | { type: 'placeTile'; index: number }
  | { type: 'placeFace'; face: number }
  | { type: 'upgrade' }
  | { type: 'skipUpgrade' };

export type Side = 'team' | 'enemy';

/** Enough for a view to put the enemy on screen without reading the state. */
export interface SpawnedEnemy {
  uid: number;
  monsterId: string;
  hp: number;
}

export type GameEvent =
  | { type: 'RunStarted'; seed: number }
  | { type: 'DiceRolled'; value: number; crit: boolean; source: 'roll' | 'reroll' | 'forced' | 'warp'; face: string | null }
  | { type: 'ForceDiceChanged'; delta: number; total: number }
  | { type: 'RerollsChanged'; delta: number; total: number }
  | { type: 'FateDrawn'; fateId: string; good: boolean }
  | { type: 'ShopOpened'; offers: ShopOffer[] }
  | { type: 'ItemBought'; index: number; itemId: string }
  | { type: 'RelicGained'; relicId: string }
  | { type: 'RewardOffered'; options: RewardOption[] }
  | { type: 'TilePlaced'; index: number; tileId: string }
  | { type: 'FacePlaced'; face: number; faceId: string }
  | { type: 'WipePrevented'; shieldsLeft: number }
  | { type: 'ThornsDamage'; source: number; target: number; damage: number }
  | { type: 'PawnMoved'; from: number; to: number; steps: number; passedGate: boolean }
  | { type: 'TileLanded'; index: number; tileId: string; stars: number }
  | { type: 'GoldChanged'; delta: number; total: number; reason: 'tile' | 'gamble' | 'kill' | 'stolen' | 'upgrade' | 'shop' | 'interest' | 'effect' }
  | { type: 'UnitRecruited'; uid: number; unitId: string; hp: number }
  | { type: 'UnitXpGained'; uid: number; xp: number }
  | { type: 'UnitTierUp'; uid: number; tier: number }
  | { type: 'TeamHealed'; amounts: Array<{ uid: number; amount: number }> }
  | { type: 'TeamDamaged'; amounts: Array<{ uid: number; amount: number }> }
  | { type: 'BuffApplied'; kind: 'team_atk_pct' | 'team_shield' | 'enemy_atk_pct'; value: number }
  | { type: 'GambleResolved'; won: boolean }
  | { type: 'TileUpgraded'; index: number; stars: number }
  | { type: 'SynergyActivated'; id: string; tier: number }
  | { type: 'WaveSpawned'; enemies: SpawnedEnemy[]; nextWave: string[] }
  | { type: 'GateFightStarted'; kind: 'elite' | 'boss'; enemies: SpawnedEnemy[] }
  | { type: 'RoundStarted'; round: number }
  | { type: 'UnitAttacked'; side: Side; source: number; target: number; damage: number; absorbed: number; area: boolean }
  | { type: 'UnitHealed'; source: number; target: number; amount: number }
  | { type: 'UnitDied'; side: Side; uid: number }
  | { type: 'BossWindup'; uid: number }
  | { type: 'BossSpecial'; uid: number }
  | { type: 'WaveCleared' }
  | { type: 'TeamWiped' }
  | { type: 'HeartLost'; hearts: number }
  | { type: 'TeamRevived' }
  | { type: 'GateFightEnded'; won: boolean }
  | { type: 'LapStarted'; lap: number }
  | { type: 'RunEnded'; result: 'won' | 'lost' };

export interface StepResult {
  state: RunState;
  events: GameEvent[];
}
