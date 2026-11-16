// Does the commentary fit the picture? Plays fights through the commentary the way the game does (the intro, the
// rounds, the corner scene between them, the raised hand), with the real clip lengths, and checks every line that
// would be spoken against what is on screen at that moment: the slip lines only for a slipped punch, "counted out"
// only after a count of ten, "round one" only in round one, the corner lines only while the towel is out, and so on.
// It also reports the editing: lines chopped by another line, scene lines that started late, the longest silence.
// Usage: node tools/commentary-check.mjs [fights=300] [firstSeed=1] [--script seed] [--lite] [--dir assets/voice]
//   --script seed: print everything said in that one fight, with the time and what triggered it
//   --lite: only the lines the claude.ai page carries (the short pack build.mjs makes)
import * as THREE from 'three';
globalThis.THREE = THREE;
import { existsSync, readFileSync } from 'node:fs';
const { simulate } = await import('../src/sim.js');
const { bake, evadePose } = await import('../src/timeline.js');
const { MOVES, RULES } = await import('../src/data.js');
const { LINES, FALLBACK, buildCommentary } = await import('../src/commentary.js');
const { CORNER_LEN, CORNER_SEAT } = await import('../src/corner.js').catch(() => ({CORNER_LEN: 11.7, CORNER_SEAT: 2.7}));

const flag = k => process.argv.includes('--' + k), opt = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const nums = process.argv.slice(2).filter(a => /^\d+$/.test(a) && process.argv[process.argv.indexOf(a) - 1] !== '--script');
const N = +(nums[0] || 300), S0 = +(nums[1] || 1), SCRIPT = opt('script', null), DIR = opt('dir', 'assets/voice');
// clip lengths: the recorded ones where the text matches, a guess from the length of the line otherwise
const man = existsSync(DIR + '/manifest.json') ? JSON.parse(readFileSync(DIR + '/manifest.json', 'utf8')) : {}, byText = {};
for (const v of Object.values(man)) if (v.s && (v.ok == null || v.ok >= .72)) byText[v.text] = v.s; // a clip that failed its check has a wrong length too
const letters = s => s.replace(/[^ก-ฺเ-็]/g, '').length;
const clipLen = (k, i) => { const t = LINES[k].t[i]; return Math.min(byText[t] || 9, .5 + letters(t) * .075 + (byText[t] ? .8 : 0)); }; // a recorded length far over the guess is a bad cut, not a slow read
// which lines exist: all of them, or the short pack (line 0 of every key that has no fallback, as build.mjs picks them)
const have = {}; for (const k in LINES) have[k] = flag('lite') ? (FALLBACK[k] ? 0 : 1) : LINES[k].t.length;

const FPS = 30, STAND = CORNER_LEN - 2.5, RAISE = 5.15, bad = [], stats = {lines: 0, fights: 0, speak: 0, time: 0, cut: 0, cutBy: {}, late: 0, lateMax: 0, lateSum: 0, lateBy: {}, gapMax: 0, used: {}};
const fail = (seed, t, key, text, why) => { if (bad.length < 40) bad.push(`seed ${seed} ${t.toFixed(1)}s  ${key} "${text}": ${why}`); stats.bad = (stats.bad || 0) + 1; };

