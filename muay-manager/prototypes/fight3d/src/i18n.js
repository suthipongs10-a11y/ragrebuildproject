// Languages. The game is written in Thai; another language is put on the page as it is shown: every Thai text that
// reaches the screen (a text node, or a placeholder / title / aria-label) is looked up in that language's catalog and
// replaced. Nothing in the game's logic changes: the code keeps comparing and storing its Thai strings (a fight's
// "คะแนน", the log of past fights), so a missing translation can only leave Thai on the screen, never break a rule.
//
// A catalog maps Thai to the other language (src/lang/en.json). A key is matched against the whole text of a node, spaces
// tidied. A key may hold slots: {n} a number (1,200 · 3.5 · +12 · 40%), {s} a phrase that is itself looked up (a venue
// inside a sentence: the line fits only when that phrase has a line of its own), {x} text kept as it is (a fighter's name).
// The value puts them back as {1}, {2}… in its own order. Thai left on the
// screen is counted (window.__i18n.miss) for tools/e2e/lang.mjs, which lists what still needs a line.
// The language is the device's choice (localStorage muayLang, or ?lang=en); with none chosen, Chinese for a device set to
// Chinese, otherwise Thai.
const KEY = 'muayLang', TH = /[\u0e01-\u0e3a\u0e40-\u0e5b]/, /* Thai letters and marks, not the baht sign (English keeps it) */ ATTRS = ['placeholder', 'title', 'aria-label'];
export const LANGS = {th: 'ไทย', en: 'English', zh: '中文'};
let lang = 'th', exact = new Map(), tpls = [], loose = [], names = {};
const miss = new Map();
const norm = s => s.replace(/\s+/g, ' ').trim();
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function pickLang() {
  let l = null;
  try { const q = new URLSearchParams(location.search).get('lang'); if (q && LANGS[q]) { l = q; localStorage.setItem(KEY, q); } } catch (e) { /* no URL */ }
  if (!l) try { l = localStorage.getItem(KEY); } catch (e) { /* blocked storage: Thai */ }
  // nothing chosen yet: a device set to Chinese starts in Chinese (Simplified; the only Chinese there is)
  if (!l) try { if ((navigator.languages || [navigator.language]).some(x => /^zh/i.test(x || ''))) l = 'zh'; } catch (e) { /* no navigator */ }
  return LANGS[l] ? l : 'th';
}
export const getLang = () => lang;
// the device's choice; the page is loaded again so every text starts from the Thai it was written in
export function chooseLang(l) { if (!LANGS[l]) return; try { localStorage.setItem(KEY, l); } catch (e) { /* this visit only */ } location.reload(); }

