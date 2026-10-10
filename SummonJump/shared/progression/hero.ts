import type { ContentBundle, ItemDef, JobDef, JobId, SkillDef } from '../content/types';
import { attack, defense, expToNext, jobExpToNext, maxHp, statCost, statPointsForLevelUp, MAX_BASE_LEVEL, MAX_STAT, STAFF_MATK, STAT_KEYS, type HeroBuild, type StatKey, type Stats } from '../formulas/stats';
import { refineAttackBonus } from '../formulas/refine';
import { fx } from '../formulas/expr';
import type { Element } from '../formulas/elements';

/**
 * Persistent RO-style hero: levels, job, stats, skills, bag of item instances and equipment.
 * Pure data + functions so the server (Phase 6) can validate the same rules.
 */
export type EquipSlot = 'weapon' | 'offhand' | 'head' | 'armor' | 'cape' | 'shoes' | 'acc1' | 'acc2';
export const EQUIP_SLOTS: readonly EquipSlot[] = ['weapon', 'offhand', 'head', 'armor', 'cape', 'shoes', 'acc1', 'acc2'];

export interface ItemInstance { uid: number; id: string; count: number; refine: number; cards: string[] }
export interface Buff { id: string; until: number; effects: Record<string, number> }

export interface HeroData {
  v: 1;
  job: JobId; baseLv: number; jobLv: number; baseExp: number; jobExp: number;
  stats: Stats; statPoints: number; skillPoints: number;
  skills: Record<string, number>;
  slots: (string | null)[];
  bag: ItemInstance[]; nextUid: number;
  equip: Partial<Record<EquipSlot, number>>;
  hp: number | null; sp: number | null;
}

export const START_STAT_POINTS = 20;

export function newHero(content: ContentBundle): HeroData {
  const h: HeroData = {
    v: 1, job: 'novice', baseLv: 1, jobLv: 1, baseExp: 0, jobExp: 0,
    stats: { str: 1, agi: 1, vit: 1, int: 1, dex: 1, luk: 1 }, statPoints: START_STAT_POINTS, skillPoints: 0,
    skills: { first_aid: 1 }, slots: ['first_aid', null, null], bag: [], nextUid: 1, equip: {}, hp: null, sp: null,
  };
  const w = addItem(h, content, 'w_train', 1);
  if (w) h.equip.weapon = w.uid;
  addItem(h, content, 'potion_red', 5);
  return h;
}

export const jobOf = (c: ContentBundle, id: JobId): JobDef => c.jobs.find((j) => j.id === id) as JobDef;
export const itemDef = (c: ContentBundle, id: string): ItemDef | undefined => c.items.find((i) => i.id === id);
export const skillDef = (c: ContentBundle, id: string): SkillDef | undefined => c.skills.find((s) => s.id === id);

// ───────────── levels ─────────────
export interface LevelUpResult { baseUps: number; jobUps: number }

export function gainExp(h: HeroData, c: ContentBundle, base: number, job: number): LevelUpResult {
  const r = { baseUps: 0, jobUps: 0 };
  if (h.baseLv < MAX_BASE_LEVEL) h.baseExp += base;
  while (h.baseLv < MAX_BASE_LEVEL && h.baseExp >= expToNext(h.baseLv)) {
    h.baseExp -= expToNext(h.baseLv); h.baseLv++; h.statPoints += statPointsForLevelUp(h.baseLv); r.baseUps++;
  }
  const jd = jobOf(c, h.job);
  if (h.jobLv < jd.job_max) h.jobExp += job;
  while (h.jobLv < jd.job_max && h.jobExp >= jobExpToNext(h.jobLv, jd.tier)) {
    h.jobExp -= jobExpToNext(h.jobLv, jd.tier); h.jobLv++; h.skillPoints++; r.jobUps++;
  }
  if (h.jobLv >= jd.job_max) h.jobExp = 0;
  return r;
}

export function raiseStat(h: HeroData, k: StatKey): boolean {
  const cost = statCost(h.stats[k]);
  if (h.stats[k] >= MAX_STAT || h.statPoints < cost) return false;
  h.statPoints -= cost; h.stats[k]++;
  return true;
}

