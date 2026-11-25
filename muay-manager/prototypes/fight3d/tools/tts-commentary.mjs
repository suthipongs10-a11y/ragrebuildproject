// Records the commentary, the referee's count and the crowd shouts with Gemini 3.8 TTS (Thai) into assets/voice/*.mp3.
// The free tier allows ten requests a day, so many lines go in one request: every line is its own turn with its own
// style (calm, excited, shouting), and up to two voices share a request. The recording is cut into pieces at every
// silence, a second Gemini model writes down what each piece says, and the pieces are matched to the lines by their
// words (a shouted line often has a pause inside it as long as the pause after it, so silence alone cannot tell).
// A line whose pieces do not say its words is recorded again (three takes, the best one is kept).
// A clip is only recorded again when its text, voice or style changed (manifest.json in the folder keeps track),
// so a rerun costs nothing. Every recording stays in _takes with what was heard in it: one that was not cut up yet
// (the run stopped, or the listener's quota ran out) is cut up by the next run without asking for it again.
// The listener matters as much as the voice: gemini-3-flash-preview hears short shouted Thai right, gemini-3.5-flash
// and gemini-2.5-flash drop words, and lines matched on a bad transcript come out shifted. So there is no fallback:
// when the listener's daily quota (20 requests on the free tier) is gone the run stops and waits.
// --lang en|zh: the commentator in English or Mandarin (src/lang/voice-<lang>.json, the same keys and number of lines as
// LINES) into assets/voice-<lang>/; the referee's count and the crowd's shouts stay in Thai (the Thai clips are used).
// Usage: node tools/tts-commentary.mjs [--lang th|en|zh] [--model gemini-3.8-flash-tts] [--ear model,model] [--dir assets/voice]
//          [--only key,key] [--redo name,name|all] [--limit clips] [--batch 28] [--gap 13] [--keep-doubt] [--recheck]
//   --recheck: first listen again to every clip that a listener not on the --ear list passed (or that nobody heard)
// Needs ffmpeg and GEMINI_API_KEY (a Google AI Studio key; never put it in the repo).
// Thai is on the language list of gemini-3.8-flash-tts only; the lite model speaks it but is not listed for it.
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, rmSync, readdirSync, unlinkSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { LINES, COUNT, SHOUT, VOICES, STYLE } from '../src/commentary.js';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const LANG = arg('lang', 'th'), LNAME = {th: 'Thai', en: 'English', zh: 'Mandarin Chinese'}[LANG];
if (!LNAME) { console.log('--lang th, en or zh'); process.exit(1); }
const SAY = LANG === 'th' ? null : JSON.parse(readFileSync(new URL('../src/lang/voice-' + LANG + '.json', import.meta.url), 'utf8'));
const list = k => arg(k, '') ? arg(k).split(',') : null;
const MODEL = arg('model', 'gemini-3.8-flash-tts'), EARS = list('ear') || ['gemini-3-flash-preview'], ONLY = list('only'), REDO = list('redo') || [];
const LIMIT = +arg('limit', 1e9), BATCH = +arg('batch', 28), GAP = +arg('gap', 13), DIR = arg('dir', LANG === 'th' ? 'assets/voice' : 'assets/voice-' + LANG), MAN = DIR + '/manifest.json', TMP = DIR + '/_tmp', TAKE = DIR + '/_takes';
const KEY = process.env.GEMINI_API_KEY;
if (!KEY) { console.log('set GEMINI_API_KEY'); process.exit(1); }
const TAKES = 3, PASS = .72, HEAR = 20, API = 'https://generativelanguage.googleapis.com/v1beta/';
const LOUD = {0: -18, 1: -16, 2: -14.5, count: -16, shout: -16}; // shouting plays louder than a calm read
mkdirSync(TMP, {recursive: true}); mkdirSync(TAKE, {recursive: true});
const man = existsSync(MAN) ? JSON.parse(readFileSync(MAN, 'utf8')) : {};

