import {
  attack, attackCooldown, BAG_SIZE, canEquip, canLearn, canSocket, critRate, defense, EQUIP_SLOTS, instance, isEquipped, itemDef, learnableSkills,
  magicAttack, maxHp, maxSp, refineChance, refineCost, skillDef, spCost, statCost, STAT_KEYS, type ContentBundle, type HeroData, type ItemInstance,
} from '@shared/index';
import { ART } from '../../assets/manifest.generated';
import { t } from '../../i18n';
import type { HeroSession } from '../../hero/HeroSession';
import type { SaveData } from '../../save/local';

/** HTML for each menu tab. Buttons carry `data-act="verb:arg"`; Menu.ts dispatches them. */
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
const btn = (act: string, label: string, ok = true, sec = false) => `<button class="mn-btn${sec ? ' sec' : ''}" data-act="${act}"${ok ? '' : ' disabled'}>${esc(label)}</button>`;
const EMOJI: Record<string, string> = { scroll: '📜', material: '💎', sword: '⚔️', staff: '🪄', bow: '🏹', mace: '🔨', head: '🎩', armor: '🥋', cape: '🧥', shoes: '👢', acc: '💍', offhand: '🛡️', consumable: '🧪' };

export function iconHtml(key: string, fallback: string): string {
  const a = ART[key];
  return a ? `<span class="mn-icon" style="background-image:url(${a.url})"></span>` : `<span class="mn-icon">${fallback}</span>`;
}

export function itemName(c: ContentBundle, it: ItemInstance): string {
  const d = itemDef(c, it.id);
  return `${it.refine ? `+${it.refine} ` : ''}${t(d?.name_key ?? it.id)}${it.cards.length ? ` [${it.cards.length}🃏]` : ''}${it.count > 1 ? ` ×${it.count}` : ''}`;
}

function itemIcon(c: ContentBundle, it: ItemInstance): string {
  const d = itemDef(c, it.id);
  return iconHtml(d?.icon ?? '', EMOJI[d?.type === 'weapon' ? d.subtype : d?.type ?? ''] ?? '📦');
}

function itemStats(c: ContentBundle, it: ItemInstance): string {
  const d = itemDef(c, it.id);
  if (!d) return '';
  const parts: string[] = [];
  for (const k of ['atk', 'matk', 'def', 'hp', 'sp', ...STAT_KEYS, 'crit'] as const) if (d[k]) parts.push(`${k.toUpperCase()} +${d[k]}`);
  if (d.use) parts.push(Object.entries(d.use).filter(([, v]) => v).map(([k, v]) => `${k.toUpperCase()} +${v}`).join(' '));
  if (d.slots) parts.push(`${t('menu.slots')} ${it.cards.length}/${d.slots}`);
  if (d.level_req > 1) parts.push(`Lv ${d.level_req}`);
  return parts.join(' · ');
}

export function statusTab(s: HeroSession): string {
  const h = s.data, b = s.derived.build;
  const rows = STAT_KEYS.map((k) => {
    const cost = statCost(h.stats[k]), bonus = b.stats[k] - h.stats[k];
    return `<div class="mn-row"><b style="width:46px">${k.toUpperCase()}</b><span class="grow">${h.stats[k]}${bonus ? ` <small style="display:inline">+${bonus}</small>` : ''}<small>${t(`stat.${k}`)}</small></span>
      <small>${t('menu.cost')} ${cost}</small>${btn(`stat:${k}`, '+', h.statPoints >= cost)}</div>`;
  }).join('');
  return `<div class="mn-h">${t(`job.${h.job}`)} · Lv ${h.baseLv} · Job ${h.jobLv} · ${t('menu.points')} <b>${h.statPoints}</b></div>
    <div class="mn-kv"><div>ATK <b>${attack(b)}</b> <small>${b.atkStat === 'dex' ? 'DEX' : 'STR'}</small></div><div>MATK <b>${magicAttack(b)}</b> <small>INT${b.staffMatk ? ` +${Math.round(b.staffMatk * 100)}%` : ''}</small></div><div>DEF <b>${defense(b)}</b></div><div>HP <b>${maxHp(b)}</b></div>
    <div>SP <b>${maxSp(b)}</b></div><div>${t('menu.crit')} <b>${critRate(b).toFixed(1)}%</b></div><div>${t('menu.aspd')} <b>${(1 / attackCooldown(b)).toFixed(1)}/s</b></div><div>${t('menu.element')} <b>${t(`el.${s.derived.element}`)}</b></div></div>
    ${rows}`;
}

