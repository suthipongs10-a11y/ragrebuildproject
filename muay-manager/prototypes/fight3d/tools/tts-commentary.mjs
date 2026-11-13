// Records the commentary, the referee's count and the crowd shouts with Cartesia TTS (Thai) into assets/voice/*.mp3.
// A clip is only recorded again when its text or voice changed (assets/voice/manifest.json keeps track), so a rerun
// costs nothing. Cartesia bills by character: the script prints how many it sent.
// Usage: node tools/tts-commentary.mjs        (needs ffmpeg; the key is added by the session's network proxy)
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { LINES, COUNT, SHOUT, VOICES } from '../src/commentary.js';

const DIR = 'assets/voice', MAN = DIR + '/manifest.json';
mkdirSync(DIR, {recursive: true});
const man = existsSync(MAN) ? JSON.parse(readFileSync(MAN, 'utf8')) : {};
const jobs = [];
for (const [key, L] of Object.entries(LINES)) L.t.forEach((t, i) => jobs.push({name: key + '-' + i, text: t, voice: VOICES.caller, speed: 1.12, emotion: L.hot ? 'excited' : null}));
COUNT.forEach((t, i) => jobs.push({name: 'count-' + i, text: t, voice: VOICES.referee, speed: 1.05, emotion: null}));
SHOUT.forEach((t, i) => VOICES.crowd.forEach((v, j) => jobs.push({name: 'shout' + i + '-' + j, text: t, voice: v, speed: 1, emotion: 'excited'})));

let chars = 0, made = 0;
for (const J of jobs) {
  const h = createHash('sha1').update(JSON.stringify([J.text, J.voice, J.speed, J.emotion])).digest('hex').slice(0, 12), out = `${DIR}/${J.name}.mp3`;
  if (man[J.name] && man[J.name].h === h && existsSync(out)) continue;
  const body = {model_id: 'sonic-3', transcript: J.text, voice: {mode: 'id', id: J.voice}, language: 'th',
    output_format: {container: 'wav', encoding: 'pcm_s16le', sample_rate: 24000}, generation_config: Object.assign({speed: J.speed}, J.emotion ? {emotion: J.emotion} : {})};
  const wav = `${DIR}/_tmp.wav`;
  const code = execFileSync('curl', ['-sS', '-m', '60', 'https://api.cartesia.ai/tts/bytes', '-H', 'Cartesia-Version: 2025-04-16', '-H', 'Authorization: Bearer proxy-injected',
    '-H', 'Content-Type: application/json', '-d', JSON.stringify(body), '-o', wav, '-w', '%{http_code}']).toString();
  if (code !== '200') throw new Error(J.name + ': HTTP ' + code + ' ' + readFileSync(wav, 'utf8').slice(0, 200));
  // trim the silence at both ends, level it, and keep it small: mono 22 kHz MP3 at 32 kbit/s
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', wav, '-af', 'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,loudnorm=I=-16:TP=-1.5',
    '-ac', '1', '-ar', '22050', '-b:a', '32k', out]);
  unlinkSync(wav);
  man[J.name] = {h, text: J.text}; chars += J.text.length; made++;
  writeFileSync(MAN, JSON.stringify(man, null, 1));
}
console.log(`${jobs.length} clips, recorded ${made} (${chars} characters sent to Cartesia)`);