function play(seed, print) {
  let rs = seed * 2654435761 >>> 0; Math.random = () => { rs = rs + 0x6D2B79F5 >>> 0; let t = Math.imul(rs ^ rs >>> 15, 1 | rs); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; // the commentary's own dice, the same every run
  const fight = simulate({seed}), TL = bake(fight), EV = fight.events, dtF = 1 / FPS;
  let now = 0, playT = 0, evi = 0, cur = null, speaking = null, scene = 'intro', round = 1, counted = 0, introSaid = false, lastEnd = 0, sceneAt = {};
  let seated = -9, leaving = false, restAt = -9, roundAt = -9, floor = null; // floor: a man is down, or the fight is decided
  const cornerEnd = st => now + (CORNER_LEN - CORNER_SEAT - st); // when the bell goes, from the seat clock
  const legs = [0, 0], lastBlow = [null, null], rests = EV.filter(e => e.type === 'phase' && e.phase === 'rest').map(e => e.t + 2.3);
  const introEnd = (EV.find(e => e.type === 'phase' && e.phase === 'fight') || {t: RULES.introTime}).t, over = (EV.find(e => e.type === 'phase' && e.phase === 'over') || {t: fight.duration}).t;
  const score = () => { const a = TL.val(0, playT, 8), b = TL.val(1, playT, 8); return {lead: a === b ? -1 : a > b ? 0 : 1, margin: Math.abs(a - b)}; };
  const audio = {on: true, hasVoice: k => have[k] > 0, voiceCount: k => have[k], voiceLen: (k, i) => clipLen(k, i), count() {},
    voice(k, i, cut) { if (cut && speaking && speaking.end > now + .15 && now - speaking.at < .25) stats.swap = (stats.swap || 0) + 1; else if (cut && speaking && speaking.end > now + .15) { stats.cut++; stats.cutBy[k] = (stats.cutBy[k] || 0) + 1; if (print) console.log(`          ^ cut "${speaking.text}" with ${(speaking.end - now).toFixed(1)}s left`); } return clipLen(k, i); }};
  const C = buildCommentary(audio, MOVES);
  C.log = (said, i, t, dur, key) => { // said: the key whose clip is played; key: the call that was asked for (they differ when a line is borrowed)
    const text = LINES[said].t[i], e = cur && cur.e, pose = cur && cur.pose, ck = TL.clock(playT), sc = score(), m = e && MOVES[e.move];
    const no = why => fail(seed, now, key, text, why), hit = e && e.type === 'hit' && e.res === 'hit', is = mv => hit && e.move === mv;
    stats.lines++; stats.speak += dur; stats.used[key] = (stats.used[key] || 0) + 1;
    if (said !== key && i !== 0) no('borrowed a line that is not the first of ' + said);
    if (now - lastEnd > stats.gapMax && scene === 'fight') stats.gapMax = now - lastEnd;
    if (sceneAt[said] != null) sceneAt[key] = sceneAt[said];
    if (sceneAt[key] != null) { const late = now - sceneAt[key]; if (late > .05) { stats.late++; stats.lateBy[key] = Math.max(stats.lateBy[key] || 0, late); stats.lateSum += late; stats.lateMax = Math.max(stats.lateMax, late); } sceneAt[key] = null; }
    speaking = {text, at: now, end: now + dur}; lastEnd = now + dur;
    if (print) console.log(`${now.toFixed(1).padStart(6)}s ${scene.padEnd(6)} R${ck.round} ${String(Math.ceil(ck.clock)).padStart(2)}  ${key.padEnd(14)} ${text}   ${e ? '<- ' + e.type + (e.move ? ' ' + e.move : '') + (e.res ? ' ' + e.res : '') + (pose ? ' (' + pose + ')' : '') + (e.reason ? ' ' + e.reason : '') : ''}`);
    // ---- is it true of the picture? ----
    if (floor && /^(feel|feel1|busy|close|lead|behind|timeLow)/.test(key)) no(floor === 'down' ? 'a man is down and being counted' : 'the fight is over');
    switch (key) {
      case 'intro': if (scene !== 'intro') no('not the wai kru'); break;
      case 'bell1': case 'round2': case 'round3': if (scene !== 'fight' || ck.round !== {bell1: 1, round2: 2, round3: 3}[key] || now - roundAt > 3.5) no('not the start of that round'); break;
      case 'rest': if (now - restAt > 3.5) no('not the end of a round'); break;
      case 'corner': if (scene !== 'corner' || seated < .5 || seated > 3 || leaving) no('not over the drink and the towel'); if (now + dur > cornerEnd(seated) - 2.4) no('still talking when they stand up'); break;
      case 'cornerOut': if (scene !== 'corner' || !leaving) no('they are not getting up'); break;
      case 'intro0': break;
      case 'feel1': if (scene !== 'fight' || ck.round !== 1) no('not round one'); break;
      case 'feel': case 'busy': if (scene !== 'fight') no('not during a round'); break;
      case 'timeLow10': if (ck.clock > 10.5 || ck.clock < 8) no('the clock reads ' + ck.clock.toFixed(1)); break;
      case 'timeLow': if (ck.clock > 10.5 || ck.clock < 4) no('the clock reads ' + ck.clock.toFixed(1)); break;
      case 'leadRed': case 'leadBlue': if (sc.lead !== (key === 'leadRed' ? 0 : 1)) no('that corner is not ahead'); break;
      case 'behindRed': case 'behindBlue': if (sc.lead !== (key === 'behindRed' ? 1 : 0) || ck.round !== 3) no('that corner is not behind in the last round'); break;
      case 'close': if (sc.margin >= 3.5) no('the margin is ' + sc.margin.toFixed(1)); break;
      case 'punch': if (!(hit && (e.move === 'jab' || e.move === 'cross'))) no('not a straight punch to the head'); break;
      case 'hook': case 'upper': case 'knee': case 'teep': case 'teepFace': case 'clinchKnee': case 'clinchKneeHead': case 'clinchElbow':
      case 'spChop': case 'spKick': case 'spFly': case 'spCroc': case 'spHanu': if (!is(key)) no('the blow is ' + (e && e.move)); break;
      case 'bodyPunch': if (!(hit && m.lvl === 'body' && m.sfx === 'punch')) no('not a punch to the body'); break;
      case 'catchHit': if (!(is('catchPunch') || is('catchBody'))) no('no caught leg'); break;
      case 'elbow': if (!(hit && m.sfx === 'elbow' && !m.inClinch)) no('not an elbow in the open'); break;
      case 'bodyKick': if (!is('body')) no('the blow is ' + (e && e.move)); break;
      case 'highKick': if (!is('high')) no('the blow is ' + (e && e.move)); break;
      case 'lowKick': if (!is('low')) no('the blow is ' + (e && e.move)); break;
      case 'lowKickMore': if (!is('low') || legs[e.on] < 3) no('not a third leg kick'); break;
      case 'counter': if (!(hit && e.counter)) no('not a counter'); break;
      case 'combo': if (!(hit && e.chain === 3)) no('not the third blow of a chain'); break;
      case 'special': if (!(hit && e.special)) no('not a trick that landed'); break;
      case 'bigHit': if (!(hit && e.sev >= 3)) no('not a heavy blow'); break;
      case 'block': if (!(e && e.res === 'block' && e.special && m.lvl === 'head')) no('not arms up against a trick'); break;
      case 'check': if (!(e && e.res === 'block' && (e.move === 'body' || e.move === 'low'))) no('no lifted knee'); break;
      case 'leanBack': if (pose !== 'leanBack') no('the pose is ' + pose); break;
      case 'duck': if (pose !== 'duck') no('the pose is ' + pose); break;
      case 'slip': if (!(pose === 'slipL' || pose === 'slipR') || m.sfx !== 'punch') no('the pose is ' + pose + ' from ' + (e && e.move)); break;
      case 'bellyKick': if (pose !== 'hipBack' || e.move !== 'body') no('the pose is ' + pose + ' from ' + (e && e.move)); break;
      case 'bellyBack': if (pose !== 'hipBack') no('the pose is ' + pose); break;
      case 'dodge': if (pose !== 'dodge') no('the pose is ' + pose); break;
      case 'catch': if (!(e && e.res === 'catch' && e.move === 'body')) no('no kick caught'); break;
      case 'clinch': if (!(e && e.type === 'clinch')) no('no clinch'); break;
      case 'separate': if (!(e && e.type === 'break' && e.reason !== 'elbow' && e.reason !== 'escape')) no('the referee did not part them'); break;
      case 'escape': if (!(e && e.type === 'break' && e.reason === 'escape')) no('nobody shook free'); break;
      case 'elbowOut': if (!(e && e.type === 'break' && e.reason === 'elbow')) no('no elbow out of the clinch'); break;
      case 'throw': if (!(e && e.type === 'throw' && e.ok && !e.teep)) no('no throw'); break;
      case 'throwFail': if (!(e && e.type === 'throw' && !e.ok)) no('the throw did not fail'); break;
      case 'teepDump': if (!(e && e.type === 'throw' && e.ok && e.teep)) no('nobody was pushed over'); break;
      case 'stunPunch': if (!(e && e.type === 'stun' && MOVES[lastBlow[e.on]] && MOVES[lastBlow[e.on]].sfx === 'punch')) no('not dazed by a punch'); break;
      case 'stun': if (!(e && e.type === 'stun')) no('nobody is dazed'); break;
      case 'stunEnd': if (!(e && e.type === 'stun_end')) no('nobody recovered'); break;
      case 'kd': if (!(e && e.type === 'kd')) no('no knockdown'); break;
      case 'getup': if (!(e && e.type === 'getup' && !e.thrown)) no('nobody beat the count'); break;
      case 'ko': if (!(e && e.type === 'ko' && counted >= 10)) no('not counted out (count ' + counted + ')'); break;
      case 'koFlash': if (!(e && e.type === 'ko' && counted < 10 && e.how !== 'ทีเคโอ')) no('not out on the blow'); break;
      case 'tko': if (!(e && e.type === 'ko' && e.how === 'ทีเคโอ')) no('not a third knockdown'); break;
      case 'decWait': if (scene !== 'dec') no('not waiting for the cards'); break;
      case 'decRed': case 'decBlue': if (fight.result.how !== 'คะแนน' || fight.result.w !== (key === 'decRed' ? 0 : 1)) no('wrong winner on points'); break;
      case 'winRed': case 'winBlue': if (scene !== 'cer' || fight.result.w !== (key === 'winRed' ? 0 : 1)) no('wrong winner or no raised hand'); break;
    }
  };
  const handle = e => {
    if (e.type === 'phase') { if (e.phase === 'fight') { scene = 'fight'; round = e.round; roundAt = now; sceneAt[['bell1', 'round2', 'round3'][e.round - 1]] = now; } else if (e.phase === 'rest') { scene = 'rest'; restAt = now; sceneAt.rest = now; } else if (e.phase === 'dec') { scene = 'dec'; sceneAt.decWait = now; } }
    if (e.type === 'decision') sceneAt[e.w ? 'decBlue' : 'decRed'] = now;
    if (e.type === 'kd') { counted = 0; floor = 'down'; } if (e.type === 'count') counted = e.n;
    if (e.type === 'getup' || (e.type === 'phase' && e.phase === 'fight')) floor = null; if (e.type === 'ko' || e.type === 'decision') floor = 'over';
    if (e.type === 'hit' && e.res === 'hit') { if (e.move === 'low') legs[e.on]++; }
    cur = {e, pose: e.type === 'hit' && e.res === 'dodge' ? evadePose(e, fight.dt) : null};
    C.event(e, now, cur.pose); cur = null;
    if (e.type === 'hit' && e.res === 'hit') lastBlow[e.on] = e.move;
  };
  while (playT < over) {
    const target = playT + dtF, rb = rests.findIndex(p => playT < p && target >= p);
    if (rb >= 0) { // the corner scene: the fight waits, the scene runs on its own clock (auto-continue: up at STAND)
      while (evi < EV.length && EV[evi].t <= rests[rb]) handle(EV[evi++]);
      playT = rests[rb]; scene = 'corner';
      for (let ct = 0; ct < CORNER_LEN; ct += dtF) { now += dtF; seated = ct - CORNER_SEAT; leaving = ct >= STAND; C.corner(seated, STAND - ct, now, score()); }
      seated = -9; leaving = false; scene = 'rest'; rests[rb] = -1; continue;
    }
    playT = target; now += dtF;
    while (evi < EV.length && EV[evi].t <= playT) handle(EV[evi++]);
    const ck = TL.clock(playT), phase = playT <= introEnd ? 'intro' : ck.clock <= 0 ? 'rest' : 'fight';
    if (phase === 'intro' && !introSaid && playT > .6) { introSaid = true; sceneAt.intro = now; C.intro(now); }
    if (phase === 'fight' && scene === 'fight') C.update(now, Object.assign({fighting: true, pace: TL.pace(playT), clock: ck.clock}, score())); else C.tick(now);
  }
  scene = 'cer'; let raised = false; // the referee raises the winner's hand
  for (let s = 0; s < 9; s += dtF) { now += dtF; if (!raised && s >= RAISE) { raised = true; sceneAt[fight.result.w ? 'winBlue' : 'winRed'] = now; C.win(fight.result.w, now); } C.tick(now); }
  stats.fights++; stats.time += now;
}

if (SCRIPT != null) play(+SCRIPT, true);
else {
  for (let i = 0; i < N; i++) play(S0 + i, false);
  const never = Object.keys(LINES).filter(k => !stats.used[k] && have[k]);
  console.log(`${stats.fights} fights${flag('lite') ? ' (short pack)' : ''}: ${(stats.lines / stats.fights).toFixed(1)} lines a fight, speaking ${(100 * stats.speak / stats.time).toFixed(0)}% of the time, longest silence in a round ${stats.gapMax.toFixed(1)} s`);
  console.log(`editing: ${stats.cut} lines broken into mid-sentence (by ${Object.entries(stats.cutBy).map(([k, n]) => k + ' ' + n).join(', ') || 'none'}), ${stats.swap || 0} replaced before a word was out`);
  console.log(`scene lines that waited for a sentence to end: ${stats.late} of ${stats.fights} fights, ${(stats.lateSum / Math.max(1, stats.late)).toFixed(1)} s on average; longest by line: ${Object.entries(stats.lateBy).map(([k, v]) => k + ' ' + v.toFixed(1)).join(', ') || 'none'}`);
  console.log('calls a fight: ' + Object.entries(stats.used).sort((a, b) => b[1] - a[1]).map(([k, n]) => k + ' ' + (n / stats.fights).toFixed(2)).join(', '));
  if (never.length) console.log('never said in these fights: ' + never.join(', '));
  console.log(bad.length ? `FAIL: ${stats.bad} lines do not fit the picture\n` + bad.join('\n') : 'PASS: every line fits the picture');
  process.exit(bad.length ? 1 : 0);
}
