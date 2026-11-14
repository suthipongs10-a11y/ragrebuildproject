// Game layer: profile, training, outfits, matchmaking, corner plans, rewards and ranking.
// It never touches fight rules: it builds two fighter specs and plans, hands them to the simulation through the viewer,
// and turns the result into progress. Save lives in the browser and, when the page has it, in the artifact database.
import { STYLES, STAT_TH, FIRST, CAMP, PLAN, PLAN_DEFAULT, MOVES, STYLE_PLAN, VENUE_RULES, RULES } from './data.js';
import { PLAN_TIPS } from './plantips.js';
import { simulate } from './sim.js';
import { siteRuntime } from './netdb.js';

const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const KEYS = ['pow', 'kick', 'spd', 'def', 'end', 'chin'];
const baht = n => Math.round(n).toLocaleString('en-US');
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---------- design data ----------
const START = { // starting stats per style; weaker styles at equal stats start with more
  puncher: {pow: 54, kick: 38, spd: 44, def: 42, end: 46, chin: 50}, kicker: {pow: 38, kick: 54, spd: 46, def: 42, end: 42, chin: 40},
  clinch: {pow: 46, kick: 48, spd: 40, def: 44, end: 52, chin: 54}, tech: {pow: 38, kick: 42, spd: 52, def: 54, end: 42, chin: 40}
};
const STYLE_NOTE = {
  puncher: 'หมัดหนัก ชุดหมัดต่อเนื่อง น็อกได้ด้วยหมัดเดียว แต่การ์ดหลวม', kicker: 'เตะแม่น คุมระยะวงนอก ก้านคออันตราย แต่คางไม่แข็ง',
  clinch: 'เดินบุกเข้ากอด ตีเข่า ตีศอก อึดและทน แต่ช้า', tech: 'เร็ว ป้องกันดี จับขา สวนกลับ แต่หมัดไม่หนัก'
};
const OPP_PLAN = STYLE_PLAN;
// Corner advice before a fight: the plan options that measurably help this style against that style (table from mass simulation).
function matchupTip(opp) {
  const row = (PLAN_TIPS[S.style] || {})['vs ' + STYLES.find(x => x.id === opp).th]; if (!row) return 'ดูเชิงยกแรกก่อน แล้วค่อยแก้แผนตอนพักยก';
  const pick = (pre, map, label) => { let best = null, bv = 4, worst = null, wv = -8; for (const k in map) { const v = row[pre + ':' + k]; if (v > bv) { bv = v; best = k; } if (v < wv) { wv = v; worst = k; } } return [best && label(map[best]), worst && label(map[worst])]; };
  const a = pick('ag', PLAN.ag, x => x), r = pick('rg', PLAN.range, x => x), t = pick('tg', PLAN.target, x => 'เน้น' + x);
  const good = [a[0], r[0], t[0]].filter(Boolean), bad = [a[1], r[1], t[1]].filter(Boolean);
  return 'เขาเป็นสาย' + STYLES.find(x => x.id === opp).th + ' ' + (good.length ? 'แผนที่ได้ผลกับสายนี้: ' + good.join(' · ') : 'ไม่มีแผนไหนได้เปรียบชัด ใช้แผนสมดุลแล้วดูเชิงก่อน') + (bad.length ? ' หลีกเลี่ยง: ' + bad.join(' · ') : '');
}
const ACTS = [
  {id: 'bag', th: 'กระสอบทราย', drill: 'bag', focus: 'punch', stat: ['pow'], fat: 12, note: 'เน้นต่อย เพิ่มหมัดศอก มีเตะและถีบสลับ'},
  {id: 'banana', th: 'เตะต้นกล้วย', drill: 'banana', focus: 'kick', stat: ['kick'], fat: 12, note: 'เน้นเตะ เพิ่มเตะเข่า แข้งแกร่ง'},
  {id: 'dummy', th: 'ถีบหุ่น', drill: 'dummy', focus: 'teep', stat: ['spd', 'def'], fat: 10, note: 'เน้นถีบ คุมระยะ เพิ่มความเร็วและป้องกัน'},
  {id: 'rope', th: 'กระโดดเชือก ชกลม', stat: ['spd'], fat: 8, note: 'เพิ่มความเร็ว'},
  {id: 'spar', th: 'ลงนวมซ้อมคู่', stat: ['def', 'chin'], fat: 16, note: 'เพิ่มป้องกันและคาง เสี่ยงเจ็บ'},
  {id: 'run', th: 'วิ่ง', stat: ['end'], fat: 10, note: 'เพิ่มความอึด'},
  {id: 'fun', th: 'พักผ่อนหย่อนใจ', stat: [], fat: -14, note: 'ดูหนัง ตกปลา กินข้าวกับที่บ้าน อารมณ์ดีขึ้น'},
  {id: 'rest', th: 'พัก นวด', stat: [], fat: -32, note: 'ลดความล้า'}
];
// Mood: how the fighter feels. It lifts or drags training and, a little, the fight itself. Wins and time off raise it, losses and overwork lower it.
const MOODS = ['แย่มาก', 'แย่', 'ปกติ', 'ดี', 'ดีเยี่ยม'], MOOD_TRAIN = [.8, .9, 1, 1.1, 1.2], MOOD_FIGHT = [.96, .98, 1, 1.02, 1.04];
// Training while worn out can go wrong: no gain, more fatigue, a worse mood, sometimes a small injury.
const FAIL = {from: 50, perPoint: .9, lowMood: 1.2, fatigue: 8, hurt: .35};
// Staff: hired once, paid every morning. A coach lifts one kind of training; the masseur helps recovery.
const STAFF = [
  {id: 'punch', th: 'ครูหมัด', hire: 900, wage: 30, note: 'ซ้อมกระสอบทรายได้ผล +25%'},
  {id: 'kick', th: 'ครูเตะ', hire: 900, wage: 30, note: 'ซ้อมเตะต้นกล้วยได้ผล +25%'},
  {id: 'tech', th: 'ครูเชิง', hire: 900, wage: 30, note: 'ซ้อมถีบหุ่นและลงนวมได้ผล +25%'},
  {id: 'massage', th: 'หมอนวด', hire: 600, wage: 25, note: 'นอนพักลดล้าเพิ่มอีก 12 พักนวดลดเพิ่มอีก 10'}
];
const STAFF_ACT = {bag: 'punch', banana: 'kick', dummy: 'tech', spar: 'tech'};
// One belt per league, fought for against its champion once the fighter is near the top of that league.
const BELTS = ['เข็มขัดงานวัด', 'เข็มขัดอำเภอ', 'เข็มขัดจังหวัด', 'เข็มขัดเวทีมาตรฐาน', 'เข็มขัดแชมป์ประเทศ'];
// Drill: the trainer calls strikes, the player presses them in time. What each strike trains, and how often each target calls for it.
const KINDS = {punch: {th: 'ต่อย', stat: {pow: 1}, key: ['a', 'j', 'arrowleft']}, kick: {th: 'เตะ', stat: {kick: 1}, key: ['s', 'k', 'arrowdown']}, teep: {th: 'ถีบ', stat: {spd: .5, def: .5}, key: ['d', 'l', 'arrowright']}};
const DRILL_MIX = {bag: {punch: .6, kick: .25, teep: .15}, banana: {punch: .15, kick: .7, teep: .15}, dummy: {punch: .25, kick: .2, teep: .55}};
const DRILL = {lead: 2.4, beat: .5, gap: .95, notes: 24, perfect: .085, good: .17, late: .25, focusBonus: 1.3, ahead: 1.7};
// where a fight is held: local challenges at the temple fair, ranked fights by league, the rope-fist bout at the old ground
const LEAGUE_VENUE = ['temple', 'temple', 'province', 'stadium', 'champ'];
const LEAGUES = [[0, 'เวทีงานวัด'], [1100, 'เวทีอำเภอ'], [1250, 'เวทีจังหวัด'], [1400, 'เวทีมาตรฐาน'], [1600, 'ศึกชิงแชมป์']];
const GYM_COST = [0, 1200, 2800, 5500, 9000];
const PRICE = {colors: {gold: 250, green: 250, purple: 250, pink: 250, orange: 250}, patterns: {stripe: 300, hem: 300, split: 400, zigzag: 500}, head: {mongkol: 600}, hair: {brown: 200, blond: 300, red: 300, silver: 300, blue: 350, green: 350, pink: 350, purple: 350}};
const LOOK_KIND = {shorts: 'colors', trim: 'colors', gloves: 'colors', pattern: 'patterns', head: 'head', hair: 'hair'};
const SPECIALS = ['spChop', 'spHanu', 'spKick', 'spCroc', 'spFly'];
const SP_FAME = [30, 80, 160];      // fame needed for each extra signature move beyond the style's two
// Or learn one sooner from a visiting master, for money. Each move then trains up to level 3: a day's training slot,
// money and fatigue per level; the fight engine makes a higher level harder to stop and heavier (RULES.spLvAcc / spLvDmg).
const SP_LEARN = [1500, 2500, 4000], SP_UP = [0, 800, 1800], SP_MAX = 3, SP_UP_FAT = 12;
const MISSIONS = [{id: 'train', th: 'ซ้อมครบ 3 ครั้ง', need: 3, money: 100, fame: 0}, {id: 'win', th: 'ชนะ 1 ไฟต์', need: 1, money: 150, fame: 1}, {id: 'ranked', th: 'ขึ้นชกจัดอันดับ 1 ไฟต์', need: 1, money: 120, fame: 2}];
const SAVE_KEY = 'muayManagerSave1';

let API = null, S = null, tab = 'home', view = null, CLOUD = null, board = [], cloudNote = 'กำลังเชื่อมต่อ…', pending = null, mini = null, F = null, DR = null;

