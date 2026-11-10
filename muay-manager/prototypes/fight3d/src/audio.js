// Placeholder sound, all synthesised. Starts only after the viewer taps the sound button.
export function buildAudio() {
  let AC = null, on = false, master = null, crowdGain = null, noiseBuf = null, beatT = 0, beatN = 0;
  const A = {
    get on() { return on; },
    toggle() {
      on = !on;
      if (on) {
        try {
          AC = AC || new (window.AudioContext || window.webkitAudioContext)(); AC.resume();
          if (!master) {
            master = AC.createGain(); master.gain.value = .9; master.connect(AC.destination);
            noiseBuf = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate);
            const d = noiseBuf.getChannelData(0); let last = 0;
            for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = (last + .04 * w) / 1.04; d[i] = last * 3 + w * .25; }
            const src = AC.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
            const bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 650; bp.Q.value = .5;
            crowdGain = AC.createGain(); crowdGain.gain.value = 0; src.connect(bp); bp.connect(crowdGain); crowdGain.connect(master); src.start();
          }
          master.gain.value = .9;
        } catch (e) { on = false; }
      } else if (master) master.gain.value = 0;
      return on;
    },
    noise(len, type, freq, gain, q, sweepTo) {
      if (!on) return; const t = AC.currentTime, s = AC.createBufferSource(); s.buffer = noiseBuf; s.loopStart = Math.random(); 
      const f = AC.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + len); f.Q.value = q || .7;
      const g = AC.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(.001, t + len);
      s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random() * 1.5, len + .02);
    },
    tone(type, f0, f1, len, gain, delay) {
      if (!on) return; const t = AC.currentTime + (delay || 0), o = AC.createOscillator(), g = AC.createGain(); o.type = type;
      o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + len);
      g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(.001, t + len); o.connect(g); g.connect(master); o.start(t); o.stop(t + len + .02);
    },
    hit(kind, raw, quiet) {
      if (!on) return; const p = Math.min(1, raw / 26), v = quiet ? .5 : 1;
      if (kind === 'punch') { A.noise(.09 + p * .05, 'lowpass', 1100, (.3 + p * .5) * v); A.tone('sine', 150, 48, .15, (.25 + p * .5) * v); }
      else if (kind === 'kick') { A.noise(.12 + p * .06, 'bandpass', 1500, (.35 + p * .5) * v, .6); A.tone('sine', 110, 38, .2, (.3 + p * .55) * v); }
      else if (kind === 'elbow') { A.noise(.05, 'highpass', 2400, (.3 + p * .4) * v); A.tone('triangle', 420, 90, .1, (.25 + p * .4) * v); A.tone('sine', 130, 50, .14, .3 * v); }
      else { A.noise(.1, 'lowpass', 600, (.3 + p * .4) * v); A.tone('sine', 95, 34, .24, (.4 + p * .5) * v); }
    },
    block() { A.noise(.06, 'bandpass', 2600, .22, 1.2); A.tone('sine', 220, 120, .06, .12); },
    whiff() { A.noise(.16, 'bandpass', 500, .1, 1.5, 1700); },
    swish(big) { A.noise(big ? .32 : .18, 'bandpass', 380, big ? .16 : .07, 1.4, big ? 2200 : 1300); },
    bell(n) { for (let i = 0; i < n; i++) [880, 1318, 1760, 2637].forEach((fq, j) => A.tone('sine', fq, 0, 1.2, j ? .06 : .2, i * .3)); },
    count() { A.tone('square', 520, 0, .12, .06); },
    roar(v) { if (!on) return; A.noise(.9 + v * .6, 'bandpass', 800, .12 + v * .2, .4, 1300); },
    thud() { A.noise(.2, 'lowpass', 300, .5); A.tone('sine', 70, 30, .3, .6); },
    // called every frame: crowd bed and a simple drum-and-cymbal ringside pulse
    update(dt, hype, playing, round) {
      if (!on || !AC) return;
      crowdGain.gain.setTargetAtTime(playing ? .035 + hype * .16 : .02, AC.currentTime, .25);
      if (!playing) return;
      beatT -= dt;
      if (beatT <= 0) {
        const bpm = 92 + round * 12 + hype * 36; beatT += 60 / bpm / 2; beatN++;
        const s = beatN % 8;
        if (s === 0 || s === 3 || s === 6) A.tone('sine', 118, 64, .22, .2);       // low drum
        if (s === 2 || s === 5 || s === 7) A.tone('sine', 205, 130, .12, .13);     // high drum
        if (s % 4 === 0) { A.tone('triangle', 2650, 0, .5, .035); A.tone('sine', 3960, 0, .35, .02); } // ching, open
        if (s % 4 === 2) { A.tone('triangle', 2650, 0, .07, .03); }                // chap, closed
      }
    }
  };
  return A;
}
