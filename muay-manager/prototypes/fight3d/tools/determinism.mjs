// Same seed must give the same fight, byte for byte. Usage: node tools/determinism.mjs
import { simulate } from '../src/sim.js';
import { createHash } from 'node:crypto';

const digest = f => createHash('sha1').update(JSON.stringify(f.events)).update(JSON.stringify(f.poses)).update(Buffer.from(f.ticks.buffer)).digest('hex');
let bad = 0;
for (let seed = 1; seed <= 200; seed++) {
  const a = digest(simulate({seed})), b = digest(simulate({seed}));
  if (a !== b) { bad++; console.log('MISMATCH seed', seed); }
}
const differ = digest(simulate({seed: 1})) !== digest(simulate({seed: 2}));
console.log(bad === 0 && differ ? 'PASS: 200 seeds reproduce exactly, different seeds differ' : 'FAIL');
process.exit(bad === 0 && differ ? 0 : 1);
