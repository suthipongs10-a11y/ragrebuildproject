import type { Content } from '../data/content';
import { applyInstant, changeGold } from './instant';
import { discounted, mod } from './mods';
import type { Rng } from './rng';
import { keepHpShare } from './team';
import type { GameEvent, RewardOption, RunState } from './types';

/** Random pick without replacement. */
function draw<T>(rng: Rng, pool: T[], count: number): T[] {
  const rest = [...pool];
  const out: T[] = [];
  while (out.length < count && rest.length > 0) out.push(...rest.splice(rng.int(0, rest.length - 1), 1));
  return out;
}

const unownedRelics = (content: Content, state: RunState): string[] => Object.keys(content.relics).filter((id) => !state.relics.includes(id));

export function gainRelic(content: Content, state: RunState, relicId: string, events: GameEvent[]): void {
  const relic = content.relics[relicId];
  if (!relic || state.relics.includes(relicId)) return;
  // A relic that raises max HP gives that HP, rather than leaving the team "wounded".
  keepHpShare(content, state, () => state.relics.push(relicId));
  state.wipeShields += relic.wipeShields ?? 0;
  events.push({ type: 'RelicGained', relicId });
  for (const instant of relic.onPickup ?? []) applyInstant(content, state, instant, 'effect', events);
}

/** A fate card: good or bad, weighted by the deck's stars and the player's luck. */
export function drawFate(content: Content, state: RunState, rng: Rng, stars: number, events: GameEvent[]): void {
  const chance = (content.rules.fateGoodChanceByStars[stars - 1] ?? 0) + mod(content, state, 'luckPct');
  const good = rng.next() * 100 < chance;
  const pool = content.fates.filter((fate) => fate.good === good);
  const fate = pool[rng.int(0, pool.length - 1)];
  if (!fate) return;
  events.push({ type: 'FateDrawn', fateId: fate.id, good });
  applyInstant(content, state, fate.instant, 'effect', events);
}

export function openShop(content: Content, state: RunState, rng: Rng, stars: number, events: GameEvent[]): void {
  const discount = (content.rules.shopDiscountByStars[stars - 1] ?? 0) + mod(content, state, 'shopDiscountPct');
  const relicPool = unownedRelics(content, state);
  const items = Object.values(content.shopItems).filter((item) => item.effect.kind !== 'relic' || relicPool.length > 0);
  state.shop = draw(rng, items, content.rules.shopOffers).map((item) => ({
    itemId: item.id,
    relicId: item.effect.kind === 'relic' ? (relicPool[rng.int(0, relicPool.length - 1)] ?? null) : null,
    cost: discounted(content, item.cost, discount),
    sold: false,
  }));
  events.push({ type: 'ShopOpened', offers: structuredClone(state.shop) });
}

export function canBuy(state: RunState, index: number): boolean {
  const offer = state.shop[index];
  return offer !== undefined && !offer.sold && state.gold >= offer.cost;
}

export function buy(content: Content, state: RunState, index: number, events: GameEvent[]): void {
  const offer = state.shop[index];
  const item = offer ? content.shopItems[offer.itemId] : undefined;
  if (!offer || !item || !canBuy(state, index)) throw new Error('that item cannot be bought');
  changeGold(content, state, -offer.cost, 'shop', events);
  offer.sold = true;
  events.push({ type: 'ItemBought', index, itemId: item.id });
  if (item.effect.kind === 'instant') applyInstant(content, state, item.effect.instant, 'effect', events);
  else if (offer.relicId) gainRelic(content, state, offer.relicId, events);
}

/** After a gate is won: one new tile, one relic and one special die face to choose from. */
export function offerReward(content: Content, state: RunState, rng: Rng, events: GameEvent[]): void {
  const pick = <T>(pool: T[]): T | undefined => pool[rng.int(0, Math.max(0, pool.length - 1))];
  const options: RewardOption[] = [];
  const tile = pick(Object.values(content.tiles).filter((t) => t.reward));
  if (tile) options.push({ kind: 'tile', tileId: tile.id });
  const relicId = pick(unownedRelics(content, state));
  if (relicId) options.push({ kind: 'relic', relicId });
  const face = pick(Object.values(content.faces));
  if (face) options.push({ kind: 'face', faceId: face.id });
  state.rewardOptions = options.slice(0, content.rules.rewardOptions);
  if (state.rewardOptions.length === 0) return;
  state.phase = 'reward';
  events.push({ type: 'RewardOffered', options: structuredClone(state.rewardOptions) });
}
