import { Cell, isSolidCell, TILE, type TileGrid } from './grid';

/** Hero movement. Numbers are the approved prototype feel at 2x scale (32 px tiles). */
export interface Body { x: number; y: number; w: number; h: number; vx: number; vy: number; onGround: boolean }

export interface HeroState extends Body {
  dir: 1 | -1;
  coyote: number;
  jumpBuffer: number;
  canDouble: boolean;
  /** seconds of one-way platforms being ignored (drop-through) */
  dropT: number;
  breath: number;
  drownT: number;
  /** body bottom at the start of the previous sub-step (for one-way landing) */
  prevBottom: number;
}

export interface MotionInput { dir: -1 | 0 | 1; jumpPressed: boolean; jumpHeld: boolean; down: boolean }
export interface Exits { left: boolean; right: boolean; up: boolean; down: boolean }
export interface MotionEnv {
  grid: TileGrid;
  water: boolean;
  /** glide: holding jump while falling slows the fall (cloud spirits) */
  abilities: { double: boolean; dive: boolean; glide?: boolean };
  /** prototype-scale speed (see shared moveSpeed); ×2 is applied here */
  moveSpeed: number;
  exits: Exits;
}
export type MotionEvent = 'jump' | 'doubleJump' | 'land' | 'swimStroke' | 'drown';

export const HERO_W = 24;
export const HERO_H = 56;
export const MAX_STEP = 1 / 120;
const MAX_FRAME = 1 / 20;

export const P = {
  jump: 860, doubleJump: 820, cutJump: 340, gravity: 2800, maxFall: 860, glideFall: 150,
  waterJump: 460, waterGravity: 1800, waterFall: 340, diveGravity: 760, diveFall: 180, diveStroke: 420,
  accelGround: 14, accelAir: 8, frictionGround: 0.0005, frictionAir: 0.05,
  coyote: 0.09, buffer: 0.12, dropTime: 0.2, breath: 5, landSpeed: 600,
} as const;

export function createHero(x: number, y: number): HeroState {
  return { x, y, w: HERO_W, h: HERO_H, vx: 0, vy: 0, onGround: false, dir: 1, coyote: 0, jumpBuffer: 0, canDouble: true, dropT: 0, breath: P.breath, drownT: 0.7, prevBottom: y + HERO_H };
}

/** Axis-separated tile collision. Returns true when a wall was hit. */
export function moveBody(b: Body, dt: number, grid: TileGrid, ignoreOneWay: boolean, prevBottom: number): boolean {
  let hitWall = false;
  b.x += b.vx * dt;
  const y0 = Math.floor(b.y / TILE), y1 = Math.floor((b.y + b.h - 0.01) / TILE);
  if (b.vx > 0) {
    const tx = Math.floor((b.x + b.w - 0.001) / TILE);
    for (let ty = y0; ty <= y1; ty++) if (isSolidCell(grid.get(tx, ty))) { b.x = tx * TILE - b.w; b.vx = 0; hitWall = true; break; }
  } else if (b.vx < 0) {
    const tx = Math.floor(b.x / TILE);
    for (let ty = y0; ty <= y1; ty++) if (isSolidCell(grid.get(tx, ty))) { b.x = (tx + 1) * TILE; b.vx = 0; hitWall = true; break; }
  }
  b.y += b.vy * dt;
  b.onGround = false;
  const x0 = Math.floor(b.x / TILE), x1 = Math.floor((b.x + b.w - 0.01) / TILE);
  if (b.vy > 0) {
    const ty = Math.floor((b.y + b.h - 0.001) / TILE);
    for (let tx = x0; tx <= x1; tx++) {
      const c = grid.get(tx, ty);
      if (isSolidCell(c) || (c === Cell.OneWay && !ignoreOneWay && prevBottom <= ty * TILE + 0.5)) { b.y = ty * TILE - b.h; b.vy = 0; b.onGround = true; break; }
    }
  } else if (b.vy < 0) {
    const ty = Math.floor(b.y / TILE);
    for (let tx = x0; tx <= x1; tx++) if (isSolidCell(grid.get(tx, ty))) { b.y = (ty + 1) * TILE; b.vy = 0; break; }
  } else {
    // resting: stay "grounded" while something solid is directly underneath
    const ty = Math.floor((b.y + b.h + 0.5) / TILE);
    for (let tx = x0; tx <= x1; tx++) {
      const c = grid.get(tx, ty);
      if (isSolidCell(c) || (c === Cell.OneWay && !ignoreOneWay && Math.abs(b.y + b.h - ty * TILE) < 0.6)) { b.onGround = true; break; }
    }
  }
  return hitWall;
}

/** Advance the hero by `dtTotal` seconds (clamped, sub-stepped so thin platforms never tunnel). */
export function stepHero(s: HeroState, inp: MotionInput, env: MotionEnv, dtTotal: number): MotionEvent[] {
  const events: MotionEvent[] = [];
  let left = Math.min(dtTotal, MAX_FRAME);
  let jumpPressed = inp.jumpPressed;
  while (left > 1e-6) {
    const dt = Math.min(left, MAX_STEP);
    left -= dt;
    substep(s, { ...inp, jumpPressed }, env, dt, events);
    jumpPressed = false; // edge only counts for the first sub-step
  }
  return events;
}