// ───────────── skills ─────────────
/** Skills this hero may learn: own job's + every earlier job's. */
export function learnableSkills(h: HeroData, c: ContentBundle): SkillDef[] {
  const jobs: JobId[] = [];
  for (let j: JobDef | undefined = jobOf(c, h.job); j; j = j.from_job ? jobOf(c, j.from_job) : undefined) jobs.push(j.id);
  return c.skills.filter((s) => jobs.includes(s.owner as JobId));
}

export function canLearn(h: HeroData, c: ContentBundle, id: string): string | null {
  const s = skillDef(c, id);
  if (!s) return 'unknown';
  if (!learnableSkills(h, c).some((x) => x.id === id)) return 'job';
  if (s.effects.free) return 'free';
  if ((h.skills[id] ?? 0) >= s.max_lv) return 'max';
  if (h.skillPoints <= 0) return 'points';
  for (const [req, lv] of Object.entries(s.requires)) if ((h.skills[req] ?? 0) < lv) return 'requires';
  return null;
}

export function learnSkill(h: HeroData, c: ContentBundle, id: string): boolean {
  if (canLearn(h, c, id) !== null) return false;
  h.skillPoints--; h.skills[id] = (h.skills[id] ?? 0) + 1;
  // auto-place a new active skill into a free on-screen slot
  const s = skillDef(c, id) as SkillDef;
  if (s.type === 'active' && !h.slots.includes(id)) { const free = h.slots.indexOf(null); if (free >= 0) h.slots[free] = id; }
  return true;
}

export function setSlot(h: HeroData, c: ContentBundle, slot: number, id: string | null): boolean {
  if (slot < 0 || slot >= h.slots.length) return false;
  if (id !== null && (!(h.skills[id] ?? 0) || skillDef(c, id)?.type !== 'active')) return false;
  for (let i = 0; i < h.slots.length; i++) if (h.slots[i] === id) h.slots[i] = null;
  h.slots[slot] = id;
  return true;
}

// ───────────── jobs ─────────────
export function canChangeJob(h: HeroData, c: ContentBundle, to: JobId): string | null {
  const target = jobOf(c, to);
  if (!target || target.from_job !== h.job) return 'path';
  if (h.jobLv < target.job_lv_req) return 'joblv';
  if (h.job === 'novice' && (h.skills.basic_skill ?? 0) < 9) return 'basic';
  return null;
}

export function changeJob(h: HeroData, c: ContentBundle, to: JobId): boolean {
  if (canChangeJob(h, c, to) !== null) return false;
  h.job = to; h.jobLv = 1; h.jobExp = 0; h.skillPoints = 0;
  const target = jobOf(c, to);
  const w = addItem(h, c, target.starter_weapon, 1);
  if (w) { unequip(h, 'weapon'); equip(h, c, w.uid); }
  h.slots = h.slots.map((s) => (s && skillDef(c, s)?.owner === 'novice' ? s : null));
  return true;
}

// ───────────── items ─────────────
const stackable = (d: ItemDef) => d.type === 'consumable' || d.type === 'material' || d.type === 'scroll';
export const BAG_SIZE = 60;

export function addItem(h: HeroData, c: ContentBundle, id: string, count = 1): ItemInstance | null {
  const d = itemDef(c, id);
  if (!d) return null;
  if (stackable(d)) {
    const s = h.bag.find((x) => x.id === id);
    if (s) { s.count += count; return s; }
  }
  if (h.bag.length >= BAG_SIZE) return null;
  const it: ItemInstance = { uid: h.nextUid++, id, count: stackable(d) ? count : 1, refine: 0, cards: [] };
  h.bag.push(it);
  if (!stackable(d)) for (let i = 1; i < count; i++) addItem(h, c, id, 1);
  return it;
}

/** Stack count of an item in the bag (0 if none). */
export const countItem = (h: HeroData, id: string): number => h.bag.filter((x) => x.id === id).reduce((n, x) => n + x.count, 0);

