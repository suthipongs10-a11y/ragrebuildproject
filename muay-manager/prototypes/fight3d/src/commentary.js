// Ringside commentary: short Thai lines read by a TTS voice (tools/tts-commentary.mjs makes the clips), played as the
// fight's events come up. Presentation only: it reads the event log and never decides anything.
// Lines name the corner, never the fighter, so one recording works for every fight.

// key: [lines] — several lines per key are taken in turn so the same call does not repeat back to back.
// hot: read with an excited delivery.
export const LINES = {
  intro:     {hot: 0, t: ['ไหว้ครูร่ายรำกันก่อนชกครับ', 'คู่นี้น่าสนใจมากครับ ไหว้ครูกันก่อน']},
  bell1:     {hot: 1, t: ['ระฆังยกแรกดังขึ้นแล้วครับ!']},
  round2:    {hot: 1, t: ['ยกที่สองครับ เริ่มเร่งกันแล้ว', 'เข้าสู่ยกที่สองครับ']},
  round3:    {hot: 1, t: ['ยกสุดท้ายแล้วครับ! ใครจะเอาชนะ', 'ยกที่สาม ยกตัดสินครับ!']},
  rest:      {hot: 0, t: ['หมดยกครับ พักให้น้ำ', 'หมดยกครับ']},
  decWait:   {hot: 0, t: ['ครบสามยก รอฟังผลการตัดสินครับ']},
  feel:      {hot: 0, t: ['ยกแรกยังดูเชิงกันอยู่ครับ', 'ต่างฝ่ายต่างยังไม่เปิดเกม', 'ตอดแย็บหาระยะกันอยู่ครับ', 'ยังวัดเชิงกันอยู่']},
  busy:      {hot: 1, t: ['แลกกันไม่มีใครยอมใคร!', 'เกมเริ่มดุเดือดแล้วครับ!', 'ยังสูสีกันมากครับ']},
  leadRed:   {hot: 0, t: ['มุมแดงเก็บแต้มนำอยู่ครับ']},
  leadBlue:  {hot: 0, t: ['มุมน้ำเงินเก็บแต้มนำอยู่ครับ']},
  punch:     {hot: 1, t: ['หมัดเข้าเต็มๆ!', 'หมัดตรงเข้าหน้า!']},
  hook:      {hot: 1, t: ['ฮุกเข้าไปแล้ว!']},
  upper:     {hot: 1, t: ['หมัดเสยเข้าคาง!']},
  bodyPunch: {hot: 1, t: ['หมัดเข้าลำตัว!']},
  elbow:     {hot: 1, t: ['ศอก! เข้าไปแล้ว!', 'ศอกเข้าเต็มๆ!']},
  knee:      {hot: 1, t: ['เข่าเข้าลำตัว!', 'ตีเข่าหนักมาก!']},
  bodyKick:  {hot: 1, t: ['เตะลำตัวเข้าเต็มๆ!', 'เตะเข้าชายโครง!']},
  highKick:  {hot: 1, t: ['เตะก้านคอ! เข้าไปแล้ว!']},
  lowKick:   {hot: 1, t: ['เตะขาหนักมาก!']},
  teep:      {hot: 1, t: ['ถีบเข้าไปเต็มๆ!']},
  counter:   {hot: 1, t: ['สวนกลับทันที!', 'สวนจังหวะสวยมาก!']},
  combo:     {hot: 1, t: ['เข้าเป็นชุด!', 'ต่อเนื่องเป็นชุดเลยครับ!']},
  special:   {hot: 1, t: ['ท่าไม้ตาย!']},
  block:     {hot: 0, t: ['ป้องกันไว้ได้', 'บังไว้ได้ครับ']},
  leanBack:  {hot: 1, t: ['เอนหลบสวยมาก!', 'หลบลูกเตะได้!']},
  catch:     {hot: 1, t: ['จับขาไว้ได้!']},
  clinch:    {hot: 0, t: ['เข้ากอดคอแล้วครับ', 'กอดคอปล้ำกันแล้ว']},
  clinchHit: {hot: 1, t: ['ตีเข่าในวงกอด!', 'ศอกในวงกอด!']},
  separate:  {hot: 0, t: ['กรรมการเข้าแยกครับ']},
  elbowOut:  {hot: 1, t: ['ศอกสวนหลุดวงกอด!']},
  throw:     {hot: 1, t: ['เหวี่ยงล้มลงไปเลย!']},
  teepDump:  {hot: 1, t: ['ถีบล้มก้นจ้ำเบ้า!']},
  stun:      {hot: 1, t: ['เมาหมัดแล้วครับ! ตามถล่ม!', 'ขาเริ่มไม่อยู่แล้ว!']},
  stunEnd:   {hot: 0, t: ['ตั้งหลักได้แล้วครับ']},
  kd:        {hot: 1, t: ['ล้มลงไปแล้วครับ! กรรมการเริ่มนับ!', 'ลงไปนอนแล้ว!']},
  getup:     {hot: 1, t: ['ลุกขึ้นมาได้ครับ สู้ต่อ!']},
  ko:        {hot: 1, t: ['น็อกเอาต์! จบแล้วครับ!', 'ลุกไม่ขึ้นแล้วครับ! จบแล้ว!']},
  winRed:    {hot: 1, t: ['มุมแดงชนะครับ!']},
  winBlue:   {hot: 1, t: ['มุมน้ำเงินชนะครับ!']},
  decRed:    {hot: 1, t: ['มุมแดงชนะคะแนนครับ!']},
  decBlue:   {hot: 1, t: ['มุมน้ำเงินชนะคะแนนครับ!']}
};
// the referee's count, in a second, plainer voice
export const COUNT = ['หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า', 'สิบ'];
// one shout from the crowd, recorded by several voices and stacked to sound like a stand full of people
export const SHOUT = ['เฮ้!', 'โอ้!'];
// voices on the Cartesia account: the commentator, the referee, and the people whose shouts make the crowd
export const VOICES = {
  caller: '5de076e9-7b28-4442-b279-e7d80d573505',   // upbeat adult male
  referee: 'aaa0bf6d-bc07-40f2-bc6b-66afc5fd42f6',  // clear adult male
  crowd: ['5de076e9-7b28-4442-b279-e7d80d573505', 'aaa0bf6d-bc07-40f2-bc6b-66afc5fd42f6', 'a50a04b8-35ee-487e-8b87-97f0eee68a64', 'ccc7bb22-dcd0-42e4-822e-0731b950972f']
};

