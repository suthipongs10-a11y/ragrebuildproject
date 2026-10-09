import Phaser from 'phaser';
import {
  addItem, createEnemy, createHeroCombat, MAX_STEP, stepEnemy, stepHeroCombat, stepShots, stepSkills, useSkill, rollKill, markDefeated, maxHp, maxSp, isSolidCell, TILE, moveBody,
  addGauge, addRune, createSpiritWorld, followSpirits, rollRuneDrop, spiritLifesteal, stepSpirits, teamExp, ultimate,
  type Enemy, type EnemyCtx, type EnemyEvent, type HeroCombat, type HeroState, type LevelData, type Rng, type Shot, type TileGrid, type Body, type CombatEvent, type SkillCtx, type SkillEvent,
  type SpiritEvent, type SpiritStepCtx, type SpiritWorld, type UltResult,
} from '@shared/index';
import type { MonsterDef } from '@shared/content/types';
import type { SaveData } from '../save/local';
import type { HeroSession } from '../hero/HeroSession';
import { EnemyView } from '../actors/EnemyView';
import { popInfo, popNumber } from '../vfx/DamageText';
import { burst, ELEMENT_COLOR, ring, slash, spark } from '../vfx/Effects';
import { SkillFx } from '../vfx/SkillFx';
import { t } from '../i18n';
import { SpiritViews } from '../spirits/SpiritViews';

const MAX_FRAME = 1 / 20;

interface Pickup extends Body { kind: 'item' | 'card'; id: string; count: number; age: number; obj: Phaser.GameObjects.Image }
export type LevelUpEvent = { kind: 'levelup'; base: number; job: number };

/**
 * Owns everything that fights in a room: enemies (sim + views), shots, skill zones, drops and the hero's combat state.
 * Rewards go to the HeroSession (levels, bag). The scene calls `update()` once per frame.
 */
export class CombatController {
  readonly enemies: Enemy[] = [];
  readonly combat: HeroCombat;
  hitstop = 0;
  private readonly views = new Map<string, EnemyView>();
  private readonly shots: Shot[] = [];
  private readonly fx: SkillFx;
  private readonly pickups: Pickup[] = [];
  private readonly defs: Map<string, MonsterDef>;
  private summonN = 0;
  private buffCheck = 0;
  readonly levelUps: LevelUpEvent[] = [];
  spirits: SpiritWorld;
  private readonly spiritViews: SpiritViews;
  private heroDir = 1;

  constructor(
    private readonly scene: Phaser.Scene, private readonly level: LevelData, private readonly grid: TileGrid,
    private readonly session: HeroSession, private readonly save: SaveData, private readonly rng: Rng, private readonly onSave: () => void,
  ) {
    this.defs = new Map(session.content.monsters.map((m) => [m.id, m]));
    this.combat = createHeroCombat(session.derived.build);
    const hp = session.data.hp;
    if (hp !== null && hp > 0) this.combat.hp = Math.min(hp, this.maxHp);
    this.fx = new SkillFx(scene);
    this.spirits = createSpiritWorld(session.box, session.content, { x: 0, y: 0, w: 0, h: 0, vx: 0, vy: 0, onGround: false });
    this.spiritViews = new SpiritViews(scene, session.content);
  }

  /** (Re)build the team around the hero: room start and after team / rune / awaken changes. */
  resetSpirits(hero: Body): void {
    this.spirits = createSpiritWorld(this.session.box, this.session.content, hero, this.spirits);
  }

  private spiritCtx(): SpiritStepCtx {
    const s = this.session;
    return { content: s.content, enemies: this.enemies, shots: this.shots, rng: this.rng, combat: this.combat, build: s.derived.build };
  }

  /** Leader's ultimate on the given monsters (on screen). Hits are already applied; play them with `ultHit`. */
  ultimate(targets: Enemy[]): UltResult | null {
    const r = ultimate(this.spirits, this.spiritCtx(), targets, this.session.rt.time);
    if (r) this.session.box.gauge = 0;
    return r;
  }

  /** Show one ultimate hit (numbers, sparks, kill rewards) — called by the cinematic, wave by wave. */
  ultHit(ev: CombatEvent): void { this.feedback(ev, false); }