// ---------- save ----------
function newSave(name, body, style) {
  return {v: 1, name, body, style, stats: Object.assign({}, START[style]), look: {shorts: 'red', trim: 'white', pattern: 'plain', gloves: 'red', head: 'none', hair: 'natural'},
    own: {colors: ['red', 'blue', 'black', 'white'], patterns: ['plain'], head: ['none'], hair: ['natural']}, mood: 2, staff: [], belts: [], title: 1, day: 1, slots: 3, ranked: 2, fatigue: 0, money: 500, fame: 0, rp: 1000, best: 1000,
    rec: {w: 0, l: 0, ko: 0}, gym: 1, chuek: 1, seed: Math.floor(Math.random() * 1e9), plan: Object.assign({}, PLAN_DEFAULT), log: [],
    sp: STYLES.find(x => x.id === style).sp.slice(), spOwn: STYLES.find(x => x.id === style).sp.slice(), mis: {day: 1, n: {}}, spLv: {}, rivals: [], rematch: 1, defendDue: 0, defends: 0, chDone: [], updatedAt: Date.now()};
}
function loadLocal() { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); return valid(s) ? fix(s) : null; } catch (e) { return null; } }
function fix(s) { // fields added after a save was made
  const sp = STYLES.find(x => x.id === s.style).sp;
  if (!Array.isArray(s.spOwn)) s.spOwn = sp.slice();
  if (!Array.isArray(s.sp) || !s.sp.length) s.sp = sp.slice();
  if (!s.spLv || typeof s.spLv !== 'object') s.spLv = {};
  if (!Array.isArray(s.rivals)) s.rivals = [];
  if (!Array.isArray(s.chDone)) s.chDone = [];
  if (typeof s.rematch !== 'number') s.rematch = 1;
  if (typeof s.defendDue !== 'number') s.defendDue = 0;
  if (typeof s.defends !== 'number') s.defends = 0;
  if (!s.mis || typeof s.mis !== 'object' || !s.mis.n) s.mis = {day: s.day, n: {}};
  if (typeof s.chuek !== 'number') s.chuek = 1;
  if (!s.look.hair) s.look.hair = 'natural';
  if (!Array.isArray(s.own.hair)) s.own.hair = ['natural'];
  if (s.own.head.includes('band')) { s.own.head = s.own.head.filter(k => k !== 'band'); s.money += 350; } // the cloth band left the game: money back
  if (!API.HEADGEAR[s.look.head]) s.look.head = 'none';
  if (typeof s.mood !== 'number') s.mood = 2;
  if (!Array.isArray(s.staff)) s.staff = [];
  if (!Array.isArray(s.belts)) s.belts = [];
  if (typeof s.title !== 'number') s.title = 1;
  return s;
}
// daily missions: progress counts up, the reward pays out the moment the target is reached
function mission(id, by) {
  if (S.mis.day !== S.day) S.mis = {day: S.day, n: {}};
  const m = MISSIONS.find(x => x.id === id), before = S.mis.n[id] || 0; S.mis.n[id] = before + (by || 1);
  if (before < m.need && S.mis.n[id] >= m.need) { S.money += m.money; S.fame += m.fame; return 'ภารกิจสำเร็จ: ' + m.th + ' ได้ ฿ ' + m.money + (m.fame ? ' ★ ' + m.fame : ''); }
  return '';
}
function unlockSpecials() { // more fame opens more signature moves to choose from
  const locked = SPECIALS.filter(k => !S.spOwn.includes(k)), have = S.spOwn.length - 2;
  if (locked.length && have < SP_FAME.length && S.fame >= SP_FAME[have]) { S.spOwn.push(locked[0]); return 'ปลดท่าไม้ตายใหม่: ' + MOVES[locked[0]].th; }
  return '';
}
function valid(s) { return s && s.v === 1 && typeof s.name === 'string' && START[s.style] && API.ROSTER[s.body] && s.stats && KEYS.every(k => typeof s.stats[k] === 'number'); }
let cloudTimer = 0, cloudBusy = false, cloudDirty = false;
function save() {
  S.updatedAt = Date.now();
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* storage blocked: progress lasts for this visit only */ }
  if (CLOUD) { cloudDirty = true; clearTimeout(cloudTimer); cloudTimer = setTimeout(pushCloud, 2500); }
}
async function pushCloud() {
  if (!CLOUD || cloudBusy || !cloudDirty || !S) return;
  cloudBusy = true; cloudDirty = false;
  try {
    await CLOUD.db.collection('data/users/' + CLOUD.uid).doc('save').set(JSON.parse(JSON.stringify(S)));
    await CLOUD.db.doc('board/' + CLOUD.uid).set({name: S.name, rp: S.rp, w: S.rec.w, l: S.rec.l, ko: S.rec.ko, body: S.body, style: S.style, look: S.look, stats: roundStats(S.stats), t: Date.now()});
    cloudNote = 'ออนไลน์ บันทึกแล้ว';
  } catch (e) { cloudNote = 'บันทึกออนไลน์ไม่ได้ ใช้การบันทึกในเครื่อง'; }
  cloudBusy = false; if (cloudDirty) cloudTimer = setTimeout(pushCloud, 2500);
}
async function cloudInit() {
  try {
    // inside claude.ai the artifact runtime holds the store; on the game's own website, the site's /api does
    const rt = window.claude && window.claude.use ? window.claude : await siteRuntime();
    if (!rt) { cloudNote = 'ออฟไลน์ บันทึกในเครื่องนี้'; return; }
    const [db, user] = await Promise.all([rt.use('db'), rt.use('user')]);
    const uid = db && user ? await user.id() : null;
    if (!uid) { cloudNote = 'ออฟไลน์ บันทึกในเครื่องนี้'; if (tab === 'rank' || tab === 'home') render(); return; }
    CLOUD = {db, uid}; cloudNote = 'ออนไลน์';
    const snap = await db.collection('data/users/' + uid).doc('save').get();
    const c = snap.exists ? snap.data() : null;
    if (valid(c) && (!S || (c.updatedAt || 0) > (S.updatedAt || 0))) { S = fix(c); try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* fine */ } if (!F) go('home'); }
    else if (S) save();
    await loadBoard(); chSubscribe();
  } catch (e) { cloudNote = 'ออฟไลน์ บันทึกในเครื่องนี้'; }
  if (!F && view !== 'create') render();
}
async function loadBoard() {
  if (!CLOUD) return;
  try {
    const q = await CLOUD.db.collection('board').orderBy('rp', 'desc').limit(60).get();
    board = q.docs.map(d => ({id: d.id, d: d.data() || {}})).filter(x => x.id !== CLOUD.uid && typeof x.d.rp === 'number' && typeof x.d.name === 'string')
      .map(x => ({id: x.id, real: true, name: API.cleanName(x.d.name) || 'นักมวย', rp: clamp(Math.round(x.d.rp), 0, 4000), w: x.d.w | 0, l: x.d.l | 0, ko: x.d.ko | 0,
        body: API.ROSTER[x.d.body] ? x.d.body : 'c', style: START[x.d.style] ? x.d.style : 'tech', look: cleanLook(x.d.look), stats: cleanStats(x.d.stats)}));
  } catch (e) { /* the built-in rivals still fill the table */ }
}
const roundStats = st => { const o = {}; KEYS.forEach(k => { o[k] = Math.round(st[k]); }); return o; };
function cleanStats(st) { const o = {}; KEYS.forEach(k => { o[k] = clamp(Math.round(+(st && st[k]) || 40), 20, 100); }); return o; }
function cleanLook(l) { l = l || {}; const pick = (map, v, d) => (map[v] ? v : d); return {shorts: pick(API.COLORS, l.shorts, 'blue'), trim: pick(API.COLORS, l.trim, 'white'), gloves: pick(API.COLORS, l.gloves, 'blue'), pattern: pick(API.PATTERNS, l.pattern, 'plain'), head: pick(API.HEADGEAR, l.head, 'none'), hair: pick(API.HAIR, l.hair, 'natural')}; }

// ---------- derived values ----------
const total = st => KEYS.reduce((a, k) => a + st[k], 0);
const overall = st => Math.round(total(st) / 6);
const league = rp => { let i = 0; LEAGUES.forEach((l, k) => { if (rp >= l[0]) i = k; }); return i; };
const cap = () => 62 + S.gym * 7;
const fatigueMul = () => 1 - Math.max(0, S.fatigue - 40) / 200;
const coachOf = a => S.staff.includes(STAFF_ACT[a.id]);
const boost = a => MOOD_TRAIN[S.mood] * (coachOf(a) ? 1.25 : 1);
const failPct = a => a.stat.length ? Math.round(Math.max(0, S.fatigue - FAIL.from) * FAIL.perPoint * (S.mood <= 1 ? FAIL.lowMood : 1)) : 0;
function moodUp(n) { const b = S.mood; S.mood = clamp(S.mood + n, 0, 4); return S.mood === b ? '' : ' อารมณ์' + (n > 0 ? 'ดีขึ้น' : 'แย่ลง') + 'เป็น "' + MOODS[S.mood] + '"'; }
function playerSpec() { const st = {}, m = fatigueMul() * MOOD_FIGHT[S.mood]; KEYS.forEach(k => { st[k] = clamp(Math.round(S.stats[k] * m), 20, 100); }); return {name: S.name, first: S.name, style: S.style, stats: st, skin: 0, sp: S.sp.slice(), spLv: Object.assign({}, S.spLv || {})}; }
const spLv = k => (S.spLv && S.spLv[k]) || 1;
// opponents train their signature moves too: one level per two leagues, champions one more
function oppSpLv(style, lg, champ) { const lv = Math.min(SP_MAX, 1 + Math.floor(lg / 2) + (champ ? 1 : 0)), o = {}; STYLES.find(x => x.id === style).sp.forEach(k => { o[k] = lv; }); return o; }
function makeStats(style, T, R) { const b = START[style], sum = total(b), st = {}; KEYS.forEach(k => { st[k] = clamp(Math.round(b[k] * T / sum + (R() - .5) * 8), 22, 99); }); return st; }
function randomLook(R) { const cs = Object.keys(API.COLORS), ps = Object.keys(API.PATTERNS), hs = Object.keys(API.HEADGEAR); return {shorts: cs[Math.floor(R() * cs.length)], trim: cs[Math.floor(R() * cs.length)], gloves: cs[Math.floor(R() * cs.length)], pattern: ps[Math.floor(R() * ps.length)], head: hs[Math.floor(R() * hs.length)], hair: R() < .7 ? 'natural' : Object.keys(API.HAIR)[1 + Math.floor(R() * (Object.keys(API.HAIR).length - 1))]}; }
function makeOpp(seed, T, fixedName) {
  const R = rng(seed), style = STYLES[Math.floor(R() * STYLES.length)].id, bodies = Object.keys(API.ROSTER).filter(b => b !== S.body);
  const name = fixedName || FIRST[Math.floor(R() * FIRST.length)] + ' ' + CAMP[Math.floor(R() * CAMP.length)];
  return {name, style, body: bodies[Math.floor(R() * bodies.length)], look: randomLook(R), stats: makeStats(style, T, R)};
}
// built-in rivals so the ranking is never empty; other players' fighters join them when the page is online
const GHOSTS = (() => { const out = [], R = rng(20261110); for (let i = 0; i < 48; i++) { const rp = Math.round(1960 - i * 24 + (R() - .5) * 14); out.push({rp, seed: 7000 + i, name: FIRST[(i * 5 + 3) % FIRST.length] + ' ' + CAMP[(i * 3 + 1) % CAMP.length], w: Math.round((rp - 700) / 22 + R() * 6), l: Math.round(8 + R() * 14)}); } return out; })();
const ghostTotal = rp => clamp(262 + (rp - 1000) * .24, 215, 560);
function rankRows() {
  const rows = GHOSTS.map(g => ({name: g.name, rp: g.rp, w: g.w, l: g.l, ghost: g})).concat(board.map(b => ({name: b.name, rp: b.rp, w: b.w, l: b.l, real: b})));
  if (S) rows.push({name: S.name, rp: S.rp, w: S.rec.w, l: S.rec.l, me: true});
  return rows.sort((a, b) => b.rp - a.rp);
}
function localOpps() {
  const T = total(S.stats), lg = league(S.rp);
  return [[.86, 'ง่าย', 120, 2], [.97, 'สูสี', 220, 4], [1.08, 'ยาก', 380, 7]].map((d, i) => {
    const o = makeOpp(S.seed + S.day * 31 + i, T * d[0]); o.kind = 'local'; o.venue = 'temple'; o.diff = d[1]; o.money = d[2] + lg * 60; o.fame = d[3] + lg; o.id = 'l' + i; return o;
  });
}
// one rope-fist bout a day at the old ground: no gloves, harder blows, good for fame
function chuekOpp() { const lg = league(S.rp), o = makeOpp(S.seed + S.day * 53 + 9, total(S.stats) * 1.02); o.kind = 'chuek'; o.venue = 'chuek'; o.diff = 'คาดเชือก'; o.money = 260 + lg * 80; o.fame = 9 + lg * 2; o.id = 'c'; return o; }
// the belt of the fighter's league: on offer once he is near the top of it, against a champion stronger than the usual opposition
function titleNeed() { const next = LEAGUES[league(S.rp) + 1]; return next ? next[0] - 60 : 1750; }
function titleOpp() {
  const lg = league(S.rp), next = LEAGUES[lg + 1];
  if (S.belts.includes(lg) || S.rp < titleNeed()) return null;
  const o = makeOpp(9100 + lg, ghostTotal((next ? next[0] : 1900) + 70));
  o.kind = 'title'; o.belt = lg; o.venue = lg >= 3 ? 'champ' : LEAGUE_VENUE[lg]; o.diff = 'แชมป์' + LEAGUES[lg][1].replace('เวที', '').replace('ศึกชิงแชมป์', 'ประเทศ'); o.money = 800 + lg * 600; o.fame = 20 + lg * 12; o.id = 't'; return o;
}
// Rivals: the last few who beat us. One rematch a day, for a bigger purse; they have trained since.
const RIVAL = {keep: 3, grow: 1.03, money: 1.6, fame: 1.5};
function rivalOpp() {
  const r = S.rivals[0]; if (!r || S.rematch < 1) return null;
  const lg = league(S.rp), st = {}; KEYS.forEach(k => { st[k] = clamp(Math.round(r.stats[k] * RIVAL.grow), 20, 100); });
  return {name: r.name, style: r.style, body: r.body, look: r.look, stats: st, kind: 'rival', venue: LEAGUE_VENUE[lg], diff: 'คู่ปรับ แพ้เขา ' + r.losses + ' ครั้ง', money: Math.round((300 + lg * 150) * RIVAL.money), fame: Math.round((8 + lg * 4) * RIVAL.fame), id: 'v'};
}
// Holding a belt: a challenger for the highest one comes every few days; ignore him too long and the belt is taken away.
const DEFEND = {every: 3, grace: 2};
function defenseOpp() {
  if (!S.belts.length || S.day < S.defendDue) return null;
  const b = Math.max(...S.belts), o = makeOpp(9400 + b * 37 + S.defends * 11, total(S.stats) * 1.04);
  o.kind = 'defense'; o.belt = b; o.venue = b >= 3 ? 'champ' : LEAGUE_VENUE[b]; o.diff = 'ผู้ท้าชิง' + BELTS[b]; o.money = 700 + b * 500; o.fame = 18 + b * 10; o.id = 'd'; return o;
}
function rankedOpp() {
  const R = rng(S.seed + S.day * 977 + S.ranked * 13 + S.rec.w + S.rec.l), near = rankRows().filter(r => !r.me && Math.abs(r.rp - S.rp) <= 130);
  const pool = near.length ? near : rankRows().filter(r => !r.me).sort((a, b) => Math.abs(a.rp - S.rp) - Math.abs(b.rp - S.rp)).slice(0, 4);
  const r = pool[Math.floor(R() * pool.length)];
  let o;
  if (r.real) o = {name: r.real.name, style: r.real.style, body: r.real.body, look: r.real.look, stats: r.real.stats, real: true};
  else o = makeOpp(r.ghost.seed, ghostTotal(r.rp), r.name);
  const lg = league(S.rp); o.kind = 'ranked'; o.venue = LEAGUE_VENUE[lg]; o.rp = r.rp; o.money = 300 + lg * 150; o.fame = 8 + lg * 4; o.id = 'r'; o.diff = r.rp > S.rp + 40 ? 'อันดับสูงกว่า' : r.rp < S.rp - 40 ? 'อันดับต่ำกว่า' : 'อันดับใกล้กัน';
  return o;
}

