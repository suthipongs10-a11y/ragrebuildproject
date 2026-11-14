// Mass simulation report. Usage: node tools/batch.mjs [fights=2000] [firstSeed=1]
import { simulate } from '../src/sim.js';
import { RULES } from '../src/data.js';
if (process.env.RULES) Object.assign(RULES, JSON.parse(process.env.RULES)); // quick what-if runs

const N = +(process.argv[2] || 2000), S0 = +(process.argv[3] || 1);
const out = {r1: 0, r2: 0, r3: 0, dec: 0, ko: 0, tko: 0, kd: 0, stun: 0, fightsWithStun: 0, stunSurvived: 0, specials: 0, specialHits: 0,
  combos3: 0, kinds: 0, guards: 0, teeps: 0, dur: 0, leadChanges: 0, close: 0, favWins: 0, favN: 0, maxGap: 0};
// pace: strikes thrown in each half of each round (both fighters), light touches, knockdowns per round
const half = [0, 0, 0, 0, 0, 0], lightN = [0, 0, 0], kdR = [0, 0, 0], halfN = [0, 0, 0, 0, 0, 0];
const t0 = Date.now();
for (let i = 0; i < N; i++) {
  const f = simulate({seed: S0 + i}), r = f.result;
  if (r.how === 'คะแนน') { out.dec++; if (Math.abs(r.pts[0] - r.pts[1]) / Math.max(r.pts[0], r.pts[1]) < .1) out.close++; }
  else { out['r' + r.round]++; out[r.how === 'น็อก' ? 'ko' : 'tko']++; }
  out.guards += r.guards[0] + r.guards[1]; out.teeps += (r.used[0].teep || 0) + (r.used[1].teep || 0) + (r.used[0].teepFace || 0) + (r.used[1].teepFace || 0);
  out.kd += r.kd[0] + r.kd[1]; out.dur += f.duration; out.leadChanges += r.leadChanges;
  out.kinds += (Object.keys(r.used[0]).length + Object.keys(r.used[1]).length) / 2;
  let stuns = 0, lastHit = 0, gap = 0, inFight = false;
  let rnd = 1, rt0 = 0;
  const stunOpen = {};
  for (const e of f.events) {
    if (e.type === 'stun') { stuns++; stunOpen[e.on] = true; }
    if (e.type === 'stun_end' && stunOpen[e.on]) { out.stunSurvived++; stunOpen[e.on] = false; }
    if (e.type === 'move' && e.special) out.specials++;
    if (e.type === 'hit' && e.special && e.res === 'hit') out.specialHits++;
    if (e.type === 'hit' && e.res === 'hit' && e.chain === 3) out.combos3++;
    if (e.type === 'phase') { inFight = e.phase === 'fight'; lastHit = e.t; if (inFight) { rnd = e.round || rnd; rt0 = e.t; for (let h = 0; h < 2; h++) if (rnd <= 3) halfN[(rnd - 1) * 2 + h]++; } }
    if (e.type === 'move' && inFight && rnd <= 3) { half[(rnd - 1) * 2 + (e.t - rt0 > RULES.roundTime / 2 ? 1 : 0)]++; if (e.light) lightN[rnd - 1]++; }
    if (e.type === 'kd' && rnd <= 3) kdR[rnd - 1]++;
    if (e.type === 'phase') { inFight = e.phase === 'fight'; lastHit = e.t; }
    if (e.type === 'count') lastHit = e.t;
    if (e.type === 'hit' && e.res === 'hit' && inFight) { gap = Math.max(gap, e.t - lastHit); lastHit = e.t; }
  }
  out.stun += stuns; if (stuns) out.fightsWithStun++; out.maxGap += gap;
  const sum = s => Object.values(s.stats).reduce((a, b) => a + b, 0), sa = sum(f.specs[0]), sb = sum(f.specs[1]);
  if (Math.abs(sa - sb) / Math.min(sa, sb) >= .1) { out.favN++; if ((sa > sb ? 0 : 1) === r.w) out.favWins++; }
}
const pc = v => (v / N * 100).toFixed(1) + '%', av = v => (v / N).toFixed(2);
console.log(`fights ${N} (seed ${S0}..${S0 + N - 1}) in ${Date.now() - t0} ms`);
console.table(Object.fromEntries([1, 2, 3].map(r => ['ยก ' + r, {'ท่าครึ่งแรก': (half[(r - 1) * 2] / Math.max(1, halfN[(r - 1) * 2])).toFixed(1), 'ท่าครึ่งหลัง': (half[r * 2 - 1] / Math.max(1, halfN[r * 2 - 1])).toFixed(1), 'แตะเบา': (lightN[r - 1] / Math.max(1, halfN[(r - 1) * 2])).toFixed(1), 'ล้ม': (kdR[r - 1] / N).toFixed(2)}])));
console.table({
  'จบยก 1 (เป้า ~15%)': pc(out.r1), 'จบยก 2 (เป้า ~25%)': pc(out.r2), 'จบยก 3 (เป้า ~25%)': pc(out.r3), 'ตัดสินคะแนน (เป้า ~35%)': pc(out.dec),
  'น็อก / ทีเคโอ': out.ko + ' / ' + out.tko, 'ล้มต่อไฟต์ (เป้า ≤1)': av(out.kd),
  'ฝั่งค่าพลังสูงกว่า 10% ชนะ (เป้า 65-70%)': out.favN ? (out.favWins / out.favN * 100).toFixed(1) + '% จาก ' + out.favN : '-',
  'ไฟต์ที่มีเมาหมัด (เป้า ≥60%)': pc(out.fightsWithStun), 'เมาหมัดต่อไฟต์': av(out.stun), 'เมาหมัดแล้วรอด (เป้า ~50%)': out.stun ? (out.stunSurvived / out.stun * 100).toFixed(1) + '%' : '-',
  'ท่าต่างชนิดต่อนักมวย': av(out.kinds), 'ตั้งการ์ดรับต่อไฟต์': av(out.guards), 'ถีบต่อไฟต์': av(out.teeps), 'ชุด 3 จังหวะต่อไฟต์ (เป้า 3-6)': av(out.combos3),
  'ท่าไม้ตายต่อไฟต์ (เป้า 2-4)': av(out.specials), 'ท่าไม้ตายเข้าเป้า (เป้า ~50%)': out.specials ? (out.specialHits / out.specials * 100).toFixed(1) + '%' : '-',
  'ผู้นำคะแนนเปลี่ยนต่อไฟต์ (เป้า ≥1)': av(out.leadChanges), 'ช่วงเงียบยาวสุดเฉลี่ย วินาที (เป้า ≤5)': av(out.maxGap),
  'ไฟต์คะแนนที่ห่างไม่เกิน 10%': out.dec ? (out.close / out.dec * 100).toFixed(1) + '%' : '-', 'ความยาวไฟต์เฉลี่ย วินาที': av(out.dur)
});
