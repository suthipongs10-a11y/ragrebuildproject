import Phaser from 'phaser';
import { art } from '../assets/packs';
import rig from './hero.rig.json';
import { blendPose, sampleClip, type Clip, type Pose } from './clips';
import { moveFor, weaponKind, type WeaponKind } from './moves';

type Part = 'head' | 'torso' | 'uarm' | 'farm' | 'thigh' | 'shin' | 'scarf' | 'sword';
/** JSON clips (run, jump, fall, guard, death…) + code-built moves (moves.ts: combos per weapon, skills, idle, hurt, land). */
export type HeroClip = string;
const CLIPS = rig.clips as unknown as Record<string, Clip>;
const XFADE = 0.08;
/** diagonal of the hero's sword piece in sheet px (weapon pictures are sized to match) */
const SWORD_DIAG = 481;
interface SheetMeta { sheetX: number; sheetY: number; sheetW: number; sheetH: number; pivotX?: number; pivotY?: number }

/**
 * Cut-out hero rig: nested containers in parts-sheet units (same hierarchy as the v3 prototype),
 * posed every frame from JSON keyframe clips.
 */
export class HeroRig {
  readonly root: Phaser.GameObjects.Container;
  private readonly body: Phaser.GameObjects.Container;
  private readonly j: Record<string, Phaser.GameObjects.Container> = {};
  private clip: HeroClip = 'idle';
  private weapon: WeaponKind = 'sword';
  private cur: Clip = CLIPS.idle as Clip;
  private clipT = 0;
  private prev: Pose | null = null;
  private fadeT = 0;
  private last: Pose = {};
  private readonly parts: Partial<Record<Part, Phaser.GameObjects.Image[]>> = {};
  private job = '';
  private face = '';

  constructor(scene: Phaser.Scene, depth = 10) {
    this.root = scene.add.container(0, 0).setDepth(depth);
    this.body = scene.add.container(0, rig.hip);
    this.root.add(this.body);
    const at = (k: keyof typeof rig.attach) => rig.attach[k] as [number, number];
    const c = (x = 0, y = 0) => scene.add.container(x, y);
    const legs = (name: string) => {
      const thigh = c(); const shin = c(...at('knee'));
      thigh.add([this.part(scene, 'thigh'), shin]); shin.add(this.part(scene, 'shin'));
      this.j[`${name}Thigh`] = thigh; this.j[`${name}Shin`] = shin;
      return thigh;
    };
    this.body.add([legs('back'), legs('front')]);
    const torso = c(); this.j.torso = torso;
    const backArm = c(...at('backElbow')); backArm.add(this.part(scene, 'farm')); this.j.backArm = backArm;
    const scarf = c(...at('scarf')); scarf.add(this.part(scene, 'scarf')); this.j.scarf = scarf;
    const head = c(...at('neck')); head.add(this.part(scene, 'head')); this.j.head = head;
    const arm = c(...at('shoulder')); const fore = c(...at('elbow')); const sword = c(...at('grip'));
    sword.add(this.part(scene, 'sword')); fore.add([sword, this.part(scene, 'farm')]); arm.add([this.part(scene, 'uarm'), fore]);
    Object.assign(this.j, { arm, fore, sword });
    torso.add([backArm, scarf, this.part(scene, 'torso'), head, arm]);
    this.body.add(torso);
    this.root.setScale(rig.scale);
  }

  private part(scene: Phaser.Scene, k: Part): Phaser.GameObjects.Image {
    const img = scene.add.image(0, 0, `hero_part_${k}`);
    (this.parts[k] ??= []).push(img);
    this.dress(img, k, `hero_part_${k}`);
    return img;
  }

  /** Put a sheet-space piece on an image: texture + origin at its joint pivot + size in sheet units. */
  private dress(img: Phaser.GameObjects.Image, k: Part, key: string): void {
    const m = art(key).meta as unknown as SheetMeta;
    const [px, py] = m.pivotX !== undefined ? [m.pivotX, m.pivotY as number] : (rig.pivots[k] as [number, number]);
    img.setTexture(key).setOrigin((px - m.sheetX) / m.sheetW, (py - m.sheetY) / m.sheetH).setDisplaySize(m.sheetW, m.sheetH);
  }

  /** Switch clip (restarts non-looping clips when `restart`). Cross-fades from the current pose. */
  play(clip: HeroClip, restart = false): void {
    if (clip === this.clip && !restart) return;
    this.prev = this.last; this.fadeT = XFADE;
    this.clip = clip; this.clipT = 0;
    this.cur = moveFor(this.weapon, clip) ?? CLIPS[clip] ?? (CLIPS.idle as Clip);
  }