// ---------- rendering helpers ----------
const statBars = (st, cls, ref) => KEYS.map(k => '<div class="stat"><span>' + STAT_TH[k] + '</span><span class="t"><i style="width:' + clamp(st[k], 0, 100) + '%"></i></span><span class="v">' + Math.floor(st[k]) + (ref && Math.floor(st[k]) !== Math.floor(ref[k]) ? '' : '') + '</span></div>').join('');
const styleTh = id => STYLES.find(s => s.id === id).th;
const seg = (group, map, cur) => '<div class="segs">' + Object.keys(map).map(k => '<button class="btn seg sm" data-act="plan" data-g="' + group + '" data-v="' + k + '" aria-pressed="' + (k === cur) + '">' + map[k] + '</button>').join('') + '</div>';
function planPicker(p) { return '<div class="plan"><div class="row"><span class="lab">ท่าที</span>' + seg('ag', PLAN.ag, p.ag) + '</div><div class="row"><span class="lab">ระยะ</span>' + seg('range', PLAN.range, p.range) + '</div><div class="row"><span class="lab">เป้าเน้น</span>' + seg('target', PLAN.target, p.target) + '</div></div>'; }
const planText = p => PLAN.ag[p.ag] + ' · ' + PLAN.range[p.range] + ' · เน้น' + PLAN.target[p.target];
// a drawn image from assets/ui (embedded in the game page as CSS); without the art it takes no space
const art = (name, cls) => '<i class="ui ' + (cls || '') + '" data-ui="' + name + '" aria-hidden="true"></i>';
function topBar() {
  if (!S) { $('gTop').innerHTML = ''; return; }
  const f = Math.round(S.fatigue);
  $('gTop').innerHTML = '<div class="who"><b>' + esc(S.name) + '</b><span>' + LEAGUES[league(S.rp)][1] + ' · วันที่ ' + S.day + ' · อารมณ์ ' + art('mood-' + (S.mood + 1), 'mood') + '<i class="' + (S.mood > 2 ? 'hi' : S.mood < 2 ? 'lo' : '') + '">' + MOODS[S.mood] + '</i></span></div>' +
    '<div class="res"><span title="เงิน">' + art('icon-baht', 'ic') + '<b class="sym">฿</b> ' + baht(S.money) + '</span><span title="ชื่อเสียง">' + art('icon-fame', 'ic') + '<b class="sym">★</b> ' + S.fame + '</span><span title="คะแนนอันดับ">' + art('icon-rp', 'ic') + '<b class="sym">RP</b> ' + S.rp + '</span></div>' +
    '<div class="fat" title="ความล้า"><span>' + art('icon-fatigue', 'ic') + 'ล้า ' + f + '%</span><span class="t"><i class="' + (f >= 70 ? 'hi' : f >= 40 ? 'mid' : '') + '" style="width:' + f + '%"></i></span>' +
    (F ? '' : '<button class="btn link gset" data-act="settings" aria-pressed="' + !!(view && view.settings) + '">' + SPEAKER + 'ตั้งค่า</button>') + '</div>';
}
const SPEAKER = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M3 9v6h4l5 5V4L7 9H3z"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M16 8.5a5 5 0 0 1 0 7M18.8 5.8a9 9 0 0 1 0 12.4"/></svg>';
// sound settings (the viewer keeps them in this browser)
const VOL_TH = [['music', 'ดนตรีปี่กลอง'], ['voice', 'เสียงพากย์และกรรมการ'], ['crowd', 'เสียงคนดู'], ['sfx', 'เสียงชก ระฆัง']];
function settingsHtml() {
  const snd = API.sound, v = snd.vols;
  return '<section class="gcard gset-card"><h2>ตั้งค่าเสียง</h2>' +
    '<div class="setrow"><span>เสียงทั้งหมด</span><button class="btn ' + (snd.on ? 'go' : '') + '" data-act="soundon" role="switch" aria-checked="' + snd.on + '">' + (snd.on ? 'เปิดอยู่' : 'ปิดอยู่ แตะเพื่อเปิด') + '</button></div>' +
    VOL_TH.map(([k, th]) => '<label class="setrow vol"><span>' + th + '</span><input type="range" min="0" max="100" step="5" data-vol="' + k + '" value="' + Math.round(v[k] * 100) + '" aria-label="' + th + '"><output>' + Math.round(v[k] * 100) + '%</output></label>').join('') +
    '<p class="hint">ระดับเสียงจำไว้ในเครื่องนี้ เปิดเสียงไว้แล้วครั้งหน้าเสียงจะกลับมาเมื่อแตะหน้าจอครั้งแรก</p>' +
    '<div class="rowbtn"><button class="btn" data-act="soundtest"' + (snd.on ? '' : ' disabled') + '>ลองฟัง (ระฆัง)</button><button class="btn" data-act="setback">กลับ</button></div></section>';
}
function nav() {
  const tabs = [['home', 'ค่าย'], ['train', 'ซ้อม'], ['dress', 'แต่งตัว'], ['fight', 'หาคู่ชก'], ['rank', 'อันดับ']];
  const icon = {home: 'tab-camp', train: 'tab-train', dress: 'tab-dress', fight: 'tab-fight', rank: 'tab-rank'};
  $('gNav').innerHTML = tabs.map(t => '<button class="btn seg" data-act="tab" data-v="' + t[0] + '" aria-pressed="' + (tab === t[0]) + '">' + art(icon[t[0]], 'tab') + '<span>' + t[1] + '</span></button>').join('');
}
function setMode(fight) { const app = document.querySelector('.app'); app.classList.add('game'); app.classList.toggle('g-fight', !!fight); app.classList.toggle('g-menu', !fight); app.classList.toggle('g-drill', !!DR); }
function showMe(pose) { if (S) API.preview(Object.assign({fighter: S.body}, pending ? pending.look : S.look), pose || 'guard'); }

// ---------- screens ----------
function render() {
  topBar();
  if (view === 'create') return renderCreate();
  if (F) return renderFight();
  nav();
  const b = $('gBody');
  if (view && view.settings) b.innerHTML = settingsHtml();
  else if (tab === 'home') b.innerHTML = homeHtml();
  else if (tab === 'train') b.innerHTML = trainHtml();
  else if (tab === 'dress') b.innerHTML = dressHtml();
  else if (tab === 'fight') b.innerHTML = fightHtml();
  else b.innerHTML = rankHtml();
}
function go(t) { if (DR) drillEnd(true); tab = t; view = null; pending = null; mini = null; setMode(false); render(); showMe(t === 'dress' ? 'guard' : t === 'home' ? 'guard' : 'guard'); }

