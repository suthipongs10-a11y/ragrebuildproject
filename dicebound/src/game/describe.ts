import { t } from '../app/i18n';
import type { Content } from '../data/content';
import type { Instant, Mods } from '../data/gameSchema';
import { upgradeCost } from '../sim/board';
import type { RunState, TileState } from '../sim/types';

export const stars = (count: number): string => '★'.repeat(count);

export function tileName(tile: TileState): string {
  return t(`tile.${tile.tileId}.name`);
}

/** What a tile does at a given star level, in words. */
export function tileEffectText(content: Content, tile: TileState, starLevel: number = tile.stars): string {
  const effect = content.tiles[tile.tileId]?.effect;
  if (!effect || effect.kind === 'none') return t('effect.none');
  const value = effect.values[starLevel - 1] ?? 0;
  if (effect.kind === 'recruit') return t('effect.recruit', { unit: t(`unit.${effect.unit}.name`), value });
  if (effect.kind === 'gamble') return t('effect.gamble', { value, lose: effect.loseGold });
  if (effect.kind === 'shop') return t('effect.shop', { value: content.rules.shopDiscountByStars[starLevel - 1] ?? 0 });
  if (effect.kind === 'fate') return t('effect.fate', { value: content.rules.fateGoodChanceByStars[starLevel - 1] ?? 0 });
  return t(`effect.${effect.kind}`, { value });
}

/** Tooltip for any tile on the board: what it does now and what an upgrade would buy. */
export function tileHoverText(content: Content, state: RunState, index: number): string {
  const tile = state.board[index];
  if (!tile) return '';
  const def = content.tiles[tile.tileId];
  const cost = upgradeCost(content, { ...state, position: index });
  const upgrade = def?.upgradable && cost !== null ? t('info.hover_upgrade', { cost, after: tileEffectText(content, tile, tile.stars + 1) }) : '';
  return t('info.hover', { tile: tileName(tile), stars: stars(tile.stars), effect: tileEffectText(content, tile), upgrade });
}

export function instantText(instant: Instant): string {
  const sign = instant.kind === 'gold' && instant.value > 0 ? '+' : '';
  return t(`instant.${instant.kind}`, { v: `${sign}${instant.value}` });
}

export function modsText(mods: Mods): string[] {
  return Object.entries(mods).map(([key, raw]) => {
    const value = raw ?? 0;
    return t(`mod.${key}`, { v: key === 'enemyHpPct' && value > 0 ? `+${value}` : value });
  });
}

export function relicText(content: Content, relicId: string): string {
  const relic = content.relics[relicId];
  if (!relic) return '';
  const lines = [...modsText(relic.mods), ...(relic.onPickup ?? []).map(instantText)];
  if (relic.wipeShields) lines.push(t('mod.wipeShield'));
  return lines.join('\n');
}

export function shopItemText(content: Content, itemId: string, relicId: string | null): { name: string; body: string } {
  const item = content.shopItems[itemId];
  if (item?.effect.kind === 'relic' && relicId) return { name: t(`relic.${relicId}.name`), body: relicText(content, relicId) };
  return { name: t(`shop.${itemId}.name`), body: item?.effect.kind === 'instant' ? instantText(item.effect.instant) : '' };
}