function substep(s: HeroState, inp: MotionInput, env: MotionEnv, dt: number, ev: MotionEvent[]): void {
  const { water } = env, dive = env.abilities.dive;
  const speed = (water ? (dive ? 95 : 60) : env.moveSpeed) * 2;
  if (inp.dir) {
    s.dir = inp.dir;
    s.vx += (inp.dir * speed - s.vx) * Math.min(1, dt * (s.onGround ? P.accelGround : P.accelAir));
  } else s.vx *= Math.pow(s.onGround ? P.frictionGround : P.frictionAir, dt);

  if (inp.jumpPressed) s.jumpBuffer = P.buffer; else s.jumpBuffer -= dt;
  s.coyote = s.onGround ? P.coyote : s.coyote - dt;
  if (s.onGround) s.canDouble = true;
  if (s.dropT > 0) s.dropT -= dt;

  // drop through a one-way platform: ↓ + jump while standing on one
  if (inp.jumpPressed && inp.down && s.onGround && standingOnOneWay(s, env.grid)) {
    s.dropT = P.dropTime; s.jumpBuffer = 0; s.onGround = false; s.y += 2;
  } else if (s.jumpBuffer > 0) {
    if (water) {
      if (dive) { s.vy = -P.diveStroke; s.jumpBuffer = 0; ev.push('swimStroke'); }
      else if (s.onGround) { s.vy = -P.waterJump; s.jumpBuffer = 0; ev.push('jump'); }
    } else if (s.coyote > 0) { s.vy = -P.jump; s.jumpBuffer = 0; s.coyote = 0; ev.push('jump'); }
    else if (s.canDouble && env.abilities.double) { s.vy = -P.doubleJump; s.canDouble = false; s.jumpBuffer = 0; ev.push('doubleJump'); }
  }
  if (!water && !inp.jumpHeld && s.vy < -P.cutJump) s.vy = -P.cutJump; // variable jump height

  const g = water ? (dive ? P.diveGravity : P.waterGravity) : P.gravity;
  const glide = !water && env.abilities.glide && inp.jumpHeld && s.vy > 0;
  const maxFall = water ? (dive ? P.diveFall : P.waterFall) : glide ? P.glideFall : P.maxFall;
  s.vy = Math.min(maxFall, s.vy + g * dt);

  const wasAir = !s.onGround, vyBefore = s.vy, prevBottom = s.y + s.h;
  moveBody(s, dt, env.grid, s.dropT > 0, prevBottom);
  s.prevBottom = prevBottom;
  if (wasAir && s.onGround && vyBefore > P.landSpeed) ev.push('land');

  // room edges without an exit are walls
  const { exits, grid } = env;
  if (!exits.left && s.x < 0) { s.x = 0; s.vx = 0; }
  if (!exits.right && s.x + s.w > grid.pxW) { s.x = grid.pxW - s.w; s.vx = 0; }
  if (!exits.up && s.y < -48) { s.y = -48; s.vy = Math.max(s.vy, 0); }

  // breath
  if (water && !dive) {
    s.breath -= dt;
    if (s.breath <= 0) { s.drownT -= dt; if (s.drownT <= 0) { s.drownT = 0.7; ev.push('drown'); } }
  } else s.breath = Math.min(P.breath, s.breath + dt * 3);
}

function standingOnOneWay(s: Body, grid: TileGrid): boolean {
  const ty = Math.floor((s.y + s.h + 0.5) / TILE);
  const x0 = Math.floor(s.x / TILE), x1 = Math.floor((s.x + s.w - 0.01) / TILE);
  let one = false;
  for (let tx = x0; tx <= x1; tx++) {
    const c = grid.get(tx, ty);
    if (isSolidCell(c)) return false;
    if (c === Cell.OneWay) one = true;
  }
  return one;
}

export type ExitResult = 'left' | 'right' | 'up' | 'down' | 'fall' | null;

/** Which room edge (if any) the hero has crossed. `fall` = dropped out the bottom with no exit there. */
export function checkExit(s: Body, env: Pick<MotionEnv, 'exits' | 'grid'>): ExitResult {
  const { exits, grid } = env;
  if (exits.left && s.x + s.w / 2 < 0) return 'left';
  if (exits.right && s.x + s.w / 2 > grid.pxW) return 'right';
  if (exits.up && s.y + s.h / 2 < 0) return 'up';
  if (s.y > grid.pxH) return exits.down ? 'down' : 'fall';
  return null;
}

/** True when the body overlaps any solid cell. */
export function overlapsSolid(b: Body, grid: TileGrid): boolean {
  const x0 = Math.floor(b.x / TILE), x1 = Math.floor((b.x + b.w - 0.01) / TILE);
  const y0 = Math.floor(b.y / TILE), y1 = Math.floor((b.y + b.h - 0.01) / TILE);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (isSolidCell(grid.get(tx, ty))) return true;
  return false;
}

/**
 * Move a body that spawned inside walls (e.g. entering a room next to an unbroken rock wall) to the
 * nearest free spot: tries tile steps inward (preferring `prefer` direction), then upward. Returns true if moved.
 */
export function unstick(b: Body, grid: TileGrid, prefer: 1 | -1 = -1): boolean {
  if (!overlapsSolid(b, grid)) return false;
  const ox = b.x, oy = b.y;
  for (let r = 1; r <= Math.max(grid.w, grid.h); r++) {
    for (const [dx, dy] of [[prefer * r, 0], [-prefer * r, 0], [0, -r], [prefer * r, -r], [-prefer * r, -r]] as const) {
      b.x = Math.min(Math.max(0, ox + dx * TILE), grid.pxW - b.w);
      b.y = oy + dy * TILE;
      if (!overlapsSolid(b, grid)) { b.vx = 0; b.vy = 0; return true; }
    }
  }
  b.x = ox; b.y = oy;
  return false;
}
