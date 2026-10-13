// Adventure book (สมุดผจญภัย): one-time quests grouped in chapters (one per map region + one per game system), handing out
// gems (600 in total for the current content), mystery eggs, egg shards, gold and soul crystals; a finished chapter opens a chest.
// Progress is read from the save (stages, dex, monsters) and lifetime counters (save.stats); rewards are claimed by hand.
import { SPECIES, STAGES, GEM_GOLD_EGG, GEM_PER_10MIN, EGG_TIERS, levelCap } from '../core/data';
import type { EggTier } from '../core/data';
import type { SaveData, EggSave } from './save';
import { rollRarity, rollSpecies, skillMaxed } from './progression';
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
const allSpecies = Object.values(SPECIES).filter(x => !x.boss).length;
/** levels gained across every building since a new home (castle 1, five buildings at 1, shrine 0) */
const homeUps = (s: SaveData) => { const h = home(s); return h.castle - 1 + Object.values(h.lv).reduce((a, b) => a + b, 0) - 5 + Object.values(h.shrine).reduce((a, b) => a + b, 0); };

// ---- maps: one chapter per region, three quests per stage (clear · 3 stars · win 5 times); new stages join automatically ----
export const REGION_NAME: Record<string, string> = { '1': 'ทุ่งไข่ป่วน' };
const regions = [...new Set(STAGES.map(st => st.id.split('-')[0]))];
const regionChapters: Chapter[] = regions.map(r => ({ id: 'map' + r, name: `แผนที่ ${r} · ${REGION_NAME[r] || 'ภพที่ ' + r}`, desc: 'ผ่านทุกด่าน เก็บครบ 3 ดาว และชนะซ้ำด่านละ 5 ครั้ง', bonus: { gems: 40, egg: 'gold' } }));
const mapQuests: Quest[] = STAGES.flatMap((st, i) => {
  const ch = 'map' + st.id.split('-')[0], boss = STAGES[i + 1]?.id.split('-')[0] !== st.id.split('-')[0];
  return [
    { id: 'clear' + st.id, ch, name: `ผ่านด่าน ${st.id} ${st.name}`, goal: (s: SaveData) => n(stageStars(s, st.id) > 0 ? 1 : 0, 1), reward: boss ? { gold: 1500, soul: 1 } : { gold: 800 + i * 400 } },
    { id: 'star' + st.id, ch, name: `ด่าน ${st.id} ครบ 3 ดาว`, goal: (s: SaveData) => n(stageStars(s, st.id), 3), reward: { gems: 10 } },
    { id: 'farm' + st.id, ch, name: `ชนะด่าน ${st.id} 5 ครั้ง`, goal: (s: SaveData) => n(s.stats.stageWins[st.id] || 0, 5), reward: boss ? { egg: 'silver', gold: 1000 } : { gold: 600 + i * 300 } },
  ];
});

export const CHAPTERS: Chapter[] = [
  { id: 'start', name: 'นักผจญภัยมือใหม่', desc: 'เรียนรู้ทุกระบบของเกม', bonus: { gems: 30, egg: 'silver' } },
  ...regionChapters,
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
  { id: 'dexall', ch: 'hatch', name: `ค้นพบมอนครบ ${allSpecies} ชนิด`, goal: s => n(s.dex.length, allSpecies), reward: { gems: 20 } },
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
  return { id: s.nextEggId++, sid: rollSpecies(rollRarity(tier, rnd), rnd), kind: 'mystery', tier, rare: rnd() < EGG_TIERS[tier].rareForm };
}

// ---- gem uses ----
/** buy a gold-pattern mystery egg (species rolled with the gold tier's rarity odds; does not touch the drop pity) */
export function buyGoldEgg(s: SaveData, rnd: () => number = Math.random) {
  if (s.gems < GEM_GOLD_EGG) return null;
  s.gems -= GEM_GOLD_EGG; s.stats.gemEggs++;
  const e = mysteryEgg(s, 'gold', rnd); s.eggs.push(e); return e;
}
export const rushCost = (s: SaveData, eggId: number, now = Date.now()) => { const l = incubLeft(s, eggId, now); return l ? Math.max(1, Math.ceil(l / 600000) * GEM_PER_10MIN) : 0; };
/** finish an incubating egg now for gems */
export function rushEgg(s: SaveData, eggId: number, now = Date.now()) {
  const x = incubOf(s, eggId), c = rushCost(s, eggId, now); if (!x || !c || s.gems < c) return false;
  s.gems -= c; x.end = now; s.stats.rush++; return true;
}
