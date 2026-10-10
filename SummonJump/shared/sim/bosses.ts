import type { Enemy, EnemyCtx } from './enemy';
import { blockedAhead, fall, hitsSolid, num, setState, shootAt } from './enemy';

/**
 * Phase 5 boss scripts (monsters.csv `ai_params.script`). Same rules as enemy.ts: pure, seeded RNG, fixed step.
 * Every boss gets a 2nd phase under 50 % HP (announced once with a `phase` event).
 */
type Script = (e: Enemy, ctx: EnemyCtx, dt: number, dx: number, dy: number) => void;

/** Switch to phase 2 once HP drops under half. */
export function enterPhase2(e: Enemy, ctx: EnemyCtx): void {
  if (e.phase === 1 && e.hp < e.def.hp / 2) { e.phase = 2; ctx.events.push({ kind: 'phase', enemy: e }); }
}

/** Shots falling from above around the hero (ink rain, lightning, feathers). */
export function rainOnHero(ctx: EnemyCtx, e: Enemy, n: number, color: number, spread = 300): void {
  const hx = ctx.hero.x + ctx.hero.w / 2;
  for (let i = 0; i < n; i++) {
    const x = hx + (n === 1 ? 0 : -spread / 2 + (spread * i) / (n - 1)) + ctx.rng.range(-12, 12);
    ctx.shots.push({ x, y: ctx.hero.y - 320 - ctx.rng.range(0, 80), vx: 0, vy: 330, r: 10, color, dmg: e.def.atk, life: 2.4, hostile: true, ghost: true, el: e.def.element });
  }
  ctx.events.push({ kind: 'shoot', x: hx, y: ctx.hero.y - 300 });
}

/** Spore Mother: slow walk, spore volleys, phase 2 calls her mushroom children. */
const sporeMother: Script = (e, ctx, dt, dx) => {
  enterPhase2(e, ctx);
  const p2 = e.phase === 2;
  switch (e.state) {
    case 'windup':
      e.vx = 0; e.pose = p2 ? 'skill' : 'windup';
      if (e.t > 0.6) {
        setState(e, 'attack');
        shootAt(e, ctx, p2 ? [-0.8, -0.4, 0, 0.4, 0.8] : [-0.5, 0, 0.5], 190, 0xb070e0);
        if (p2 && ctx.count('mushroom') < 3) ctx.summon('mushroom', e.x + e.w / 2, e.y + e.h);
      }
      break;
    case 'attack': e.pose = 'attack'; if (e.t > 0.4) setState(e, 'recover'); break;
    case 'recover': e.pose = 'idle'; if (e.t > 0.6) { setState(e, 'move'); e.timer = p2 ? 1.8 : 2.8; } break;
    default:
      e.pose = 'idle'; e.dir = (Math.sign(dx) || 1) as 1 | -1;
      e.vx = Math.abs(dx) > 90 ? e.dir * 40 : 0;
      e.timer -= dt;
      if (e.timer <= 0) setState(e, 'windup');
  }
  fall(e, dt, ctx.grid);
  if (blockedAhead(e, ctx.grid)) e.vx = 0;
};

/** Thunder Ram: telegraphed charge across the room; hitting a wall stuns it (the opening) — phase 2 calls lightning on landing. */
const ramCharge: Script = (e, ctx, dt, dx) => {
  enterPhase2(e, ctx);
  const p2 = e.phase === 2;
  switch (e.state) {
    case 'windup':
      e.vx = 0; e.pose = 'windup';
      if (e.t > (p2 ? 0.5 : 0.75)) { setState(e, 'attack'); e.vx = e.dir * (p2 ? 640 : 540); }
      break;
    case 'attack':
      e.pose = 'attack';
      if (e.hitWall || e.t > 1.5) {
        e.vx = -e.dir * 120; e.vy = -260; setState(e, 'recover');
        ctx.events.push({ kind: 'slam', x: e.x + e.w / 2, y: e.y + e.h });
        if (p2) { e.pose = 'skill'; rainOnHero(ctx, e, 3, 0xffe060, 220); }
      }
      break;
    case 'recover':
      e.pose = e.t < 0.3 && p2 ? 'skill' : 'hurt'; e.vx *= Math.pow(0.05, dt);
      if (e.t > 1.1) { setState(e, 'move'); e.timer = p2 ? 1.2 : 2; }
      break;
    default:
      e.pose = 'idle'; e.dir = (Math.sign(dx) || 1) as 1 | -1; e.vx = 0;
      e.timer -= dt;
      if (e.timer <= 0 && e.onGround) setState(e, 'windup');
  }
  fall(e, dt, ctx.grid);
};

/** Siren: floats and sings rings of notes; phase 2 bigger rings + glow jellies. */
const siren: Script = (e, ctx, dt, dx) => {
  enterPhase2(e, ctx);
  const p2 = e.phase === 2;
  const tx = Math.max(e.ox - 220, Math.min(e.ox + 220, e.x + dx * 0.3));
  e.x += Math.sign(tx - e.x) * Math.min(Math.abs(tx - e.x), 60 * dt);
  e.y = e.oy + Math.sin(e.ph * 1.4) * 26;
  e.dir = (Math.sign(dx) || 1) as 1 | -1;
  e.timer -= dt;
  e.pose = e.timer < 0.5 ? 'windup' : e.timer > (p2 ? 1.3 : 2) ? 'skill' : 'idle';
  if (e.timer <= 0) {
    const n = p2 ? 12 : 8, sx = e.x + e.w / 2, sy = e.y + e.h / 2;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + e.ph;
      ctx.shots.push({ x: sx, y: sy, vx: Math.cos(a) * 170, vy: Math.sin(a) * 170, r: 9, color: 0x6ad8d8, dmg: e.def.atk, life: 3.5, hostile: true, ghost: true, el: e.def.element });
    }
    ctx.events.push({ kind: 'shoot', x: sx, y: sy });
    e.timer = p2 ? 1.6 : 2.4;
    if (p2 && ctx.count('jellyfish') < 2 && ctx.rng.chance(0.5)) ctx.summon('jellyfish', sx, e.y + e.h);
  }
};

