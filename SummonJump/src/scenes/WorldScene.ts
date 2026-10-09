import Phaser from 'phaser';
import { Cell, TILE, checkExit, createHero, exitsOf, stepHero, markDefeated, aliveSpawns, pruneDefeated, unstick, P,
  type EntityData, type HeroState, type LevelData, type MotionEnv, type MotionEvent, type TileGrid } from '@shared/platformer';
import { moveSpeed, type HeroBuild } from '@shared/index';
import type { ContentBundle, MonsterDef } from '@shared/content/types';
import { queueKeys, queueZone, type ZoneId } from '../assets/packs';
import type { Controls } from '../input/Controls';
import { t } from '../i18n';
import { DialogBox } from '../ui/DialogBox';
import { loadSave, writeSave, type SaveData } from '../save/local';
import { abilitiesFromUrl, type Ability } from '../world/abilities';
import { buildLevelVisuals, type LevelVisuals } from '../world/LevelView';
import { spawnEntityView, type Interactable } from '../world/EntityViews';

/** Where the hero appears when a room loads. */
export type Place =
  | { kind: 'edge'; dir: 'left' | 'right' | 'up' | 'down'; x: number; y: number; vx: number; vy: number }
  | { kind: 'tile'; x: number; y: number; fromAbove: boolean }
  | { kind: 'pos'; x: number; y: number }
  | { kind: 'default' };

const BUILD: HeroBuild = { level: 1, stats: { str: 1, agi: 1, vit: 1, int: 1, dex: 1, luk: 1 }, weaponAtk: 6, bonusAtk: 0, bonusDef: 0, bonusHp: 0, bonusCrit: 0 };
const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' } as const;

/** Phase 1 world: LDtk rooms, platforming, transitions, gates, respawn rules. Combat arrives in Phase 2. */
export class WorldScene extends Phaser.Scene {
  hero!: HeroState;
  level!: LevelData;
  private grid!: TileGrid;
  private controls!: Controls;
  private sprite!: Phaser.GameObjects.Image;
  private view!: LevelVisuals;
  private dialog!: DialogBox;
  private hud!: Phaser.GameObjects.Text;
  private toastText!: Phaser.GameObjects.Text;
  private prompt!: Phaser.GameObjects.Text;
  private toastUntil = 0;
  private busy = false;
  private interactables: Interactable[] = [];
  private monsterViews: { id: string; def: MonsterDef | undefined; obj: Phaser.GameObjects.Image }[] = [];
  private pickups: { id: string; x: number; y: number; obj: Phaser.GameObjects.Image }[] = [];
  private abilities = new Set<Ability>();
  private save!: SaveData;
  private levels!: Map<string, LevelData>;
  private msgCooldown: Record<string, number> = {};
  private initData: { room?: string; place?: Place } = {};
  private drownTicks = 0;
  private carry = { vx: 0, vy: 0, dir: 1 as 1 | -1 };

  constructor() { super('World'); }

  init(data: { room?: string; place?: Place }): void {
    this.save = (this.registry.get('save') as SaveData | undefined) ?? loadSave();
    this.registry.set('save', this.save);
    this.initData = data;
  }

