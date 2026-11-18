// What the testers did: a report from the game's database. Who played, how long, how often they came back, which
// training, fights and buttons were used most and which never, where players stopped, what they wrote, what broke.
// The numbers come from each player's save (game.js: useCount) and from the logs table.
//   node tools/tester-report.mjs --db /srv/muay/data/muay.db     the VPS (server/server.mjs), run on the server
//   node tools/tester-report.mjs --remote                         the Cloudflare site (needs CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID)
//   node tools/tester-report.mjs --local                          the local wrangler database
//   ... --out report.md   write it to a file too   ·   --skip ทดสอบ,บอท   leave out fighters whose names start so
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; }, has = k => process.argv.includes(k);
const SKIP = (has('--skip') ? arg('--skip') || '' : 'ทดสอบ,บอท').split(',').filter(Boolean); // --skip "" counts everybody

// ---- reading the database
let query;
if (arg('--db')) {
  const { DatabaseSync } = await import('node:sqlite'); const db = new DatabaseSync(arg('--db'), {readOnly: true});
  query = sql => db.prepare(sql).all();
} else if (has('--remote') || has('--local')) {
  query = sql => { const out = execFileSync('npx', ['--yes', 'wrangler@4', 'd1', 'execute', 'muay-manager', has('--remote') ? '--remote' : '--local', '--json', '--command', sql], {maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore']}).toString(); return JSON.parse(out)[0].results; };
} else { console.error('say where the database is: --db <file> | --remote | --local'); process.exit(1); }

const players = query('SELECT id, created FROM players');
const docs = query("SELECT coll, id, data, updated FROM docs WHERE coll = 'board' OR coll LIKE 'data/users/%'");
const logs = query('SELECT id, t, ver, msg FROM logs ORDER BY id DESC LIMIT 1000');

// ---- one record per fighter
const parse = t => { try { return JSON.parse(t); } catch (e) { return null; } };
const board = new Map(docs.filter(d => d.coll === 'board').map(d => [d.id, parse(d.data) || {}]));
const all = docs.filter(d => d.coll.startsWith('data/users/') && d.id === 'save').map(d => ({id: d.coll.slice(11), s: parse(d.data), updated: d.updated})).filter(p => p.s && p.s.name);
const P = all.filter(p => !SKIP.some(k => p.s.name.startsWith(k)));
const now = Date.now(), DAY = 864e5;
const sum = a => a.reduce((x, y) => x + y, 0), med = a => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[b.length >> 1] : 0; };
const hm = sec => (sec >= 3600 ? Math.floor(sec / 3600) + ' ชม. ' : '') + Math.round((sec % 3600) / 60) + ' นาที';
const ago = t => { const d = now - t; return d < 36e5 ? Math.max(1, Math.round(d / 6e4)) + ' นาทีก่อน' : d < DAY ? Math.round(d / 36e5) + ' ชม.ก่อน' : Math.round(d / DAY) + ' วันก่อน'; };
const use = p => (p.s.use && typeof p.s.use === 'object' ? p.s.use : null), U = P.filter(use);
// totals of one group of counters over all players, and how many players used each key
function tally(group, filter) {
  const m = new Map();
  for (const p of U) for (const [k, n] of Object.entries(use(p)[group] || {})) { if (filter && !filter(k)) continue; const e = m.get(k) || {n: 0, who: 0}; e.n += n; e.who++; m.set(k, e); }
  return [...m].sort((a, b) => b[1].n - a[1].n);
}
const out = [], say = (t = '') => out.push(t);
const table = (head, rows) => { say('| ' + head.join(' | ') + ' |'); say('|' + head.map(() => '---').join('|') + '|'); rows.forEach(r => say('| ' + r.join(' | ') + ' |')); say(); };
const pct = (a, b) => (b ? Math.round(a / b * 100) + '%' : '–');

// names of things in Thai
const TRAIN = {bag: 'กระสอบทราย', banana: 'เตะต้นกล้วย', dummy: 'หุ่นซ้อม', rope: 'กระโดดเชือก', spar: 'ลงนวม', run: 'วิ่ง', fun: 'พักผ่อน', rest: 'พักนวด'};
const FIGHT = {local: 'งานวัด (ฝึกฝีมือ)', ranked: 'จัดอันดับ', chuek: 'คาดเชือก', rival: 'ล้างตาคู่ปรับ', title: 'ชิงเข็มขัด', defense: 'ป้องกันแชมป์', tour: 'ทัวร์นาเมนต์', challenge: 'ท้าชกกับผู้เล่น', spectator: 'ดูแมตช์ของคนอื่นสด', exhibition: 'ดูไฟต์อุ่นเครื่อง'};
const TAB = {home: 'ค่าย', train: 'ซ้อม', dress: 'แต่งตัว', fight: 'หาคู่ชก', rank: 'อันดับ'};
const QUICK = {teep: 'ถีบดักคุมระยะ', press: 'เดินบี้เข้าวงใน', ease: 'ผ่อนแรงเก็บแต้ม'};
const PLAN = {'ag=attack': 'เดินตี', 'ag=balanced': 'ดูเชิง', 'ag=counter': 'ตั้งรับ', 'range=out': 'วงนอก', 'range=mixed': 'ตามจังหวะ', 'range=in': 'วงใน', 'target=head': 'เน้นหัว', 'target=body': 'เน้นลำตัว', 'target=leg': 'เน้นขา', 'target=mixed': 'ผสม'};
// the features a tester may or may not find: [action, what it is]
const FEATURES = [['autotrain', 'ให้ครูคุมซ้อมแทน'], ['autoday', 'ซ้อมแทนทั้งวัน'], ['staff', 'จ้างหรือเลิกจ้างทีมงาน'], ['gym', 'อัปเกรดค่าย'], ['splearn', 'เรียนท่าไม้ตายใหม่'], ['spup', 'ฝึกท่าไม้ตายเพิ่มระดับ'], ['look', 'เปลี่ยนชุดหรือรูปลักษณ์'], ['buy', 'ซื้อของแต่งตัว'],
  ['tourjoin', 'สมัครทัวร์นาเมนต์'], ['tourwatch', 'ดูคู่อื่นในทัวร์นาเมนต์'], ['chsend', 'ส่งคำท้าชก'], ['chyes', 'รับคำท้าชก'], ['chwatch', 'กดดูแมตช์สด'], ['chshare', 'แชร์ลิงก์ชวนคนดู'], ['watch', 'เปิดหน้าดูมวย'], ['exh', 'ดูไฟต์อุ่นเครื่อง'], ['hall', 'ห้องถ้วยรางวัล'],
  ['quick', 'คำสั่งด่วนตอนพักยก'], ['resthold', 'กด "รอก่อน" ตอนพักยก'], ['nobreak', 'ตั้งให้ไม่หยุดพักยก'], ['skip', 'ข้ามไปดูผล'], ['settings', 'เปิดหน้าตั้งค่า'], ['feedback', 'ส่งแจ้งปัญหา'], ['xfer', 'ขอรหัสย้ายเครื่อง'], ['adr', 'กดรับโบนัสจากโฆษณา'], ['vipsoon', 'กดสนใจแพ็กเจ้าของค่าย (เว็บ)'], ['vipbuy', 'กดซื้อแพ็กเจ้าของค่าย']];

// ---- the report
say('# รายงานผู้ทดสอบ Muay Manager'); say();
say('ออกรายงาน ' + new Date(now).toLocaleString('th-TH', {timeZone: 'Asia/Bangkok'}) + ' • ไม่นับนักมวยที่ชื่อขึ้นต้นด้วย: ' + (SKIP.join(', ') || '–')); say();

say('## 1. ภาพรวม'); say();
const fights = P.map(p => (p.s.rec ? p.s.rec.w + p.s.rec.l : 0)), secs = U.map(p => use(p).secs || 0);
table(['รายการ', 'ค่า'], [
  ['เครื่องที่เคยเปิดเกม (ลงทะเบียน)', players.length], ['สร้างนักมวยแล้ว', P.length + (all.length - P.length ? ' (ไม่นับชื่อทดสอบอีก ' + (all.length - P.length) + ')' : '')],
  ['มีสถิติการใช้งาน (เล่นรุ่น 2.54 ขึ้นไป)', U.length], ['เล่นใน 24 ชม. ที่ผ่านมา', P.filter(p => now - (p.s.updatedAt || p.updated) < DAY).length],
  ['ไฟต์รวมทุกคน', sum(fights)], ['ไฟต์ต่อคน (ค่ากลาง)', med(fights)], ['วันในเกมที่ไปถึง (ค่ากลาง / สูงสุด)', med(P.map(p => p.s.day || 1)) + ' / ' + Math.max(0, ...P.map(p => p.s.day || 1))],
  ['เวลาเล่นรวม', U.length ? hm(sum(secs)) : '–'], ['เวลาเล่นต่อคน (ค่ากลาง)', U.length ? hm(med(secs)) : '–'], ['เวลาต่อการเปิดเกมหนึ่งครั้ง (เฉลี่ย)', U.length && sum(U.map(p => use(p).sess || 0)) ? hm(sum(secs) / sum(U.map(p => use(p).sess || 0))) : '–']]);

say('## 2. การกลับมาเล่น'); say();
if (!U.length) { say('ยังไม่มีผู้เล่นที่มีสถิติการใช้งาน'); say(); }
else {
  const by = new Map(); U.forEach(p => { const n = (use(p).days || []).length || 1; by.set(n, (by.get(n) || 0) + 1); });
  table(['เล่นมาแล้วกี่วัน (วันจริง)', 'จำนวนคน'], [...by].sort((a, b) => a[0] - b[0]).map(([n, c]) => [n + ' วัน', c]));
  say('กลับมาเล่นอย่างน้อยวันที่สอง: ' + pct(U.filter(p => (use(p).days || []).length >= 2).length, U.length) + ' ของผู้เล่น'); say();
}

say('## 3. อะไรถูกใช้มากที่สุด'); say();
if (!U.length) { say('ยังไม่มีข้อมูล (ผู้เล่นต้องเปิดเกมรุ่น 2.54 ขึ้นไปก่อน)'); say(); }
else {
  const A = tally('a'), a = k => (A.find(x => x[0] === k) || [0, {n: 0, who: 0}])[1];
  const part = (title, prefix, names) => { const rows = A.filter(([k]) => k.startsWith(prefix)), tot = sum(rows.map(r => r[1].n)); if (!rows.length) return; say('### ' + title); say(); table(['', 'ครั้ง', 'สัดส่วน', 'คนที่ใช้'], rows.map(([k, e]) => [names[k.slice(prefix.length)] || k.slice(prefix.length), e.n, pct(e.n, tot), e.who + ' / ' + U.length])); };
  part('การซ้อม', 'train:', TRAIN);
  const F = tally('f'), ft = sum(F.map(r => r[1].n));
  if (F.length) { say('### ไฟต์ที่เลือกขึ้นชกหรือเข้าดู'); say(); table(['', 'ครั้ง', 'สัดส่วน', 'คนที่ใช้'], F.map(([k, e]) => [FIGHT[k] || k, e.n, pct(e.n, ft), e.who + ' / ' + U.length])); }
  const E = Object.fromEntries(tally('end').map(([k, e]) => [k, e.n])), R = Object.fromEntries(tally('rest').map(([k, e]) => [k, e.n]));
  say('### ดูการชก'); say();
  table(['', 'ครั้ง', 'สัดส่วน'], [['ดูไฟต์ของตัวเองจนจบ', E.full || 0, pct(E.full || 0, (E.full || 0) + (E.skip || 0))], ['กดข้ามไปดูผล', E.skip || 0, pct(E.skip || 0, (E.full || 0) + (E.skip || 0))]]);
  const rt = (R.go || 0) + (R.held || 0) + (R.auto || 0);
  table(['พักยกจบอย่างไร', 'ครั้ง', 'สัดส่วน'], [['กดชกต่อเอง', R.go || 0, pct(R.go || 0, rt)], ['กด "รอก่อน" แล้วค่อยชกต่อ', R.held || 0, pct(R.held || 0, rt)], ['ปล่อยจนหมดเวลา 30 วินาที', R.auto || 0, pct(R.auto || 0, rt)]]);
  part('คำสั่งด่วนตอนพักยก', 'quick:', QUICK); part('แผนที่กดเลือก', 'plan:', PLAN); part('หน้าที่เปิด', 'tab:', TAB);
  say('### ฟีเจอร์ที่มีคนใช้ และที่ยังไม่มีใครกด'); say();
  const used = FEATURES.filter(([k]) => a(k).n || A.some(x => x[0].startsWith(k + ':'))), unused = FEATURES.filter(f => !used.includes(f));
  const cnt = k => { const rows = A.filter(x => x[0] === k || x[0].startsWith(k + ':')); return {n: sum(rows.map(r => r[1].n)), who: U.filter(p => Object.keys(use(p).a || {}).some(x => x === k || x.startsWith(k + ':'))).length}; };
  table(['ฟีเจอร์', 'ครั้ง', 'คนที่ใช้'], used.map(([k, th]) => { const c = cnt(k); return [th, c.n, c.who + ' / ' + U.length]; }).sort((x, y) => y[1] - x[1]));
  say('**ยังไม่มีใครกดเลย:** ' + (unused.map(f => f[1]).join(' • ') || 'ไม่มี (ทุกฟีเจอร์มีคนใช้)')); say();
}

say('## 4. ผู้เล่นแต่ละคน'); say();
table(['นักมวย', 'วันในเกม', 'ชนะ-แพ้', 'RP', 'ค่าย', 'เข็มขัด', 'เวลาเล่น', 'เปิดเกม', 'วันจริง', 'เล่นล่าสุด'], P.slice().sort((x, y) => (y.s.updatedAt || 0) - (x.s.updatedAt || 0)).map(p => { const u = use(p), s = p.s;
  return [s.name, s.day || 1, (s.rec ? s.rec.w + '-' + s.rec.l : '–'), s.rp || '–', s.gym || 1, (s.belts || []).length, u ? hm(u.secs || 0) : '–', u ? (u.sess || 0) + ' ครั้ง' : '–', u ? (u.days || []).length : '–', ago(s.updatedAt || p.updated)]; }));

say('## 5. คนที่หยุดเล่น (ไม่ได้เปิดเกมเกิน 2 วัน)'); say();
const gone = P.filter(p => now - (p.s.updatedAt || p.updated) > 2 * DAY);
if (!gone.length) { say('ยังไม่มี'); say(); }
else table(['นักมวย', 'หยุดที่วันในเกม', 'ไฟต์ที่ชก', 'ไฟต์สุดท้าย', 'เล่นล่าสุด'], gone.map(p => [p.s.name, p.s.day || 1, p.s.rec ? p.s.rec.w + p.s.rec.l : 0, p.s.log && p.s.log[0] ? (p.s.log[0].w ? 'ชนะ ' : 'แพ้ ') + (p.s.log[0].h || '') : '–', ago(p.s.updatedAt || p.updated)]));

say('## 6. ข้อความจากผู้เล่น'); say();
const notes = logs.filter(l => String(l.msg).startsWith('FEEDBACK '));
if (!notes.length) { say('ยังไม่มี'); say(); }
else notes.forEach(l => { const m = /^FEEDBACK (\{.*?\}) ([\s\S]*)$/.exec(l.msg), who = m ? parse(m[1]) || {} : {}; say('- **' + (who.from || '?') + '** (รุ่น ' + l.ver + ' • วันในเกม ' + (who.day || '?') + ' • จอ ' + (who.scr || '?') + ' • ' + ago(l.t) + '): ' + (m ? m[2] : l.msg).replace(/\s+/g, ' ')); }), say();

say('## 7. ข้อผิดพลาดจากเครื่องผู้เล่น'); say();
const errs = new Map(); let diag = 0, interest = 0;
for (const l of logs) { const m = String(l.msg); if (m.startsWith('FEEDBACK ')) continue; if (m.startsWith('diag ')) { diag++; continue; } if (/^vip/.test(m)) { interest++; continue; }
  const key = l.ver + ' · ' + m.split('\n')[0].slice(0, 140), e = errs.get(key) || {n: 0, last: 0}; e.n++; e.last = Math.max(e.last, l.t); errs.set(key, e); }
if (!errs.size) { say('ไม่มี'); say(); }
else table(['รุ่น · ข้อความ', 'ครั้ง', 'ล่าสุด'], [...errs].sort((a, b) => b[1].last - a[1].last).slice(0, 25).map(([k, e]) => [k.replace(/\|/g, '/'), e.n, ago(e.last)]));
say('บันทึกวัดความสว่างของจอ (ไม่ใช่ข้อผิดพลาด): ' + diag + ' รายการ • กดสนใจแพ็กเจ้าของค่ายบนเว็บ: ' + interest + ' ครั้ง'); say();

const text = out.join('\n'); console.log(text);
if (arg('--out')) { writeFileSync(arg('--out'), text + '\n'); console.error('written: ' + arg('--out')); }
