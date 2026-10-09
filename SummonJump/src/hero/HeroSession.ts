import {
  addItem, changeJob, expToNext, derive, gainExp, jobOf, learnSkill, maxHp, maxSp, newHero, newSkillRuntime, raiseStat,
  type ContentBundle, type Derived, type HeroData, type JobId, type LevelUpResult, type SkillRuntime, type StatKey,
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
    this.recompute();
    this.rt = newSkillRuntime(save.hero.sp ?? maxSp(this.derived.build));
  }

  get data(): HeroData { return this.save.hero as HeroData; }

  recompute(): void {
    this.derived = derive(this.data, this.content, this.rt?.buffs ?? [], this.rt?.time ?? 0);
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

/** First load after Phase 2: build the hero from the old counters. */
function migrate(save: SaveData, content: ContentBundle): HeroData {
  const debug = new URLSearchParams(typeof location === 'undefined' ? '' : location.search).get('hero');
  if (debug) return testHero(content, debug);
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
  return h;
}
