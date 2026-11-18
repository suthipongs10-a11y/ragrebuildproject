// Ringside commentary: short Thai lines read by a TTS voice (tools/tts-commentary.mjs makes the clips with Gemini), played as the
// fight's events come up. Presentation only: it reads the event log and never decides anything.
// Lines name the corner, never the fighter, so one recording works for every fight.
// Every line has to be true of the picture at the moment it is said: a key is only used for the events all of its lines fit
// (the slip lines for a slipped punch, the lean lines for a lean back, "counted out" only after a count of ten), so a new
// line goes under the key whose events it fits, or under a new key with its own condition below.

// key: [lines] — several lines per key are taken in turn so the same call does not repeat back to back.
// hot: how it is read. 0 calm and clear (reading the fight), 1 excited (a clean shot), 2 shouting (the big moments).
export const LINES = {
  // the scenes around the fight
  intro:     {hot: 0, t: ['ไหว้ครูกันก่อนชกครับ', 'สวัสดีครับแฟนมวย', 'คู่นี้น่าดูมากครับ', 'ขึ้นเวทีไหว้ครูแล้วครับ']},                                                   // short: the wai kru is three seconds, then the bell
  bell1:     {hot: 1, t: ['ระฆังยกแรกดังขึ้นแล้วครับ!', 'เริ่มแล้วครับ ยกที่หนึ่ง!', 'ระฆังดัง! เปิดฉากกันแล้วครับ!']},
  round2:    {hot: 1, t: ['ยกที่สองครับ เริ่มเร่งกันแล้ว!', 'เข้าสู่ยกที่สองครับ!', 'ยกสองมาแล้ว! เกมเริ่มเดือดครับ!', 'ระฆังยกสอง! ต้องเก็บแต้มกันแล้วครับ!']},
  round3:    {hot: 2, t: ['ยกสุดท้ายแล้วครับ! ใครจะเอาชนะ!', 'ยกที่สาม ยกตัดสินครับ!', 'ยกสุดท้าย! ใส่กันให้หมดครับ!', 'ยกสุดท้าย! ชี้เป็นชี้ตายกันยกนี้ครับ!']},
  rest:      {hot: 0, t: ['หมดยกครับ พักให้น้ำ', 'หมดยกครับ', 'ระฆังหมดยก พี่เลี้ยงเข้าให้น้ำครับ', 'หมดยกแล้วครับ กลับเข้ามุมไปฟังแผนจากพี่เลี้ยง']},
  corner:    {hot: 0, t: ['พี่เลี้ยงให้น้ำ เช็ดเหงื่อ นวดน้ำมันกันเต็มที่ครับ', 'ให้น้ำกันก่อนครับ แล้วนวดน้ำมันคลายกล้ามเนื้อ', 'พี่เลี้ยงเร่งมือกันใหญ่เลยครับ ทั้งให้น้ำ ทั้งนวด']}, // seated: said over the drink, as the towel and the oil come out
  cornerOut: {hot: 1, t: ['หมดเวลาพักแล้วครับ ออกมาสู้กันต่อ!', 'พร้อมแล้วครับ! ลุกออกจากมุมแล้ว!']},                                                     // they stand up from the stools
  decWait:   {hot: 0, t: ['ครบสามยก รอฟังผลการตัดสินครับ', 'ครบยกแล้วครับ ลุ้นคะแนนจากกรรมการ', 'ชกกันครบสามยก มาฟังคำตัดสินกันครับ']},
  // reading the fight
  feel1:     {hot: 0, t: ['ยกแรกยังดูเชิงกันอยู่ครับ', 'ยกแรก ต่างคนต่างหยั่งเชิงกันก่อนครับ']},                                                              // round 1 only
  feel:      {hot: 0, t: ['ต่างฝ่ายต่างยังไม่เปิดเกม', 'ขยับหาระยะกันอยู่ครับ', 'ยังวัดเชิงกันอยู่', 'ยังคุมเชิงกันอยู่ครับ รอจังหวะ', 'โยกหาจังหวะกันอยู่ครับ', 'ยังไม่มีใครเสี่ยงเปิดก่อนครับ']},
  busy:      {hot: 1, t: ['แลกกันไม่มีใครยอมใคร!', 'เกมเริ่มดุเดือดแล้วครับ!', 'ยังสูสีกันมากครับ!', 'ใส่กันไม่ยั้งเลยครับ!', 'เดินแลกกันสนุกมากครับ!', 'คนดูลุกขึ้นเชียร์กันทั้งสนามแล้วครับ!']},
  close:     {hot: 0, t: ['แต้มสูสีมากครับ ยังชี้ขาดไม่ได้', 'คะแนนเบียดกันมากครับ', 'ยังกินกันไม่ขาดครับ ต้องลุ้นกันต่อ']},
  leadRed:   {hot: 0, t: ['มุมแดงเก็บแต้มนำอยู่ครับ', 'ตอนนี้มุมแดงทำแต้มได้ดีกว่าครับ', 'มุมแดงออกอาวุธเข้าเป้าชัดกว่าครับ']},
  leadBlue:  {hot: 0, t: ['มุมน้ำเงินเก็บแต้มนำอยู่ครับ', 'ตอนนี้มุมน้ำเงินทำแต้มได้ดีกว่าครับ', 'มุมน้ำเงินออกอาวุธเข้าเป้าชัดกว่าครับ']},
  behindRed: {hot: 1, t: ['มุมแดงแต้มตามอยู่ ต้องเร่งเครื่องแล้วครับ!', 'มุมแดงต้องเดินแล้วครับ แต้มยังตาม!']},
  behindBlue:{hot: 1, t: ['มุมน้ำเงินแต้มตามอยู่ ต้องเร่งเครื่องแล้วครับ!', 'มุมน้ำเงินต้องเดินแล้วครับ แต้มยังตาม!']},
  leadChange:{hot: 1, t: ['พลิกกลับมานำแล้วครับ!', 'แต้มพลิกแล้วครับ! เกมเปลี่ยน!']},
  timeLow10: {hot: 1, t: ['สิบวินาทีสุดท้ายของยกแล้วครับ!']},                                                                                              // the clock reads ten to nine
  timeLow:   {hot: 1, t: ['ใกล้หมดยกแล้ว! เร่งกันหน่อยครับ!', 'เวลาเหลือน้อยแล้วครับ! ใครจะเก็บแต้มได้อีก!']},
  // a blow that lands, by weapon and target
  punch:     {hot: 1, t: ['หมัดเข้าเต็มๆ!', 'หมัดตรงเข้าหน้า!', 'หมัดเข้าปลายคาง!', 'ต่อยเข้าไปจังๆ!']},                                                      // jab or cross to the head
  hook:      {hot: 1, t: ['ฮุกเข้าไปแล้ว!', 'ฮุกเข้ากกหู!', 'เหวี่ยงฮุกเข้าเต็มหน้า!']},
  upper:     {hot: 1, t: ['หมัดเสยเข้าคาง!', 'เสยปลายคางเข้าไป!', 'อัปเปอร์คัตเข้าเต็มๆ!']},
  bodyPunch: {hot: 1, t: ['หมัดเข้าลำตัว!', 'ต่อยท้องเข้าไปจุกเลย!', 'หมัดเข้าชายโครง!']},
  catchHit:  {hot: 1, t: ['จับขาแล้วชกสวนเข้าไป!', 'จับขาไว้ได้ ซัดหมัดสวนทันที!']},                                                                      // a punch thrown while holding the caught leg
  elbow:     {hot: 1, t: ['ศอก! เข้าไปแล้ว!', 'ศอกเข้าเต็มๆ!', 'ตีศอกเข้าหน้า!', 'ศอกตัดเข้าไป! อันตรายมาก!']},
  knee:      {hot: 1, t: ['เข่าเข้าลำตัว!', 'ตีเข่าหนักมาก!', 'เข่าตรงเข้าท้อง!', 'แทงเข่าเข้าไปจุกๆ!']},
  bodyKick:  {hot: 1, t: ['เตะลำตัวเข้าเต็มๆ!', 'เตะเข้าชายโครง!', 'เตะตัดลำตัว เสียงดังสนั่น!', 'หน้าแข้งฟาดเข้าลำตัว!']},
  highKick:  {hot: 2, t: ['เตะก้านคอ! เข้าไปแล้ว!', 'ก้านคอ! เต็มๆ เลยครับ!', 'เตะสูงเข้าขากรรไกร!']},
  lowKick:   {hot: 1, t: ['เตะขาหนักมาก!', 'เตะตัดขาเข้าไป!', 'เตะขาเข้าเต็มแข้ง!']},
  lowKickMore:{hot: 1, t: ['เตะขาอีกแล้ว! เก็บขาไปเรื่อยๆ!', 'เตะขาซ้ำเข้าไปอีกดอก!']},                                                                   // the third leg kick taken and after
  teep:      {hot: 1, t: ['ถีบเข้าไปเต็มๆ!', 'ถีบเข้าท้อง! ผงะเลย!', 'ถีบสกัดไว้ได้สวย!']},                                                                 // push kick to the stomach
  teepFace:  {hot: 1, t: ['ถีบหน้า! เข้าเต็มๆ!', 'ถีบเข้าหน้าเลยครับ!']},
  counter:   {hot: 1, t: ['สวนกลับทันที!', 'สวนจังหวะสวยมาก!', 'โดนสวนเข้าเต็มๆ!', 'ชิงจังหวะสวนได้ก่อน!']},
  combo:     {hot: 1, t: ['เข้าเป็นชุด!', 'ต่อเนื่องเป็นชุดเลยครับ!', 'ออกอาวุธเป็นชุด เข้าหมดเลย!', 'หนึ่ง สอง สาม! เข้าครบชุด!']},                           // the third blow of a chain lands
  special:   {hot: 2, t: ['ท่าไม้ตาย!', 'ปล่อยไม้ตายออกมาแล้ว!', 'โอ้โห! ลูกไม้มวยไทย!']},
  spChop:    {hot: 2, t: ['ศอกสับ! ลงมาเต็มๆ!', 'ศอกสับ! ไม้ตายเข้าเป้า!']},                                                                              // each trick by its own name
  spKick:    {hot: 2, t: ['เตะก้านคอสายฟ้า! เร็วมาก!', 'ก้านคอสายฟ้า! เข้าเต็มๆ!']},
  spFly:     {hot: 2, t: ['เข่าลอย! เข้าเต็มๆ!', 'กระโดดเข่าลอย! สวยงามมาก!']},
  spCroc:    {hot: 2, t: ['จระเข้ฟาดหาง! เข้าเต็มๆ!', 'หมุนตัวจระเข้ฟาดหาง! โอ้โห!']},
  spHanu:    {hot: 2, t: ['หนุมานถวายแหวน! เสยเข้าปลายคาง!', 'หนุมานถวายแหวน! แม่ไม้มวยไทยแท้ๆ!']},
  bigHit:    {hot: 2, t: ['โอ้โห! หนักมาก!', 'เต็มๆ เลยครับ!', 'เข้าไปจังๆ! สะเทือนเลย!', 'โอ้โห! ลูกนี้หนักจริงๆ!']},
  // a blow that does not land, by how he got out of it (the pose on screen)
  block:     {hot: 0, t: ['ป้องกันไว้ได้', 'บังไว้ได้ครับ', 'การ์ดแน่นมากครับ', 'ยกแขนบังไว้ทัน']},                                                          // arms up against a trick at the head
  check:     {hot: 0, t: ['ยกเข่าบังไว้ได้', 'ยกขาบังลูกเตะไว้ครับ', 'บังแข้งไว้ได้ทัน']},                                                                   // the lifted knee against a body or leg kick
  leanBack:  {hot: 1, t: ['เอนหลบสวยมาก!', 'เอนตัวหลบ เฉียดไปนิดเดียว!', 'เอนหลบได้ทัน! หวุดหวิดมาก!']},
  duck:      {hot: 1, t: ['มุดหลบได้สวย!', 'ก้มหลบ! วืดไปเลยครับ!']},
  slip:      {hot: 1, t: ['โยกหลบสวย!', 'หลบหมัดได้!', 'โยกหัวหลบ! หมัดวืดไป!']},                                                                          // a straight punch slipped
  bellyKick: {hot: 1, t: ['โก่งตัวหลบลูกเตะ!', 'โก่งหลบ! ลูกเตะเฉียดท้องไปนิดเดียว!']},                                                                    // the belly bowed back from a body kick
  bellyBack: {hot: 1, t: ['หดท้องหลบได้ทัน!', 'โก่งตัวหลบได้สวย!']},                                                                                     // the same from a push kick or a knee
  dodge:     {hot: 1, t: ['หลบได้ทัน!', 'วืด! ไม่โดนครับ!']},
  catch:     {hot: 1, t: ['จับขาไว้ได้!', 'จับขาได้แล้ว! อันตราย!']},                                                                                     // a body kick caught
  // the clinch
  clinch:    {hot: 0, t: ['เข้ากอดคอแล้วครับ', 'กอดคอปล้ำกันแล้ว', 'เข้าวงในแล้วครับ ปล้ำกันนัว', 'ล็อกคอได้แล้วครับ']},
  clinchKnee:{hot: 1, t: ['ตีเข่าในวงกอด!', 'ตีเข่าไม่ยั้งเลย!', 'เข่าเข้าลำตัวในวงกอด!']},
  clinchKneeHead:{hot: 1, t: ['โน้มคอตีเข่า!', 'กดคอลงมาตีเข่า!']},
  clinchElbow:{hot: 1, t: ['ศอกในวงกอด!', 'ศอกสั้นในวงใน! เข้าเต็มๆ!']},
  separate:  {hot: 0, t: ['กรรมการเข้าแยกครับ', 'กรรมการสั่งแยก', 'แยกออกมาตั้งหลักใหม่ครับ']},
  escape:    {hot: 1, t: ['สะบัดหลุดออกมาได้!', 'ดิ้นหลุดจากวงกอดแล้วครับ!']},
  elbowOut:  {hot: 1, t: ['ศอกสวนหลุดวงกอด!', 'งัดศอกสวนออกมา!']},
  throw:     {hot: 1, t: ['เหวี่ยงล้มลงไปเลย!', 'ปล้ำเหวี่ยงลงไปกองกับพื้น!', 'เหวี่ยงทิ้ง! ได้แต้มไปเต็มๆ!']},
  throwFail: {hot: 0, t: ['ยืนหลักแน่นครับ เหวี่ยงไม่ล้ม', 'เหวี่ยงไม่ลงครับ หลักดีมาก']},
  teepDump:  {hot: 1, t: ['ถีบล้มก้นจ้ำเบ้า!', 'ถีบกระเด็นลงไปนั่งเลย!']},
  // damage and the end
  legHurt:   {hot: 1, t: ['ขาเริ่มไม่ไหวแล้วครับ โดนเตะสะสมมาเยอะ!', 'ขาโดนเก็บไปหลายดอกแล้วครับ เริ่มออกอาการ!']},
  bodyHurt:  {hot: 1, t: ['ลำตัวโดนสะสมมาเยอะแล้วครับ เริ่มหมดแรง!', 'โดนเข้าท้องบ่อยมาก เริ่มแผ่วแล้วครับ!']},
  stunPunch: {hot: 2, t: ['เมาหมัดแล้วครับ! ตามถล่ม!']},                                                                                                // dazed by a punch
  stun:      {hot: 2, t: ['ขาเริ่มไม่อยู่แล้ว!', 'ออกอาการแล้ว! เซเลยครับ!', 'ตาลอยแล้วครับ! ต้องรีบตามซ้ำ!']},
  stunEnd:   {hot: 0, t: ['ตั้งหลักได้แล้วครับ', 'ประคองตัวรอดมาได้ครับ', 'ฟื้นตัวกลับมาได้แล้ว']},
  kd:        {hot: 2, t: ['ล้มลงไปแล้วครับ! กรรมการเริ่มนับ!', 'ลงไปนอนแล้ว!', 'ร่วงลงไปกองกับพื้นเวที!', 'ล้ม! ล้มแล้วครับ! กรรมการนับ!']},
  getup:     {hot: 1, t: ['ลุกขึ้นมาได้ครับ สู้ต่อ!', 'ลุกขึ้นมาแล้ว! ใจสู้มากครับ!', 'ยังไหวครับ! ลุกขึ้นมาสู้ต่อ!']},
  ko:        {hot: 2, t: ['น็อกเอาต์! จบแล้วครับ!', 'ลุกไม่ขึ้นแล้วครับ! จบแล้ว!', 'น็อก! น็อกไปแล้วครับพี่น้อง!']},                                         // counted out at ten
  koFlash:   {hot: 2, t: ['หลับกลางอากาศ! จบการชก!', 'น็อกคาที่! ไม่ต้องนับเลยครับ!']},                                                                   // out on the blow itself, no count
  tko:       {hot: 2, t: ['กรรมการยุติการชก! ทีเคโอครับ!', 'ล้มสามครั้ง! กรรมการไม่ให้ชกต่อแล้วครับ!']},                                                     // the third knockdown
  winRed:    {hot: 2, t: ['มุมแดงชนะครับ!', 'ชัยชนะเป็นของมุมแดง!', 'มุมแดงชูมือเป็นผู้ชนะครับ!']},
  winBlue:   {hot: 2, t: ['มุมน้ำเงินชนะครับ!', 'ชัยชนะเป็นของมุมน้ำเงิน!', 'มุมน้ำเงินชูมือเป็นผู้ชนะครับ!']},
  decRed:    {hot: 2, t: ['มุมแดงชนะคะแนนครับ!', 'กรรมการให้มุมแดงชนะคะแนน!']},
  decBlue:   {hot: 2, t: ['มุมน้ำเงินชนะคะแนนครับ!', 'กรรมการให้มุมน้ำเงินชนะคะแนน!']},
  // a draw: the announcement when the cards are read, then the longer word as the referee lifts both arms
  decDraw:   {hot: 1, t: ['เสมอกันครับ! แต้มเท่ากันพอดี', 'กรรมการให้เสมอกันครับ!']},
  draw:      {hot: 1, t: ['เสมอกันครับ ไม่มีใครยอมใครเลยจริง ๆ คู่นี้ สูสีมากจนสุดท้ายเสมอกัน แบบนี้ต้องมีไฟต์ล้างตากันใหม่ครับท่านผู้ชม', 'สูสีกันทั้งสามยกครับ สุดท้ายเสมอกัน ไม่มีใครยอมใครเลย คู่นี้ต้องเจอกันใหม่แน่นอนครับ']}
};
// A key whose clips are missing (the short voice pack of the claude.ai page) borrows the FIRST line of the plainer key
// beside it, so that first line has to be true of both: "the push kick lands" for a push kick to the face as well.
export const FALLBACK = {feel1: 'feel', timeLow10: 'timeLow', lowKickMore: 'lowKick', teepFace: 'teep', spChop: 'special', spKick: 'special', spFly: 'special', spCroc: 'special', spHanu: 'special',
  bellyKick: 'bellyBack', duck: 'dodge', clinchKneeHead: 'clinchKnee', stunPunch: 'stun', koFlash: 'ko', tko: 'ko', catchHit: 'counter',
  decDraw: 'close', draw: 'close'}; // until the draw lines are recorded, a draw is called with a "too close to call" line
