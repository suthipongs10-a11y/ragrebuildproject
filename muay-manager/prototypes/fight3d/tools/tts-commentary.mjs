// Records the commentary, the referee's count and the crowd shouts with Gemini TTS (Thai) into assets/voice/*.mp3.
// A clip is only recorded again when its text, voice, direction or model changed (assets/voice/manifest.json keeps
// track), so a rerun costs nothing and a run cut short by the rate limit picks up where it stopped.
// Usage: node tools/tts-commentary.mjs [--model gemini-3.8-flash-tts] [--only key,key] [--limit n] [--samples dir]
//   --samples dir: one hot line in every prebuilt voice, into dir, to choose the commentator by ear (nothing else is made)
// Needs ffmpeg. The key: in a Claude cloud session the network proxy adds it (a network secret for
// generativelanguage.googleapis.com sent in the x-goog-api-key header); anywhere else set GEMINI_API_KEY.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { LINES, COUNT, SHOUT, VOICES, STYLE, STYLE_COUNT, STYLE_SHOUT } from '../src/commentary.js';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const MODEL = arg('model', 'gemini-3.8-flash-tts'), ONLY = arg('only', '') ? arg('only').split(',') : null, LIMIT = +arg('limit', 1e9), SAMPLES = arg('samples', '');
const DIR = SAMPLES || 'assets/voice', MAN = DIR + '/manifest.json', KEY = process.env.GEMINI_API_KEY || 'proxy-injected';
mkdirSync(DIR, {recursive: true});
const man = !SAMPLES && existsSync(MAN) ? JSON.parse(readFileSync(MAN, 'utf8')) : {};
let jobs = [];
if (SAMPLES) for (const v of ['Fenrir', 'Puck', 'Orus', 'Charon', 'Kore', 'Zephyr', 'Leda', 'Aoede']) jobs.push({name: 'sample-' + v, text: LINES.ko.t[2], voice: v, style: STYLE[2]});
else {
  for (const [key, L] of Object.entries(LINES)) L.t.forEach((t, i) => jobs.push({name: key + '-' + i, key, text: t, voice: VOICES.caller, style: STYLE[L.hot]}));
  COUNT.forEach((t, i) => jobs.push({name: 'count-' + i, key: 'count', text: t, voice: VOICES.referee, style: STYLE_COUNT}));
  SHOUT.forEach((t, i) => VOICES.crowd.forEach((v, j) => jobs.push({name: 'shout' + i + '-' + j, key: 'shout' + i, text: t, voice: v, style: STYLE_SHOUT})));
  if (ONLY) jobs = jobs.filter(j => ONLY.includes(j.key));
}
const sleep = ms => new Promise(ok => setTimeout(ok, ms));
async function speak(J) {
  const body = {contents: [{parts: [{text: J.style + ': ' + J.text}]}], generationConfig: {responseModalities: ['AUDIO'], speechConfig: {voiceConfig: {prebuiltVoiceConfig: {voiceName: J.voice}}}}};
  for (let tries = 0; tries < 6; tries++) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {method: 'POST', headers: {'Content-Type': 'application/json', 'x-goog-api-key': KEY}, body: JSON.stringify(body)});
    if (r.status === 429 || r.status >= 500) { // rate limit: wait as long as it asks, a day's quota ends the run
      const t = await r.text(), m = /retry in ([\d.]+)s|"retryDelay":\s*"(\d+)s"/.exec(t), wait = m ? Math.ceil(+(m[1] || m[2])) + 1 : 20 * (tries + 1);
      if (/PerDay|per day|daily/i.test(t)) throw new Error('daily quota reached: ' + t.slice(0, 200));
      console.log(`  ${r.status}, waiting ${wait}s`); await sleep(wait * 1000); continue;
    }
    if (!r.ok) throw new Error(J.name + ': HTTP ' + r.status + ' ' + (await r.text()).slice(0, 300));
    const d = await r.json(), part = (((d.candidates || [])[0] || {}).content || {}).parts || [], au = part.find(p => p.inlineData);
    if (!au) { console.log('  no audio in the reply, again'); continue; }
    return {mime: au.inlineData.mimeType || '', data: Buffer.from(au.inlineData.data, 'base64'), usage: d.usageMetadata || {}};
  }
  throw new Error(J.name + ': gave up');
}
let made = 0, tokIn = 0, tokOut = 0, secs = 0;
for (const J of jobs) {
  if (made >= LIMIT) break;
  const h = createHash('sha1').update(JSON.stringify([J.text, J.voice, J.style, MODEL])).digest('hex').slice(0, 12), out = `${DIR}/${J.name}.mp3`;
  if (man[J.name] && man[J.name].h === h && existsSync(out)) continue;
  let a;
  try { a = await speak(J); } catch (e) { console.log('stopped: ' + e.message); break; }
  const raw = `${DIR}/_tmp.bin`; writeFileSync(raw, a.data);
  const rate = (/rate=(\d+)/.exec(a.mime) || [])[1] || '24000', input = /wav/i.test(a.mime) ? ['-i', raw] : ['-f', 's16le', '-ar', rate, '-ac', '1', '-i', raw];
  // trim the silence at both ends, level it, and keep it small: mono 22 kHz MP3 at 32 kbit/s
  execFileSync('ffmpeg', ['-v', 'error', '-y', ...input, '-af', 'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,loudnorm=I=-16:TP=-1.5',
    '-ac', '1', '-ar', '22050', '-b:a', '32k', out]);
  unlinkSync(raw);
  const dur = +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out]).toString();
  man[J.name] = {h, text: J.text, s: +dur.toFixed(2)}; made++; secs += dur; tokIn += a.usage.promptTokenCount || 0; tokOut += a.usage.candidatesTokenCount || 0;
  if (!SAMPLES) writeFileSync(MAN, JSON.stringify(man, null, 1));
  console.log(`${J.name}  ${dur.toFixed(1)}s  ${J.text}`);
}
const left = jobs.filter(J => !existsSync(`${DIR}/${J.name}.mp3`) || !man[J.name] && !SAMPLES).length;
console.log(`${jobs.length} clips wanted, recorded ${made} now (${secs.toFixed(0)} s of speech, ${tokIn} tokens in, ${tokOut} tokens out, model ${MODEL}), ${left} still to record`);