// Which line a hit calls for, if it is worth a call at all
function hitLine(e, M) {
  if (e.special) return 'special';
  if (e.counter && e.sev >= 2) return 'counter';
  if (e.chain === 3) return 'combo';
  if (e.sev < 2) return null;
  const k = e.move, m = M[k];
  if (m.inClinch) return 'clinchHit';
  if (m.sfx === 'elbow') return 'elbow';
  if (k === 'knee') return 'knee';
  if (k === 'high') return 'highKick';
  if (k === 'body') return 'bodyKick';
  if (k === 'low') return 'lowKick';
  if (k === 'teep' || k === 'teepFace') return 'teep';
  if (k === 'hook') return 'hook';
  if (k === 'upper') return 'upper';
  if (m.lvl === 'body') return 'bodyPunch';
  return 'punch';
}
const PRI = {ko: 3, kd: 3, winRed: 3, winBlue: 3, decRed: 3, decBlue: 3, special: 2, stun: 2, throw: 2, teepDump: 2, elbowOut: 2, getup: 2, bell1: 2, round2: 2, round3: 2, decWait: 2};

// voice: the audio module. Call event(e) for each event as playback reaches it, update(t) every frame.
export function buildCommentary(audio, MOVES) {
  const C = {on: true}, turn = {};
  let busyTo = 0, lastHitCall = -9, lastLine = -9, curPri = 0, round = 1;
  function say(key, now, force) {
    if (!C.on || !audio.on || !audio.hasVoice(key)) return false;
    const p = PRI[key] || (key === 'feel' || key === 'busy' || key.startsWith('lead') ? 0 : 1);
    if (now < busyTo && !(force || p >= curPri + 2)) return false;
    if (now < lastLine + .5 && !force) return false;
    const n = audio.voiceCount(key), i = (turn[key] = ((turn[key] ?? -1) + 1) % n);
    const dur = audio.voice(key, i, now < busyTo);   // cuts the line in progress when it overrides it
    busyTo = now + dur + .25; lastLine = now; curPri = p;
    return true;
  }
  C.event = function (e, now, ctx) {
    switch (e.type) {
      case 'phase':
        if (e.phase === 'fight') { round = e.round; say(e.round === 1 ? 'bell1' : e.round === 2 ? 'round2' : 'round3', now, true); }
        else if (e.phase === 'rest') say('rest', now, true);
        else if (e.phase === 'dec') say('decWait', now, true);
        break;
      case 'hit': {
        if (e.res === 'dodge' && /^(high|spKick|body|teepFace)$/.test(e.move) && Math.random() < .5) { say('leanBack', now); break; }
        if (e.res === 'block' && e.special) { say('block', now); break; }
        if (e.res === 'catch') { say('catch', now); break; }
        if (e.res !== 'hit') break;
        const k = hitLine(e, MOVES); if (!k) break;
        if (k !== 'special' && now - lastHitCall < 2.6) break; // calls on every shot would be noise
        if (say(k, now)) lastHitCall = now;
        break;
      }
      case 'clinch': say('clinch', now); break;
      case 'break': say(e.reason === 'elbow' ? 'elbowOut' : 'separate', now); break;
      case 'throw': if (e.ok) say(e.teep ? 'teepDump' : 'throw', now); break;
      case 'stun': say('stun', now); break;
      case 'stun_end': if (!e.bell) say('stunEnd', now); break;
      case 'kd': say('kd', now, true); break;
      case 'count': audio.count(e.n); break;
      case 'getup': if (!e.thrown) say('getup', now); break;
      case 'ko': say('ko', now, true); setTimeout(() => say(e.by ? 'winBlue' : 'winRed', audio.time(), true), 1900); break;
      case 'decision': say(e.w ? 'decBlue' : 'decRed', now, true); break;
    }
  };
  // between exchanges: a line now and then so the quiet stretches are not silent
  C.update = function (now, ctx) {
    if (!ctx.fighting || now < busyTo + 4.5 || now < lastLine + 7) return;
    if (ctx.lead >= 0 && ctx.margin >= 6 && Math.random() < .35) say(ctx.lead ? 'leadBlue' : 'leadRed', now);
    else say(ctx.pace < .5 ? 'feel' : 'busy', now);
  };
  C.intro = now => say('intro', now, true);
  return C;
}