let draft = {body: 'c', style: 'puncher', name: ''};
function renderCreate() {
  $('gNav').innerHTML = '';
  $('gBody').innerHTML = '<section class="gcard"><h2>สร้างนักมวยของคุณ</h2>' +
    '<label class="fld" for="gName">ชื่อนักมวย</label><input id="gName" class="inp" maxlength="24" placeholder="เช่น เพชรน้ำหนึ่ง ศ.ของคุณ" value="' + esc(draft.name) + '">' +
    '<div class="fld">ตัวนักมวย</div><div class="pick">' + Object.keys(API.ROSTER).map(k => '<button class="btn seg sm" data-act="body" data-v="' + k + '" aria-pressed="' + (draft.body === k) + '">' + API.ROSTER[k][0] + '</button>').join('') + '</div>' +
    '<div class="fld">สายมวย</div><div class="styles">' + STYLES.map(s => '<button class="stylecard" data-act="style" data-v="' + s.id + '" aria-pressed="' + (draft.style === s.id) + '">' + art('style-' + s.id, 'pic') + '<b>' + s.th + '</b><span>' + STYLE_NOTE[s.id] + '</span><span class="sp">ท่าไม้ตาย: ' + s.sp.map(k => MOVES[k].th).join(' · ') + '</span></button>').join('') + '</div>' +
    '<div class="statbox r">' + statBars(START[draft.style]) + '</div>' +
    '<p class="hint" id="gCreateMsg"></p><button class="btn go wide" data-act="create">เริ่มอาชีพ</button></section>';
}
function homeHtml() {
  const rows = rankRows(), pos = rows.findIndex(r => r.me) + 1, lg = league(S.rp), next = LEAGUES[lg + 1];
  const goal = next ? 'อีก ' + (next[0] - S.rp) + ' RP จะได้ขึ้น' + next[1] : 'อยู่ระดับสูงสุดแล้ว รักษาอันดับไว้';
  const gymNext = S.gym < 5 ? '<button class="btn" data-act="gym">อัปเกรดค่าย ระดับ ' + (S.gym + 1) + ' · ฿ ' + baht(GYM_COST[S.gym]) + '</button>' : '<span class="hint">ค่ายระดับสูงสุดแล้ว</span>';
  const guide = S.rec.w + S.rec.l === 0 ? '<section class="gcard"><h2>เริ่มต้นยังไง</h2><p class="hint">1. ไปที่ "ซ้อม" ใช้แรงซ้อมวันละ 3 ครั้งเพิ่มค่าพลัง<br>2. ไปที่ "หาคู่ชก" ท้าชกเวทีงานวัดเพื่อหาเงินและประสบการณ์ แล้วลองศึกจัดอันดับ<br>3. ก่อนชกเลือกแผน และแก้แผนได้ทุกพักยกตามที่พี่เลี้ยงแนะนำ<br>4. กลับมา "จบวัน นอนพัก" เพื่อลดความล้าและเริ่มวันใหม่</p></section>' : '';
  return (view && view.note ? '<p class="gain">' + view.note + '</p>' : '') + nextMineHtml() + guide + '<section class="gcard"><h2>' + esc(S.name) + ' <small>สาย' + styleTh(S.style) + '</small></h2>' +
    '<div class="kv"><span>สถิติ</span><b>ชนะ ' + S.rec.w + ' (น็อก ' + S.rec.ko + ') แพ้ ' + S.rec.l + '</b><span>อันดับ</span><b>ที่ ' + pos + ' จาก ' + rows.length + ' · ' + LEAGUES[lg][1] + '</b><span>เข็มขัด</span><b>' + (S.belts.length ? '<span class="belts">' + S.belts.map(i => '<span class="belt">' + art('belt-' + (i + 1), 'beltimg') + BELTS[i] + '</span>').join('') + '</span>' : 'ยังไม่มี') + '</b><span>เป้าหมาย</span><b>' + goal + '</b></div>' +
    '<div class="statbox r">' + statBars(S.stats) + '</div><p class="hint">ค่าพลังเฉลี่ย ' + overall(S.stats) + ' · เพดานค่าพลังของค่ายระดับ ' + S.gym + ' คือ ' + cap() + '</p>' +
    '<div class="rowbtn">' + gymNext + '</div></section>' +
    '<section class="gcard"><h2>วันนี้</h2><div class="kv"><span>แรงซ้อม</span><b>เหลือ ' + S.slots + ' จาก 3 ครั้ง</b><span>ศึกจัดอันดับ</span><b>เหลือ ' + S.ranked + ' จาก 2 ไฟต์</b></div>' +
    '<div class="rowbtn"><button class="btn" data-act="tab" data-v="train">ไปซ้อม</button><button class="btn" data-act="tab" data-v="fight">หาคู่ชก</button><button class="btn go" data-act="sleep">จบวัน นอนพัก</button></div>' +
    '<p class="hint">นอนพักแล้วความล้าลด ' + (35 + (S.staff.includes('massage') ? 12 : 0)) + ' ได้แรงซ้อมและคู่ชกชุดใหม่ ได้ค่าสปอนเซอร์ ฿ ' + baht(40 + S.fame * 3) + (S.staff.length ? ' จ่ายค่าจ้างทีมงาน ฿ ' + baht(S.staff.reduce((a, id) => a + STAFF.find(x => x.id === id).wage, 0)) : '') + '</p></section>' +
    '<section class="gcard"><h2>ทีมงาน <small>จ่ายค่าจ้างทุกเช้า</small></h2>' + STAFF.map(st => { const on = S.staff.includes(st.id); return '<div class="staff">' + art('staff-' + st.id, 'face') + '<b>' + st.th + (on ? ' ✓' : '') + '</b><span>' + st.note + ' · ค่าจ้างวันละ ฿ ' + st.wage + '</span><button class="btn" data-act="staff" data-v="' + st.id + '">' + (on ? 'เลิกจ้าง' : 'จ้าง ฿ ' + baht(st.hire)) + '</button></div>'; }).join('') + '</section>' +
    '<section class="gcard"><h2>ภารกิจวันนี้</h2>' + MISSIONS.map(m => { const n = Math.min(m.need, (S.mis.day === S.day ? S.mis.n[m.id] : 0) || 0), done = n >= m.need; return '<div class="mis' + (done ? ' done' : '') + '"><span>' + (done ? '✓ ' : '') + m.th + '</span><span>' + n + '/' + m.need + '</span><span>฿ ' + m.money + (m.fame ? ' ★ ' + m.fame : '') + '</span></div>'; }).join('') + '</section>' +
    spHtml() +
    (S.log.length ? '<section class="gcard"><h2>ไฟต์ล่าสุด</h2>' + S.log.slice(0, 5).map(l => '<div class="logrow ' + (l.w ? 'w' : 'l') + '"><b>' + (l.w ? 'ชนะ' : 'แพ้') + '</b><span>' + esc(l.o) + '</span><span>' + esc(l.h) + '</span></div>').join('') + '</section>' : '') +
    '<p class="hint">' + cloudNote + ' · <button class="link" data-act="reset">เริ่มใหม่ทั้งหมด</button></p>';
}
// Signature moves: choose two to use, learn more from a master, train each up to level 3
function spHtml() {
  const nextFame = S.spOwn.length - 2 < SP_FAME.length && S.spOwn.length < SPECIALS.length ? SP_FAME[S.spOwn.length - 2] : null;
  const learnCost = SP_LEARN[Math.min(SP_LEARN.length - 1, Math.max(0, S.spOwn.length - 2))];
  const rows = SPECIALS.map(k => {
    const own = S.spOwn.includes(k), on = S.sp.includes(k), lv = spLv(k), stars = '★'.repeat(lv) + '☆'.repeat(SP_MAX - lv);
    const act = !own ? '<button class="btn" data-act="splearn" data-v="' + k + '"' + (S.money < learnCost ? ' disabled' : '') + '>เรียน ฿ ' + baht(learnCost) + '</button>'
      : lv < SP_MAX ? '<button class="btn" data-act="spup" data-v="' + k + '"' + (S.money < SP_UP[lv] || S.slots < 1 ? ' disabled' : '') + '>ฝึกขั้น ' + (lv + 1) + ' ฿ ' + baht(SP_UP[lv]) + '</button>' : '<span class="hint">ขั้นสูงสุด</span>';
    return '<div class="sprow' + (own ? '' : ' locked') + '"><button class="btn seg sm" data-act="sp" data-v="' + k + '" aria-pressed="' + on + '"' + (own ? '' : ' disabled') + '>' + MOVES[k].th + '</button>' +
      '<span class="lv" title="ขั้นที่ ' + lv + '">' + (own ? stars : 'ยังไม่ได้เรียน') + '</span>' + act + '</div>';
  }).join('');
  return '<section class="gcard"><h2>ท่าไม้ตาย <small>เลือกใช้ได้ 2 ท่า</small></h2>' + rows +
    '<p class="hint">ฝึกท่าขั้นถัดไปใช้แรงซ้อม 1 ครั้ง ความล้า +' + SP_UP_FAT + ' ทุกขั้นที่สูงขึ้น ท่าบังและหลบยากขึ้น ' + Math.round(RULES.spLvAcc * 100) + '% และแรงขึ้น ' + Math.round(RULES.spLvDmg * 100) + '% ' +
    (nextFame ? '· ท่าถัดไปปลดฟรีเมื่อชื่อเสียงถึง ★ ' + nextFame + ' หรือจ่ายครูเรียนก่อนได้ ' : '') + '· ท่าที่เลือกออกสลับกันเมื่อเกจท่าไม้ตายเต็ม</p></section>';
}
function trainHtml() {
  if (DR) return drillHtml();
  if (mini) return miniHtml();
  const c = cap();
  return '<section class="gcard"><h2>ตารางซ้อมวันนี้ <small>เหลือ ' + S.slots + ' ครั้ง</small></h2>' +
    (S.fatigue >= 70 ? '<p class="warn">ล้ามากแล้ว ซ้อมได้ผลน้อยลงและเสี่ยงเจ็บ ควรพัก</p>' : '') +
    '<div class="acts">' + ACTS.map(a => { const st = a.stat.map(k => STAT_TH[k] + ' ' + Math.floor(S.stats[k]) + '/' + c).join(' · '); return '<button class="act' + (a.drill ? ' drill' : '') + '" data-act="train" data-v="' + a.id + '"' + (S.slots < 1 ? ' disabled' : '') + '>' + art('act-' + a.id, 'pic') + '<b>' + a.th + (a.drill ? ' <i>กดเอง</i>' : '') + '</b><span>' + a.note + '</span><span class="sm">' + (st || 'ไม่ได้ค่าพลัง') + ' · ล้า ' + (a.fat > 0 ? '+' : '') + a.fat + (failPct(a) ? ' · เสี่ยงซ้อมพลาด ' + failPct(a) + '%' : '') + (coachOf(a) ? ' · ครูช่วย +25%' : '') + '</span></button>'; }).join('') + '</div>' +
    (S.slots < 1 ? '<p class="hint">แรงซ้อมหมดแล้ว ไปหาคู่ชก หรือจบวันที่หน้าค่าย</p>' : '<p class="hint">กระสอบทราย ต้นกล้วย และหุ่น เป็นการซ้อมแบบกดเอง: ครูเรียกท่า ต่อย เตะ ถีบ ให้กดตามจังหวะ ยิ่งตรงยิ่งได้ผลมาก การซ้อมอื่นกดปุ่มออกแรงให้ตรงช่วงสีทอง อารมณ์ตอนนี้ "' + MOODS[S.mood] + '" ผลซ้อม ×' + MOOD_TRAIN[S.mood] + ' ล้าเกิน 50% เริ่มเสี่ยงซ้อมพลาด</p>') +
    (view && view.msg ? '<p class="' + (view.bad ? 'warn' : 'gain') + '">' + view.msg + '</p>' : '') + '</section>';
}
function miniHtml() {
  return '<section class="gcard"><h2>' + mini.act.th + '</h2><p class="hint">กดปุ่มตอนเข็มอยู่ในช่วงสีทอง</p>' +
    '<div class="meter"><div class="zone good"></div><div class="zone best"></div><div class="needle" id="gNeedle"></div></div>' +
    '<button class="btn go wide" data-act="hit">ออกแรง!</button></section>';
}
function dressHtml() {
  const L = pending ? pending.look : S.look, hex = c => '#' + c.toString(16).padStart(6, '0');
  const row = (field, label, map, swatch) => '<div class="fld">' + label + '</div><div class="sw">' + Object.keys(map).map(k => {
    const kind = LOOK_KIND[field], owned = S.own[kind].includes(k), th = Array.isArray(map[k]) ? map[k][0] : map[k];
    return '<button class="swb" data-act="look" data-f="' + field + '" data-v="' + k + '" aria-pressed="' + (L[field] === k) + '"' + (swatch ? ' style="--c:' + (map[k][1] ? hex(map[k][1]) : 'linear-gradient(135deg,#1c1c22 50%,#6a4a2a 50%)') + '"' : '') + '>' + (swatch ? '<i></i>' : '') + th + (owned ? '' : ' <em>฿' + PRICE[kind][k] + '</em>') + '</button>';
  }).join('') + '</div>';
  let buy = '';
  if (pending) { const cost = pending.items.reduce((a, i) => a + i.price, 0); buy = '<div class="buy"><span>กำลังลองของที่ยังไม่มี: ' + pending.items.map(i => i.th + ' ฿' + i.price).join(', ') + '</span><div class="rowbtn"><button class="btn go" data-act="buy"' + (S.money < cost ? ' disabled' : '') + '>ซื้อ ฿ ' + baht(cost) + '</button><button class="btn" data-act="cancelbuy">ยกเลิก</button></div>' + (S.money < cost ? '<span class="warn">เงินไม่พอ ชกหาเงินก่อน</span>' : '') + '</div>'; }
  return '<section class="gcard"><h2>แต่งตัวนักมวย</h2>' + buy + '<label class="fld" for="gdname">ชื่อ</label><input id="gdname" class="inp" maxlength="24" value="' + esc(S.name) + '">' +
    row('shorts', 'สีกางเกง', API.COLORS, 1) + row('pattern', 'ลายกางเกง', API.PATTERNS) + row('trim', 'สีลายกางเกงและมงคล', API.COLORS, 1) + row('gloves', 'สีนวม', API.COLORS, 1) + (API.ROSTER[S.body][2] && API.ROSTER[S.body][2].bald ? '' : row('hair', 'สีผม', API.HAIR, 1)) + row('head', 'มงคล (สวมตอนไหว้ครู ถอดก่อนชก)', API.HEADGEAR) +
    '<p class="hint">กดเลือกแล้วเห็นบนตัวนักมวยทันที ของที่มีราคาลองใส่ได้ก่อน ซื้อครั้งเดียวใช้ได้ตลอด สีที่ซื้อแล้วใช้ได้ทั้งกางเกง ลาย และนวม</p></section>';
}
function oppCard(o, btn) {
  return '<div class="opp"><div class="oh"><b>' + esc(o.name) + '</b><span class="tag">' + o.diff + '</span></div><div class="sty">สาย' + styleTh(o.style) + ' · ค่าพลังเฉลี่ย ' + overall(o.stats) + (o.real ? ' · นักมวยของผู้เล่นจริง' : '') + (o.rp ? ' · RP ' + o.rp : '') + '</div>' +
    '<div class="rw">รางวัลชนะ ฿ ' + baht(o.money) + ' · ★ ' + o.fame + ' · สถานที่: ' + API.VENUES[o.venue] + '</div>' + btn + '</div>';
}
function fightHtml() {
  const tired = S.fatigue >= 90, dis = tired ? ' disabled' : '';
  const loc = localOpps().map(o => oppCard(o, '<button class="btn" data-act="pick" data-v="' + o.id + '"' + dis + '>ท้าชก</button>')).join('');
  const ro = rankedOpp();
  const rk = S.ranked > 0 ? oppCard(ro, '<button class="btn go" data-act="pick" data-v="r"' + dis + '>ชกจัดอันดับ</button>') : '<p class="hint">ชกจัดอันดับครบ 2 ไฟต์ของวันนี้แล้ว จบวันเพื่อชกต่อ</p>';
  const lgNow = league(S.rp), to = titleOpp();
  const title = S.belts.includes(lgNow) ? '<p class="hint">ครอง' + BELTS[lgNow] + 'แล้ว เข็มขัดถัดไปอยู่ที่ระดับสูงกว่า</p>'
    : !to ? '<p class="hint">ได้สิทธิ์ชิง' + BELTS[lgNow] + 'เมื่อคะแนนอันดับถึง RP ' + titleNeed() + ' (ตอนนี้ ' + S.rp + ')</p>'
    : S.title > 0 ? oppCard(to, '<button class="btn go" data-act="pick" data-v="t"' + dis + '>ชิง' + BELTS[lgNow] + '</button>') : '<p class="hint">ชิงเข็มขัดของวันนี้ไปแล้ว พรุ่งนี้ชิงใหม่ได้</p>';
  const df = defenseOpp(), rv = rivalOpp();
  const defSec = df ? '<section class="gcard">' + art('venue-' + df.venue, 'venue') + '<h2>ป้องกันแชมป์ <small>' + BELTS[df.belt] + '</small></h2>' + art('belt-' + (df.belt + 1), 'beltbig') +
    '<p class="hint">มีผู้ท้าชิงเข็มขัดของเรา ' + (S.day > S.defendDue ? '<b class="warn">ต้องขึ้นชกภายในวันที่ ' + (S.defendDue + DEFEND.grace) + ' ไม่งั้นถูกปลด</b>' : 'ขึ้นป้องกันได้ตั้งแต่วันนี้ ถ้าไม่ป้องกันภายใน ' + DEFEND.grace + ' วันจะถูกปลด') + ' แพ้ก็เสียเข็มขัด</p>' +
    oppCard(df, '<button class="btn go" data-act="pick" data-v="d"' + dis + '>ขึ้นป้องกันแชมป์</button>') + '</section>' : '';
  const rvSec = rv ? '<section class="gcard"><h2>ไฟต์ล้างตา <small>วันละ 1 ไฟต์</small></h2><p class="hint">คู่ปรับที่เคยชนะเรา เขาซ้อมมาเพิ่ม ค่าตัวสูงกว่าปกติ ชนะแล้วหายแค้น</p>' +
    oppCard(rv, '<button class="btn go" data-act="pick" data-v="v"' + dis + '>ท้าล้างตา</button>') + '</section>' : '';
  return (tired ? '<p class="warn">ล้าเกิน 90% ขึ้นชกไม่ได้ ไปพักหรือจบวันก่อน</p>' : '') + defSec + rvSec + challengeHtml() +
    '<section class="gcard">' + art('venue-' + LEAGUE_VENUE[lgNow], 'venue') + '<h2>ศึกชิงเข็มขัด <small>' + BELTS[lgNow] + '</small></h2>' + art('belt-' + (lgNow + 1), 'beltbig') + '<p class="hint">แชมป์เก่าแกร่งกว่าคู่ชกทั่วไป ชนะได้เข็มขัด เงินก้อนใหญ่ และ RP +25 ชิงได้วันละครั้ง</p>' + title + '</section>' +
    '<section class="gcard">' + art('venue-' + LEAGUE_VENUE[league(S.rp)], 'venue') + '<h2>ศึกจัดอันดับ <small>เหลือ ' + S.ranked + ' ไฟต์วันนี้</small></h2><p class="hint">ชนะได้คะแนนอันดับ แพ้เสียคะแนน คู่ชกคือนักมวยที่อันดับใกล้กัน</p>' + rk + '</section>' +
    '<section class="gcard">' + art('venue-chuek', 'venue') + '<h2>ศึกมวยคาดเชือก <small>งานประเพณี วันละ 1 ไฟต์</small></h2><p class="hint">ถอดนวม พันหมัดด้วยเชือก ชกบนลานดิน หมัดเท้าเข่าศอกหนักขึ้น การ์ดกันได้น้อยลง น็อกง่ายกว่าเวทีปกติ ไม่มีผลกับอันดับ ได้ชื่อเสียงมาก</p>' + (S.chuek > 0 ? oppCard(chuekOpp(), '<button class="btn" data-act="pick" data-v="c"' + dis + '>ขึ้นชกคาดเชือก</button>') : '<p class="hint">ชกคาดเชือกของวันนี้ไปแล้ว</p>') + '</section>' +
    '<section class="gcard">' + art('venue-temple', 'venue') + '<h2>เวทีงานวัดใกล้ค่าย <small>ท้าชกฝึกฝีมือ</small></h2><p class="hint">ไม่มีผลกับอันดับ ได้เงิน ชื่อเสียง และประสบการณ์เวที ทุกไฟต์เพิ่มความล้า 22</p>' + loc + '</section>';
}
function rankHtml() {
  const rows = rankRows(), me = rows.findIndex(r => r.me), show = new Set();
  rows.forEach((r, i) => { if (i < 10 || Math.abs(i - me) <= 3) show.add(i); });
  let html = '', lastI = -1;
  rows.forEach((r, i) => { if (!show.has(i)) return; if (lastI >= 0 && i - lastI > 1) html += '<div class="rk gap">…</div>'; lastI = i;
    html += '<div class="rk' + (r.me ? ' me' : '') + '"><span class="n">' + (i + 1) + '</span><span class="nm">' + esc(r.name) + (r.real ? ' <i>ผู้เล่น</i>' : '') + '</span><span class="lg">' + LEAGUES[league(r.rp)][1] + '</span><span class="wl">' + r.w + '-' + r.l + '</span><span class="rp">' + r.rp + '</span></div>'; });
  return upcomingHtml() + '<section class="gcard"><h2>ตารางอันดับ</h2><div class="rkh"><span>#</span><span>นักมวย</span><span>ระดับ</span><span>ชนะ-แพ้</span><span>RP</span></div>' + html +
    '<p class="hint">' + (CLOUD ? 'ออนไลน์: นักมวยของผู้เล่นคนอื่นที่เปิดหน้านี้จะขึ้นในตารางและถูกจับคู่ชกได้' : cloudNote + ' ตารางนี้มีเฉพาะคู่แข่งของระบบ') + '</p></section>';
}

