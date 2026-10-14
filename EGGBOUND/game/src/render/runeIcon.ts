// Rune icons drawn in code (no art): stone shape by slot, colour + glyph by set, rim by grade. SVG → data URL, cached,
// so the same icon works in DOM <img> and on a canvas.
import { RUNE_SETS, RUNE_GRADES, type Rune, type RuneSet, type RuneSlot } from '../core/runes';

const SHAPE: Record<RuneSlot, string> = {
  1: 'M50 7a43 43 0 1 1 0 86a43 43 0 1 1 0-86z',                        // circle
  2: 'M50 5L95 50L50 95L5 50z',                                           // diamond
  3: 'M50 6L88 28L88 72L50 94L12 72L12 28z',                              // hexagon
  4: 'M50 6L90 26L82 70L50 95L18 70L10 26z',                              // shield
};
const GLYPH: Record<RuneSet, (dk: string) => string> = {
  fang: dk => '<path d="M33 31Q36 58 46 73Q43 51 46 31Z M67 31Q64 58 54 73Q57 51 54 31Z M30 29H70V35H30Z"/>',
  shell: dk => '<path fill="none" stroke-width="5" stroke-linejoin="round" d="M50 30L66 39V58L50 67L34 58V39Z M50 30V22 M66 39L73 35 M66 58L73 63 M50 67V76 M34 58L27 63 M34 39L27 35"/>',
  vital: dk => '<path d="M50 72C31 58 27 43 38 36C45 32 50 39 50 42C50 39 55 32 62 36C73 43 69 58 50 72Z"/>',
  eye: dk => '<path d="M24 50Q50 27 76 50Q50 73 24 50Z"/><circle cx="50" cy="50" r="9" fill="' + dk + '"/><circle cx="53" cy="47" r="3"/>',
  gale: dk => '<path fill="none" stroke-width="5.5" stroke-linecap="round" d="M27 40Q50 31 65 39Q75 45 66 53 M29 53Q52 46 71 56 M37 65Q51 60 61 67"/>',
  storm: dk => '<path d="M55 24L35 54H49L43 77L67 44H53L59 24Z"/>',
  blood: dk => '<path d="M50 24C50 24 33 47 33 58A17 17 0 0 0 67 58C67 47 50 24 50 24Z"/><path fill="none" opacity=".6" d="M42 58A8 8 0 0 0 50 66" stroke="' + dk + '" stroke-width="3"/>',
  sigil: dk => '<circle cx="50" cy="50" r="24" fill="none" stroke-width="3.5"/><path d="M50 24L55.5 44.5L76 50L55.5 55.5L50 76L44.5 55.5L24 50L44.5 44.5Z"/>',
};
const shade = (hex: string, k: number) => { const n = parseInt(hex.slice(1), 16), c = (v: number) => Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k))); return `rgb(${c(n >> 16)},${c(n >> 8 & 255)},${c(n & 255)})`; };
const cache = new Map<string, string>();
export function runeSVG(r: Pick<Rune, 'slot' | 'set' | 'grade'>): string {
  const S = RUNE_SETS[r.set], col = S.col, rim = RUNE_GRADES[r.grade].col, id = `${r.slot}${r.set}${r.grade}`, leg = r.grade === 'legendary', epic = r.grade === 'epic', dk = shade(col, -0.55);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs>`
    + `<radialGradient id="f${id}" cx="38%" cy="32%" r="75%"><stop offset="0" stop-color="${shade(col, 0.35)}"/><stop offset=".55" stop-color="${col}"/><stop offset="1" stop-color="${shade(col, -0.55)}"/></radialGradient>`
    + `<linearGradient id="s${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".45"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>`
    + (leg || epic ? `<path d="${SHAPE[r.slot]}" fill="none" stroke="${rim}" stroke-opacity=".45" stroke-width="12"/>` : '')
    + `<path d="${SHAPE[r.slot]}" fill="url(#f${id})" stroke="${rim}" stroke-width="${leg ? 6 : 5}"/>`
    + `<path d="${SHAPE[r.slot]}" fill="none" stroke="${shade(col, -0.7)}" stroke-opacity=".5" stroke-width="2" transform="translate(50 50) scale(.84) translate(-50 -50)"/>`
    + `<g transform="translate(1.6 2.4)" fill="${shade(col, -0.7)}" stroke="${shade(col, -0.7)}" opacity=".55">${GLYPH[r.set](dk)}</g>`
    + `<g fill="#fff8e6" stroke="#fff8e6">${GLYPH[r.set](dk)}</g>`
    + `<path d="${SHAPE[r.slot]}" fill="url(#s${id})" transform="translate(50 50) scale(.9) translate(-50 -50)"/>`
    + (leg ? `<path d="${SHAPE[r.slot]}" fill="none" stroke="#fff4c2" stroke-width="1.5" transform="translate(50 50) scale(1.08) translate(-50 -50)"/>` : '')
    + '</svg>';
}
export function runeURL(r: Pick<Rune, 'slot' | 'set' | 'grade'>): string {
  const k = `${r.slot}|${r.set}|${r.grade}`; let u = cache.get(k);
  if (!u) { u = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(runeSVG(r)); cache.set(k, u); }
  return u;
}
/** an empty socket of a slot (dashed outline) */
export function socketURL(slot: RuneSlot): string {
  const k = 'sock' + slot; let u = cache.get(k);
  if (!u) { u = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="${SHAPE[slot]}" fill="rgba(0,0,0,.35)" stroke="#d9c9a0" stroke-opacity=".55" stroke-width="3" stroke-dasharray="7 6" transform="translate(50 50) scale(.86) translate(-50 -50)"/></svg>`); cache.set(k, u); }
  return u;
}
