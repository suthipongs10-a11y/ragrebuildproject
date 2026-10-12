// @ts-nocheck
// Evolution scene (อัปดาว): the monster stands on the hatching altar, its food monsters circle above it, glow and dissolve into
// light that pours into it; the four crystals fire their power, the monster overloads (aura, lightning, light shafts),
// flashes white and BOOM — it comes back in its new look and the new star slams in. Reuses HatchView's epic pre-hatch.
import { HatchView } from './hatchView';
import { PIV, TAU, spr, silOf, glowOf, GP, baseOf } from './assets';
import { SPECIES } from '../core/data';
import { sfx } from './audio';
import { E, rnd, clamp, addP, burst, ring, shake } from './engine';

export class EvolveView extends HatchView {
  toSid; foods; fq = 0;
  constructor(fromSid, toSid, foods, opts) {
    super(fromSid, { ...opts, rarityOverride: opts.toStars >= 5 ? 'legendary' : 'epic' });
    this.toSid = toSid; this.phase = 'hatching';
    const m = this.mon; this.auraW = 100 * m.k / .4; this.auraH = 150 * m.k / .4; this.arcK = 1.5 * m.k / .4;
    this.bannerText = `★${opts.toStars} วิวัฒน์!`; this.bannerCol = '#ffd24a';
    this.foods = foods.map((sid, i) => ({ sid, a: i / foods.length * TAU, alpha: 1, gone: false, k: .2 * ((SPECIES[baseOf(sid)].scale) || 1) }));
    this.drawExtra = () => this.drawFoods();
  }
  start() { super.start(); sfx.whoosh(); }
  eggC() { return [this.egg.x, this.egg.y - this.bodyH()]; }
  crack(stage) { const [x, y] = this.eggC(); sfx.crack(); shake(3 + stage * 2); burst(x, this.egg.y, this.egg.y - y, 14, this.col(), 260, 12, .5); ring(this.egg.x, this.egg.y, 8, 120 + stage * 40, this.col(), .4, 4); }
  update(dt) {
    if (this.preDone && this.egg.vis) this.sid = this.toSid; // the BOOM frame: come back in the new look
    const T = this.preTl(), q = clamp(this.pt / T.G, 0, 1);
    for (const f of this.foods) { // food monsters circle above the altar, faster and faster, then dissolve into light
      f.a += dt * (.5 + q * 3.2);
      if (!f.gone && q > .5) { f.alpha = Math.max(0, 1 - (q - .5) / .3);
        if (Math.random() < dt * 30) { const [x, y, z] = this.foodPos(f), [cx, cy] = this.eggC(), life = .35; addP({ x, y, z, vx: (cx - x) / life, vy: 0, vz: ((this.egg.y - cy) - z) / life, life, size: rnd(6, 11), size2: 2, color: this.col() }); }
        if (f.alpha <= 0) { f.gone = true; const [x, y, z] = this.foodPos(f); burst(x, y, z, 18, this.col(), 280, 12, .5); sfx.zap(); shake(4); } }
    }
    super.update(dt);
  }
  foodPos(f) { const R = 215; return [this.egg.x + Math.cos(f.a) * R, this.egg.y - 10 + Math.sin(f.a) * R * .36, 150 + Math.sin(E.time * 2 + f.a * 3) * 10]; }
  drawFoods() {
    const ctx = E.ctx, T = this.preTl(), q = clamp(this.pt / T.G, 0, 1), [cx, cy] = this.eggC();
    for (const f of this.foods) {
      if (f.gone) continue; const [x, y, z] = this.foodPos(f), key = 'front_idle';
      if (q > .5) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = f.alpha * .8; ctx.strokeStyle = this.col(); ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x, y - z); ctx.lineTo(cx, cy); ctx.stroke(); ctx.restore(); }
      ctx.save(); ctx.translate(x, y - z); ctx.scale(f.k * (Math.cos(f.a) > 0 ? -1 : 1), f.k); ctx.globalAlpha = f.alpha;
      ctx.drawImage(spr(f.sid, key), -PIV[0], -PIV[1]);
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = f.alpha * Math.min(1, q * 1.6); ctx.drawImage(glowOf(f.sid, key, this.col()), -PIV[0] - GP, -PIV[1] - GP);
      ctx.globalAlpha = f.alpha * clamp((q - .3) * 2, 0, 1); ctx.drawImage(silOf(f.sid, key, '#ffffff'), -PIV[0], -PIV[1]);
      ctx.restore();
    }
  }
  /** before the BOOM the "egg" is the monster itself: it shakes with the egg's wobble and burns white at the end */
  drawEgg() {
    const g = this.egg; if (!g.vis) return; const ctx = E.ctx, m = this.mon, key = 'front_idle';
    ctx.fillStyle = 'rgba(15,10,5,.35)'; ctx.beginPath(); ctx.ellipse(g.x, g.y + 2, 60, 16, 0, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(g.x, g.y - g.hop); ctx.rotate(g.rot * .5); ctx.scale(m.k * g.sx, m.k * g.sy);
    if (g.glow > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, g.glow); ctx.drawImage(glowOf(this.sid, key, this.col()), -PIV[0] - GP, -PIV[1] - GP); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
    ctx.drawImage(spr(this.sid, key), -PIV[0], -PIV[1]);
    const w = Math.max(g.white, this.auraK * .25); if (w > 0) { ctx.globalAlpha = w; ctx.drawImage(silOf(this.sid, key, '#ffffff'), -PIV[0], -PIV[1]); }
    ctx.restore();
  }
}