  create(): void {
    const data = this.initData;
    this.controls = this.registry.get('controls') as Controls;
    if (!this.registry.has('abilities')) this.registry.set('abilities', abilitiesFromUrl(location.search));
    this.abilities = this.registry.get('abilities') as Set<Ability>;
    this.levels = this.registry.get('levels') as Map<string, LevelData>;

    const roomId = data.room ?? (this.registry.get('startRoom') as string);
    this.level = this.levels.get(roomId) ?? (this.levels.get('town') as LevelData);
    this.grid = this.level.grid.clone();
    for (const k of Object.keys(this.save.broken)) if (k === this.level.id) this.clearRocks(false);
    this.busy = false; this.interactables = []; this.monsterViews = []; this.pickups = [];

    const { width: vw, height: vh } = this.scale;
    this.cameras.main.setBounds(0, 0, this.grid.pxW, Math.max(vh, this.grid.pxH));
    this.view = buildLevelVisuals(this, this.level, this.grid, vw, vh, (id) => t(this.levels.get(id)?.name ?? id));
    for (const k of this.view.rocks.keys()) if (this.save.broken[this.level.id]) this.view.rocks.get(k)?.destroy();
    this.spawnEntities();

    this.hero = this.placeHero(data.place ?? { kind: 'default' });
    this.sprite = this.add.image(0, 0, 'hero_design').setOrigin(0.5, 1).setDepth(10);
    this.sprite.setScale(84 / this.sprite.height);
    this.cameras.main.startFollow(this.sprite, true, 0.12, 0.12, 0, 60);
    this.cameras.main.setScroll(Math.max(0, this.hero.x - vw / 2), 0);
    this.cameras.main.fadeIn(180, 0, 0, 0);

    const f = { fontFamily: 'Itim', color: '#fff6e2', stroke: '#2a1a0a', strokeThickness: 4 };
    this.hud = this.add.text(16, 10, '', { ...f, fontSize: '18px' }).setScrollFactor(0).setDepth(100);
    this.toastText = this.add.text(vw / 2, 90, '', { ...f, fontSize: '26px', strokeThickness: 5 }).setOrigin(0.5).setScrollFactor(0).setDepth(100).setAlpha(0);
    this.prompt = this.add.text(0, 0, '▲', { ...f, fontSize: '26px', color: '#ffd88a' }).setOrigin(0.5, 1).setDepth(50).setVisible(false);
    this.dialog = new DialogBox(this);
    this.showBanner(t(this.level.name));

    this.save.room = this.level.id; this.save.seen[this.level.id] = true; this.flush();
    this.bindDebugKeys();
    const home = document.getElementById('b_home');
    if (home) home.onclick = (e) => { e.preventDefault(); this.goHome(); };
    this.drownTicks = 0;
  }

  /** 🏠 button / H key: back to the town save point (escape hatch while there is no death/HP yet). */
  goHome(msg = t('home.go')): void {
    if (this.busy) return;
    this.toast(msg);
    this.carry = { vx: 0, vy: 0, dir: 1 };
    this.goRoom('town', { kind: 'default' }, 250);
  }

