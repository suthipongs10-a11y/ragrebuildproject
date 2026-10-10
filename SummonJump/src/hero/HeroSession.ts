import {
  addItem, addRune, addSpirit, bookBonus, changeJob, emptyArena, emptyBook, noteDex, createRng, rollRune, equip, expToNext, derive, gainExp, jobOf, leaderBonus, learnSkill, maxHp, maxSp, newHero, newSkillRuntime, raiseStat, starterBox,
  type ContentBundle, type Derived, type HeroData, type JobId, type LevelUpResult, type SkillRuntime, type SpiritBox, type StatKey, type BookData, type ArenaState,
} from '@shared/index';
import type { SaveData } from '../save/local';

/**
 * The hero across rooms: persistent HeroData (in the save) + runtime skill state (SP, cooldowns, buffs).
 * Lives in the Phaser registry so it survives scene restarts on room changes.
 */
export class HeroSession {
  readonly rt: SkillRuntime;
  derived!: Derived;
  private listeners = new Set<() => void>();

  constructor(readonly content: ContentBundle, readonly save: SaveData) {
    if (!save.hero) save.hero = migrate(save, content);
    if (!save.spirits) save.spirits = newBox(content, save.hero);
    if (!save.book) { save.book = emptyBook(); for (const id of Object.keys(save.cards)) save.book.cards[id] = true; }
    noteDex(save.book, save.spirits);
    this.recompute();
    this.rt = newSkillRuntime(save.hero.sp ?? maxSp(this.derived.build));
  }

  get data(): HeroData { return this.save.hero as HeroData; }
  get box(): SpiritBox { return this.save.spirits as SpiritBox; }
  get book(): BookData { return this.save.book as BookData; }
  get arena(): ArenaState { this.save.arena ??= emptyArena(); return this.save.arena; }

  recompute(): void {
    const lead = leaderBonus(this.box, this.content), perm = bookBonus(this.content, this.book);
    for (const [k, v] of Object.entries(lead.effects)) perm[k] = (perm[k] ?? 0) + v;
    this.derived = derive(this.data, this.content, this.rt?.buffs ?? [], this.rt?.time ?? 0, { element: lead.element, effects: perm });
    const mh = maxHp(this.derived.build), ms = maxSp(this.derived.build);
    if (this.rt) this.rt.sp = Math.min(this.rt.sp, ms);
    if (this.data.hp !== null) this.data.hp = Math.min(this.data.hp, mh);
    this.emit();
  }

  /** UI subscribes to refresh menus/HUD after any change. */
  onChange(f: () => void): () => void { this.listeners.add(f); return () => this.listeners.delete(f); }
  emit(): void { for (const f of this.listeners) f(); }

  reward(baseExp: number, jobExp: number): LevelUpResult {
    const r = gainExp(this.data, this.content, baseExp, jobExp);
    if (r.baseUps || r.jobUps) this.recompute();
    return r;
  }
}

/** Starter spirits (Phase 4). `?hero=` test heroes also get one of every family + scrolls and essences to try everything. */
function newBox(content: ContentBundle, hero: HeroData): SpiritBox {
  const b = starterBox(content, hero);
  if (new URLSearchParams(typeof location === 'undefined' ? '' : location.search).get('hero')) {
    for (const f of content.spirits) if (!b.spirits.some((s) => s.id === f.id)) addSpirit(b, content, f.id, f.element);
    for (const [id, n] of [['scroll_mystic', 30], ['scroll_element', 10], ['scroll_ld', 10], ['scroll_normal', 20], ['ess_magic', 60]] as const) addItem(hero, content, id, n);
    for (const e of content.spiritElements) addItem(hero, content, e.essence, 40);
    const rng = createRng(7);
    for (let i = 0; i < 18; i++) addRune(b, rollRune(content, rng, 3 + (i % 4), i % 5, undefined, 1 + (i % 6)));
  }
  return b;
}

/** First load after Phase 2: build the hero from the old counters. */
function migrate(save: SaveData, content: ContentBundle): HeroData {
  const debug = new URLSearchParams(typeof location === 'undefined' ? '' : location.search).get('hero');
  if (debug) { save.soul = Math.max(save.soul, 20000); for (const c of content.cards) save.cards[c.id] = 1; return testHero(content, debug); }
  const h = newHero(content);
  gainExp(h, content, save.exp, Math.round(save.exp * 0.6));
  for (const [id, n] of Object.entries(save.inv)) addItem(h, content, id, n);
  return h;
}

const MAIN: Record<JobId, StatKey[]> = { novice: ['str', 'vit', 'agi'], swordsman: ['str', 'vit', 'agi'], mage: ['int', 'dex', 'vit'], archer: ['dex', 'agi', 'luk'], acolyte: ['int', 'vit', 'dex'] };

/** `?hero=mage:30` — owner testing: a hero of that job and level with points spent and every skill learned. */
export function testHero(content: ContentBundle, spec: string): HeroData {
  const [jobRaw, lvRaw] = spec.split(':');
  const job = (content.jobs.some((j) => j.id === jobRaw) ? jobRaw : 'swordsman') as JobId;
  const lv = Math.max(1, Math.min(99, Number(lvRaw) || 30));
  const h = newHero(content);
  gainExp(h, content, 0, 1e7);
  while ((h.skills.basic_skill ?? 0) < 9 && learnSkill(h, content, 'basic_skill')) { /* learn */ }
  if (job !== 'novice') changeJob(h, content, job);
  let need = 0; for (let l = 1; l < lv; l++) need += expToNext(l);
  gainExp(h, content, need, 1e7);
  const keys = MAIN[job];
  for (let i = 0; h.statPoints > 1 && i < 500; i++) raiseStat(h, keys[i % keys.length] as StatKey);
  for (let pass = 0; pass < 12 && h.skillPoints > 0; pass++) for (const s of jobOf(content, job).skills) learnSkill(h, content, s);
  // ready-to-play gear: the best item this job can wear in every slot at this level, plus potions
  const slots: Record<string, string[]> = { weapon: ['weapon'], offhand: ['offhand'], head: ['head'], armor: ['armor'], cape: ['cape'], shoes: ['shoes'], acc: ['acc', 'acc'] };
  for (const types of Object.values(slots)) {
    const used = new Set<string>();
    for (const type of types) {
      const best = content.items
        .filter((d) => d.type === type && !used.has(d.id) && d.level_req <= lv && (d.job_mask.includes('all') || d.job_mask.includes(job)) && (type !== 'weapon' || jobOf(content, job).weapons.includes(d.subtype)))
        .sort((a, b) => b.level_req - a.level_req || b.price - a.price)[0];
      if (!best) continue;
      used.add(best.id);
      const it = addItem(h, content, best.id);
      if (it) { if (type === 'weapon') it.refine = 4; equip(h, content, it.uid); }
    }
  }
  const PICK: Record<JobId, string[]> = { novice: ['first_aid'], swordsman: ['power_slash', 'magnum_burst', 'dash_strike'], mage: ['fire_bolt', 'frost_nova', 'fire_wall'], archer: ['double_strafe', 'arrow_shower', 'ankle_trap'], acolyte: ['heal', 'holy_light', 'blessing'] };
  h.slots = [0, 1, 2].map((i) => { const id = PICK[job][i]; return id && (h.skills[id] ?? 0) > 0 ? id : (h.slots[i] ?? null); });
  addItem(h, content, 'potion_red', 15); addItem(h, content, 'potion_orange', 10); addItem(h, content, 'potion_blue', 5);
  return h;
}
