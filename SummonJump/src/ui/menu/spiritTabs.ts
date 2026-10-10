import {
  activeSets, autoSkill, awakenCost, canAwaken, canStarUp, countItem, familyOf, fodderCandidates, fodderNeeded, itemDef, maxLevel, runesOn,
  spiritExpToNext, spiritOf, spiritStats, sskillOf, upgradeCost, upgradeRate, MAX_RUNE_LV, RUNE_SLOTS,
  type ContentBundle, type RuneInst, type SpiritInst, type SpiritSkillDef,
} from '@shared/index';
import { lockMsg } from './lock';
import { t } from '../../i18n';
import type { HeroSession } from '../../hero/HeroSession';
import type { SaveData } from '../../save/local';
import { portraitHtml } from '../../spirits/art';
import { iconHtml } from './tabs';
import { ART } from '../../assets/manifest.generated';

/** Painted summon VFX (black background, screen-blended over the dark menu). */
const artBg = (key: string, cls: string): string => (ART[key] ? `<div class="${cls}" style="background-image:url(${ART[key].url})"></div>` : '');

/** Spirits tab (team, collection, detail, runes, star-up) and Summon tab. Buttons carry `data-act`; spiritActions.ts handles them. */
export interface SpiritMenuState {
  sel: number | null; mode: 'info' | 'runes' | 'starup'; fodder: number[]; slot: number | null;
  pickEl: string; results: { uid: number; star: number; pity: boolean }[]; anim: number;
  /** encyclopedia: family being viewed */
  book: string | null;
}
export const newSpiritMenuState = (): SpiritMenuState => ({ sel: null, mode: 'info', fodder: [], slot: null, pickEl: 'fire', results: [], anim: 0, book: null });

const btn = (act: string, label: string, ok = true, sec = false) => `<button class="mn-btn${sec ? ' sec' : ''}" data-act="${act}"${ok ? '' : ' disabled'}>${label}</button>`;
const stars = (n: number, awk = false) => `<span class="sp-stars${awk ? ' awk' : ''}">${'★'.repeat(n)}</span>`;

export function spiritName(c: ContentBundle, s: Pick<SpiritInst, 'id' | 'el'>): string {
  return `${t(familyOf(c, s.id)?.name_key ?? s.id)} <small class="el-${s.el}" style="display:inline">${t(`el.${s.el}`)}</small>`;
}

/** Skill text generated from the numbers (no hand-written descriptions to drift). */
export function skillText(d: SpiritSkillDef | undefined): string {
  if (!d) return '';
  const fx = d.effects, pct = (v: number) => Math.round(v * 100);
  if (d.type === 'leader') return Object.entries(fx).map(([k, v]) => t(`lead.${k}`).replace('{v}', String(v))).join(' · ');
  let s = d.type === 'ult'
    ? t('sk.all').replace('{n}', String(d.hits)).replace('{p}', String(pct(d.power)))
    : t(d.target === 'aoe' ? 'sk.aoe' : 'sk.bolt').replace('{p}', String(pct(d.power))).replace('{cd}', String(d.cd));
  for (const [k, v] of Object.entries(fx)) s += t(`skfx.${k}`).replace('{v}', String(k === 'stun' || k === 'crit' ? v : pct(v)));
  return s;
}

function card(c: ContentBundle, s: SpiritInst, on: boolean, extra = ''): string {
  return `<button class="sp-card${on ? ' on' : ''}" data-act="${extra || `spsel:${s.uid}`}">${portraitHtml(c, s, 52)}${stars(s.star, s.awk)}<span class="sp-nm">${t(familyOf(c, s.id)?.name_key ?? s.id)}</span><span class="sp-lv">Lv ${s.lv}</span></button>`;
}