export function useCatalog(l, cat, nameParts) {
  lang = l; exact = new Map(); tpls = []; loose = []; names = nameParts || {};
  if (l === 'th' || !cat) return;
  for (const k of Object.keys(cat)) {
    const key = norm(k), v = cat[k];
    if (!/\{[nsx]\}/.test(key)) { exact.set(key, v); continue; }
    const parts = key.split(/(\{[nsx]\})/), re = new RegExp('^' + parts.map(p => (p === '{n}' ? '([-+\u2212]?\\d[\\d,.]*%?)' : p === '{s}' || p === '{x}' ? '(.+?)' : esc(p))).join('') + '$'), kinds = parts.filter(p => /^\{[nsx]\}$/.test(p));
    const t = {re, v, kinds, pre: parts[0], fixed: parts.filter(p => !/^\{[nsx]\}$/.test(p)).join('').length, open: kinds.filter(k => k !== '{n}').length};
    (t.pre ? tpls : loose).push(t);
  }
  // the more particular line wins: the longest fixed start first, then the most fixed text ("{s} อารมณ์ดีขึ้นเป็น ..." before "{s} {s}")
  const order = (a, b) => b.fixed - a.fixed || a.open - b.open; // then the fewer free phrases ({n} only takes a number)
  tpls.sort((a, b) => b.pre.length - a.pre.length || order(a, b)); loose.sort(order);
  if (typeof document !== 'undefined') document.documentElement.lang = l;
}
// a fighter's name the game made (every part known), spelled in the language's letters; null for anything else
const nameOf = k => { const p = k.split(' '); return p.length <= 3 && p.every(w => names[w] != null) ? p.map(w => names[w]).join(' ') : null; };
// one text in the language on screen, or null when the catalog has no line for it
export function tr(text) {
  const k = norm(text); if (!k) return null;
  const hit = exact.get(k); if (hit != null) return hit;
  const nm = nameOf(k); if (nm != null) return nm;
  for (const list of [tpls, loose]) for (const t of list) {
    if (t.pre && !k.startsWith(t.pre)) continue;
    const m = t.re.exec(k); if (!m) continue;
    const got = []; let ok = true; // each {s} needs a line of its own, or this template does not fit
    for (let i = 1; i < m.length; i++) { const v = m[i]; if (t.kinds[i - 1] === '{s}' && TH.test(v)) { const w = tr(v); if (w == null) { ok = false; break; } got.push(w); } else got.push(t.kinds[i - 1] === '{x}' ? (nameOf(norm(v)) ?? v) : v); }
    if (!ok) continue;
    return t.v.replace(/\{(\d+)\}/g, (x, i) => (got[i - 1] != null ? got[i - 1] : ''));
  }
  return null;
}
// for text the code draws itself (a canvas, the tab's title): Thai with {name} slots filled from vars, then shown in the language
export function T(th, vars) {
  let s = lang === 'th' ? th : (exact.get(norm(th)) ?? tr(th) ?? th);
  if (vars) s = s.replace(/\{(\w+)\}/g, (x, k) => (vars[k] != null ? vars[k] : x));
  return s;
}

function note(text) { const k = norm(text); if (k) miss.set(k, (miss.get(k) || 0) + 1); }
// A text already put in the language is left alone: writing it again would wake the watch again (a line that keeps some
// Thai, such as a name or "ไทย" itself, would go round for ever).
const done = new WeakMap();
function fixText(node) {
  const v = node.nodeValue; if (!v || !TH.test(v) || done.get(node) === v) return;
  const out = tr(v); if (out == null) { note(v); done.set(node, v); return; }
  const lead = v.match(/^\s*/)[0], trail = v.match(/\s*$/)[0], nv = lead + out + trail;
  done.set(node, nv); if (nv !== v) node.nodeValue = nv;
}
function fixAttrs(el) {
  for (const a of ATTRS) {
    const v = el.getAttribute && el.getAttribute(a); if (!v || !TH.test(v)) continue;
    const out = tr(v); if (out == null) note(v); else if (out !== v) el.setAttribute(a, out);
  }
}
export function translateTree(root) {
  if (lang === 'th' || !root) return;
  if (root.nodeType === 3) { fixText(root); return; }
  if (root.nodeType !== 1 || root.tagName === 'SCRIPT' || root.tagName === 'STYLE') return;
  fixAttrs(root);
  const w = document.createTreeWalker(root, 5 /* elements and text */, {acceptNode: n => (n.nodeType === 1 && (n.tagName === 'SCRIPT' || n.tagName === 'STYLE') ? 2 : 1)});
  for (let n = w.nextNode(); n; n = w.nextNode()) { if (n.nodeType === 3) fixText(n); else fixAttrs(n); }
}
// keep the page in the language: whatever the game writes later (a screen drawn again, a count changing) is translated as it lands
export function watch(root) {
  if (lang === 'th' || !root || typeof MutationObserver === 'undefined') return;
  translateTree(root);
  new MutationObserver(list => {
    for (const m of list) {
      if (m.type === 'characterData') fixText(m.target);
      else if (m.type === 'attributes') fixAttrs(m.target);
      else m.addedNodes.forEach(n => translateTree(n));
    }
  }).observe(root, {subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS});
}
if (typeof window !== 'undefined') window.__i18n = {miss, tr, get lang() { return lang; }};
