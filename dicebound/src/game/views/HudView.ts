import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { t } from '../../app/i18n';
import type { Content } from '../../data/content';
import type { RunState } from '../../sim/types';
import { TUNING } from '../anim/tuning';
import { easeIn, easeOut, type Tweener } from '../anim/tween';
import type { GameAssets } from '../assets';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../../app/viewport';
import { LAYOUT, TEXT } from '../layout';
import { UI_COLOR } from '../theme';
import { label, panel } from '../ui/widgets';

const BANNER_SCALE = 1.4;
const DIM_ALPHA = 0.6;

/** Everything that is neither board nor battlefield: resources, next wave, synergies, log, banners. */
export class HudView extends Container {
  private readonly hearts: Sprite[] = [];
  private readonly gold: Text;
  private readonly lap: Text;
  private readonly waveIcons = new Container();
  private readonly statusIcons = new Container();
  private readonly counts: Text;
  private readonly logText: Text;
  private readonly logLines: string[] = [];
  private readonly die = new Sprite();
  private readonly dim = new Graphics();
  private readonly bannerSprite = new Sprite();
  private shownGold = 0;

  constructor(
    private readonly content: Content,
    private readonly assets: GameAssets,
    private readonly tweener: Tweener,
  ) {
    super();
    const top = LAYOUT.topBar;
    for (let i = 0; i < content.rules.hearts; i++) {
      const heart = new Sprite(assets.frame('icon_heart'));
      heart.width = top.heartSize;
      heart.height = top.heartSize;
      heart.position.set(top.x + i * top.heartGap, top.y);
      this.hearts.push(heart);
      this.addChild(heart);
    }
    const coin = new Sprite(assets.frame('icon_gold'));
    coin.width = top.iconSize;
    coin.height = top.iconSize;
    coin.position.set(top.goldX, top.y);
    this.gold = label('0', TEXT.title, UI_COLOR.gold, true);
    this.gold.position.set(top.goldX + top.iconSize + 10, top.y);
    this.lap = label('', TEXT.label, UI_COLOR.text, true);
    this.lap.position.set(top.lapX, top.y + 6);
    this.addChild(coin, this.gold, this.lap);

    const wave = LAYOUT.nextWave;
    const wavePanel = panel(wave.width, wave.height);
    wavePanel.position.set(wave.x, wave.y);
    const waveTitle = label(t('ui.next_wave'), TEXT.small, UI_COLOR.dim, true);
    waveTitle.position.set(wave.x + LAYOUT.panelPad, wave.y + 10);
    this.waveIcons.position.set(wave.x + LAYOUT.panelPad, wave.y + 44);

    const status = LAYOUT.status;
    const statusPanel = panel(status.width, status.height);
    statusPanel.position.set(status.x, status.y);
    this.counts = label('', TEXT.small, UI_COLOR.text);
    this.counts.position.set(status.x + LAYOUT.panelPad, status.y + 10);
    this.statusIcons.position.set(status.x + LAYOUT.panelPad, status.y + 60);

    const log = LAYOUT.log;
    const logPanel = panel(log.width, log.height);
    logPanel.position.set(log.x, log.y);
    this.logText = label('', TEXT.small, UI_COLOR.text);
    this.logText.style.lineHeight = log.lineHeight;
    this.logText.position.set(log.x + LAYOUT.panelPad, log.y + 12);

    this.die.anchor.set(0.5);
    this.die.position.set(LAYOUT.board.x + LAYOUT.board.size / 2, LAYOUT.board.y + LAYOUT.board.size / 2);
    this.die.visible = false;

    this.dim.rect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT).fill({ color: UI_COLOR.black, alpha: DIM_ALPHA });
    this.dim.visible = false;
    this.bannerSprite.anchor.set(0.5);
    this.bannerSprite.position.set(DESIGN_WIDTH / 2, LAYOUT.banner.y);
    this.bannerSprite.visible = false;
    this.addChild(wavePanel, waveTitle, this.waveIcons, statusPanel, this.counts, this.statusIcons, logPanel, this.logText, this.die, this.dim, this.bannerSprite);
  }

  sync(state: RunState): void {
    this.hearts.forEach((heart, i) => {
      heart.texture = this.assets.frame(i < state.hearts ? 'icon_heart' : 'icon_heart_empty');
    });
    this.shownGold = state.gold;
    this.gold.text = String(state.gold);
    this.lap.text = `${t('ui.lap', { lap: state.lap, total: this.content.laps.length })}   ${t('ui.turn', { turn: state.turn })}`;
    this.counts.text = `${t('ui.rerolls', { n: state.rerollsLeft })}    ${t('ui.force_dice', { n: state.forceDice })}`;
    this.setNextWave(state.nextWave);
    this.statusIcons.removeChildren();
    Object.entries(state.synergies).forEach(([id, tier], i) => {
      const def = this.content.synergies.find((s) => s.id === id);
      if (!def) return;
      const icon = new Sprite(this.assets.frame(def.icon));
      icon.width = LAYOUT.status.iconSize;
      icon.height = LAYOUT.status.iconSize;
      icon.x = i * LAYOUT.status.iconGap;
      const badge = label('★'.repeat(tier), TEXT.small, UI_COLOR.gold, true);
      badge.position.set(icon.x, LAYOUT.status.iconSize - 6);
      this.statusIcons.addChild(icon, badge);
    });
  }

  setNextWave(monsterIds: string[]): void {
    this.waveIcons.removeChildren();
    monsterIds.forEach((monsterId, i) => {
      const def = this.content.monsters[monsterId];
      if (!def) return;
      const icon = new Sprite(this.assets.frame(`${def.sprite}_idle`));
      icon.width = LAYOUT.nextWave.iconSize;
      icon.height = LAYOUT.nextWave.iconSize;
      icon.x = i * LAYOUT.nextWave.iconGap;
      this.waveIcons.addChild(icon);
    });
  }

  /** Counts the gold number up or down instead of snapping. */
  changeGold(total: number): void {
    const from = this.shownGold;
    this.shownGold = total;
    void this.tweener.run(TUNING.gold.tick, (v) => {
      this.gold.text = String(Math.round(from + (total - from) * v));
    }, easeOut);
  }

  setHearts(hearts: number): void {
    this.hearts.forEach((heart, i) => {
      heart.texture = this.assets.frame(i < hearts ? 'icon_heart' : 'icon_heart_empty');
    });
  }

  log(line: string): void {
    this.logLines.push(line);
    while (this.logLines.length > LAYOUT.log.lines) this.logLines.shift();
    this.logText.text = this.logLines.join('\n');
  }

  clearLog(): void {
    this.logLines.length = 0;
    this.logText.text = '';
  }

  /** The die tumbles in the middle of the board, then settles on its face. */
  async rollDie(value: number): Promise<void> {
    const frames = ['dice3d_tilt', 'dice3d_spin', 'dice3d_normal', 'dice3d_spin'];
    // Size is set after the texture: frames differ in pixel size, the die on screen must not.
    const show = (id: string, zoom: number): void => {
      this.die.texture = this.assets.frame(id);
      this.die.width = LAYOUT.die.size * zoom;
      this.die.height = LAYOUT.die.size * zoom;
    };
    show(frames[0] ?? 'dice3d_normal', 1);
    this.die.visible = true;
    await this.tweener.run(TUNING.dice.tumble, (v) => {
      const index = Math.floor((v * TUNING.dice.tumble) / TUNING.dice.tumbleFrame) % frames.length;
      show(frames[index] ?? 'dice3d_normal', 1);
      this.die.rotation = v * Math.PI * 2;
    });
    this.die.rotation = 0;
    await this.tweener.run(TUNING.dice.settle, (v) => show(`die_${value}`, 1.25 - 0.25 * v), easeOut);
  }

  hideDie(): void {
    this.die.visible = false;
  }

  /** A big word across the screen: slams in, holds, fades. */
  async banner(id: string, hold: number = TUNING.banner.hold): Promise<void> {
    const sprite = this.bannerSprite;
    sprite.texture = this.assets.frame(id);
    sprite.visible = true;
    await this.tweener.run(TUNING.banner.in, (v) => {
      sprite.alpha = v;
      sprite.scale.set(BANNER_SCALE * (1.5 - 0.5 * v));
    }, easeOut);
    await this.tweener.wait(hold);
    await this.tweener.run(TUNING.banner.out, (v) => {
      sprite.alpha = 1 - v;
    }, easeIn);
    sprite.visible = false;
  }

  /** End of run: dim the scene and leave the result on screen. */
  showResult(id: string): void {
    this.dim.visible = true;
    this.bannerSprite.texture = this.assets.frame(id);
    this.bannerSprite.alpha = 1;
    this.bannerSprite.scale.set(BANNER_SCALE);
    this.bannerSprite.visible = true;
  }

  hideResult(): void {
    this.dim.visible = false;
    this.bannerSprite.visible = false;
  }
}
