/**
 * CSV (exported from Google Sheets) -> public/content/content.json with validation.
 * Usage: npm run content
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import Papa from 'papaparse';
import { isElement } from '../shared/formulas/elements';
import type {
  ContentBundle, MonsterDef, DropDef, ItemDef, CardDef, SpiritDef, SkillDef, JobDef, SpiritSkillDef, SpiritElementDef, SummonDef, RuneSetDef, RuneStatDef, RuneUpgradeDef, RuneDropDef,
} from '../shared/content/types';
import { evalExpr } from '../shared/formulas/expr';

const ROOT = join(import.meta.dirname, '..');
const SRC = join(ROOT, 'content');
const OUT = join(ROOT, 'public', 'content');

type Row = Record<string, string>;
const errors: string[] = [];
const err = (m: string) => errors.push(m);

function read(name: string): Row[] {
  const file = join(SRC, `${name}.csv`);
  if (!existsSync(file)) { err(`missing content/${name}.csv`); return []; }
  const res = Papa.parse<Row>(readFileSync(file, 'utf8'), { header: true, skipEmptyLines: true });
  for (const e of res.errors) err(`${name}.csv row ${e.row}: ${e.message}`);
  return res.data;
}
const num = (r: Row, k: string, t: string): number => {
  const v = Number(r[k] ?? '');
  if (r[k] === undefined || r[k] === '' || Number.isNaN(v)) { err(`${t} ${r.id ?? ''}: "${k}" is not a number (${r[k]})`); return 0; }
  return v;
};
const bool = (r: Row, k: string) => (r[k] ?? '').toLowerCase() === 'true';
const json = (r: Row, k: string, t: string): Record<string, unknown> => {
  const s = r[k]; if (!s) return {};
  try { return JSON.parse(s) as Record<string, unknown>; } catch { err(`${t} ${r.id ?? ''}: "${k}" invalid JSON`); return {}; }
};
const el = (r: Row, k: string, t: string) => {
  const v = r[k] ?? '';
  if (v === '' || v === 'weapon') return null;
  if (!isElement(v)) { err(`${t} ${r.id}: unknown element "${v}"`); return 'neutral' as const; }
  return v;
};
function uniqueIds(list: { id: string }[], t: string) {
  const seen = new Set<string>();
  for (const x of list) { if (seen.has(x.id)) err(`${t}: duplicate id "${x.id}"`); seen.add(x.id); if (!/^[a-z0-9_]+$/.test(x.id)) err(`${t}: bad id "${x.id}" (lowercase snake_case only)`); }
}

const monsters: MonsterDef[] = read('monsters').map((r) => {
  const [w, h] = (r.hitbox ?? '16x16').split('x').map(Number);
  const e = el(r, 'element', 'monster') ?? 'neutral';
  return {
    id: r.id ?? '', name_key: r.name_key ?? '', tier: (r.tier ?? 'normal') as MonsterDef['tier'], zone: r.zone ?? '',
    level: num(r, 'level', 'monster'), hp: num(r, 'hp', 'monster'), atk: num(r, 'atk', 'monster'), def: num(r, 'def', 'monster'),
    element: e, element_lv: num(r, 'element_lv', 'monster'), size: (r.size ?? 'small') as MonsterDef['size'],
    ai: (r.ai ?? 'walker') as MonsterDef['ai'], ai_params: json(r, 'ai_params', 'monster'), stompable: bool(r, 'stompable'),
    exp: num(r, 'exp', 'monster'), job_exp: num(r, 'job_exp', 'monster'), zeny_min: num(r, 'zeny_min', 'monster'), zeny_max: num(r, 'zeny_max', 'monster'),
    card_id: r.card_id ?? '', card_rate: num(r, 'card_rate', 'monster'), respawn_sec: num(r, 'respawn_sec', 'monster'),
    art_pack: r.art_pack ?? '', hitbox: { w: w ?? 16, h: h ?? 16 }, draw_h: num(r, 'draw_h', 'monster'),
  };
});
const drops: DropDef[] = read('drops').map((r) => ({
  monster_id: r.monster_id ?? '', item_id: r.item_id ?? '', rate: num(r, 'rate', 'drop'), min: num(r, 'min', 'drop'), max: num(r, 'max', 'drop'),
}));
const items: ItemDef[] = read('items').map((r) => ({
  id: r.id ?? '', name_key: r.name_key ?? '', type: r.type ?? '', subtype: r.subtype ?? '', tier: r.tier ?? 'common',
  job_mask: (r.job_mask ?? 'all').split('|'), level_req: num(r, 'level_req', 'item'),
  atk: num(r, 'atk', 'item'), matk: num(r, 'matk', 'item'), def: num(r, 'def', 'item'), hp: num(r, 'hp', 'item'), sp: num(r, 'sp', 'item'),
  str: num(r, 'str', 'item'), agi: num(r, 'agi', 'item'), vit: num(r, 'vit', 'item'), int: num(r, 'int', 'item'), dex: num(r, 'dex', 'item'), luk: num(r, 'luk', 'item'), crit: num(r, 'crit', 'item'),
  element: el(r, 'element', 'item'), slots: num(r, 'slots', 'item'), refineable: bool(r, 'refineable'), price: num(r, 'price', 'item'),
  icon: r.icon ?? '', rig_parts: r.rig_parts || null, use: r.use ? (json(r, 'use', 'item') as Record<string, number>) : null,
}));
const cards: CardDef[] = read('cards').map((r) => ({
  id: r.id ?? '', name_key: r.name_key ?? '', slot_type: r.slot_type ?? 'any', effects: json(r, 'effects', 'card'), set_id: r.set_id || null, art: r.art ?? '',
}));
const spirits: SpiritDef[] = read('spirits').map((r) => {
  const star = num(r, 'base_star', 'spirit');
  return {
    id: r.id ?? '', name_key: r.name_key ?? '', element: el(r, 'element', 'spirit') ?? 'neutral',
    elements: star >= 4 ? ['water', 'fire', 'earth', 'wind', 'holy', 'dark'] : ['water', 'fire', 'earth', 'wind'], base_star: star,
    role: (r.role ?? 'attacker') as SpiritDef['role'], hp: num(r, 'hp', 'spirit'), atk: num(r, 'atk', 'spirit'), def: num(r, 'def', 'spirit'),
    spd: num(r, 'spd', 'spirit'), crit: num(r, 'crit', 'spirit'), auto: r.auto ?? '', awk_auto: r.awk_auto ?? '', ult: r.ult ?? '', leader: r.leader ?? '',
    ability: (r.ability || 'none') as SpiritDef['ability'], awk_ess: num(r, 'awk_ess', 'spirit'), awk_magic: num(r, 'awk_magic', 'spirit'),
    art_small: r.art_small ?? '', art_big: r.art_big ?? '', art_awk_small: r.art_awk_small ?? '', art_awk_big: r.art_awk_big ?? '',
  };
});
const spiritSkills: SpiritSkillDef[] = read('spirit_skills').map((r) => ({
  id: r.id ?? '', name_key: r.name_key ?? '', type: (r.type ?? 'auto') as SpiritSkillDef['type'], cd: num(r, 'cd', 'spirit skill'),
  target: (r.target ?? 'bolt') as SpiritSkillDef['target'], hits: num(r, 'hits', 'spirit skill'), power: num(r, 'power', 'spirit skill'),
  effects: json(r, 'effects', 'spirit skill') as Record<string, number>, vfx: r.vfx ?? '',
}));
const spiritElements: SpiritElementDef[] = read('spirit_elements').map((r) => ({
  element: el(r, 'element', 'spirit element') ?? 'neutral', hp: num(r, 'hp', 'spirit element'), atk: num(r, 'atk', 'spirit element'),
  def: num(r, 'def', 'spirit element'), spd: num(r, 'spd', 'spirit element'), essence: r.essence ?? '', color: parseInt(r.color ?? '0', 16),
}));
const spiritConfig: Record<string, string> = Object.fromEntries(read('spirit_config').map((r) => [r.key ?? '', r.value ?? '']));
const summon: SummonDef[] = read('summon').map((r) => ({
  id: r.id ?? '', item: r.item ?? '', name_key: r.name_key ?? '', elements: (r.elements ?? '').split('|').filter(Boolean),
  rates: [1, 2, 3, 4, 5].map((i) => num(r, `r${i}`, 'summon')), pity_n: num(r, 'pity_n', 'summon'), pity_star: num(r, 'pity_star', 'summon'),
}));
const runeSets: RuneSetDef[] = read('runes').map((r) => ({ id: r.id ?? '', name_key: r.name_key ?? '', pieces: num(r, 'pieces', 'rune set'), bonus: json(r, 'bonus', 'rune set') as Record<string, number> }));
const runeStats: RuneStatDef[] = read('rune_stats').map((r) => ({
  stat: r.stat ?? '', name_key: r.name_key ?? '', flat: bool(r, 'flat'), main_slots: (r.main_slots ?? '').split('|').filter(Boolean).map(Number),
  main_lo: num(r, 'main_lo', 'rune stat'), main_hi: num(r, 'main_hi', 'rune stat'), sub_lo: num(r, 'sub_lo', 'rune stat'), sub_hi: num(r, 'sub_hi', 'rune stat'),
}));
const runeUpgrade: RuneUpgradeDef[] = read('rune_upgrade').map((r) => ({ lv: num(r, 'lv', 'rune upgrade'), rate: num(r, 'rate', 'rune upgrade'), zeny: num(r, 'zeny', 'rune upgrade') }));
const runeDrop: RuneDropDef[] = read('rune_drop').map((r) => ({
  tier: r.tier ?? '', chance: num(r, 'chance', 'rune drop'), star_lo: num(r, 'star_lo', 'rune drop'), star_hi: num(r, 'star_hi', 'rune drop'),
  rarity: [0, 1, 2, 3, 4].map((i) => num(r, `r${i}`, 'rune drop')),
}));
const skills: SkillDef[] = read('skills').map((r) => ({
  id: r.id ?? '', owner: r.owner ?? '', name_key: r.name_key ?? '', type: (r.type ?? 'active') as SkillDef['type'], max_lv: num(r, 'max_lv', 'skill'),
  sp: r.sp ?? '0', cd: num(r, 'cd', 'skill'), cast: num(r, 'cast', 'skill'), target: r.target ?? 'front', hit_count: num(r, 'hit_count', 'skill'),
  power: r.power ?? '1', element: r.element || null, effects: json(r, 'effects', 'skill'), requires: json(r, 'requires', 'skill') as Record<string, number>,
  icon: r.icon ?? '', vfx: r.vfx || null,
}));

const jobs: JobDef[] = read('jobs').map((r) => ({
  id: (r.id ?? '') as JobDef['id'], name_key: r.name_key ?? '', tier: num(r, 'tier', 'job'), from_job: (r.from_job || null) as JobDef['from_job'],
  job_lv_req: num(r, 'job_lv_req', 'job'), job_max: num(r, 'job_max', 'job'), hp_factor: num(r, 'hp_factor', 'job'), sp_factor: num(r, 'sp_factor', 'job'),
  aspd_factor: num(r, 'aspd_factor', 'job'), weapons: (r.weapons ?? '').split('|').filter(Boolean), starter_weapon: r.starter_weapon ?? '',
  parts_set: r.parts_set ?? '', skills: (r.skills ?? '').split('|').filter(Boolean),
}));

uniqueIds(monsters, 'monsters'); uniqueIds(jobs, 'jobs'); uniqueIds(items, 'items'); uniqueIds(cards, 'cards'); uniqueIds(spirits, 'spirits'); uniqueIds(skills, 'skills');
const itemIds = new Set(items.map((i) => i.id)), cardIds = new Set(cards.map((c) => c.id)), monIds = new Set(monsters.map((m) => m.id));
for (const m of monsters) {
  if (m.card_id && !cardIds.has(m.card_id)) err(`monster ${m.id}: unknown card_id ${m.card_id}`);
  if (m.card_rate < 0 || m.card_rate > 1) err(`monster ${m.id}: card_rate out of range`);
  if (m.hp <= 0) err(`monster ${m.id}: hp must be > 0`);
}
for (const d of drops) {
  if (!monIds.has(d.monster_id)) err(`drop: unknown monster ${d.monster_id}`);
  if (!itemIds.has(d.item_id)) err(`drop: unknown item ${d.item_id}`);
  if (d.rate < 0 || d.rate > 1) err(`drop ${d.monster_id}/${d.item_id}: rate out of range`);
}
const skillIds = new Set(skills.map((s) => s.id));
const jobIds = new Set(jobs.map((j) => j.id));
const formula = (f: unknown, where: string) => { if (typeof f !== 'string') return; try { evalExpr(f, { lv: 1, int: 1, dex: 1 }); } catch (e) { err(`${where}: ${(e as Error).message}`); } };
for (const s of skills) {
  for (const req of Object.keys(s.requires)) if (!skillIds.has(req)) err(`skill ${s.id}: requires unknown skill ${req}`);
  if (!jobIds.has(s.owner as JobDef['id'])) err(`skill ${s.id}: unknown owner job ${s.owner}`);
  formula(s.sp, `skill ${s.id} sp`); formula(s.power, `skill ${s.id} power`);
  for (const [k, v] of Object.entries(s.effects)) if (k !== 'buff' && k !== 'debuff') formula(v, `skill ${s.id} effect ${k}`);
}
for (const j of jobs) {
  if (j.from_job && !jobIds.has(j.from_job)) err(`job ${j.id}: unknown from_job ${j.from_job}`);
  if (!itemIds.has(j.starter_weapon)) err(`job ${j.id}: unknown starter weapon ${j.starter_weapon}`);
  for (const s of j.skills) { const d = skills.find((x) => x.id === s); if (!d) err(`job ${j.id}: unknown skill ${s}`); else if (d.owner !== j.id) err(`job ${j.id}: skill ${s} belongs to ${d.owner}`); }
}

// ── spirits / summon / runes ──
const sskill = new Map(spiritSkills.map((s) => [s.id, s]));
uniqueIds(spiritSkills, 'spirit skills'); uniqueIds(runeSets, 'rune sets');
for (const sp of spirits) {
  if (sp.base_star < 1 || sp.base_star > 5) err(`spirit ${sp.id}: base_star must be 1-5`);
  for (const [k, type] of [['auto', 'auto'], ['awk_auto', 'auto'], ['ult', 'ult'], ['leader', 'leader']] as const) {
    const d = sskill.get(sp[k]); if (!d) err(`spirit ${sp.id}: unknown ${k} skill ${sp[k]}`); else if (d.type !== type) err(`spirit ${sp.id}: ${k} skill ${sp[k]} is type ${d.type}`);
  }
  if (!['double', 'dive', 'break', 'cloud', 'reveal', 'none'].includes(sp.ability)) err(`spirit ${sp.id}: unknown ability ${sp.ability}`);
}
for (const e of spiritElements) if (!itemIds.has(e.essence)) err(`spirit element ${e.element}: unknown essence item ${e.essence}`);
if (!itemIds.has('ess_magic')) err('items: ess_magic missing (awakening)');
for (const s of summon) {
  if (!itemIds.has(s.item)) err(`summon ${s.id}: unknown item ${s.item}`);
  const sum = s.rates.reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 1) > 1e-9) err(`summon ${s.id}: rates sum to ${sum}, must be 1`);
  for (let i = 0; i < 5; i++) {
    if (!(s.rates[i] as number)) continue;
    const els = s.elements.includes('pick') ? ['water', 'fire', 'earth', 'wind'] : s.elements;
    for (const e of els) if (!spirits.some((sp) => sp.base_star === i + 1 && sp.elements.includes(e as SpiritDef['element']))) err(`summon ${s.id}: no ${i + 1}★ ${e} family`);
  }
}
for (const r of runeStats) for (const sl of r.main_slots) if (sl < 1 || sl > 6) err(`rune stat ${r.stat}: bad slot ${sl}`);
for (let sl = 1; sl <= 6; sl++) if (!runeStats.some((r) => r.main_slots.includes(sl))) err(`rune stats: no main stat for slot ${sl}`);
if (runeUpgrade.length !== 15) err('rune_upgrade.csv must have 15 rows (+1..+15)');
for (const key of ['gauge_max', 'gauge_hero_hit', 'gauge_spirit_hit', 'gauge_kill', 'combo_window', 'combo_mult', 'star_mul', 'starter_team', 'starter_items'])
  if (!(key in spiritConfig)) err(`spirit_config: missing ${key}`);
for (const part of [...(spiritConfig.starter_team ?? '').split('|'), ...(spiritConfig.starter_box ?? '').split('|')].filter(Boolean)) {
  const [fam, e] = part.split(':'); const sp = spirits.find((x) => x.id === fam);
  if (!sp || !sp.elements.includes(e as SpiritDef['element'])) err(`spirit_config: bad starter spirit ${part}`);
}
for (const part of (spiritConfig.starter_items ?? '').split('|').filter(Boolean)) if (!itemIds.has(part.split(':')[0] ?? '')) err(`spirit_config: unknown starter item ${part}`);

if (errors.length) {
  console.error(`content: ${errors.length} error(s)\n - ${errors.join('\n - ')}`);
  process.exit(1);
}
const bundle: ContentBundle = {
  contentVersion: new Date().toISOString().slice(0, 10), monsters, drops, items, cards, spirits, skills, jobs,
  spiritSkills, spiritElements, spiritConfig, summon, runeSets, runeStats, runeUpgrade, runeDrop,
};
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'content.json'), JSON.stringify(bundle));
console.log(`content: ok — ${monsters.length} monsters, ${items.length} items, ${cards.length} cards, ${spirits.length} spirits, ${skills.length} skills, ${jobs.length} jobs, ${drops.length} drops`);