// ---------- fight flow ----------
// Scouting report: how the other man likes to fight (his style's usual plan), his best and worst numbers, his trained moves
const HABIT = {ag: {attack: 'ชอบเดินบี้เข้าหา', balanced: 'ดูเชิงเป็นจังหวะ', counter: 'ชอบยืนรอสวน'}, range: {out: 'คุมระยะวงนอก', mixed: '', in: 'ชอบเข้าวงใน'}, target: {head: 'เล็งหัว', body: 'เน้นลำตัว', leg: 'ตัดขา', mixed: ''}};
const WEAK = {pow: 'หมัดไม่หนัก แลกวงในได้', kick: 'เตะไม่หนัก ยืนวงนอกได้', spd: 'ช้า ออกอาวุธก่อนได้เปรียบ', def: 'การ์ดหลวม ออกอาวุธบ่อย ๆ', end: 'อึดน้อย ยกท้ายจะหมดแรง เร่งยกหลัง', chin: 'คางไม่แข็ง ลูกหนักเข้าหน้าได้ผล'};
const STRONG = {pow: 'หมัดหนัก ระวังเข้าวงใน', kick: 'เตะหนัก อย่ายืนวงนอกนาน', spd: 'เร็ว หลบเก่ง อย่าออกอาวุธเดี่ยว ๆ', def: 'ป้องกันดี ต้องออกเป็นชุด', end: 'อึด ลากยาวไม่ช่วยเรา', chin: 'คางแข็ง น็อกยาก ต้องเก็บแต้ม'};
function scoutHtml(o) {
  const p = OPP_PLAN[o.style], ks = KEYS.slice().sort((a, b) => o.stats[b] - o.stats[a]), lg = league(S.rp), lv = oppSpLv(o.style, lg, o.kind === 'title')[STYLES.find(x => x.id === o.style).sp[0]];
  const habit = [HABIT.ag[p.ag], HABIT.range[p.range], HABIT.target[p.target]].filter(Boolean).join(' '), riv = S.rivals.find(x => x.name === o.name);
  const lines = [habit, 'จุดแข็ง: ' + STAT_TH[ks[0]] + ' ' + o.stats[ks[0]] + ' (' + STRONG[ks[0]] + ')', 'จุดอ่อน: ' + STAT_TH[ks[5]] + ' ' + o.stats[ks[5]] + ' (' + WEAK[ks[5]] + ')',
    'ท่าไม้ตาย: ' + STYLES.find(x => x.id === o.style).sp.map(k => MOVES[k].th).join(' · ') + ' ขั้น ' + lv].concat(riv ? ['เคยชนะเรา ' + riv.losses + ' ครั้ง'] : []);
  return '<div class="scout"><b>รายงานคู่ชก</b><ul>' + lines.map(l => '<li>' + l + '</li>').join('') + '</ul></div>';
}
// One-touch corner orders between rounds: each sets the whole plan
const QUICK = {teep: ['ถีบดักคุมระยะ', {ag: 'counter', range: 'out', target: 'body'}], press: ['เดินบี้เข้าวงใน', {ag: 'attack', range: 'in', target: 'mixed'}], ease: ['ผ่อนแรง เก็บแต้ม', {ag: 'balanced', range: 'out', target: 'mixed'}]};
const quickHtml = () => '<div class="fld">สั่งด่วน</div><div class="quick">' + Object.keys(QUICK).map(k => { const q = QUICK[k][1], on = F.plan.ag === q.ag && F.plan.range === q.range && F.plan.target === q.target; return '<button class="btn seg" data-act="quick" data-v="' + k + '" aria-pressed="' + on + '">' + QUICK[k][0] + '</button>'; }).join('') + '</div>';
function planHtml() {
  const o = F.opp, me = playerSpec();
  return '<section class="gcard"><h2>ก่อนขึ้นเวที <small>' + API.VENUES[o.venue] + '</small></h2><div class="vs"><div class="statbox r"><b>' + esc(S.name) + '</b><span class="sty">สาย' + styleTh(S.style) + (fatigueMul() < 1 ? ' · ล้า ค่าพลังลด ' + Math.round((1 - fatigueMul()) * 100) + '%' : '') + '</span>' + statBars(me.stats) + '</div>' +
    '<div class="statbox b"><b>' + esc(o.name) + '</b><span class="sty">สาย' + styleTh(o.style) + '</span>' + statBars(o.stats) + '</div></div>' +
    scoutHtml(o) + '<p class="advice"><b>พี่เลี้ยง:</b> ' + matchupTip(o.style) + '</p>' + quickHtml() + planPicker(F.plan) +
    '<div class="rowbtn"><button class="btn go wide" data-act="startfight">ขึ้นเวที</button><button class="btn" data-act="backout">ถอนตัว</button></div></section>';
}
function advice(st) {
  const me = st[0], op = st[1], tips = [];
  if (op.wearLeg > 28) tips.push('ขาเขาเริ่มช้าแล้ว เตะขาต่อ');
  if (me.st < 38) tips.push('แรงเราเหลือน้อย ตั้งรับ เก็บแรง');
  if (op.st < 38) tips.push('เขาหอบแล้ว บุกเลย');
  if (op.head >= me.head + 3) tips.push('เราโดนเข้าหน้าบ่อย ถอยวงนอก หรือตั้งรับ');
  if (op.wearBody > 34) tips.push('ลำตัวเขาช้ำ เน้นลำตัวต่อ แรงเขาจะฟื้นช้า');
  const diff = Math.round(me.pts - op.pts);
  if (diff <= -10) tips.unshift('แต้มตาม ' + (-diff) + ' ต้องบุกหนัก หรือทำให้เขาถูกนับ (ได้ +10)');
  else if (diff < -2) tips.unshift('แต้มตาม ' + (-diff) + ' ออกอาวุธให้เข้าเป้ามากขึ้น');
  else if (diff >= 8) tips.push('แต้มนำ ' + diff + ' คุมเกม อย่าเสี่ยงโดนนับ (เสีย 10 แต้ม)');
  if (!tips.length) tips.push('ยกนี้สูสี ' + matchupTip(F.opp.style));
  return tips.slice(0, 2);
}
function breakHtml() {
  const st = F.stats, n = F.round;
  const line = (label, a, b) => '<span>' + a + '</span><b>' + label + '</b><span>' + b + '</span>';
  return '<section class="gcard"><h2>พักยก ' + n + '</h2><div class="cmp">' + line('แต้มยกนี้', st[0].rp, st[1].rp) + line('แต้มรวม', Math.round(st[0].pts), Math.round(st[1].pts)) + line('เข้าเป้า', st[0].landed, st[1].landed) + line('เข้าหน้า', st[0].head, st[1].head) + line('เข้าลำตัว', st[0].body, st[1].body) + line('เข้าขา', st[0].leg, st[1].leg) + line('แรงเหลือ', Math.round(st[0].st) + '%', Math.round(st[1].st) + '%') + line('พลังชีวิต', Math.round(st[0].hp) + '%', Math.round(st[1].hp) + '%') + '</div>' +
    advice(st).map(t => '<p class="advice"><b>พี่เลี้ยง:</b> ' + t + '</p>').join('') + quickHtml() + '<div class="fld">แผนยกต่อไป</div>' + planPicker(F.plan) +
    '<button class="btn go wide" data-act="resume">ชกต่อ</button></section>';
}
function liveHtml() {
  if (F.live) return '<section class="gcard slim"><div class="kv"><span>ท้าชก</span><b>' + esc(F.live.fromName) + ' vs ' + esc(F.live.toName) + '</b><span>เวที</span><b>' + API.VENUES[F.live.venue] + '</b></div><p class="hint">ชกสด พักยกแก้แผนไม่ได้</p><div class="rowbtn"><button class="btn" data-act="skip">ข้ามไปดูผล</button></div></section>';
  return '<section class="gcard slim"><div class="kv"><span>แผนตอนนี้</span><b>' + planText(F.plan) + '</b><span>คู่ชก</span><b>' + esc(F.opp.name) + ' · สาย' + styleTh(F.opp.style) + '</b></div>' +
    '<div class="rowbtn"><button class="btn" data-act="skip">ข้ามไปดูผล</button></div></section>';
}
function resultHtml() {
  const r = F.res;
  if (F.live) return '<section class="gcard"><h2' + (r.win == null ? '>ผลการท้าชก' : ' class="' + (r.win ? 'win' : 'lose') + ' ribbon" data-ui="ribbon-' + (r.win ? 'win' : 'lose') + '">' + (r.win ? 'ชนะ' : 'แพ้') + ' ' + esc(r.how)) + '</h2><p class="hint">' + esc(r.detail) + '</p>' + r.extra.map(x => '<p class="gain">' + x + '</p>').join('') + '<button class="btn go wide" data-act="home">กลับค่าย</button></section>';
  return '<section class="gcard"><h2 class="' + (r.win ? 'win' : 'lose') + ' ribbon" data-ui="ribbon-' + (r.win ? 'win' : 'lose') + '">' + (r.win ? 'ชนะ' : 'แพ้') + ' ' + esc(r.how) + '</h2><p class="hint">' + esc(r.detail) + '</p>' +
    '<div class="kv"><span>เงินรางวัล</span><b>+ ฿ ' + baht(r.money) + '</b><span>ชื่อเสียง</span><b>+ ' + r.fame + '</b>' + (r.drp != null ? '<span>คะแนนอันดับ</span><b>' + (r.drp >= 0 ? '+' : '') + r.drp + ' (เป็น ' + S.rp + ')</b>' : '') + '<span>ประสบการณ์เวที</span><b>' + r.xp + '</b><span>ความล้า</span><b>+' + r.fat + '</b></div>' +
    (r.promo ? '<p class="gain">เลื่อนขึ้น' + r.promo + '! โบนัส ฿ ' + baht(r.promoMoney) + '</p>' : '') + r.extra.map(x => '<p class="gain">' + x + '</p>').join('') +
    '<button class="btn go wide" data-act="home">กลับค่าย</button></section>';
}
function renderFight() {
  $('gNav').innerHTML = '';
  const b = $('gBody');
  if (F.phase === 'plan') b.innerHTML = planHtml();
  else if (F.phase === 'break') b.innerHTML = breakHtml();
  else if (F.phase === 'result') b.innerHTML = resultHtml();
  else b.innerHTML = liveHtml();
}
function plansFor() { return [F.plans, [OPP_PLAN[F.opp.style], OPP_PLAN[F.opp.style], OPP_PLAN[F.opp.style]]]; }
async function startFight() {
  F.plans = [F.plan, F.plan, F.plan].map(p => Object.assign({}, p)); F.phase = 'live'; S.plan = Object.assign({}, F.plan);
  setMode(true); render();
  const o = F.opp;
  await API.startFight({venue: o.venue, rules: VENUE_RULES[o.venue] || null, seed: F.seed, specs: [playerSpec(), {name: o.name, first: o.name, style: o.style, stats: o.stats, skin: 1, spLv: oppSpLv(o.style, league(S.rp), o.kind === 'title')}], plans: plansFor(),
    looks: [Object.assign({name: S.name, fighter: S.body}, S.look), Object.assign({name: o.name, fighter: o.body}, o.look)]});
}
function onRoundBreak(n, st) { F.phase = 'break'; F.round = n; F.stats = st; render(); $('gBody').scrollIntoView({block: 'nearest', behavior: 'smooth'}); }
function onOver(res) {
  if (F && F.live) { liveMatchOver(res); return; }
  const win = res.w === 0, o = F.opp, ko = res.how !== 'คะแนน', lgBefore = league(S.rp);
  const r = {win, how: res.how === 'คะแนน' ? 'คะแนน' : res.how + ' ยก ' + res.round, detail: (res.move ? 'ปิดเกมด้วย' + MOVES[res.move].th + ' · ' : '') + 'แต้ม ' + res.pts[0] + ' ต่อ ' + res.pts[1] + (res.how === 'คะแนน' && res.pts[0] === res.pts[1] ? ' (เท่ากัน ตัดสินจากความเสียหายที่ทำได้)' : '') + ' · ' + 'เข้าเป้า ' + res.landed[0] + ' ต่อ ' + res.landed[1]};
  r.money = win ? o.money + (ko ? 80 : 0) : Math.round(o.money * .25); r.fame = win ? o.fame + (ko ? 2 : 0) : 1;
  r.fat = 22 + (!win && ko ? 12 : 0);
  if (o.kind === 'ranked') { const ex = 1 / (1 + Math.pow(10, (o.rp - S.rp) / 400)); r.drp = Math.round(32 * ((win ? 1 : 0) - ex)); S.rp = Math.max(600, S.rp + r.drp); S.ranked = Math.max(0, S.ranked - 1); }
  if (o.kind === 'chuek') S.chuek = 0;
  if (o.kind === 'title') { S.title = 0; if (win) { S.belts.push(o.belt); r.drp = 25; S.rp += 25; S.defendDue = S.day + DEFEND.every; } }
  const rivalLine = [];
  if (o.kind === 'rival') { S.rematch = 0; if (win) { S.rivals = S.rivals.filter(x => x.name !== o.name); rivalLine.push('ล้างตา ' + o.name + ' สำเร็จ!' + moodUp(1)); } }
  if (o.kind === 'defense') { S.defendDue = S.day + DEFEND.every; if (win) { S.defends++; rivalLine.push('ป้องกัน' + BELTS[o.belt] + 'สำเร็จ ครั้งที่ ' + S.defends); } else { S.belts = S.belts.filter(b => b !== o.belt); rivalLine.push('เสีย' + BELTS[o.belt] + 'ให้ ' + o.name); } }
  if (!win && o.kind !== 'title' && o.kind !== 'defense') { // he goes on the rivals list (or stays at the top of it)
    const prev = S.rivals.find(x => x.name === o.name), entry = {name: o.name, style: o.style, body: o.body, look: o.look, stats: roundStats(o.stats), losses: (prev ? prev.losses : 0) + 1};
    S.rivals = [entry].concat(S.rivals.filter(x => x.name !== o.name)).slice(0, RIVAL.keep);
  }
  // ring experience: a little growth in what the style leans on, more for a win
  const grow = win ? .7 : .35, ks = KEYS.slice().sort((a, b) => START[S.style][b] - START[S.style][a]).slice(0, 2);
  ks.forEach(k => { S.stats[k] = Math.min(cap(), S.stats[k] + grow); }); r.xp = ks.map(k => STAT_TH[k] + ' +' + grow).join(' · ');
  S.money += r.money; S.fame += r.fame; S.fatigue = clamp(S.fatigue + r.fat, 0, 100);
  if (win) { S.rec.w++; if (ko) S.rec.ko++; } else S.rec.l++;
  if (S.rp > S.best) { const lgNow = league(S.rp); if (lgNow > league(S.best)) { r.promo = LEAGUES[lgNow][1]; r.promoMoney = 1000 * lgNow; S.money += r.promoMoney; } S.best = S.rp; }
  S.log.unshift({w: win, o: o.name, h: r.how}); S.log = S.log.slice(0, 12);
  r.extra = [o.kind === 'title' && win ? 'ได้' + BELTS[o.belt] + 'มาครอง!' : '', (win ? moodUp(ko ? 2 : 1) : moodUp(ko ? -2 : -1)).trim(), win ? mission('win') : '', o.kind === 'ranked' ? mission('ranked') : '', unlockSpecials()].concat(rivalLine).filter(Boolean);
  save(); F.res = r; F.phase = 'result'; topBar(); render(); $('gBody').scrollIntoView({block: 'nearest', behavior: 'smooth'});
  void lgBefore;
}

