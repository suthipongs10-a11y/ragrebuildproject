import Phaser from 'phaser';
import { art } from '../assets/packs';
import rig from './hero.rig.json';
import { blendPose, sampleClip, type Clip, type Pose } from './clips';

type Part = 'head' | 'torso' | 'uarm' | 'farm' | 'thigh' | 'shin' | 'scarf' | 'sword';
export type HeroClip = keyof typeof rig.clips;
const CLIPS = rig.clips as unknown as Record<HeroClip, Clip>;
const XFADE = 0.08;

/**
 * Cut-out hero rig: nested containers in parts-sheet units (same hierarchy as the v3 prototype),
 * posed every frame from JSON keyframe clips.
 */
export class HeroRig {
  readonly root: Phaser.GameObjects.Container;
  private readonly body: Phaser.GameObjects.Container;
  private readonly j: Record<string, Phaser.GameObjects.Container> = {};
  private clip: HeroClip = 'idle';
  private clipT = 0;
  private prev: Pose | null = null;
  private fadeT = 0;
  private last: Pose = {};

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
    const key = `hero_part_${k}`, m = art(key).meta as { sheetX: number; sheetY: number; sheetW: number; sheetH: number };
    const [px, py] = rig.pivots[k] as [number, number];
    return scene.add.image(0, 0, key).setOrigin((px - m.sheetX) / m.sheetW, (py - m.sheetY) / m.sheetH).setDisplaySize(m.sheetW, m.sheetH);
  }

  /** Switch clip (restarts non-looping clips when `restart`). Cross-fades from the current pose. */
  play(clip: HeroClip, restart = false): void {
    if (clip === this.clip && !restart) return;
    this.prev = this.last; this.fadeT = XFADE;
    this.clip = clip; this.clipT = 0;
  }

  get current(): HeroClip { return this.clip; }

  update(dt: number, x: number, feetY: number, dir: number): void {
    this.clipT += dt;
    let p = sampleClip(CLIPS[this.clip], this.clipT);
    if (this.prev && this.fadeT > 0) { this.fadeT -= dt; p = blendPose(this.prev, p, 1 - Math.max(0, this.fadeT) / XFADE); }
    this.last = p;
    const j = this.j as Record<string, Phaser.GameObjects.Container>;
    this.root.setPosition(x, feetY).setScale(rig.scale * (dir < 0 ? -1 : 1), rig.scale).setRotation((p.rot ?? 0) * (dir < 0 ? -1 : 1));
    this.body.y = rig.hip + (p.bob ?? 0);
    j.backThigh!.rotation = p.tb ?? 0; j.backShin!.rotation = p.sb ?? 0;
    j.frontThigh!.rotation = p.tf ?? 0; j.frontShin!.rotation = p.sf ?? 0;
    j.torso!.rotation = p.lean ?? 0; j.backArm!.rotation = p.ba ?? 0; j.scarf!.rotation = p.scarf ?? 0; j.head!.rotation = p.head ?? 0;
    j.arm!.rotation = p.ua ?? 0; j.fore!.rotation = p.fa ?? 0; j.sword!.rotation = p.sw ?? 0;
  }

  setAlpha(a: number): void { this.root.setAlpha(a); }
  setVisible(v: boolean): void { this.root.setVisible(v); }
}
