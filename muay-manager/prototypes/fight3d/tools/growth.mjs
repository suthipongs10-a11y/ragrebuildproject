// Does training pay off? Win rate of a fighter whose stats are higher than an otherwise identical opponent.
// Usage: node tools/growth.mjs [fights=400]
import { simulate } from '../src/sim.js';
import { STYLES, RULES } from '../src/data.js';
if (process.env.RULES) Object.assign(RULES, JSON.parse(process.env.RULES));
const N = +(process.argv[2] || 400), mk = v => ({pow: v, kick: v, spd: v, def: v, end: v, chin: v});
const spec = (style, v, name) => ({name, first: name, style, stats: typeof v === 'number' ? mk(v) : v, skin: 0});
function rate(a, b) { let w = 0; for (let i = 0; i < N; i++) { const flip = i % 2; if (simulate({seed: 9000 + i, specs: flip ? [b, a] : [a, b]}).result.w === (flip ? 1 : 0)) w++; } return (w / N * 100).toFixed(0) + '%'; }
const out = {};
for (const s of STYLES) out[s.th] = {'+5%': rate(spec(s.id, 63, 'A'), spec(s.id, 60, 'B')), '+10%': rate(spec(s.id, 66, 'A'), spec(s.id, 60, 'B')), '+20%': rate(spec(s.id, 72, 'A'), spec(s.id, 60, 'B')), '+35%': rate(spec(s.id, 81, 'A'), spec(s.id, 60, 'B'))};
console.table(out);
const one = {};
for (const k of ['pow', 'kick', 'spd', 'def', 'end', 'chin']) { const st = mk(60); st[k] = 80; one[k + ' 80 vs 60'] = rate(spec('tech', st, 'A'), spec('tech', 60, 'B')); }
console.log('one stat raised, same style (tech):', one);