// ---------- online challenges ----------
// One player challenges another (from the ranking board) for a set time. The other accepts or declines. At that time
// both, and anyone else who opens the page, watch the same fight: the simulation is deterministic, so everyone runs it
// from the same seed, the two fighters as they were when challenged and accepted, and the plans they chose then.
// Shared documents (rules in the artifact's db declaration): challenges/<challenger id> {name, list: {<opponent id>: …}}
// and answers/<responder id> {list: {<challenger id>: …}}; each player writes only his own document.
const MATCH_LEN = 5 * 60e3, MATCH_KEEP = 6 * 3600e3, CH_REWARD = {win: [400, 10], lose: [100, 2]};
const CH = {cdocs: {}, adocs: {}, on: false, live: new Set()};
const WHEN = [['n5', 'อีก 5 นาที'], ['n30', 'อีก 30 นาที'], ['n60', 'อีก 1 ชั่วโมง'], ['t18', '18:00 น.'], ['t20', '20:00 น.'], ['t21', '21:00 น.']];
function whenTime(k) {
  const now = Date.now(); if (k[0] === 'n') return now + (+k.slice(1)) * 60e3;
  const d = new Date(); d.setHours(+k.slice(1), 0, 0, 0); if (d.getTime() < now + 60e3) d.setDate(d.getDate() + 1); return d.getTime();
}
const hm = t => { const d = new Date(t); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + ' น.' + (new Date(t).toDateString() !== new Date().toDateString() ? ' พรุ่งนี้' : ''); };
const countdown = ms => { ms = Math.max(0, ms); const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s % 60).padStart(2, '0'); };
// everything from the shared store is someone else's input: cleaned the same way on every viewer, so all run the same fight
const cleanPlan = p => { p = p || {}; return {ag: PLAN.ag[p.ag] ? p.ag : 'balanced', range: PLAN.range[p.range] ? p.range : 'mixed', target: PLAN.target[p.target] ? p.target : 'mixed'}; };
function cleanSpec(sp, name) {
  sp = sp || {}; const lv = {}; for (const k of SPECIALS) if (sp.spLv && sp.spLv[k]) lv[k] = clamp(Math.round(+sp.spLv[k]) || 1, 1, SP_MAX);
  return {name, first: name, style: START[sp.style] ? sp.style : 'tech', stats: cleanStats(sp.stats), skin: 0, sp: (Array.isArray(sp.sp) ? sp.sp : []).filter(k => SPECIALS.includes(k)).slice(0, 3), spLv: lv};
}
function chSubscribe() {
  if (!CLOUD || CH.on) return; CH.on = true;
  const fail = () => { CH.err = 'ดึงข้อมูลท้าชกไม่ได้ในตอนนี้'; };
  CLOUD.db.collection('challenges').limit(300).onSnapshot(s => { const o = {}; s.docs.forEach(d => { o[d.id] = d.data(); }); CH.cdocs = o; chChanged(); }, fail);
  CLOUD.db.collection('answers').limit(300).onSnapshot(s => { const o = {}; s.docs.forEach(d => { o[d.id] = d.data(); }); CH.adocs = o; chChanged(); }, fail);
  setInterval(chTick, 1000);
}
function matches() {
  const out = [], now = Date.now();
  for (const from in CH.cdocs) {
    const c = CH.cdocs[from] || {}, list = c.list && typeof c.list === 'object' ? c.list : {};
    for (const to in list) {
      const e = list[to]; if (!e || typeof e.time !== 'number' || !e.spec) continue;
      const a = ((CH.adocs[to] || {}).list || {})[from] || null, start = a && a.accept ? Math.max(e.time, +a.at || 0) : e.time;
      if (now > start + MATCH_KEEP) continue;
      out.push({key: from + '>' + to + '>' + e.seed, from, to, e, a, start, fromName: API.cleanName(c.name) || 'นักมวย', toName: API.cleanName(e.toName) || 'นักมวย', venue: API.VENUES[e.venue] ? e.venue : 'stadium'});
    }
  }
  return out.sort((x, y) => x.start - y.start);
}
const mine = () => CLOUD ? matches().filter(m => m.from === CLOUD.uid || m.to === CLOUD.uid) : [];
function chChanged() {
  settleMatches();
  const typing = document.activeElement && document.activeElement.matches && document.activeElement.matches('input,select');
  if (!F && !DR && !typing && view !== 'create' && (tab === 'fight' || tab === 'rank' || tab === 'home')) render();
}
// once a match is over, its result counts for the two players whether or not they watched it
function settleMatches() {
  if (!S || !CLOUD) return; let note = '';
  for (const m of mine()) {
    if (!m.a || !m.a.accept || Date.now() < m.start + MATCH_LEN || S.chDone.includes(m.key)) continue;
    const res = simulate(matchCfg(m)).result; note += applyMatch(m, res) + ' ';
  }
  if (note) { view = {note: note.trim()}; topBar(); }
}
function matchCfg(m) {
  const p0 = cleanPlan(m.e.plan), p1 = cleanPlan(m.a.plan);
  return {seed: (m.e.seed >>> 0) || 1, specs: [cleanSpec(m.e.spec, m.fromName), cleanSpec(m.a.spec, m.toName)], plans: [[p0, p0, p0], [p1, p1, p1]], rules: VENUE_RULES[m.venue] || null};
}
function applyMatch(m, res) {
  const me = m.from === CLOUD.uid ? 0 : 1, win = res.w === me, [money, fame] = CH_REWARD[win ? 'win' : 'lose'], other = me ? m.fromName : m.toName;
  S.chDone = S.chDone.concat(m.key).slice(-60); S.money += money; S.fame += fame;
  if (win) S.rec.w++; else S.rec.l++;
  S.log.unshift({w: win, o: other, h: 'ท้าชก · ' + (res.how === 'คะแนน' ? 'คะแนน' : res.how + ' ยก ' + res.round)}); S.log = S.log.slice(0, 12);
  save(); return 'ผลท้าชกกับ ' + other + ': ' + (win ? 'ชนะ' : 'แพ้') + ' ได้ ฿ ' + baht(money) + ' ★ ' + fame;
}
function chTick() {
  document.querySelectorAll('[data-cd]').forEach(el => { const t = +el.dataset.cd - Date.now(); el.textContent = t > 0 ? countdown(t) : 'เริ่มแล้ว'; });
  for (const m of matches()) { const live = Date.now() >= m.start && Date.now() < m.start + MATCH_LEN && m.a && m.a.accept; if (live && !CH.live.has(m.key)) { CH.live.add(m.key); chChanged(); } }
}
async function sendChallenge(oppId, oppName, when) {
  const ref = CLOUD.db.doc('challenges/' + CLOUD.uid), snap = await ref.get(), cur = snap.exists ? snap.data() : {}, list = {}, now = Date.now();
  for (const k in (cur.list || {})) if (cur.list[k] && cur.list[k].time > now - MATCH_KEEP) list[k] = cur.list[k]; // forget old ones
  list[oppId] = {toName: oppName, time: whenTime(when), seed: 1 + Math.floor(Math.random() * 999999), venue: LEAGUE_VENUE[league(S.rp)], spec: playerSpec(), look: S.look, body: S.body, plan: cleanPlan(S.plan), created: now};
  await ref.set({name: S.name, list});
}
async function answerChallenge(fromId, accept) {
  const ref = CLOUD.db.doc('answers/' + CLOUD.uid), snap = await ref.get(), cur = snap.exists ? snap.data() : {}, list = Object.assign({}, cur.list || {});
  list[fromId] = {accept, at: Date.now(), name: S.name, spec: playerSpec(), look: S.look, body: S.body, plan: cleanPlan(S.plan)};
  await ref.set({list});
}
async function cancelChallenge(toId) {
  const ref = CLOUD.db.doc('challenges/' + CLOUD.uid), snap = await ref.get(); if (!snap.exists) return;
  const d = snap.data(), list = Object.assign({}, d.list || {}); delete list[toId]; await ref.set({name: S.name, list});
}
function matchRow(m, mineView) {
  const now = Date.now(), live = m.a && m.a.accept && now >= m.start && now < m.start + MATCH_LEN, over = m.a && m.a.accept && now >= m.start + MATCH_LEN;
  const me = CLOUD && m.from === CLOUD.uid ? 0 : CLOUD && m.to === CLOUD.uid ? 1 : -1;
  const vs = '<b>' + esc(m.fromName) + '</b> <span class="hint">vs</span> <b>' + esc(m.toName) + '</b>';
  let state, btn = '';
  if (m.a && !m.a.accept) state = 'ปฏิเสธคำท้า';
  else if (!m.a) { state = 'รอคำตอบ · นัด ' + hm(m.e.time); if (me === 1) btn = '<button class="btn go" data-act="chyes" data-v="' + m.from + '">รับคำท้า</button><button class="btn" data-act="chno" data-v="' + m.from + '">ปฏิเสธ</button>'; else if (me === 0) btn = '<button class="btn" data-act="chcancel" data-v="' + m.to + '">ยกเลิก</button>'; }
  else if (live) { state = '<span class="livetag">สด</span> กำลังชก'; btn = '<button class="btn go" data-act="chwatch" data-v="' + m.key + '">ดูสด</button>'; }
  else if (over) { state = 'จบแล้ว'; btn = '<button class="btn" data-act="chwatch" data-v="' + m.key + '">ดูย้อนหลัง</button>'; }
  else { state = 'ขึ้นเวที ' + hm(m.start) + ' · อีก <b class="cd" data-cd="' + m.start + '">' + countdown(m.start - now) + '</b>'; }
  return '<div class="match' + (live ? ' live' : '') + '"><div>' + vs + '</div><div class="hint">' + API.VENUES[m.venue] + ' · ' + state + '</div>' + (btn ? '<div class="rowbtn">' + btn + '</div>' : '') + '</div>';
}
function challengeHtml() {
  if (!CLOUD) return '<section class="gcard"><h2>ท้าชกออนไลน์</h2><p class="hint">ต้องเปิดเกมแบบออนไลน์ (ลงชื่อเข้า claude.ai) จึงท้าชกกับผู้เล่นคนอื่นได้</p></section>';
  const my = mine(), others = board.filter(b => b.id).sort((a, b) => Math.abs(a.rp - S.rp) - Math.abs(b.rp - S.rp)).slice(0, 8);
  const sent = new Set(my.filter(m => m.from === CLOUD.uid && !(m.a && m.a.accept && Date.now() > m.start + MATCH_LEN)).map(m => m.to));
  return '<section class="gcard"><h2>ท้าชกออนไลน์ <small>นัดเวลา ดูสดได้ทั้งสองฝ่าย</small></h2>' +
    (my.length ? '<div class="fld">แมตช์ของเรา</div>' + my.map(m => matchRow(m, true)).join('') : '<p class="hint">ยังไม่มีแมตช์ท้าชก</p>') +
    '<div class="fld">ท้าผู้เล่นคนอื่น</div>' + (others.length ? '<label class="fld" for="chWhen">เวลาขึ้นเวที</label><select id="chWhen" class="inp">' + WHEN.map(w => '<option value="' + w[0] + '">' + w[1] + '</option>').join('') + '</select>' +
      others.map(b => '<div class="opp"><div class="oh"><b>' + esc(b.name) + '</b><span class="tag">RP ' + b.rp + '</span></div><div class="sty">สาย' + styleTh(b.style) + ' · ชนะ ' + b.w + ' แพ้ ' + b.l + '</div>' +
        (sent.has(b.id) ? '<span class="hint">ส่งคำท้าแล้ว</span>' : '<button class="btn" data-act="chsend" data-v="' + b.id + '">ท้าชก</button>') + '</div>').join('') : '<p class="hint">ยังไม่มีผู้เล่นคนอื่นออนไลน์ในตารางอันดับ ชวนเพื่อนมาเล่น (แชร์หน้านี้ให้เพื่อน)</p>') +
    '<p class="hint">ทั้งสองฝ่ายชกด้วยค่าพลัง ท่าไม้ตาย และแผนตอนส่งหรือรับคำท้า ระหว่างพักยกแก้แผนไม่ได้ ชนะได้ ฿ ' + CH_REWARD.win[0] + ' ★ ' + CH_REWARD.win[1] + ' แพ้ได้ ฿ ' + CH_REWARD.lose[0] + ' ไม่มีผลกับอันดับ</p>' +
    (CH.err ? '<p class="warn">' + CH.err + '</p>' : '') + '</section>';
}
const upcomingHtml = () => { const list = matches().filter(m => m.a && m.a.accept && Date.now() < m.start + MATCH_LEN).slice(0, 8); return list.length ? '<section class="gcard"><h2>แมตช์ท้าชกที่กำลังจะมา <small>ใครก็ดูได้</small></h2>' + list.map(m => matchRow(m, false)).join('') + '</section>' : ''; };
const nextMineHtml = () => { const m = mine().find(x => x.a && x.a.accept && Date.now() < x.start + MATCH_LEN && x.start - Date.now() < 30 * 60e3); return m ? '<section class="gcard hot"><h2>แมตช์ท้าชกของเรา</h2>' + matchRow(m, true) + '</section>' : ''; };
async function watchMatch(key) {
  const m = matches().find(x => x.key === key); if (!m || !m.a || !m.a.accept) return;
  const cfg = matchCfg(m), me = CLOUD && m.from === CLOUD.uid ? 0 : CLOUD && m.to === CLOUD.uid ? 1 : -1;
  F = {opp: {name: me === 1 ? m.fromName : m.toName, style: cfg.specs[me === 1 ? 0 : 1].style}, seed: cfg.seed, live: m, me, phase: 'live', plan: cfg.plans[Math.max(0, me)][0]};
  setMode(true); render();
  const body = (b, d) => (API.ROSTER[b] ? b : d);
  await API.startFight({venue: m.venue, rules: cfg.rules, seed: cfg.seed, specs: cfg.specs, plans: cfg.plans, noBreaks: true,
    looks: [Object.assign({name: m.fromName, fighter: body(m.e.body, 'c')}, cleanLook(m.e.look)), Object.assign({name: m.toName, fighter: body(m.a.body, 'd')}, cleanLook(m.a.look))]});
  const el = (Date.now() - m.start) / 1000; if (el > 2 && Date.now() < m.start + MATCH_LEN) API.seekTo(el);
}
function liveMatchOver(res) {
  const m = F.live, me = F.me, win = res.w === me;
  let line = '';
  if (me >= 0 && !S.chDone.includes(m.key)) line = applyMatch(m, res); // watched to the end: counts now
  F.res = {win: me < 0 ? null : win, how: res.how === 'คะแนน' ? 'คะแนน' : res.how + ' ยก ' + res.round, detail: (res.w ? m.toName : m.fromName) + ' ชนะ · แต้ม ' + res.pts[0] + ' ต่อ ' + res.pts[1], money: 0, fame: 0, xp: '-', fat: 0, extra: [line].filter(Boolean), spectator: me < 0};
  F.phase = 'result'; topBar(); render();
}

