import {
  addItem, cfg, exploreEfficiency, exploreGiveExp, exploreHours, exploreLoot, exploreMonsters, familyOf, itemDef, spiritOf, EXPLORE_MAX,
  type ExploreLoot, type ExploreState,
} from '@shared/index';
import { t } from '../../i18n';
import type { HeroSession } from '../../hero/HeroSession';
import type { SaveData } from '../../save/local';
import { portraitHtml } from '../../spirits/art';

/** Expedition tab: send up to 3 spirits (not in the team) to a visited map; loot piles up even while the game is closed. */
export interface ExploreRoom { id: string; name: string; monsters: string[] }
export interface ExploreMenuState { room: string | null; picks: number[] }
export const newExploreState = (): ExploreMenuState => ({ room: null, picks: [] });

const btn = (act: string, label: string, ok = true, sec = false) => `<button class="mn-btn${sec ? ' sec' : ''}" data-act="${act}"${ok ? '' : ' disabled'}>${label}</button>`;
const avgLv = (s: HeroSession, monsters: string[]) => { const m = exploreMonsters(s.content, monsters); return m.length ? Math.round(m.reduce((a, x) => a + x.level, 0) / m.length) : 0; };

function lootText(s: HeroSession, loot: ExploreLoot): string {
  const c = s.content;
  const items = Object.entries(loot.items).map(([id, n]) => `${t(itemDef(c, id)?.name_key ?? id)} ×${n}`);
  const cards = Object.entries(loot.cards).map(([id, n]) => `🃏 ${t(`card.${id.replace(/^card_/, '')}`)} ×${n}`);
  return [`${loot.soul}${t('hud.soul')}`, ...items, ...cards].join(' · ');
}

export function exploreTab(s: HeroSession, save: SaveData, rooms: ExploreRoom[], st: ExploreMenuState, now: number): string {
  const c = s.content, b = s.box, ex = save.explore;
  if (ex) {
    const room = rooms.find((r) => r.id === ex.room), loot = exploreLoot(c, b, ex, room?.monsters ?? [], now);
    const cap = cfg(c, 'explore_cap_h', 12), h = exploreHours(c, ex, now);
    const team = ex.uids.map((u) => spiritOf(b, u)).filter((x) => !!x).map((x) => `<div class="sp-card">${portraitHtml(c, x!, 44)}<span class="sp-nm">${t(familyOf(c, x!.id)?.name_key ?? '')}</span><span class="sp-lv">Lv ${x!.lv}</span></div>`).join('');
    return `<div class="mn-h">🧭 ${t('ex.away').replace('{room}', room?.name ?? ex.room)}</div>
      <div class="mn-note">${t('ex.time').replace('{h}', String(Math.floor(h))).replace('{m}', String(Math.floor((h % 1) * 60))).replace('{cap}', String(cap))}</div>
      <div class="adv-bar" style="margin:0 8px 8px"><i style="width:${Math.round((100 * h) / cap)}%"></i></div>
      <div class="sp-grid">${team}</div>
      <div class="mn-row"><span class="grow">${t('ex.loot').replace('{n}', String(loot.kills))}<small>${loot.kills ? lootText(s, loot) : t('ex.nothing')}</small></span></div>
      <div class="sp-btns">${btn('exclaim', t('ex.claim'), loot.kills > 0)}${btn('exstop', t('ex.recall'), true, true)}</div>`;
  }
  const team = new Set(b.team);
  const free = b.spirits.filter((x) => !team.has(x.uid));
  const visited = rooms.filter((r) => save.seen[r.id] && exploreMonsters(c, r.monsters).length);
  if (!st.room || !visited.some((r) => r.id === st.room)) st.room = visited.reduce<ExploreRoom | null>((a, r) => (!a || avgLv(s, r.monsters) > avgLv(s, a.monsters) ? r : a), null)?.id ?? null;
  st.picks = st.picks.filter((u) => free.some((x) => x.uid === u));
  const sel = rooms.find((r) => r.id === st.room);
  const eff = sel ? exploreEfficiency(c, b, st.picks, exploreMonsters(c, sel.monsters)) : 0;
  const roomRows = visited.map((r) => `<button class="mn-btn${r.id === st.room ? '' : ' sec'} ex-room" data-act="exroom:${r.id}">${r.name} <small>Lv ${avgLv(s, r.monsters)}</small></button>`).join('');
  const cards = free.map((x) => `<button class="sp-card${st.picks.includes(x.uid) ? ' on' : ''}" data-act="expick:${x.uid}">${portraitHtml(c, x, 44)}<span class="sp-nm">${t(familyOf(c, x.id)?.name_key ?? '')}</span><span class="sp-lv">Lv ${x.lv}</span></button>`).join('');
  return `<div class="mn-h">🧭 ${t('ex.title')}</div><div class="mn-note">${t('ex.info').replace('{cap}', String(cfg(c, 'explore_cap_h', 12)))}</div>
    <div class="mn-h" style="font-size:15px">${t('ex.pickRoom')}</div><div class="sp-btns ex-rooms">${roomRows || `<span class="mn-note">${t('ex.noRoom')}</span>`}</div>
    <div class="mn-h" style="font-size:15px">${t('ex.pickSpirits').replace('{n}', String(st.picks.length)).replace('{max}', String(EXPLORE_MAX))}</div>
    ${free.length ? `<div class="sp-grid">${cards}</div>` : `<div class="mn-note">${t('ex.noSpirit')}</div>`}
    <div class="mn-row"><span class="grow">${t('ex.eff').replace('{p}', String(Math.round(eff * 100)))}<small>${t('ex.effHint')}</small></span>
    ${btn('exgo', t('ex.go'), !!sel && st.picks.length > 0)}</div>`;
}

/** Menu verbs for the tab. Returns a note to show, '' for "just re-render", or null when the verb isn't ours. */
export function exploreAct(verb: string, x: string, s: HeroSession, save: SaveData, rooms: ExploreRoom[], st: ExploreMenuState, now: number): string | null {
  const c = s.content, b = s.box;
  switch (verb) {
    case 'exroom': st.room = x; return '';
    case 'expick': {
      const u = Number(x);
      st.picks = st.picks.includes(u) ? st.picks.filter((p) => p !== u) : st.picks.length < EXPLORE_MAX ? [...st.picks, u] : st.picks;
      return '';
    }
    case 'exgo': {
      if (!st.room || !st.picks.length || save.explore) return '';
      save.explore = { room: st.room, uids: [...st.picks], start: now, seed: Math.floor(Math.random() * 0x7fffffff) };
      st.picks = [];
      return t('ex.sent');
    }
    case 'exclaim': case 'exstop': {
      const ex = save.explore as ExploreState | null;
      if (!ex) return '';
      const loot = exploreLoot(c, b, ex, rooms.find((r) => r.id === ex.room)?.monsters ?? [], now);
      save.soul += loot.soul;
      for (const [id, n] of Object.entries(loot.items)) addItem(s.data, c, id, n);
      for (const [id, n] of Object.entries(loot.cards)) save.cards[id] = (save.cards[id] ?? 0) + n;
      exploreGiveExp(c, b, ex, loot);
      // claim = keep exploring from now; recall = the spirits come home
      save.explore = verb === 'exstop' ? null : { ...ex, start: now, seed: Math.floor(Math.random() * 0x7fffffff) };
      return loot.kills ? `${t('ex.got')} ${lootText(s, loot)}` : t(verb === 'exstop' ? 'ex.home' : 'ex.nothing');
    }
    default: return null;
  }
}
