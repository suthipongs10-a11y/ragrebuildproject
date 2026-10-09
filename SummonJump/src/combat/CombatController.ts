import Phaser from 'phaser';
import {
  createEnemy, createHeroCombat, MAX_STEP, stepEnemy, stepHeroCombat, stepShots, rollKill, markDefeated, maxHp, isSolidCell, TILE, moveBody,
  type Enemy, type EnemyCtx, type EnemyEvent, type HeroCombat, type HeroBuild, type HeroState, type LevelData, type Rng, type Shot, type TileGrid, type Body, type CombatEvent,
} from '@shared/index';
import type { ContentBundle, MonsterDef } from '@shared/content/types';
import type { SaveData } from '../save/local';
import { EnemyView } from '../actors/EnemyView';
import { popInfo, popNumber } from '../vfx/DamageText';
import { burst, ELEMENT_COLOR, ring, slash, spark } from '../vfx/Effects';
import { t } from '../i18n';

const MAX_FRAME = 1 / 20;

interface Pickup extends Body { kind: 'item' | 'card'; id: string; count: number; age: number; obj: Phaser.GameObjects.Image }

/**
 * Owns everything that fights in a room: enemies (sim + views), hostile shots, drops, the hero's combat state.
 * The scene calls `update()` once per frame and reads `hitstop` / `combat` for rig and feel.
 */
export class CombatController {
  readonly enemies: Enemy[] = [];
  readonly combat: HeroCombat;
  hitstop = 0;
  private readonly views = new Map<string, EnemyView>();
  private readonly shots: Shot[] = [];
  private readonly shotGfx: Phaser.GameObjects.Graphics;
  private readonly pickups: Pickup[] = [];
  private readonly defs: Map<string, MonsterDef>;
  private summonN = 0;

  constructor(
    private readonly scene: Phaser.Scene, private readonly level: LevelData, private readonly grid: TileGrid,
    private readonly content: ContentBundle, private readonly save: SaveData, private readonly build: HeroBuild, private readonly rng: Rng,
    private readonly onSave: () => void,
  ) {
    this.defs = new Map(content.monsters.map((m) => [m.id, m]));
    this.combat = createHeroCombat(build);
    if (save.hp !== null && save.hp > 0) this.combat.hp = Math.min(save.hp, maxHp(build));
    this.shotGfx = scene.add.graphics().setDepth(25).setBlendMode(Phaser.BlendModes.ADD);
  }

  get maxHp(): number { return maxHp(this.build); }

  spawn(id: string, monster: string, x: number, y: number): void {
    const def = this.defs.get(monster);
    if (!def) return;
    const e = createEnemy(id, def, x, y, this.rng);
    this.enemies.push(e);
    this.views.set(e.id, new EnemyView(this.scene, e));
  }

  update(rawDt: number, hero: HeroState, inp: { attackPressed: boolean; attackHeld: boolean; jumpHeld: boolean }, time: number): CombatEvent[] {
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
    for (const s of this.shots) if (!s.ghost && isSolidCell(this.grid.get(Math.floor(s.x / TILE), Math.floor(s.y / TILE)))) s.life = 0;

    const out = stepHeroCombat(this.combat, hero, this.build, this.enemies, this.shots, inp, this.level.water, this.rng, dt);
    for (const ev of out) this.feedback(ev);
    this.removeDead();
    this.updatePickups(dt, hero);
    this.save.hp = this.combat.hp;
    this.draw(time);
    return out;
  }

  private feedback(ev: CombatEvent): void {
    const sc = this.scene;
    if (ev.kind === 'swing') slash(sc, ev.x, ev.y, ev.dir, ELEMENT_COLOR.neutral as number, ev.spec.clip === 'attack3', ev.spec.clip === 'attack2');
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
    if (!e.id.includes('#summon')) markDefeated(this.save.defeated, e.id, e.def.tier, e.def.respawn_sec, Date.now());
    const r = rollKill(e.def, this.content.drops, this.rng);
    this.save.exp += r.exp; this.save.zeny += r.zeny;
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
    const key = kind === 'card' ? 'icon_card' : 'icon_chest';
    const obj = this.scene.add.image(x, y, key).setDepth(9).setScale(28 / 128);
    this.pickups.push({ x: x - 10, y: y - 10, w: 20, h: 20, vx: (this.rng.next() - 0.5) * 200, vy: -400, onGround: false, kind, id, count, age: 0, obj });
  }

  private updatePickups(dt: number, hero: HeroState): void {
    for (const p of [...this.pickups]) {
      p.age += dt;
      if (!p.onGround) { p.vy = Math.min(800, p.vy + 1800 * dt); moveBody(p, dt, this.grid, false, p.y + p.h); if (p.onGround) p.vx = 0; }
      if (this.level.water && p.vy > 120) p.vy = 120;
      p.obj.setPosition(p.x + p.w / 2, p.y + p.h / 2 - (p.onGround ? 4 + Math.sin(p.age * 5) * 3 : 0));
      if (p.age > 0.35 && p.x < hero.x + hero.w + 8 && p.x + p.w > hero.x - 8 && p.y < hero.y + hero.h && p.y + p.h > hero.y) {
        const bag = p.kind === 'card' ? this.save.cards : this.save.inv;
        bag[p.id] = (bag[p.id] ?? 0) + p.count;
        const name = t(p.kind === 'card' ? `card.${p.id.replace(/^card_/, '')}` : `item.${p.id}`);
        popInfo(this.scene, p.x + p.w / 2, p.y - 10, t(p.kind === 'card' ? 'combat.card' : 'combat.got').replace('{name}', name), p.kind === 'card' ? '#e2d2ff' : '#ffd88a');
        burst(this.scene, p.x + p.w / 2, p.y + p.h / 2, p.kind === 'card' ? 0xe2d2ff : 0xffd88a, 10, 200);
        p.obj.destroy(); this.pickups.splice(this.pickups.indexOf(p), 1);
        this.onSave();
      }
    }
  }

  private draw(time: number): void {
    for (const e of this.enemies) this.views.get(e.id)?.sync(e, time);
    const g = this.shotGfx.clear();
    for (const s of this.shots) { g.fillStyle(s.color, 0.9).fillCircle(s.x, s.y, s.r); g.fillStyle(0xffffff, 0.6).fillCircle(s.x, s.y, s.r * 0.45); }
  }

  /** Debug / tests: defeat every monster (goes through the normal kill path). */
  killAll(): void {
    for (const e of this.enemies) { if (!e.dead) { e.dead = true; e.hp = 0; this.kill(e); } }
    this.removeDead();
  }

  heal(): void { this.combat.hp = this.maxHp; this.combat.dead = false; this.save.hp = this.combat.hp; }
}
