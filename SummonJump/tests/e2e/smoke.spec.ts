import { test, expect } from '@playwright/test';

test('boots into the painted world and the hero moves', async ({ page, isMobile }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./');
  await page.waitForFunction(() => {
    const g = (window as unknown as { __game?: { scene: { isActive: (k: string) => boolean } } }).__game;
    return g?.scene.isActive('World');
  }, null, { timeout: 30_000 });
  const heroX = () => page.evaluate(() => {
    const g = (window as unknown as { __game: { scene: { getScene: (k: string) => { hero: { x: number } } } } }).__game;
    return g.scene.getScene('World').hero.x;
  });
  const x0 = await heroX();
  if (isMobile) {
    const box = (await page.locator('#joy').boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width - 4, box.y + box.height / 2, { steps: 4 });
    await page.waitForTimeout(800);
    await page.mouse.up();
  } else {
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(800);
    await page.keyboard.up('ArrowRight');
  }
  expect(await heroX()).toBeGreaterThan(x0 + 50);
  await page.screenshot({ path: `test-results/smoke-${isMobile ? 'phone' : 'desktop'}.png` });
  expect(errors).toEqual([]);
});
