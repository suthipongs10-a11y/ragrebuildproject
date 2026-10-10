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
  await expect(page.locator('.jb-card')).toHaveCount(4);
  await expect(page.locator('.jb-card').first().locator('.jb-bar')).toHaveCount(5);
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
  await world(page, (w) => { w.hero.x = 13 * 32; }); // between the altar and the priest: nothing close
  await expect(page.locator('#b_act')).toBeHidden();
  await world(page, (w) => { w.hero.x = 15.5 * 32 + 4; });
  await expect(page.locator('#b_act')).toBeVisible();
  await page.locator('#b_act').dispatchEvent('pointerdown');
  await expect(page.locator('#menu')).toBeVisible(); // priest opens job change for a novice
  expect(errors).toEqual([]);
});

// ───────────── Phase 4: spirits ─────────────
type Any = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const ws = <T,>(page: Page, fn: (w: Any) => T) => page.evaluate((src) => new Function('w', `return (${src})(w)`)((window as unknown as Any).__game.scene.getScene('World')), fn.toString()) as Promise<T>;

test('phase 4: starter team follows the hero and gives double jump / dive / smash', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop only');
  const errors = await boot(page, '?map=town');
  expect(await ws(page, (w) => w.combat.spirits.actors.length)).toBe(3);
  expect(await ws(page, (w) => [...w.abilities].sort().join(','))).toBe('break,dive,double');
  // take the sylph out of the team: no more double jump
  await ws(page, (w) => { const b = w.session.box; const s = b.spirits.find((x: Any) => x.id === 'sylph'); b.team = b.team.map((u: number) => (u === s.uid ? null : u)); w.onSpiritsChanged(); });
  expect(await ws(page, (w) => w.abilities.has('double'))).toBe(false);
  expect(await ws(page, (w) => w.combat.spirits.actors.length)).toBe(2);
  expect(errors).toEqual([]);
});

test('phase 4: altar summon with a mystic scroll adds a 3★+ spirit', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop only');
  const errors = await boot(page, '?map=town&hero=swordsman:20');
  const n0 = await ws(page, (w) => w.session.box.spirits.length);
  await ws(page, (w) => w.openMenu('summon'));
  await page.click('[data-act="sum:mystic:1"]');
  await expect(page.locator('.sm-card')).toHaveCount(1);
  expect(await ws(page, (w) => w.session.box.spirits.length)).toBe(n0 + 1);
  expect(await ws(page, (w) => w.session.box.spirits[w.session.box.spirits.length - 1].star)).toBeGreaterThanOrEqual(3);
  await page.click('[data-act="tab:spirits"]');
  await expect(page.locator('.sp-grid .sp-card')).toHaveCount(n0 + 1);
  await page.click('[data-act="close"]');
  // reopening with M after the altar still shows the hero tabs (status, equipment ...)
  await ws(page, (w) => w.openMenu('summon'));
  await page.click('[data-act="close"]');
  await page.keyboard.press('KeyM');
  await expect(page.locator('[data-act="tab:status"]')).toBeVisible();
  await expect(page.locator('[data-act="tab:equip"]')).toBeVisible();
  await page.keyboard.press('KeyM');
  expect(errors).toEqual([]);
});

test('phase 4: full gauge + F plays the ultimate on monsters on screen', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop only');
  const errors = await boot(page, '?map=forest');
  await ws(page, (w) => { w.combat.spirits.gauge = w.combat.spirits.gaugeMax; for (const e of w.combat.enemies) e.hp = e.def.hp * 50; });
  await page.keyboard.down('KeyF'); await page.waitForTimeout(80); await page.keyboard.up('KeyF');
  await page.waitForFunction(() => (window as unknown as Any).__game.scene.getScene('World').busy === true, null, { timeout: 3000 });
  await page.waitForFunction(() => (window as unknown as Any).__game.scene.getScene('World').busy === false, null, { timeout: 8000 });
  expect(await ws(page, (w) => w.combat.spirits.gauge)).toBeLessThan(10);
  expect(await ws(page, (w) => w.combat.enemies.some((e: Any) => e.hp < e.def.hp * 50))).toBe(true);
  expect(errors).toEqual([]);
});

test('phase 4: bag and equipment are separate tabs; spirit book lists every family', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop only');
  const errors = await boot(page, '?map=town');
  await page.keyboard.press('KeyM');
  await page.click('[data-act="tab:bag"]');
  await expect(page.locator('.mn-body')).toContainText('ยาแดง');
  await page.click('[data-act="tab:equip"]');
  await expect(page.locator('.mn-body')).not.toContainText('ยาแดง');
  await page.click('[data-act="tab:book"]');
  const n = await ws(page, (w) => w.session.content.spirits.length);
  await expect(page.locator('.sp-grid .sp-card')).toHaveCount(n);
  await page.click('[data-act="book:dragon"]');
  await expect(page.locator('.sp-detail')).toContainText('มังกรฟ้า');
  await page.keyboard.press('KeyM');
  expect(errors).toEqual([]);
});

