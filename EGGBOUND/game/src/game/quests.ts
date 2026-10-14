// Adventure book (สมุดผจญภัย): one-time quests grouped in chapters (one per map region + one per game system), handing out
// gems (600 in total for the current content), mystery eggs, egg shards, gold and soul crystals; a finished chapter opens a chest.
// Progress is read from the save (stages, dex, monsters) and lifetime counters (save.stats); rewards are claimed by hand.
import { SPECIES, STAGES, ZONES, DIFFS, stageKey, GEM_GOLD_EGG, RUSH_BASE, RUSH_STEP, EGG_TIERS, levelCap, rareFormChance, shardOnly } from '../core/data';
import type { EggTier } from '../core/data';
import type { SaveData, EggSave } from './save';
import { rollRarity, rollSpecies, skillMaxed, rollEggSpecies, rollEggRare } from './progression';
import { incubOf, incubLeft, home } from './home';

export interface Reward { gems?: number; gold?: number; soul?: number; frags?: Record<string, number>; egg?: EggTier }
export interface Quest { id: string; ch: string; name: string; goal: (s: SaveData) => [number, number]; reward: Reward }
/** a chapter of the book (SW "Summoner's Adventure" style): finish every quest in it to open its chapter chest */
export interface Chapter { id: string; name: string; desc: string; bonus: Reward }
const n = (v: number, t: number): [number, number] => [Math.min(v, t), t];
const dexHas = (s: SaveData, r: string) => s.dex.filter(id => SPECIES[id]?.rarity === r).length;
const stageStars = (s: SaveData, id: string) => s.stages[id] || 0;
const maxStars = (s: SaveData) => Math.max(0, ...s.mons.map(m => m.stars));
const starsAtLeast = (s: SaveData, k: number) => s.mons.filter(m => m.stars >= k).length;
const allSpecies = Object.values(SPECIES).filter(x => !x.boss && !shardOnly(x)).length;
/** levels gained across every building since a new home (castle 1, five buildings at 1, shrine 0) */
const homeUps = (s: SaveData) => { const h = home(s); return h.castle - 1 + Object.values(h.lv).reduce((a, b) => a + b, 0) - 5 + Object.values(h.shrine).reduce((a, b) => a + b, 0); };

// ---- maps: one chapter per realm, three quests per zone (beat the boss · every stage 3 stars · beat the boss 5 times);
// new zones join automatically. Gems stay 10 per zone + 40 per chapter (the book total is locked by tests/eggs.ts). ----
export const REGION_NAME: Record<string, string> = { '1': 'ทุ่งไข่ป่วน', '2': 'สุวรรณภูมิ', '3': 'สวรรค์บูรพา' };
const regions = [...new Set(ZONES.map(z => z.realm))];
const regionChapters: Chapter[] = regions.map(r => ({ id: 'map' + r, name: `แผนที่ ${r} · ${REGION_NAME[r] || 'ภพที่ ' + r}`, desc: 'ชนะบอสทุกโซน เก็บครบ 3 ดาวทุกด่าน และชนะบอสซ้ำโซนละ 5 ครั้ง', bonus: { gems: 40, egg: 'gold' } }));
const mapQuests: Quest[] = ZONES.flatMap((z, i) => {
  const ch = 'map' + z.realm, last = ZONES[i + 1]?.realm !== z.realm, boss = z.id + '-5', ids = STAGES.filter(st => st.zone === z.id).map(st => st.id);
  return [
    { id: 'zclear' + z.id, ch, name: `ชนะบอส ${z.name}`, goal: (s: SaveData) => n(stageStars(s, boss) > 0 ? 1 : 0, 1), reward: last ? { gold: 1500, soul: 1 } : { gold: 800 + i * 300 } },
    { id: 'zstar' + z.id, ch, name: `${z.name} ครบ 3 ดาวทุกด่าน`, goal: (s: SaveData) => n(ids.filter(id => stageStars(s, id) >= 3).length, ids.length), reward: { gems: 10 } },
    { id: 'zfarm' + z.id, ch, name: `ชนะบอส ${z.name} 5 ครั้ง`, goal: (s: SaveData) => n(s.stats.stageWins[boss] || 0, 5), reward: last ? { egg: 'silver', gold: 1000 } : { gold: 600 + i * 250 } },
  ];
});
// ---- difficulties (owner 2026-10-14): one chapter per harder difficulty, two quests per zone (beat the boss · every
// stage 3 stars at that difficulty); gems grow with the difficulty (approved: "เพิ่มเพชรตามระดับเควสได้เลย") ----
const DIFF_GEMS: Record<number, { boss: number; star: number; gold: number; bonus: Reward }> = {
  1: { boss: 10, star: 10, gold: 1000, bonus: { gems: 40, egg: 'gold' } },
  2: { boss: 15, star: 20, gold: 2000, bonus: { gems: 60, egg: 'rainbow' } },
  3: { boss: 20, star: 25, gold: 4000, bonus: { gems: 80, egg: 'rainbow' } }, // นรก (2026-10-14)
};
const diffChapters: Chapter[] = [1, 2, 3].map(d => ({ id: 'diff' + DIFFS[d].key, name: `ผู้กล้าระดับ${DIFFS[d].name}`, desc: `ชนะบอสทุกโซนในระดับ${DIFFS[d].name} และเก็บครบ 3 ดาวทุกด่าน (เปิดระดับนี้ได้เมื่อชนะบอสโซนนั้นในระดับ${DIFFS[d - 1].name})`, bonus: DIFF_GEMS[d].bonus }));
const diffQuests: Quest[] = [1, 2, 3].flatMap(d => ZONES.flatMap((z, i) => {
  const ch = 'diff' + DIFFS[d].key, R = DIFF_GEMS[d], boss = stageKey(z.id + '-5', d), ids = STAGES.filter(st => st.zone === z.id).map(st => stageKey(st.id, d));
  return [
    { id: `d${DIFFS[d].key}clear${z.id}`, ch, name: `ชนะบอส ${z.name} (${DIFFS[d].name})`, goal: (s: SaveData) => n(stageStars(s, boss) > 0 ? 1 : 0, 1), reward: { gems: R.boss, gold: R.gold + i * 100 * (d + 1) } },
    { id: `d${DIFFS[d].key}star${z.id}`, ch, name: `${z.name} (${DIFFS[d].name}) ครบ 3 ดาวทุกด่าน`, goal: (s: SaveData) => n(ids.filter(id => stageStars(s, id) >= 3).length, ids.length), reward: { gems: R.star } },
  ];
}));

