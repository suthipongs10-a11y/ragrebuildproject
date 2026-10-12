// Adventure book (สมุดผจญภัย): one-time quests that hand out gems, high-tier egg shards, gold and soul crystals.
// Progress is read from the save (stages, dex, monsters) and lifetime counters (save.stats); rewards are claimed by hand.
import { SPECIES, STAGES, GEM_GOLD_EGG, GEM_PER_10MIN, EGG_TIERS } from '../core/data';
import type { SaveData } from './save';
import { rollRarity, rollSpecies } from './progression';
import { incubOf, incubLeft } from './home';

export interface Reward { gems?: number; gold?: number; soul?: number; frags?: Record<string, number> }
export interface Quest { id: string; cat: string; name: string; goal: (s: SaveData) => [number, number]; reward: Reward }
const n = (v: number, t: number): [number, number] => [Math.min(v, t), t];
const dexHas = (s: SaveData, r: string) => s.dex.filter(id => SPECIES[id]?.rarity === r).length;
const stageStars = (s: SaveData, id: string) => s.stages[id] || 0;
const lastStage = STAGES[STAGES.length - 1].id;

export const QUEST_CATS = ['เริ่มต้น', 'เติบโต', 'สะสม', 'ผจญภัย'];
export const QUESTS: Quest[] = [
  { id: 'win1', cat: 'เริ่มต้น', name: 'ชนะการต่อสู้ครั้งแรก', goal: s => n(s.stats.wins, 1), reward: { gems: 30, gold: 500 } },
  { id: 'hatch1', cat: 'เริ่มต้น', name: 'ฟักไข่ครั้งแรก', goal: s => n(s.stats.hatch, 1), reward: { gems: 30 } },
  { id: 'ult1', cat: 'เริ่มต้น', name: 'ใช้ท่าไม้ตาย', goal: s => n(s.stats.ult, 1), reward: { gems: 20 } },
  { id: 'perfect1', cat: 'เริ่มต้น', name: 'กดจังหวะ PERFECT ท่าไม้ตาย', goal: s => n(s.stats.perfect, 1), reward: { gems: 20 } },
  { id: 'react1', cat: 'เริ่มต้น', name: 'ทำปฏิกิริยาธาตุครั้งแรก', goal: s => n(s.stats.react, 1), reward: { gems: 20 } },
  { id: 'feed1', cat: 'เติบโต', name: 'เพิ่มเลเวลด้วยการป้อนมอน', goal: s => n(s.stats.feed, 1), reward: { gems: 20, gold: 1000 } },
  { id: 'skill1', cat: 'เติบโต', name: 'อัปสกิล', goal: s => n(s.stats.skillUp, 1), reward: { gems: 30 } },
  { id: 'lvlmax', cat: 'เติบโต', name: 'มีมอนเลเวลเต็มของดาว', goal: s => n(s.mons.some(m => m.lvl >= [0, 15, 20, 25, 30, 35, 40][m.stars]) ? 1 : 0, 1), reward: { gems: 20, gold: 2000 } },
  { id: 'evo1', cat: 'เติบโต', name: 'อัปดาวครั้งแรก', goal: s => n(s.stats.evolve, 1), reward: { gems: 50, frags: { B07: 5 } } },
  { id: 'star3', cat: 'เติบโต', name: 'มีมอน ★3', goal: s => n(Math.max(...s.mons.map(m => m.stars)), 3), reward: { gems: 50, soul: 1 } },
  { id: 'star4', cat: 'เติบโต', name: 'มีมอน ★4', goal: s => n(Math.max(...s.mons.map(m => m.stars)), 4), reward: { gems: 80, soul: 1 } },
  { id: 'hatch10', cat: 'สะสม', name: 'ฟักไข่ 10 ฟอง', goal: s => n(s.stats.hatch, 10), reward: { gems: 50 } },
  { id: 'dex8', cat: 'สะสม', name: 'ค้นพบมอน 8 ชนิด', goal: s => n(s.dex.length, 8), reward: { gems: 30 } },
  { id: 'dex11', cat: 'สะสม', name: 'ค้นพบมอน 11 ชนิด', goal: s => n(s.dex.length, 11), reward: { gems: 50, frags: { A09: 5 } } },
  { id: 'dex14', cat: 'สะสม', name: 'ค้นพบมอน 14 ชนิด', goal: s => n(s.dex.length, 14), reward: { gems: 80, frags: { A09: 10 } } },
  { id: 'rare1', cat: 'สะสม', name: 'ได้มอนระดับหายาก', goal: s => n(dexHas(s, 'rare'), 1), reward: { gems: 30 } },
  { id: 'epic1', cat: 'สะสม', name: 'ได้มอนระดับมหากาพย์', goal: s => n(dexHas(s, 'epic'), 1), reward: { gems: 80, soul: 1 } },
  ...STAGES.map((st, i) => ({ id: 'clear' + st.id, cat: 'ผจญภัย', name: `ผ่านด่าน ${st.id}`, goal: (s: SaveData) => n(stageStars(s, st.id) > 0 ? 1 : 0, 1), reward: st.id === lastStage ? { gems: 50, soul: 1 } : { gold: 800 + i * 400 } })),
  ...STAGES.map(st => ({ id: 'star' + st.id, cat: 'ผจญภัย', name: `ด่าน ${st.id} ครบ 3 ดาว`, goal: (s: SaveData) => n(stageStars(s, st.id), 3), reward: { gems: 20 } })),
  { id: 'react10', cat: 'ผจญภัย', name: 'ทำปฏิกิริยาธาตุ 10 ครั้ง', goal: s => n(s.stats.react, 10), reward: { gems: 30 } },
  { id: 'react5k', cat: 'ผจญภัย', name: 'ทำปฏิกิริยาธาตุครบ 5 แบบ', goal: s => n(s.stats.reactKinds.length, 5), reward: { gems: 50, soul: 1 } },
  { id: 'wins10', cat: 'ผจญภัย', name: 'ชนะการต่อสู้ 10 ครั้ง', goal: s => n(s.stats.wins, 10), reward: { gems: 30 } },
];
export const questDone = (s: SaveData, q: Quest) => { const [a, b] = q.goal(s); return a >= b; };
export const claimable = (s: SaveData) => QUESTS.filter(q => !s.quests.includes(q.id) && questDone(s, q));
export const bookGems = () => QUESTS.reduce((a, q) => a + (q.reward.gems || 0), 0);
/** claim one finished quest's reward (once) */
export function claimQuest(s: SaveData, id: string): Reward | null {
  const q = QUESTS.find(x => x.id === id); if (!q || s.quests.includes(id) || !questDone(s, q)) return null;
  const r = q.reward; s.quests.push(id);
  s.gems += r.gems || 0; s.gold += r.gold || 0; s.items.soul += r.soul || 0;
  for (const [sid, k] of Object.entries(r.frags || {})) s.frags[sid] = (s.frags[sid] || 0) + k;
  return r;
}

// ---- gem uses ----
/** buy a gold-pattern mystery egg (species rolled with the gold tier's rarity odds; does not touch the drop pity) */
export function buyGoldEgg(s: SaveData, rnd: () => number = Math.random) {
  if (s.gems < GEM_GOLD_EGG) return null;
  s.gems -= GEM_GOLD_EGG; s.stats.gemEggs++;
  const e = { id: s.nextEggId++, sid: rollSpecies(rollRarity('gold', rnd), rnd), kind: 'mystery' as const, tier: 'gold' as const, rare: rnd() < EGG_TIERS.gold.rareForm };
  s.eggs.push(e); return e;
}
export const rushCost = (s: SaveData, eggId: number, now = Date.now()) => { const l = incubLeft(s, eggId, now); return l ? Math.max(1, Math.ceil(l / 600000) * GEM_PER_10MIN) : 0; };
/** finish an incubating egg now for gems */
export function rushEgg(s: SaveData, eggId: number, now = Date.now()) {
  const x = incubOf(s, eggId), c = rushCost(s, eggId, now); if (!x || !c || s.gems < c) return false;
  s.gems -= c; x.end = now; s.stats.rush++; return true;
}
