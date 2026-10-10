import Phaser from 'phaser';
import type { Shot, Zone } from '@shared/index';

/**
 * Painted projectiles and zones (P03 Jobs VFX): arrows, bolts, tornado, fire wall, trap, pneuma.
 * One pooled image per live shot/zone; returns false for things without art so the caller keeps drawing shapes.
 */
const SHOT_ART: Record<string, string> = {
  arrow: 'prj_arrow', magic_shot: 'vfx_soul_strike', vfx_arrow_trail: 'vfx_arrow_trail', vfx_arrow_shower: 'vfx_arrow_trail', tornado: 'vfx_tornado',
  vfx_fire_bolt: 'vfx_fire_bolt', vfx_cold_bolt: 'vfx_cold_bolt', vfx_lightning_bolt: 'vfx_lightning_bolt', vfx_soul_strike: 'vfx_soul_strike', vfx_holy_light: 'vfx_soul_strike',
};
/** px length of the painting along its flight direction, per shot radius */
const SHOT_LEN: Record<string, number> = { vfx_soul_strike: 6.5, prj_arrow: 5.5, vfx_arrow_trail: 6, vfx_tornado: 4, vfx_lightning_bolt: 7 };
/** direction the painting itself points (degrees clockwise from →) */
const SHOT_ANGLE: Record<string, number> = { vfx_fire_bolt: 35, vfx_cold_bolt: 55, vfx_lightning_bolt: 90 };
const ZONE_ART = (z: Zone): string => (z.pneuma ? 'vfx_pneuma' : z.trap ? 'vfx_ankle_trap' : 'vfx_fire_wall');

export class ShotSprites {
  private readonly shots = new Map<Shot, Phaser.GameObjects.Image>();
  private readonly zones = new Map<number, Phaser.GameObjects.Image>();

  constructor(private readonly scene: Phaser.Scene) {}

  /** Art key for a shot, or null (draw it as a shape). */
  artFor(s: Shot): string | null {
    const k = SHOT_ART[s.kind ?? ''];
    return k && this.scene.textures.exists(k) ? k : null;
  }

  sync(shots: Shot[], zones: Zone[], time: number): void {
    const live = new Set<Shot>();
    for (const s of shots) {
      const key = (s.delay ?? 0) > 0 ? null : this.artFor(s);
      if (!key) continue;
      live.add(s);
      let img = this.shots.get(s);
      if (!img) {
        img = this.scene.add.image(s.x, s.y, key).setDepth(25).setBlendMode(key === 'prj_arrow' ? Phaser.BlendModes.NORMAL : Phaser.BlendModes.ADD);
        img.setScale((s.r * (SHOT_LEN[key] ?? 5)) / Math.max(1, img.width));
        this.shots.set(s, img);
      }
      // paintings point to the right; the tornado stays upright and wobbles
      if (key === 'vfx_tornado') img.setPosition(s.x + Math.sin(time * 9) * 5, s.y).setRotation(0);
      else img.setPosition(s.x, s.y).setRotation(Math.atan2(s.vy, s.vx) - ((SHOT_ANGLE[key] ?? 0) * Math.PI) / 180);
    }
    for (const [s, img] of this.shots) if (!live.has(s)) { img.destroy(); this.shots.delete(s); }

    const zl = new Set<number>();
    for (const z of zones) {
      const key = ZONE_ART(z);
      if (!this.scene.textures.exists(key)) continue;
      zl.add(z.id);
      let img = this.zones.get(z.id);
      if (!img) {
        img = this.scene.add.image(z.x + z.w / 2, z.y + z.h, key).setOrigin(0.5, 0.92).setDepth(7).setBlendMode(Phaser.BlendModes.ADD);
        img.setDisplaySize(z.w * (z.trap ? 1.4 : 1.15), z.trap ? z.w * 0.9 : Math.max(z.h * 1.3, z.w * (z.pneuma ? 0.9 : 0.45)));
        this.zones.set(z.id, img);
      }
      img.setAlpha(0.8 + Math.sin(time * 10 + z.id) * 0.15);
    }
    for (const [id, img] of this.zones) if (!zl.has(id)) { img.destroy(); this.zones.delete(id); }
  }

  hasZoneArt(z: Zone): boolean { return this.scene.textures.exists(ZONE_ART(z)); }
}