export function spiritsTab(s: HeroSession, save: SaveData, st: SpiritMenuState): string {
  const c = s.content, b = s.box;
  const team = b.team.map((uid, i) => {
    const sp = spiritOf(b, uid);
    const lab = i === 0 ? `👑 ${t('sp.leader')}` : `${t('sp.slot')} ${i + 1}`;
    return `<div class="sp-tslot"><small>${lab}</small>${sp ? card(c, sp, st.sel === sp.uid) : `<div class="sp-card empty">${t('sp.empty')}</div>`}</div>`;
  }).join('');
  const sel = spiritOf(b, st.sel);
  const detail = !sel ? `<div class="mn-note">${t('sp.tapHint')}</div>`
    : st.mode === 'runes' ? runesView(s, save, sel, st) : st.mode === 'starup' ? starUpView(s, sel, st) : infoView(s, sel);
  const list = [...b.spirits].sort((a, z) => z.star - a.star || Number(z.awk) - Number(a.awk) || z.lv - a.lv)
    .map((x) => card(c, x, st.sel === x.uid)).join('');
  // the selected spirit's detail goes first so it is on screen right after a tap (phones)
  return `${sel ? detail : ''}<div class="mn-h">${t('sp.team')} · ✦ ${Math.floor(b.gauge)}%</div><div class="sp-team">${team}</div>
    ${sel ? '' : detail}
    <div class="mn-h">${t('sp.all')} (${b.spirits.length}) ${btn('tab:summon', `✨ ${t('tab.summon')}`)}</div><div class="sp-grid">${list}</div>`;
}

function infoView(s: HeroSession, sp: SpiritInst): string {
  const c = s.content, b = s.box, f = familyOf(c, sp.id);
  if (!f) return '';
  const st = spiritStats(c, sp, b.runes), cap = maxLevel(sp.star), inTeam = b.team.indexOf(sp.uid);
  const exp = sp.lv >= cap ? 'MAX' : `${sp.exp}/${spiritExpToNext(sp.lv)}`;
  const teamBtns = [0, 1, 2].map((i) => btn(`spteam:${i}:${sp.uid}`, i === 0 ? `👑 ${t('sp.leader')}` : `${t('sp.slot')} ${i + 1}`, inTeam !== i, true)).join('')
    + (inTeam >= 0 ? btn(`spout:${sp.uid}`, t('sp.remove'), true, true) : '');
  const cost = awakenCost(c, sp).map((k) => `${t(itemDef(c, k.item)?.name_key ?? k.item)} ${countItem(s.data, k.item)}/${k.n}`).join(' · ');
  const awkWhy = canAwaken(b, c, s.data, sp.uid);
  const need = fodderNeeded(sp), cands = fodderCandidates(b, sp.uid).length;
  return `<div class="sp-detail">
    <div class="sp-head">${portraitHtml(c, sp, 96)}<div class="grow"><div class="sp-title">${spiritName(c, sp)} ${stars(sp.star, sp.awk)}${sp.awk ? `<span class="mn-tag">${t('sp.awakened')}</span>` : ''}</div>
      <small>${t(`role.${f.role}`)} · Lv ${sp.lv}/${cap} · EXP ${exp}${f.ability !== 'none' ? ` · ${t(`ability.${f.ability}`)}` : ''}</small>
      <div class="mn-kv"><div>HP <b>${st.hp}</b></div><div>ATK <b>${st.atk}</b></div><div>DEF <b>${st.def}</b></div><div>SPD <b>${st.spd}</b></div><div>${t('menu.crit')} <b>${st.crit}%</b></div><div>CRI DMG <b>${st.critDmg}%</b></div></div></div></div>
    <div class="mn-row"><span class="grow">① ${t(autoSkill(c, sp)?.name_key ?? '')}<small>${skillText(autoSkill(c, sp))}</small></span></div>
    <div class="mn-row"><span class="grow">✦ ${t(sskillOf(c, f.ult)?.name_key ?? '')}<small>${skillText(sskillOf(c, f.ult))}</small></span></div>
    <div class="mn-row"><span class="grow">👑 ${t(sskillOf(c, f.leader)?.name_key ?? '')}<small>${skillText(sskillOf(c, f.leader))}</small></span></div>
    <div class="sp-btns">${teamBtns}</div>
    <div class="sp-btns">${btn('spmode:runes', `💠 ${t('sp.runes')} (${runesOn(b, sp.uid).length}/6)${lockMsg(s, 'runes') ? ' 🔒' : ''}`, !lockMsg(s, 'runes'))}
      ${btn('spmode:starup', `⭐ ${t('sp.starUp')}`, sp.star < 6 && sp.lv >= cap && cands >= need)}
      ${btn(`spawk:${sp.uid}`, `🌟 ${t('sp.awaken')}`, awkWhy === null)}</div>
    <div class="mn-note">${sp.star < 6 ? t('sp.starUpHint').replace('{lv}', String(cap)).replace('{n}', String(need)).replace('{s}', String(sp.star)) : t('sp.maxStar')}${sp.awk ? '' : ` · ${t('sp.awakenCost')}: ${cost}`}</div>
  </div>`;
}