  get current(): HeroClip { return this.clip; }
  /** A one-shot clip (attack, skill, hurt, land) still playing. */
  get acting(): boolean { return !this.cur.loop && this.clipT < this.cur.dur; }

  update(dt: number, x: number, feetY: number, dir: number): void {
    this.clipT += dt;
    let p = sampleClip(this.cur, this.clipT);
    if (this.prev && this.fadeT > 0) { this.fadeT -= dt; p = blendPose(this.prev, p, 1 - Math.max(0, this.fadeT) / XFADE); }
    this.last = p;
    this.updateFace();
    const j = this.j as Record<string, Phaser.GameObjects.Container>;
    const sq = p.sq ?? 0; // squash (+) / stretch (−), anchored at the feet
    this.root.setPosition(x, feetY).setScale(rig.scale * (1 + sq * 0.6) * (dir < 0 ? -1 : 1), rig.scale * (1 - sq)).setRotation((p.rot ?? 0) * (dir < 0 ? -1 : 1));
    this.body.y = rig.hip + (p.bob ?? 0);
    this.body.x = p.dx ?? 0;
    j.backThigh!.rotation = p.tb ?? 0; j.backShin!.rotation = p.sb ?? 0;
    j.frontThigh!.rotation = p.tf ?? 0; j.frontShin!.rotation = p.sf ?? 0;
    j.torso!.rotation = p.lean ?? 0; j.backArm!.rotation = p.ba ?? 0; j.scarf!.rotation = p.scarf ?? 0; j.head!.rotation = p.head ?? 0;
    j.arm!.rotation = p.ua ?? 0; j.fore!.rotation = p.fa ?? 0; j.sword!.rotation = p.sw ?? 0;
  }

  setAlpha(a: number): void { this.root.setAlpha(a); }

  /**
   * Job / weapon look: the job's painted parts (P03 Jobs, `job_<job>_<part>`) and the equipped weapon's own picture
   * (`weaponIcon`, drawn in the sword pose). Missing art → the hero's pieces, tinted per job / weapon type.
   */
  setLook(job: string, weaponType: string, weaponIcon?: string): void {
    if (this.weapon !== weaponKind(weaponType)) { this.weapon = weaponKind(weaponType); this.play(this.clip, true); }
    const scene = this.root.scene;
    this.job = scene.textures.exists(`job_${job}_head`) ? job : '';
    const cloth: Record<string, number> = { swordsman: 0xc8d4ec, mage: 0x9a88f0, archer: 0x9ad08a, acolyte: 0xfff0d8 };
    for (const k of ['head', 'torso', 'uarm', 'farm', 'thigh', 'shin', 'scarf'] as Part[]) {
      const key = this.job ? `job_${job}_${k}` : `hero_part_${k}`;
      for (const img of this.parts[k] ?? []) {
        this.dress(img, k, key);
        if (!this.job && cloth[job] && (k === 'torso' || k === 'uarm' || k === 'thigh')) img.setTint(cloth[job]); else img.clearTint();
      }
    }
    this.face = '';
    const wpn = this.parts.sword?.[0];
    if (!wpn) return;
    if (weaponIcon && scene.textures.exists(weaponIcon)) {
      // weapon paintings: handle top-left, tip bottom-right (like the hero's sword piece); bows are held in the middle
      const kind = weaponKind(weaponType), len = SWORD_DIAG * ({ sword: 1, staff: 1.25, bow: 1.1, mace: 1 } as const)[kind];
      wpn.setTexture(weaponIcon).clearTint();
      const k = len / Math.hypot(wpn.width, wpn.height);
      wpn.setOrigin(kind === 'bow' ? 0.5 : 0.19, kind === 'bow' ? 0.5 : 0.16).setDisplaySize(wpn.width * k, wpn.height * k);
    } else {
      this.dress(wpn, 'sword', 'hero_part_sword');
      const tint: Record<string, number> = { staff: 0xb07a3a, bow: 0x8ad070, mace: 0xb8b8c8 };
      if (tint[weaponType]) wpn.setTint(tint[weaponType]); else wpn.clearTint();
    }
  }

  /** Battle-shout face while attacking / casting, pained face when hit (P03 Jobs part 5). */
  private updateFace(): void {
    const c = this.clip;
    const mood = c.startsWith('attack') || c.startsWith('skill') || c === 'channel' ? 'attack' : c === 'hurt' || c === 'death' ? 'hurt' : '';
    if (mood === this.face) return;
    this.face = mood;
    const base = this.job ? `job_${this.job}_head` : 'hero_part_head';
    const key = mood && this.root.scene.textures.exists(`${base}_${mood}`) ? `${base}_${mood}` : base;
    for (const img of this.parts.head ?? []) this.dress(img, 'head', key);
  }
  setVisible(v: boolean): void { this.root.setVisible(v); }
}
