// Ringside commentary: short Thai lines read by a TTS voice (tools/tts-commentary.mjs makes the clips with Gemini), played as the
// fight's events come up. Presentation only: it reads the event log and never decides anything.
// Lines name the corner, never the fighter, so one recording works for every fight.

// key: [lines] — several lines per key are taken in turn so the same call does not repeat back to back.
// hot: how it is read. 0 calm and clear (reading the fight), 1 excited (a clean shot), 2 shouting (the big moments).
export const LINES = {
  intro:     {hot: 0, t: ['ไหว้ครูร่ายรำกันก่อนชกครับ', 'คู่นี้น่าสนใจมากครับ ไหว้ครูกันก่อน', 'สวัสดีครับแฟนมวย คู่ต่อไปขึ้นเวทีแล้วครับ', 'ทั้งคู่ขึ้นเวทีแล้วครับ ร่ายรำไหว้ครูตามประเพณี']},
  bell1:     {hot: 1, t: ['ระฆังยกแรกดังขึ้นแล้วครับ!', 'เริ่มแล้วครับ ยกที่หนึ่ง!', 'ระฆังดัง! เปิดฉากกันแล้วครับ!']},
  round2:    {hot: 1, t: ['ยกที่สองครับ เริ่มเร่งกันแล้ว!', 'เข้าสู่ยกที่สองครับ!', 'ยกสองมาแล้ว! เกมเริ่มเดือดครับ!', 'ระฆังยกสอง! ต้องเก็บแต้มกันแล้วครับ!']},
  round3:    {hot: 2, t: ['ยกสุดท้ายแล้วครับ! ใครจะเอาชนะ!', 'ยกที่สาม ยกตัดสินครับ!', 'ยกสุดท้าย! ใส่กันให้หมดครับ!', 'ยกสุดท้าย! ชี้เป็นชี้ตายกันยกนี้ครับ!']},
  rest:      {hot: 0, t: ['หมดยกครับ พักให้น้ำ', 'หมดยกครับ', 'ระฆังหมดยก พี่เลี้ยงเข้าให้น้ำครับ', 'หมดยกแล้วครับ กลับเข้ามุมไปฟังแผนจากพี่เลี้ยง']},
  decWait:   {hot: 0, t: ['ครบสามยก รอฟังผลการตัดสินครับ', 'ครบยกแล้วครับ ลุ้นคะแนนจากกรรมการ', 'ชกกันครบสามยก มาฟังคำตัดสินกันครับ']},
  feel:      {hot: 0, t: ['ยกแรกยังดูเชิงกันอยู่ครับ', 'ต่างฝ่ายต่างยังไม่เปิดเกม', 'ตอดแย็บหาระยะกันอยู่ครับ', 'ยังวัดเชิงกันอยู่', 'ยังคุมเชิงกันอยู่ครับ รอจังหวะ', 'โยกหาจังหวะกันอยู่ครับ', 'ยังไม่มีใครเสี่ยงเปิดก่อนครับ']},
  busy:      {hot: 1, t: ['แลกกันไม่มีใครยอมใคร!', 'เกมเริ่มดุเดือดแล้วครับ!', 'ยังสูสีกันมากครับ!', 'ใส่กันไม่ยั้งเลยครับ!', 'เดินแลกกันสนุกมากครับ!', 'คนดูลุกขึ้นเชียร์กันทั้งสนามแล้วครับ!']},
  close:     {hot: 0, t: ['แต้มสูสีมากครับ ยังชี้ขาดไม่ได้', 'คะแนนเบียดกันมากครับ', 'ยังกินกันไม่ขาดครับ ต้องลุ้นกันต่อ']},
  leadRed:   {hot: 0, t: ['มุมแดงเก็บแต้มนำอยู่ครับ', 'ตอนนี้มุมแดงทำแต้มได้ดีกว่าครับ', 'มุมแดงออกอาวุธเข้าเป้าชัดกว่าครับ']},
  leadBlue:  {hot: 0, t: ['มุมน้ำเงินเก็บแต้มนำอยู่ครับ', 'ตอนนี้มุมน้ำเงินทำแต้มได้ดีกว่าครับ', 'มุมน้ำเงินออกอาวุธเข้าเป้าชัดกว่าครับ']},
  behindRed: {hot: 1, t: ['มุมแดงแต้มตามอยู่ ต้องเร่งเครื่องแล้วครับ!', 'มุมแดงต้องเดินแล้วครับ แต้มยังตาม!']},
  behindBlue:{hot: 1, t: ['มุมน้ำเงินแต้มตามอยู่ ต้องเร่งเครื่องแล้วครับ!', 'มุมน้ำเงินต้องเดินแล้วครับ แต้มยังตาม!']},
  leadChange:{hot: 1, t: ['พลิกกลับมานำแล้วครับ!', 'แต้มพลิกแล้วครับ! เกมเปลี่ยน!']},
  timeLow:   {hot: 1, t: ['สิบวินาทีสุดท้ายของยกแล้วครับ!', 'ใกล้หมดยกแล้ว! เร่งกันหน่อยครับ!']},
  punch:     {hot: 1, t: ['หมัดเข้าเต็มๆ!', 'หมัดตรงเข้าหน้า!', 'หมัดเข้าปลายคาง!', 'ต่อยเข้าไปจังๆ!']},
  hook:      {hot: 1, t: ['ฮุกเข้าไปแล้ว!', 'ฮุกเข้ากกหู!', 'เหวี่ยงฮุกเข้าเต็มหน้า!']},
  upper:     {hot: 1, t: ['หมัดเสยเข้าคาง!', 'เสยปลายคางเข้าไป!', 'อัปเปอร์คัตเข้าเต็มๆ!']},
  bodyPunch: {hot: 1, t: ['หมัดเข้าลำตัว!', 'ต่อยท้องเข้าไปจุกเลย!', 'หมัดเข้าชายโครง!']},
  elbow:     {hot: 1, t: ['ศอก! เข้าไปแล้ว!', 'ศอกเข้าเต็มๆ!', 'ตีศอกเข้าหน้า!', 'ศอกตัดเข้าไป! อันตรายมาก!']},
  knee:      {hot: 1, t: ['เข่าเข้าลำตัว!', 'ตีเข่าหนักมาก!', 'เข่าตรงเข้าท้อง!', 'แทงเข่าเข้าไปจุกๆ!']},
  bodyKick:  {hot: 1, t: ['เตะลำตัวเข้าเต็มๆ!', 'เตะเข้าชายโครง!', 'เตะตัดลำตัว เสียงดังสนั่น!', 'หน้าแข้งฟาดเข้าลำตัว!']},
  highKick:  {hot: 2, t: ['เตะก้านคอ! เข้าไปแล้ว!', 'ก้านคอ! เต็มๆ เลยครับ!', 'เตะสูงเข้าขากรรไกร!']},
  lowKick:   {hot: 1, t: ['เตะขาหนักมาก!', 'เตะตัดขาเข้าไป!', 'เตะขาอีกแล้ว! เก็บขาไปเรื่อยๆ!']},
  teep:      {hot: 1, t: ['ถีบเข้าไปเต็มๆ!', 'ถีบเข้าท้อง! ผงะเลย!', 'ถีบสกัดไว้ได้สวย!']},
  counter:   {hot: 1, t: ['สวนกลับทันที!', 'สวนจังหวะสวยมาก!', 'โดนสวนเข้าเต็มๆ!', 'ชิงจังหวะสวนได้ก่อน!']},
  combo:     {hot: 1, t: ['เข้าเป็นชุด!', 'ต่อเนื่องเป็นชุดเลยครับ!', 'ออกอาวุธเป็นชุด เข้าหมดเลย!', 'หนึ่ง สอง สาม! เข้าครบชุด!']},
  special:   {hot: 2, t: ['ท่าไม้ตาย!', 'ปล่อยไม้ตายออกมาแล้ว!', 'โอ้โห! ลูกไม้มวยไทย!']},
  bigHit:    {hot: 2, t: ['โอ้โห! หนักมาก!', 'เต็มๆ เลยครับ!', 'เข้าไปจังๆ! สะเทือนเลย!', 'อู้ฮู! ลูกนี้หนัก!']},
  block:     {hot: 0, t: ['ป้องกันไว้ได้', 'บังไว้ได้ครับ', 'การ์ดแน่นมากครับ', 'ยกแขนบังไว้ทัน']},
  leanBack:  {hot: 1, t: ['เอนหลบสวยมาก!', 'หลบลูกเตะได้!', 'เอนตัวหลบ เฉียดไปนิดเดียว!']},
  bellyBack: {hot: 1, t: ['โก่งตัวหลบลูกเตะ!', 'หดท้องหลบได้ทัน!']},
  slip:      {hot: 1, t: ['โยกหลบสวย!', 'หลบหมัดได้!', 'มุดหลบ! หมัดวืดไป!']},
  check:     {hot: 0, t: ['ยกเข่าบังไว้ได้', 'ยกขาบังลูกเตะไว้ครับ', 'บังแข้งไว้ได้ทัน']},
  catch:     {hot: 1, t: ['จับขาไว้ได้!', 'จับขาได้แล้ว! อันตราย!']},
  clinch:    {hot: 0, t: ['เข้ากอดคอแล้วครับ', 'กอดคอปล้ำกันแล้ว', 'เข้าวงในแล้วครับ ปล้ำกันนัว', 'ล็อกคอได้แล้วครับ']},
  clinchHit: {hot: 1, t: ['ตีเข่าในวงกอด!', 'ศอกในวงกอด!', 'โน้มคอตีเข่า!', 'ตีเข่าไม่ยั้งเลย!']},
  separate:  {hot: 0, t: ['กรรมการเข้าแยกครับ', 'กรรมการสั่งแยก', 'แยกออกมาตั้งหลักใหม่ครับ']},
  elbowOut:  {hot: 1, t: ['ศอกสวนหลุดวงกอด!', 'งัดศอกสวนออกมา!']},
  throw:     {hot: 1, t: ['เหวี่ยงล้มลงไปเลย!', 'ปล้ำเหวี่ยงลงไปกองกับพื้น!', 'เหวี่ยงทิ้ง! ได้แต้มไปเต็มๆ!']},
  teepDump:  {hot: 1, t: ['ถีบล้มก้นจ้ำเบ้า!', 'ถีบกระเด็นลงไปนั่งเลย!']},
  legHurt:   {hot: 1, t: ['ขาเริ่มไม่ไหวแล้วครับ โดนเตะสะสมมาเยอะ!', 'เดินกะเผลกแล้วครับ ขาโดนเก็บไปเยอะ!']},
  bodyHurt:  {hot: 1, t: ['ลำตัวโดนสะสมมาเยอะแล้วครับ เริ่มหมดแรง!', 'โดนเข้าท้องบ่อยมาก เริ่มแผ่วแล้วครับ!']},
  stun:      {hot: 2, t: ['เมาหมัดแล้วครับ! ตามถล่ม!', 'ขาเริ่มไม่อยู่แล้ว!', 'ออกอาการแล้ว! เซเลยครับ!', 'ตาลอยแล้วครับ! ต้องรีบตามซ้ำ!']},
  stunEnd:   {hot: 0, t: ['ตั้งหลักได้แล้วครับ', 'ประคองตัวรอดมาได้ครับ', 'ฟื้นตัวกลับมาได้แล้ว']},
  kd:        {hot: 2, t: ['ล้มลงไปแล้วครับ! กรรมการเริ่มนับ!', 'ลงไปนอนแล้ว!', 'ร่วงลงไปกองกับพื้นเวที!', 'ล้ม! ล้มแล้วครับ! กรรมการนับ!']},
  getup:     {hot: 1, t: ['ลุกขึ้นมาได้ครับ สู้ต่อ!', 'ลุกขึ้นมาแล้ว! ใจสู้มากครับ!', 'ยังไหวครับ! ลุกขึ้นมาสู้ต่อ!']},
  ko:        {hot: 2, t: ['น็อกเอาต์! จบแล้วครับ!', 'ลุกไม่ขึ้นแล้วครับ! จบแล้ว!', 'น็อก! น็อกไปแล้วครับพี่น้อง!', 'หลับกลางอากาศ! จบการชก!']},
  winRed:    {hot: 2, t: ['มุมแดงชนะครับ!', 'ชัยชนะเป็นของมุมแดง!', 'มุมแดงชูมือเป็นผู้ชนะครับ!']},
  winBlue:   {hot: 2, t: ['มุมน้ำเงินชนะครับ!', 'ชัยชนะเป็นของมุมน้ำเงิน!', 'มุมน้ำเงินชูมือเป็นผู้ชนะครับ!']},
  decRed:    {hot: 2, t: ['มุมแดงชนะคะแนนครับ!', 'กรรมการให้มุมแดงชนะคะแนน!']},
  decBlue:   {hot: 2, t: ['มุมน้ำเงินชนะคะแนนครับ!', 'กรรมการให้มุมน้ำเงินชนะคะแนน!']}
};
// the referee's count, in a second, plainer voice
export const COUNT = ['หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า', 'สิบ'];
// one shout from the crowd, recorded by several voices and stacked to sound like a stand full of people
export const SHOUT = ['เฮ้!', 'โอ้!'];
// Voices (Gemini TTS prebuilt voices, tools/tts-commentary.mjs): the commentator, the referee, and the people whose
// shouts make the crowd. STYLE is how each kind of line is asked for: Gemini reads the direction and speaks only the line.
export const VOICES = {caller: 'Fenrir', referee: 'Charon', crowd: ['Puck', 'Orus', 'Kore', 'Zephyr']};
export const STYLE = [
  'Say in Thai as a calm, confident Muay Thai ringside TV commentator reading the fight for the viewers, clear and brisk',
  'Say in Thai as a Muay Thai ringside TV commentator who is very excited: loud, fast and punchy, as a clean shot lands right in front of him',
  'Shout in Thai as a Muay Thai ringside TV commentator at the absolute peak of excitement: voice high and cracking, stretching the key word, breathless, like a knockout in a title fight'
];
export const STYLE_COUNT = 'Say in Thai as a boxing referee counting over a fallen fighter: loud, firm, one short word', STYLE_SHOUT = 'Shout in Thai, one short burst at the top of the voice, like a fan at ringside';

