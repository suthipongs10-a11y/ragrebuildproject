// @ts-nocheck
// Sprites, recolors, silhouettes/glows and palettes. Species without final art use a recolored fox placeholder.
import { SPECIES, natStars } from '../core/data';

export const TAU = Math.PI * 2;
export const PIV = [256, 435]; // feet pivot inside 512px sprite
export const POSES = ['idle', 'attack', 'cast', 'hit', 'burst'];
export const IMG: Record<string, HTMLImageElement> = {};
export const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

export const PAL = {
  fire: { name: 'ไฟ', aura: '#ff8a2a', core: '#ffe1a0', hot: '#fff4d6', rune: '#ffb35a', cut: '#d9481c', dh: 0, sat: 1, lit: 1, all: 1 },
  water: { name: 'น้ำ', aura: '#3fa9ff', core: '#d2efff', hot: '#ffffff', rune: '#7cd0ff', cut: '#1f6fd0', dh: .555, sat: 1.05, lit: 1.03, all: 1 },
  wind: { name: 'ลม', aura: '#4fdc78', core: '#dcffd8', hot: '#f6fff2', rune: '#9af0a0', cut: '#2a9a4a', dh: .27, sat: .95, lit: 1.02, all: 1 },
  earth: { name: 'ดิน', aura: '#c9a04a', core: '#f3e2b0', hot: '#fff6dc', rune: '#e0c070', cut: '#8a6420', dh: .1, sat: .55, lit: .82, all: .93 },
  light: { name: 'แสง', aura: '#ffd54a', core: '#fff6c8', hot: '#ffffff', rune: '#ffe58a', cut: '#c99a10', dh: .075, sat: .7, lit: 1.12, all: 1.04 },
  dark: { name: 'มืด', aura: '#b061ff', core: '#ead0ff', hot: '#ffffff', rune: '#c890ff', cut: '#6a2bb8', dh: .73, sat: 1, lit: .9, all: .72 },
};

// mouth/body anchors per pose (1024 space) for the fox sprite set; placeholders reuse these
const ANCH_RAW = { front_idle: { mouth: [735, 640], body: [520, 640] }, front_attack: { mouth: [750, 690], body: [480, 600] }, front_cast: { mouth: [712, 430], body: [560, 600] }, front_hit: { mouth: [740, 526], body: [480, 640] }, front_burst: { mouth: [776, 756], body: [560, 700] }, back_idle: { mouth: [840, 420], body: [480, 600] }, back_attack: { mouth: [850, 360], body: [560, 560] }, back_cast: { mouth: [800, 400], body: [520, 600] }, back_hit: { mouth: [850, 350], body: [480, 640] }, back_burst: { mouth: [870, 500], body: [540, 640] } };
export const ANCH = {};
for (const k in ANCH_RAW) { ANCH[k] = {}; for (const p in ANCH_RAW[k]) { const a = ANCH_RAW[k][p]; ANCH[k][p] = [a[0] / 2 - PIV[0], a[1] / 2 - PIV[1]]; } }

// ---- separate-file art (assets_ext/ → dist/ext/<key>.webp, list in __EXT__): Starborn sprites and eggs, too big to embed
// under the 16MB single-file limit. Pixel reads (bbox, recolour, portraits) need images the canvas may read, so the loader
// tries, in order: a plain <img> (the way battle plates load; same-origin files stay readable), a CORS <img>, then
// fetch → blob URL. The live Artifact refused fetch() for these files (2026-10-14: Starborn showed as foxes) while <img>
// worked.
// 2026-10-14 (owner's phone: every separate-file monster was still a fox): on the live Artifact those files load but stay
// "cross-origin" — the canvas may draw them, not read them. Such an image is now USED (marked in TAINT): the pixel data
// the game needs is precomputed (tools/ext_meta.py → __EXTMETA__: bbox + opaque area), menus use small embedded copies
// (assets/thumb_*), and recolours fall back to canvas blend modes. ----
const EXTU: Record<string, string> = typeof __EXT__ !== 'undefined' ? __EXT__ : {}; // key → literal published path
const EXT = Object.keys(EXTU);
const META: Record<string, number[]> = typeof __EXTMETA__ !== 'undefined' ? __EXTMETA__ : {};
const EXTP = {};
export const EXT_STAT = { total: EXT.length, ok: 0, fail: 0, taint: 0, way: '' as string, err: '' as string, cors: '' as string };
/** images (and canvases drawn from them) whose pixels cannot be read */
const TAINT = new WeakSet<object>();
const tainted = (src: any) => !!src && TAINT.has(src);
/** a canvas made from `src` inherits its unreadability and its precomputed bbox / area */
const derive = (c: any, src: any) => { if (tainted(src)) TAINT.add(c); if (src?.__bb) { c.__bb = src.__bb; c.__area = src.__area; } return c; };
const imgOf = (src: string, cors = false, ms = 15000) => new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); if (cors) i.crossOrigin = 'anonymous';
  const t = setTimeout(() => rej(new Error('timeout')), ms); i.onload = () => { clearTimeout(t); res(i); }; i.onerror = () => { clearTimeout(t); rej(new Error(cors ? 'cors' : 'img')); }; i.src = src; });
function readable(i: HTMLImageElement) { try { const x = mk(1, 1).getContext('2d'); x.drawImage(i, 0, 0); x.getImageData(0, 0, 1, 1); return true; } catch (e) { return false; } }

