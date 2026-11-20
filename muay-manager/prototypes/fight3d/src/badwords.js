// Words a fighter's name may not hold, and that are masked in the world chat. Shared by the game (src/) and the server
// (functions/api/), so both judge a name the same way. No DOM, no imports.
//
// Kept short on purpose. Thai is written without spaces, so a word is looked for inside other words, and a long list
// would catch ordinary ones: "แม่ง" is inside "แม่งาน" (an organiser), "จิ๋ม" and "หำ" are everyday nicknames, "ควาย"
// is in the name of a real player ("ควายขาว"). Add a word only after checking it is not part of a common one.
export const BAD_WORDS = [
  'ควย', 'เย็ด', 'เหี้ย', 'หีแม่', 'หน้าหี', 'อีดอก', 'ไอ้สัส', 'ไอสัส', 'อีสัส', 'ไอ้สัตว์', 'อีสัตว์', 'ไอ้ควาย', 'อีควาย',
  'พ่อมึง', 'แม่มึง', 'กะหรี่', 'ส้นตีน', 'เงี่ยน', 'ร่าน', 'แตด', 'ชาติหมา',
  'fuck', 'shit', 'bitch', 'cunt', 'nigger', 'nigga', 'pussy', 'whore', 'slut', 'asshole', 'porn', 'penis'
];
// what a name becomes when it holds one of them
export const NAME_STANDIN = 'นักมวยนิรนาม';

const LEET = {'0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's', '!': 'i'};
// Letters only, in lower case: spaces, dots and marks put between the letters do not hide a word. The usual stand-ins
// for Latin letters are read as letters, and mai tri (๊) as mai tho (้): "เหี๊ย" is "เหี้ย".
export function normWord(s) {
  return String(s == null ? '' : s).toLowerCase().replace(/[0-9@$!]/g, c => LEET[c] || '').replace(/๊/g, '้').replace(/[^a-zก-๎]/g, '');
}
const NORM = BAD_WORDS.map(normWord);
export const hasBad = s => { const n = normWord(s); return !!n && NORM.some(w => n.includes(w)); };
// A chat line: each word as written is masked with ***; a line that still hides one (spelled out with gaps) is masked whole.
export function maskBad(s) {
  let t = String(s == null ? '' : s);
  for (const w of BAD_WORDS) t = t.split(new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')).join('***');
  return hasBad(t) ? '***' : t;
}
// The names inside a stored record (a ranking row, a challenge, a cup entry): any that holds a bad word is replaced.
const NAME_KEYS = new Set(['name', 'toName', 'first', 'n']);
export function scrubNames(o, depth = 0) {
  if (!o || typeof o !== 'object' || depth > 6) return o;
  for (const k of Object.keys(o)) {
    const v = o[k];
    if (typeof v === 'string') { if (NAME_KEYS.has(k) && hasBad(v)) o[k] = NAME_STANDIN; }
    else if (v && typeof v === 'object') scrubNames(v, depth + 1);
  }
  return o;
}
