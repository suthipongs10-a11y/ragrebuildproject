// Scene music away from the ring (docs/MUSIC_BRIEF.md): cuts one section out of each track the owner made with Gemini
// and writes assets/scene-music/<key>.mp3 plus tracks.json (where the loop starts, how long it is, the crossfade, the level).
// A piece plays from the start of its file, then loops the stretch [from, from + len] with a crossfade of xf seconds:
// the file runs xf past the end of the loop, and that tail sounds like the start of the loop, so the join is not heard.
// The cut points were found by comparing the sound itself (scratch analysis, 16 Nov 2026): the stretch after the end
// of the loop has to match the stretch after its start (same beat, bass in step), since nobody here can listen.
// usage: node tools/scene-music-import.mjs <folder with the source mp3 files>
// Needs ffmpeg. The sources are not in the repo (26 MB); the owner has them.
import { execFileSync, spawnSync } from 'node:child_process';
import { readdirSync, mkdirSync, writeFileSync, statSync } from 'node:fs';

// key: [source file name contains, start of the file in the source (s), start of the loop (s), loop length (s), crossfade (s), level in the game]
// win and lose start at the top of the track (the fanfare, the lone opening notes) and loop a later stretch; the rest loop from their first note.
const TRACKS = {
  win:   ['Victory_at_the_Ring',     1.97, 13.47, 40.0006, 2, .62],
  lose:  ['The_Long_Walk_Back',      2.10, 22.25, 32.1951, 3, .52],
  camp:  ['Hands_Wrapped_in_Linen', 74.82, 74.82, 36.5393, 2, .45],
  train: ['Leather_And_Bone',       80.50, 80.50, 32.0056, 2, .45],
  calm:  ['Stillness_by_the_Canal', 68.50, 68.50, 41.7484, 3, .42],
  night: ['Before_the_First_Bell',  67.25, 67.25, 48.0000, 2, .45],
  title: ['Eight_Limbs_of_Honor',   39.50, 39.50, 54.2595, 2, .50]
};
const SRC = process.argv[2], OUT = 'assets/scene-music', LUFS = -18;
if (!SRC) { console.log('usage: node tools/scene-music-import.mjs <folder with the source mp3 files>'); process.exit(1); }
mkdirSync(OUT, {recursive: true});
const files = readdirSync(SRC), meta = {};
for (const [key, [name, a, b, len, xf, gain]] of Object.entries(TRACKS)) {
  const f = files.find(x => x.includes(name) && x.endsWith('.mp3'));
  if (!f) { console.log(key + ': no file with "' + name + '" in ' + SRC + ', skipped'); continue; }
  const cut = ['-ss', String(a), '-t', String(b - a + len + xf + .1), '-i', SRC + '/' + f];
  // how loud this stretch is, then one plain gain to bring it to LUFS (no compression: the quiet openings stay quiet)
  const m = /I:\s+(-?[\d.]+) LUFS/g, log = spawnSync('ffmpeg', ['-hide_banner', '-nostats', ...cut, '-af', 'ebur128', '-f', 'null', '-']).stderr.toString();
  let I = null, r; while ((r = m.exec(log))) I = +r[1];
  const db = LUFS - I, out = `${OUT}/${key}.mp3`;
  execFileSync('ffmpeg', ['-v', 'error', '-y', ...cut, '-af', `volume=${db.toFixed(2)}dB,alimiter=limit=0.89:level=false,afade=t=in:d=0.02`, '-ar', '44100', '-ac', '2', '-c:a', 'libmp3lame', '-b:a', '96k', out]);
  meta[key] = {from: +(b - a).toFixed(4), len, xf, gain};
  console.log(`${key.padEnd(6)} ${f.replace(/^[0-9a-f]+-/, '')}  ${a}-${(b + len + xf).toFixed(1)} s, ${I} LUFS ${db >= 0 ? '+' : ''}${db.toFixed(1)} dB, ${(statSync(out).size / 1024).toFixed(0)} KB`);
}
writeFileSync(OUT + '/tracks.json', JSON.stringify(meta, null, 1) + '\n');
console.log('wrote ' + OUT + '/tracks.json: ' + Object.keys(meta).join(', '));
