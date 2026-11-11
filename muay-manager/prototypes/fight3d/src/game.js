// Game layer: profile, training, outfits, matchmaking, corner plans, rewards and ranking.
// It never touches fight rules: it builds two fighter specs and plans, hands them to the simulation through the viewer,
// and turns the result into progress. Save lives in the browser and, when the page has it, in the artifact database.
import { STYLES, STAT_TH, FIRST, CAMP, PLAN, PLAN_DEFAULT, MOVES, STYLE_PLAN, VENUE_RULES } from './data.js';
import { PLAN_TIPS } from './plantips.js';

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
const MISSIONS = [{id: 'train', th: 'ซ้อมครบ 3 ครั้ง', need: 3, money: 100, fame: 0}, {id: 'win', th: 'ชนะ 1 ไฟต์', need: 1, money: 150, fame: 1}, {id: 'ranked', th: 'ขึ้นชกจัดอันดับ 1 ไฟต์', need: 1, money: 120, fame: 2}];
const SAVE_KEY = 'muayManagerSave1';

let API = null, S = null, tab = 'home', view = null, CLOUD = null, board = [], cloudNote = 'กำลังเชื่อมต่อ…', pending = null, mini = null, F = null, DR = null;

// ---------- save ----------
function newSave(name, body, style) {
  return {v: 1, name, body, style, stats: Object.assign({}, START[style]), look: {shorts: 'red', trim: 'white', pattern: 'plain', gloves: 'red', head: 'none', hair: 'natural'},
    own: {colors: ['red', 'blue', 'black', 'white'], patterns: ['plain'], head: ['none'], hair: ['natural']}, mood: 2, staff: [], belts: [], title: 1, day: 1, slots: 3, ranked: 2, fatigue: 0, money: 500, fame: 0, rp: 1000, best: 1000,
    rec: {w: 0, l: 0, ko: 0}, gym: 1, chuek: 1, seed: Math.floor(Math.random() * 1e9), plan: Object.assign({}, PLAN_DEFAULT), log: [],
    sp: STYLES.find(x => x.id === style).sp.slice(), spOwn: STYLES.find(x => x.id === style).sp.slice(), mis: {day: 1, n: {}}, updatedAt: Date.now()};
}
function loadLocal() { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); return valid(s) ? fix(s) : null; } catch (e) { return null; } }
function fix(s) { // fields added after a save was made
  const sp = STYLES.find(x => x.id === s.style).sp;
  if (!Array.isArray(s.spOwn)) s.spOwn = sp.slice();
  if (!Array.isArray(s.sp) || !s.sp.length) s.sp = sp.slice();
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
    if (!window.claude || !window.claude.use) { cloudNote = 'ออฟไลน์ บันทึกในเครื่องนี้'; return; }
    const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
    const uid = db && user ? await user.id() : null;
    if (!uid) { cloudNote = 'ออฟไลน์ บันทึกในเครื่องนี้'; if (tab === 'rank' || tab === 'home') render(); return; }
    CLOUD = {db, uid}; cloudNote = 'ออนไลน์';
    const snap = await db.collection('data/users/' + uid).doc('save').get();
    const c = snap.exists ? snap.data() : null;
    if (valid(c) && (!S || (c.updatedAt || 0) > (S.updatedAt || 0))) { S = fix(c); try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* fine */ } if (!F) go('home'); }
    else if (S) save();
    await loadBoard();
  } catch (e) { cloudNote = 'ออฟไลน์ บันทึกในเครื่องนี้'; }
  if (!F && view !== 'create') render();
}
async function loadBoard() {
  if (!CLOUD) return;
  try {
    const q = await CLOUD.db.collection('board').orderBy('rp', 'desc').limit(60).get();
    board = q.docs.map(d => ({id: d.id, d: d.data() || {}})).filter(x => x.id !== CLOUD.uid && typeof x.d.rp === 'number' && typeof x.d.name === 'string')
      .map(x => ({real: true, name: API.cleanName(x.d.name) || 'นักมวย', rp: clamp(Math.round(x.d.rp), 0, 4000), w: x.d.w | 0, l: x.d.l | 0, ko: x.d.ko | 0,
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
function playerSpec() { const st = {}, m = fatigueMul() * MOOD_FIGHT[S.mood]; KEYS.forEach(k => { st[k] = clamp(Math.round(S.stats[k] * m), 20, 100); }); return {name: S.name, first: S.name, style: S.style, stats: st, skin: 0, sp: S.sp.slice()}; }
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
function topBar() {
  if (!S) { $('gTop').innerHTML = ''; return; }
  const f = Math.round(S.fatigue);
  $('gTop').innerHTML = '<div class="who"><b>' + esc(S.name) + '</b><span>' + LEAGUES[league(S.rp)][1] + ' · วันที่ ' + S.day + ' · อารมณ์ <i class="' + (S.mood > 2 ? 'hi' : S.mood < 2 ? 'lo' : '') + '">' + MOODS[S.mood] + '</i></span></div>' +
    '<div class="res"><span title="เงิน">฿ ' + baht(S.money) + '</span><span title="ชื่อเสียง">★ ' + S.fame + '</span><span title="คะแนนอันดับ">RP ' + S.rp + '</span></div>' +
    '<div class="fat" title="ความล้า"><span>ล้า ' + f + '%</span><span class="t"><i class="' + (f >= 70 ? 'hi' : f >= 40 ? 'mid' : '') + '" style="width:' + f + '%"></i></span></div>';
}
function nav() {
  const tabs = [['home', 'ค่าย'], ['train', 'ซ้อม'], ['dress', 'แต่งตัว'], ['fight', 'หาคู่ชก'], ['rank', 'อันดับ']];
  $('gNav').innerHTML = tabs.map(t => '<button class="btn seg" data-act="tab" data-v="' + t[0] + '" aria-pressed="' + (tab === t[0]) + '">' + t[1] + '</button>').join('');
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
  if (tab === 'home') b.innerHTML = homeHtml();
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
    '<div class="fld">สายมวย</div><div class="styles">' + STYLES.map(s => '<button class="stylecard" data-act="style" data-v="' + s.id + '" aria-pressed="' + (draft.style === s.id) + '"><b>' + s.th + '</b><span>' + STYLE_NOTE[s.id] + '</span><span class="sp">ท่าไม้ตาย: ' + s.sp.map(k => MOVES[k].th).join(' · ') + '</span></button>').join('') + '</div>' +
    '<div class="statbox r">' + statBars(START[draft.style]) + '</div>' +
    '<p class="hint" id="gCreateMsg"></p><button class="btn go wide" data-act="create">เริ่มอาชีพ</button></section>';
}
function homeHtml() {
  const rows = rankRows(), pos = rows.findIndex(r => r.me) + 1, lg = league(S.rp), next = LEAGUES[lg + 1];
  const goal = next ? 'อีก ' + (next[0] - S.rp) + ' RP จะได้ขึ้น' + next[1] : 'อยู่ระดับสูงสุดแล้ว รักษาอันดับไว้';
  const gymNext = S.gym < 5 ? '<button class="btn" data-act="gym">อัปเกรดค่าย ระดับ ' + (S.gym + 1) + ' · ฿ ' + baht(GYM_COST[S.gym]) + '</button>' : '<span class="hint">ค่ายระดับสูงสุดแล้ว</span>';
  const guide = S.rec.w + S.rec.l === 0 ? '<section class="gcard"><h2>เริ่มต้นยังไง</h2><p class="hint">1. ไปที่ "ซ้อม" ใช้แรงซ้อมวันละ 3 ครั้งเพิ่มค่าพลัง<br>2. ไปที่ "หาคู่ชก" ท้าชกเวทีงานวัดเพื่อหาเงินและประสบการณ์ แล้วลองศึกจัดอันดับ<br>3. ก่อนชกเลือกแผน และแก้แผนได้ทุกพักยกตามที่พี่เลี้ยงแนะนำ<br>4. กลับมา "จบวัน นอนพัก" เพื่อลดความล้าและเริ่มวันใหม่</p></section>' : '';
  return (view && view.note ? '<p class="gain">' + view.note + '</p>' : '') + guide + '<section class="gcard"><h2>' + esc(S.name) + ' <small>สาย' + styleTh(S.style) + '</small></h2>' +
    '<div class="kv"><span>สถิติ</span><b>ชนะ ' + S.rec.w + ' (น็อก ' + S.rec.ko + ') แพ้ ' + S.rec.l + '</b><span>อันดับ</span><b>ที่ ' + pos + ' จาก ' + rows.length + ' · ' + LEAGUES[lg][1] + '</b><span>เข็มขัด</span><b>' + (S.belts.length ? '<span class="belts">' + S.belts.map(i => '<span class="belt">' + BELTS[i] + '</span>').join('') + '</span>' : 'ยังไม่มี') + '</b><span>เป้าหมาย</span><b>' + goal + '</b></div>' +
    '<div class="statbox r">' + statBars(S.stats) + '</div><p class="hint">ค่าพลังเฉลี่ย ' + overall(S.stats) + ' · เพดานค่าพลังของค่ายระดับ ' + S.gym + ' คือ ' + cap() + '</p>' +
    '<div class="rowbtn">' + gymNext + '</div></section>' +
    '<section class="gcard"><h2>วันนี้</h2><div class="kv"><span>แรงซ้อม</span><b>เหลือ ' + S.slots + ' จาก 3 ครั้ง</b><span>ศึกจัดอันดับ</span><b>เหลือ ' + S.ranked + ' จาก 2 ไฟต์</b></div>' +
    '<div class="rowbtn"><button class="btn" data-act="tab" data-v="train">ไปซ้อม</button><button class="btn" data-act="tab" data-v="fight">หาคู่ชก</button><button class="btn go" data-act="sleep">จบวัน นอนพัก</button></div>' +
    '<p class="hint">นอนพักแล้วความล้าลด ' + (35 + (S.staff.includes('massage') ? 12 : 0)) + ' ได้แรงซ้อมและคู่ชกชุดใหม่ ได้ค่าสปอนเซอร์ ฿ ' + baht(40 + S.fame * 3) + (S.staff.length ? ' จ่ายค่าจ้างทีมงาน ฿ ' + baht(S.staff.reduce((a, id) => a + STAFF.find(x => x.id === id).wage, 0)) : '') + '</p></section>' +
    '<section class="gcard"><h2>ทีมงาน <small>จ่ายค่าจ้างทุกเช้า</small></h2>' + STAFF.map(st => { const on = S.staff.includes(st.id); return '<div class="staff"><b>' + st.th + (on ? ' ✓' : '') + '</b><span>' + st.note + ' · ค่าจ้างวันละ ฿ ' + st.wage + '</span><button class="btn" data-act="staff" data-v="' + st.id + '">' + (on ? 'เลิกจ้าง' : 'จ้าง ฿ ' + baht(st.hire)) + '</button></div>'; }).join('') + '</section>' +
    '<section class="gcard"><h2>ภารกิจวันนี้</h2>' + MISSIONS.map(m => { const n = Math.min(m.need, (S.mis.day === S.day ? S.mis.n[m.id] : 0) || 0), done = n >= m.need; return '<div class="mis' + (done ? ' done' : '') + '"><span>' + (done ? '✓ ' : '') + m.th + '</span><span>' + n + '/' + m.need + '</span><span>฿ ' + m.money + (m.fame ? ' ★ ' + m.fame : '') + '</span></div>'; }).join('') + '</section>' +
    '<section class="gcard"><h2>ท่าไม้ตาย <small>เลือกใช้ได้ 2 ท่า</small></h2><div class="pick">' + SPECIALS.map(k => { const own = S.spOwn.includes(k), on = S.sp.includes(k); return '<button class="btn seg sm" data-act="sp" data-v="' + k + '" aria-pressed="' + on + '"' + (own ? '' : ' disabled') + '>' + MOVES[k].th + (own ? '' : ' (ล็อก)') + '</button>'; }).join('') + '</div>' +
    '<p class="hint">' + (S.spOwn.length - 2 < SP_FAME.length && S.spOwn.length < SPECIALS.length ? 'ท่าถัดไปปลดเมื่อชื่อเสียงถึง ★ ' + SP_FAME[S.spOwn.length - 2] + ' ' : 'ปลดครบทุกท่าแล้ว ') + 'ท่าที่เลือกจะออกสลับกันเมื่อเกจท่าไม้ตายเต็ม</p></section>' +
    (S.log.length ? '<section class="gcard"><h2>ไฟต์ล่าสุด</h2>' + S.log.slice(0, 5).map(l => '<div class="logrow ' + (l.w ? 'w' : 'l') + '"><b>' + (l.w ? 'ชนะ' : 'แพ้') + '</b><span>' + esc(l.o) + '</span><span>' + esc(l.h) + '</span></div>').join('') + '</section>' : '') +
    '<p class="hint">' + cloudNote + ' · <button class="link" data-act="reset">เริ่มใหม่ทั้งหมด</button></p>';
}
function trainHtml() {
  if (DR) return drillHtml();
  if (mini) return miniHtml();
  const c = cap();
  return '<section class="gcard"><h2>ตารางซ้อมวันนี้ <small>เหลือ ' + S.slots + ' ครั้ง</small></h2>' +
    (S.fatigue >= 70 ? '<p class="warn">ล้ามากแล้ว ซ้อมได้ผลน้อยลงและเสี่ยงเจ็บ ควรพัก</p>' : '') +
    '<div class="acts">' + ACTS.map(a => { const st = a.stat.map(k => STAT_TH[k] + ' ' + Math.floor(S.stats[k]) + '/' + c).join(' · '); return '<button class="act' + (a.drill ? ' drill' : '') + '" data-act="train" data-v="' + a.id + '"' + (S.slots < 1 ? ' disabled' : '') + '><b>' + a.th + (a.drill ? ' <i>กดเอง</i>' : '') + '</b><span>' + a.note + '</span><span class="sm">' + (st || 'ไม่ได้ค่าพลัง') + ' · ล้า ' + (a.fat > 0 ? '+' : '') + a.fat + (failPct(a) ? ' · เสี่ยงซ้อมพลาด ' + failPct(a) + '%' : '') + (coachOf(a) ? ' · ครูช่วย +25%' : '') + '</span></button>'; }).join('') + '</div>' +
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
    row('shorts', 'สีกางเกง', API.COLORS, 1) + row('pattern', 'ลายกางเกง', API.PATTERNS) + row('trim', 'สีลายกางเกงและมงคล', API.COLORS, 1) + row('gloves', 'สีนวม', API.COLORS, 1) + row('hair', 'สีผม', API.HAIR, 1) + row('head', 'มงคล (สวมตอนไหว้ครู ถอดก่อนชก)', API.HEADGEAR) +
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
  return (tired ? '<p class="warn">ล้าเกิน 90% ขึ้นชกไม่ได้ ไปพักหรือจบวันก่อน</p>' : '') +
    '<section class="gcard"><h2>ศึกชิงเข็มขัด <small>' + BELTS[lgNow] + '</small></h2><p class="hint">แชมป์เก่าแกร่งกว่าคู่ชกทั่วไป ชนะได้เข็มขัด เงินก้อนใหญ่ และ RP +25 ชิงได้วันละครั้ง</p>' + title + '</section>' +
    '<section class="gcard"><h2>ศึกจัดอันดับ <small>เหลือ ' + S.ranked + ' ไฟต์วันนี้</small></h2><p class="hint">ชนะได้คะแนนอันดับ แพ้เสียคะแนน คู่ชกคือนักมวยที่อันดับใกล้กัน</p>' + rk + '</section>' +
    '<section class="gcard"><h2>ศึกมวยคาดเชือก <small>งานประเพณี วันละ 1 ไฟต์</small></h2><p class="hint">ถอดนวม พันหมัดด้วยเชือก ชกบนลานดิน หมัดเท้าเข่าศอกหนักขึ้น การ์ดกันได้น้อยลง น็อกง่ายกว่าเวทีปกติ ไม่มีผลกับอันดับ ได้ชื่อเสียงมาก</p>' + (S.chuek > 0 ? oppCard(chuekOpp(), '<button class="btn" data-act="pick" data-v="c"' + dis + '>ขึ้นชกคาดเชือก</button>') : '<p class="hint">ชกคาดเชือกของวันนี้ไปแล้ว</p>') + '</section>' +
    '<section class="gcard"><h2>เวทีงานวัดใกล้ค่าย <small>ท้าชกฝึกฝีมือ</small></h2><p class="hint">ไม่มีผลกับอันดับ ได้เงิน ชื่อเสียง และประสบการณ์เวที ทุกไฟต์เพิ่มความล้า 22</p>' + loc + '</section>';
}
function rankHtml() {
  const rows = rankRows(), me = rows.findIndex(r => r.me), show = new Set();
  rows.forEach((r, i) => { if (i < 10 || Math.abs(i - me) <= 3) show.add(i); });
  let html = '', lastI = -1;
  rows.forEach((r, i) => { if (!show.has(i)) return; if (lastI >= 0 && i - lastI > 1) html += '<div class="rk gap">…</div>'; lastI = i;
    html += '<div class="rk' + (r.me ? ' me' : '') + '"><span class="n">' + (i + 1) + '</span><span class="nm">' + esc(r.name) + (r.real ? ' <i>ผู้เล่น</i>' : '') + '</span><span class="lg">' + LEAGUES[league(r.rp)][1] + '</span><span class="wl">' + r.w + '-' + r.l + '</span><span class="rp">' + r.rp + '</span></div>'; });
  return '<section class="gcard"><h2>ตารางอันดับ</h2><div class="rkh"><span>#</span><span>นักมวย</span><span>ระดับ</span><span>ชนะ-แพ้</span><span>RP</span></div>' + html +
    '<p class="hint">' + (CLOUD ? 'ออนไลน์: นักมวยของผู้เล่นคนอื่นที่เปิดหน้านี้จะขึ้นในตารางและถูกจับคู่ชกได้' : cloudNote + ' ตารางนี้มีเฉพาะคู่แข่งของระบบ') + '</p></section>';
}

// ---------- fight flow ----------
function planHtml() {
  const o = F.opp, me = playerSpec();
  return '<section class="gcard"><h2>ก่อนขึ้นเวที <small>' + API.VENUES[o.venue] + '</small></h2><div class="vs"><div class="statbox r"><b>' + esc(S.name) + '</b><span class="sty">สาย' + styleTh(S.style) + (fatigueMul() < 1 ? ' · ล้า ค่าพลังลด ' + Math.round((1 - fatigueMul()) * 100) + '%' : '') + '</span>' + statBars(me.stats) + '</div>' +
    '<div class="statbox b"><b>' + esc(o.name) + '</b><span class="sty">สาย' + styleTh(o.style) + '</span>' + statBars(o.stats) + '</div></div>' +
    '<p class="advice"><b>พี่เลี้ยง:</b> ' + matchupTip(o.style) + '</p>' + planPicker(F.plan) +
    '<div class="rowbtn"><button class="btn go wide" data-act="startfight">ขึ้นเวที</button><button class="btn" data-act="backout">ถอนตัว</button></div></section>';
}
function advice(st) {
  const me = st[0], op = st[1], tips = [];
  if (op.wearLeg > 28) tips.push('ขาเขาเริ่มช้าแล้ว เตะขาต่อ');
  if (me.st < 38) tips.push('แรงเราเหลือน้อย ตั้งรับ เก็บแรง');
  if (op.st < 38) tips.push('เขาหอบแล้ว บุกเลย');
  if (op.head >= me.head + 3) tips.push('เราโดนเข้าหน้าบ่อย ถอยวงนอก หรือตั้งรับ');
  if (op.wearBody > 34) tips.push('ลำตัวเขาช้ำ เน้นลำตัวต่อ แรงเขาจะฟื้นช้า');
  const diff = me.total - op.total, left = 3 - F.round;
  if (diff < 0) tips.unshift(-diff > left ? 'คะแนนตาม ' + (-diff) + ' แต้ม ชนะยกธรรมดาไม่พอแล้ว ต้องทำให้เขาถูกนับหรือน็อก' : 'คะแนนตาม ' + (-diff) + ' แต้ม ต้องชนะยกที่เหลือ');
  else if (diff > 0) tips.push('คะแนนนำ ' + diff + ' แต้ม คุมเกม อย่าเสี่ยงโดนนับ');
  if (!tips.length) tips.push('ยกนี้สูสี ' + matchupTip(F.opp.style));
  return tips.slice(0, 2);
}
function breakHtml() {
  const st = F.stats, n = F.round;
  const line = (label, a, b) => '<span>' + a + '</span><b>' + label + '</b><span>' + b + '</span>';
  return '<section class="gcard"><h2>พักยก ' + n + '</h2><div class="cmp">' + line('ยกนี้กรรมการให้', st[0].card, st[1].card) + line('คะแนนรวม', st[0].total, st[1].total) + line('เข้าเป้า', st[0].landed, st[1].landed) + line('เข้าหน้า', st[0].head, st[1].head) + line('เข้าลำตัว', st[0].body, st[1].body) + line('เข้าขา', st[0].leg, st[1].leg) + line('แรงเหลือ', Math.round(st[0].st) + '%', Math.round(st[1].st) + '%') + line('พลังชีวิต', Math.round(st[0].hp) + '%', Math.round(st[1].hp) + '%') + '</div>' +
    advice(st).map(t => '<p class="advice"><b>พี่เลี้ยง:</b> ' + t + '</p>').join('') + '<div class="fld">แผนยกต่อไป</div>' + planPicker(F.plan) +
    '<button class="btn go wide" data-act="resume">ชกต่อ</button></section>';
}
function liveHtml() {
  return '<section class="gcard slim"><div class="kv"><span>แผนตอนนี้</span><b>' + planText(F.plan) + '</b><span>คู่ชก</span><b>' + esc(F.opp.name) + ' · สาย' + styleTh(F.opp.style) + '</b></div>' +
    '<div class="rowbtn"><button class="btn" data-act="skip">ข้ามไปดูผล</button></div></section>';
}
function resultHtml() {
  const r = F.res;
  return '<section class="gcard"><h2 class="' + (r.win ? 'win' : 'lose') + '">' + (r.win ? 'ชนะ' : 'แพ้') + ' ' + esc(r.how) + '</h2><p class="hint">' + esc(r.detail) + '</p>' +
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
  await API.startFight({venue: o.venue, rules: VENUE_RULES[o.venue] || null, seed: F.seed, specs: [playerSpec(), {name: o.name, first: o.name, style: o.style, stats: o.stats, skin: 1}], plans: plansFor(),
    looks: [Object.assign({name: S.name, fighter: S.body}, S.look), Object.assign({name: o.name, fighter: o.body}, o.look)]});
}
function onRoundBreak(n, st) { F.phase = 'break'; F.round = n; F.stats = st; render(); $('gBody').scrollIntoView({block: 'nearest', behavior: 'smooth'}); }
function onOver(res) {
  const win = res.w === 0, o = F.opp, ko = res.how !== 'คะแนน', lgBefore = league(S.rp);
  const r = {win, how: res.how === 'คะแนน' ? 'คะแนน' : res.how + ' ยก ' + res.round, detail: (res.move ? 'ปิดเกมด้วย' + MOVES[res.move].th + ' · ' : '') + (res.how === 'คะแนน' ? 'กรรมการให้ ' + res.cards[0] + ' ต่อ ' + res.cards[1] + (res.cards[0] === res.cards[1] ? ' (เท่ากัน ตัดสินจากความเสียหายที่ทำได้)' : '') + ' · ' : '') + 'เข้าเป้า ' + res.landed[0] + ' ต่อ ' + res.landed[1]};
  r.money = win ? o.money + (ko ? 80 : 0) : Math.round(o.money * .25); r.fame = win ? o.fame + (ko ? 2 : 0) : 1;
  r.fat = 22 + (!win && ko ? 12 : 0);
  if (o.kind === 'ranked') { const ex = 1 / (1 + Math.pow(10, (o.rp - S.rp) / 400)); r.drp = Math.round(32 * ((win ? 1 : 0) - ex)); S.rp = Math.max(600, S.rp + r.drp); S.ranked = Math.max(0, S.ranked - 1); }
  if (o.kind === 'chuek') S.chuek = 0;
  if (o.kind === 'title') { S.title = 0; if (win) { S.belts.push(o.belt); r.drp = 25; S.rp += 25; } }
  // ring experience: a little growth in what the style leans on, more for a win
  const grow = win ? .7 : .35, ks = KEYS.slice().sort((a, b) => START[S.style][b] - START[S.style][a]).slice(0, 2);
  ks.forEach(k => { S.stats[k] = Math.min(cap(), S.stats[k] + grow); }); r.xp = ks.map(k => STAT_TH[k] + ' +' + grow).join(' · ');
  S.money += r.money; S.fame += r.fame; S.fatigue = clamp(S.fatigue + r.fat, 0, 100);
  if (win) { S.rec.w++; if (ko) S.rec.ko++; } else S.rec.l++;
  if (S.rp > S.best) { const lgNow = league(S.rp); if (lgNow > league(S.best)) { r.promo = LEAGUES[lgNow][1]; r.promoMoney = 1000 * lgNow; S.money += r.promoMoney; } S.best = S.rp; }
  S.log.unshift({w: win, o: o.name, h: r.how}); S.log = S.log.slice(0, 12);
  r.extra = [o.kind === 'title' && win ? 'ได้' + BELTS[o.belt] + 'มาครอง!' : '', (win ? moodUp(ko ? 2 : 1) : moodUp(ko ? -2 : -1)).trim(), win ? mission('win') : '', o.kind === 'ranked' ? mission('ranked') : '', unlockSpecials()].filter(Boolean);
  save(); F.res = r; F.phase = 'result'; topBar(); render(); $('gBody').scrollIntoView({block: 'nearest', behavior: 'smooth'});
  void lgBefore;
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
  if (act === 'body') { draft.body = v; draft.name = $('gName').value; renderCreate(); API.preview({fighter: v, shorts: 'red', trim: 'white', pattern: 'plain', gloves: 'red', head: 'none'}, 'guard'); }
  else if (act === 'style') { draft.style = v; draft.name = $('gName').value; renderCreate(); }
  else if (act === 'create') { const name = API.cleanName($('gName').value); if (name.length < 2) { $('gCreateMsg').textContent = 'ตั้งชื่อนักมวยก่อน อย่างน้อย 2 ตัวอักษร'; return; } S = newSave(name, draft.body, draft.style); save(); go('home'); }
  else if (act === 'tab') go(v);
  else if (act === 'home') { F = null; API.stop(); go('home'); if (CLOUD) loadBoard(); }
  else if (act === 'sleep') {
    const wage = S.staff.reduce((a, id) => a + STAFF.find(x => x.id === id).wage, 0), income = 40 + S.fame * 3; let note = 'เช้าวันใหม่ ได้ค่าสปอนเซอร์ ฿ ' + baht(income);
    S.day++; S.slots = 3; S.ranked = 2; S.chuek = 1; S.title = 1; S.fatigue = clamp(S.fatigue - 35 - (S.staff.includes('massage') ? 12 : 0), 0, 100); S.money += income;
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
  else if (act === 'pick') { const o = v === 'r' ? rankedOpp() : v === 'c' ? chuekOpp() : v === 't' ? titleOpp() : localOpps().find(x => x.id === v); if (!o) return; F = {opp: o, seed: (S.seed + S.day * 101 + S.rec.w * 7 + S.rec.l * 13 + (v === 'r' ? 5 : v === 'c' ? 9 : v === 't' ? 11 : +v.slice(1))) >>> 0, plan: Object.assign({}, S.plan || PLAN_DEFAULT), phase: 'plan'}; setMode(false); render(); API.preview(Object.assign({fighter: o.body}, o.look), 'guard', o.venue); $('gBody').scrollIntoView({block: 'nearest'}); }
  else if (act === 'backout') { F = null; go('fight'); }
  else if (act === 'sp') { if (!S.spOwn.includes(v)) return; if (S.sp.includes(v)) { if (S.sp.length > 1) S.sp = S.sp.filter(k => k !== v); } else { S.sp.push(v); if (S.sp.length > 2) S.sp.shift(); } save(); render(); }
  else if (act === 'plan') { F.plan[el.dataset.g] = v; render(); }
  else if (act === 'startfight') startFight();
  else if (act === 'resume') { for (let i = F.round; i < 3; i++) F.plans[i] = Object.assign({}, F.plan); API.replan(plansFor()); F.phase = 'live'; render(); API.resume(); $('stage').scrollIntoView({block: 'nearest', behavior: 'smooth'}); }
  else if (act === 'skip') API.skip();
  else if (act === 'drillquit') { drillEnd(true); setMode(false); render(); showMe(); }
}
function onChange(e) {
  const el = e.target;
  if (el.id === 'gdname') { const n = API.cleanName(el.value); if (n.length >= 2) { S.name = n; save(); topBar(); } el.value = S.name; }
}

export function bootGame(api) {
  API = api; API.HOOK.onRoundBreak = onRoundBreak; API.HOOK.onOver = onOver;
  window.addEventListener('keydown', e => { if (!DR || e.repeat) return; const k = Object.keys(KINDS).find(x => KINDS[x].key.includes(e.key.toLowerCase())); if (k) { e.preventDefault(); drillPress(k); } });
  $('gBody').addEventListener('pointerdown', e => { const el = e.target.closest('[data-drill]'); if (el && DR) { e.preventDefault(); drillPress(el.dataset.drill); } });
  const g = $('game'); g.addEventListener('click', onClick); $('gBody').addEventListener('click', onClick); $('gNav').addEventListener('click', onClick); $('gBody').addEventListener('change', onChange);
  const h = document.querySelector('.app h1'); if (h) { h.firstChild.textContent = 'MUAY '; h.querySelector('span').textContent = 'MANAGER'; $('ver').textContent = 'ต้นแบบ 0.7'; }
  window.GAME = {drill: () => DR, press: drillPress, save: () => S}; // for automated checks
  S = loadLocal(); setMode(false);
  if (S) go('home'); else { view = 'create'; render(); API.preview({fighter: draft.body, shorts: 'red', trim: 'white', pattern: 'plain', gloves: 'red', head: 'none'}); }
  cloudInit();
}
