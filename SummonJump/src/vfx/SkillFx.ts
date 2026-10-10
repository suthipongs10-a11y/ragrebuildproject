import Phaser from 'phaser';
import type { Shot, SkillEvent, Zone } from '@shared/index';
import { burst, ELEMENT_COLOR, ring, slash } from './Effects';
import { popNumber } from './DamageText';

/** Draws hostile/friendly shots and skill zones each frame, and one-shot cast effects. Code shapes until P03 VFX art. */
export class SkillFx {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly zg: Phaser.GameObjects.Graphics;

  constructor(private readonly scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(25).setBlendMode(Phaser.BlendModes.ADD);
    this.zg = scene.add.graphics().setDepth(7).setBlendMode(Phaser.BlendModes.ADD);
  }

  draw(shots: Shot[], zones: Zone[], time: number): void {
    const g = this.g.clear();
    for (const s of shots) {
      if ((s.delay ?? 0) > 0) continue;
      if (s.hostile && s.kind === 'tornado') { // Storm Roc: a spinning funnel of wind
        for (let i = 0; i < 5; i++) { const w = s.r * (0.5 + i * 0.28), yy = s.y + 26 - i * 14, o = Math.sin(time * 9 + i) * 6; g.lineStyle(4, s.color, 0.75 - i * 0.08).strokeEllipse(s.x + o, yy, w * 2, w * 0.6); }
        continue;
      }
      if (s.hostile) { g.fillStyle(s.color, 0.9).fillCircle(s.x, s.y, s.r); g.fillStyle(0xffffff, 0.6).fillCircle(s.x, s.y, s.r * 0.45); continue; }
      const c = ELEMENT_COLOR[s.el] ?? 0xfff2cc, len = Math.hypot(s.vx, s.vy) || 1, ux = s.vx / len, uy = s.vy / len;
      if (s.kind === 'arrow' || s.kind === 'vfx_arrow_trail' || s.kind === 'vfx_arrow_shower') {
        g.lineStyle(4, 0xfff2cc, 0.9).lineBetween(s.x - ux * 34, s.y - uy * 34, s.x, s.y);
        g.lineStyle(10, c, 0.25).lineBetween(s.x - ux * 46, s.y - uy * 46, s.x, s.y);
      } else {
        g.fillStyle(c, 0.35).fillCircle(s.x - ux * 16, s.y - uy * 16, s.r * 0.9);
        g.fillStyle(c, 0.9).fillCircle(s.x, s.y, s.r * 0.75).fillStyle(0xffffff, 0.8).fillCircle(s.x, s.y, s.r * 0.35);
      }
    }
    const z = this.zg.clear();
    for (const zone of zones) {
      if (zone.pneuma) { z.fillStyle(0xffffff, 0.12).fillEllipse(zone.x + zone.w / 2, zone.y + zone.h / 2, zone.w, zone.h); z.lineStyle(3, 0xfff3c0, 0.6).strokeEllipse(zone.x + zone.w / 2, zone.y + zone.h / 2, zone.w, zone.h); continue; }
      if (zone.trap) { z.fillStyle(0xb9b4ac, 0.9).fillRect(zone.x + zone.w / 2 - 14, zone.y + zone.h - 8, 28, 8); continue; }
      const c = ELEMENT_COLOR[zone.el] ?? 0xff8a3d;
      for (let i = 0; i < 6; i++) {
        const fx = zone.x + (i + 0.5) * (zone.w / 6), h = 40 + Math.sin(time * 12 + i * 1.7) * 14;
        z.fillStyle(c, 0.55).fillTriangle(fx - 10, zone.y + zone.h, fx + 10, zone.y + zone.h, fx, zone.y + zone.h - h);
      }
    }
  }

  /** One-shot visuals for skill events. */
  play(ev: SkillEvent): void {
    const sc = this.scene;
    if (ev.kind === 'cast') {
      const c = ELEMENT_COLOR[ev.skill.element ?? 'neutral'] ?? 0xfff2cc;
      if (ev.skill.target === 'front') slash(sc, ev.x + ev.dir * 20, ev.y, ev.dir, c, true, false);
      else if (ev.skill.target === 'aoe') { ring(sc, ev.x, ev.y + 20, c, Number(ev.skill.effects.radius ?? 120) + 20, 420); burst(sc, ev.x, ev.y + 20, c, 20, 360); }
      else if (ev.skill.target === 'dash') burst(sc, ev.x, ev.y, 0xfff2cc, 12, 260);
      else if (ev.skill.target === 'buff') { ring(sc, ev.x, ev.y + 30, 0xffd88a, 60, 500); burst(sc, ev.x, ev.y, 0xffe2a0, 14, 160); }
    } else if (ev.kind === 'heal') { popNumber(sc, ev.x, ev.y - 6, ev.amount, 'heal'); burst(sc, ev.x, ev.y + 30, 0x7dff9a, 16, 160); }
  }
}
