import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../../app/viewport';
import { TEXT } from '../layout';
import { UI_COLOR } from '../theme';
import { Button, label } from '../ui/widgets';

export interface ChoiceCard {
  icon: Texture;
  tag: string;
  title: string;
  body: string;
  footer: string;
  enabled: boolean;
  onPick: () => void;
}

const CARD = { width: 400, height: 560, gap: 44, icon: 200, pad: 26, radius: 14, line: 4 };
const DIM_ALPHA = 0.78;
const TITLE_Y = 120;
const CARDS_Y = 220;
const BUTTON = { width: 320, height: 80, y: 850 };
const DISABLED_ALPHA = 0.45;

/** A modal row of cards: used for picking a leader, a gate reward, and shopping. */
export class ChoiceOverlay extends Container {
  private picks: Array<(() => void) | null> = [];
  private closeAction: (() => void) | null = null;

  constructor(
    private readonly buttonNormal: Texture,
    private readonly buttonPressed: Texture,
  ) {
    super();
    this.visible = false;
  }

  hide(): void {
    this.visible = false;
    this.removeChildren();
    this.picks = [];
    this.closeAction = null;
  }

  /** Number keys pick a card; the close key presses the bottom button. */
  pick(index: number): void {
    this.picks[index]?.();
  }

  close(): void {
    this.closeAction?.();
  }

  show(title: string, cards: ChoiceCard[], closeLabel: string | null, onClose: (() => void) | null): void {
    this.hide();
    this.visible = true;
    const dim = new Graphics().rect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT).fill({ color: UI_COLOR.black, alpha: DIM_ALPHA });
    // Swallow clicks so the board underneath cannot be used while the choice is open.
    dim.eventMode = 'static';
    const heading = label(title, TEXT.big, UI_COLOR.gold, true);
    heading.anchor.set(0.5);
    heading.position.set(DESIGN_WIDTH / 2, TITLE_Y);
    this.addChild(dim, heading);

    const total = cards.length * CARD.width + (cards.length - 1) * CARD.gap;
    cards.forEach((card, i) => {
      const view = new Container();
      view.position.set((DESIGN_WIDTH - total) / 2 + i * (CARD.width + CARD.gap), CARDS_Y);
      const back = new Graphics()
        .roundRect(0, 0, CARD.width, CARD.height, CARD.radius)
        .fill({ color: UI_COLOR.panel })
        .stroke({ width: CARD.line, color: card.enabled ? UI_COLOR.gold : UI_COLOR.panelLine });
      const tag = label(card.tag, TEXT.small, UI_COLOR.dim, true);
      tag.anchor.set(0.5, 0);
      tag.position.set(CARD.width / 2, CARD.pad - 8);
      const icon = new Sprite(card.icon);
      const scale = Math.min(CARD.icon / icon.texture.width, CARD.icon / icon.texture.height);
      icon.scale.set(scale);
      icon.anchor.set(0.5);
      icon.position.set(CARD.width / 2, CARD.pad + 30 + CARD.icon / 2);
      const name = label(card.title, TEXT.label, UI_COLOR.text, true);
      name.anchor.set(0.5, 0);
      name.position.set(CARD.width / 2, CARD.pad + 46 + CARD.icon);
      name.style.wordWrap = true;
      name.style.wordWrapWidth = CARD.width - CARD.pad * 2;
      name.style.align = 'center';
      const body = label(card.body, TEXT.small, UI_COLOR.text);
      body.anchor.set(0.5, 0);
      body.position.set(CARD.width / 2, CARD.pad + 130 + CARD.icon);
      body.style.wordWrap = true;
      body.style.wordWrapWidth = CARD.width - CARD.pad * 2;
      body.style.align = 'center';
      const footer = label(card.footer, TEXT.label, UI_COLOR.gold, true);
      footer.anchor.set(0.5, 1);
      footer.position.set(CARD.width / 2, CARD.height - CARD.pad + 6);
      view.addChild(back, tag, icon, name, body, footer);
      view.alpha = card.enabled ? 1 : DISABLED_ALPHA;
      if (card.enabled) {
        view.eventMode = 'static';
        view.cursor = 'pointer';
        view.on('pointertap', card.onPick);
      }
      this.picks.push(card.enabled ? card.onPick : null);
      this.addChild(view);
    });

    if (closeLabel && onClose) {
      const button = new Button(this.buttonNormal, this.buttonPressed, BUTTON.width, BUTTON.height, closeLabel, onClose);
      button.position.set((DESIGN_WIDTH - BUTTON.width) / 2, BUTTON.y);
      this.addChild(button);
      this.closeAction = onClose;
    }
  }
}