/** Take `n` of a stackable item from the bag; false (and nothing removed) if there are not enough. */
export function removeItem(h: HeroData, id: string, n: number): boolean {
  if (countItem(h, id) < n) return false;
  for (const it of [...h.bag]) {
    if (it.id !== id || n <= 0) continue;
    const take = Math.min(n, it.count);
    it.count -= take; n -= take;
    if (it.count <= 0) h.bag.splice(h.bag.indexOf(it), 1);
  }
  return true;
}

export const instance = (h: HeroData, uid: number | undefined): ItemInstance | undefined => (uid === undefined ? undefined : h.bag.find((x) => x.uid === uid));
export const isEquipped = (h: HeroData, uid: number): boolean => Object.values(h.equip).includes(uid);

export function slotFor(d: ItemDef, h: HeroData): EquipSlot | null {
  switch (d.type) {
    case 'weapon': return 'weapon';
    case 'offhand': return 'offhand';
    case 'head': return 'head';
    case 'armor': return 'armor';
    case 'cape': return 'cape';
    case 'shoes': return 'shoes';
    case 'acc': return h.equip.acc1 === undefined ? 'acc1' : h.equip.acc2 === undefined ? 'acc2' : 'acc1';
    default: return null;
  }
}

export function canEquip(h: HeroData, c: ContentBundle, uid: number): string | null {
  const it = instance(h, uid), d = it && itemDef(c, it.id);
  if (!it || !d) return 'missing';
  if (!slotFor(d, h)) return 'slot';
  if (!(d.job_mask.includes('all') || d.job_mask.includes(h.job))) return 'job';
  if (d.type === 'weapon' && !jobOf(c, h.job).weapons.includes(d.subtype)) return 'job';
  if (h.baseLv < d.level_req) return 'level';
  return null;
}

export function equip(h: HeroData, c: ContentBundle, uid: number): boolean {
  if (canEquip(h, c, uid) !== null) return false;
  const d = itemDef(c, (instance(h, uid) as ItemInstance).id) as ItemDef;
  for (const s of EQUIP_SLOTS) if (h.equip[s] === uid) delete h.equip[s];
  h.equip[slotFor(d, h) as EquipSlot] = uid;
  return true;
}

export function unequip(h: HeroData, slot: EquipSlot): void { delete h.equip[slot]; }

/** Card slot rules (RO): the card's slot type must match the item's equip type; cards can't be removed. */
export function canSocket(h: HeroData, c: ContentBundle, uid: number, cardId: string): string | null {
  const it = instance(h, uid), d = it && itemDef(c, it.id), card = c.cards.find((x) => x.id === cardId);
  if (!it || !d || !card) return 'missing';
  if (it.cards.length >= d.slots) return 'full';
  const kind = d.type === 'offhand' ? 'armor' : d.type === 'cape' ? 'armor' : d.type;
  if (card.slot_type !== 'any' && card.slot_type !== kind) return 'type';
  return null;
}

export function socketCard(h: HeroData, c: ContentBundle, uid: number, cardId: string, cardsOwned: Record<string, number>): boolean {
  if (canSocket(h, c, uid, cardId) !== null || (cardsOwned[cardId] ?? 0) <= 0) return false;
  cardsOwned[cardId] = (cardsOwned[cardId] ?? 0) - 1;
  (instance(h, uid) as ItemInstance).cards.push(cardId);
  return true;
}

export function useItem(h: HeroData, c: ContentBundle, uid: number): Record<string, number> | null {
  const it = instance(h, uid), d = it && itemDef(c, it.id);
  if (!it || !d?.use) return null;
  it.count--;
  if (it.count <= 0) h.bag.splice(h.bag.indexOf(it), 1);
  return d.use;
}

// ───────────── derived build ─────────────
export interface Derived { build: HeroBuild; element: Element; hpRegen: number; spRegen: number; range: number; ranged: boolean; magic: boolean; noKnockback: boolean; shield: number }

const add = (o: Record<string, number>, k: string, v: number) => { o[k] = (o[k] ?? 0) + v; };