test('phase 5: adventure book milestone can be claimed for a permanent bonus', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop only');
  const errors = await boot(page, '?map=town&hero=swordsman:20');
  await ws(page, (w) => { w.session.book.kills.poring = 50; });
  const hp0 = await ws(page, (w) => w.combat.maxHp);
  await ws(page, (w) => w.openMenu('adventure'));
  await page.click('[data-act="bookclaim:kill_poring"]');
  expect(await ws(page, (w) => !!w.session.book.claimed.kill_poring)).toBe(true);
  expect(await ws(page, (w) => w.combat.maxHp)).toBe(hp0 + 20);
  await page.click('[data-act="close"]');
  expect(errors).toEqual([]);
});

test('phase 5: tower floor 1 from the portal: waves, clear reward, back to town', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop only');
  const errors = await boot(page, '?map=town&hero=swordsman:20');
  await ws(page, (w) => w.openMenu('arena'));
  await page.click('[data-act="arena:tower:1"]');
  await page.waitForFunction(() => (window as unknown as Any).__game.scene.getScene('World').level?.id === 'arena', null, { timeout: 10_000 });
  await page.waitForFunction(() => (window as unknown as Any).__game.scene.getScene('World').combat.enemies.some((e: Any) => e.id.startsWith('arena#')), null, { timeout: 10_000 });
  // every monster picture is loaded (the arena room has no spawns of its own)
  expect(await ws(page, (w) => w.children.list.filter((o: Any) => o.texture?.key === '__MISSING').length)).toBe(0);
  await ws(page, (w) => w.debugKillAll());
  await page.waitForFunction(() => (window as unknown as Any).__game.scene.getScene('World').session.arena.tower === 1, null, { timeout: 10_000 });
  await page.waitForFunction(() => (window as unknown as Any).__game.scene.getScene('World').level?.id === 'town', null, { timeout: 15_000 });
  expect(errors).toEqual([]);
});

test('phase 5: daily dungeon uses an entry and its monsters are drawn', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop only');
  const errors = await boot(page, '?map=town&hero=swordsman:20');
  await ws(page, (w) => w.openMenu('arena'));
  await page.click('[data-act="arena:dungeon"]');
  await page.waitForFunction(() => (window as unknown as Any).__game.scene.getScene('World').combat?.enemies.some((e: Any) => e.id.startsWith('arena#')), null, { timeout: 15_000 });
  expect(await ws(page, (w) => w.session.arena.daily.used)).toBe(1);
  expect(await ws(page, (w) => w.children.list.filter((o: Any) => o.texture?.key === '__MISSING').length)).toBe(0);
  expect(errors).toEqual([]);
});

test('phase 5: a new hero sees locked summon / tower and a guide quest', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop only');
  const errors = await boot(page, '?map=town');
  await ws(page, (w) => w.openMenu('summon'));
  await expect(page.locator('.mn-body')).toContainText('Lv 5');
  await expect(page.locator('[data-act="sum:mystic:1"]')).toHaveCount(0);
  await ws(page, (w) => w.openMenu('arena'));
  await expect(page.locator('[data-act="arena:tower:1"]')).toHaveCount(0);
  await page.click('[data-act="close"]');
  expect(await ws(page, (w) => w.guide.shown)).toContain('โพริ่ง');
  expect(errors).toEqual([]);
});

test('phase 5: AUTO (key T) faces and hits a nearby monster without pressing attack', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop only');
  const errors = await boot(page, '?map=forest&hero=swordsman:20');
  await page.keyboard.press('KeyT');
  await expect(page.locator('#b_auto')).toHaveClass(/on/);
  const hit = await ws(page, (w) => {
    const e = w.combat.enemies.find((x: Any) => !x.dead);
    e.hp = e.def.hp * 50;
    w.hero.x = e.x - 60; w.hero.y = e.y + e.h - w.hero.h; w.hero.dir = -1;
    return e.id;
  });
  await page.waitForFunction((id) => { const e = (window as unknown as Any).__game.scene.getScene('World').combat.enemies.find((x: Any) => x.id === id); return !e || e.hp < e.def.hp * 50; }, hit, { timeout: 5000 });
  await page.keyboard.press('KeyT');
  await expect(page.locator('#b_auto')).not.toHaveClass(/on/);
  expect(errors).toEqual([]);
});