  get maxHp(): number { return maxHp(this.session.derived.build); }
  get maxSp(): number { return maxSp(this.session.derived.build); }

  /** The mini-boss / MVP in this room (shown with a big HP bar), if alive. */
  get boss(): Enemy | undefined { return this.enemies.find((e) => !e.dead && e.def.tier !== 'normal'); }

  spawn(id: string, monster: string, x: number, y: number): void {
    const def = this.defs.get(monster);
    if (!def) return;
    const e = createEnemy(id, def, x, y, this.rng);
    this.enemies.push(e);
    this.views.set(e.id, new EnemyView(this.scene, e));
  }

  private skillCtx(hero: HeroState): SkillCtx {
    const s = this.session;
    return { hero, combat: this.combat, data: s.data, derived: s.derived, content: s.content, enemies: this.enemies, shots: this.shots, grid: this.grid, rng: this.rng };
  }

  /** On-screen skill button / key. Returns the events so the scene can play rig clips and messages. */
  cast(hero: HeroState, id: string): SkillEvent[] {
    const ev = useSkill(this.session.rt, this.skillCtx(hero), id);
    if (ev.some((e) => e.kind === 'cast' || e.kind === 'cast_start')) this.spirits.lastSkill = this.session.rt.time; // COMBO window
    this.handleSkillEvents(ev);
    return ev;
  }

  update(rawDt: number, hero: HeroState, inp: { attackPressed: boolean; attackHeld: boolean; jumpHeld: boolean }, time: number): (CombatEvent | SkillEvent)[] {
    if (this.hitstop > 0) { this.hitstop -= rawDt; this.draw(time); return []; }
    const dt = Math.min(rawDt, MAX_FRAME);
    const events: EnemyEvent[] = [];
    const ctx: EnemyCtx = {
      grid: this.grid, rng: this.rng, hero, water: this.level.water, shots: this.shots, events,
      summon: (m, x, y) => this.spawn(`${this.level.id}#summon${this.summonN++}`, m, x, y),
      count: (m) => this.enemies.filter((e) => !e.dead && e.def.id === m).length,
    };
    // sub-step like the hero so a slow frame never tunnels monsters through floors
    for (let left = dt; left > 1e-6; left -= MAX_STEP) for (const e of [...this.enemies]) stepEnemy(e, ctx, Math.min(left, MAX_STEP));
    for (const ev of events) {
      if (ev.kind === 'slam') { this.scene.cameras.main.shake(180, 0.006); ring(this.scene, ev.x, ev.y, 0xffd6e6, 80); burst(this.scene, ev.x, ev.y, 0xe8d6b0, 10, 200); }
    }
    stepShots(this.shots, dt);
    for (const s of this.shots) if (!s.ghost && (s.delay ?? 0) <= 0 && isSolidCell(this.grid.get(Math.floor(s.x / TILE), Math.floor(s.y / TILE)))) s.life = 0;

    const s = this.session, d = s.derived;
    const skillEv = stepSkills(s.rt, this.skillCtx(hero), dt);
    this.handleSkillEvents(skillEv);
    const out = stepHeroCombat(this.combat, hero, d.build, this.enemies, this.shots, inp, this.level.water, this.rng, dt,
      { element: d.element, ranged: d.ranged, range: d.range, noKnockback: d.noKnockback, blocked: !!s.rt.cast });
    for (const ev of out) this.feedback(ev);
    followSpirits(this.spirits, hero, time, dt);
    this.heroDir = hero.dir;
    const sev = stepSpirits(this.spirits, this.spiritCtx(), dt);
    for (const ev of sev) this.spiritFeedback(ev);
    // buffs expire → recompute derived stats
    this.buffCheck -= dt;
    if (this.buffCheck <= 0) { this.buffCheck = 0.5; const n = s.rt.buffs.length; s.rt.buffs = s.rt.buffs.filter((b) => b.until > s.rt.time); if (n !== s.rt.buffs.length) s.recompute(); }
    this.removeDead();
    this.updatePickups(dt, hero);
    s.data.hp = this.combat.hp; s.data.sp = s.rt.sp;
    this.draw(time);
    return [...skillEv, ...out];
  }

  private handleSkillEvents(ev: SkillEvent[]): void {
    for (const e of ev) {
      this.fx.play(e);
      if (e.kind === 'buff') this.session.recompute();
      if (e.kind === 'hit' || e.kind === 'hurt') this.feedback(e);
    }
  }