export const CHAPTERS: Chapter[] = [
  { id: 'start', name: 'นักผจญภัยมือใหม่', desc: 'เรียนรู้ทุกระบบของเกม', bonus: { gems: 30, egg: 'silver' } },
  ...regionChapters,
  ...diffChapters,
  { id: 'hatch', name: 'ฟักไข่และสะสม', desc: 'ฟักไข่ ประกอบไข่ และเติมสารบัญมอน', bonus: { egg: 'rainbow' } },
  { id: 'grow', name: 'เติบโตและวิวัฒน์', desc: 'เพิ่มเลเวล อัปสกิล อัปดาวจนถึง ★6', bonus: { gems: 20, soul: 2 } },
  { id: 'fight', name: 'จอมยุทธ์', desc: 'ชนะ ใช้ท่าไม้ตาย กดจังหวะ และปฏิกิริยาธาตุ', bonus: { gems: 15, soul: 1 } },
  { id: 'home', name: 'เจ้าแห่งเต่าบรรพกาล', desc: 'สร้างและอัปเกรดบ้านบนหลังเต่า', bonus: { gems: 10, gold: 5000 } },
];
export const QUESTS: Quest[] = [
  // chapter 1: a guided tour of every system
  { id: 'win1', ch: 'start', name: 'ชนะการต่อสู้ครั้งแรก', goal: s => n(s.stats.wins, 1), reward: { gems: 10, gold: 500 } },
  { id: 'ult1', ch: 'start', name: 'ใช้ท่าไม้ตาย', goal: s => n(s.stats.ult, 1), reward: { gems: 10 } },
  { id: 'perfect1', ch: 'start', name: 'กดจังหวะ PERFECT ท่าไม้ตาย', goal: s => n(s.stats.perfect, 1), reward: { gems: 10 } },
  { id: 'react1', ch: 'start', name: 'ทำปฏิกิริยาธาตุครั้งแรก', goal: s => n(s.stats.react, 1), reward: { gems: 10 } },
  { id: 'hatch1', ch: 'start', name: 'ฟักไข่ครั้งแรก', goal: s => n(s.stats.hatch, 1), reward: { gems: 10 } },
  { id: 'feed1', ch: 'start', name: 'เพิ่มเลเวลด้วยการป้อนมอน', goal: s => n(s.stats.feed, 1), reward: { gems: 10, gold: 1000 } },
  { id: 'skill1', ch: 'start', name: 'อัปสกิล', goal: s => n(s.stats.skillUp, 1), reward: { gems: 10 } },
  { id: 'mine1', ch: 'start', name: 'เก็บทองจากเหมืองผลึกดาว', goal: s => n(s.stats.mine, 1), reward: { gold: 500 } },
  { id: 'build1', ch: 'start', name: 'อัปเกรดอาคารในบ้านเต่า', goal: s => n(homeUps(s), 1), reward: { gems: 5, gold: 1000 } },
  ...mapQuests,
  ...diffQuests,
  // hatching & collecting
  { id: 'hatch10', ch: 'hatch', name: 'ฟักไข่ 10 ฟอง', goal: s => n(s.stats.hatch, 10), reward: { gems: 10 } },
  { id: 'hatch30', ch: 'hatch', name: 'ฟักไข่ 30 ฟอง', goal: s => n(s.stats.hatch, 30), reward: { gems: 15, egg: 'silver' } },
  { id: 'hatch100', ch: 'hatch', name: 'ฟักไข่ 100 ฟอง', goal: s => n(s.stats.hatch, 100), reward: { gems: 20, egg: 'gold' } },
  { id: 'craft1', ch: 'hatch', name: 'ประกอบไข่จากเศษไข่', goal: s => n(s.stats.craft, 1), reward: { gems: 10 } },
  { id: 'gemegg1', ch: 'hatch', name: 'ซื้อไข่ปริศนาลายทองด้วยเพชร', goal: s => n(s.stats.gemEggs, 1), reward: { gold: 2000 } },
  { id: 'rush1', ch: 'hatch', name: 'เร่งเวลาบ่มไข่', goal: s => n(s.stats.rush, 1), reward: { gold: 1000 } },
  { id: 'rare1', ch: 'hatch', name: 'ได้มอนระดับหายาก', goal: s => n(dexHas(s, 'rare'), 1), reward: { gold: 1000 } },
  { id: 'epic1', ch: 'hatch', name: 'ได้มอนระดับมหากาพย์', goal: s => n(dexHas(s, 'epic'), 1), reward: { gems: 10, soul: 1 } },
  { id: 'legend1', ch: 'hatch', name: 'ได้มอนระดับตำนาน', goal: s => n(dexHas(s, 'legendary'), 1), reward: { gems: 15, soul: 1 } },
  { id: 'rareform1', ch: 'hatch', name: 'ได้มอนร่างหายาก', goal: s => n(s.dexRare.length, 1), reward: { gems: 15 } },
  { id: 'dex8', ch: 'hatch', name: 'ค้นพบมอน 8 ชนิด', goal: s => n(s.dex.length, 8), reward: { gems: 10 } },
  { id: 'dex11', ch: 'hatch', name: 'ค้นพบมอน 11 ชนิด', goal: s => n(s.dex.length, 11), reward: { gems: 10, frags: { A09: 5 } } },
  { id: 'dex14', ch: 'hatch', name: 'ค้นพบมอน 14 ชนิด', goal: s => n(s.dex.length, 14), reward: { gems: 15, frags: { A09: 10 } } },
  { id: 'dexall', ch: 'hatch', name: `ค้นพบมอนครบ ${allSpecies} ชนิด`, goal: s => n(s.dex.filter(id => SPECIES[id] && !shardOnly(SPECIES[id])).length, allSpecies), reward: { gems: 20 } },
  // growth & evolution (SW: power-up → evolve → 5★ → 6★)
  { id: 'feed10', ch: 'grow', name: 'ป้อนมอนเพิ่มเลเวล 10 ครั้ง', goal: s => n(s.stats.feed, 10), reward: { gems: 5, gold: 2000 } },
  { id: 'feed50', ch: 'grow', name: 'ป้อนมอนเพิ่มเลเวล 50 ครั้ง', goal: s => n(s.stats.feed, 50), reward: { gems: 10, gold: 5000 } },
  { id: 'lvlmax', ch: 'grow', name: 'มีมอนเลเวลเต็มของดาว', goal: s => n(s.mons.some(m => m.lvl >= levelCap(m.stars)) ? 1 : 0, 1), reward: { gems: 5, gold: 2000 } },
  { id: 'skill10', ch: 'grow', name: 'อัปสกิล 10 ครั้ง', goal: s => n(s.stats.skillUp, 10), reward: { gems: 5, soul: 1 } },
  { id: 'skillmax', ch: 'grow', name: 'มีมอนสกิลเต็มทุกช่อง', goal: s => n(s.mons.some(skillMaxed) ? 1 : 0, 1), reward: { gems: 10, soul: 1 } },
  { id: 'evo1', ch: 'grow', name: 'อัปดาวครั้งแรก', goal: s => n(s.stats.evolve, 1), reward: { gems: 10, frags: { B07: 5 } } },
  { id: 'evo5', ch: 'grow', name: 'อัปดาว 5 ครั้ง', goal: s => n(s.stats.evolve, 5), reward: { gems: 10 } },
  { id: 'evo15', ch: 'grow', name: 'อัปดาว 15 ครั้ง', goal: s => n(s.stats.evolve, 15), reward: { gems: 10, soul: 1 } },
  { id: 'star3', ch: 'grow', name: 'มีมอน ★3', goal: s => n(maxStars(s), 3), reward: { gems: 10, soul: 1 } },
  { id: 'star4', ch: 'grow', name: 'มีมอน ★4', goal: s => n(maxStars(s), 4), reward: { gems: 10, soul: 1 } },
  { id: 'star5', ch: 'grow', name: 'มีมอน ★5 (ร่างวิวัฒน์)', goal: s => n(maxStars(s), 5), reward: { gems: 20, egg: 'gold' } },
  { id: 'star5x4', ch: 'grow', name: 'มีมอน ★5 ขึ้นไป 4 ตัว (ทีมเต็ม)', goal: s => n(starsAtLeast(s, 5), 4), reward: { gems: 10, soul: 2 } },
  { id: 'star6', ch: 'grow', name: 'มีมอน ★6', goal: s => n(maxStars(s), 6), reward: { gems: 25, egg: 'rainbow' } },
  // battle
  { id: 'wins10', ch: 'fight', name: 'ชนะการต่อสู้ 10 ครั้ง', goal: s => n(s.stats.wins, 10), reward: { gems: 5 } },
  { id: 'wins50', ch: 'fight', name: 'ชนะการต่อสู้ 50 ครั้ง', goal: s => n(s.stats.wins, 50), reward: { gems: 10, gold: 3000 } },
  { id: 'wins150', ch: 'fight', name: 'ชนะการต่อสู้ 150 ครั้ง', goal: s => n(s.stats.wins, 150), reward: { gems: 10, egg: 'gold' } },
  { id: 'ult30', ch: 'fight', name: 'ใช้ท่าไม้ตาย 30 ครั้ง', goal: s => n(s.stats.ult, 30), reward: { gems: 5 } },
  { id: 'perfect20', ch: 'fight', name: 'กด PERFECT 20 ครั้ง', goal: s => n(s.stats.perfect, 20), reward: { gems: 5 } },
  { id: 'react10', ch: 'fight', name: 'ทำปฏิกิริยาธาตุ 10 ครั้ง', goal: s => n(s.stats.react, 10), reward: { gems: 5 } },
  { id: 'react100', ch: 'fight', name: 'ทำปฏิกิริยาธาตุ 100 ครั้ง', goal: s => n(s.stats.react, 100), reward: { gems: 5, gold: 3000 } },
  { id: 'react5k', ch: 'fight', name: 'ทำปฏิกิริยาธาตุครบ 5 แบบ', goal: s => n(s.stats.reactKinds.length, 5), reward: { gems: 10, soul: 1 } },
  // home
  { id: 'castle2', ch: 'home', name: 'ป้อมพันธสัญญา Lv.2', goal: s => n(home(s).castle, 2), reward: { gems: 5, gold: 1000 } },
  { id: 'castle3', ch: 'home', name: 'ป้อมพันธสัญญา Lv.3', goal: s => n(home(s).castle, 3), reward: { gems: 5, gold: 2000 } },
  { id: 'castle4', ch: 'home', name: 'ป้อมพันธสัญญา Lv.4 (เต่าโตเต็มที่)', goal: s => n(home(s).castle, 4), reward: { gems: 10, egg: 'gold' } },
  { id: 'hatchery2', ch: 'home', name: 'รังฟักไข่ Lv.2 (บ่มได้ 2 ฟอง)', goal: s => n(home(s).lv.hatchery || 1, 2), reward: { gems: 5 } },
  { id: 'mine3', ch: 'home', name: 'เหมืองผลึกดาว Lv.3', goal: s => n(home(s).lv.mine || 1, 3), reward: { gold: 3000 } },
  { id: 'mine20', ch: 'home', name: 'เก็บทองจากเหมือง 20 ครั้ง', goal: s => n(s.stats.mine, 20), reward: { gold: 2000 } },
  { id: 'shrine5', ch: 'home', name: 'อัปศาลหกธาตุรวม 5 ขั้น', goal: s => n(Object.values(home(s).shrine).reduce((a, b) => a + b, 0), 5), reward: { gems: 5 } },
  { id: 'relic2', ch: 'home', name: 'มีวัตถุศักดิ์สิทธิ์ 2 ชิ้น', goal: s => n(home(s).relics.length, 2), reward: { gems: 5 } },
];
export const chapterOf = (id: string) => CHAPTERS.find(c => c.id === id)!;
export const questsIn = (ch: string) => QUESTS.filter(q => q.ch === ch);
export const questDone = (s: SaveData, q: Quest) => { const [a, b] = q.goal(s); return a >= b; };
/** chapter chest: opens once every quest in the chapter is claimed (claim id 'ch:<id>') */
export const chapterDone = (s: SaveData, ch: string) => questsIn(ch).every(q => s.quests.includes(q.id));
export const chapterClaimable = (s: SaveData) => CHAPTERS.filter(c => !s.quests.includes('ch:' + c.id) && chapterDone(s, c.id));
export const claimable = (s: SaveData) => QUESTS.filter(q => !s.quests.includes(q.id) && questDone(s, q));
export const bookGems = () => QUESTS.reduce((a, q) => a + (q.reward.gems || 0), 0) + CHAPTERS.reduce((a, c) => a + (c.bonus.gems || 0), 0);
function give(s: SaveData, r: Reward, rnd: () => number) {
  s.gems += r.gems || 0; s.gold += r.gold || 0; s.items.soul += r.soul || 0;
  for (const [sid, k] of Object.entries(r.frags || {})) s.frags[sid] = (s.frags[sid] || 0) + k;
  if (r.egg) s.eggs.push(mysteryEgg(s, r.egg, rnd));
}
/** claim one finished quest's reward (once); 'ch:<id>' claims a finished chapter's chest */
export function claimQuest(s: SaveData, id: string, rnd: () => number = Math.random): Reward | null {
  if (id.startsWith('ch:')) {
    const c = CHAPTERS.find(x => 'ch:' + x.id === id); if (!c || s.quests.includes(id) || !chapterDone(s, c.id)) return null;
    s.quests.push(id); give(s, c.bonus, rnd); return c.bonus;
  }
  const q = QUESTS.find(x => x.id === id); if (!q || s.quests.includes(id) || !questDone(s, q)) return null;
  s.quests.push(id); give(s, q.reward, rnd); return q.reward;
}
/** a mystery egg of a fixed shell tier (species rolled with that tier's odds; does not touch the drop pity) */
export function mysteryEgg(s: SaveData, tier: EggTier, rnd: () => number = Math.random): EggSave {
  const sid = rollEggSpecies(tier, rnd);
  return { id: s.nextEggId++, sid, kind: 'mystery', tier, rare: rollEggRare(tier, sid, rnd) };
}

