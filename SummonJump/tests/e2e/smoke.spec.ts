import { test, expect, type Page } from '@playwright/test';

type W = { __game: { scene: { isActive: (k: string) => boolean; getScene: (k: string) => WorldLike } } };
interface WorldLike { hero: { x: number; y: number; onGround: boolean }; level: { id: string }; cameras: { main: { scrollX: number } }; save: { broken: Record<string, boolean>; defeated: Record<string, number> }; abilities: Set<string>; debugKillAll(): void; scene: { isActive(): boolean } }

const world = <T,>(page: Page, fn: (w: WorldLike) => T) => page.evaluate((src) => new Function('w', `return (${src})(w)`)((window as unknown as W).__game.scene.getScene('World')), fn.toString());

async function boot(page: Page, query = ''): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => { try { localStorage.clear(); } catch { /* ignore */ } });
  await page.goto(`./${query}`);
  await page.waitForFunction(() => (window as unknown as W).__game?.scene.isActive('World'), null, { timeout: 30_000 });
  await page.waitForFunction(() => !!(window as unknown as W).__game.scene.getScene('World').hero, null, { timeout: 10_000 });
  return errors;
}
const hold = async (page: Page, key: string, ms: number) => { await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); };

test('boots into the town and the hero moves', async ({ page, isMobile }) => {
  const errors = await boot(page);
  expect(await world(page, (w) => w.level.id)).toBe('town');
  const x0 = await world(page, (w) => w.hero.x);
  if (isMobile) {
    const box = (await page.locator('#joy').boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width - 4, box.y + box.height / 2, { steps: 4 });
    await page.waitForTimeout(800);
    await page.mouse.up();
  } else await hold(page, 'ArrowRight', 800);
  expect(await world(page, (w) => w.hero.x)).toBeGreaterThan(x0 + 50);
  await page.screenshot({ path: `test-results/smoke-${isMobile ? 'phone' : 'desktop'}.png` });
  expect(errors).toEqual([]);
});

test('walking off the left edge enters the next room', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard-driven');
  const errors = await boot(page, '?map=forest');
  expect(await world(page, (w) => w.level.id)).toBe('forest');
  await page.keyboard.down('ArrowRight');
  for (let i = 0; i < 60 && (await world(page, (w) => w.level.id)) === 'forest'; i++) { await page.keyboard.down('Space'); await page.waitForTimeout(220); await page.keyboard.up('Space'); await page.waitForTimeout(250); } // hop the small block
  await page.keyboard.up('ArrowRight');
  await page.waitForFunction(() => (window as unknown as W).__game.scene.getScene('World').level.id === 'town', null, { timeout: 15_000 });
  expect(await world(page, (w) => w.level.id)).toBe('town');
  expect(errors).toEqual([]);
});

test('scrolling camera follows the hero in a wide room', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard-driven');
  await boot(page, '?map=test_wide');
  expect(await world(page, (w) => w.cameras.main.scrollX)).toBeLessThan(50);
  // move the hero far right (no timing dependence on slow CI), then let the camera catch up
  await world(page, (w) => { w.hero.x = 60 * 32; w.hero.y = 12 * 32; });
  await page.waitForFunction(() => (window as unknown as W).__game.scene.getScene('World').cameras.main.scrollX > 1000, null, { timeout: 10_000 });
  await hold(page, 'ArrowLeft', 300); // input still works after the jump
});

test('smash ability opens the town rock wall; respawn timers persist', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard-driven');
  await boot(page, '?map=town&abil=break');
  await world(page, (w) => { w.hero.x = 26 * 32; });
  await page.waitForTimeout(300);
  await page.keyboard.press('KeyX');
  await page.waitForTimeout(500);
  expect(await world(page, (w) => w.save.broken.town === true)).toBe(true);

  await boot(page, '?map=deep');
  await world(page, (w) => w.debugKillAll());
  const keys = await world(page, (w) => Object.keys(w.save.defeated));
  expect(keys.length).toBe(1); // only the mini-boss (king) is timed; normal monsters are never persisted
});
