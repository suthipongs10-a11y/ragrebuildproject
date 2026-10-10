import Phaser from 'phaser';
import { Cell, TILE, checkExit, createHero, exitsOf, stepHero, aliveSpawns, pruneDefeated, unstick, P,
  type EntityData, type HeroState, type LevelData, type MotionEnv, type MotionEvent, type TileGrid } from '@shared/platformer';
import { createRng, moveSpeed, noteDex, type ArenaRun } from '@shared/index';
import type { ContentBundle } from '@shared/content/types';
import { loadTextures, roomKeys } from '../assets/packs';
import { setLoading, showLoadProblem } from '../ui/errors';
import type { Controls } from '../input/Controls';
import { t } from '../i18n';
import { DialogBox } from '../ui/DialogBox';
import { loadSave, writeSave, type SaveData } from '../save/local';
import { abilitiesFromUrl, type Ability } from '../world/abilities';
import { buildLevelVisuals, type LevelVisuals } from '../world/LevelView';
import { spawnEntityView, type Interactable } from '../world/EntityViews';
import { CombatController } from '../combat/CombatController';
import { HeroRig } from '../rig/HeroRig';
import { Hud } from '../ui/Hud';
import { RoomInteractions } from '../world/RoomInteractions';
import { HeroSession } from '../hero/HeroSession';
import { handleSkillInput, pickClip, playLevelUps } from '../hero/HeroPlay';
import type { Menu, MenuTab } from '../ui/menu/Menu';
import { SkillButtons } from '../ui/SkillButtons';
import { ActionButton } from '../ui/ActionButton';
import { popNumber } from '../vfx/DamageText';
import { bindDebugKeys } from './debugKeys';
import { BossTimers } from '../world/BossTimers';
import { ArenaController, arenaKeys, enterArena } from '../world/Arena';
import { loadTeamArt, spiritArtKeys, teamAbilitySet, tryUltimate, ultHost, UltButton } from '../spirits/SpiritPlay';

/** Where the hero appears when a room loads. */
export type Place =
  | { kind: 'edge'; dir: 'left' | 'right' | 'up' | 'down'; x: number; y: number; vx: number; vy: number }
  | { kind: 'tile'; x: number; y: number; fromAbove: boolean }
  | { kind: 'pos'; x: number; y: number }
  | { kind: 'default' };

/** Objects that get the on-screen action button (phones). */
const BUTTON_TYPES = new Set(['Npc', 'Anvil', 'Altar', 'SavePoint', 'Chest']);

/** The world: LDtk rooms, platforming, transitions, gates, combat, hero + spirits, menus. */
export class WorldScene extends Phaser.Scene {
  hero!: HeroState;
  level!: LevelData;
  grid!: TileGrid;
  controls!: Controls;
  readonly room = new RoomInteractions(this);
  private rig!: HeroRig;
  combat!: CombatController;
  session!: HeroSession;
  private bars!: Hud;
  private skillBtns = new SkillButtons();
  private actionBtn = new ActionButton();
  private ultBtn = new UltButton();
  private bossTimers!: BossTimers;
  private arena: ArenaController | null = null;
  private menu!: Menu;
  private deadT = 0;
  view!: LevelVisuals;
  private dialog!: DialogBox;
  private hud!: Phaser.GameObjects.Text;
  private toastText!: Phaser.GameObjects.Text;
  prompt!: Phaser.GameObjects.Text;
  private toastUntil = 0;
  busy = false;
  interactables: Interactable[] = [];
  pickups: { id: string; item: string; x: number; y: number; obj: Phaser.GameObjects.Image }[] = [];
  abilities = new Set<Ability>();
  save!: SaveData;
  private levels!: Map<string, LevelData>;
  private msgCooldown: Record<string, number> = {};
  private initData: { room?: string; place?: Place; retried?: boolean } = {};
  private drownTicks = 0;
  private ready = false;
  private carry = { vx: 0, vy: 0, dir: 1 as 1 | -1 };

