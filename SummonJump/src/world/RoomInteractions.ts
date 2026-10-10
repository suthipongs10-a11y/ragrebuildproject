import { Cell, TILE } from '@shared/platformer';
import { addItem } from '@shared/index';
import type { Interactable } from './EntityViews';
import type { WorldScene } from '../scenes/WorldScene';
import { t } from '../i18n';

/** Room objects the hero touches: signs/NPCs (▲), pipes (▼/▲), the rock wall (smash), crystal pickups. */
export class RoomInteractions {
  constructor(private readonly s: WorldScene) {}

  nearestInteractable(): Interactable | null {
    const h = this.s.hero, cx = h.x + h.w / 2, cy = h.y + h.h;
    let best: Interactable | null = null, bd = 1e9;
    for (const it of this.s.interactables) {
      if (Math.abs(cx - it.e.x) > 40 || Math.abs(cy - it.e.y) > 44) continue;
      const d = Math.abs(cx - it.e.x);
      if (d < bd) { bd = d; best = it; }
    }
    return best;
  }

  /** Pipe the hero can use right now (for the on-screen action button). */
  pipeAction: { label: string; run: () => void } | null = null;

  checkPipes(): void {
    const h = this.s.hero, c = this.s.controls, cx = h.x + h.w / 2;
    this.pipeAction = null;
    for (const e of this.s.level.entities) {
      if (e.type !== 'Pipe') continue;
      const inX = cx > e.x - e.w / 2 && cx < e.x + e.w / 2;
      const target = String(e.fields.target), tx = Number(e.fields.tx), ty = Number(e.fields.ty);
      const onTop = e.fields.dir === 'down' && inX && h.onGround && Math.abs(h.y + h.h - (e.y - e.h)) < 6;
      const under = e.fields.dir === 'up' && inX && h.y < e.y + 48;
      if (onTop || (e.fields.dir === 'up' && inX && h.y < e.y + 200)) {
        this.s.prompt.setText(onTop ? '▼' : '▲').setVisible(true).setPosition(e.x, (onTop ? e.y - e.h - 64 : e.y + 40) + Math.sin(this.s.time.now / 140) * 3);
      }
      const down = () => { this.s.toast(t('pipe.down')); this.s.goRoom(target, { kind: 'tile', x: tx, y: ty, fromAbove: true }, 300); };
      const up = () => { this.s.toast(t('pipe.up')); this.s.goRoom(target, { kind: 'tile', x: tx, y: ty, fromAbove: false }, 300); };
      if (onTop) this.pipeAction = { label: t('act.pipeDown'), run: down };
      if (under) this.pipeAction = { label: t('act.pipeUp'), run: up };
      if (onTop && c.pressed('down')) { down(); return; }
      if (under && c.pressed('up')) { up(); return; }
    }
  }

  /** Attack key in Phase 1 only smashes rocks (needs the `break` ability). */
  swing(): void {
    const h = this.s.hero, reach = 44;
    const x0 = h.dir > 0 ? h.x + h.w : h.x - reach, x1 = x0 + reach;
    let rock = false;
    for (let ty = Math.floor(h.y / TILE); ty <= Math.floor((h.y + h.h) / TILE); ty++)
      for (let tx = Math.floor(x0 / TILE); tx <= Math.floor(x1 / TILE); tx++) if (this.s.grid.get(tx, ty) === Cell.Rock) rock = true;
    if (!rock) return;
    if (this.s.abilities.has('break')) {
      this.clearRocks(true); this.s.save.broken[this.s.level.id] = true; this.s.flush(); this.s.cameras.main.shake(260, 0.008);
      this.s.toast(t('rock.broken'));
    } else this.s.hint('rock', t('rock.need'));
  }

  abilityLine(): string {
    const a = this.s.abilities;
    return `${t('abil.title')} ${a.has('double') ? '🌪️✓' : '🌪️✗'} ${a.has('dive') ? '💧✓' : '💧✗'} ${a.has('break') ? '🔥✓' : '🔥✗'}${a.has('cloud') ? ' ☁️✓' : ''}${a.has('reveal') ? ' 👁️✓' : ''}`;
  }

  touchingRock(dir: number): boolean {
    const h = this.s.hero, tx = Math.floor((dir > 0 ? h.x + h.w + 2 : h.x - 2) / TILE);
    for (let ty = Math.floor(h.y / TILE); ty <= Math.floor((h.y + h.h - 1) / TILE); ty++) if (this.s.grid.get(tx, ty) === Cell.Rock) return true;
    return false;
  }

  clearRocks(animate: boolean): void {
    // rubble where each rock column stood (P01 prop_rock_debris)
    const base = new Map<number, number>();
    for (let y = 0; y < this.s.grid.h; y++) for (let x = 0; x < this.s.grid.w; x++) if (this.s.grid.get(x, y) === Cell.Rock) { this.s.grid.set(x, y, Cell.Empty); base.set(x, Math.max(base.get(x) ?? 0, y)); }
    if (this.s.textures.exists('prop_rock_debris')) for (const [x, y] of base) {
      const d = this.s.add.image(x * TILE + TILE / 2, (y + 1) * TILE + 4, 'prop_rock_debris').setOrigin(0.5, 1).setDepth(6).setAlpha(animate ? 0 : 1);
      d.setScale((TILE * 2.6) / d.width);
      if (animate) this.s.tweens.add({ targets: d, alpha: 1, duration: 300, delay: 150 });
    }
    if (!this.s.view) return;
    for (const r of this.s.view.rocks.values()) {
      if (animate) this.s.tweens.add({ targets: r, alpha: 0, duration: 350, onComplete: () => r.destroy() }); else r.destroy();
    }
    this.s.view.rocks.clear();
  }

  collectPickups(): void {
    const h = this.s.hero, cx = h.x + h.w / 2, cy = h.y + h.h / 2;
    for (const p of [...this.s.pickups]) {
      if (Math.abs(cx - p.x) < 28 && Math.abs(cy - p.y) < 40) {
        this.s.save.items[p.id] = true; this.s.flush(); p.obj.destroy();
        this.s.pickups = this.s.pickups.filter((q) => q !== p);
        if (p.item === 'stone') { this.s.save.soul += p.amount; this.s.toast(t('item.stone').replace('{n}', String(p.amount))); continue; } // soul stones
        const got = addItem(this.s.session.data, this.s.session.content, p.item, 1);
        this.s.toast(got ? t('combat.got').replace('{name}', t(`item.${p.item}`)) : t('item.stone').replace('{n}', '0'));
      }
    }
  }

}
