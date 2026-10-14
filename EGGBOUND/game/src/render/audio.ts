// @ts-nocheck
// Tiny WebAudio synth. Starts on first user gesture (browser autoplay rule).
const AU = { ctx: null, on: true, m: null, n: null };
export function audioInit() {
  if (AU.ctx) { if (AU.ctx.state === 'suspended') AU.ctx.resume(); return; }
  try {
    const C = window.AudioContext || (window as any).webkitAudioContext; AU.ctx = new C(); AU.m = AU.ctx.createGain(); AU.m.gain.value = .42; AU.m.connect(AU.ctx.destination);
    const b = AU.ctx.createBuffer(1, AU.ctx.sampleRate, AU.ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; AU.n = b;
  } catch (e) { AU.ctx = null; }
}
export function setSound(on) { AU.on = on; }
function nz(dur, type, f0, f1, vol, dl = 0) { if (!AU.on || !AU.ctx) return; const c = AU.ctx, t = c.currentTime + dl, s = c.createBufferSource(); s.buffer = AU.n; const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur); const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur); s.connect(f); f.connect(g); g.connect(AU.m); s.start(t); s.stop(t + dur + .05); }
function tone(type, f0, f1, dur, vol, dl = 0) { if (!AU.on || !AU.ctx) return; const c = AU.ctx, t = c.currentTime + dl, o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur); const g = c.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + dur); o.connect(g); g.connect(AU.m); o.start(t); o.stop(t + dur + .05); }
export const sfx = {
  hit(b) { nz(.14, 'bandpass', 1800, 500, b ? .9 : .55); tone('sine', b ? 140 : 180, 50, .18, b ? .8 : .45); },
  whoosh() { nz(.22, 'bandpass', 500, 2400, .3); },
  charge(d) { tone('sawtooth', 70, 520, d, .06); tone('sine', 110, 880, d, .08); nz(d, 'bandpass', 300, 3200, .16); },
  beam() { nz(.5, 'bandpass', 900, 200, .5); tone('square', 220, 1200, .3, .08); tone('sine', 60, 40, .5, .5); },
  boom() { nz(.8, 'lowpass', 2400, 90, .9); tone('sine', 90, 35, .7, .8); },
  fire() { nz(.45, 'lowpass', 1400, 300, .42); },
  charge() { tone('sawtooth', 110, 440, .7, .1); nz(.7, 'bandpass', 300, 1800, .26); },
  heal() { [784, 988, 1175, 1568].forEach((f, i) => tone('sine', f, f * 1.01, .5, .15, i * .07)); },
  buff() { [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, f, .35, .15, i * .06)); },
  shield() { tone('triangle', 330, 660, .3, .18); nz(.3, 'highpass', 2000, 4000, .12); },
  wave() { nz(1.2, 'bandpass', 200, 1600, .5); nz(1, 'lowpass', 800, 200, .4, .3); },
  meteor() { tone('sine', 2400, 300, .45, .12); nz(.4, 'highpass', 3000, 800, .2); },
  dark() { tone('sawtooth', 90, 40, .9, .17); nz(.9, 'lowpass', 600, 80, .45); },
  zap() { nz(.18, 'highpass', 4000, 1200, .45); tone('square', 1200, 200, .15, .12); },
  quake() { nz(.9, 'lowpass', 300, 40, .9); tone('sine', 60, 30, .8, .7); },
  die() { tone('triangle', 500, 120, .4, .17); },
  react() { [880, 1320, 1760].forEach((f, i) => tone('square', f, f * 1.5, .18, .1, i * .05)); nz(.4, 'bandpass', 2000, 600, .35); },
  coin() { tone('square', 1568, 1568, .07, .08); tone('square', 2093, 2093, .12, .08, .06); },
  win() { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone('triangle', f, f, .4, .17, i * .11)); },
  lose() { [392, 330, 262, 196].forEach((f, i) => tone('triangle', f, f, .5, .15, i * .16)); },
  crack() { nz(.06, 'highpass', 3500, 2000, .6); tone('square', 900, 300, .04, .12); },
  /** rune strike landed: one bright "ping" (owner 2026-10-14: gauge fills → ปิ๊ง) */
  ping() { tone('sine', 2093, 2093, .38, .26); tone('sine', 3136, 3136, .28, .12, .015); tone('triangle', 4186, 4186, .16, .06, .03); },
  /** rune strike missed: the gauge falls with a sinking "wah-wah" */
  fail() { tone('sawtooth', 392, 300, .22, .1); tone('sawtooth', 300, 150, .42, .11, .2); nz(.3, 'lowpass', 900, 200, .12, .2); },
  chime() { [1318, 1661, 1976, 2637].forEach((f, i) => tone('sine', f, f, .7, .2, i * .09)); },
  starup() { [659, 784, 988, 1319, 1568, 1976].forEach((f, i) => tone('triangle', f, f, .5, .18, i * .08)); nz(1, 'highpass', 6000, 8000, .1, .5); },
  hum() { tone('sine', 98, 82, 1.1, .35); tone('sine', 147, 123, 1.1, .18, .05); nz(.9, 'lowpass', 300, 120, .12); },
  build() { [0, .16, .32].forEach(d => { nz(.07, 'bandpass', 1400, 900, .5, d); tone('square', 420, 260, .05, .08, d); }); },
  step() { nz(.05, 'lowpass', 500, 160, .22); },
  click() { tone('triangle', 900, 1200, .05, .08); },
  perfect() { [1047, 1568, 2093].forEach((f, i) => tone('triangle', f, f, .25, .2, i * .04)); },
};