// Which line a hit calls for, if it is worth a call at all
function hitLine(e, M, big) {
  if (e.special) return 'special';
  if (e.counter && e.sev >= 2) return 'counter';
  if (e.chain === 3) return 'combo';
  if (e.sev < 2) return null;
  if (big && e.sev >= 3 && Math.random() < .4) return 'bigHit'; // the weight of it, not the weapon (once that line is recorded)
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
  let busyTo = 0, lastHitCall = -9, lastLine = -9, curPri = 0, round = 1, later = null, last = {lead: -1, margin: 0};
  const worn = [{leg: 0, body: 0}, {leg: 0, body: 0}], said = {}; // blows taken to the legs and the body, and one-off calls already made
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
        if (e.phase === 'fight') {
          round = e.round; said.timeLow = false; if (round === 1) { worn[0].leg = worn[0].body = worn[1].leg = worn[1].body = 0; said.leg0 = said.leg1 = said.body0 = said.body1 = false; }
          say(e.round === 1 ? 'bell1' : e.round === 2 ? 'round2' : 'round3', now, true);
          if (e.round === 3 && last.lead >= 0 && last.margin >= 5) later = {key: last.lead ? 'behindRed' : 'behindBlue', at: now + 3.2}; // who has to chase in the last round
        }
        else if (e.phase === 'rest') say('rest', now, true);
        else if (e.phase === 'dec') say('decWait', now, true);
        break;
      case 'hit': {
        if (e.res === 'dodge') { const r = Math.random(); if (/^(high|spKick|teepFace)$/.test(e.move) && r < .5) say('leanBack', now); else if (/^(body|teep|knee)$/.test(e.move) && r < .5) say('bellyBack', now); else if (r < .3) say('slip', now); break; }
        if (e.res === 'block' && (e.move === 'body' || e.move === 'low') && Math.random() < .25) { say('check', now); break; }
        if (e.res === 'block' && e.special) { say('block', now); break; }
        if (e.res === 'catch') { say('catch', now); break; }
        if (e.res !== 'hit') break;
        const m0 = MOVES[e.move], w = worn[e.on]; // the leg kicks and the body shots add up
        if (m0 && w) { if (e.move === 'low') w.leg++; else if (m0.lvl === 'body') w.body++;
          if (w.leg === 5 && !said['leg' + e.on]) { said['leg' + e.on] = true; later = {key: 'legHurt', at: now + 1.2}; }
          else if (w.body === 7 && !said['body' + e.on]) { said['body' + e.on] = true; later = {key: 'bodyHurt', at: now + 1.2}; } }
        const k = hitLine(e, MOVES, audio.hasVoice('bigHit')); if (!k) break;
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
      case 'ko': say('ko', now, true); break; // the winner is named when the referee raises his hand
      case 'decision': say(e.w ? 'decBlue' : 'decRed', now, true); break;
    }
  };
  // between exchanges: a line now and then so the quiet stretches are not silent
  C.update = function (now, ctx) {
    if (!ctx.fighting) return;
    // the points swinging over, the last seconds of a round, and a call that was waiting its turn
    const swung = last.lead >= 0 && ctx.lead >= 0 && ctx.lead !== last.lead && ctx.margin >= 2; last = {lead: ctx.lead, margin: ctx.margin};
    if (swung && now > busyTo && say('leadChange', now)) return;
    if (ctx.clock != null && ctx.clock <= 10 && ctx.clock > 6 && !said.timeLow && now > busyTo) { said.timeLow = true; if (say('timeLow', now)) return; }
    if (later && now >= later.at && now > busyTo) { const k = later.key; later = null; if (say(k, now)) return; }
    if (now < busyTo + 4.5 || now < lastLine + 7) return;
    if (ctx.lead >= 0 && ctx.margin >= 6 && Math.random() < .35) say(ctx.lead ? 'leadBlue' : 'leadRed', now);
    else if (round > 1 && ctx.margin < 3 && Math.random() < .3) say('close', now);
    else say(ctx.pace < .5 ? 'feel' : 'busy', now);
  };
  C.intro = now => say('intro', now, true);
  C.win = (w, now) => say(w ? 'winBlue' : 'winRed', now, true);
  return C;
}
