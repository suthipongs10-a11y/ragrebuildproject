import { Container, Sprite, Text } from 'pixi.js';
import { t } from '../../app/i18n';
import type { Action } from '../../sim/types';
import type { GameAssets } from '../assets';
import { LAYOUT, TEXT } from '../layout';
import { UI_COLOR } from '../theme';
import { Button, label } from '../ui/widgets';

export interface ControlsModel {
  actions: Action[];
  rerollsLeft: number;
  forceDice: number;
  upgradeCost: number | null;
  busy: boolean;
}

const FACE_GAP = 10;
const WRAP_MARGIN = 8;

/** Bottom-left: what the roll means, and the buttons for what you can do about it. */
export class ControlsView extends Container {
  private readonly info: Text;
  private readonly primary: Button;
  private readonly secondary: Button;
  private readonly faces = new Container();
  private readonly faceLabel: Text;
  private primaryAction: Action | null = null;
  private secondaryAction: Action | null = null;

  constructor(assets: GameAssets, private readonly send: (action: Action) => void) {
    super();
    const { width, buttonY, buttonHeight, buttonGap, faceSize, faceY } = LAYOUT.controls;
    this.info = label('', TEXT.body);
    this.info.style.wordWrap = true;
    this.info.style.wordWrapWidth = width - WRAP_MARGIN;
    const half = (width - buttonGap) / 2;
    this.primary = new Button(assets.frame('btn_gold'), assets.frame('btn_gold_pressed'), half, buttonHeight, '', () => this.fire(this.primaryAction));
    this.secondary = new Button(assets.frame('btn_purple'), assets.frame('btn_purple_pressed'), half, buttonHeight, '', () => this.fire(this.secondaryAction));
    this.primary.position.set(0, buttonY);
    this.secondary.position.set(half + buttonGap, buttonY);

    this.faceLabel = label('', TEXT.small, UI_COLOR.dim);
    this.faceLabel.position.set(0, faceY + faceSize / 2);
    this.faceLabel.anchor.set(0, 0.5);
    this.faces.addChild(this.faceLabel);
    for (let face = 1; face <= 6; face++) {
      const sprite = new Sprite(assets.frame(`die_${face}`));
      sprite.width = faceSize;
      sprite.height = faceSize;
      sprite.position.set(width - (7 - face) * (faceSize + FACE_GAP) + FACE_GAP, faceY);
      sprite.eventMode = 'static';
      sprite.cursor = 'pointer';
      sprite.on('pointertap', () => this.fire({ type: 'forceDie', face }));
      this.faces.addChild(sprite);
    }
    this.addChild(this.info, this.faces, this.primary, this.secondary);
  }

  private fire(action: Action | null): void {
    if (action) this.send(action);
  }

  setInfo(text: string): void {
    this.info.text = text;
  }

  /** The action bound to the big gold button (also the Space/Enter key). */
  get primaryChoice(): Action | null {
    return this.primaryAction;
  }

  get secondaryChoice(): Action | null {
    return this.secondaryAction;
  }

  sync(model: ControlsModel): void {
    const can = (type: Action['type']): boolean => !model.busy && model.actions.some((a) => a.type === type);
    this.primaryAction = null;
    this.secondaryAction = null;
    if (model.actions.some((a) => a.type === 'roll')) {
      this.primaryAction = { type: 'roll' };
      this.primary.setText(t('ui.roll'));
    } else if (model.actions.some((a) => a.type === 'move')) {
      this.primaryAction = { type: 'move' };
      this.primary.setText(t('ui.move'));
      this.secondaryAction = { type: 'reroll' };
      this.secondary.setText(t('ui.reroll', { n: model.rerollsLeft }));
    } else if (model.actions.some((a) => a.type === 'upgrade')) {
      this.primaryAction = { type: 'upgrade' };
      this.primary.setText(t('ui.upgrade', { cost: model.upgradeCost ?? 0 }));
      this.secondaryAction = { type: 'skipUpgrade' };
      this.secondary.setText(t('ui.skip'));
    }
    this.primary.visible = this.primaryAction !== null;
    this.primary.setEnabled(this.primaryAction !== null && can(this.primaryAction.type));
    this.secondary.visible = this.secondaryAction !== null;
    this.secondary.setEnabled(this.secondaryAction !== null && can(this.secondaryAction.type));
    this.faces.visible = can('forceDie');
    this.faceLabel.text = t('ui.force_die', { n: model.forceDice });
  }
}
