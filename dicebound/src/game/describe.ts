import { t } from '../app/i18n';
import type { Content } from '../data/content';
import type { TileState } from '../sim/types';

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
  return t(`effect.${effect.kind}`, { value });
}