// ---------- drill: trainer calls, player presses ----------
function drillChart(mix, seed) {
  const R = rng(seed), kinds = Object.keys(mix), notes = []; let t = DRILL.lead;
  const pick = () => { let x = R(); for (const k of kinds) { if ((x -= mix[k]) < 0) return k; } return kinds[0]; };
  while (notes.length < DRILL.notes) {
    const n = Math.min(DRILL.notes - notes.length, 2 + Math.floor(R() * 3));
    for (let i = 0; i < n; i++) { notes.push({t, kind: pick(), res: null, el: null}); t += DRILL.beat; }
    t += DRILL.gap - DRILL.beat;
  }
  return notes;
}
async function drillStart(act) {
  const notes = drillChart(DRILL_MIX[act.drill], S.seed + S.day * 17 + S.slots * 5 + Math.floor(S.fatigue));
  DR = {act, notes, t0: 0, combo: 0, best: 0, n: {perfect: 0, good: 0, late: 0, miss: 0}, score: 0, w: {}, seq: {punch: 0, kick: 0, teep: 0}, ready: false, raf: 0};
  mini = null; setMode(false); render();
  const ui = document.createElement('div'); ui.id = 'drillUi';
  ui.innerHTML = '<div class="dtop"><span id="dCombo"></span><span id="dLeft"></span></div><div class="dmsg" id="dMsg">เตรียมตัว</div><div class="dtrack"><div class="dring"></div><div id="dNotes"></div></div>';
  $('stage').appendChild(ui);
  notes.forEach(n => { n.el = document.createElement('div'); n.el.className = 'dnote k-' + n.kind; n.el.textContent = KINDS[n.kind].th; $('dNotes').appendChild(n.el); });
  $('stage').scrollIntoView({block: 'start', behavior: 'smooth'});
  await API.drillStart(Object.assign({fighter: S.body}, S.look), act.drill);
  if (!DR) return;
  DR.t0 = performance.now(); DR.ready = true; DR.raf = requestAnimationFrame(drillTick);
}
function drillMsg(text, cls) { const m = $('dMsg'); if (!m) return; m.textContent = text; m.className = 'dmsg ' + (cls || ''); m.style.animation = 'none'; void m.offsetWidth; m.style.animation = ''; }
function drillJudge(n, res) {
  n.res = res; DR.n[res]++; n.el.classList.add(res === 'miss' ? 'gone' : 'hit');
  const pts = {perfect: 1, good: .7, late: .35, miss: 0}[res]; DR.score += pts;
  if (res === 'miss') DR.combo = 0; else { DR.combo++; DR.best = Math.max(DR.best, DR.combo); const st = KINDS[n.kind].stat, b = n.kind === DR.act.focus ? DRILL.focusBonus : 1; for (const k in st) DR.w[k] = (DR.w[k] || 0) + st[k] * pts * b; }
  $('dCombo').textContent = DR.combo >= 2 ? 'ต่อเนื่อง ' + DR.combo : '';
}
function drillPress(kind) {
  if (!DR || !DR.ready) return;
  const now = (performance.now() - DR.t0) / 1000, list = API.TARGETS[DR.act.drill].moves[kind];
  const n = DR.notes.find(x => !x.res && Math.abs(x.t - now) <= DRILL.late);
  API.drillStrike(list[DR.seq[kind]++ % list.length]);
  const b = document.querySelector('[data-drill="' + kind + '"]'); if (b) { b.classList.remove('tap'); void b.offsetWidth; b.classList.add('tap'); }
  if (!n) return;                                       // a free strike between calls: no score either way
  if (n.kind !== kind) { drillJudge(n, 'miss'); drillMsg('ผิดท่า', 'bad'); return; }
  const d = Math.abs(n.t - now), res = d <= DRILL.perfect ? 'perfect' : d <= DRILL.good ? 'good' : 'late';
  drillJudge(n, res); drillMsg(res === 'perfect' ? 'เป๊ะ!' : res === 'good' ? 'ดี' : n.t > now ? 'เร็วไป' : 'ช้าไป', res);
}
function drillTick() {
  if (!DR) return;
  const now = (performance.now() - DR.t0) / 1000, track = $('dNotes'); if (!track) return;
  const W = track.clientWidth, x0 = W * .2, speed = W * .8 / DRILL.ahead;
  let left = 0;
  for (const n of DR.notes) {
    if (!n.res && now > n.t + DRILL.late) { drillJudge(n, 'miss'); drillMsg('พลาด', 'bad'); }
    if (!n.res) left++;
    const x = x0 + (n.t - now) * speed;
    n.el.style.display = x > W + 40 || x < -60 ? 'none' : ''; n.el.style.transform = 'translate(' + x.toFixed(1) + 'px,-50%) translateX(-50%)';
  }
  if (now < DRILL.lead - .6) { const c = Math.ceil(DRILL.lead - .6 - now); if ($('dMsg').textContent !== String(c)) drillMsg(String(c), ''); } else if ($('dMsg').textContent === '1') drillMsg('เริ่ม!', 'perfect');
  $('dLeft').textContent = 'เหลือ ' + left + ' ท่า';
  if (now > DR.notes[DR.notes.length - 1].t + .9) { drillEnd(false); return; }
  DR.raf = requestAnimationFrame(drillTick);
}
// abort = left the screen: nothing is spent
function drillEnd(abort) {
  const d = DR; if (!d) return;
  cancelAnimationFrame(d.raf); DR = null; const ui = $('drillUi'); if (ui) ui.remove(); API.drillStop();
  if (abort) return;
  const a = d.act, c = cap(), q = d.score / d.notes.length;
  const mul = q >= .85 ? 1.5 : q >= .6 ? 1.15 : q >= .3 ? .8 : .5, label = q >= .85 ? 'ยอดเยี่ยม' : q >= .6 ? 'ดี' : q >= .3 ? 'พอใช้' : 'ยังไม่เข้าจังหวะ';
  let sum = 0; for (const k in d.w) sum += d.w[k];
  if (!sum) { d.w = {}; a.stat.forEach(k => { d.w[k] = 1; }); sum = a.stat.length; }
  const parts = Object.keys(d.w).map(k => { const room = Math.max(.12, 1 - Math.pow(S.stats[k] / c, 2)), g = 2.4 * mul * (d.w[k] / sum) * room * (1 - S.fatigue / 160) * (1 + .1 * (S.gym - 1)) * boost(a), before = S.stats[k]; S.stats[k] = Math.min(c, S.stats[k] + Math.max(.02, g)); return [k, S.stats[k] - before]; })
    .filter(p => p[1] >= .05).sort((x, y) => y[1] - x[1]).map(p => STAT_TH[p[0]] + ' +' + p[1].toFixed(1));
  S.fatigue = clamp(S.fatigue + a.fat, 0, 100); S.slots--;
  const done = mission('train'), sour = S.fatigue >= 85 ? ' · ฝืนซ้อมตอนล้ามาก' + moodUp(-1) : '';
  view = {msg: a.th + ': ' + label + ' · เป๊ะ ' + d.n.perfect + ' ดี ' + d.n.good + ' คลาด ' + d.n.late + ' พลาด ' + d.n.miss + ' · ต่อเนื่องสูงสุด ' + d.best + ' · ' + parts.join(' · ') + sour + (done ? ' · ' + done : '')};
  save(); setMode(false); render(); showMe();
}
function drillHtml() {
  return '<section class="gcard drillpad"><div class="dbtns">' + Object.keys(KINDS).map(k => '<button class="dbtn k-' + k + '" data-drill="' + k + '"><b>' + KINDS[k].th + '</b></button>').join('') + '</div>' +
    '<p class="hint">' + DR.act.th + ': กดปุ่มให้ตรงกับท่าที่ครูเรียก ตอนป้ายท่าเลื่อนมาถึงวงกลม · คีย์บอร์ด A S D</p><button class="link" data-act="drillquit">เลิกซ้อมรอบนี้ (ไม่เสียแรงซ้อม)</button></section>';
}