  // ───────────────────────── room setup ─────────────────────────
  private spawnEntities(): void {
    const content = this.registry.get('content') as ContentBundle | undefined;
    const defs = new Map(content?.monsters.map((m) => [m.id, m]) ?? []);
    const now = Date.now();
    pruneDefeated(this.save.defeated, now);
    const monsters = this.level.entities.filter((e) => e.type === 'Monster');
    for (const e of aliveSpawns(monsters, this.save.defeated, now)) {
      const def = defs.get(String(e.fields.monster));
      const flies = def?.ai === 'flyer' || def?.ai === 'swimmer';
      const drawH = def?.draw_h ?? 44;
      const obj = this.add.image(e.x, flies ? e.y - drawH : e.y, `legacy_${e.fields.monster}`).setOrigin(0.5, 1).setDepth(8).setFlipX(true);
      obj.setScale((drawH * 2) / obj.height); // content draw_h is prototype scale
      this.tweens.add({ targets: obj, y: obj.y - (flies ? 14 : 3), duration: flies ? 900 : 500, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      this.monsterViews.push({ id: e.id, def, obj });
    }
    for (const e of this.level.entities) {
      if (e.type === 'Item') {
        if (this.save.items[e.id]) continue;
        const obj = this.add.image(e.x, e.y - 6, 'icon_crystal').setOrigin(0.5, 1).setDepth(8).setScale(34 / 128);
        this.tweens.add({ targets: obj, y: obj.y - 8, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
        this.pickups.push({ id: e.id, x: e.x, y: e.y - 22, obj });
      } else if (e.type !== 'Monster' && e.type !== 'Pipe') {
        const it = spawnEntityView(this, e, this.save, this.abilities);
        if (it) this.interactables.push(it);
      }
    }
  }

  private placeHero(place: Place): HeroState {
    const h = createHero(0, 0);
    const l = this.level, c = this.carry;
    h.vx = c.vx; h.vy = c.vy; h.dir = c.dir;
    const clampX = (x: number) => Phaser.Math.Clamp(x, 0, l.grid.pxW - h.w);
    switch (place.kind) {
      case 'edge': {
        // arriving from `dir` side of the previous room: we enter on the opposite side of this one
        if (place.dir === 'left') h.x = l.grid.pxW - h.w - 1;
        else if (place.dir === 'right') h.x = 1;
        else h.x = clampX(place.x);
        if (place.dir === 'up') { h.y = l.grid.pxH - h.h - 1; h.vy = Math.min(h.vy, -P.jump); }
        else if (place.dir === 'down') h.y = -h.h + 2;
        else h.y = Phaser.Math.Clamp(place.y, -h.h, l.grid.pxH - h.h);
        break;
      }
      case 'tile': h.x = place.x * TILE - h.w / 2; h.y = place.fromAbove ? place.y * TILE + 2 : place.y * TILE - h.h; h.vx = h.vy = 0; break;
      case 'pos': h.x = place.x; h.y = place.y; h.vx = h.vy = 0; break;
      default: {
        const sp = this.save.spawn?.room === l.id ? this.save.spawn : null;
        const pt = l.entities.find((e) => e.type === 'SavePoint');
        if (sp) { h.x = sp.x; h.y = sp.y; }
        else if (pt) { h.x = pt.x + 40; h.y = pt.y - h.h; }
        else if (l.safe) { h.x = l.safe.x * TILE; h.y = (l.safe.y + 1) * TILE - h.h; }
        else { h.x = 2 * TILE; h.y = (l.floorRow ?? 4) * TILE - h.h; }
        h.vx = h.vy = 0;
      }
    }
    // never start inside a wall (e.g. entering town from the desert while the rock wall is still standing)
    unstick(h, this.grid, place.kind === 'edge' && place.dir === 'right' ? 1 : -1);
    h.prevBottom = h.y + h.h;
    return h;
  }

  private goRoom(roomId: string, place: Place, fadeMs = 150): void {
    if (this.busy) return;
    this.busy = true;
    this.carry = { vx: this.hero.vx, vy: this.hero.vy, dir: this.hero.dir };
    this.flush();
    const target = this.levels.get(roomId);
    if (!target) { this.busy = false; return; }
    this.cameras.main.fadeOut(fadeMs, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      const go = () => this.scene.restart({ room: roomId, place });
      if (queueZone(this, target.zone as ZoneId)) { this.load.once('complete', go); this.load.start(); } else go();
    });
  }

  // ───────────────────────── frame loop ─────────────────────────
  override update(_t: number, dtMs: number): void {
    const c = this.controls;
    const dt = dtMs / 1000;
    if (this.busy) { c.endFrame(); return; }

    const talking = this.dialog.isOpen;
    if (talking && (c.pressed('jump') || c.pressed('atk') || c.pressed('up'))) this.dialog.next();

    const near = talking ? null : this.nearestInteractable();
    this.prompt.setText('▲').setVisible(!!near);
    if (near) this.prompt.setPosition(near.e.x, near.e.y - near.height - 6 + Math.sin(this.time.now / 140) * 3);

    let jumpPressed = !talking && c.pressed('jump');
    if (near && c.pressed('up')) { near.use(); jumpPressed = false; } // ▲ near an object = interact, not jump
    // next to a rock wall: attack OR ▲ smashes it (players kept missing the attack key)
    const rockSide = this.touchingRock(1) ? 1 : this.touchingRock(-1) ? -1 : 0;
    if (!talking && rockSide && !near) {
      this.prompt.setText(this.abilities.has('break') ? t('rock.prompt') : '✖').setVisible(true)
        .setPosition(this.hero.x + this.hero.w / 2, this.hero.y - 20 + Math.sin(this.time.now / 140) * 3);
      if (c.pressed('up')) { jumpPressed = false; this.hero.dir = rockSide as 1 | -1; this.swing(); }
    }

    const dir = talking ? 0 : (((c.state.right ? 1 : 0) - (c.state.left ? 1 : 0)) as -1 | 0 | 1);
    const env: MotionEnv = { grid: this.grid, water: this.level.water, abilities: { double: this.abilities.has('double'), dive: this.abilities.has('dive') }, moveSpeed: moveSpeed(BUILD), exits: exitsOf(this.level) };
    const events = stepHero(this.hero, { dir, jumpPressed, jumpHeld: !talking && c.state.jump, down: c.state.down }, env, dt);
    this.onEvents(events);

    if (!talking && c.pressed('atk')) this.swing();
    if (dir && this.touchingRock(dir)) this.hint('rockTouch', t(this.abilities.has('break') ? 'rock.touch' : 'rock.needUrl'));
    if (!talking) this.checkPipes();
    this.collectPickups();

    const ex = checkExit(this.hero, env);
    if (ex === 'fall') this.fallRespawn();
    else if (ex) {
      const to = this.level.exitTo[ex];
      if (to) this.goRoom(to, { kind: 'edge', dir: OPPOSITE[ex], x: this.hero.x, y: this.hero.y, vx: 0, vy: 0 });
    }

    const h = this.hero;
    this.sprite.setPosition(h.x + h.w / 2, h.y + h.h).setFlipX(h.dir < 0);
    this.sprite.setAngle(h.onGround && Math.abs(h.vx) > 20 ? Math.sin(this.time.now / 60) * 3 : 0);
    this.hud.setText(`${t(this.level.name)} · ${Math.round(this.game.loop.actualFps)} fps\n${this.abilityLine()}`);
    if (this.toastUntil && this.time.now > this.toastUntil) { this.toastUntil = 0; this.tweens.add({ targets: this.toastText, alpha: 0, duration: 300 }); }
    c.endFrame();
  }

  private onEvents(events: MotionEvent[]): void {
    for (const e of events) {
      if (e === 'drown') {
        this.hint('drown', t('drown.need'));
        if (++this.drownTicks >= 4) this.goHome(t('drown.out'));
      }
      if (e === 'doubleJump') this.puff(0x8ff0bf);
      if (e === 'land') this.puff(0xe8d6b0);
    }
  }

  private puff(color: number): void {
    const h = this.hero, r = this.add.circle(h.x + h.w / 2, h.y + h.h, 6, color, 0.8).setDepth(9);
    this.tweens.add({ targets: r, scale: 3, alpha: 0, duration: 280, onComplete: () => r.destroy() });
  }

  private fallRespawn(): void {
    const h = this.hero, s = this.level.safe ?? { x: 2, y: 4 };
    h.x = s.x * TILE; h.y = (s.y + 1) * TILE - h.h; h.vx = h.vy = 0;
    this.toast(t('fall.sky'));
  }

  // ───────────────────────── interaction ─────────────────────────
  private nearestInteractable(): Interactable | null {
    const h = this.hero, cx = h.x + h.w / 2, cy = h.y + h.h;
    let best: Interactable | null = null, bd = 1e9;
    for (const it of this.interactables) {
      if (Math.abs(cx - it.e.x) > 40 || Math.abs(cy - it.e.y) > 44) continue;
      const d = Math.abs(cx - it.e.x);
      if (d < bd) { bd = d; best = it; }
    }
    return best;
  }

  private checkPipes(): void {
    const h = this.hero, c = this.controls, cx = h.x + h.w / 2;
    for (const e of this.level.entities) {
      if (e.type !== 'Pipe') continue;
      const inX = cx > e.x - e.w / 2 && cx < e.x + e.w / 2;
      const target = String(e.fields.target), tx = Number(e.fields.tx), ty = Number(e.fields.ty);
      const onTop = e.fields.dir === 'down' && inX && h.onGround && Math.abs(h.y + h.h - (e.y - e.h)) < 6;
      const under = e.fields.dir === 'up' && inX && h.y < e.y + 48;
      if (onTop || (e.fields.dir === 'up' && inX && h.y < e.y + 200)) {
        this.prompt.setText(onTop ? '▼' : '▲').setVisible(true).setPosition(e.x, (onTop ? e.y - e.h - 64 : e.y + 40) + Math.sin(this.time.now / 140) * 3);
      }
      if (onTop && c.pressed('down')) {
        this.toast(t('pipe.down')); this.goRoom(target, { kind: 'tile', x: tx, y: ty, fromAbove: true }, 300); return;
      }
      if (under && c.pressed('up')) {
        this.toast(t('pipe.up')); this.goRoom(target, { kind: 'tile', x: tx, y: ty, fromAbove: false }, 300); return;
      }
    }
  }

  /** Attack key in Phase 1 only smashes rocks (needs the `break` ability). */
  private swing(): void {
    const h = this.hero, reach = 44;
    const x0 = h.dir > 0 ? h.x + h.w : h.x - reach, x1 = x0 + reach;
    let rock = false;
    for (let ty = Math.floor(h.y / TILE); ty <= Math.floor((h.y + h.h) / TILE); ty++)
      for (let tx = Math.floor(x0 / TILE); tx <= Math.floor(x1 / TILE); tx++) if (this.grid.get(tx, ty) === Cell.Rock) rock = true;
    if (!rock) return;
    if (this.abilities.has('break')) {
      this.clearRocks(true); this.save.broken[this.level.id] = true; this.flush(); this.cameras.main.shake(260, 0.008);
      this.toast(t('rock.broken'));
    } else this.hint('rock', t('rock.need'));
  }

  private abilityLine(): string {
    const a = this.abilities;
    return `${t('abil.title')} ${a.has('double') ? '🌪️✓' : '🌪️✗'} ${a.has('dive') ? '💧✓' : '💧✗'} ${a.has('break') ? '🔥✓' : '🔥✗'}`;
  }

  private touchingRock(dir: number): boolean {
    const h = this.hero, tx = Math.floor((dir > 0 ? h.x + h.w + 2 : h.x - 2) / TILE);
    for (let ty = Math.floor(h.y / TILE); ty <= Math.floor((h.y + h.h - 1) / TILE); ty++) if (this.grid.get(tx, ty) === Cell.Rock) return true;
    return false;
  }

  private clearRocks(animate: boolean): void {
    for (let y = 0; y < this.grid.h; y++) for (let x = 0; x < this.grid.w; x++) if (this.grid.get(x, y) === Cell.Rock) this.grid.set(x, y, Cell.Empty);
    if (!this.view) return;
    for (const r of this.view.rocks.values()) {
      if (animate) this.tweens.add({ targets: r, alpha: 0, duration: 350, onComplete: () => r.destroy() }); else r.destroy();
    }
    this.view.rocks.clear();
  }

  private collectPickups(): void {
    const h = this.hero, cx = h.x + h.w / 2, cy = h.y + h.h / 2;
    for (const p of [...this.pickups]) {
      if (Math.abs(cx - p.x) < 28 && Math.abs(cy - p.y) < 40) {
        this.save.items[p.id] = true; this.flush(); p.obj.destroy();
        this.pickups = this.pickups.filter((q) => q !== p);
        this.toast(t('item.stone'));
      }
    }
  }

  // ───────────────────────── ui helpers ─────────────────────────
  openDialog(title: string, pages: string[]): void { this.dialog.open(title, pages); }
  toast(msg: string): void {
    this.toastText.setText(msg).setAlpha(1); this.toastUntil = this.time.now + 2600;
  }
  hint(key: string, msg: string): void {
    if ((this.msgCooldown[key] ?? 0) > this.time.now) return;
    this.msgCooldown[key] = this.time.now + 3500; this.toast(msg);
  }
  private showBanner(name: string): void {
    const tx = this.add.text(this.scale.width / 2, 40, name, { fontFamily: 'Itim', fontSize: '40px', color: '#fff6e2', stroke: '#2a1a0a', strokeThickness: 6 }).setOrigin(0.5).setScrollFactor(0).setDepth(100);
    this.tweens.add({ targets: tx, alpha: 0, delay: 1200, duration: 600 });
  }
  flush(): void { writeSave(this.save); }
  setSpawn(e: EntityData): void { this.save.spawn = { room: this.level.id, x: e.x + 40, y: e.y - this.hero.h }; this.flush(); this.toast(t('save.point')); }

  // ───────────────────────── debug (owner testing) ─────────────────────────
  private bindDebugKeys(): void {
    const kb = this.input.keyboard;
    if (!kb) return;
    kb.removeAllListeners('keydown');
    kb.on('keydown', (e: KeyboardEvent) => {
      const map: Record<string, Ability> = { Digit7: 'double', Digit8: 'dive', Digit9: 'break' };
      const a = map[e.code];
      if (a) { if (this.abilities.has(a)) this.abilities.delete(a); else this.abilities.add(a); this.toast(`${a}: ${this.abilities.has(a) ? 'ON' : 'off'}`); }
      if (e.code === 'KeyK' && e.shiftKey) this.debugKillAll();
      if (e.code === 'KeyH') this.goHome();
    });
  }

  /** Shift+K: defeat every monster in the room (tests the respawn rules before Phase 2 combat exists). */
  debugKillAll(): void {
    for (const m of this.monsterViews) {
      markDefeated(this.save.defeated, m.id, m.def?.tier ?? 'normal', m.def?.respawn_sec ?? 0, Date.now());
      m.obj.destroy();
    }
    this.monsterViews = []; this.flush();
  }
}