let jobs = [];
for (const [key, L] of Object.entries(LINES)) (SAY ? SAY[key] || [] : L.t).forEach((t, i) => jobs.push({name: key + '-' + i, key, text: t, voice: VOICES.caller, style: L.hot}));
if (!SAY) COUNT.forEach((t, i) => jobs.push({name: 'count-' + i, key: 'count', text: t, voice: VOICES.referee, style: 'count'}));
if (!SAY) SHOUT.forEach((t, i) => VOICES.crowd.forEach((v, j) => jobs.push({name: 'shout' + i + '-' + j, key: 'shout' + i, text: t, voice: v, style: 'shout'})));
if (ONLY) jobs = jobs.filter(j => ONLY.includes(j.key));
const styleOf = k => (SAY ? STYLE[k].replace('Thai boxing TV commentator', `Muay Thai TV commentator speaking ${LNAME}`) : STYLE[k]);
for (const J of jobs) J.h = createHash('sha1').update(JSON.stringify([J.text, J.voice, styleOf(J.style)])).digest('hex').slice(0, 12);
const KEEP = process.argv.includes('--keep-doubt');
const done = J => man[J.name] && man[J.name].h === J.h && existsSync(`${DIR}/${J.name}.mp3`) && (KEEP || man[J.name].ok == null || man[J.name].ok >= PASS);
const redo = J => REDO.includes(J.name) || REDO[0] === 'all';
// The script moves: a line may change key or place while its words, voice and style stay the same. Such a clip is
// carried over under its new name rather than recorded again, and clips whose line is gone are removed.
if (!ONLY) {
  const file = nm => `${DIR}/${nm}.mp3`, pool = {};
  for (const [nm, v] of Object.entries(man)) if (v.h && (v.ok == null || v.ok >= PASS) && existsSync(file(nm))) pool[v.h] = {buf: readFileSync(file(nm)), v};
  let moved = 0, gone = 0;
  for (const J of jobs) if (!(man[J.name] && man[J.name].h === J.h && existsSync(file(J.name)) && (man[J.name].ok == null || man[J.name].ok >= PASS)) && pool[J.h]) { J.adopt = pool[J.h]; moved++; }
  for (const J of jobs) if (J.adopt) { writeFileSync(file(J.name), J.adopt.buf); man[J.name] = Object.assign({}, J.adopt.v, {text: J.text}); }
  const names = new Set(jobs.map(J => J.name));
  for (const f of readdirSync(DIR).filter(f => f.endsWith('.mp3'))) if (!names.has(f.slice(0, -4))) { unlinkSync(`${DIR}/${f}`); gone++; }
  for (const nm of Object.keys(man)) if (!names.has(nm)) delete man[nm];
  if (moved || gone) { writeFileSync(MAN, JSON.stringify(man, null, 1)); console.log(`  ${moved} clips carried over to a new name, ${gone} clips of lines no longer in the script removed`); }
}
// Requests: the busiest voice in runs of BATCH lines, and each of the other voices rides along as a request's second voice
function pack(js) {
  const by = {}; for (const J of js) (by[J.voice] = by[J.voice] || []).push(J);
  const groups = Object.values(by).sort((a, b) => b.length - a.length), reqs = [];
  if (groups.length) for (let i = 0; i < groups[0].length; i += BATCH) reqs.push({jobs: groups[0].slice(i, i + BATCH), voices: 1});
  for (const g of groups.slice(1)) { const r = reqs.find(r => r.voices < 2); if (r) { r.jobs = r.jobs.concat(g); r.voices++; } else reqs.push({jobs: g, voices: 1}); }
  return reqs.map(r => r.jobs);
}

