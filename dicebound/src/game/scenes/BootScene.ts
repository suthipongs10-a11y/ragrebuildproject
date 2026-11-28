import { Container, Text } from 'pixi.js';
import { t } from '../../app/i18n';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../../app/viewport';
import { COLOR, FONT_FAMILY } from '../theme';

const TITLE_SIZE = 160;
const SUBTITLE_SIZE = 44;
const INFO_SIZE = 32;
const LINE_GAP = 130;

/** Placeholder screen proving the render + i18n + platform wiring works. */
export function createBootScene(platformName: string): Container {
  const scene = new Container();
  const centerX = DESIGN_WIDTH / 2;
  const centerY = DESIGN_HEIGHT / 2;

  const title = new Text({
    text: t('app.title'),
    style: { fontFamily: FONT_FAMILY, fontSize: TITLE_SIZE, fontWeight: '900', fill: COLOR.gold },
  });
  title.anchor.set(0.5);
  title.position.set(centerX, centerY - LINE_GAP);

  const subtitle = new Text({
    text: t('boot.subtitle'),
    style: { fontFamily: FONT_FAMILY, fontSize: SUBTITLE_SIZE, fill: COLOR.cream },
  });
  subtitle.anchor.set(0.5);
  subtitle.position.set(centerX, centerY + LINE_GAP / 2);

  const info = new Text({
    text: t('boot.platform', { name: platformName }),
    style: { fontFamily: FONT_FAMILY, fontSize: INFO_SIZE, fill: COLOR.muted },
  });
  info.anchor.set(0.5);
  info.position.set(centerX, centerY + LINE_GAP);

  scene.addChild(title, subtitle, info);
  return scene;
}
