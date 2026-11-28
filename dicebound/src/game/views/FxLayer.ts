import { Container, Sprite, Text, type Texture } from 'pixi.js';
import { TUNING } from '../anim/tuning';
import { easeOut, type Tweener } from '../anim/tween';
import type { GameAssets } from '../assets';
import { TEXT } from '../layout';
import { FONT_FAMILY, UI_COLOR } from '../theme';

/** One-shot effects and floating numbers. Sprites and texts are pooled, never created per hit. */
export class FxLayer extends Container {
  private readonly spritePool: Sprite[] = [];
  private readonly textPool: Text[] = [];
  private readonly sequences = new Map<string, Texture[]>();

  constructor(
    private readonly assets: GameAssets,
    private readonly tweener: Tweener,
  ) {
    super();
    this.eventMode = 'none';
  }

  /** Plays a numbered effect (`fx_slash_0..n`) once at a point. Black-backed art is added to the scene. */
  play(prefix: string, x: number, y: number, scale = 1): Promise<void> {
    let frames = this.sequences.get(prefix);
    if (!frames) {
      frames = this.assets.sequence(prefix);
      this.sequences.set(prefix, frames);
    }
    if (frames.length === 0) return Promise.resolve();
    const sprite = this.spritePool.pop() ?? new Sprite();
    sprite.anchor.set(0.5);
    sprite.blendMode = 'add';
    sprite.position.set(x, y);
    sprite.scale.set(scale);
    sprite.alpha = 1;
    const sequence = frames;
    sprite.texture = sequence[0] as Texture;
    this.addChild(sprite);
    return this.tweener
      .run(sequence.length * TUNING.fx.frame, (t) => {
        sprite.texture = sequence[Math.min(sequence.length - 1, Math.floor(t * sequence.length))] as Texture;
      })
      .then(() => {
        this.removeChild(sprite);
        this.spritePool.push(sprite);
      });
  }

  /** A number or short word that rises and fades. */
  float(text: string, x: number, y: number, color: number = UI_COLOR.damage, size: number = TEXT.damage): void {
    const node =
      this.textPool.pop() ??
      new Text({ text: '', style: { fontFamily: FONT_FAMILY, fontWeight: '900', fontSize: size, fill: color, stroke: { color: UI_COLOR.black, width: 5 } } });
    node.text = text;
    node.style.fill = color;
    node.style.fontSize = size;
    node.anchor.set(0.5);
    node.position.set(x, y);
    node.alpha = 1;
    this.addChild(node);
    void this.tweener
      .run(
        TUNING.floatText.duration,
        (t) => {
          node.y = y - TUNING.floatText.rise * t;
          node.alpha = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
        },
        easeOut,
      )
      .then(() => {
        this.removeChild(node);
        this.textPool.push(node);
      });
  }
}
