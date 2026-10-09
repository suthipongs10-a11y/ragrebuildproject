import Phaser from 'phaser';
import type { ContentBundle, SpiritDef } from '@shared/content/types';
import { familyOf, type SpiritInst } from '@shared/index';
import { ART } from '../assets/manifest.generated';

/**
 * Spirit pictures: one painting per family (P04 art, legacy sprites for the first 5), element variants by hue shift.
 * Missing art → a code-drawn orb tinted with the element colour.
 */
export const ORB = 'spirit_orb';

export function artKey(f: SpiritDef, awk: boolean, big: boolean): string | null {
  const order = big ? [awk ? f.art_awk_big : '', f.art_big, awk ? f.art_awk_small : '', f.art_small] : [awk ? f.art_awk_small : '', f.art_small];
  return order.find((k) => k && ART[k]) ?? null;
}

const hueOf = (rgb: number): number => {
  const r = ((rgb >> 16) & 255) / 255, g = ((rgb >> 8) & 255) / 255, b = (rgb & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (!d) return 0;
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
};

export function elementColor(c: ContentBundle, el: string): number {
  return c.spiritElements.find((e) => e.element === el)?.color ?? 0xfff2cc;
}

/** CSS filter that turns the family's natural element colour into `el` (also used for DOM portraits). */
export function elementFilter(c: ContentBundle, f: SpiritDef, el: string): string {
  if (el === f.element) return '';
  const rot = Math.round(hueOf(elementColor(c, el)) - hueOf(elementColor(c, f.element)));
  const tone = el === 'holy' ? ' saturate(0.65) brightness(1.18)' : el === 'dark' ? ' saturate(1.1) brightness(0.82)' : '';
  return `hue-rotate(${rot}deg)${tone}`;
}

let canFilter: boolean | null = null;
const filterSupported = (): boolean => {
  if (canFilter === null) {
    try { const ctx = document.createElement('canvas').getContext('2d'); canFilter = !!ctx && 'filter' in ctx; } catch { canFilter = false; }
  }
  return canFilter;
};

/** White blob with eyes, drawn once; tinted per element. */
export function ensureOrb(scene: Phaser.Scene): string {
  if (scene.textures.exists(ORB)) return ORB;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0xffffff, 0.35).fillCircle(64, 64, 60);
  g.fillStyle(0xffffff, 1).fillCircle(64, 66, 44);
  g.fillStyle(0x2a1a0a, 1).fillEllipse(50, 62, 9, 14).fillEllipse(78, 62, 9, 14);
  g.fillStyle(0xffffff, 1).fillCircle(52, 58, 3).fillCircle(80, 58, 3);
  g.generateTexture(ORB, 128, 128);
  g.destroy();
  return ORB;
}

/**
 * Texture for a spirit in its element. Returns the key and whether the caller must tint it
 * (orb placeholder, or browsers without canvas filters).
 */
export function spiritTexture(scene: Phaser.Scene, c: ContentBundle, s: Pick<SpiritInst, 'id' | 'el' | 'awk'>, big = false): { key: string; tint: number | null } {
  const f = familyOf(c, s.id);
  const key = f && artKey(f, s.awk, big);
  if (!f || !key || !scene.textures.exists(key)) return { key: ensureOrb(scene), tint: elementColor(c, s.el) };
  const css = elementFilter(c, f, s.el);
  if (!css) return { key, tint: null };
  if (!filterSupported()) return { key, tint: elementColor(c, s.el) };
  const vkey = `${key}@${s.el}`;
  if (!scene.textures.exists(vkey)) {
    const src = scene.textures.get(key).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    const tex = scene.textures.createCanvas(vkey, src.width, src.height);
    if (!tex) return { key, tint: elementColor(c, s.el) };
    const ctx = tex.getContext();
    ctx.filter = css;
    ctx.drawImage(src, 0, 0);
    tex.refresh();
  }
  return { key: vkey, tint: null };
}

/** Texture keys to load for the team (small forms, and big forms for the ultimate). */
export function teamArtKeys(c: ContentBundle, team: readonly SpiritInst[]): string[] {
  const out = new Set<string>();
  for (const s of team) {
    const f = familyOf(c, s.id);
    if (!f) continue;
    const small = artKey(f, s.awk, false), big = artKey(f, s.awk, true);
    if (small) out.add(small);
    if (big) out.add(big);
  }
  return [...out];
}

/** DOM portrait for menus (no Phaser texture needed). */
export function portraitHtml(c: ContentBundle, s: Pick<SpiritInst, 'id' | 'el' | 'awk'>, size = 44): string {
  const f = familyOf(c, s.id);
  const key = f && artKey(f, s.awk, false);
  const color = `#${elementColor(c, s.el).toString(16).padStart(6, '0')}`;
  if (!f || !key) return `<span class="sp-pic sp-orb" style="width:${size}px;height:${size}px;background:radial-gradient(circle at 50% 55%, #fff 0 38%, ${color} 40% 70%, transparent 72%)"></span>`;
  const css = elementFilter(c, f, s.el);
  return `<span class="sp-pic" style="width:${size}px;height:${size}px;background-image:url(${ART[key]?.url});${css ? `filter:${css}` : ''}"></span>`;
}