/** Spirit team leader: element for a weapon without one + leader skill bonuses (atk_p/def_p/hp_p in %). */
export interface TeamBonus { element: Element | null; effects: Record<string, number> }

/** Everything that changes numbers: base stats + job + equipment (+refine) + cards + passives + active buffs + spirit leader. */
/** Staff normal attack reach (bows: 300). */
export const STAFF_RANGE = 230;

export function derive(h: HeroData, c: ContentBundle, buffs: Buff[] = [], now = 0, team?: TeamBonus): Derived {
  const bonus: Record<string, number> = {};
  let weaponAtk = 0, weaponMatk = 0, element: Element = 'neutral', weaponType = '';
  for (const slot of EQUIP_SLOTS) {
    const it = instance(h, h.equip[slot]), d = it && itemDef(c, it.id);
    if (!it || !d) continue;
    for (const k of ['def', 'hp', 'sp', 'crit', ...STAT_KEYS] as const) add(bonus, k, d[k] ?? 0);
    if (slot === 'weapon') {
      weaponAtk = d.atk + refineAttackBonus(it.refine); weaponMatk = d.matk + Math.floor(refineAttackBonus(it.refine) / 2);
      if (d.element) element = d.element; weaponType = d.subtype;
    } else { add(bonus, 'def', it.refine); add(bonus, 'atk', d.atk); add(bonus, 'matk', d.matk); }
    for (const cid of it.cards) { const card = c.cards.find((x) => x.id === cid); for (const [k, v] of Object.entries(card?.effects ?? {})) if (typeof v === 'number') add(bonus, k, v); }
  }
  for (const [id, lv] of Object.entries(h.skills)) {
    const s = skillDef(c, id);
    if (s?.type === 'passive' && lv > 0) for (const [k, v] of Object.entries(s.effects)) add(bonus, k, fx(v, lv));
  }
  for (const b of buffs) if (b.until > now) for (const [k, v] of Object.entries(b.effects)) add(bonus, k, v);
  for (const [k, v] of Object.entries(team?.effects ?? {})) add(bonus, k, v);
  if (element === 'neutral' && team?.element) element = team.element;
  const stats = { ...h.stats };
  for (const k of STAT_KEYS) stats[k] += bonus[k] ?? 0;
  const job = jobOf(c, h.job);
  const build: HeroBuild = {
    level: h.baseLv, stats, weaponAtk, bonusAtk: bonus.atk ?? 0, bonusDef: bonus.def ?? 0, bonusHp: bonus.hp ?? 0, bonusCrit: bonus.crit ?? 0,
    hpFactor: job.hp_factor, spFactor: job.sp_factor, aspdFactor: job.aspd_factor, weaponMatk, bonusMatk: bonus.matk ?? 0, bonusSp: bonus.sp ?? 0,
    bonusAspd: bonus.aspd ?? 0, bonusSpeed: bonus.speed ?? 0,
    atkStat: weaponType === 'bow' ? 'dex' : 'str', staffMatk: weaponType === 'staff' ? STAFF_MATK : 0,
  };
  // percent bonuses (spirit leader skills) on top of everything else
  if (bonus.atk_p) build.bonusAtk += Math.round((attack(build) * bonus.atk_p) / 100);
  if (bonus.def_p) build.bonusDef += Math.round((defense(build) * bonus.def_p) / 100);
  if (bonus.hp_p) build.bonusHp += Math.round((maxHp(build) * bonus.hp_p) / 100);
  return {
    build, element, hpRegen: bonus.hp_regen ?? 0, spRegen: bonus.sp_regen ?? 0, range: (weaponType === 'staff' ? STAFF_RANGE : 300) + (bonus.range ?? 0),
    // bows shoot arrows; staves shoot a small bolt of magic (still a physical STR hit, as a rod's normal attack in RO)
    ranged: weaponType === 'bow' || weaponType === 'staff', magic: weaponType === 'staff', noKnockback: (bonus.no_knockback ?? 0) > 0, shield: bonus.absorb ?? 0,
  };
}