function starUpView(s: HeroSession, sp: SpiritInst, st: SpiritMenuState): string {
  const c = s.content, b = s.box, need = fodderNeeded(sp);
  const cands = fodderCandidates(b, sp.uid).map((x) => card(c, x, st.fodder.includes(x.uid), `spfod:${x.uid}`)).join('');
  const why = canStarUp(b, sp.uid, st.fodder);
  return `<div class="sp-detail"><div class="mn-h">⭐ ${spiritName(c, sp)} ${stars(sp.star)} → ${stars(sp.star + 1)}</div>
    <div class="mn-note">${t('sp.pickFodder').replace('{n}', String(need)).replace('{s}', String(sp.star))} (${st.fodder.length}/${need})</div>
    <div class="sp-grid">${cands || `<div class="mn-note">${t('sp.noFodder')}</div>`}</div>
    <div class="sp-btns">${btn('spstar', t('sp.confirmStar'), why === null)}${btn('spmode:info', t('sp.back'), true, true)}</div></div>`;
}

export function runeText(c: ContentBundle, r: RuneInst): string {
  const stat = (k: string, v: number) => `${t(`rstat.${k}`)} +${v}${c.runeStats.find((x) => x.stat === k)?.flat ? '' : '%'}`;
  return `<b>${stat(r.main.stat, r.main.v)}</b>${r.subs.length ? ` · ${r.subs.map((x) => stat(x.stat, x.v)).join(' · ')}` : ''}`;
}

function runeIcon(r: RuneInst): string {
  return `<span class="rn-ic">${iconHtml(`rune_slot${r.slot}`, String(r.slot))}${iconHtml(`rune_set_${r.set}`, '')}</span>`;
}

function runeRow(s: HeroSession, save: SaveData, r: RuneInst, on: boolean): string {
  const c = s.content, cost = upgradeCost(c, r), rate = Math.round(upgradeRate(c, r) * 100);
  const acts = on
    ? btn(`runeup:${r.uid}`, r.lv >= MAX_RUNE_LV ? 'MAX' : `+1 · ${cost}${t('hud.soul')} · ${rate}%`, r.lv < MAX_RUNE_LV && save.soul >= cost) + btn(`runeoff:${r.uid}`, t('menu.remove'), true, true)
    : btn(`runeon:${r.uid}`, t('menu.equip')) + btn(`runesell:${r.uid}`, t('menu.sell'), true, true);
  return `<div class="mn-row">${runeIcon(r)}<span class="grow">${t(`rune.set.${r.set}`)} · ${t('sp.slot')} ${r.slot} · ${'★'.repeat(r.star)} <b>+${r.lv}</b>
    <small>${runeText(c, r)}</small></span>${acts}</div>`;
}