  constructor() { super('World'); }

  init(data: { room?: string; place?: Place; retried?: boolean }): void {
    this.save = (this.registry.get('save') as SaveData | undefined) ?? loadSave();
    this.registry.set('save', this.save);
    this.initData = data;
  }

  create(): void {
    const data = this.initData;
    this.controls = this.registry.get('controls') as Controls;
    if (!this.registry.has('abilDebug')) this.registry.set('abilDebug', abilitiesFromUrl(location.search));
    const content = this.registry.get('content') as ContentBundle;
    if (!this.registry.has('session')) this.registry.set('session', new HeroSession(content, this.save));
    this.session = this.registry.get('session') as HeroSession;
    this.abilities = teamAbilitySet(this.session, this.registry.get('abilDebug') as Set<Ability>);
    this.levels = this.registry.get('levels') as Map<string, LevelData>;

    const roomId = data.room ?? (this.registry.get('startRoom') as string);
    this.level = this.levels.get(roomId) ?? (this.levels.get('town') as LevelData);
    this.ready = false;
    // safety net: if any texture of this room is missing (failed download), fetch it and come back
    const need = [...roomKeys(this.level), ...spiritArtKeys(this.session), ...arenaKeys(this, this.level.id)].filter((k) => !this.textures.exists(k));
    if (need.length && !data.retried) {
      setLoading(true);
      loadTextures(this, need, (missing) => { setLoading(false); if (missing.length) showLoadProblem(missing); else this.scene.restart({ ...data, retried: true }); });
      return;
    }
    this.grid = this.level.grid.clone();
    for (const k of Object.keys(this.save.broken)) if (k === this.level.id) this.room.clearRocks(false);
    this.busy = false; this.interactables = []; this.pickups = []; this.deadT = 0;

    const { width: vw, height: vh } = this.scale;
    this.cameras.main.setBounds(0, 0, this.grid.pxW, Math.max(vh, this.grid.pxH));
    this.view = buildLevelVisuals(this, this.level, this.grid, vw, vh, (id) => t(this.levels.get(id)?.name ?? id));
    for (const k of this.view.rocks.keys()) if (this.save.broken[this.level.id]) this.view.rocks.get(k)?.destroy();
    this.combat = new CombatController(this, this.level, this.grid, this.session, this.save, createRng((Date.now() & 0xffffff) ^ 0x5eed), () => this.flush());
    this.spawnEntities();
    // ?stress=30 — performance test: extra monsters spread across the room
    const stress = Number(new URLSearchParams(location.search).get('stress') ?? 0);
    for (let i = 0; i < Math.min(60, stress); i++) this.combat.spawn(`stress#${i}`, i % 3 ? 'poring' : 'mantis', 80 + ((i * 97) % (this.grid.pxW - 160)), (this.level.floorRow ?? 10) * TILE);

    this.hero = this.placeHero(data.place ?? { kind: 'default' });
    this.combat.resetSpirits(this.hero);
    this.rig = new HeroRig(this, 10);
    this.applyLook();
    this.rig.update(0, this.hero.x + this.hero.w / 2, this.hero.y + this.hero.h, this.hero.dir);
    this.cameras.main.startFollow(this.rig.root, true, 0.12, 0.12, 0, 60);
    this.cameras.main.setScroll(Math.max(0, this.hero.x - vw / 2), 0);
    this.cameras.main.fadeIn(180, 0, 0, 0);

    const f = { fontFamily: 'Itim', color: '#fff6e2', stroke: '#2a1a0a', strokeThickness: 4 };
    this.hud = this.add.text(16, 10, '', { ...f, fontSize: '18px' }).setScrollFactor(0).setDepth(100);
    this.toastText = this.add.text(vw / 2, 90, '', { ...f, fontSize: '26px', strokeThickness: 5 }).setOrigin(0.5).setScrollFactor(0).setDepth(100).setAlpha(0);
    this.prompt = this.add.text(0, 0, '▲', { ...f, fontSize: '26px', color: '#ffd88a' }).setOrigin(0.5, 1).setDepth(50).setVisible(false);
    this.dialog = new DialogBox(this);
    this.bars = new Hud(this);
    this.menu = this.registry.get('menu') as Menu;
    this.menu.attach({
      session: this.session, save: this.save, flush: () => this.flush(),
      pause: () => this.scene.pause(), resume: () => { this.controls.reset(); this.scene.resume(); },
      applyUse: (fx) => this.applyUse(fx), onEquipChanged: () => this.applyLook(), onSpiritsChanged: () => this.onSpiritsChanged(),
      arena: () => this.session.arena, enterArena: (run) => enterArena(this, run),
      onJobChanged: () => { this.combat.heal(); this.applyLook(); this.toast(t('menu.jobChanged').replace('{job}', t(`job.${this.session.data.job}`))); },
    });
    this.showBanner(t(this.level.name));

    // the arena is entered from the portal NPC only: never save it as the room to load into
    if (this.level.id !== 'arena') this.save.room = this.level.id;
    this.save.seen[this.level.id] = true; this.flush();
    const run = this.registry.get('arenaRun') as ArenaRun | undefined;
    this.arena = this.level.id === 'arena' && run ? new ArenaController(this, run) : null;
    this.registry.remove('arenaRun');
    bindDebugKeys(this);
    const home = document.getElementById('b_home');
    if (home) home.onpointerup = (e) => { e.preventDefault(); this.goHome(); };
    this.drownTicks = 0;
    this.ready = true;
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
    const now = Date.now();
    pruneDefeated(this.save.defeated, now);
    const monsters = this.level.entities.filter((e) => e.type === 'Monster');
    for (const e of aliveSpawns(monsters, this.save.defeated, now)) this.combat.spawn(e.id, String(e.fields.monster), e.x, e.y);
    this.bossTimers = new BossTimers(this, this.level, this.save.defeated, this.session.content, (e) => this.combat.spawn(e.id, String(e.fields.monster), e.x, e.y));
    for (const e of this.level.entities) {
      if (e.type === 'Item') {
        if (this.save.items[e.id] || (e.fields.hidden && !this.abilities.has('reveal'))) continue;
        const obj = this.add.image(e.x, e.y - 6, 'icon_crystal').setOrigin(0.5, 1).setDepth(8).setScale(34 / 128).setTint(e.fields.hidden ? 0xc9a6ff : 0xffffff);
        this.tweens.add({ targets: obj, y: obj.y - 8, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
        this.pickups.push({ id: e.id, item: String(e.fields.item ?? 'stone'), x: e.x, y: e.y - 22, obj });
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
        // left the previous room through its `dir` edge: appear on the opposite edge of this one (walk left → enter from the right)
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

  goRoom(roomId: string, place: Place, fadeMs = 150): void {
    if (this.busy) return;
    this.busy = true;
    this.carry = { vx: this.hero.vx, vy: this.hero.vy, dir: this.hero.dir };
    this.flush();
    const target = this.levels.get(roomId);
    if (!target) { this.busy = false; return; }
    this.cameras.main.fadeOut(fadeMs, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      setLoading(true);
      loadTextures(this, [...roomKeys(target), ...spiritArtKeys(this.session), ...arenaKeys(this, roomId)], (missing) => {
        setLoading(false);
        if (missing.length) showLoadProblem(missing);
        else this.scene.restart({ room: roomId, place });
      });
    });
  }

  // ───────────────────────── frame loop ─────────────────────────
  override update(_t: number, dtMs: number): void {
    const c = this.controls;
    const dt = dtMs / 1000;
    if (this.busy || !this.ready) { c.endFrame(); return; }

    const talking = this.dialog.isOpen;
    if (talking && (c.pressed('jump') || c.pressed('atk') || c.pressed('up'))) this.dialog.next();

    const near = talking ? null : this.room.nearestInteractable();
    this.prompt.setText('▲').setVisible(!!near);
    if (near) this.prompt.setPosition(near.e.x, near.e.y - near.height - 6 + Math.sin(this.time.now / 140) * 3);

    let jumpPressed = !talking && c.pressed('jump');
    if (near && c.pressed('up')) { near.use(); jumpPressed = false; } // ▲ near an object = interact, not jump
    // next to a rock wall: attack OR ▲ smashes it (players kept missing the attack key)
    const rockSide = this.room.touchingRock(1) ? 1 : this.room.touchingRock(-1) ? -1 : 0;
    if (!talking && rockSide && !near) {
      this.prompt.setText(this.abilities.has('break') ? t('rock.prompt') : '✖').setVisible(true)
        .setPosition(this.hero.x + this.hero.w / 2, this.hero.y - 20 + Math.sin(this.time.now / 140) * 3);
      if (c.pressed('up')) { jumpPressed = false; this.hero.dir = rockSide as 1 | -1; this.room.swing(); }
    }

    const dead = this.combat.combat.dead;
    const frozen = this.combat.hitstop > 0;
    const dir = talking || dead ? 0 : (((c.state.right ? 1 : 0) - (c.state.left ? 1 : 0)) as -1 | 0 | 1);
    const env: MotionEnv = { grid: this.grid, water: this.level.water, abilities: { double: this.abilities.has('double'), dive: this.abilities.has('dive'), glide: this.abilities.has('cloud') }, moveSpeed: moveSpeed(this.session.derived.build), exits: exitsOf(this.level) };
    if (!frozen) {
      const events = stepHero(this.hero, { dir, jumpPressed: jumpPressed && !dead, jumpHeld: !talking && !dead && c.state.jump, down: c.state.down }, env, dt);
      this.onEvents(events);
    }
    const atkOk = !talking && !dead;
    const fight = this.combat.update(dt, this.hero, { attackPressed: atkOk && c.pressed('atk'), attackHeld: atkOk && c.state.atk, jumpHeld: c.state.jump }, this.time.now / 1000);
    for (const ev of fight) {
      if (ev.kind === 'swing') { this.rig.play(ev.spec.clip, true); this.room.swing(); }
      if (ev.kind === 'hurt') this.rig.play('hurt', true);
      if (ev.kind === 'died') { this.rig.play('death', true); this.deadT = 1.8; }
    }
    if (c.pressed('menu') && !dead) { this.menu.open(); c.endFrame(); return; }
    if (c.pressed('ult') && !talking && !dead) { tryUltimate(ultHost(this)); if (this.busy) { c.endFrame(); return; } }
    if (!talking && !dead) handleSkillInput(c, this.session, this.combat, this.hero, this.rig, (k, m) => this.hint(k, m));
    playLevelUps(this, this.combat, this.session, this.hero, (m) => this.toast(m));
    if (dead && this.deadT > 0) { this.deadT -= dt; if (this.deadT <= 0) this.respawnAfterDeath(); }

    if (dir && this.room.touchingRock(dir)) this.hint('rockTouch', t(this.abilities.has('break') ? 'rock.touch' : 'rock.needUrl'));
    if (!talking && !dead) this.room.checkPipes();
    // contextual action button (phones): talk / read / pipe / smash
    // only for NPCs/stations the hero stands right next to (signs & gate runes: tap them or ▲),
    // with hysteresis so it doesn't flicker, never mid-air
    const hb = this.hero, reach = this.actionBtn.visible ? 28 : 20;
    const close = near && BUTTON_TYPES.has(near.e.type) && hb.onGround && Math.abs(hb.x + hb.w / 2 - near.e.x) < reach ? near : null;
    const action = talking || dead ? null
      : close ? { label: close.label, run: close.use }
      : this.room.pipeAction
      ?? (rockSide ? { label: t('act.smash'), run: () => { this.hero.dir = rockSide as 1 | -1; this.room.swing(); } } : null);
    this.actionBtn.show(action?.label ?? null);
    if (action && this.actionBtn.take()) action.run();
    this.room.collectPickups();
    this.bossTimers.update();
    this.arena?.update(dt);

    const ex = dead ? null : checkExit(this.hero, env);
    if (ex === 'fall') this.fallRespawn();
    else if (ex) {
      const to = this.level.exitTo[ex];
      if (to) this.goRoom(to, { kind: 'edge', dir: ex, x: this.hero.x, y: this.hero.y, vx: 0, vy: 0 });
    }

    const h = this.hero;
    if (!dead) this.rig.play(pickClip(h, this.rig.current, this.combat.combat, this.level.water));
    this.rig.update(frozen ? 0 : dt, h.x + h.w / 2, h.y + h.h, h.dir);
    this.rig.setAlpha(this.combat.combat.inv > 0 && !dead && Math.floor(this.time.now / 50) % 2 ? 0.35 : 1);
    this.skillBtns.update(this.session);
    this.ultBtn.update(this.combat);
    this.bars.update(this.combat.combat.hp, this.combat.maxHp, this.session.rt.sp, this.combat.maxSp, this.session.data, this.save.zeny, this.session.rt.cast);
    const boss = this.combat.boss;
    this.bars.boss(boss ? t(boss.def.name_key) : null, boss?.hp, boss?.def.hp, boss?.def.tier === 'mvp');
    this.hud.setText(`${t(this.level.name)} · ${Math.round(this.game.loop.actualFps)} fps\n${this.room.abilityLine()}`);
    if (this.toastUntil && this.time.now > this.toastUntil) { this.toastUntil = 0; this.tweens.add({ targets: this.toastText, alpha: 0, duration: 300 }); }
    c.endFrame();
  }

  private respawnAfterDeath(): void {
    this.combat.heal();
    this.flush();
    this.goHome(t('combat.dead'));
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

  // ───────────────────────── ui helpers ─────────────────────────
  openDialog(title: string, pages: string[]): void { this.dialog.open(title, pages); }
  openMenu(tab: MenuTab): void { this.menu.open(tab); }

  /** Tap on an NPC / sign / chest: interact when the hero is close enough. */
  tapInteract(it: Interactable): void {
    if (!this.ready || this.busy || this.dialog.isOpen || this.menu.isOpen || this.combat.combat.dead) return;
    const h = this.hero;
    if (Math.abs(h.x + h.w / 2 - it.e.x) < 220 && Math.abs(h.y + h.h - it.e.y) < 160) it.use();
    else this.hint('far', t('act.far'));
  }

  applyLook(): void {
    const d = this.session.data, w = d.bag.find((b) => b.uid === d.equip.weapon);
    this.rig.setLook(d.job, this.session.content.items.find((i) => i.id === w?.id)?.subtype ?? 'sword');
  }

  /** Potion from the bag: heal HP/SP with a green number. */
  applyUse(fx: Record<string, number>): void {
    const cb = this.combat.combat, h = this.hero;
    if (fx.heal) { cb.hp = Math.min(this.combat.maxHp, cb.hp + fx.heal); popNumber(this, h.x + h.w / 2, h.y - 6, fx.heal, 'heal'); }
    if (fx.sp) this.session.rt.sp = Math.min(this.combat.maxSp, this.session.rt.sp + fx.sp);
  }
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

  /** Team / runes / awakening changed in the menu: new followers, abilities and leader bonus. */
  private onSpiritsChanged(): void {
    noteDex(this.session.book, this.session.box);
    this.session.recompute();
    this.combat.resetSpirits(this.hero);
    this.refreshAbilities();
    loadTeamArt(this, this.session);
  }

  /** Shift+K: defeat every monster in the room (tests respawn rules and drops). */
  debugKillAll(): void { this.combat.killAll(); this.flush(); }

  refreshAbilities(): void { this.abilities = teamAbilitySet(this.session, this.registry.get('abilDebug') as Set<Ability>); }

}
