// Sound. Strikes, blocks, swishes and falls are recorded sounds from free CC0 packs (assets/sfx, CREDITS.md), with a
// synthesised low thump underneath and the old synthesised sounds as the fallback; bell and crowd bed are synthesised; the ringside music (pi, klong khaek and ching) is played live from
// code so its tempo can follow the fight; the commentary and the crowd's shouts are short recorded clips
// (assets/voice, embedded in the page). Starts only after the viewer taps the sound button.
export function buildAudio() {
  let AC = null, on = false, master = null, sfxBus = null, music = null, crowd = null, voiceBus = null, crowdGain = null, noiseGain = null, noiseBuf = null;
  let clips = null, decoding = null, speaking = null, duck = 1, sfx = null, sfxLast = {}, bedEnd = 0;
  // the player's own level for each group of sounds (settings screen), 0..1, applied after the mix below
  const vol = {music: 1, voice: 1, crowd: 1, sfx: 1}, userGain = {};
  const M = {next: 0, step: 0, bpm: 100, on: false, pi: null, piGain: null, piFilter: null, phrase: [], pi7: 0, seed: 7};
  const A = {
    get on() { return on; },
    get sfxReady() { return !!sfx; }, // the recorded fight sounds are decoded
    get vols() { return Object.assign({}, vol); },
    get musicOn() { return M.on || !!T.buf; }, // for checks
    get musicTrack() { return T.buf ? T.i : -1; },
    get sceneNow() { return SM.playing; },        // the scene piece that is playing (checks)
    get sceneReady() { return Object.keys(SM.buf); },
    get sceneVoices() { return SM.src.length; }, // two while one pass of the loop fades into the next
    scene(k) { SM.want = k || null; },            // which scene piece is wanted away from the ring (null: none)
    get crowdBed() { return bed.on; },
    setVol(k, v) { if (!(k in vol)) return; vol[k] = Math.max(0, Math.min(1, +v || 0)); if (userGain[k]) userGain[k].gain.setTargetAtTime(vol[k], AC.currentTime, .05); },
    time: () => (AC ? AC.currentTime : 0),
    toggle() {
      on = !on;
      if (on) {
        try {
          AC = AC || new (window.AudioContext || window.webkitAudioContext)(); AC.resume();
          if (!master) build();
          master.gain.value = .9;
          loadVoice(); loadSfx(); loadMusic();
        } catch (e) { on = false; }
      } else if (master) { master.gain.value = 0; stopPi(); }
      return on;
    },
    noise(len, type, freq, gain, q, sweepTo, bus, at) {
      if (!on) return; const t = at || AC.currentTime, s = AC.createBufferSource(); s.buffer = noiseBuf;
      const f = AC.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + len); f.Q.value = q || .7;
      const g = AC.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(.001, t + len);
      s.connect(f); f.connect(g); g.connect(bus || sfxBus); s.start(t, Math.random() * 1.5, len + .02);
    },
    tone(type, f0, f1, len, gain, delay, bus, attack) {
      if (!on) return; const t = AC.currentTime + (delay || 0), o = AC.createOscillator(), g = AC.createGain(); o.type = type;
      o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + len);
      if (attack) { g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + attack); } else g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(.0001, t + len); o.connect(g); g.connect(bus || sfxBus); o.start(t); o.stop(t + len + .02);
    },
    hit(kind, raw, quiet) {
      if (!on) return; const p = Math.min(1, raw / 26), v = quiet ? .5 : 1;
      if (sfx) { // recorded blows, layered: the skin, the weight behind it, and a low thump to feel it
        const g = (.38 + p * .62) * v;
        if (kind === 'punch') { sample('punch', g); if (p > .45) sample('thud', g * .55); }
        else if (kind === 'kick') { sample('slap', g); sample('thud', g * .75); }
        else if (kind === 'elbow') { sample('crack', g); sample('punch', g * .45); }
        else { sample('thud', g); sample('slap', g * .45); }
        A.tone('sine', kind === 'kick' ? 105 : 140, 42, .16, (.12 + p * .3) * v);
        return;
      }
      if (kind === 'punch') { A.noise(.09 + p * .05, 'lowpass', 1100, (.3 + p * .5) * v); A.tone('sine', 150, 48, .15, (.25 + p * .5) * v); }
      else if (kind === 'kick') { A.noise(.12 + p * .06, 'bandpass', 1500, (.35 + p * .5) * v, .6); A.tone('sine', 110, 38, .2, (.3 + p * .55) * v); }
      else if (kind === 'elbow') { A.noise(.05, 'highpass', 2400, (.3 + p * .4) * v); A.tone('triangle', 420, 90, .1, (.25 + p * .4) * v); A.tone('sine', 130, 50, .14, .3 * v); }
      else { A.noise(.1, 'lowpass', 600, (.3 + p * .4) * v); A.tone('sine', 95, 34, .24, (.4 + p * .5) * v); }
    },
    block() { if (sfx) { sample('block', .55); return; } A.noise(.06, 'bandpass', 2600, .22, 1.2); A.tone('sine', 220, 120, .06, .12); },
    whiff() { if (sfx) { sample('whoosh', .3, 4); return; } A.noise(.16, 'bandpass', 500, .1, 1.5, 1700); },
    swish(big) { if (sfx) { sample('whoosh', big ? .7 : .45, 0, 4); return; } A.noise(big ? .32 : .18, 'bandpass', 380, big ? .16 : .07, 1.4, big ? 2200 : 1300); },
    // The ring bell: a bronze bell struck with a hammer. Inharmonic partials with their own decays, a knock at the strike.
    bell(n) {
      if (!on) return;
      for (let i = 0; i < n; i++) {
        const d = i * .42;
        [[1, .22, 2.6], [2.32, .12, 1.8], [3.95, .08, 1.2], [5.4, .05, .8], [6.8, .03, .5]].forEach(([r, g, len]) => A.tone('sine', 640 * r, 0, len, g, d, sfxBus, .004));
        A.tone('sine', 640 * 1.003, 0, 2.4, .12, d, sfxBus, .004); // a second, slightly sharp hum makes it beat as real bells do
        A.noise(.04, 'bandpass', 3200, .25, 1, 0, sfxBus, AC.currentTime + d);
      }
    },
    // the referee's count: the recorded number when there is one, else a click
    count(n) { if (!on) return; if (clips && clips.count && clips.count[n - 1]) playClip(clips.count[n - 1], {bus: voiceBus, gain: .8}); else A.tone('square', 520, 0, .12, .06); },
    roar(v) {
      if (!on) return;
      if (sfx && sfx.swell && v >= .45) { // the crowd rising: a soft or a strong cheer, cut short for a smaller moment
        if (AC.currentTime < swellEnd - 1.5) return; // one swell at a time
        const b = sfx.swell[Math.min(sfx.swell.length - 1, v >= .75 ? 1 : 0)], len = Math.min(b.duration, 2.6 + v * 3.2), lvl = .3 + v * .45;
        const s = AC.createBufferSource(), g = AC.createGain(), t = AC.currentTime; s.buffer = b; s.connect(g); g.connect(crowd);
        g.gain.setValueAtTime(lvl, t); g.gain.setValueAtTime(lvl, t + len - .8); g.gain.linearRampToValueAtTime(0, t + len);
        s.start(t, 0, len + .05); swellEnd = t + len; return;
      }
      A.noise(.9 + v * .6, 'bandpass', 800, .12 + v * .2, .4, 1300, crowd);
      if (sfx && sfx.roar && v >= .7 && AC.currentTime > bedEnd) bedEnd = playClip(sfx.roar[0], {bus: crowd, gain: .35 + v * .25, lowpass: 2600})._end - 1; // the whole stand on its feet
    },
    applause() { if (on && sfx && sfx.applause && AC.currentTime > bedEnd) bedEnd = playClip(sfx.applause[0], {bus: crowd, gain: .8})._end - 1; },
    thud() { if (sfx) sample('fall', .9); else A.noise(.2, 'lowpass', 300, .5); A.tone('sine', 70, 30, .3, .6); },
    // The stand shouts as one ('เฮ้!') when a strike lands: the recorded shouts, stacked with small differences in pitch and timing.
    shout(v) {
      if (!on || !clips || !clips.shout0) return;
      const k = Math.random() < .75 ? 'shout0' : 'shout1', set = clips[k], n = 5 + Math.round(v * 7);
      for (let i = 0; i < n; i++) playClip(set[i % set.length], {bus: crowd, gain: (.08 + v * .07) * (.6 + Math.random() * .4), rate: .86 + Math.random() * .3, delay: Math.random() * .09, pan: Math.random() * 1.6 - .8, len: .75, lowpass: 2400 + Math.random() * 1500});
    },
    // commentary
    hasVoice: k => !!(clips && clips[k] && clips[k].length),
    voiceCount: k => (clips && clips[k] ? clips[k].length : 0),
    voiceLen: (k, i) => (clips && clips[k] && clips[k][i] ? clips[k][i].duration : 0),
    voice(k, i, cut) {
      if (cut && speaking) { try { const t = AC.currentTime, g = speaking._gain.gain; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0, t + .07); speaking.stop(t + .08); } catch (e) { /* already ended */ } } // a quick fade, not a click
      const buf = clips[k][i]; speaking = playClip(buf, {bus: voiceBus, gain: 1});
      return buf.duration;
    },
    // called every frame. pace 0..1 from the fight; phase: 'intro', 'fight', 'rest' or 'off'
    update(dt, hype, playing, round, pace, phase) {
      if (!on || !AC) return;
      const talking = speaking && speaking._end > AC.currentTime;
      duck += ((talking ? .55 : 1) - duck) * Math.min(1, dt * 6);
      if (sfx && sfx.cheer && !bed.on) bedStart();
      if (bed.on) bedTick();
      // the recorded crowd (CC-BY, see CREDITS.md) under everything, rising with the action; the made-up noise until it is decoded
      crowdGain.gain.setTargetAtTime(phase === 'off' ? 0 : (bed.on ? (playing ? .16 + hype * .42 : .07) : (playing ? .035 + hype * .16 : .02)) * duck, AC.currentTime, .25); // no crowd in the camp
      const playOn = phase === 'fight' || phase === 'intro'; // the ring music ends with the fight: the raised hand has the crowd alone (its own music is to come)
      // the recorded music is a soft bed under the commentary; the made-up pipe and drums stand in until it is decoded
      const lvl = T.tracks ? (phase === 'fight' ? .144 + (pace || 0) * .072 : .234) : .55; // a tenth quieter again (owner, round 58); the crowd is unchanged
      music.gain.setTargetAtTime((playOn ? lvl : 0) * duck, AC.currentTime, playOn ? .3 : .8);
      // Ringside music speeds up with the fight: slow and stately for the wai kru, then about 100 to 180 beats a minute.
      M.bpm = phase === 'intro' ? 84 : phase === 'cer' ? 126 : 100 + (pace || 0) * 66 + hype * 14 + (round - 1) * 4;
      if (playOn && T.tracks) { if (M.on) { M.on = false; stopPi(); } if (!T.buf) trackStart(); trackTick(); }
      else if (playOn) { if (!M.on) startMusic(); schedule(); }
      else { if (M.on) { M.on = false; stopPi(); } if (T.buf) trackStop(); }
      sceneTick(phase === 'off' || phase === 'cer' ? SM.want : null); // the camp, training, the raised hand: never over a round
    }
  };

  function build() {
    master = AC.createGain(); master.gain.value = .9;
    const comp = AC.createDynamicsCompressor(); comp.threshold.value = -10; comp.knee.value = 8; comp.ratio.value = 6; comp.attack.value = .003; comp.release.value = .2; // a stacked crowd shout or a pile-up of sounds never clips
    master.connect(comp); comp.connect(AC.destination);
    const bus = (g, k) => { const n = AC.createGain(), u = AC.createGain(); n.gain.value = g; u.gain.value = vol[k]; userGain[k] = u; n.connect(u); u.connect(master); return n; };
    sfxBus = bus(1, 'sfx'); music = bus(0, 'music'); crowd = bus(.9, 'crowd'); voiceBus = bus(1.1, 'voice');
    noiseBuf = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate);
    const d = noiseBuf.getChannelData(0); let last = 0;
    for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = (last + .04 * w) / 1.04; d[i] = last * 3 + w * .25; }
    const src = AC.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 650; bp.Q.value = .5;
    crowdGain = AC.createGain(); crowdGain.gain.value = 0; noiseGain = AC.createGain(); src.connect(bp); bp.connect(noiseGain); noiseGain.connect(crowdGain); crowdGain.connect(crowd); src.start();
  }
  // the recorded clips come in the page as base64 MP3, one list per line
  function loadVoice() {
    if (clips || decoding) return;
    const el = document.getElementById('voice-pack'); if (!el) return;
    const pack = JSON.parse(el.textContent), out = {};
    const dec = b64 => new Promise(res => { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); AC.decodeAudioData(u.buffer, res, () => res(null)); });
    decoding = Promise.all(Object.entries(pack).map(async ([k, list]) => { out[k] = (await Promise.all(list.map(dec))).filter(Boolean); })).then(() => { clips = out; });
  }
  // the crowd bed: the cheer recordings one after another, crossfaded, into crowdGain (which follows the fight)
  const bed = {on: false, next: 0, i: 0}; let swellEnd = 0;
  function bedStart() { bed.on = true; bed.next = AC.currentTime + .05; noiseGain.gain.setTargetAtTime(0, AC.currentTime, .5); }
  function bedTick() {
    const XB = 1.5;
    while (bed.next < AC.currentTime + .6) {
      const b = sfx.cheer[bed.i++ % sfx.cheer.length], s = AC.createBufferSource(), g = AC.createGain(), t0 = bed.next, d = b.duration;
      s.buffer = b; s.connect(g); g.connect(crowdGain);
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(1, t0 + XB); g.gain.setValueAtTime(1, t0 + d - XB); g.gain.linearRampToValueAtTime(0, t0 + d);
      s.start(t0); s.stop(t0 + d + .05); bed.next = t0 + d - XB;
    }
  }
  // recorded background music (assets/music, embedded as music-pack): each round takes the next track and loops it
  // with a crossfade, so a one-minute recording plays on without a seam
  const T = {tracks: null, buf: null, i: -1, next: 0, src: []}, XF = 2;
  function loadMusic() {
    if (T.tracks || T.loading) return; const el = document.getElementById('music-pack'); if (!el) return; T.loading = true;
    const list = (JSON.parse(el.textContent).track || []);
    Promise.all(list.map(b64 => new Promise(res => { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); AC.decodeAudioData(u.buffer, res, () => res(null)); })))
      .then(bufs => { bufs = bufs.filter(Boolean); if (bufs.length) T.tracks = bufs; });
  }
  function trackStart() { T.i = (T.i + 1) % T.tracks.length; T.buf = T.tracks[T.i]; T.next = AC.currentTime + .05; }
  function trackTick() {
    while (T.buf && T.next < AC.currentTime + .6) {
      const s = AC.createBufferSource(), g = AC.createGain(), t0 = T.next, dur = T.buf.duration;
      s.buffer = T.buf; s.connect(g); g.connect(music);
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(1, t0 + XF); g.gain.setValueAtTime(1, t0 + dur - XF); g.gain.linearRampToValueAtTime(0, t0 + dur);
      s.start(t0); s.stop(t0 + dur + .05); const x = {s, g}; T.src.push(x); s.onended = () => { T.src = T.src.filter(y => y !== x); };
      T.next = t0 + dur - XF;
    }
  }
  function trackStop() {
    const t = AC.currentTime;
    T.src.forEach(x => { x.g.gain.cancelScheduledValues(t); x.g.gain.setValueAtTime(x.g.gain.value, t); x.g.gain.linearRampToValueAtTime(0, t + 1.2); try { x.s.stop(t + 1.3); } catch (e) { /* already stopped */ } });
    T.src = []; T.buf = null;
  }
  // ---- scene music away from the ring (website only: tools/scene-music-import.mjs, docs/MUSIC_BRIEF.md) ----
  // One piece per scene: the camp, training, a quiet evening, fight night, the opening, a win, a loss. The page lists
  // them (scene-music: url, where the loop starts, its length, the crossfade, the level). A piece is fetched the first
  // time its scene comes up, plays from the top of its file, then loops from its loop point with a crossfade, so a win
  // starts on its fanfare and still goes on for as long as the result is on screen. It shares the music volume.
  const SM = {list: null, buf: {}, loading: {}, want: null, playing: null, src: [], next: 0, first: true, out: null};
  function sceneLoad(k) {
    if (SM.buf[k] || SM.loading[k]) return; SM.loading[k] = true;
    fetch(SM.list[k].url).then(r => r.ok ? r.arrayBuffer() : Promise.reject(new Error('HTTP ' + r.status))).then(b => new Promise((ok, no) => AC.decodeAudioData(b, ok, no)))
      .then(b => { SM.buf[k] = b; }, () => { setTimeout(() => { SM.loading[k] = false; }, 20000); }); // offline: try again later
  }
  function sceneStop(fade) {
    const t = AC.currentTime;
    SM.src.forEach(x => { x.g.gain.cancelScheduledValues(t); x.g.gain.setValueAtTime(x.g.gain.value, t); x.g.gain.linearRampToValueAtTime(0, t + fade); try { x.s.stop(t + fade + .1); } catch (e) { /* already stopped */ } });
    SM.src = []; SM.playing = null;
  }
  function sceneTick(want) {
    if (!SM.list) { const el = document.getElementById('scene-music'); SM.list = el ? JSON.parse(el.textContent) : {}; SM.out = AC.createGain(); SM.out.connect(userGain.music); }
    const k = want && SM.list[want] ? want : null;
    if (SM.playing && SM.playing !== k) sceneStop(.9);
    if (!k) return;
    if (!SM.buf[k]) { sceneLoad(k); return; }
    const d = SM.list[k], buf = SM.buf[k], now = AC.currentTime;
    if (SM.playing !== k || SM.next < now - 1) { if (SM.playing) sceneStop(.2); SM.playing = k; SM.first = true; SM.next = now + .12; } // new piece, or the sound was off for a while
    while (SM.next < now + .6) {
      // each pass ends xf seconds past the loop's end; the next one starts at the loop point as that tail fades
      const off = SM.first ? 0 : d.from, t0 = SM.next, len = Math.min(buf.duration, d.from + d.len + d.xf) - off, up = SM.first ? (d.from > 0 ? .05 : .8) : d.xf;
      const s = AC.createBufferSource(), g = AC.createGain(); s.buffer = buf; s.connect(g); g.connect(SM.out);
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(d.gain, t0 + up); g.gain.setValueAtTime(d.gain, t0 + len - d.xf); g.gain.linearRampToValueAtTime(0, t0 + len);
      s.start(t0, off, len + .05); const x = {s, g}; SM.src.push(x); s.onended = () => { SM.src = SM.src.filter(y => y !== x); };
      SM.next = t0 + len - d.xf; SM.first = false;
    }
  }
  function loadSfx() {
    if (sfx) return; const el = document.getElementById('sfx-pack'); if (!el) return;
    const pack = JSON.parse(el.textContent), out = {};
    const dec = b64 => new Promise(res => { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); AC.decodeAudioData(u.buffer, res, () => res(null)); });
    Promise.all(Object.entries(pack).map(async ([k, list]) => { out[k] = (await Promise.all(list.map(dec))).filter(Boolean); })).then(() => { if (out.punch && out.punch.length) sfx = out; });
  }
  // one recording from a set (from index a up to b), never the same one twice running, a little higher or lower each time
  function sample(set, gain, a, b) {
    const list = sfx && sfx[set]; if (!list || !list.length) return;
    const lo = a || 0, hi = Math.min(list.length, b || list.length); if (hi <= lo) return;
    let i = lo + Math.floor(Math.random() * (hi - lo)); if (i === sfxLast[set] && hi - lo > 1) i = lo + ((i - lo + 1) % (hi - lo)); sfxLast[set] = i;
    playClip(list[i], {bus: sfxBus, gain, rate: .93 + Math.random() * .14});
  }
    function playClip(buf, o) {
    const t = AC.currentTime + (o.delay || 0), s = AC.createBufferSource(); s.buffer = buf; s.playbackRate.value = o.rate || 1;
    let node = s;
    if (o.lowpass) { const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lowpass; node.connect(f); node = f; }
    const g = AC.createGain(); g.gain.setValueAtTime(o.gain, t);
    const len = Math.min(o.len || 99, buf.duration / (o.rate || 1));
    if (o.len) { g.gain.setValueAtTime(o.gain, t + len * .6); g.gain.exponentialRampToValueAtTime(.001, t + len); }
    node.connect(g); node = g;
    if (o.pan && AC.createStereoPanner) { const p = AC.createStereoPanner(); p.pan.value = o.pan; node.connect(p); node = p; }
    node.connect(o.bus); s.start(t); if (o.len) s.stop(t + len + .02);
    s._end = t + len; s._gain = g; return s;
  }

  // ---- ringside music ----
  // Thai tuning: seven roughly equal steps to the octave. The pi plays mostly on five of them.
  const SCALE = [0, 1, 2, 4, 5], BASE = 523;
  const pitch = deg => { const o = Math.floor(deg / 5), d = ((deg % 5) + 5) % 5; return BASE * Math.pow(2, o + SCALE[d] / 7); };
  const rnd = () => { M.seed = (M.seed * 16807) % 2147483647; return M.seed / 2147483647; };
  // a phrase is two bars of eighth notes: a short motif, said twice with a different ending, mostly stepping, ending long
  function newPhrase() {
    let d = 2 + Math.floor(rnd() * 4); const motif = [];
    for (let i = 0; i < 4; i++) { motif.push(rnd() < .2 ? null : d); d += rnd() < .5 ? (rnd() < .5 ? 1 : -1) : rnd() < .5 ? 2 : -2; d = Math.max(0, Math.min(8, d)); }
    const end = [d, d, rnd() < .5 ? d + 1 : d - 1, -1];
    M.phrase = motif.concat(motif.slice(0, 2), end.slice(0, 2), motif, end); // 16 eighths; -1 holds the note before
  }
  function startMusic() { M.on = true; M.next = AC.currentTime + .05; M.step = 0; newPhrase(); startPi(); }
  function startPi() {
    if (M.pi) return;
    // the pi: a double-reed oboe. Two slightly detuned saws through a nasal band, with vibrato and a little breath.
    const o1 = AC.createOscillator(), o2 = AC.createOscillator(), vib = AC.createOscillator(), vg = AC.createGain();
    o1.type = 'sawtooth'; o2.type = 'square'; o2.detune.value = 9; vib.frequency.value = 5.6; vg.gain.value = 7;
    vib.connect(vg); vg.connect(o1.frequency); vg.connect(o2.frequency);
    const bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 1.1;
    const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3800;
    const g = AC.createGain(); g.gain.value = 0;
    const mix2 = AC.createGain(); mix2.gain.value = .45;
    o1.connect(bp); o2.connect(mix2); mix2.connect(bp); bp.connect(lp); lp.connect(g); g.connect(music);
    o1.frequency.value = o2.frequency.value = pitch(3);
    [o1, o2, vib].forEach(o => o.start());
    M.pi = [o1, o2, vib]; M.piGain = g;
  }
  function stopPi() { if (!M.pi) return; const t = AC.currentTime; M.piGain.gain.setTargetAtTime(0, t, .08); M.pi.forEach(o => o.stop(t + .4)); M.pi = null; }
  function drum(t, f0, f1, len, g) { const o = AC.createOscillator(), e = AC.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + len); e.gain.setValueAtTime(g, t); e.gain.exponentialRampToValueAtTime(.0001, t + len); o.connect(e); e.connect(music); o.start(t); o.stop(t + len + .02); }
  function ching(t, open) { // two small cymbals: rung open ('ching') or clapped shut ('chap')
    [[2650, open ? .7 : .07, open ? .07 : .06], [3960, open ? .5 : .05, open ? .04 : .03], [5180, open ? .35 : .04, .02]].forEach(([f, len, g]) => {
      const o = AC.createOscillator(), e = AC.createGain(); o.type = 'triangle'; o.frequency.value = f; e.gain.setValueAtTime(g, t); e.gain.exponentialRampToValueAtTime(.0001, t + len); o.connect(e); e.connect(music); o.start(t); o.stop(t + len + .02);
    });
    if (!open) A.noise(.05, 'highpass', 5000, .05, .7, 0, music, t);
  }
  // look a little ahead and schedule the next eighth notes exactly on the audio clock
  function schedule() {
    const ahead = AC.currentTime + .12;
    while (M.next < ahead) {
      const t = M.next, s = M.step % 8, e8 = 60 / M.bpm / 2;
      // ching: open on the beat, shut on the off-beat of each bar (ching-chap, ching-chap)
      if (s === 0 || s === 4) ching(t, true); else if (s === 2 || s === 6) ching(t, false);
      // klong khaek: the low drum (tung) and the high drum (tak) answer each other
      if (s === 0 || s === 3 || s === 5) drum(t, 112, 62, .26, .32);
      if (s === 1 || s === 2 || s === 6 || (s === 7 && M.bpm > 140)) { drum(t, 300, 190, .1, .17); A.noise(.04, 'bandpass', 1800, .06, 1.5, 0, music, t); }
      if (s === 4 && M.bpm > 120) drum(t, 240, 150, .12, .12);
      // pi: one note of the phrase per eighth; a held note keeps sounding, a rest breathes
      const ph = M.phrase[M.step % 16];
      if (M.pi) {
        const g = M.piGain.gain;
        if (ph === null) g.setTargetAtTime(.0001, t, .02);
        else if (ph >= 0) {
          const f = pitch(ph), gr = rnd() < .25 ? pitch(ph + 1) : 0; // now and then a quick grace note from above
          M.pi.slice(0, 2).forEach(o => { if (gr) { o.frequency.setTargetAtTime(gr, t, .004); o.frequency.setTargetAtTime(f, t + e8 * .22, .012); } else o.frequency.setTargetAtTime(f, t, .012); });
          g.setTargetAtTime(.05, t, .01); g.setTargetAtTime(.075, t + .02, .03); // tongued start, then the full reed
        }
      }
      M.step++; if (M.step % 16 === 0) { if (rnd() < .45) newPhrase(); }
      M.next += e8;
    }
  }
  return A;
}
