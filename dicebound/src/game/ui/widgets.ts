import { Container, Graphics, NineSliceSprite, Text, type Texture } from 'pixi.js';
import { TEXT } from '../layout';
import { FONT_FAMILY, UI_COLOR } from '../theme';

const BUTTON_SLICE = 24;
const PANEL_RADIUS = 10;
const PANEL_LINE = 3;
const DISABLED_ALPHA = 0.45;

export function label(text: string, size: number = TEXT.body, color: number = UI_COLOR.text, bold = false): Text {
  return new Text({
    text,
    style: { fontFamily: FONT_FAMILY, fontSize: size, fill: color, fontWeight: bold ? '800' : '500', stroke: { color: UI_COLOR.black, width: Math.ceil(size / 8) } },
  });
}

export function panel(width: number, height: number): Graphics {
  return new Graphics()
    .roundRect(0, 0, width, height, PANEL_RADIUS)
    .fill({ color: UI_COLOR.panel, alpha: 0.92 })
    .stroke({ width: PANEL_LINE, color: UI_COLOR.panelLine });
}

/** A clickable button drawn from the 9-sliced button art. */
export class Button extends Container {
  private readonly face: NineSliceSprite;
  private readonly caption: Text;
  private enabled = true;

  constructor(
    private readonly normal: Texture,
    private readonly pressed: Texture,
    width: number,
    height: number,
    text: string,
    onPress: () => void,
  ) {
    super();
    this.face = new NineSliceSprite({ texture: normal, leftWidth: BUTTON_SLICE, rightWidth: BUTTON_SLICE, topHeight: BUTTON_SLICE, bottomHeight: BUTTON_SLICE });
    this.face.width = width;
    this.face.height = height;
    this.caption = label(text, TEXT.label, UI_COLOR.text, true);
    this.caption.anchor.set(0.5);
    this.caption.position.set(width / 2, height / 2);
    this.addChild(this.face, this.caption);
    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.on('pointerdown', () => {
      if (this.enabled) this.face.texture = this.pressed;
    });
    this.on('pointerup', () => {
      this.face.texture = this.normal;
      if (this.enabled) onPress();
    });
    this.on('pointerupoutside', () => {
      this.face.texture = this.normal;
    });
  }

  setText(text: string): void {
    this.caption.text = text;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.alpha = enabled ? 1 : DISABLED_ALPHA;
    this.cursor = enabled ? 'pointer' : 'default';
  }
}
