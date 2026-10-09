import { test, expect, type Page } from '@playwright/test';

type W = { __game: { scene: { isActive: (k: string) => boolean; getScene: (k: string) => WorldLike } } };
interface WorldLike { hero: { x: number; y: number; onGround: boolean }; level: { id: string }; cameras: { main: { scrollX: number } }; save: { broken: Record<string, boolean>; defeated: Record<string, number>; exp: number }; session: { data: { baseExp: number; baseLv: number } }; combat: { enemies: { x: number; y: number; def: { id: string } }[]; combat: { hp: number } }; abilities: Set<string>; debugKillAll(): void; scene: { isActive(): boolean } }

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
  const moved = () => page.waitForFunction((x) => (window as unknown as W).__game.scene.getScene('World').hero.x > x + 50, x0, { timeout: 10_000 });
  if (isMobile) {
    const box = (await page.locator('#joy').boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width - 4, box.y + box.height / 2, { steps: 4 });
    await moved();
    await page.mouse.up();
  } else {
    await page.keyboard.down('ArrowRight');
    await moved();
    await page.keyboard.up('ArrowRight');
  }
  await page.screenshot({ path: `test-results/smoke-${isMobile ? 'phone' : 'desktop'}.png` });
  expect(errors).toEqual([]);
});

test('walking off the left edge enters the next room', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard-driven');
  const errors = await boot(page, '?map=forest');
  expect(await world(page, (w) => w.level.id)).toBe('forest');
  // start near the east edge: monsters knock the hero around, so don't depend on crossing the whole room
  await world(page, (w) => { w.hero.x = 28.5 * 32; w.hero.y = 15 * 32 - 56; });
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(() => (window as unknown as W).__game.scene.getScene('World').level.id === 'town', null, { timeout: 15_000 });
  await page.keyboard.up('ArrowRight');
  expect(await world(page, (w) => w.level.id)).toBe('town');
  expect(await world(page, (w) => w.hero.x)).toBeLessThan(200); // walked right → enters town at its LEFT edge
  expect(errors).toEqual([]);
});

test('walking left from town lands at the right edge of the forest and stays there', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard-driven');
  await boot(page, '?map=town');
  await world(page, (w) => { w.hero.x = 40; });
  await page.keyboard.down('ArrowLeft');
  await page.waitForFunction(() => (window as unknown as W).__game.scene.getScene('World').level.id === 'forest', null, { timeout: 10_000 });
  await page.keyboard.up('ArrowLeft');
  await page.waitForTimeout(500);
  expect(await world(page, (w) => w.level.id)).toBe('forest');
  expect(await world(page, (w) => w.hero.x)).toBeGreaterThan(700);
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

test('entering town from the desert never leaves the hero inside the rock wall', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard-driven');
  await boot(page, '?map=desert');
  await world(page, (w) => { w.hero.x = 1; w.hero.y = 9 * 32; });
  await page.keyboard.down('ArrowLeft');
  await page.waitForFunction(() => (window as unknown as W).__game.scene.getScene('World').level.id === 'town', null, { timeout: 10_000 });
  await page.keyboard.up('ArrowLeft');
  await page.waitForTimeout(400);
  const x = await world(page, (w) => w.hero.x + 24);
  expect(x).toBeLessThanOrEqual(28 * 32 + 0.5);
});

test('home button returns to town', async ({ page, isMobile }) => {
  test.skip(isMobile, 'covered on desktop');
  await boot(page, '?map=abyss1');
  await page.locator('#b_home').click();
  await page.waitForFunction(() => (window as unknown as W).__game.scene.getScene('World').level.id === 'town', null, { timeout: 10_000 });
});

test('attacking a poring kills it and gives EXP', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard-driven');
  const errors = await boot(page, '?map=forest');
  for (let i = 0; i < 40 && (await world(page, (w) => w.session.data.baseExp + w.session.data.baseLv)) === 1; i++) {
    // stand just left of the nearest ground poring, facing it, and swing
    await world(page, (w) => { const p = w.combat.enemies.find((e) => e.def.id === 'poring' && e.y > 400); if (p) { w.hero.x = p.x - 30; w.hero.y = p.y + 32 - 56; } });
    await page.keyboard.down('KeyX'); await page.waitForTimeout(90); await page.keyboard.up('KeyX'); await page.waitForTimeout(160);
  }
  expect(await world(page, (w) => w.session.data.baseExp + w.session.data.baseLv)).toBeGreaterThan(1);
  expect(errors).toEqual([]);
});

test('stress: 30 extra monsters run without errors', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop only');
  const errors = await boot(page, '?map=test_wide&stress=30');
  expect(await world(page, (w) => w.combat.enemies.length)).toBeGreaterThanOrEqual(30);
  await page.waitForTimeout(2000);
  expect(errors).toEqual([]);
});

test('phase 3: novice changes job at the priest menu and gets the starter weapon', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop only');
  const errors = await boot(page, '?map=town&hero=novice:10');
  await page.evaluate(() => (window as unknown as { __game: { scene: { getScene: (k: string) => { openMenu: (t: string) => void } } } }).__game.scene.getScene('World').openMenu('job'));
  await page.click('[data-act="job:mage"]');
  const r = await page.evaluate(() => { const w = (window as unknown as { __game: { scene: { getScene: (k: string) => { session: { data: { job: string; equip: { weapon: number }; bag: { uid: number; id: string }[] } } } } } }).__game.scene.getScene('World'); const d = w.session.data; return { job: d.job, weapon: d.bag.find((b) => b.uid === d.equip.weapon)?.id }; });
  expect(r).toEqual({ job: 'mage', weapon: 'wpn_staff_wood' });
  await page.click('[data-act="close"]');
  expect(errors).toEqual([]);
});

test('phase 3: archer skill spends SP and the menu opens with M', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop only');
  const errors = await boot(page, '?map=forest&hero=archer:20');
  const sp = () => page.evaluate(() => (window as unknown as { __game: { scene: { getScene: (k: string) => { session: { rt: { sp: number } } } } } }).__game.scene.getScene('World').session.rt.sp);
  const sp0 = await sp();
  await page.keyboard.down('KeyV'); await page.waitForTimeout(80); await page.keyboard.up('KeyV');
  await page.waitForTimeout(300);
  expect(await sp()).toBeLessThan(sp0);
  await page.keyboard.press('KeyM');
  await expect(page.locator('#menu')).toBeVisible();
  await page.keyboard.press('KeyM');
  await expect(page.locator('#menu')).toBeHidden();
  expect(errors).toEqual([]);
});

test('phone: talk button appears next to an NPC and opens it', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phone only');
  const errors = await boot(page, '?map=town&hero=novice:10');
  await world(page, (w) => { w.hero.x = 15.5 * 32 + 4; });
  await expect(page.locator('#b_act')).toBeVisible();
  await page.locator('#b_act').dispatchEvent('pointerdown');
  await expect(page.locator('#menu')).toBeVisible(); // priest opens job change for a novice
  expect(errors).toEqual([]);
});