export function skillsTab(s: HeroSession): string {
  const h = s.data, c = s.content;
  const rows = learnableSkills(h, c).map((d) => {
    const lv = h.skills[d.id] ?? 0, why = canLearn(h, c, d.id);
    const req = Object.entries(d.requires).map(([r, l]) => `${t(`skill.${r}`)} ${l}`).join(', ');
    const slotBtns = d.type === 'active' && lv > 0 ? [0, 1, 2].map((i) => btn(`slot:${i}:${d.id}`, `S${i + 1}`, true, h.slots[i] !== d.id)).join('') : '';
    const sp = d.type === 'active' && lv > 0 ? ` · SP ${spCost(d, lv)}` : '';
    return `<div class="mn-row">${iconHtml(d.icon, d.type === 'passive' ? '✨' : '⚡')}<span class="grow">${t(d.name_key)} <b>${lv}/${d.max_lv}</b>${d.type === 'passive' ? `<span class="mn-tag">${t('menu.passive')}</span>` : ''}
      <small>${t(`${d.name_key}.desc`)}${sp}${req ? ` · ${t('menu.needs')} ${req}` : ''}</small></span>${slotBtns}${d.effects.free ? '' : btn(`learn:${d.id}`, '+', why === null)}</div>`;
  }).join('');
  return `<div class="mn-h">${t('menu.skillpoints')} <b>${h.skillPoints}</b> · ${t('menu.slotsHint')}</div>${rows}`;
}

const GEAR = new Set(['weapon', 'offhand', 'head', 'armor', 'cape', 'shoes', 'acc']);
const isGear = (c: ContentBundle, it: ItemInstance) => GEAR.has(itemDef(c, it.id)?.type ?? '');

/** Equipment only: the 8 slots + gear in the bag. Potions, materials and scrolls live in the Bag tab. */
export function equipTab(s: HeroSession, save: SaveData): string {
  const h = s.data, c = s.content;
  const slots = EQUIP_SLOTS.map((slot) => {
    const it = instance(h, h.equip[slot]);
    return `<div class="mn-row">${it ? itemIcon(c, it) : '<span class="mn-icon">·</span>'}<span class="grow"><small>${t(`slot.${slot}`)}</small>${it ? esc(itemName(c, it)) : '—'}</span>${it ? btn(`unequip:${slot}`, t('menu.remove'), true, true) : ''}</div>`;
  }).join('');
  const gear = h.bag.filter((it) => !isEquipped(h, it.uid) && isGear(c, it));
  const rows = gear.map((it) => bagRow(s, save, it)).join('') || `<div class="mn-note">${t('menu.noGear')}</div>`;
  return `<div class="mn-h">${t('menu.equipped')}</div><div class="mn-grid">${slots}</div><div class="mn-h">${t('menu.gearBag')} (${gear.length})</div>${rows}`;
}

/** Everything that isn't gear: potions (use), scrolls (summon), essences and other materials. */
export function bagTab(s: HeroSession, save: SaveData): string {
  const h = s.data, c = s.content;
  const order = ['consumable', 'scroll', 'material'];
  const items = h.bag.filter((it) => !isGear(c, it))
    .sort((a, z) => order.indexOf(itemDef(c, a.id)?.type ?? '') - order.indexOf(itemDef(c, z.id)?.type ?? '') || a.id.localeCompare(z.id));
  const rows = items.map((it) => bagRow(s, save, it)).join('') || `<div class="mn-note">${t('menu.bagEmpty')}</div>`;
  return `<div class="mn-h">${t('menu.bag')} (${h.bag.length}/${BAG_SIZE}) · ${save.soul}${t('hud.soul')}</div>${rows}`;
}