// the referee's count, in a second, plainer voice
export const COUNT = ['หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า', 'สิบ'];
// one shout from the crowd, recorded by several voices and stacked to sound like a stand full of people
export const SHOUT = ['เฮ้!', 'โอ้!'];
// Voices (Gemini TTS prebuilt voices, tools/tts-commentary.mjs): the commentator, the referee, and the people whose
// shouts make the crowd. STYLE is how each kind of line is delivered: Gemini 3.8 TTS takes it beside the words, never reads it.
export const VOICES = {caller: 'Fenrir', referee: 'Charon', crowd: ['Puck', 'Orus', 'Kore', 'Zephyr']};
export const STYLE = {
  0: 'Thai boxing TV commentator reading the fight for the viewers: lively and warm, confident, brisk, never flat',
  1: 'Thai boxing TV commentator, very excited, loud, fast and punchy, the call bursts out',
  2: 'Thai boxing TV commentator screaming at the absolute peak of excitement, voice high and cracking, stretching the key word, breathless',
  count: 'boxing referee counting over a fallen fighter: loud, firm, clipped, barked',
  shout: 'fight fan at ringside: one short burst shouted at the top of the voice'
};

// Which line a hit calls for, if it is worth a call at all. has(key): are there clips for it; legs: leg kicks this man has taken
function hitLine(e, M, has, legs) {
  const k = e.move, m = M[k];
  if (m.throw || k === 'clinchElbowUp') return null;   // the throw and the break that follow carry the call
  if (e.special) return has(k) ? k : 'special';
  if (e.counter && e.sev >= 2) return 'counter';
  if (e.chain === 3) return 'combo';
  if (e.sev < 2) return null;
  if (e.sev >= 3 && has('bigHit') && Math.random() < .4) return 'bigHit'; // the weight of it, not the weapon
  if (k === 'catchPunch' || k === 'catchBody') return 'catchHit';
  if (m.inClinch) return k === 'clinchElbow' ? 'clinchElbow' : k === 'clinchKneeHead' ? 'clinchKneeHead' : 'clinchKnee';
  if (m.sfx === 'elbow') return 'elbow';
  if (k === 'knee') return 'knee';
  if (k === 'high') return 'highKick';
  if (k === 'body') return 'bodyKick';
  if (k === 'low') return legs >= 3 ? 'lowKickMore' : 'lowKick';
  if (k === 'teep') return 'teep';
  if (k === 'teepFace') return 'teepFace';
  if (k === 'hook') return 'hook';
  if (k === 'upper') return 'upper';
  if (m.lvl === 'body') return 'bodyPunch';
  return 'punch';
}
// How a blow that missed was avoided, from the pose the picture shows (timeline.js evadePose)
function evadeLine(e, pose) {
  if (pose === 'leanBack') return 'leanBack';
  if (pose === 'duck') return 'duck';
  if (pose === 'hipBack') return e.move === 'body' ? 'bellyKick' : 'bellyBack';
  if (pose === 'slipL' || pose === 'slipR') return 'slip';
  return 'dodge';
}
export const PRI = {ko: 3, koFlash: 3, tko: 3, kd: 3, winRed: 3, winBlue: 3, decRed: 3, decBlue: 3, decDraw: 3, draw: 3, special: 2, spChop: 2, spKick: 2, spFly: 2, spCroc: 2, spHanu: 2, stun: 2, stunPunch: 2, throw: 2, teepDump: 2, elbowOut: 2,
  getup: 2, bell1: 2, round2: 2, round3: 2, decWait: 2};