/** Sawtooth Shark: patrols, then dashes at the hero; phase 2 dashes twice in a row. */
const shark: Script = (e, ctx, dt, dx, dy) => {
  enterPhase2(e, ctx);
  const p2 = e.phase === 2;
  switch (e.state) {
    case 'windup':
      e.pose = 'windup'; e.x -= e.dir * 30 * dt;
      if (e.t > 0.6) { setState(e, 'dive'); const a = Math.atan2(dy + 10, dx); e.vx = Math.cos(a) * 640; e.vy = Math.sin(a) * 640; }
      break;
    case 'dive':
      e.pose = p2 && e.jumps % 2 === 1 ? 'skill' : 'attack'; e.x += e.vx * dt; e.y += e.vy * dt;
      if (e.t > 0.7 || hitsSolid(e, ctx.grid)) {
        e.jumps++;
        if (p2 && e.jumps % 2 === 1) setState(e, 'windup'); else setState(e, 'rise');
      }
      break;
    case 'rise':
      e.pose = 'idle';
      e.x += Math.sign(e.ox - e.x) * Math.min(Math.abs(e.ox - e.x), 140 * dt);
      e.y += Math.sign(e.oy - e.y) * Math.min(Math.abs(e.oy - e.y), 120 * dt);
      if (e.t > 1) { setState(e, 'idle'); e.timer = p2 ? 1.2 : 2; }
      break;
    default:
      e.pose = 'idle'; e.dir = (Math.sign(dx) || 1) as 1 | -1;
      e.x += e.dir * 40 * dt; if (Math.abs(e.x - e.ox) > 160) e.x -= e.dir * 40 * dt;
      e.y = e.oy + Math.sin(e.ph * 2) * 14;
      e.timer -= dt;
      if (e.timer <= 0 && Math.abs(dx) < 380) setState(e, 'windup');
  }
};

/**
 * Storm Roc (MVP #1): hovers over the hero, alternates dive and feather volley.
 * Phase 2: rolling tornadoes along the floor, lightning rain, calls fire hawks.
 */
const stormRoc: Script = (e, ctx, dt, dx) => {
  enterPhase2(e, ctx);
  const p2 = e.phase === 2, hx = ctx.hero.x + ctx.hero.w / 2;
  const top = num(e.def, 'top', 80), floor = ctx.hero.y + ctx.hero.h;
  if (e.state === 'dive') {
    e.pose = 'attack'; e.x += e.vx * dt; e.y += e.vy * dt;
    if (e.t > 0.8 || e.y + e.h > floor + 10 || hitsSolid(e, ctx.grid)) setState(e, 'rise');
  } else if (e.state === 'rise') {
    e.pose = 'idle'; e.y -= 300 * dt;
    if (e.y < top + 20) { setState(e, 'hover'); e.timer = ctx.rng.range(p2 ? 1.2 : 1.8, p2 ? 2 : 2.8); }
  } else {
    const tx = hx + Math.sin(e.ph * 0.7) * 200 - e.w / 2, ty = top + Math.sin(e.ph * 2) * 18;
    e.x += Math.sign(tx - e.x) * Math.min(Math.abs(tx - e.x), 200 * dt);
    e.y += Math.sign(ty - e.y) * Math.min(Math.abs(ty - e.y), 160 * dt);
    e.dir = (Math.sign(dx) || 1) as 1 | -1;
    e.timer -= dt; e.pose = e.timer < 0.45 ? 'windup' : 'idle';
    if (e.timer <= 0) {
      e.jumps++;
      const move = e.jumps % (p2 ? 3 : 2);
      if (move === 0) { setState(e, 'dive'); const a = Math.atan2(ctx.hero.y + 20 - (e.y + e.h / 2), dx); e.vx = Math.cos(a) * 560; e.vy = Math.sin(a) * 560; }
      else if (move === 1) { shootAt(e, ctx, [-0.5, -0.25, 0, 0.25, 0.5], 300, 0xdfe6ff); e.timer = p2 ? 1.4 : 2; e.pose = 'attack'; }
      else {
        // phase 2 special: tornado rolling along the floor + lightning rain
        e.pose = 'skill';
        const dir = Math.sign(hx - (e.x + e.w / 2)) || 1;
        ctx.shots.push({ x: e.x + e.w / 2, y: floor - 30, vx: dir * 150, vy: 0, r: 28, color: 0xbfd8ff, dmg: Math.round(e.def.atk * 1.2), life: 6, hostile: true, ghost: true, el: e.def.element, kind: 'tornado' });
        rainOnHero(ctx, e, 4, 0xffe060, 360);
        if (ctx.count('fire_hawk') < 2) ctx.summon('fire_hawk', e.x + e.w / 2, e.y + e.h);
        e.timer = 1.6;
      }
    }
  }
  e.x = Math.max(0, Math.min(ctx.grid.pxW - e.w, e.x));
  e.y = Math.max(16, e.y);
};

export const BOSSES: Record<string, Script> = { spore_mother: sporeMother, ram_charge: ramCharge, siren, shark, storm_roc: stormRoc };