function bagRow(s: HeroSession, save: SaveData, it: ItemInstance): string {
  const c = s.content, h = s.data, d = itemDef(c, it.id);
  const acts: string[] = [];
  if (d?.use) acts.push(btn(`use:${it.uid}`, t('menu.use')));
  else if (d?.type === 'scroll') acts.push(btn('tab:summon', t('tab.summon')));
  else if (d && d.type !== 'material') acts.push(btn(`equip:${it.uid}`, t('menu.equip'), canEquip(h, c, it.uid) === null));
  const card = Object.keys(save.cards).find((cid) => (save.cards[cid] ?? 0) > 0 && canSocket(h, c, it.uid, cid) === null);
  if (card) acts.push(btn(`socket:${it.uid}:${card}`, `🃏 ${t(`card.${card.replace(/^card_/, '')}`)}`, true, true));
  const why = d && GEAR.has(d.type) ? canEquip(h, c, it.uid) : null;
  return `<div class="mn-row">${itemIcon(c, it)}<span class="grow"><span class="t-${d?.tier ?? 'common'}">${esc(itemName(c, it))}</span><small>${itemStats(c, it)}${why && why !== 'missing' ? ` · ${t(`why.${why}`)}` : ''}</small></span>${acts.join('')}</div>`;
}

export function cardsTab(s: HeroSession, save: SaveData): string {
  const rows = Object.entries(save.cards).filter(([, n]) => n > 0).map(([id, n]) => {
    const card = s.content.cards.find((x) => x.id === id);
    const fx = Object.entries(card?.effects ?? {}).map(([k, v]) => `${k.toUpperCase()} +${v}`).join(' · ');
    return `<div class="mn-row">${iconHtml(card?.art ?? '', '🃏')}<span class="grow">${t(card?.name_key ?? id)} ×${n}<small>${t(`slot.${card?.slot_type ?? 'any'}`)} · ${fx}</small></span></div>`;
  }).join('');
  return `<div class="mn-h">${t('menu.cardsHint')}</div>${rows || `<div class="mn-note">${t('menu.noCards')}</div>`}`;
}

export function refineTab(s: HeroSession, save: SaveData): string {
  const h = s.data, c = s.content;
  const rows = h.bag.filter((it) => itemDef(c, it.id)?.refineable).map((it) => {
    const cost = refineCost(it.refine), chance = Math.round(refineChance(it.refine) * 100);
    const risk = it.refine >= 10 ? t('refine.breakRisk') : it.refine >= 5 ? t('refine.down') : t('refine.safe');
    return `<div class="mn-row">${itemIcon(c, it)}<span class="grow">${esc(itemName(c, it))}${isEquipped(h, it.uid) ? `<span class="mn-tag">E</span>` : ''}<small>${chance}% · ${cost}${t('hud.soul')} · ${risk}</small></span>${btn(`refine:${it.uid}`, t('menu.refine'), save.soul >= cost && it.refine < 15)}</div>`;
  }).join('');
  return `<div class="mn-h">${t('menu.refineTitle')} · ${save.soul}${t('hud.soul')}</div>${rows || `<div class="mn-note">${t('menu.bagEmpty')}</div>`}`;
}

export const SHOP = ['potion_red', 'potion_orange', 'potion_blue', 'scroll_normal', 'ess_fire', 'ess_holy', 'ess_dark', 'hat_leather_cap', 'cape_traveler', 'shoe_sandals', 'shield_buckler', 'w_train', 'wpn_staff_wood', 'wpn_bow_short', 'wpn_mace_iron'];

export function shopTab(s: HeroSession, save: SaveData): string {
  const c = s.content, h: HeroData = s.data;
  const buy = SHOP.map((id) => {
    const d = itemDef(c, id); if (!d) return '';
    return `<div class="mn-row">${iconHtml(d.icon, EMOJI[d.type === 'weapon' ? d.subtype : d.type] ?? '📦')}<span class="grow">${t(d.name_key)}<small>${d.price}${t('hud.soul')}</small></span>${btn(`buy:${id}`, t('menu.buy'), save.soul >= d.price)}</div>`;
  }).join('');
  const sell = h.bag.filter((it) => !isEquipped(h, it.uid)).map((it) => {
    const d = itemDef(c, it.id), price = Math.floor((d?.price ?? 0) / 2);
    return `<div class="mn-row">${itemIcon(c, it)}<span class="grow">${esc(itemName(c, it))}<small>${price}${t('hud.soul')}</small></span>${btn(`sell:${it.uid}`, t('menu.sell'), true, true)}</div>`;
  }).join('');
  return `<div class="mn-h">${t('menu.shopTitle')} · ${save.soul}${t('hud.soul')}</div>${buy}<div class="mn-h">${t('menu.sellTitle')}</div>${sell}`;
}

export { skillDef };