const sleep = ms => new Promise(ok => setTimeout(ok, ms));
const lastCall = {};
let calls = 0, tokIn = 0, tokOut = 0;
// one request, paced so a model is not asked more often than every GAP seconds; waits out a per-minute limit, a day's quota is an error
async function ask(model, path, body) {
  for (let tries = 0; tries < 6; tries++) {
    const wait = (lastCall[model] || 0) + GAP * 1000 - Date.now(); if (wait > 0) await sleep(wait);
    lastCall[model] = Date.now(); calls++;
    let r; try { r = await fetch(API + path, {signal: AbortSignal.timeout(300000), method: 'POST', headers: {'Content-Type': 'application/json', 'x-goog-api-key': KEY}, body: JSON.stringify(body)}); }
    catch (e) { console.log(`  ${model}: ${e.message}, again`); continue; }
    if (r.status === 429 || r.status >= 500) {
      const t = await r.text(), m = /retry in (?:(\d+)h)?(?:(\d+)m)?([\d.]+)s/.exec(t), hold = m ? (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + Math.ceil(+m[3]) + 2 : 25 * (tries + 1);
      if (/per day|PerDay|daily/i.test(t) || hold > 600) throw Object.assign(new Error(`${model}: the day's quota is used up (${(/limit: \d+[^.)]*/.exec(t) || [''])[0]}), back in ${(hold / 3600).toFixed(1)} h`), {daily: true});
      console.log(`  ${model}: ${r.status}, waiting ${hold}s`); await sleep(hold * 1000); continue;
    }
    if (!r.ok) throw new Error(model + ': HTTP ' + r.status + ' ' + (await r.text()).slice(0, 300));
    const d = await r.json(), u = d.usage || d.usageMetadata || {}; tokIn += u.total_input_tokens || u.promptTokenCount || 0; tokOut += u.total_output_tokens || u.candidatesTokenCount || 0;
    return d;
  }
  throw new Error(model + ': gave up');
}
// Every line is a turn of its own: the words only, its style beside it, and a long pause after it to cut on
async function speak(B) {
  const voices = [...new Set(B.map(J => J.voice))], two = voices.length > 1;
  const content = B.map(J => ({type: 'text', text: J.text + ' <long pause> <long pause>', annotations: [{type: 'speech_metadata', ...(two ? {speaker: J.voice} : {}), style: styleOf(J.style)}]}));
  const d = await ask(MODEL, 'interactions', {model: MODEL, input: [{type: 'user_input', content}], response_format: {type: 'audio'},
    generation_config: {speech_config: two ? {speakers: voices.map(v => ({speaker: v, voice: v}))} : [{voice: voices[0]}]}});
  const au = (d.steps || []).filter(s => s.type === 'model_output').flatMap(s => s.content || []).filter(c => c.type === 'audio').pop(); if (!au) return null;
  const mime = au.mime_type || '', raw = TMP + '/take.bin', id = `${TAKE}/${Date.now()}`; writeFileSync(raw, Buffer.from(au.data, 'base64'));
  execFileSync('ffmpeg', ['-v', 'error', '-y', ...(/l16|pcm/i.test(mime) ? ['-f', 's16le', '-ar', (/rate=(\d+)/.exec(mime) || [])[1] || '24000', '-ac', '1'] : []), '-i', raw, id + '.wav']);
  writeFileSync(id + '.json', JSON.stringify(B.map(J => J.name))); // kept until its lines are cut out, so a crash never costs a request
  return id;
}
// the stretches of sound between silences
function pieces(wav) {
  const det = spawnSync('ffmpeg', ['-i', wav, '-af', 'silencedetect=noise=-38dB:d=0.2', '-f', 'null', '-']).stderr.toString();
  const m = /Duration: (\d+):(\d+):([\d.]+)/.exec(det), dur = +m[1] * 3600 + +m[2] * 60 + +m[3];
  const st = [...det.matchAll(/silence_start: ([\d.]+)/g)].map(x => +x[1]), en = [...det.matchAll(/silence_end: ([\d.]+)/g)].map(x => +x[1]);
  const P = []; let a = 0;
  st.forEach((s, i) => { if (s - a > .08) P.push([a, s]); a = en[i] ?? dur; });
  if (dur - a > .08) P.push([a, dur]);
  return P;
}
// Which pieces make which line: lines take one or more pieces in order so that the words heard match the lines best;
// a long silence before a piece makes it a likelier start of a line. The voice sometimes skips a line or adds words of
// its own, so a line may get no piece (it is recorded again) and a piece may belong to no line (it is left out);
// without those two ways out one slip shifts every line after it.
function align(P, heard, B) {
  const n = B.length, m = P.length, gap = j => j ? P[j][0] - P[j - 1][1] : 9, NEG = -1e9, MISS = .25;
  const best = Array.from({length: n + 1}, () => new Array(m + 1).fill(NEG)), how = Array.from({length: n + 1}, () => new Array(m + 1).fill(null));
  best[0][0] = 0;
  for (let i = 0; i <= n; i++) for (let k = 0; k <= m; k++) {
    if (i && best[i - 1][k] - MISS > best[i][k]) { best[i][k] = best[i - 1][k] - MISS; how[i][k] = 'line'; }                       // line i was never said
    if (k && best[i][k - 1] - (bare(heard[k - 1]) ? MISS : 0) > best[i][k]) { best[i][k] = best[i][k - 1] - (bare(heard[k - 1]) ? MISS : 0); how[i][k] = 'piece'; } // piece k-1 is nobody's
    if (i) for (let j = Math.max(0, k - 6); j < k; j++) {
      if (best[i - 1][j] === NEG) continue;
      const v = best[i - 1][j] + alike(heard.slice(j, k).join(''), B[i - 1].text) + .1 * Math.min(1, gap(j));
      if (v > best[i][k]) { best[i][k] = v; how[i][k] = j; }
    }
  }
  const out = []; let i = n, k = m;
  while (i > 0 || k > 0) {
    const h = how[i][k];
    if (h === 'line') { out.unshift(null); i--; }
    else if (h === 'piece') k--;
    else { const w = heard.slice(h, k).join(' ').trim(); out.unshift({a: P[h][0], b: P[k - 1][1], heard: w, score: alike(w, B[i - 1].text)}); k = h; i--; }
  }
  return out;
}
// trim the silence at both ends, level it, and keep it small: mono 22 kHz MP3 at 32 kbit/s
function clip(wav, a, b, J, out) {
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(Math.max(0, a - .1)), '-to', String(b + .15), '-i', wav,
    '-af', `silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,loudnorm=I=${LOUD[J.style]}:TP=-1.5`, '-ac', '1', '-ar', '22050', '-b:a', '32k', out]);
  try { return +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out], {stdio: ['ignore', 'pipe', 'ignore']}).toString() || 0; } catch { return 0; }
}
// A second model writes down what each clip says, HEAR clips to a request.
// A listener that misses one clip numbers every clip after it wrong, and lines matched on such a list come out shifted
// while looking right. So every request ends with a clip whose words are known (one this listener passed before):
// if that one comes back wrong the list is not trusted, and it is asked again in two halves.
async function hear(F) {
  // every clip has its number in front of it, or the listener runs two pieces of one sentence together and loses count
  const parts = F.flatMap((f, i) => [{text: `Clip ${i + 1}:`}, {inlineData: {mimeType: 'audio/mp3', data: readFileSync(f).toString('base64')}}]);
  parts.push({text: `Those are ${F.length} separate short audio clips cut from a ${SAY ? LNAME + '-language ' : 'Thai '}Muay Thai TV broadcast. Some are a whole sentence, some only a word or a fragment. For each clip write down only the words audible in that clip itself, in ${LANG === "zh" ? "simplified Chinese characters" : LANG === "en" ? "English" : "Thai script"}; never complete a sentence from a neighbouring clip. If a clip has no speech write (none). Reply with exactly ${F.length} lines in the form "1: words", nothing else.`});
  let out = null, err;
  for (const model of EARS) { try { const d = await ask(model, `models/${model}:generateContent`, {contents: [{parts}], generationConfig: {temperature: 0}}); out = ((((d.candidates || [])[0] || {}).content || {}).parts || []).map(p => p.text || '').join(''); break; } catch (e) { err = e; } }
  if (out == null) throw err;
  const got = F.map(() => '');
  for (const l of out.split('\n')) { const m = /^\s*(\d+)\s*[:.)]\s*(.*)$/.exec(l); if (m && got[+m[1] - 1] != null) got[+m[1] - 1] = /^\(?none\)?$/i.test(m[2].trim()) ? '' : m[2].trim(); }
  return got;
}
let guard; // the known clip: {file, text}, or null in a folder with nothing passed yet
async function heardRight(F) {
  if (!guard) return hear(F);
  const got = await hear(F.concat([guard.file]));
  if (alike(got[F.length], guard.text) >= .7) return got.slice(0, F.length);
  if (F.length <= 3) { console.log('  the listener lost count on a list of ' + F.length + '; taken as heard'); return got.slice(0, F.length); }
  console.log(`  the listener lost count on a list of ${F.length}; asking again in two halves`);
  return (await heardRight(F.slice(0, F.length >> 1))).concat(await heardRight(F.slice(F.length >> 1)));
}
async function listen(files) {
  if (guard === undefined) { // a long, sure clip this listener passed, kept apart so a retake cannot change it under us
    const e = Object.entries(man).find(([nm, v]) => EARS.includes(v.ear) && v.ok >= .95 && bare(v.text).length >= 14 && existsSync(`${DIR}/${nm}.mp3`));
    guard = e ? {file: TMP + '/guard.mp3', text: e[1].text} : null; if (e) writeFileSync(guard.file, readFileSync(`${DIR}/${e[0]}.mp3`));
  }
  const heard = [], size = guard ? HEAR - 1 : Math.min(HEAR, 10);
  for (let at = 0; at < files.length; at += size) heard.push(...await heardRight(files.slice(at, at + size)));
  return heard;
}
// how close what was heard is to the line: letters only, tone marks dropped (the ear is least sure of those)
const bare = LANG === 'en' ? s => s.toLowerCase().replace(/[^a-z]/g, '') : LANG === 'zh' ? s => s.replace(/[^\u4e00-\u9fff]/g, '') : s => s.replace(/[^ก-ฺเ-็]/g, '');
function alike(a, b) {
  a = bare(a); b = bare(b); if (!a.length || !b.length) return 0;
  let row = Array.from({length: b.length + 1}, (_, i) => i);
  for (let i = 1; i <= a.length; i++) { const nx = [i]; for (let j = 1; j <= b.length; j++) nx[j] = Math.min(row[j] + 1, nx[j - 1] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); row = nx; }
  return 1 - row[b.length] / Math.max(a.length, b.length);
}

