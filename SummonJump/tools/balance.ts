/**
 * Balance sheet: a rough simulation of a new player walking the main route (forest → sky → abyss → Kraken).
 * Hero = a plain swordsman (natural levels, STR/AGI/VIT, best common gear, no refine) with the starter spirit team.
 * Writes docs/BALANCE.md. Usage: npx tsx tools/balance.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  addItem, attack, attackCooldown, changeJob, critRate, derive, equip, expToNext, gainExp, maxHp, newHero, parseLdtk, raiseStat, spiritStats, starterBox, autoSkill, maxLevel,
  type ContentBundle, type HeroData, type LdtkProject, type MonsterDef, type StatKey,
} from '../shared/index';

const ROOT = join(import.meta.dirname, '..');
const c = JSON.parse(readFileSync(join(ROOT, 'public', 'content', 'content.json'), 'utf8')) as ContentBundle;
const levels = parseLdtk(JSON.parse(readFileSync(join(ROOT, 'levels', 'world.ldtk'), 'utf8')) as LdtkProject);
const ROUTE = ['forest', 'forest2', 'forest3', 'deep', 'forest4', 'deep2', 'sky1', 'sky2', 'sky3', 'sky4', 'sky5', 'sky6', 'abyss1', 'abyss2', 'abyss3', 'abyss4', 'abyss5', 'abyss6'];
const OVERHEAD = 2.5; // seconds per kill spent walking / dodging
const ROOM_LOOP = 6; // seconds to leave and re-enter a room (normal monsters respawn)

const mon = (id: string) => c.monsters.find((m) => m.id === id) as MonsterDef;

/** A plain player at base level `lv`: levelled naturally, STR/AGI/VIT, swordsman at job 10, best common gear, no refine. */
const heroCache = new Map<number, HeroData>();
function hero(lv: number): HeroData {
  const hit = heroCache.get(lv);
  if (hit) return hit;
  const h = newHero(c);
  let need = 0; for (let l = 1; l < lv; l++) need += expToNext(l);
  gainExp(h, c, need, Math.round(need * 0.7));
  if (h.jobLv >= 10) { h.skills.basic_skill = 9; changeJob(h, c, 'swordsman'); gainExp(h, c, 0, Math.round(need * 0.3)); }
  const keys: StatKey[] = ['str', 'str', 'agi', 'vit'];
  for (let i = 0; h.statPoints > 1 && i < 600; i++) raiseStat(h, keys[i % keys.length] as StatKey);
  for (const type of ['weapon', 'armor', 'head', 'shoes', 'cape', 'offhand']) {
    const best = c.items.filter((d) => d.type === type && d.tier === 'common' && d.level_req <= lv && (d.job_mask.includes('all') || d.job_mask.includes(h.job)) && (type !== 'weapon' || d.subtype === 'sword'))
      .sort((a, z) => z.level_req - a.level_req)[0];
    const it = best && addItem(h, c, best.id);
    if (it) equip(h, c, it.uid);
  }
  heroCache.set(lv, h);
  return h;
}

/** Hero + spirit damage per second against a monster, at hero level `lv`. */
function dps(lv: number, m: MonsterDef): { hero: number; spirits: number } {
  const b = derive(hero(lv), c).build;
  const perHit = Math.max(1, attack(b) * 1.17 - m.def * 0.6) * (1 + (critRate(b) / 100) * 0.6);
  const heroDps = (perHit / (attackCooldown(b) * 1.2)) * 0.6; // ~60 % of the time the hero is actually hitting
  const box = starterBox(c, null);
  let spirits = 0;
  for (const s of box.spirits.filter((x) => box.team.includes(x.uid))) {
    s.lv = Math.min(lv, maxLevel(s.star));
    const st = spiritStats(c, s), sk = autoSkill(c, s);
    if (sk) spirits += Math.max(1, st.atk * sk.power - m.def * 0.6) / (sk.cd * (100 / st.spd));
  }
  return { hero: heroDps, spirits };
}

const killTime = (lv: number, m: MonsterDef) => { const d = dps(lv, m); return m.hp / (d.hero + d.spirits); };

interface Row { room: string; arrive: number; leave: number; minutes: number; kills: number; avgLv: number; boss: string }
const rows: Row[] = [];
let lv = 1, exp = 0, t = 0;
const gain = (e: number) => { exp += e; while (lv < 99 && exp >= expToNext(lv)) { exp -= expToNext(lv); lv++; } };

