import './battle.css';
import { battleSize, battleTeam, elementMultiplier, familyOf, leadBattle, sskillOf, toggleBattle, type Element } from '@shared/index';
import type { HeroSession } from '../hero/HeroSession';
import { portraitHtml } from '../spirits/art';
import { ART } from '../assets/manifest.generated';
import { t } from '../i18n';

/** DOM panels of the turn battle: the team picker before the fight and the result after it. */
export interface Foe { name: string; el: Element; boss: boolean; n: number }

function panel(): HTMLElement {
  const root = document.createElement('div');
  root.className = 'menu-root tb-panel';
  (document.getElementById('stage') ?? document.body).appendChild(root);
  return root;
}

const stars = (n: number) => '★'.repeat(n);

/** Team picker. Saves the choice in the spirit box (`battle`). Returns a close function. */
export function showPrep(s: HeroSession, busy: readonly number[], title: string, foes: Foe[], onStart: () => void, onLeave: () => void): () => void {
  const root = panel(), c = s.content, b = s.box;
  const render = () => {
    const team = battleTeam(b, c, busy), max = battleSize(c);
    const lead = team[0], leadSk = lead && sskillOf(c, familyOf(c, lead.id)?.leader ?? '');
    const beats = (el: Element) => foes.some((f) => elementMultiplier(el, f.el) > 1);
    const slots = Array.from({ length: max }, (_, i) => {
      const sp = team[i];
      if (!sp) return `<div class="tb-slot empty">${t('tb.emptySlot')}</div>`;
      return `<div class="tb-slot${i === 0 ? ' lead' : ''}">${portraitHtml(c, sp, 52)}<b>${t(familyOf(c, sp.id)?.name_key ?? sp.id)}</b><span>${stars(sp.star)} Lv${sp.lv}</span>
        ${i === 0 ? `<span>👑 ${t('tb.leader')}</span>` : `<button class="mn-btn sec" data-tb="lead:${sp.uid}">👑</button>`}<button class="mn-btn sec" data-tb="out:${sp.uid}">✕</button></div>`;
    }).join('');
    const box = [...b.spirits].sort((x, y) => y.star - x.star || y.lv - x.lv).map((sp) => {
      const on = team.some((m) => m.uid === sp.uid), away = busy.includes(sp.uid);
      return `<button class="tb-pick${on ? ' on' : ''}" data-tb="tog:${sp.uid}"${away ? ' disabled' : ''}>${portraitHtml(c, sp, 44)}<span>${stars(sp.star)} Lv${sp.lv}</span>${away ? `<span>${t('tb.busy')}</span>` : beats(sp.el) ? `<span class="adv">${t('tb.adv')}</span>` : ''}</button>`;
    }).join('');
    root.innerHTML = `<div class="mn"><div class="mn-body">
      <div class="mn-h">${title}</div>
      <div class="tb-foes">${foes.map((f) => `<span class="tb-foe">${f.boss ? '👑 ' : ''}${f.name}${f.n > 1 ? ` ×${f.n}` : ''} · ${t(`el.${f.el}`)}</span>`).join('')}</div>
      <div class="mn-h">${t('tb.team').replace('{n}', String(team.length)).replace('{max}', String(max))}${leadSk ? ` <small>👑 ${t(leadSk.name_key)}</small>` : ''}</div>
      <div class="tb-team">${slots}</div>
      <div class="mn-h">${t('tb.box')}</div><div class="tb-box">${box}</div>
      <div class="tb-actions"><button class="mn-btn sec" data-tb="leave">${t('tb.leave')}</button><button class="mn-btn" data-tb="start"${team.length ? '' : ' disabled'}>${t('tb.start')}</button></div>
    </div></div>`;
  };
  root.onclick = (e) => {
    const el = (e.target as HTMLElement).closest('[data-tb]') as HTMLElement | null;
    if (!el) return;
    const [verb, arg] = (el.dataset.tb ?? '').split(':');
    const uid = Number(arg);
    if (verb === 'start') { close(); onStart(); return; }
    if (verb === 'leave') { close(); onLeave(); return; }
    if (verb === 'tog' || verb === 'out') toggleBattle(b, c, uid, busy);
    if (verb === 'lead') leadBattle(b, c, uid, busy);
    render();
  };
  const close = () => root.remove();
  render();
  return close;
}

export interface ResultButton { label: string; primary?: boolean; run: () => void }

export function showResult(win: boolean, lines: string[], buttons: ResultButton[]): void {
  const root = panel(), banner = win ? 'tb_banner_win' : 'tb_banner_lose';
  root.innerHTML = `<div class="mn"><div class="mn-body tb-res${win ? '' : ' lose'}">
    ${ART[banner] ? `<img class="tb-banner" src="${ART[banner]?.url}" alt="">` : ''}
    <h2>${win ? t('tb.win') : t('tb.lose')}</h2><div>${lines.join('\n')}</div>
    <div class="tb-actions">${buttons.map((b, i) => `<button class="mn-btn${b.primary ? '' : ' sec'}" data-i="${i}">${b.label}</button>`).join('')}</div>
  </div></div>`;
  root.onclick = (e) => {
    const el = (e.target as HTMLElement).closest('[data-i]') as HTMLElement | null;
    if (!el) return;
    root.remove();
    buttons[Number(el.dataset.i)]?.run();
  };
}