function trainFail(a) {
  S.slots--; S.fatigue = clamp(S.fatigue + FAIL.fatigue, 0, 100);
  let msg = a.th + ': ซ้อมพลาด ร่างกายล้าเกินไป ไม่ได้ค่าพลัง' + moodUp(-1);
  if (Math.random() < FAIL.hurt) { const k = a.stat[0]; S.stats[k] = Math.max(20, S.stats[k] - .5); msg += ' และเจ็บเล็กน้อย ' + STAT_TH[k] + ' −0.5'; }
  mini = null; view = {msg, bad: true}; save(); render(); showMe();
}
// try on a look; anything not owned yet waits for a purchase
function setLook(field, value) {
  const look = Object.assign({}, pending ? pending.look : S.look); look[field] = value;
  const items = [], MAPS = {pattern: API.PATTERNS, head: API.HEADGEAR, hair: API.HAIR};
  Object.keys(LOOK_KIND).forEach(f => { const kind = LOOK_KIND[f], k = look[f]; if (!S.own[kind].includes(k) && !items.some(i => i.kind === kind && i.k === k)) { const map = MAPS[f] || API.COLORS; items.push({kind, k, price: PRICE[kind][k] || 0, th: Array.isArray(map[k]) ? map[k][0] : map[k]}); } });
  if (items.length) pending = {look, items}; else { pending = null; S.look = look; save(); }
  render(); showMe();
}
// ---------- actions ----------
function trainResult(q) {
  const a = mini.act, c = cap(); let msg;
  if (a.id === 'rest') { S.fatigue = clamp(S.fatigue + a.fat - (S.staff.includes('massage') ? 10 : 0), 0, 100); msg = 'พักแล้ว ความล้าลดลง' + (Math.random() < .4 ? moodUp(1) : ''); }
  else if (a.id === 'fun') { S.fatigue = clamp(S.fatigue + a.fat, 0, 100); msg = 'ได้พักผ่อนหย่อนใจ' + moodUp(Math.random() < .33 ? 2 : 1); }
  else {
    const mul = q > .93 ? 1.5 : q > .6 ? 1.15 : .8, label = q > .93 ? 'ยอดเยี่ยม' : q > .6 ? 'ดี' : 'พอใช้';
    const parts = a.stat.map(k => { const room = Math.max(.12, 1 - Math.pow(S.stats[k] / c, 2)), g = 2.4 * mul * room * (1 - S.fatigue / 160) * (1 + .1 * (S.gym - 1)) * boost(a) * (a.stat.length > 1 ? .65 : 1); const before = S.stats[k]; S.stats[k] = Math.min(c, S.stats[k] + Math.max(.05, g)); return STAT_TH[k] + ' +' + (S.stats[k] - before).toFixed(1); });
    S.fatigue = clamp(S.fatigue + a.fat, 0, 100); msg = a.th + ': ' + label + ' · ' + parts.join(' · ') + (S.fatigue >= 85 ? ' · ฝืนซ้อมตอนล้ามาก' + moodUp(-1) : '');
    if (a.id === 'spar' && Math.random() < .06 + S.fatigue / 400) { S.fatigue = clamp(S.fatigue + 18, 0, 100); msg += ' · เจ็บเล็กน้อยจากการซ้อมคู่ ล้าเพิ่ม 18'; }
  }
  S.slots--; mini = null; const done = mission('train'); view = {msg: msg + (done ? ' · ' + done : '')}; save(); render();
}
function onClick(e) {
  const el = e.target.closest('[data-act]'); if (!el || el.disabled) return;
  const act = el.dataset.act, v = el.dataset.v;
  if (act === 'settings') { if (view && view.settings) view = null; else { if (DR) drillEnd(true); view = {settings: true}; } render(); window.scrollTo({top: 0, behavior: 'smooth'}); return; }
  if (act === 'soundon') { API.sound.set(!API.sound.on); API.sound.test(); render(); return; }
  if (act === 'soundtest') { API.sound.test(); return; }
  if (act === 'setback') { view = null; render(); return; }
  if (act === 'body') { draft.body = v; draft.name = $('gName').value; renderCreate(); API.preview({fighter: v, shorts: 'red', trim: 'white', pattern: 'plain', gloves: 'red', head: 'none'}, 'guard'); }
  else if (act === 'style') { draft.style = v; draft.name = $('gName').value; renderCreate(); }
  else if (act === 'create') { const name = API.cleanName($('gName').value); if (name.length < 2) { $('gCreateMsg').textContent = 'ตั้งชื่อนักมวยก่อน อย่างน้อย 2 ตัวอักษร'; return; } S = newSave(name, draft.body, draft.style); save(); go('home'); }
  else if (act === 'tab') go(v);
  else if (act === 'home') { F = null; API.stop(); go('home'); if (CLOUD) loadBoard(); }
  else if (act === 'sleep') {
    const wage = S.staff.reduce((a, id) => a + STAFF.find(x => x.id === id).wage, 0), income = 40 + S.fame * 3; let note = 'เช้าวันใหม่ ได้ค่าสปอนเซอร์ ฿ ' + baht(income);
    S.day++; S.slots = 3; S.ranked = 2; S.chuek = 1; S.title = 1; S.rematch = 1;
    if (S.belts.length && S.day > S.defendDue + DEFEND.grace) { const b = Math.max(...S.belts); S.belts = S.belts.filter(x => x !== b); S.defendDue = S.day + DEFEND.every; note = 'ไม่ได้ป้องกันแชมป์ตามกำหนด ถูกปลดจาก' + BELTS[b] + ' · ' + note; } S.fatigue = clamp(S.fatigue - 35 - (S.staff.includes('massage') ? 12 : 0), 0, 100); S.money += income;
    if (wage) { if (S.money >= wage) { S.money -= wage; note += ' จ่ายค่าจ้างทีมงาน ฿ ' + baht(wage); } else { S.staff = []; note += ' เงินไม่พอจ่ายค่าจ้าง ทีมงานลาออกทั้งหมด'; } }
    if (S.fatigue < 30 && S.mood < 2) note += ' พักเต็มที่' + moodUp(1);
    save(); view = {note}; render(); topBar();
  }
  else if (act === 'staff') { const st = STAFF.find(x => x.id === v); if (S.staff.includes(v)) S.staff = S.staff.filter(k => k !== v); else { if (S.money < st.hire) { el.textContent = 'เงินไม่พอ ต้องมี ฿ ' + baht(st.hire); return; } S.money -= st.hire; S.staff.push(v); } save(); render(); }
  else if (act === 'look') setLook(el.dataset.f, v);
  else if (act === 'gym') { const c = GYM_COST[S.gym]; if (S.money < c) { el.textContent = 'เงินไม่พอ ต้องมี ฿ ' + baht(c); return; } S.money -= c; S.gym++; save(); render(); }
  else if (act === 'reset') { if (el.dataset.sure) { try { localStorage.removeItem(SAVE_KEY); } catch (err) { /* fine */ } S = null; view = 'create'; setMode(false); render(); API.preview({fighter: draft.body, shorts: 'red', trim: 'white', pattern: 'plain', gloves: 'red', head: 'none'}); } else { el.dataset.sure = '1'; el.textContent = 'กดอีกครั้งเพื่อยืนยันการลบนักมวยคนนี้'; } }
  else if (act === 'train') { if (S.slots < 1) return; const a = ACTS.find(x => x.id === v); if (Math.random() * 100 < failPct(a)) { trainFail(a); return; } mini = {act: a, t0: performance.now()}; if (a.id === 'rest' || a.id === 'fun') trainResult(1); else if (a.drill) drillStart(a); else render(); }
  else if (act === 'hit') { const ph = ((performance.now() - mini.t0) / 1100) % 2, x = ph < 1 ? ph : 2 - ph; trainResult(1 - Math.abs(x - .5) * 2); }
  else if (act === 'buy') { const cost = pending.items.reduce((a, i) => a + i.price, 0); if (S.money < cost) return; S.money -= cost; pending.items.forEach(i => { if (!S.own[i.kind].includes(i.k)) S.own[i.kind].push(i.k); }); S.look = pending.look; pending = null; save(); render(); showMe(); }
  else if (act === 'cancelbuy') { pending = null; render(); showMe(); }
  else if (act === 'pick') { const o = v === 'r' ? rankedOpp() : v === 'c' ? chuekOpp() : v === 't' ? titleOpp() : v === 'v' ? rivalOpp() : v === 'd' ? defenseOpp() : localOpps().find(x => x.id === v); if (!o) return; F = {opp: o, seed: (S.seed + S.day * 101 + S.rec.w * 7 + S.rec.l * 13 + (v === 'r' ? 5 : v === 'c' ? 9 : v === 't' ? 11 : v === 'v' ? 15 : v === 'd' ? 17 : +v.slice(1))) >>> 0, plan: Object.assign({}, S.plan || PLAN_DEFAULT), phase: 'plan'}; setMode(false); render(); API.preview(Object.assign({fighter: o.body}, o.look), 'guard', o.venue); $('gBody').scrollIntoView({block: 'nearest'}); }
  else if (act === 'backout') { F = null; go('fight'); }
  else if (act === 'chsend') { const b = board.find(x => x.id === v), w = ($('chWhen') || {}).value || 'n30'; if (!b || !CLOUD) return; el.disabled = true; el.textContent = 'กำลังส่ง…'; sendChallenge(v, b.name, w).then(() => { view = {note: 'ส่งคำท้าถึง ' + b.name + ' แล้ว นัดขึ้นเวที ' + hm(whenTime(w))}; render(); }).catch(() => { el.textContent = 'ส่งไม่ได้ ลองใหม่'; el.disabled = false; }); }
  else if (act === 'chyes' || act === 'chno') { if (!CLOUD) return; el.disabled = true; answerChallenge(v, act === 'chyes').then(() => { view = {note: act === 'chyes' ? 'รับคำท้าแล้ว' : 'ปฏิเสธคำท้าแล้ว'}; render(); }).catch(() => { el.disabled = false; }); }
  else if (act === 'chcancel') { if (!CLOUD) return; el.disabled = true; cancelChallenge(v).then(() => render()).catch(() => { el.disabled = false; }); }
  else if (act === 'chwatch') watchMatch(v);
  else if (act === 'quick') { if (!F || !QUICK[v]) return; F.plan = Object.assign({}, QUICK[v][1]); render(); }
  else if (act === 'splearn') { const cost = SP_LEARN[Math.min(SP_LEARN.length - 1, Math.max(0, S.spOwn.length - 2))]; if (S.spOwn.includes(v) || !SPECIALS.includes(v) || S.money < cost) return; S.money -= cost; S.spOwn.push(v); view = {note: 'เรียนท่าไม้ตาย ' + MOVES[v].th + ' จากครูแล้ว'}; save(); topBar(); render(); }
  else if (act === 'spup') { const lv = spLv(v); if (!S.spOwn.includes(v) || lv >= SP_MAX || S.money < SP_UP[lv] || S.slots < 1) return; S.money -= SP_UP[lv]; S.slots--; S.spLv[v] = lv + 1; S.fatigue = clamp(S.fatigue + SP_UP_FAT, 0, 100); view = {note: 'ฝึก' + MOVES[v].th + 'ได้ขั้น ' + (lv + 1) + ' แล้ว'}; save(); topBar(); render(); }
  else if (act === 'sp') { if (!S.spOwn.includes(v)) return; if (S.sp.includes(v)) { if (S.sp.length > 1) S.sp = S.sp.filter(k => k !== v); } else { S.sp.push(v); if (S.sp.length > 2) S.sp.shift(); } save(); render(); }
  else if (act === 'plan') { F.plan[el.dataset.g] = v; render(); }
  else if (act === 'startfight') startFight();
  else if (act === 'resume') { for (let i = F.round; i < 3; i++) F.plans[i] = Object.assign({}, F.plan); API.replan(plansFor()); F.phase = 'live'; render(); API.resume(); $('stage').scrollIntoView({block: 'nearest', behavior: 'smooth'}); }
  else if (act === 'skip') API.skip();
  else if (act === 'drillquit') { drillEnd(true); setMode(false); render(); showMe(); }
}
function onInput(e) {
  const el = e.target; if (!el.dataset || !el.dataset.vol) return;
  API.sound.vol(el.dataset.vol, el.value / 100); const o = el.parentNode.querySelector('output'); if (o) o.textContent = el.value + '%';
}
function onChange(e) {
  const el = e.target;
  if (el.id === 'gdname') { const n = API.cleanName(el.value); if (n.length >= 2) { S.name = n; save(); topBar(); } el.value = S.name; }
}

export function bootGame(api) {
  API = api; API.HOOK.onRoundBreak = onRoundBreak; API.HOOK.onOver = onOver;
  window.addEventListener('keydown', e => { if (!DR || e.repeat) return; const k = Object.keys(KINDS).find(x => KINDS[x].key.includes(e.key.toLowerCase())); if (k) { e.preventDefault(); drillPress(k); } });
  $('gBody').addEventListener('pointerdown', e => { const el = e.target.closest('[data-drill]'); if (el && DR) { e.preventDefault(); drillPress(el.dataset.drill); } });
  const g = $('game'); g.addEventListener('click', onClick); $('gBody').addEventListener('click', onClick); $('gNav').addEventListener('click', onClick); $('gBody').addEventListener('change', onChange); $('gBody').addEventListener('input', onInput);
  const h = document.querySelector('.app h1'); if (h) { h.firstChild.textContent = 'MUAY '; h.querySelector('span').textContent = 'MANAGER'; h.insertAdjacentHTML('afterbegin', '<i class="ui logo" data-ui="logo" role="img" aria-label="MUAY MANAGER"></i>'); h.classList.add('glogo'); $('ver').textContent = 'ต้นแบบ 2.6'; }
  window.GAME = {drill: () => DR, press: drillPress, save: () => S}; // for automated checks
  S = loadLocal(); setMode(false);
  if (S) go('home'); else { view = 'create'; render(); API.preview({fighter: draft.body, shorts: 'red', trim: 'white', pattern: 'plain', gloves: 'red', head: 'none'}); }
  cloudInit();
}
