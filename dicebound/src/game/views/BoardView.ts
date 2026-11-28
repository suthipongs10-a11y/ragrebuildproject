import { Container, Graphics, Sprite } from 'pixi.js';
import type { Content } from '../../data/content';
import type { RunState } from '../../sim/types';
import { TUNING } from '../anim/tuning';
import { arc, easeOut, type Tweener } from '../anim/tween';
import type { GameAssets } from '../assets';
import { LAYOUT, tileCenter } from '../layout';
import { UI_COLOR } from '../theme';
import { FxLayer } from './FxLayer';

const HIGHLIGHT_LINE = 6;
const HIGHLIGHT_PAD = 6;
const SYNERGY_LINE = 5;
const TILE_FX_SCALE = 0.9;

/** The left-hand board: 16 tiles on a ring, the pawn, target highlight and synergy links. */
export class BoardView extends Container {
  readonly fx: FxLayer;
  private readonly tiles: Sprite[] = [];
  private readonly frames: Sprite[] = [];
  private readonly links = new Graphics();
  private readonly highlight = new Graphics();
  private readonly pawn = new Sprite();
  private readonly size = LAYOUT.board.size;

  constructor(
    private readonly content: Content,
    private readonly assets: GameAssets,
    private readonly tweener: Tweener,
    boardImageId: string,
    /** Hover (index or null) and click callbacks for the tiles. */
    private readonly onHover: (index: number | null) => void,
    private readonly onPick: (index: number) => void,
  ) {
    super();
    const backdrop = new Sprite(assets.image(boardImageId));
    backdrop.width = this.size;
    backdrop.height = this.size;
    this.addChild(backdrop, this.links);
    this.fx = new FxLayer(assets, tweener);
    this.pawn.anchor.set(0.5, 0.92);
  }

  private pawnPrefix = '';

  /** The pawn is the run's leader. */
  setPawn(prefix: string): void {
    this.pawnPrefix = prefix;
    this.showPawn('idle');
  }

  private showPawn(pose: string): void {
    this.pawn.texture = this.assets.frame(`${this.pawnPrefix}_${pose}`);
    this.pawn.width = LAYOUT.board.pawnSize;
    this.pawn.height = LAYOUT.board.pawnSize;
  }

  center(index: number): { x: number; y: number } {
    return tileCenter(index, this.size);
  }

  /** Builds the tile sprites once the board layout is known, then keeps stars in step with the state. */
  sync(state: RunState): void {
    const tileSize = LAYOUT.board.tileSize * (this.size / LAYOUT.board.sourceSize);
    if (this.tiles.length === 0) {
      state.board.forEach((_, index) => {
        const { x, y } = this.center(index);
        const icon = new Sprite();
        icon.anchor.set(0.5);
        icon.position.set(x, y);
        icon.eventMode = 'static';
        icon.cursor = 'pointer';
        icon.on('pointerover', () => this.onHover(index));
        icon.on('pointerout', () => this.onHover(null));
        icon.on('pointertap', () => this.onPick(index));
        const frame = new Sprite();
        frame.anchor.set(0.5);
        frame.position.set(x, y);
        this.tiles.push(icon);
        this.frames.push(frame);
        this.addChild(icon, frame);
      });
      this.addChild(this.highlight, this.pawn, this.fx);
    }
    state.board.forEach((tile, index) => {
      const def = this.content.tiles[tile.tileId];
      const icon = this.tiles[index];
      const frame = this.frames[index];
      if (!def || !icon || !frame) return;
      icon.texture = this.assets.frame(def.icon);
      icon.width = tileSize;
      icon.height = tileSize;
      frame.texture = this.assets.frame(def.type === 'risk' ? 'frame_danger' : `frame_star${tile.stars}`);
      frame.width = tileSize * 1.12;
      frame.height = tileSize * 1.12;
      frame.visible = def.type !== 'gate';
    });
    this.drawLinks(state);
    this.placePawn(state.position);
  }

  private drawLinks(state: RunState): void {
    this.links.clear();
    for (const synergy of this.content.synergies) {
      if (!state.synergies[synergy.id]) continue;
      const ends = synergy.tiles.map((tileId) => state.board.findIndex((t) => t.tileId === tileId));
      const [a, b] = ends;
      if (a === undefined || b === undefined || a < 0 || b < 0) continue;
      const from = this.center(a);
      const to = this.center(b);
      this.links.moveTo(from.x, from.y).lineTo(to.x, to.y).stroke({ width: SYNERGY_LINE, color: UI_COLOR.gold, alpha: 0.75 });
    }
  }

  placePawn(index: number): void {
    const { x, y } = this.center(index);
    this.pawn.position.set(x, y + LAYOUT.board.pawnSize * 0.36);
  }

  /** Shows where the current roll would land (null hides it). */
  setTarget(index: number | null): void {
    this.highlight.clear();
    if (index === null) return;
    const { x, y } = this.center(index);
    const half = (LAYOUT.board.tileSize * (this.size / LAYOUT.board.sourceSize)) / 2 + HIGHLIGHT_PAD;
    this.highlight.roundRect(x - half, y - half, half * 2, half * 2, 12).stroke({ width: HIGHLIGHT_LINE, color: UI_COLOR.text });
  }

  /** Hops the pawn tile by tile so the player can count the steps. */
  async movePawn(from: number, steps: number, boardLength: number): Promise<void> {
    this.showPawn('hop');
    for (let step = 1; step <= steps; step++) {
      const a = this.center((from + step - 1) % boardLength);
      const b = this.center((from + step) % boardLength);
      const lift = LAYOUT.board.pawnSize * 0.36;
      await this.tweener.run(TUNING.pawn.hop, (t) => {
        this.pawn.position.set(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t + lift - TUNING.pawn.hopHeight * arc(t));
      });
    }
    this.showPawn('idle');
  }

  async pulse(index: number): Promise<void> {
    const icon = this.tiles[index];
    if (!icon) return;
    const base = icon.scale.x;
    await this.tweener.run(TUNING.tile.pulse, (t) => {
      icon.scale.set(base * (1 + (TUNING.tile.pulseScale - 1) * arc(t)));
    }, easeOut);
    icon.scale.set(base);
  }

  playAt(index: number, prefix: string): Promise<void> {
    const { x, y } = this.center(index);
    return this.fx.play(prefix, x, y, TILE_FX_SCALE);
  }
}