// ---- published files (ext/, bg/): how this page reaches them is found ONCE by a probe and then used for every file.
// The owner's phone app never showed a separate file (maps, Starborn, BATCH21 → foxes) although the Artifact docs say
// files next to the page load by relative URL: so the probe tries <img> and fetch → blob, against the page's own folder
// as resolved by the browser, the page URL taken as a folder, and the site root. Every attempt is listed in settings. ----
type Way = { base: string; fetch: boolean };
let WAY: Way | null | undefined, wayP: Promise<Way | null> | null = null;
export const FILE_STAT = { tries: [] as string[], way: '' };
const baseCands = () => { const out = [''], h = String(location.href).split(/[?#]/)[0];
  if (/^https?:/.test(h)) { if (!h.endsWith('/')) out.push(h + '/'); out.push(location.origin + '/'); }
  return [...new Set(out)]; };
const viaFetch = (url: string) => Promise.race([fetch(url), new Promise<Response>((_, rej) => setTimeout(() => rej(new Error('timeout')), 15000))])
  .then(r => r.ok ? r.blob() : Promise.reject(new Error('http ' + r.status))).then(b => imgOf(URL.createObjectURL(b)));
const shortBase = (b: string) => b ? (b.replace(location.origin, '') || '/') : './';
function findWay(path: string): Promise<Way | null> {
  return wayP ||= (async () => {
    for (const base of baseCands()) for (const f of [false, true]) {
      const tag = `${f ? 'fetch' : 'img'} ${shortBase(base)}`;
      try { await (f ? viaFetch(base + path) : imgOf(base + path, false, 8000)); FILE_STAT.tries.push(tag + ' ✓'); FILE_STAT.way = tag; return (WAY = { base, fetch: f }); }
      catch (e) { FILE_STAT.tries.push(`${tag} ✗ ${e?.message || e}`); }
    }
    return (WAY = null);
  })();
}
/** load one published file ('ext/x.webp', 'bg/y.webp') the way the probe found to work */
export async function loadFile(path: string): Promise<HTMLImageElement> {
  const w = await findWay(path); if (!w) throw new Error('ไฟล์แยกโหลดไม่ได้ทุกวิธี');
  return w.fetch ? viaFetch(w.base + path) : imgOf(w.base + path);
}
let corsP: Promise<boolean> | null = null; // asked once (the first unreadable file): does the host answer CORS requests?
const useTainted = (i: HTMLImageElement) => { TAINT.add(i); EXT_STAT.taint++; EXT_STAT.way ||= 'img อ่านพิกเซลไม่ได้'; return i; };
const tryWays = (key: string) => { const path = EXTU[key] || 'ext/' + key + '.webp';
  return loadFile(path).then(i => {
    if (readable(i)) { EXT_STAT.way ||= WAY?.fetch ? 'fetch' : 'img'; return i; }
    if (WAY?.fetch) return useTainted(i);
    const url = (WAY?.base || '') + path;
    corsP ||= imgOf(url, true).then(c => readable(c), e => { EXT_STAT.cors = String(e?.message || e); return false; });
    return corsP.then(ok => ok ? imgOf(url, true).then(c => { EXT_STAT.way ||= 'cors'; return c; }, () => useTainted(i)) : useTainted(i));
  });
};
function loadExt(key): Promise<void> {
  if (IMG[key] || !EXT.includes(key)) return Promise.resolve();
  return EXTP[key] ||= tryWays(key).then(i => { const m = META[key]; if (m) { (i as any).__bb = m.slice(0, 4); (i as any).__area = m[4]; } IMG[key] = i; EXT_STAT.ok++; })
    .catch(e => { delete EXTP[key]; EXT_STAT.fail++; EXT_STAT.err = String(e && e.message || e); });
}
/** drop every cached sprite / portrait / egg made for a species (placeholders drawn before its art arrived) */
function forgetArt(sid) { for (const C of [SPR, silC, glowC, BB, ANC2, PORT, EGG, EGGU, RMU]) for (const k of Object.keys(C)) if (k === sid || k.startsWith(sid)) delete C[k]; }
const extKeys = sid => { const a = SPECIES[baseOf(sid)]?.art; return a ? EXT.filter(k => k.startsWith(a + '_') || k === 'egg' + a.slice(3)) : []; };
export const isExtArt = sid => extKeys(sid).length > 0;
/** is every separate-file image of these species already loaded? */
export const artReady = sids => sids.every(sid => extKeys(sid).every(k => IMG[k]));
/** make sure these species' separate-file art is loaded (awaited before a battle that shows them) */
export async function ensureArt(sids) { const need = [...new Set(sids.map(baseOf))].filter(sid => extKeys(sid).some(k => !IMG[k])); if (!need.length) return false; await Promise.all(need.flatMap(sid => extKeys(sid).map(loadExt))); need.forEach(forgetArt); return true; }
/** background-load all separate-file art one species at a time; onDone(sid) after each (to refresh screens) */
export function prefetchExt(onDone = sid => { }) { const sids = Object.keys(SPECIES).filter(isExtArt); let i = 0; const next = () => { if (i >= sids.length) return; const sid = sids[i++]; ensureArt([sid]).then(ch => { if (ch) onDone(sid); next(); }); }; next(); }

/** every image is embedded (AVIF since 2026-10-14). A browser that cannot decode AVIF gets a clear message instead of a
 *  half-drawn game; a single bad image just stays missing (its fallback art is used). */
export const ASSET_STAT = { total: 0, fail: 0 };
export async function loadAssets() {
  const A = (window as any).__ASSETS || {}, keys = Object.keys(A); ASSET_STAT.total = keys.length;
  await Promise.all(keys.map(n => new Promise<void>(res => { const i = new Image(); i.onload = () => { IMG[n] = i; res(); }; i.onerror = () => { ASSET_STAT.fail++; res(); }; i.src = A[n]; })));
  if (keys.length && ASSET_STAT.fail > keys.length / 2) throw new Error('เบราว์เซอร์นี้แสดงภาพแบบ AVIF ไม่ได้ — อัปเดตเป็น iOS 16 ขึ้นไป หรือใช้ Chrome / Safari / Firefox รุ่นใหม่');
}
/** a blob: URL for an embedded image (DOM <img> of big pictures: avoids pasting ~100KB data URIs into every render) */
const BLOBU = {};
export function blobURL(key: string): string | null {
  if (BLOBU[key]) return BLOBU[key]; const im = IMG[key]; if (!im) return null;
  const src = im.src, m = /^data:([^;]+);base64,(.*)$/.exec(src); if (!m) return src;
  try { const bin = atob(m[2]), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); return (BLOBU[key] = URL.createObjectURL(new Blob([u8], { type: m[1] }))); }
  catch (e) { return (BLOBU[key] = src); }
}

function hueShift(img, E) {
  const c = derive(mk(img.width, img.height), img), x = c.getContext('2d');
  if (tainted(img)) { // cannot read the pixels: the canvas filter (where the browser has one) comes close, else unchanged
    if (!(E.dh === 0 && E.all === 1) && 'filter' in x) x.filter = `hue-rotate(${Math.round(E.dh * 360)}deg) saturate(${E.sat}) brightness(${(E.lit * E.all).toFixed(3)})`;
    x.drawImage(img, 0, 0); return c; }
  x.drawImage(img, 0, 0);
  if (E.dh === 0 && E.all === 1) return c;
  const d = x.getImageData(0, 0, c.width, c.height), a = d.data;
  for (let i = 0; i < a.length; i += 4) {
    if (a[i + 3] === 0) continue;
    let r = a[i] / 255, g = a[i + 1] / 255, b = a[i + 2] / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, dd = mx - mn;
    if (dd >= .06) {
      const s = l > .5 ? dd / (2 - mx - mn) : dd / (mx + mn);
      if (s >= .3 && l <= .84) {
        let h; if (mx === r) h = (g - b) / dd + (g < b ? 6 : 0); else if (mx === g) h = (b - r) / dd + 2; else h = (r - g) / dd + 4; h = (h / 6 + E.dh) % 1;
        const s2 = Math.min(1, s * E.sat), l2 = Math.min(1, l * E.lit), q = l2 < .5 ? l2 * (1 + s2) : l2 + s2 - l2 * s2, p = 2 * l2 - q;
        const f = t => { t < 0 && (t += 1); t > 1 && (t -= 1); return t < 1 / 6 ? p + (q - p) * 6 * t : t < .5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
        r = f(h + 1 / 3); g = f(h); b = f(h - 1 / 3);
      }
    }
    a[i] = Math.min(255, r * 255 * E.all); a[i + 1] = Math.min(255, g * 255 * E.all); a[i + 2] = Math.min(255, b * 255 * E.all);
  }
  x.putImageData(d, 0, 0); return c;
}

/** rare forms are light or dark monsters: repaint the art by brightness through an element gradient — light = pearl white
 *  (cool lavender shadows, warm cream highlights, a faint iridescent sheen) and dark = mysterious violet. Gold trim stays. */
const ELEM_GRAD = {
  light: [[0, [.30, .30, .40]], [.45, [.70, .69, .76]], [.75, [.93, .91, .92]], [1, [1, .985, .95]]],
  dark: [[0, [.07, .03, .14]], [.35, [.30, .14, .50]], [.65, [.58, .38, .84]], [1, [.92, .85, 1]]],
};
/** elemTint for art whose pixels cannot be read: blend modes only — grey-scale then pearl (light) / violet (dark) */
function elemTintBlend(img, mode) {
  const w = img.width, h = img.height, c = derive(mk(w, h), img), x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  if (mode === 'light') {
    x.globalCompositeOperation = 'saturation'; x.fillStyle = '#808080'; x.fillRect(0, 0, w, h);
    x.globalCompositeOperation = 'screen'; x.globalAlpha = .5; x.fillStyle = '#c9c2df'; x.fillRect(0, 0, w, h);
    x.globalCompositeOperation = 'color'; x.globalAlpha = .35; x.fillStyle = '#d9cff0'; x.fillRect(0, 0, w, h);
  } else {
    x.globalCompositeOperation = 'color'; x.fillStyle = '#7a3ed6'; x.fillRect(0, 0, w, h);
    x.globalCompositeOperation = 'multiply'; x.globalAlpha = .3; x.fillStyle = '#6a3aa8'; x.fillRect(0, 0, w, h);
  }
  x.globalAlpha = 1; x.globalCompositeOperation = 'destination-in'; x.drawImage(img, 0, 0); return c;
}
function elemTint(img, mode) {
  if (tainted(img)) return elemTintBlend(img, mode);
  const c = derive(mk(img.width, img.height), img), x = c.getContext('2d'); x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height), a = d.data, st = ELEM_GRAD[mode], dark = mode === 'dark';
  for (let i = 0; i < a.length; i += 4) {
    if (a[i + 3] === 0) continue;
    const r = a[i] / 255, g = a[i + 1] / 255, b = a[i + 2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, dd = mx - mn;
    let h = 0, s = 0;
    if (dd > 1e-6) { s = l > .5 ? dd / (2 - mx - mn) : dd / (mx + mn); h = (mx === r ? ((g - b) / dd + 6) % 6 : mx === g ? (b - r) / dd + 2 : (r - g) / dd + 4) / 6; }
    if (h > 32 / 360 && h < 56 / 360 && s > (dark ? .45 : .35) && l > .22 && l < .84) { const k = dark ? .9 : 1.06; a[i] = Math.min(255, a[i] * k); a[i + 1] = Math.min(255, a[i + 1] * k); a[i + 2] = Math.min(255, a[i + 2] * k); continue; } // gold trim
    const Y = .3 * r + .59 * g + .11 * b, t = Math.min(1, Math.max(0, dark ? Math.pow(Y, 1.05) : .18 + .9 * Math.pow(Y, .8)));
    let j = 0; while (j < st.length - 2 && t > st[j + 1][0]) j++;
    const [t0, c0] = st[j], [t1, c1] = st[j + 1], u = (t - t0) / (t1 - t0);
    let o = [0, 1, 2].map(k => c0[k] + (c1[k] - c0[k]) * u);
    if (dark) { const w = .45 * s, f = Math.min(1.1, Math.max(.35, t * 1.6)), acc = [.62, .22, .95]; o = o.map((v, k) => v * (1 - w) + acc[k] * w * f); }
    else if (s > .2) { const p = h * TAU; o = [o[0] + .035 * Math.cos(p), o[1] + .035 * Math.cos(p - 2.1), o[2] + .035 * Math.cos(p + 2.1)]; } // pearl sheen
    a[i] = Math.min(255, Math.max(0, o[0] * 255)); a[i + 1] = Math.min(255, Math.max(0, o[1] * 255)); a[i + 2] = Math.min(255, Math.max(0, o[2] * 255));
  }
  x.putImageData(d, 0, 0); return c;
}
/** rare-form repaint for a species: its rare form's element (light/dark), or the old hue flip if it has none */
const rareTint = (sid, img) => { const e = SPECIES[sid.split('~')[0]]?.rareForm?.elem; return e === 'light' || e === 'dark' ? elemTint(img, e) : hueShift(img, VAR_R); };

// ---- looks by star grade (evolution): ★1-3 base art · ★4 recoloured · ★5-6 evolved-form art (key + 'e', BATCH08) when it
// exists, otherwise a stronger recolour. A "look id" is `sid~stars` (e.g. 'B05~4'); plain sid = base look. ----
/** result / reward star: BATCH14 art when present, else a glyph styled by CSS (.bigstars) */
export const starHTML = (on: boolean) => { const im = IMG[on ? 'ui_star' : 'ui_star_empty']; return im ? `<img src="${im.src}" alt="">` : '★'; };
export const uiSrc = (name: string) => IMG[name] ? IMG[name].src : null;
/** full-body master art URL for the monster book (falls back to the round portrait) */
/** a set's master art; sets that arrived without one (BATCH07 B09/C06) use their front idle */
const masterOf = (art: string) => IMG['thumb_' + art] || IMG[art + '_master'] || IMG[art + '_front_idle'];
/** a separate-file set has an embedded thumbnail of its master (tools/ext_meta.py): menus can show it before / without the files */
const thumbOf = (art?: string) => art ? IMG['thumb_' + art] : undefined;
export const masterURL = (sid: string) => { const s = SPECIES[sid]; return s && s.art && masterOf(s.art) ? masterOf(s.art).src : null; };
const RMU = {};
/** full-body master art of a rare form for the book: the species' master repainted light/dark (cached data URL) */
export const rareMasterURL = (sid: string) => { if (RMU[sid]) return RMU[sid]; const s = SPECIES[sid], src = s && s.art && masterOf(s.art); if (!src) return null; try { return (RMU[sid] = rareTint(sid, src).toDataURL('image/webp', .9)); } catch (e) { return src.src || null; } };
const EMU = {};
/** full-body art of an evolved (★5) form for the book: the evolved master, repainted light/dark for the rare form */
export const evoMasterURL = (sid: string, rare = false) => { const k = sid + (rare ? 'r' : ''); if (EMU[k]) return EMU[k]; const a = SPECIES[sid]?.art, src = a && (IMG[a + 'e_master'] || IMG[a + 'e_front_idle']); if (!src) return null;
  if (!rare) return (EMU[k] = src.src); try { return (EMU[k] = rareTint(sid, src).toDataURL('image/webp', .9)); } catch (e) { return src.src; } };
export const baseOf = (sid: string) => sid.split('~')[0];
const SP = sid => SPECIES[baseOf(sid)];
const lookLv = sid => parseInt(sid.split('~')[1] || '0') || 0;
const lookRare = sid => sid.includes('~') && /rh?$/.test(sid);
/** hell look (`…h`): a deep-purple "ทมิฬ" repaint for monsters without an evolved form */
const lookHell = sid => sid.includes('~') && sid.endsWith('h');
/** the look of an awakened hell enemy: its evolved form when it has the art, else the deep-purple form */
export const awakeLook = (sid: string, rare = false) => { const s = SPECIES[sid]; return s?.art && IMG[s.art + 'e_front_idle'] ? sid + '~5' + (rare ? 'r' : '') : sid + '~0' + (rare ? 'r' : '') + 'h'; };
/** deep purple, darker shadows — composite only (no pixel reads), so it also works on separately loaded art */
function hellTint(src) {
  const w = src.width, h = src.height, c = derive(mk(w, h), src), x = c.getContext('2d');
  x.drawImage(src, 0, 0); x.globalCompositeOperation = 'multiply'; x.fillStyle = '#8a55d8'; x.fillRect(0, 0, w, h);
  x.globalCompositeOperation = 'source-atop'; x.globalAlpha = .12; x.fillStyle = '#1c0630'; x.fillRect(0, 0, w, h);
  x.globalAlpha = .16; x.globalCompositeOperation = 'screen'; x.fillStyle = '#c070ff'; x.fillRect(0, 0, w, h);
  x.globalAlpha = 1; x.globalCompositeOperation = 'destination-in'; x.drawImage(src, 0, 0); return c;
}
/** look id: `sid~<stars>` from ★4, plus `r` for the rare form (its own colours, like a shiny) */
// the ★4 recolour / ★5 evolved look only show once a monster has been starred up past the stars it hatched with
// (a legendary hatches at ★4 and must still show its own colours)
export const lookOf = (sid: string, stars: number, rare = false) => { const up = stars >= 4 && stars > natStars(sid, rare); return up || rare ? sid + '~' + (up ? Math.min(6, stars) : 0) + (rare ? 'r' : '') : sid; };
const VAR_R = { dh: .5, sat: 1.18, lit: 1.04, all: 1.04 }; // rare form: opposite hue, a little richer
const VAR_E = { 4: { dh: .09, sat: 1.22, lit: 1, all: 1.02 }, 5: { dh: .09, sat: 1.3, lit: 1.03, all: 1.05 }, 6: { dh: .09, sat: 1.3, lit: 1.03, all: 1.05 } };
const evoArt = sid => { const L = lookLv(sid), s = SP(sid); return L >= 5 && s.art && IMG[s.art + 'e_front_idle'] ? s.art + 'e' : null; };
/** battle size by stars (owner 2026-10-14: a ★5 awakened tiger looked smaller than ★1 monsters): ★1 a bit smaller, every
 *  star a bit bigger, the ★5–6 evolved forms clearly bigger. Bosses never shrink below their own size. */
export const STAR_SIZE = [1, .92, .95, .98, 1, 1.08, 1.12];
const opaque = (im: HTMLImageElement) => { try { const c = mk(128, 128), x = c.getContext('2d')!; x.drawImage(im, 0, 0, 128, 128); const d = x.getImageData(0, 0, 128, 128).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 40) n++; return n; } catch (e) { return (im as any).__area || 0; } };
const AREA = {};
/** opaque area of an art's front idle (128 px sample), relative to the starter fox — 0 when it cannot be read */
const areaOf = (key: string) => { if (AREA[key] != null) return AREA[key];
  const pm = (META[key + '_front_idle'] || META[key + '_master'])?.[4], pf = META.mon001_front_idle?.[4]; if (pm && pf) return (AREA[key] = pm / pf); // separate-file art: precomputed, ready before the files load
  const im = IMG[key + '_front_idle'] || IMG[key + '_master'], f = IMG.mon001_front_idle;
  const a = im ? opaque(im) : 0, r = f ? opaque(f) : 0; return (AREA[key] = a && r ? a / r : 0); };
/** the least area a rarity should cover (× the fox): rare art drawn small still reads as more than a common */
const RARITY_AREA: Record<string, number> = { common: 0, rare: .93, epic: 1.15, legendary: 1.22 };
const SIZEK = {};
/** per-art size fix: a rare+ base art drawn smaller than its rarity's least area is scaled up; an evolved (★5) art covers
 *  at least 1.3× its own base form and 1.3× the fox (evolved forms must look bigger than any ★1) */
function artFix(look: string) {
  const s = SP(look), ea = evoArt(look), key = ea || (s && s.art) || ''; if (!key) return 1;
  if (SIZEK[key] != null) return SIZEK[key];
  const clamp = (v: number) => Math.min(1.3, Math.max(1, v)), a = areaOf(key);
  let k = 1;
  if (a) {
    if (ea) { const b = areaOf(s.art), bk = b ? clamp(Math.sqrt((RARITY_AREA[s.rarity] || 0) / b)) : 1; k = clamp(Math.sqrt(Math.max(1.3 * b * bk * bk, 1.3) / a)); }
    else k = clamp(Math.sqrt((RARITY_AREA[s.rarity] || 0) / a));
  }
  return (SIZEK[key] = k);
}
export function sizeK(look: string, stars: number, boss = false) {
  const st = STAR_SIZE[Math.max(1, Math.min(6, stars || 1))];
  return (boss ? Math.max(1, st) : st) * artFix(look);
}
/** does this species have its own final art? */
export const hasArt = sid => { const s = SP(sid); return !!(s && s.art && (IMG[s.art + '_front_idle'] || IMG[s.art + '_master'] || IMG['thumb_' + s.art])); };
const THS = {};
/** a separate-file set whose files cannot be loaded (yet): its embedded master thumbnail stands in for every pose,
 *  scaled to the 512 sprite space — the real monster, still, instead of a recoloured fox */
const thumbSprite = (art: string) => { if (THS[art]) return THS[art]; const t = IMG['thumb_' + art]; if (!t) return undefined;
  const c = mk(512, 512); c.getContext('2d')!.drawImage(t, 0, 0, 512, 512); return (THS[art] = c); };
const SPR = {};
/** a pose that may be missing from a set (damaged file awaiting re-export): same view's idle → master → other view's idle */
function artPose(art, key) {
  const view = key.split('_')[0], other = view === 'front' ? 'back' : 'front';
  return IMG[art + '_' + key] || IMG[art + '_' + view + '_idle'] || IMG[art + '_master'] || IMG[art + '_' + other + '_idle'] || thumbSprite(art);
}
// extra motion poses (BATCH13+) fall back to the classic five when a set doesn't have them yet
const POSE_FALLBACK = { windup: 'idle', strike: 'attack', follow: 'attack', cast2: 'cast', joy: 'cast', down: 'hit' };
/** pose key for a view: the requested pose if this species' art has it, else its fallback */
export function poseKey(sid, view, pose) {
  const s = SP(sid), art = evoArt(sid) || (hasArt(sid) ? s.art : 'mon001');
  return view + '_' + (IMG[art + '_' + view + '_' + pose] || !POSE_FALLBACK[pose] ? pose : POSE_FALLBACK[pose]);
}
/** "living sprite": draw a 512² sprite (pivot 256,435) in horizontal strips so it can breathe (chest swells, upper body
 *  lifts), bend (top sways sideways — lean / recoil, driven by a spring) and wave (a travelling ripple for follow-through).
 *  Call inside the unit's local transform (same place as drawImage(img, -PIV[0], -PIV[1])). */
export function warpDraw(ctx, img, w) {
  if (!w || (Math.abs(w.bend) < .3 && Math.abs(w.breathe) < .002 && Math.abs(w.wave) < .3)) { ctx.drawImage(img, -PIV[0], -PIV[1]); return; }
  const N = 16, H = 512, f = img.width / 512, hOf = y => Math.max(0, Math.min(1.15, (PIV[1] - y) / 400));
  const Y = y => y - w.breathe * 46 * hOf(y), X = y => { const h = hOf(y); return w.bend * h * h + w.wave * Math.sin(w.wph - h * 3.4) * h; };
  for (let i = 0; i < N; i++) {
    const y0 = i * H / N, y1 = (i + 1) * H / N, ym = (y0 + y1) / 2, h = hOf(ym);
    const sx = 1 + w.breathe * Math.exp(-(((h - .5) / .28) ** 2)), dx = X(ym), dy0 = Y(y0), dy1 = Y(y1);
    ctx.drawImage(img, 0, y0 * f, 512 * f, (y1 - y0) * f, -PIV[0] * sx + dx, dy0 - PIV[1] - .5, 512 * sx, dy1 - dy0 + 1);
  }
}
/** sprite canvas/image for a species & pose key like 'front_idle' */
export function spr(sid, key) {
  const k = sid + key; if (SPR[k]) return SPR[k];
  if (lookHell(sid)) return (SPR[k] = hellTint(spr(sid.slice(0, -1).replace(/~0$/, ''), key)));
  if (sid.includes('~')) { const ea = evoArt(sid), base = ea ? artPose(ea, key) : spr(baseOf(sid), key);
    return (SPR[k] = lookRare(sid) ? rareTint(sid, base) : ea ? base : hueShift(base, VAR_E[lookLv(sid)])); }
  const s = SPECIES[sid];
  if (hasArt(sid)) return (SPR[k] = artPose(s.art, key));
  return (SPR[k] = hueShift(IMG['mon001_' + key], PAL[s.elem]));
}
const silC = {}, glowC = {};
export function silOf(sid, key, color) {
  const k = sid + key + color; if (silC[k]) return silC[k];
  const src = spr(sid, key), c = mk(512, 512), x = c.getContext('2d');
  x.drawImage(src, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, 512, 512); return (silC[k] = c);
}
export const GP = 40;
export function glowOf(sid, key, color) {
  const k = sid + key + color; if (glowC[k]) return glowC[k];
  const s = silOf(sid, key, color), c = mk(512 + GP * 2, 512 + GP * 2), x = c.getContext('2d');
  for (const [r, al] of [[5, .16], [11, .1], [19, .06], [28, .035]]) for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; x.globalAlpha = al; x.drawImage(s, GP + Math.cos(a) * r, GP + Math.sin(a) * r); }
  return (glowC[k] = c);
}
const dotC = {};
export function dot(color) {
  if (dotC[color]) return dotC[color];
  const c = mk(64, 64), x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, '#fff'); g.addColorStop(.18, color); g.addColorStop(.5, color + '55'); g.addColorStop(1, color + '00');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); return (dotC[color] = c);
}
// bbox of a sprite's opaque pixels (512 space), cached
const BB = {};
function bbox(img, key) {
  if (BB[key]) return BB[key];
  if (tainted(img)) return (BB[key] = img.__bb || [156, 100, 356, 435]); // cannot be read: precomputed (tools/ext_meta.py)
  const c = mk(512, 512), x = c.getContext('2d'); x.drawImage(img, 0, 0, 512, 512);
  let a; try { a = x.getImageData(0, 0, 512, 512).data; } catch (e) { return (BB[key] = img.__bb || [156, 100, 356, 435]); }
  let x0 = 512, y0 = 512, x1 = 0, y1 = 0;
  for (let y = 0; y < 512; y += 2) for (let xx = 0; xx < 512; xx += 2) if (a[(y * 512 + xx) * 4 + 3] > 40) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return (BB[key] = x1 > x0 ? [x0, y0, x1, y1] : [156, 100, 356, 435]);
}
/** a pose's opaque bbox [x0,y0,x1,y1] in the 512 sprite space (cached; shares the anchOf cache key) */
export const boxOf = (sid, key) => bbox(spr(sid, key), sid + key);
const ANC2 = {};
/** mouth/body anchors (relative to feet pivot) for a species & pose; fox uses hand-tuned values, other art is auto-derived */
export function anchOf(sid, key) {
  const s = SP(sid);
  // the hand-tuned table only has the classic five poses: the BATCH13 extras (windup, down, joy ...) use their fallback's
  // anchors (a missing entry here used to throw every frame once a fox died → the whole game loop stopped)
  if (!hasArt(sid) || (s.art === 'mon001' && !evoArt(sid))) { const [view, pose] = key.split('_'); return ANCH[key] || ANCH[view + '_' + (POSE_FALLBACK[pose] || 'idle')] || ANCH.front_idle; }
  const k = sid + key; if (ANC2[k]) return ANC2[k];
  const [x0, y0, x1, y1] = bbox(spr(sid, key), k), w = x1 - x0, h = y1 - y0, cx = (x0 + x1) / 2;
  return (ANC2[k] = { mouth: [cx + w * .18 - PIV[0], y0 + h * .36 - PIV[1]], body: [cx - PIV[0], y0 + h * .58 - PIV[1]] });
}
const PORT = {};
export function portrait(sid) {
  if (PORT[sid]) return PORT[sid];
  const s = SP(sid), ea = evoArt(sid), L = lookLv(sid);
  const own0 = hasArt(sid) || !!thumbOf(s.art);
  let src = ea && IMG[ea + '_master'] ? IMG[ea + '_master'] : own0 && masterOf(s.art) ? masterOf(s.art) : hueShift(IMG.mon001_master, PAL[s.elem]);
  if (lookRare(sid)) src = rareTint(sid, src); else if (L && !ea) src = hueShift(src, VAR_E[L]);
  if (lookHell(sid)) src = hellTint(src);
  const c = mk(256, 256), x = c.getContext('2d');
  const f = src.width / 512, own = own0 && (!!masterOf(s.art) || !!ea);
  let cr = [200, 70, 300]; // fox: head-centred crop
  if (own && (s.art !== 'mon001' || ea)) { const [x0, y0, x1, y1] = bbox(src, sid + '_master'), side = Math.min(512, Math.max(x1 - x0, (y1 - y0) * .8) * 1.04); cr = [(x0 + x1) / 2 - side / 2, y0 - side * .04, side]; }
  x.drawImage(src, cr[0] * f, cr[1] * f, cr[2] * f, cr[2] * f, 0, 0, 256, 256);
  try { return (PORT[sid] = c.toDataURL('image/webp', .85)); } catch (e) { return (PORT[sid] = src.src || ''); } // unreadable: the image's own URL
}
const EGG = {};
export function eggImg(sid) {
  sid = baseOf(sid); if (EGG[sid]) return EGG[sid];
  const s = SPECIES[sid];
  const own = s.art && IMG['egg' + s.art.replace('mon', '')];
  return (EGG[sid] = own || hueShift(IMG.egg001, PAL[s.elem]));
}
const EGGU = {};
export function eggURL(sid) {
  if (EGGU[sid]) return EGGU[sid];
  const s = SPECIES[baseOf(sid)], th = s?.art && IMG['thumb_egg' + s.art.replace('mon', '')], im = th || eggImg(sid);
  return (EGGU[sid] = im.toDataURL ? im.toDataURL('image/webp', .85) : im.src);
}