  private spiritFeedback(ev: CombatEvent | SpiritEvent): void {
    const sc = this.scene;
    if (ev.kind === 'scast') burst(sc, ev.actor.x, ev.actor.y, ELEMENT_COLOR[ev.actor.el] ?? 0xffffff, 6, 120);
    else if (ev.kind === 'sheal') popNumber(sc, ev.x, ev.y - 10, ev.amount, 'heal');
    else if (ev.kind === 'sshield') ring(sc, ev.x, ev.y, 0x9ad8ff, 30, 300);
    else this.feedback(ev);
  }

  private feedback(ev: CombatEvent | SkillEvent, gauge = true): void {
    const sc = this.scene;
    if (ev.kind === 'hit' && gauge) {
      const c = this.session.content;
      addGauge(this.spirits, c, ev.spirit ? 'spirit' : 'hero');
      if (ev.killed) addGauge(this.spirits, c, 'kill');
      if (ev.spirit) { const heal = spiritLifesteal(this.spirits, ev.amount); if (heal > 0) this.combat.hp = Math.min(this.maxHp, this.combat.hp + heal); }
      this.session.box.gauge = this.spirits.gauge;
    }
    if (ev.kind === 'swing') { if (!this.session.derived.ranged) slash(sc, ev.x, ev.y, ev.dir, ELEMENT_COLOR[this.session.derived.element] as number, ev.spec.clip === 'attack3', ev.spec.clip === 'attack2'); }
    else if (ev.kind === 'hit') {
      popNumber(sc, ev.x, ev.y - 10, ev.amount, ev.dmg === 'normal' ? 'normal' : ev.dmg);
      spark(sc, ev.x + (Math.random() - 0.5) * 8, ev.y + 14, ELEMENT_COLOR[ev.enemy.def.element] ?? 0xffffff, ev.dmg === 'crit' ? 1.6 : 1);
      this.hitstop = Math.max(this.hitstop, ev.hitstop);
      if (ev.dmg === 'crit') sc.cameras.main.shake(120, 0.005);
      if (ev.stomp) ring(sc, ev.x, ev.enemy.y, 0xffffff, 36, 250);
      if (ev.killed) this.kill(ev.enemy);
    } else if (ev.kind === 'hurt') {
      popNumber(sc, ev.x, ev.y - 6, ev.amount, 'taken');
      sc.cameras.main.shake(140, 0.006); this.hitstop = Math.max(this.hitstop, 0.05);
    }
  }

  private kill(e: Enemy): void {
    const sc = this.scene, cx = e.x + e.w / 2, cy = e.y + e.h / 2, boss = e.def.tier !== 'normal';
    burst(sc, cx, cy, boss ? 0xffd88a : 0xfff2cc, boss ? 40 : 14, boss ? 480 : 280);
    ring(sc, cx, cy, boss ? 0xffd88a : 0xffffff, boss ? 160 : 60, 400);
    if (boss) { this.hitstop = Math.max(this.hitstop, 0.18); sc.cameras.main.flash(300, 255, 243, 208); sc.cameras.main.shake(400, 0.01); }
    this.views.get(e.id)?.die(); this.views.delete(e.id);
    if (!e.id.includes('#summon') && !e.id.startsWith('stress#')) markDefeated(this.save.defeated, e.id, e.def.tier, e.def.respawn_sec, Date.now());
    const r = rollKill(e.def, this.session.content.drops, this.rng, 1 + this.session.derived.build.stats.luk * 0.03);
    this.save.zeny += r.zeny;
    const lv = this.session.reward(r.exp, r.jobExp);
    if (lv.baseUps || lv.jobUps) this.levelUps.push({ kind: 'levelup', base: lv.baseUps, job: lv.jobUps });
    const box = this.session.box;
    if (teamExp(box, r.exp).length) { popInfo(sc, cx, e.y - 70, t('spirit.levelup'), '#8ff0bf'); this.resetSpirits({ x: cx, y: cy, w: 0, h: 0, vx: 0, vy: 0, onGround: false }); }
    const rune = rollRuneDrop(this.session.content, e.def.tier, this.rng, 1 + this.session.derived.build.stats.luk * 0.02);
    if (rune) { addRune(box, rune); popInfo(sc, cx, e.y - 95, t('spirit.runeDrop').replace('{n}', String(rune.star)), '#c9a6ff'); }
    popInfo(sc, cx, e.y - 20, `${t('combat.exp').replace('{n}', String(r.exp))}  ${t('combat.zeny').replace('{n}', String(r.zeny))}`);
    for (const d of r.drops) this.dropPickup(cx, cy, d.kind, d.id, d.count);
    if (boss) popInfo(sc, cx, e.y - 50, t('combat.boss').replace('{name}', t(e.def.name_key)), '#ffd88a');
    this.onSave();
  }