function runesView(s: HeroSession, save: SaveData, sp: SpiritInst, st: SpiritMenuState): string {
  const c = s.content, b = s.box, mine = runesOn(b, sp.uid);
  const slots = Array.from({ length: RUNE_SLOTS }, (_, i) => {
    const r = mine.find((x) => x.slot === i + 1);
    return r ? runeRow(s, save, r, true) : `<div class="mn-row"><span class="mn-icon">${i + 1}</span><span class="grow">${t('sp.slot')} ${i + 1} · ${t('sp.empty')}</span>${btn(`runeslot:${i + 1}`, t('sp.pick'), true, st.slot !== i + 1)}</div>`;
  }).join('');
  const sets = activeSets(c, mine).map((x) => t(`rune.set.${x}`)).join(', ') || '—';
  const bag = b.runes.filter((r) => r.on === null && (st.slot === null || r.slot === st.slot)).sort((a, z) => z.star - a.star || z.lv - a.lv);
  const filters = [null, 1, 2, 3, 4, 5, 6].map((n) => btn(`runeslot:${n ?? 0}`, n === null ? t('sp.allSlots') : String(n), true, st.slot !== n)).join('');
  return `<div class="sp-detail"><div class="mn-h">💠 ${spiritName(c, sp)} · ${t('sp.sets')}: ${sets} ${btn('spmode:info', t('sp.back'), true, true)}</div>${slots}
    <div class="mn-h">${t('sp.runeBag')} (${b.runes.filter((r) => r.on === null).length}) · ${save.soul}${t('hud.soul')}</div><div class="sp-btns">${filters}</div>
    ${bag.map((r) => runeRow(s, save, r, false)).join('') || `<div class="mn-note">${t('sp.noRunes')}</div>`}</div>`;
}

export function summonTab(s: HeroSession, st: SpiritMenuState): string {
  const c = s.content, b = s.box;
  const rows = c.summon.map((d) => {
    const have = countItem(s.data, d.item), it = itemDef(c, d.item);
    const pity = d.pity_n > 0 ? ` · ${t('sum.pity').replace('{n}', String(d.pity_n - (b.pity[d.id] ?? 0))).replace('{s}', String(d.pity_star))}` : '';
    const rates = d.rates.map((p, i) => (p > 0 ? `${i + 1}★ ${+(p * 100).toFixed(1)}%` : '')).filter(Boolean).join(' · ');
    const pick = d.elements.includes('pick') ? `<div class="sp-btns">${['water', 'fire', 'earth', 'wind'].map((e) => btn(`sumel:${e}`, t(`el.${e}`), true, st.pickEl !== e)).join('')}</div>` : '';
    return `<div class="mn-row">${iconHtml(it?.icon ?? '', '📜')}<span class="grow">${t(d.name_key)} ×${have}<small>${rates}${pity}</small>${pick}</span>
      ${btn(`sum:${d.id}:1`, '×1', have >= 1)}${btn(`sum:${d.id}:10`, '×10', have >= 10)}</div>`;
  }).join('');
  const res = st.results.map((r, i) => {
    const sp = spiritOf(b, r.uid);
    const glow = r.star >= 5 ? artBg('vfx_summon_star', 'sm-glow') : r.star >= 4 ? artBg('vfx_summon_beam', 'sm-glow') : '';
    return sp ? `<div class="sm-card s${r.star}" style="animation-delay:${0.35 + i * 0.12}s">${glow}${portraitHtml(c, sp, 60)}${stars(r.star)}<span class="sp-nm">${t(familyOf(c, sp.id)?.name_key ?? '')}</span><small class="el-${sp.el}">${t(`el.${sp.el}`)}</small>${r.pity ? `<span class="mn-tag">${t('sum.pityHit')}</span>` : ''}</div>` : '';
  }).join('');
  // results first: on a phone the reveal must be on screen without scrolling
  return `${res ? `<div class="sm-res" data-anim="${st.anim}">${artBg('vfx_summon_portal', 'sm-portal art') || '<div class="sm-portal"></div>'}<div class="sm-cards">${res}</div></div>` : `<div class="mn-note">${t('sum.hint')}</div>`}
    <div class="mn-h">${t('sum.title')}</div>${rows}
    <div class="sp-btns">${btn('tab:spirits', `🐾 ${t('tab.spirits')}`, true, true)}</div>`;
}

