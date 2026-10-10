import { bookBonus, bookProgress, type BookEntryDef } from '@shared/index';
import { t } from '../../i18n';
import type { HeroSession } from '../../hero/HeroSession';
import type { SaveData } from '../../save/local';

/** Adventure Book: milestones (kills, cards, spirit dex, maps) with permanent stat rewards to claim. */
const btn = (act: string, label: string, ok = true) => `<button class="mn-btn" data-act="${act}"${ok ? '' : ' disabled'}>${label}</button>`;

export function rewardText(r: Record<string, number>): string {
  return Object.entries(r).map(([k, v]) => `${t(`bonus.${k}`)} +${k === 'speed' || k === 'aspd' ? `${Math.round(v * 100)}%` : v}`).join(' · ');
}

function title(e: BookEntryDef, s: HeroSession): string {
  const c = s.content;
  if (e.kind === 'kill') { const m = c.monsters.find((x) => x.id === e.target[0]); return t('adv.kill').replace('{name}', t(m?.name_key ?? '')).replace('{n}', String(e.count)); }
  if (e.kind === 'card') return t('adv.cards').replace('{n}', String(e.count));
  if (e.kind === 'spirit') return t('adv.dex').replace('{n}', String(e.count));
  return t('adv.map').replace('{name}', t(e.note));
}

export function adventureTab(s: HeroSession, save: SaveData): string {
  const c = s.content, b = s.book;
  const total = rewardText(bookBonus(c, b)) || '—';
  const ready = c.book.filter((e) => !b.claimed[e.id] && bookProgress(e, b, save.seen).have >= e.count).length;
  const row = (e: BookEntryDef) => {
    const p = bookProgress(e, b, save.seen), done = !!b.claimed[e.id], pct = Math.round((100 * p.have) / p.need);
    const act = done ? '<span class="mn-tag">✓</span>' : btn(`bookclaim:${e.id}`, t('adv.claim'), p.have >= p.need);
    return `<div class="mn-row${done ? ' adv-done' : ''}"><span class="grow">${title(e, s)} <small>${p.have}/${p.need} · ${rewardText(e.reward)}</small>
      <span class="adv-bar"><i style="width:${pct}%"></i></span></span>${act}</div>`;
  };
  const section = (kind: BookEntryDef['kind'], head: string) => {
    // ready to claim first, then in progress, then done
    const list = c.book.filter((e) => e.kind === kind)
      .sort((a, z) => Number(!!b.claimed[a.id]) - Number(!!b.claimed[z.id]) || bookProgress(z, b, save.seen).have / z.count - bookProgress(a, b, save.seen).have / a.count);
    return `<div class="mn-h">${head}</div>${list.map(row).join('')}`;
  };
  return `<div class="mn-h">${t('adv.title')}${ready ? ` · <b>${t('adv.ready').replace('{n}', String(ready))}</b>` : ''}</div>
    <div class="mn-note">${t('adv.total')}: ${total}</div>
    ${section('map', t('adv.maps'))}${section('kill', t('adv.monsters'))}${section('card', t('adv.cardsHead'))}${section('spirit', t('adv.dexHead'))}`;
}
