// Pixi builds shader glue with `new Function` by default; this swaps in the
// CSP-safe path so the page works without 'unsafe-eval'.
import 'pixi.js/unsafe-eval';
import { Application, Text } from 'pixi.js';
import { loadContent } from '../data/content';
import { GameAssets } from '../game/assets';
import { ACT1_IMAGES, GameScene } from '../game/GameScene';
import { COLOR, FONT_FAMILY } from '../game/theme';
import { createPlatform } from '../platform';
import { resolveLocale, setLocale, t } from './i18n';
import { DESIGN_HEIGHT, DESIGN_WIDTH, fitViewport } from './viewport';

const SEED_RANGE = 0x7fffffff;
const LOADING_SIZE = 44;

async function boot(): Promise<void> {
  const platform = createPlatform();
  await platform.init();
  setLocale(resolveLocale(platform.getLanguage()));

  const app = new Application();
  await app.init({ width: DESIGN_WIDTH, height: DESIGN_HEIGHT, background: COLOR.background, antialias: false });

  const host = document.getElementById('game');
  if (!host) throw new Error('#game element missing');
  host.appendChild(app.canvas);

  const resize = (): void => {
    const fit = fitViewport(window.innerWidth, window.innerHeight);
    app.canvas.style.width = `${fit.cssWidth}px`;
    app.canvas.style.height = `${fit.cssHeight}px`;
  };
  window.addEventListener('resize', resize);
  resize();

  const loading = new Text({ text: t('ui.loading'), style: { fontFamily: FONT_FAMILY, fontSize: LOADING_SIZE, fill: COLOR.cream } });
  loading.anchor.set(0.5);
  loading.position.set(DESIGN_WIDTH / 2, DESIGN_HEIGHT / 2);
  app.stage.addChild(loading);

  const assets = new GameAssets(import.meta.env.BASE_URL);
  try {
    await assets.load(Object.values(ACT1_IMAGES));
  } catch (error) {
    loading.text = t('ui.load_failed');
    throw error;
  }
  app.stage.removeChild(loading);

  // The seed is the only randomness that comes from outside the sim.
  const scene = new GameScene(loadContent(), assets, () => Math.floor(Math.random() * SEED_RANGE));
  app.stage.addChild(scene);
  app.ticker.add((ticker) => scene.update(ticker.deltaMS));
  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    if (event.key === ' ') event.preventDefault();
    scene.handleKey(event.key);
  });
  scene.chooseLeader();
}

boot().catch((error: unknown) => {
  // Full error screen + log file come with the global handler (CLAUDE.md §6).
  console.error(error);
});
