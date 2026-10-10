import { isUnlocked, unlockLevel } from '@shared/index';
import { t } from '../../i18n';
import type { HeroSession } from '../../hero/HeroSession';

/** Level gate (unlocks.csv): null when open, else "🔒 <name> เปิดที่ Lv N". */
export function lockMsg(s: HeroSession, feature: string): string | null {
  const c = s.content;
  if (isUnlocked(c, feature, s.data.baseLv)) return null;
  const name = t(c.unlocks.find((u) => u.feature === feature)?.name_key ?? feature);
  return t('lock.msg').replace('{name}', name).replace('{lv}', String(unlockLevel(c, feature)));
}

/** Whole-tab placeholder for a locked feature. */
export const lockedBody = (msg: string): string => `<div class="mn-h">${t('lock.title')}</div><div class="mn-row"><span class="mn-icon">🔒</span><span class="grow">${msg}</span></div>`;