ROUTE.forEach((id, i) => {
  const l = levels.get(id);
  if (!l) throw new Error(`missing room ${id}`);
  const spawns = l.entities.filter((e) => e.type === 'Monster').map((e) => mon(String(e.fields.monster)));
  const normals = spawns.filter((m) => m.tier === 'normal'), bosses = spawns.filter((m) => m.tier !== 'normal');
  const next = ROUTE[i + 1] ? levels.get(ROUTE[i + 1] as string) : null;
  const nextMons = next ? next.entities.filter((e) => e.type === 'Monster').map((e) => mon(String(e.fields.monster))) : [];
  // move on when the hero is about the level of the next room's toughest normal monster (or its boss - 2)
  const target = nextMons.length ? Math.max(...nextMons.map((m) => (m.tier === 'normal' ? m.level : m.level - 2))) : lv;
  const arrive = lv, t0 = t;
  let kills = 0;
  for (const b of bosses) { t += killTime(lv, b) + 20; gain(b.exp); kills++; }
  for (let loop = 0; loop < 400 && (lv < target || loop === 0) && normals.length; loop++) {
    for (const m of normals) { t += killTime(lv, m) + OVERHEAD; gain(m.exp); kills++; }
    t += ROOM_LOOP;
  }
  rows.push({ room: id, arrive, leave: lv, minutes: (t - t0) / 60, kills, avgLv: normals.length ? normals.reduce((a, m) => a + m.level, 0) / normals.length : 0, boss: bosses.map((b) => b.id).join(', ') });
});

const hours = t / 3600;
const ttk = c.monsters.filter((m) => m.zone !== 'desert').map((m) => {
  const d = dps(m.level, m);
  return `| ${m.id} | ${m.tier} | ${m.level} | ${m.hp} | ${m.exp} | ${(m.hp / (d.hero + d.spirits)).toFixed(1)} s | ${Math.round(d.hero)} + ${Math.round(d.spirits)} | ${maxHp(derive(hero(m.level), c).build)} |`;
}).join('\n');
const md = `# Balance sheet (generated by \`tools/balance.ts\`)

Simulated new player on the main route (plain swordsman: natural levels, best common gear without refine, + the starter spirit team).
Kill time = monster HP ÷ (hero DPS + spirit DPS), plus ${OVERHEAD} s per kill for moving and ${ROOM_LOOP} s per room re-entry.
The player leaves a room once they reach the level of the next room's monsters.

**Simulated time from a new game to MVP #2 (Kraken): ${hours.toFixed(1)} h** · final level ${lv}\nReal play on a phone (dodging, deaths, menus, exploring) is usually 1.5–2× the simulation → **about ${(hours * 1.5).toFixed(1)}–${(hours * 2).toFixed(1)} h** (target 3–4 h), not counting the daily dungeon, tower and spirit summoning.\n\nTuning (Phase 5): normal monsters HP ×3 and EXP ×0.22 (a bit more below Lv 12 so the first rooms don't drag), mini-bosses / MVPs HP ×2.5 and EXP ×0.5 compared with the Phase 2–4 values; then the boss pass (owner: AUTO is for normal monsters, bosses need real play) made bosses HP ×4 and ATK ×1.5 more, with minion calls, faster attacks when hurt (×1.2 phase 2, ×1.4 under 25 %) and 80 % stun/freeze resistance. Boss kill times below assume full damage the whole fight; with dodging and minions expect about 2×.

## Route
| Room | Boss | Monster Lv | Arrive Lv | Leave Lv | Kills | Minutes |
|---|---|---|---|---|---|---|
${rows.map((r) => `| ${r.room} | ${r.boss || '—'} | ${r.avgLv ? r.avgLv.toFixed(1) : '—'} | ${r.arrive} | ${r.leave} | ${r.kills} | ${r.minutes.toFixed(1)} |`).join('\n')}

## Monsters at their own level
| Monster | Tier | Lv | HP | EXP | Kill time | DPS hero + spirits | Hero HP at that level |
|---|---|---|---|---|---|---|---|
${ttk}
`;
writeFileSync(join(ROOT, 'docs', 'BALANCE.md'), md);
console.log(md.split('\n').slice(0, 30).join('\n'));
