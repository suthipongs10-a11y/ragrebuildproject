// Pixi builds shader glue with `new Function` by default; this swaps in the
// CSP-safe path so the page works without 'unsafe-eval'.
import 'pixi.js/unsafe-eval';
import { Application } from 'pixi.js';
import { createBootScene } from '../game/scenes/BootScene';
import { COLOR } from '../game/theme';
import { createPlatform } from '../platform';
import { resolveLocale, setLocale } from './i18n';
import { DESIGN_HEIGHT, DESIGN_WIDTH, fitViewport } from './viewport';

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

  app.stage.addChild(createBootScene(platform.isSteam ? 'Steam' : 'Web'));
}

boot().catch((error: unknown) => {
  // Full error screen + log file come with the global handler (CLAUDE.md §6).
  console.error(error);
});
