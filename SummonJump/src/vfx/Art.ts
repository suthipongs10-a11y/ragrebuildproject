import Phaser from 'phaser';

/** Painted VFX (P03 part 3 + P04 part 4), drawn on black and added with additive light. Loaded with the base pack. */
export const VFX_KEYS = ['vfx_slash', 'vfx_slash_heavy', 'vfx_hit_spark', 'vfx_crit_burst', 'vfx_magic_circle', 'vfx_fire_ring', 'vfx_tornado', 'vfx_wave',
  'vfx_meteor', 'vfx_holy_pillar', 'vfx_levelup', 'vfx_jelly_splash', 'vfx_element_wind', 'vfx_element_water', 'vfx_element_fire', 'vfx_ult_aura', 'env_pipe', 'env_boulder'];

/** skills.csv `vfx` names without their own painting yet → the closest painted effect (+ tint). */
const ALIAS: Record<string, [string, number | null]> = {
  vfx_heal: ['vfx_levelup', 0x9dffb0], vfx_blessing: ['vfx_holy_pillar', null], vfx_energy_shield: ['vfx_magic_circle', 0x9ad8ff],
  vfx_whirlwind: ['vfx_tornado', null], vfx_frost_nova: ['vfx_element_water', null], vfx_holy_light: ['vfx_holy_pillar', null],
  vfx_dash: ['vfx_slash_heavy', null], vfx_fire_wall: ['vfx_element_fire', null],
};

/** Painted key for a `vfx` name, or null when there is none (callers keep the code-drawn effect). */
export function vfxArt(scene: Phaser.Scene, name: string | null | undefined): { key: string; tint: number | null } | null {
  if (!name) return null;
  if (scene.textures.exists(name)) return { key: name, tint: null };
  const a = ALIAS[name];
  return a && scene.textures.exists(a[0]) ? { key: a[0], tint: a[1] } : null;
}

export interface FxOpts {
  /** target size in px (longest side) */ size: number; life?: number; tint?: number | null; flipX?: boolean; flipY?: boolean;
  /** grow from this fraction of the size */ from?: number; spin?: number; depth?: number; origin?: [number, number]; alpha?: number; ease?: string;
}

/** One painted flash: scale in, fade out, destroy. Returns false when the texture isn't loaded. */
export function fxImg(scene: Phaser.Scene, key: string, x: number, y: number, o: FxOpts): boolean {
  if (!scene.textures.exists(key)) return false;
  const img = scene.add.image(x, y, key).setDepth(o.depth ?? 30).setBlendMode(Phaser.BlendModes.ADD).setFlip(!!o.flipX, !!o.flipY);
  if (o.origin) img.setOrigin(o.origin[0], o.origin[1]);
  if (o.tint != null) img.setTint(o.tint);
  const s = o.size / Math.max(1, img.width, img.height);
  img.setScale(s * (o.from ?? 0.6)).setAlpha(o.alpha ?? 1);
  scene.tweens.add({ targets: img, scale: s, angle: o.spin ?? 0, duration: (o.life ?? 260) * 0.45, ease: o.ease ?? 'Cubic.out' });
  scene.tweens.add({ targets: img, alpha: 0, delay: (o.life ?? 260) * 0.4, duration: (o.life ?? 260) * 0.6, onComplete: () => img.destroy() });
  return true;
}