/** Encyclopedia: every family and element variant in the game, which ones you own, stats and skills. */
export function bookTab(s: HeroSession, st: SpiritMenuState): string {
  const c = s.content, b = s.box;
  const owned = new Set(b.spirits.map((x) => `${x.id}:${x.el}`));
  const total = c.spirits.reduce((n, f) => n + f.elements.length, 0);
  const fams = c.spirits.filter((f) => b.spirits.some((x) => x.id === f.id)).length;
  const grid = [...c.spirits].sort((a, z) => a.base_star - z.base_star).map((f) => {
    const have = f.elements.filter((e) => owned.has(`${f.id}:${e}`));
    const dots = f.elements.map((e) => `<i class="bk-dot el-${e}${owned.has(`${f.id}:${e}`) ? ' on' : ''}">●</i>`).join('');
    return `<button class="sp-card${st.book === f.id ? ' on' : ''}${have.length ? '' : ' bk-unknown'}" data-act="book:${f.id}">${portraitHtml(c, { id: f.id, el: f.element, awk: false }, 52)}${stars(f.base_star)}<span class="sp-nm">${t(f.name_key)}</span><span class="bk-dots">${dots}</span></button>`;
  }).join('');
  const f = c.spirits.find((x) => x.id === st.book);
  let detail = `<div class="mn-note">${t('book.hint')}</div>`;
  if (f) {
    const lv1 = { uid: 0, id: f.id, el: f.element, star: f.base_star, lv: 1, exp: 0, awk: false };
    const max = { ...lv1, lv: maxLevel(f.base_star) };
    const a = spiritStats(c, lv1), z = spiritStats(c, max);
    const variants = f.elements.map((e) => `<div class="bk-var${owned.has(`${f.id}:${e}`) ? ' on' : ''}">${portraitHtml(c, { id: f.id, el: e, awk: false }, 48)}<small class="el-${e}">${t(`el.${e}`)}</small><small>${owned.has(`${f.id}:${e}`) ? '✓' : '—'}</small></div>`).join('');
    const src = c.summon.filter((d) => (d.rates[f.base_star - 1] ?? 0) > 0).map((d) => t(d.name_key)).join(', ');
    const skill = (icon: string, id: string) => { const d = sskillOf(c, id); return `<div class="mn-row"><span class="grow">${icon} ${t(d?.name_key ?? id)}<small>${skillText(d)}</small></span></div>`; };
    detail = `<div class="sp-detail"><div class="sp-head">${portraitHtml(c, { id: f.id, el: f.element, awk: false }, 96)}<div class="grow">
      <div class="sp-title">${t(f.name_key)} ${stars(f.base_star)}</div><small>${t(`role.${f.role}`)}${f.ability !== 'none' ? ` · ${t(`ability.${f.ability}`)}` : ''}</small>
      <div class="mn-kv"><div>HP <b>${a.hp}→${z.hp}</b></div><div>ATK <b>${a.atk}→${z.atk}</b></div><div>DEF <b>${a.def}→${z.def}</b></div><div>SPD <b>${a.spd}</b></div><div>${t('menu.crit')} <b>${a.crit}%</b></div><div>Lv <b>1→${maxLevel(f.base_star)}</b></div></div></div></div>
      <div class="bk-vars">${variants}</div>
      ${skill('①', f.auto)}${skill('①🌟', f.awk_auto)}${skill('✦', f.ult)}${skill('👑', f.leader)}
      <div class="mn-note">${t('book.from')}: ${src || '—'}</div></div>`;
  }
  return `${detail}<div class="mn-h">${t('book.title')} · ${t('book.count').replace('{f}', String(fams)).replace('{fn}', String(c.spirits.length)).replace('{v}', String(owned.size)).replace('{vn}', String(total))}</div><div class="sp-grid">${grid}</div>`;
}
