import { itemDef, type ContentBundle } from '@shared/index';
import { t } from '../../i18n';

export const rewardItems = (c: ContentBundle, items: Record<string, number>): string =>
  Object.entries(items).map(([id, n]) => `${t(itemDef(c, id)?.name_key ?? id)} ×${n}`).join(', ');
