import { Container, Graphics, Sprite } from 'pixi.js';
import type { Content } from '../../data/content';
import { formation, maxHp } from '../../sim/team';
import type { RunState, SpawnedEnemy } from '../../sim/types';
import { TUNING, prefersReducedMotion } from '../anim/tuning';
import { arc, type Tweener } from '../anim/tween';
import type { GameAssets } from '../assets';
import { LAYOUT } from '../layout';
import { UI_COLOR } from '../theme';
import { Actor } from './Actor';
import { FxLayer } from './FxLayer';

const FRAME_LINE = 4;
const BOSS_Z = 5;

/** The right-hand battlefield: backdrop, both lines of fighters, effects. */
export class BattleView extends Container {
  readonly fx: FxLayer;
  private readonly world = new Container();
  private readonly actorLayer = new Container();
  private readonly actors = new Map<number, Actor>();
  private readonly enemyIds = new Map<number, string>();
  private elapsed = 0;

  constructor(
    private readonly content: Content,
    private readonly assets: GameAssets,
    private readonly tweener: Tweener,
    backdropId: string,
  ) {
    super();
    const { width, height } = LAYOUT.battle;
    const backdrop = new Sprite(assets.image(backdropId));
    // Cover the viewport, keeping the ground band of the painting in view.
    const scale = Math.max(width / backdrop.texture.width, height / backdrop.texture.height);
    backdrop.scale.set(scale);
    backdrop.position.set((width - backdrop.texture.width * scale) / 2, height - backdrop.texture.height * scale);
    const mask = new Graphics().rect(0, 0, width, height).fill(UI_COLOR.black);
    this.fx = new FxLayer(assets, tweener);
    this.actorLayer.sortableChildren = true;
    this.world.addChild(backdrop, this.actorLayer, this.fx);
    this.world.mask = mask;
    const frame = new Graphics().rect(0, 0, width, height).stroke({ width: FRAME_LINE, color: UI_COLOR.panelLine });
    this.addChild(this.world, mask, frame);
  }

  actor(uid: number): Actor | undefined {
    return this.actors.get(uid);
  }

  monsterIdOf(uid: number): string | undefined {
    return this.enemyIds.get(uid);
  }

  /** Every frame. */
  update(deltaMs: number): void {
    this.elapsed += deltaMs;
    for (const actor of this.actors.values()) actor.breathe(this.elapsed);
  }

  private teamSpot(slot: number): { x: number; y: number } {
    const { centerX, frontOffset, teamGap, ground, depthStep } = LAYOUT.battle;
    return { x: centerX - frontOffset - slot * teamGap, y: ground + (slot % 2) * depthStep };
  }

  private enemySpot(slot: number, count: number, boss: boolean): { x: number; y: number } {
    const { centerX, frontOffset, enemyGap, ground, depthStep, bossOffset } = LAYOUT.battle;
    if (boss && slot === 0) return { x: centerX + bossOffset, y: ground + depthStep };
    const gap = count > 3 ? enemyGap * 0.8 : enemyGap;
    return { x: centerX + frontOffset + slot * gap + (boss ? bossOffset : 0), y: ground + (slot % 2) * depthStep };
  }

  private place(actor: Actor, spot: { x: number; y: number }): void {
    actor.position.set(spot.x, spot.y);
    actor.zIndex = spot.y;
  }

  /** Removes every fighter: a new run starts from an empty field. */
  clear(): void {
    for (const actor of this.actors.values()) this.actorLayer.removeChild(actor);
    this.actors.clear();
    this.enemyIds.clear();
  }

  /** A recruit walks on mid-playback: add just that fighter and close ranks, leaving everyone's HP as shown. */
  addUnit(state: RunState, uid: number, hp: number): void {
    const unit = state.team.find((u) => u.uid === uid);
    const def = unit ? this.content.units[unit.unitId] : undefined;
    if (!unit || !def || this.actors.has(uid)) return;
    const actor = new Actor(this.assets, this.tweener, `${def.sprite}_t1`, 1, LAYOUT.hpBar.width, UI_COLOR.hpTeam);
    actor.setHp(hp, hp, 0, false);
    this.actors.set(uid, actor);
    this.actorLayer.addChild(actor);
    formation(this.content, state).forEach((member, slot) => {
      const existing = this.actors.get(member.uid);
      if (existing) this.place(existing, this.teamSpot(slot));
    });
  }

  /** Rebuilds the team from the authoritative state (called after every action has played out). */
  syncTeam(state: RunState): void {
    const line = formation(this.content, state);
    for (const unit of state.team) {
      const def = this.content.units[unit.unitId];
      if (!def) continue;
      const prefix = `${def.sprite}_t${unit.tier}`;
      let actor = this.actors.get(unit.uid);
      if (!actor) {
        actor = new Actor(this.assets, this.tweener, prefix, 1, LAYOUT.hpBar.width, UI_COLOR.hpTeam);
        this.actors.set(unit.uid, actor);
        this.actorLayer.addChild(actor);
      } else actor.setPrefix(prefix);
      if (unit.hp > 0 && actor.dead) actor.revive();
      const slot = line.findIndex((u) => u.uid === unit.uid);
      if (slot >= 0) this.place(actor, this.teamSpot(slot));
      actor.setHp(unit.hp, maxHp(this.content, state, unit), unit.shield, false);
    }
  }

  /** Puts a new wave (or gate fight) on the field, walking in from the right. */
  async spawnEnemies(enemies: SpawnedEnemy[]): Promise<void> {
    for (const [uid, actor] of this.actors) {
      if (this.enemyIds.has(uid)) {
        // Not destroyed: a recover/hurt tween may still be finishing on it.
        this.actorLayer.removeChild(actor);
        this.actors.delete(uid);
      }
    }
    this.enemyIds.clear();
    const entrances: Array<Promise<void>> = [];
    enemies.forEach((enemy, slot) => {
      const def = this.content.monsters[enemy.monsterId];
      if (!def) return;
      const boss = def.traits.includes('boss') || def.traits.includes('elite');
      const actor = new Actor(this.assets, this.tweener, def.sprite, -1, boss ? LAYOUT.hpBar.bossWidth : LAYOUT.hpBar.width, UI_COLOR.hpEnemy);
      this.actors.set(enemy.uid, actor);
      this.enemyIds.set(enemy.uid, enemy.monsterId);
      this.actorLayer.addChild(actor);
      this.place(actor, this.enemySpot(slot, enemies.length, boss));
      if (boss) actor.zIndex += BOSS_Z;
      actor.setHp(enemy.hp, enemy.hp, 0, false);
      entrances.push(this.tweener.wait(slot * TUNING.spawn.stagger).then(() => actor.enter(LAYOUT.battle.width + 140)));
      actor.alpha = 0;
    });
    await Promise.all(entrances);
  }

  /** Enemies already on the field when a saved run is opened. */
  syncEnemies(state: RunState): void {
    for (const enemy of state.enemies) this.actors.get(enemy.uid)?.setHp(enemy.hp, enemy.maxHp, 0, false);
  }

  shake(amount: number): void {
    if (prefersReducedMotion()) return;
    void this.tweener.run(TUNING.shake.duration, (t) => {
      this.world.x = Math.sin(t * Math.PI * 6) * amount * (1 - t);
      this.world.y = arc(t) * amount * 0.4;
    });
  }
}
