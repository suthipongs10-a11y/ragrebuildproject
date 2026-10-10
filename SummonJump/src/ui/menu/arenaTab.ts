import { dailyLeft, dayKey, dungeonOf, itemDef, DAILY_ENTRIES, type ArenaState } from '@shared/index';
import { t } from '../../i18n';
import type { HeroSession } from '../../hero/HeroSession';
import { rewardItems } from './arenaText';
import { lockMsg } from './lock';

/** Portal NPC: today's elemental dungeon (3 entries a day) and the tower (floors 1–20). */
const btn = (act: string, label: string, ok = true, sec = false) => `<button class="mn-btn${sec ? ' sec' : ''}" data-act="${act}"${ok ? '' : ' disabled'}>${label}</button>`;

export function arenaTab(s: HeroSession, a: ArenaState): string {
  const c = s.content, now = new Date(), day = dungeonOf(c, now.getDay()), left = dailyLeft(a, dayKey(now));
  const el = day?.element ?? 'neutral';
  const ess = t(itemDef(c, day?.essence ?? '')?.name_key ?? '');
  const dungeon = `<div class="mn-h">🌀 ${t('arena.dungeon')} · ${t(`day.${now.getDay()}`)}</div>
    <div class="mn-row"><span class="grow">${t('arena.todayEl').replace('{el}', t(`el.${el}`))}<small>${t('arena.dungeonInfo').replace('{ess}', ess)} · ${t('arena.left').replace('{n}', String(left)).replace('{max}', String(DAILY_ENTRIES))}</small></span>
    ${lockMsg(s, 'dungeon') ? `<small>${lockMsg(s, 'dungeon')}</small>` : btn('arena:dungeon', t('arena.enter'), left > 0)}</div>`;
  const towerLock = lockMsg(s, 'tower');
  if (towerLock) return `${dungeon}<div class="mn-h">🗼 ${t('arena.tower')}</div><div class="mn-row"><span class="mn-icon">🔒</span><span class="grow">${towerLock}</span></div>`;
  const next = Math.min(a.tower + 1, c.tower.length);
  const floors = c.tower.map((f) => {
    const done = f.floor <= a.tower, open = f.floor <= next;
    if (f.floor > next + 2) return '';
    const mons = f.monsters.map((m) => `${t(c.monsters.find((x) => x.id === m.id)?.name_key ?? '')}${m.n > 1 ? ` ×${m.n}` : ''}`).join(', ');
    return `<div class="mn-row${done ? ' adv-done' : ''}"><span class="mn-icon">${f.floor % 5 === 0 ? '👑' : f.floor}</span><span class="grow">${t('arena.floor').replace('{n}', String(f.floor))}${done ? ' ✓' : ''}
      <small>${mons}${done ? '' : ` · ${t('arena.firstClear')}: ${rewardItems(c, f.reward)} · ${f.zeny}z`}</small></span>${btn(`arena:tower:${f.floor}`, done ? t('arena.replay') : t('arena.enter'), open, done)}</div>`;
  }).join('');
  return `${dungeon}<div class="mn-h">🗼 ${t('arena.tower')} · ${t('arena.best').replace('{n}', String(a.tower)).replace('{max}', String(c.tower.length))}</div>${floors}`;
}