const CUTS = {ko: 1, koFlash: 1, tko: 1, kd: 1}; // these break into whatever is being said; every other forced line waits for the sentence to end
const SEAT_CARE = .8, ROOM = {corner: 3.3, score: 2.3}; // seconds seated before the corner work is described; the time a line needs before they stand up

// voice: the audio module. Call event(e) for each event as playback reaches it, update(t) every frame of the fight, tick(t) every frame.
export function buildCommentary(audio, MOVES) {
  const C = {on: true, log: null}, turn = {};
  let busyTo = 0, lastHitCall = -9, lastLine = -9, curPri = 0, round = 1, later = null, queued = null, last = {lead: -1, margin: 0}, counted = 0, cs = {}, bell = null, floor = false; // bell: seconds left in the round; floor: a man is down or the fight is decided
  const worn = [{leg: 0, body: 0}, {leg: 0, body: 0}], said = {}, lastBlow = [null, null]; // blows taken to the legs and the body, one-off calls already made, the last blow each man took
  const has = k => audio.hasVoice(k);
  const next = key => { const n = audio.voiceCount(key); return ((turn[key] ?? Math.floor(Math.random() * n) - 1) + 1) % n; };
  function play(key, now, p, asked) {
    const i = asked ? 0 : turn[key] = next(key); // a borrowed key gives its first line only
    const dur = audio.voice(key, i, now < busyTo);   // cuts the line in progress when it overrides it
    busyTo = now + dur + .25; lastLine = now; curPri = p;
    if (C.log) C.log(key, i, now, dur, asked || key);
    return true;
  }
  function say(key, now, force) {
    if (!C.on || !audio.on) return false;
    let asked = null;
    while (!has(key) && FALLBACK[key]) { asked = asked || key; key = FALLBACK[key]; }
    if (!has(key)) return false;
    const p = PRI[key] || (key === 'feel' || key === 'feel1' || key === 'busy' || key === 'corner' || key.startsWith('lead') ? 0 : 1);
    if (now < busyTo - .2 && !CUTS[key] && (force || p < curPri + 2)) {
      if (force) queued = {key, p, asked}; // a scene line never chops a sentence: it follows it
      return !!force;
    }
    // an ordinary call has to be over by the bell, so the end of the round is called on time
    if (!force && p < 2 && bell != null && audio.voiceLen && audio.voiceLen(key, asked ? 0 : next(key)) > bell + .3) return false;
    if (now < lastLine + .5 && !force) return false;
    queued = null;
    return play(key, now, p, asked);
  }
  // every frame, in every scene: the line that was waiting for the last one to end
  C.tick = function (now) { if (queued && now >= busyTo - .2) { const q = queued; queued = null; if (C.on && audio.on && has(q.key)) play(q.key, now, q.p, q.asked); } };
  // pose: for a blow that was dodged, how (timeline.js evadePose), so the words fit the picture
  C.event = function (e, now, pose) {
    switch (e.type) {
      case 'phase':
        if (e.phase === 'fight') {
          round = e.round; bell = 99; floor = false; said.timeLow = false; if (round === 1) { worn[0].leg = worn[0].body = worn[1].leg = worn[1].body = 0; said.leg0 = said.leg1 = said.body0 = said.body1 = false; }
          say(e.round === 1 ? 'bell1' : e.round === 2 ? 'round2' : 'round3', now, true);
          if (e.round === 3 && last.lead >= 0 && last.margin >= 5) later = {key: last.lead ? 'behindRed' : 'behindBlue', at: now + 3.2}; // who has to chase in the last round
        }
        else if (e.phase === 'rest') { later = null; bell = null; say('rest', now, true); }
        else if (e.phase === 'dec') { later = null; bell = null; say('decWait', now, true); }
        break;
      case 'hit': {
        if (e.res === 'dodge') { const k = evadeLine(e, pose); if (Math.random() < (k === 'slip' || k === 'dodge' || k === 'duck' ? .3 : .5)) say(k, now); break; }
        if (e.res === 'block' && (e.move === 'body' || e.move === 'low') && Math.random() < .25) { say('check', now); break; }
        if (e.res === 'block' && e.special) { say('block', now); break; }
        if (e.res === 'catch') { say('catch', now); break; }
        if (e.res !== 'hit') break;
        const m0 = MOVES[e.move], w = worn[e.on]; lastBlow[e.on] = e.move; // the leg kicks and the body shots add up
        if (m0 && w) { if (e.move === 'low') w.leg++; else if (m0.lvl === 'body') w.body++;
          if (w.leg === 5 && !said['leg' + e.on]) { said['leg' + e.on] = true; later = {key: 'legHurt', at: now + 1.2}; }
          else if (w.body === 7 && !said['body' + e.on]) { said['body' + e.on] = true; later = {key: 'bodyHurt', at: now + 1.2}; } }
        const k = hitLine(e, MOVES, has, w ? w.leg : 0); if (!k) break;
        if (!e.special && now - lastHitCall < 2.6) break; // calls on every shot would be noise
        if (say(k, now)) lastHitCall = now;
        break;
      }
      case 'clinch': say('clinch', now); break;
      case 'break': say(e.reason === 'elbow' ? 'elbowOut' : e.reason === 'escape' ? 'escape' : 'separate', now); break;
      case 'throw': say(e.ok ? (e.teep ? 'teepDump' : 'throw') : 'throwFail', now); break;
      case 'stun': { const m = MOVES[lastBlow[e.on]]; said['stun' + e.on] = say(m && m.sfx === 'punch' && Math.random() < .5 ? 'stunPunch' : 'stun', now); break; }
      case 'stun_end': if (!e.bell && said['stun' + e.on]) say('stunEnd', now); said['stun' + e.on] = false; break; // "he has recovered" only if we said he was dazed
      case 'kd': counted = 0; later = null; bell = null; floor = true; say('kd', now, true); break; // the count stops the clock, and the small talk
      case 'count': counted = e.n; audio.count(e.n); break;
      case 'getup': if (!e.thrown) { floor = false; say('getup', now); } break;
      case 'ko': later = null; floor = true; say(e.how === 'ทีเคโอ' ? 'tko' : counted >= 10 ? 'ko' : 'koFlash', now, true); counted = 0; break; // the winner is named when the referee raises his hand
      case 'decision': floor = true; say(e.w < 0 ? 'decDraw' : e.w ? 'decBlue' : 'decRed', now, true); break;
    }
  };
  // between exchanges: a line now and then so the quiet stretches are not silent
  C.update = function (now, ctx) {
    C.tick(now);
    if (!ctx.fighting || floor) return; // a man on the floor, or the fight decided: nothing but the count and the call
    if (ctx.clock != null) bell = ctx.clock;
    // the points swinging over, the last seconds of a round, and a call that was waiting its turn
    const swung = last.lead >= 0 && ctx.lead >= 0 && ctx.lead !== last.lead && ctx.margin >= 2; last = {lead: ctx.lead, margin: ctx.margin};
    if (swung && now > busyTo && say('leadChange', now)) return;
    if (ctx.clock != null && ctx.clock <= 10.3 && ctx.clock > 6 && !said.timeLow && now > busyTo) { said.timeLow = true; if (say(ctx.clock >= 8.8 ? 'timeLow10' : 'timeLow', now)) return; }
    if (later && now >= later.at && now > busyTo && ctx.clock >= 3) { const k = later.key; later = null; if (say(k, now)) return; }
    if (now < busyTo + 4.5 || now < lastLine + 7 || ctx.clock < 3) return; // nothing new just before the bell: the end of the round is called on time
    if (ctx.lead >= 0 && ctx.margin >= 6 && Math.random() < .35) say(ctx.lead ? 'leadBlue' : 'leadRed', now);
    else if (round > 1 && ctx.margin < 3 && Math.random() < .3) say('close', now);
    else say(ctx.pace < .5 ? (round === 1 && Math.random() < .5 ? 'feel1' : 'feel') : 'busy', now);
  };
  // The rest between rounds, on the corner scene's clock: seated = seconds on the stool (negative while walking in),
  // standIn = seconds until they are told to stand (null while the break is held open). The drink, the towel and the
  // oil are described as they happen, then the score, then the walk out; a line that cannot finish in time is left out.
  C.corner = function (seated, standIn, now, ctx) {
    C.tick(now);
    if (seated < 0) { cs = {}; return; }
    if (now < busyTo || queued) return;
    const room = standIn == null ? 99 : standIn;
    if (room <= 0) { if (!cs.out) { cs.out = true; say('cornerOut', now); } return; }
    if (!cs.care) { if (seated >= SEAT_CARE) { cs.care = true; if (room >= ROOM.corner) say('corner', now); } }
    else if (!cs.score && ctx) { cs.score = true; if (room >= ROOM.score) say(ctx.margin >= 3 && ctx.lead >= 0 ? (ctx.lead ? 'leadBlue' : 'leadRed') : 'close', now); }
  };
  C.intro = now => say('intro', now, true);
  C.win = (w, now) => say(w ? 'winBlue' : 'winRed', now, true);
  C.draw = now => say('draw', now, true);
  return C;
}
