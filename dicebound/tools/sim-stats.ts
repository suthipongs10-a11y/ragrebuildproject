// Quick look at how runs go with the random bot. Full balance reports arrive in M5.
import { loadContent } from '../src/data/content';
import { playRun, randomBot } from '../src/sim/bots/randomBot';

const RUNS = 1000;
const MAX_ACTIONS = 2000;

const content = loadContent();
const started = performance.now();
let won = 0;
let turns = 0;
const endLap = new Map<number, number>();
for (let seed = 1; seed <= RUNS; seed++) {
  const run = playRun(content, seed, randomBot, MAX_ACTIONS);
  if (run.result === 'won') won++;
  else endLap.set(run.lap, (endLap.get(run.lap) ?? 0) + 1);
  turns += run.turns;
}
const seconds = ((performance.now() - started) / 1000).toFixed(2);
console.log(`${RUNS} random-bot runs in ${seconds}s`);
console.log(`  won ${won} (${((won / RUNS) * 100).toFixed(1)}%), average ${(turns / RUNS).toFixed(1)} turns`);
for (const [lap, count] of [...endLap].sort((a, b) => a[0] - b[0])) console.log(`  lost on lap ${lap}: ${count}`);
