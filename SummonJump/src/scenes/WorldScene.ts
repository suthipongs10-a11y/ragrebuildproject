import Phaser from 'phaser';
import { ZONES, queueZone, type ZoneId } from '../assets/packs';
import { buildZoneBackdrop, addPlatform } from '../world/Parallax';
import type { Controls } from '../input/Controls';
import { t } from '../i18n';
import { createRng, moveSpeed, type HeroBuild } from '@shared/index';

const ROOM_W = 1920;
const FLOOR_Y = 470;

/**
 * Phase 0 world: painted parallax zone, flat floor, two platforms, placeholder hero.
 * Platforming feel (coyote, buffer, variable jump) is ported properly in Phase 1.
 */
export class WorldScene extends Phaser.Scene {
  private hero!: Phaser.Physics.Arcade.Image;
  private controls!: Controls;
  private zone: ZoneId = 'forest';
  private hud!: Phaser.GameObjects.Text;
  private readonly rng = createRng(1);
  private build: HeroBuild = { level: 1, stats: { str: 1, agi: 1, vit: 1, int: 1, dex: 1, luk: 1 }, weaponAtk: 6, bonusAtk: 0, bonusDef: 0, bonusHp: 0, bonusCrit: 0 };

  constructor() { super('World'); }

  init(data: { zone?: ZoneId }): void { this.zone = data.zone ?? 'forest'; }

  create(): void {
    this.controls = this.registry.get('controls') as Controls;
    const { width: vw, height: vh } = this.scale;
    this.physics.world.setBounds(0, 0, ROOM_W, vh + 200);
    this.cameras.main.setBounds(0, 0, ROOM_W, vh);

    buildZoneBackdrop(this, this.zone, ROOM_W, vw, vh, FLOOR_Y);

    const solids = this.physics.add.staticGroup();
    const floor = this.add.rectangle(0, FLOOR_Y, ROOM_W, 40).setOrigin(0, 0).setVisible(false);
    solids.add(floor);
    const platforms = this.physics.add.staticGroup();
    addPlatform(this, this.zone, 520, 340, 220, platforms);
    addPlatform(this, this.zone, 1180, 300, 260, platforms);

    this.hero = this.physics.add.image(160, FLOOR_Y - 60, 'hero_design').setDepth(10);
    this.hero.setScale(92 / this.hero.height);
    const body = this.hero.body as Phaser.Physics.Arcade.Body;
    body.setSize(this.hero.width * 0.45, this.hero.height * 0.92).setOffset(this.hero.width * 0.27, this.hero.height * 0.04);
    body.setCollideWorldBounds(true);
    this.physics.add.collider(this.hero, solids);
    this.physics.add.collider(this.hero, platforms);

    this.cameras.main.startFollow(this.hero, true, 0.12, 0.12, 0, 60);
    this.cameras.main.fadeIn(250, 0, 0, 0);

    this.hud = this.add.text(16, 12, '', { fontFamily: 'Itim', fontSize: '20px', color: '#fff6e2', stroke: '#2a1a0a', strokeThickness: 4 }).setScrollFactor(0).setDepth(100);
    this.add.text(vw / 2, 70, t(`zone.${this.zone}`), { fontFamily: 'Itim', fontSize: '40px', color: '#fff6e2', stroke: '#2a1a0a', strokeThickness: 6 })
      .setOrigin(0.5).setScrollFactor(0).setDepth(100).setAlpha(1);
    this.tweens.add({ targets: this.children.list.at(-1), alpha: 0, delay: 1200, duration: 600 });

    // debug zone switch (1-6) to verify every pack loads
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      const i = Number(e.key) - 1;
      const z = ZONES[i];
      if (z && z !== this.zone) this.switchZone(z);
    });
  }

  private switchZone(z: ZoneId): void {
    if (queueZone(this, z)) {
      this.load.once('complete', () => this.scene.restart({ zone: z }));
      this.load.start();
    } else this.scene.restart({ zone: z });
  }

  override update(_t: number, dtMs: number): void {
    const c = this.controls, body = this.hero.body as Phaser.Physics.Arcade.Body;
    const speed = moveSpeed(this.build) * 2.2; // world is 2x the prototype scale
    const dir = (c.state.right ? 1 : 0) - (c.state.left ? 1 : 0);
    body.setVelocityX(Phaser.Math.Linear(body.velocity.x, dir * speed, Math.min(1, (dtMs / 1000) * (body.blocked.down ? 14 : 8))));
    if (dir) this.hero.setFlipX(dir < 0);
    if (c.pressed('jump') && (body.blocked.down || body.touching.down)) body.setVelocityY(-760);
    if (!c.state.jump && body.velocity.y < -300) body.setVelocityY(-300);
    // idle bob so the placeholder reads as alive
    this.hero.setAngle(body.blocked.down && Math.abs(body.velocity.x) > 20 ? Math.sin(this.time.now / 60) * 3 : 0);
    this.hud.setText(`${t('debug.phase0')}   ${Math.round(this.game.loop.actualFps)} fps   rng ${this.rng.next().toFixed(2)}`);
    c.endFrame();
  }
}
