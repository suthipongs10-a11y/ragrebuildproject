// What the clip tools share (tools/clips/gameplay.mjs; render.mjs keeps its own copy for now): one virtual clock for the
// whole page, the page's sound rendered offline on that clock, a guard that keeps the recorded ring music out, and the
// encoder. Every frame is drawn on the clock, so a clip is smooth on a machine with no graphics card and the sound is exact.
import { execFileSync } from 'node:child_process';
import { readdirSync, writeFileSync } from 'node:fs';
export const ROOT = new URL('../../', import.meta.url).pathname;
export const SR = 48000;

// Runs before the page: nothing moves until __clip.step(ms). len: the most seconds of sound the clip can use (on the
// clock, skipped stretches included). t0: what Date.now() says when the clock starts.
export const clockScript = ({len, t0}) => `(() => {
  let vt = 0, rafs = [], rid = 0, tid = 0; const timers = new Map(), T0 = ${t0};
  let s = 0x9e3779b9; Math.random = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; // the same run every time
  performance.now = () => vt; Date.now = () => T0 + vt;
  window.requestAnimationFrame = cb => { rafs.push([++rid, cb]); return rid; };
  window.cancelAnimationFrame = id => { rafs = rafs.filter(r => r[0] !== id); };
  window.setTimeout = (fn, ms, ...a) => { const id = ++tid; timers.set(id, {at: vt + Math.max(0, +ms || 0), fn, a}); return id; };
  window.setInterval = (fn, ms, ...a) => { const id = ++tid, every = Math.max(1, +ms || 0); timers.set(id, {at: vt + every, fn, a, every}); return id; };
  window.clearTimeout = window.clearInterval = id => { timers.delete(id); };
  const anims = new WeakSet(), SR = ${SR};
  class ClipAudio extends OfflineAudioContext {
    constructor() { super({numberOfChannels: 2, length: SR * ${len}, sampleRate: SR}); window.__clipAC = this; }
    get currentTime() { return vt / 1000; } get state() { return 'running'; }
    resume() { return Promise.resolve(); } suspend() { return Promise.resolve(); } close() { return Promise.resolve(); }
  }
  window.AudioContext = window.webkitAudioContext = ClipAudio;
  // a recording longer than any sound effect: listed, so the tool can check what it was
  window.__long = []; const go = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function (...a) { if (this.buffer && this.buffer.duration > 20) window.__long.push(+this.buffer.duration.toFixed(2)); return go.apply(this, a); };
  window.__clip = {
    get t() { return vt; },
    step(ms) {
      const end = vt + ms;
      for (;;) { // the timers due in this step, in order
        let id = null, best = null; for (const [k, v] of timers) if (v.at <= end && (!best || v.at < best.at)) { id = k; best = v; }
        if (!best) break;
        vt = Math.max(vt, best.at); if (best.every) best.at += best.every; else timers.delete(id);
        try { typeof best.fn === 'function' ? best.fn(...best.a) : (0, eval)(best.fn); } catch (e) { console.error(e); }
      }
      vt = end;
      const due = rafs; rafs = []; for (const [, cb] of due) { try { cb(vt); } catch (e) { console.error(e); } }
      // CSS animations and transitions: held still, moved on by exactly one step (a new one starts now)
      for (const a of document.getAnimations()) { try { if (!anims.has(a)) { anims.add(a); a.pause(); a.currentTime = 0; } else { a.pause(); a.currentTime = (a.currentTime || 0) + ms; } } catch (e) { /* a finished one */ } }
    },
    // the sound, rendered once at the end; then any stretch of it (ms on the clock) as 16-bit stereo, base64
    async render() { if (!window.__clipAC) return 0; if (!window.__clipBuf) window.__clipBuf = await window.__clipAC.startRendering(); return window.__clipBuf.length; },
    pcm(t0, t1) {
      const buf = window.__clipBuf, a = Math.max(0, Math.round(t0 / 1000 * SR)), b = Math.min(buf.length, Math.round(t1 / 1000 * SR)), n = Math.max(0, b - a);
      const L = buf.getChannelData(0), R = buf.getChannelData(1), out = new DataView(new ArrayBuffer(n * 4));
      for (let i = 0; i < n; i++) { const l = Math.max(-1, Math.min(1, L[a + i])), r = Math.max(-1, Math.min(1, R[a + i])); out.setInt16(i * 4, l * 32767, true); out.setInt16(i * 4 + 2, r * 32767, true); }
      const u = new Uint8Array(out.buffer); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
      return btoa(s);
    }
  };
})();`;

// The two recorded ring tracks (assets/music) have no known source or licence yet (STATUS.md round 34): never in a clip.
// Without them the game plays its own pipe and drums, made in code.
export const MUSIC_PACK = /<script type="application\/json" id="music-pack">[\s\S]*?<\/script>/;
export const MUSIC_LENGTHS = readdirSync(ROOT + 'assets/music').filter(f => f.endsWith('.mp3'))
  .map(f => +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', ROOT + 'assets/music/' + f]).toString());
export const ringMusicIn = long => long.filter(d => MUSIC_LENGTHS.some(m => Math.abs(m - d) < .1));

// stretches of the clock (ms) → one WAV, in order
export async function soundOf(ev, spans, file) {
  if (!await ev('__clip.render()')) throw new Error('no sound: the game did not open its AudioContext');
  const parts = [];
  for (const [a, b] of spans) {
    const p = Buffer.from(await ev(`__clip.pcm(${a}, ${b})`), 'base64'), frames = p.length / 4, F = Math.min(288, frames >> 1); // a 6 ms fade at each cut: no click
    for (let i = 0; i < F; i++) for (const at of [i, frames - 1 - i]) for (const c of [0, 2]) p.writeInt16LE(Math.round(p.readInt16LE(at * 4 + c) * i / F), at * 4 + c);
    parts.push(p);
  }
  const pcm = Buffer.concat(parts), h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22);
  h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  writeFileSync(file, Buffer.concat([h, pcm]));
  return pcm.length / 4 / SR;
}

// H.264 + AAC, the sound brought to the loudness short-video apps play at (-14 LUFS)
export function encode(frames, fps, wav, out) {
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', frames, '-i', wav,
    '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(fps),
    '-c:a', 'aac', '-b:a', '192k', '-ar', String(SR), '-shortest', '-movflags', '+faststart', out]);
}