// ---- mystery eggs: code-drawn shells, the pattern shows the tier (ธรรมดา/เงิน/ทอง/รุ้ง). Base at y≈425 like the art eggs. ----
export const TIER_COL = { common: '#d8c4a0', silver: '#cfe0f0', gold: '#ffd27a', rainbow: '#ff9ad8' };
function eggPath(x, cx = 254, cy = 300, rx = 92, ry = 125) {
  x.beginPath();
  for (let i = 0; i <= 64; i++) { const t = i / 64 * TAU, s = Math.sin(t); const px = cx + rx * Math.cos(t) * (1 + .1 * s), py = cy + ry * s; i ? x.lineTo(px, py) : x.moveTo(px, py); }
  x.closePath();
}
const MEGG = {};
export function mysteryEggImg(tier) {
  if (MEGG[tier]) return MEGG[tier];
  if (IMG['eggM_' + tier]) return (MEGG[tier] = IMG['eggM_' + tier]); // BATCH11 painted shells; the code-drawn ones below are the fallback
  const c = mk(512, 512), x = c.getContext('2d'), base = {
    common: ['#fbf3e2', '#d9c5a2'], silver: ['#f4f8fc', '#9fb2c6'], gold: ['#fff1c2', '#d79a2a'], rainbow: ['#ffffff', '#c9b8ff'] }[tier];
  x.save(); eggPath(x); x.clip();
  const g = x.createRadialGradient(215, 230, 10, 254, 300, 170); g.addColorStop(0, base[0]); g.addColorStop(1, base[1]); x.fillStyle = g; x.fillRect(0, 0, 512, 512);
  if (tier === 'common') { // speckles
    let r = 7; const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 46; i++) { x.fillStyle = `rgba(${120 + rnd() * 40},${80 + rnd() * 30},40,${.35 + rnd() * .35})`; x.beginPath(); x.ellipse(160 + rnd() * 190, 180 + rnd() * 240, 3 + rnd() * 7, 2 + rnd() * 5, rnd() * 3, 0, TAU); x.fill(); }
  } else if (tier === 'silver') { // wave bands
    x.lineWidth = 9; for (const [y, a] of [[250, .55], [300, .75], [350, .55]]) { x.strokeStyle = `rgba(110,135,165,${a})`; x.beginPath(); for (let px = 150; px <= 360; px += 6) { const py = y + Math.sin(px * .07) * 9; px === 150 ? x.moveTo(px, py) : x.lineTo(px, py); } x.stroke(); }
    x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = 3; x.beginPath(); for (let px = 150; px <= 360; px += 6) { const py = 296 + Math.sin(px * .07) * 9; px === 150 ? x.moveTo(px, py) : x.lineTo(px, py); } x.stroke();
  } else if (tier === 'gold') { // zigzag crown band + gem
    x.fillStyle = 'rgba(150,90,15,.55)'; x.beginPath(); x.moveTo(140, 290); for (let i = 0; i <= 14; i++) x.lineTo(150 + i * 15, i % 2 ? 268 : 292); x.lineTo(370, 330); for (let i = 14; i >= 0; i--) x.lineTo(150 + i * 15, i % 2 ? 312 : 336); x.closePath(); x.fill();
    x.fillStyle = 'rgba(255,248,214,.8)'; for (let i = 0; i < 7; i++) { x.beginPath(); x.arc(165 + i * 30, 312, 3.5, 0, TAU); x.fill(); }
    const gg = x.createLinearGradient(240, 215, 270, 255); gg.addColorStop(0, '#fff6d0'); gg.addColorStop(1, '#e0601c'); x.fillStyle = gg; x.beginPath(); x.moveTo(254, 205); x.lineTo(270, 232); x.lineTo(254, 259); x.lineTo(238, 232); x.closePath(); x.fill();
  } else { // rainbow stripes + stars
    const cols = ['#ff6b6b', '#ffb84d', '#ffe66b', '#6bdc8a', '#5bb8ff', '#a98bff', '#ff8ad8'];
    x.globalAlpha = .62; for (let i = 0; i < 14; i++) { x.fillStyle = cols[i % cols.length]; x.beginPath(); x.moveTo(100 + i * 26, 160); x.lineTo(130 + i * 26, 160); x.lineTo(70 + i * 26, 440); x.lineTo(40 + i * 26, 440); x.closePath(); x.fill(); }
    x.globalAlpha = 1; x.fillStyle = '#ffffff';
    for (const [sx, sy, sr] of [[205, 240, 11], [300, 300, 8], [240, 365, 7], [310, 220, 6]]) { x.beginPath(); for (let k = 0; k < 8; k++) { const a = k / 8 * TAU, rr = k % 2 ? sr * .38 : sr; x.lineTo(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr); } x.closePath(); x.fill(); }
  }
  // "?" rune
  x.font = '700 64px serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = tier === 'rainbow' ? 'rgba(255,255,255,.9)' : 'rgba(70,45,20,.38)'; x.fillText('?', 254, tier === 'gold' ? 372 : 300);
  // shading: rim darkening + top-left highlight
  const sh = x.createRadialGradient(205, 225, 40, 254, 310, 190); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(.75, 'rgba(0,0,0,.05)'); sh.addColorStop(1, 'rgba(40,20,0,.38)'); x.fillStyle = sh; x.fillRect(0, 0, 512, 512);
  x.fillStyle = 'rgba(255,255,255,.55)'; x.beginPath(); x.ellipse(212, 225, 22, 38, -.45, 0, TAU); x.fill();
  x.restore();
  x.strokeStyle = 'rgba(60,35,10,.45)'; x.lineWidth = 3; eggPath(x); x.stroke();
  return (MEGG[tier] = c);
}
/** image / data URL for any egg: named → species egg art, mystery → tier shell */
export const eggOf = egg => egg.kind === 'mystery' ? mysteryEggImg(egg.tier) : eggImg(egg.sid);
const MEGGU = {};
export const eggURLOf = egg => egg.kind === 'mystery' ? (MEGGU[egg.tier] || (MEGGU[egg.tier] = (im => im.toDataURL ? im.toDataURL('image/webp', .9) : im.src)(mysteryEggImg(egg.tier)))) : eggURL(egg.sid);

