import { Container, Graphics, Sprite } from 'pixi.js';
import { TUNING } from '../anim/tuning';
import { arc, easeIn, easeOut, type Tweener } from '../anim/tween';
import type { GameAssets } from '../assets';
import { LAYOUT } from '../layout';
import { UI_COLOR } from '../theme';

const HP_RADIUS = 3;
const WHITE = 0xffffff;

/** A fighter on the battlefield: sprite, pose frames, HP bar and its own little animations. */
export class Actor extends Container {
  readonly body = new Sprite();
  private readonly bar = new Graphics();
  private hp = 1;
  private maxHp = 1;
  private shownHp = 1;
  private shield = 0;
  private breathSeed = 0;
  dead = false;

  constructor(
    private readonly assets: GameAssets,
    private readonly tweener: Tweener,
    /** e.g. `char_warrior_t1` or `mon_sand_wolf`. */
    private spritePrefix: string,
    /** +1 for the team (faces right), -1 for enemies. */
    private readonly facing: 1 | -1,
    private readonly barWidth: number,
    private readonly barColor: number,
  ) {
    super();
    this.body.anchor.set(0.5, 1);
    this.addChild(this.body, this.bar);
    this.bar.position.set(-barWidth / 2, LAYOUT.hpBar.offsetY);
    this.setPose('idle');
    this.breathSeed = Math.abs(this.hashOf(spritePrefix)) % TUNING.idle.breathPeriod;
  }

  private hashOf(text: string): number {
    let hash = 0;
    for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) | 0;
    return hash;
  }

  setPrefix(prefix: string): void {
    this.spritePrefix = prefix;
    this.setPose('idle');
  }

  /** Falls back to idle when a creature has no art for the pose (e.g. no `windup`). */
  setPose(pose: string): void {
    const id = `${this.spritePrefix}_${pose}`;
    this.body.texture = this.assets.frame(this.assets.has(id) ? id : `${this.spritePrefix}_idle`);
  }

  setHp(hp: number, maxHp: number, shield: number, animate: boolean): void {
    const from = this.shownHp;
    this.hp = Math.max(0, hp);
    this.maxHp = Math.max(1, maxHp);
    this.shield = shield;
    if (!animate) {
      this.shownHp = this.hp;
      this.drawBar();
      return;
    }
    void this.tweener.run(TUNING.hpBar.tween, (t) => {
      this.shownHp = from + (this.hp - from) * t;
      this.drawBar();
    }, easeOut);
  }

  changeHp(delta: number, shieldDelta = 0): void {
    this.setHp(this.hp + delta, Math.max(this.maxHp, this.hp + delta), Math.max(0, this.shield + shieldDelta), true);
  }

  private drawBar(): void {
    const { height } = LAYOUT.hpBar;
    const share = Math.max(0, Math.min(1, this.shownHp / this.maxHp));
    this.bar.clear().roundRect(-1, -1, this.barWidth + 2, height + 2, HP_RADIUS).fill(UI_COLOR.hpBack);
    if (share > 0) this.bar.roundRect(0, 0, this.barWidth * share, height, HP_RADIUS).fill(this.barColor);
    if (this.shield > 0) this.bar.roundRect(0, -height * 0.6, Math.min(this.barWidth, this.barWidth * (this.shield / this.maxHp) * 3), height * 0.4, 2).fill(UI_COLOR.shield);
  }

  /** Called every frame: the idle "breathing" (no allocation here). */
  breathe(timeMs: number): void {
    if (this.dead) return;
    const phase = ((timeMs + this.breathSeed) % TUNING.idle.breathPeriod) / TUNING.idle.breathPeriod;
    this.body.scale.y = 1 + TUNING.idle.breathScale * Math.sin(phase * Math.PI * 2);
  }

  /** Crouch, lunge forward switching to the attack frame, then spring back. Resolves at the moment of impact. */
  async attack(pose = 'attack'): Promise<void> {
    const { crouch, lunge, hold, recover, lungeDistance } = TUNING.attack;
    await this.tweener.run(crouch, (t) => {
      this.body.x = -this.facing * 8 * t;
    }, easeOut);
    this.setPose(pose);
    await this.tweener.run(lunge, (t) => {
      this.body.x = this.facing * (-8 + (lungeDistance + 8) * t);
    }, easeIn);
    void this.tweener
      .wait(hold)
      .then(() => this.tweener.run(recover, (t) => {
        this.body.x = this.facing * lungeDistance * (1 - t);
      }, easeOut))
      .then(() => {
        if (!this.dead) this.setPose('idle');
      });
  }

  /** Hurt frame, tint flash and a small shove backwards. */
  hurt(): void {
    if (this.dead) return;
    this.setPose('hurt');
    this.body.tint = TUNING.hurt.flashTint;
    void this.tweener
      .run(TUNING.hurt.duration, (t) => {
        this.body.x = -this.facing * TUNING.hurt.knockback * arc(t);
      })
      .then(() => {
        this.body.tint = WHITE;
        if (!this.dead) this.setPose('idle');
      });
  }

  async die(pose: string | null): Promise<void> {
    this.dead = true;
    this.bar.visible = false;
    if (pose) this.setPose(pose);
    await this.tweener.run(TUNING.death.duration, (t) => {
      this.body.scale.set(1 + 0.15 * t, 1 - 0.75 * t);
      this.body.alpha = 1 - t;
    }, easeIn);
    this.visible = false;
  }

  /** Stands a fallen team member back up. */
  revive(): void {
    this.dead = false;
    this.visible = true;
    this.bar.visible = true;
    this.body.alpha = 1;
    this.body.scale.set(1);
    this.body.tint = WHITE;
    this.setPose('idle');
  }

  async enter(fromX: number): Promise<void> {
    const targetX = this.x;
    this.alpha = 0;
    await this.tweener.run(TUNING.spawn.duration, (t) => {
      this.x = fromX + (targetX - fromX) * t;
      this.alpha = t;
    }, easeOut);
  }
}
