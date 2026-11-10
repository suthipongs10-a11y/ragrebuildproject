// Finds seeds with a dramatic arc, for demo defaults. Usage: node tools/findseed.mjs [count]
import { simulate } from '../src/sim.js';
const out = [];
for (let seed = 1; seed <= +(process.argv[2] || 3000); seed++) {
  const f = simulate({seed}), r = f.result, ev = f.events;
  const spHit = ev.filter(e => e.type === 'hit' && e.special && e.res === 'hit').length;
  const stun = ev.filter(e => e.type === 'stun').length, getup = ev.filter(e => e.type === 'getup').length;
  const ko = ev.find(e => e.type === 'ko'), koHit = ko && ev.find(e => e.type === 'hit' && e.t === ko.t);
  if (r.how === 'น็อก' && r.round >= 2 && koHit && koHit.special && getup >= 1 && stun >= 1 && spHit >= 2 && r.leadChanges >= 1 && f.specs[0].style !== f.specs[1].style)
    out.push(`${seed} R${r.round} ${f.specs[0].style} v ${f.specs[1].style} winner ${r.w} by ${r.move} kd ${r.kd} sp ${spHit} stun ${stun} lead ${r.leadChanges}`);
}
console.log(out.slice(0, 15).join('\n'));