// ---- light sprites (batch 06): white + alpha images tinted to any colour, drawn additively ----
const TINT = {};
/** a white light sprite (fx_*, hatch_altar_glow) recoloured to `color` (cached); null without the art */
export function tinted(name, color) {
  const img = IMG[name]; if (!img) return null;
  const k = name + color; if (TINT[k]) return TINT[k];
  const c = mk(img.width, img.height), x = c.getContext('2d');
  x.drawImage(img, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
  return (TINT[k] = c);
}
/** draw a light sprite centred at (x, y) with size w×h: tinted glow + a fainter white-hot core, additive */
export function fx(ctx, name, color, x, y, w, h, alpha = 1, rot = 0) {
  const t = tinted(name, color); if (!t || alpha <= 0) return false;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(x, y); if (rot) ctx.rotate(rot);
  ctx.globalAlpha = Math.min(1, alpha); ctx.drawImage(t, -w / 2, -h / 2, w, h);
  ctx.globalAlpha = Math.min(1, alpha) * .35; ctx.drawImage(IMG[name], -w / 2, -h / 2, w, h);
  ctx.restore(); return true;
}
const MULT = {};
/** a colourless object sprite (hatch_crystal) multiplied by `color`, keeping its own alpha (cached) */
export function colored(name, color) {
  const img = IMG[name]; if (!img) return null;
  const k = name + color; if (MULT[k]) return MULT[k];
  const c = mk(img.width, img.height), x = c.getContext('2d');
  x.drawImage(img, 0, 0); x.globalCompositeOperation = 'multiply'; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
  x.globalCompositeOperation = 'destination-in'; x.drawImage(img, 0, 0);
  return (MULT[k] = c);
}
