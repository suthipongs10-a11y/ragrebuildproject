// Quick look at how runs go with the random bot. Full balance reports arrive in M5.
import { loadContent } from '../src/data/content';
import { playRun, randomBot, type Bot } from '../src/sim/bots/randomBot';
import { smartBot } from '../src/sim/bots/smartBot';

const RUNS = 1000;
const MAX_ACTIONS = 4000;

const content = loadContent();
const bots: Array<[string, Bot]> = [['random', randomBot], ['smart', smartBot]];
for (const [name, bot] of bots) {
  for (const leader of Object.keys(content.leaders)) {
    let won = 0;
    let turns = 0;
    const endLap = new Map<number, number>();
    for (let seed = 1; seed <= RUNS; seed++) {
      const run = playRun(content, seed, bot, MAX_ACTIONS, undefined, leader);
      if (run.result === 'won') won++;
      else endLap.set(run.lap, (endLap.get(run.lap) ?? 0) + 1);
      turns += run.turns;
    }
    const losses = [...endLap].sort((a, b) => a[0] - b[0]).map(([lap, count]) => `lap ${lap}: ${count}`).join(', ');
    console.log(`${name.padEnd(6)} ${leader.padEnd(8)} won ${((won / RUNS) * 100).toFixed(1).padStart(5)}%  avg ${(turns / RUNS).toFixed(1)} turns  lost on ${losses || '-'}`);
  }
}