  private removeDead(): void {
    for (let i = this.enemies.length - 1; i >= 0; i--) if ((this.enemies[i] as Enemy).dead) this.enemies.splice(i, 1);
    for (let i = this.shots.length - 1; i >= 0; i--) if ((this.shots[i] as Shot).life <= 0) this.shots.splice(i, 1);
  }

  private dropPickup(x: number, y: number, kind: 'item' | 'card', id: string, count: number): void {
    const icon = kind === 'card' ? 'icon_card' : (this.session.content.items.find((i) => i.id === id)?.type === 'consumable' ? 'icon_potion_r' : 'icon_chest');
    const obj = this.scene.add.image(x, y, this.scene.textures.exists(icon) ? icon : 'icon_chest').setDepth(9).setScale(28 / 128);
    this.pickups.push({ x: x - 10, y: y - 10, w: 20, h: 20, vx: (this.rng.next() - 0.5) * 200, vy: -400, onGround: false, kind, id, count, age: 0, obj });
  }

  private updatePickups(dt: number, hero: HeroState): void {
    for (const p of [...this.pickups]) {
      p.age += dt;
      if (!p.onGround) { p.vy = Math.min(800, p.vy + 1800 * dt); moveBody(p, dt, this.grid, false, p.y + p.h); if (p.onGround) p.vx = 0; }
      if (this.level.water && p.vy > 120) p.vy = 120;
      p.obj.setPosition(p.x + p.w / 2, p.y + p.h / 2 - (p.onGround ? 4 + Math.sin(p.age * 5) * 3 : 0));
      if (p.age > 0.35 && p.x < hero.x + hero.w + 8 && p.x + p.w > hero.x - 8 && p.y < hero.y + hero.h && p.y + p.h > hero.y) {
        if (p.kind === 'card') this.save.cards[p.id] = (this.save.cards[p.id] ?? 0) + p.count;
        else if (!addItem(this.session.data, this.session.content, p.id, p.count)) { popInfo(this.scene, p.x, p.y - 10, t('combat.bagfull'), '#ff9b9b'); continue; }
        const name = t(p.kind === 'card' ? `card.${p.id.replace(/^card_/, '')}` : `item.${p.id}`);
        popInfo(this.scene, p.x + p.w / 2, p.y - 10, t(p.kind === 'card' ? 'combat.card' : 'combat.got').replace('{name}', name), p.kind === 'card' ? '#e2d2ff' : '#ffd88a');
        burst(this.scene, p.x + p.w / 2, p.y + p.h / 2, p.kind === 'card' ? 0xe2d2ff : 0xffd88a, 10, 200);
        p.obj.destroy(); this.pickups.splice(this.pickups.indexOf(p), 1);
        this.session.emit();
        this.onSave();
      }
    }
  }

  private draw(time: number): void {
    for (const e of this.enemies) this.views.get(e.id)?.sync(e, time);
    this.fx.draw(this.shots, this.session.rt.zones, time);
    this.spiritViews.sync(this.spirits, this.session.box, this.heroDir);
  }

  setSpiritsVisible(on: boolean): void { this.spiritViews.setVisible(on); }

  /** Debug / tests: defeat every monster (goes through the normal kill path). */
  killAll(): void {
    for (const e of this.enemies) { if (!e.dead) { e.dead = true; e.hp = 0; this.kill(e); } }
    this.removeDead();
  }

  heal(): void { this.combat.hp = this.maxHp; this.combat.dead = false; this.session.rt.sp = this.maxSp; this.session.data.hp = this.combat.hp; }
}