let made = 0, secs = 0; const doubt = [];
function keep(J) { // the best take becomes the clip
  renameSync(J.best.file, `${DIR}/${J.name}.mp3`);
  man[J.name] = {h: J.h, text: J.text, s: +J.best.s.toFixed(2), heard: J.best.heard, ok: J.best.score == null ? null : +J.best.score.toFixed(2), m: MODEL, ear: EARS[0]};
  writeFileSync(MAN, JSON.stringify(man, null, 1)); made++; secs += J.best.s;
  if (J.best.score != null && J.best.score < PASS) doubt.push(J);
  console.log(`${J.best.score == null ? '?' : J.best.score >= PASS ? 'ok' : '!!'} ${J.name}  ${J.best.s.toFixed(1)}s  ${J.text}${J.best.score != null && J.best.score < .85 ? '   <- heard: ' + J.best.heard : ''}`);
}
const waiting = []; // lines that need another take, gathered into as few requests as possible once the first pass is through
// One recording: cut it into pieces, hear them, give every line its pieces, keep the lines that came out right
async function cutUp(id, B) {
  const wav = id + '.wav', P = pieces(wav), hf = id + '.heard.json';
  if (P.length < B.length * .7) return false;
  let heard = existsSync(hf) ? JSON.parse(readFileSync(hf, 'utf8')) : null;
  if (!heard || heard.length !== P.length) {
    const pf = P.map(([a, b], k) => { const f = `${TMP}/piece-${k}.mp3`; execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(Math.max(0, a - .05)), '-to', String(b + .08), '-i', wav, '-ac', '1', '-ar', '16000', '-b:a', '32k', f]); return f; });
    heard = await listen(pf); writeFileSync(hf, JSON.stringify(heard));
  }
  const segs = align(P, heard, B);
  console.log(`  ${P[P.length - 1][1].toFixed(0)} s recorded, ${P.length} pieces for ${B.length} lines${segs.includes(null) ? ', ' + segs.filter(x => !x).length + ' lines not said' : ''}`);
  B.forEach((J, i) => {
    J.takes = (J.takes || 0) + 1;
    const g = segs[i], f = `${TMP}/${J.name}.t${J.takes}.mp3`, dur = g ? clip(wav, g.a, g.b, J, f) : 0;
    // a count or a shout is one syllable: its length is the check that matters. Words that are not in the line fail it.
    const short = J.style === 'count' || J.style === 'shout', sane = dur > .12 && dur < 1.5 + bare(J.text).length * .25, extra = g && !short && bare(g.heard).length > bare(J.text).length * 1.15 + 1;
    const score = !sane ? 0 : extra ? Math.min(g.score, .5) : Math.max(g.score, short ? PASS : 0);
    if (g && (!J.best || score > J.best.score)) J.best = {file: f, s: dur, heard: g.heard, score};
    if (score >= PASS || (J.takes >= TAKES && J.best)) keep(J); else if (J.takes >= TAKES) console.log('!! never said: ' + J.name); else waiting.push(J);
  });
  renameSync(id + '.json', id + '.done.json'); // the recording itself stays, with what was heard in it
  return true;
}
let todo = [];
try {
  if (process.argv.includes('--recheck')) { // clips a weaker listener passed are heard again by the one we trust
    const R = jobs.filter(J => man[J.name] && man[J.name].h === J.h && existsSync(`${DIR}/${J.name}.mp3`) && !EARS.includes(man[J.name].ear));
    if (R.length) {
      const heard = await listen(R.map(J => `${DIR}/${J.name}.mp3`)); let failed = 0;
      R.forEach((J, i) => {
        const short = J.style === 'count' || J.style === 'shout', sc = alike(heard[i], J.text), extra = !short && bare(heard[i]).length > bare(J.text).length * 1.15 + 1;
        const ok = extra ? Math.min(sc, .5) : Math.max(sc, short ? PASS : 0);
        Object.assign(man[J.name], {heard: heard[i], ok: +ok.toFixed(2), ear: EARS[0]}); if (ok < PASS) { failed++; console.log(`!! ${J.name}  ${J.text}   <- heard: ${heard[i]}`); }
      });
      writeFileSync(MAN, JSON.stringify(man, null, 1)); console.log(`  heard ${R.length} clips again: ${failed} do not say their line and will be recorded again`);
    }
  }
  // recordings left over from a run that stopped
  for (const f of readdirSync(TAKE).filter(f => /^\d+\.json$/.test(f)).sort()) {
    const id = TAKE + '/' + f.slice(0, -5), B = JSON.parse(readFileSync(id + '.json', 'utf8')).map(nm => jobs.find(J => J.name === nm));
    if (B.some(J => !J) || !existsSync(id + '.wav')) continue;
    console.log(`  cutting up a recording left from the last run (${B.length} lines)`);
    if (!await cutUp(id, B)) console.log('  its lines ran together, they will be recorded again');
  }
  todo = jobs.filter(J => (redo(J) || !done(J)) && !waiting.includes(J) && !(J.best && done(J))).slice(0, LIMIT);
  const queue = pack(todo);
  while (queue.length || waiting.length) {
    if (!queue.length) { console.log(`  another take for ${waiting.map(J => J.name).join(', ')}`); queue.push(...pack(waiting.splice(0))); }
    const B = queue.shift(), id = await speak(B);
    if (id && await cutUp(id, B)) continue;
    if (id) renameSync(id + '.json', id + '.done.json');
    // the lines ran together: ask for fewer at a time
    console.log(`  ${B.length} lines did not come apart, ${B.length > 1 ? 'halving' : 'again'}`);
    if (B.length > 1) queue.unshift(B.slice(0, B.length >> 1), B.slice(B.length >> 1));
    else if ((B[0].miss = (B[0].miss || 0) + 1) < TAKES) queue.push(B);
    else console.log('!! gave up on ' + B[0].name);
  }
} catch (e) {
  console.log('stopped: ' + e.message);
  for (const J of jobs) if (J.best && !done(J) && existsSync(J.best.file)) keep(J); // a doubtful take is better than none: it is listed below and recorded again by the next run
}
rmSync(TMP, {recursive: true, force: true});
const left = jobs.filter(J => !done(J)).length;
console.log(`${jobs.length} clips wanted, recorded ${made} now (${secs.toFixed(0)} s of speech), ${left} still to record. ${calls} requests, ${tokIn} tokens in, ${tokOut} tokens out. Speech ${MODEL}, listener ${EARS.join(', ')}.`);
if (doubt.length) console.log('doubtful (the next run records them again; --keep-doubt to accept them): ' + doubt.map(J => J.name).join(','));