// ---- gem uses ----
/** buy a gold-pattern mystery egg (species rolled with the gold tier's rarity odds; does not touch the drop pity) */
export function buyGoldEgg(s: SaveData, rnd: () => number = Math.random) {
  if (s.gems < GEM_GOLD_EGG) return null;
  s.gems -= GEM_GOLD_EGG; s.stats.gemEggs++;
  const e = mysteryEgg(s, 'gold', rnd); s.eggs.push(e); return e;
}
/** the player's local calendar day: the rush price ladder starts over each day */
export const dayKey = (now = Date.now()) => { const d = new Date(now); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
/** rushes already bought today */
export const rushesToday = (s: SaveData, now = Date.now()) => s.rush && s.rush.day === dayKey(now) ? s.rush.n : 0;
/** full price of a rush for an egg tier, `k` rushes into the day (default: the next one) */
export const rushPrice = (s: SaveData, tier: string, now = Date.now(), k = rushesToday(s, now)) => Math.round((RUSH_BASE[tier] ?? RUSH_BASE.gold) * RUSH_STEP[Math.min(k, RUSH_STEP.length - 1)]);
/** what rushing this egg costs right now: the next rush price × the share of incubation still left */
export const rushCost = (s: SaveData, eggId: number, now = Date.now()) => {
  const x = incubOf(s, eggId), l = incubLeft(s, eggId, now); if (!x || !l) return 0;
  return Math.max(1, Math.ceil(rushPrice(s, x.tier || 'gold', now) * l / Math.max(1, x.end - x.start) - 1e-9));
};
/** finish an incubating egg now for gems (moves today's price ladder one step up) */
export function rushEgg(s: SaveData, eggId: number, now = Date.now()) {
  const x = incubOf(s, eggId), c = rushCost(s, eggId, now); if (!x || !c || s.gems < c) return false;
  s.gems -= c; x.end = now; s.stats.rush++; s.rush = { day: dayKey(now), n: rushesToday(s, now) + 1 }; return true;
}
