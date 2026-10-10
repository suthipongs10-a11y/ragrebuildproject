import Phaser from 'phaser';
import { Cell, TILE, isSolidCell, type Enemy } from '@shared/index';
import type { WorldScene } from '../scenes/WorldScene';
import { autoOn, autoStep } from './AutoBattle';
import { t } from '../i18n';

/**
 * Auto hunt (owner request "เล่นง่ายขึ้น"): with AUTO on the hero walks to the nearest monster, hops over walls and up
 * to platforms, fights (AutoBattle), then collects crystals. Tapping / clicking a monster walks there and attacks it
 * even with AUTO off. The player can always steer: any direction input takes over for that frame.
 */
export interface Pilot { dir: -1 | 0 | 1; jump: boolean; hold: boolean; down: boolean; attack: boolean }
export const NO_PILOT: Pilot = { dir: 0, jump: false, hold: false, down: false, attack: false };
const IDLE = NO_PILOT;

interface PilotState { forced: string | null; banned: Map<string, number>; lastX: number; stuckT: number; holdT: number; marker: Phaser.GameObjects.Text; cleared: boolean }
const STATE = new WeakMap<WorldScene, PilotState>();

function state(s: WorldScene): PilotState {
  let st = STATE.get(s);
  if (st) return st;
  const marker = s.add.text(0, 0, '▼', { fontFamily: 'Itim', fontSize: '22px', color: '#ffd84a', stroke: '#2a1a0a', strokeThickness: 5 }).setOrigin(0.5, 1).setDepth(45).setVisible(false);
  st = { forced: null, banned: new Map(), lastX: 0, stuckT: 0, holdT: 0, marker, cleared: false };
  STATE.set(s, st);
  const pick = st;
  // tap / click a monster: walk there and fight it
  s.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
    const e = s.combat.enemies.find((x) => !x.dead && p.worldX > x.x - 20 && p.worldX < x.x + x.w + 20 && p.worldY > x.y - 30 && p.worldY < x.y + x.h + 20);
    if (e) { pick.forced = e.id; pick.banned.delete(e.id); }
  });
  return st;
}

const centre = (b: { x: number; y: number; w: number; h: number }) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });

function pickTarget(s: WorldScene, st: PilotState, now: number): Enemy | null {
  const h = centre(s.hero);
  let best: Enemy | null = null, bs = Infinity;
  for (const e of s.combat.enemies) {
    if (e.dead || (st.banned.get(e.id) ?? 0) > now) continue;
    const c = centre(e), score = Math.abs(c.x - h.x) + 2.5 * Math.abs(c.y - h.y);
    if (score < bs) { bs = score; best = e; }
  }
  return best;
}

/** A solid tile right in front of the hero's body. */
function wallAhead(s: WorldScene, dir: number): boolean {
  const h = s.hero, tx = Math.floor((dir > 0 ? h.x + h.w + 3 : h.x - 3) / TILE);
  for (let ty = Math.floor((h.y + 6) / TILE); ty <= Math.floor((h.y + h.h - 6) / TILE); ty++) if (isSolidCell(s.grid.get(tx, ty))) return true;
  return false;
}

const onOneWay = (s: WorldScene) => s.grid.get(Math.floor((s.hero.x + s.hero.w / 2) / TILE), Math.floor((s.hero.y + s.hero.h + 2) / TILE)) === Cell.OneWay;

export function autoPilot(s: WorldScene, steering: boolean, dt: number): Pilot {
  const st = state(s), now = s.time.now / 1000, h = s.hero, d = s.session.derived;
  let forced = st.forced ? s.combat.enemies.find((e) => e.id === st.forced && !e.dead) ?? null : null;
  if (st.forced && !forced) st.forced = null;
  const on = autoOn();
  if (!on && !forced) { st.marker.setVisible(false); return IDLE; }
  const out: Pilot = { ...IDLE };
  const tgt = forced ?? pickTarget(s, st, now);
  st.marker.setVisible(!!forced);
  if (forced) st.marker.setPosition(forced.x + forced.w / 2, forced.y - 6 + Math.sin(now * 6) * 3);
  // fighting: AUTO = nearest monster + skills; a tapped target alone = just hit it when it's in reach
  out.attack = on ? autoStep(s.session, s.combat, h, s.rig, steering, dt) : false;
  if (steering) return out;
  const hc = centre(h);
  let goal: { x: number; y: number } | null = tgt ? centre(tgt) : null;
  if (!goal && on) {
    const p = s.pickups.reduce<typeof s.pickups[number] | null>((b, q) => (!b || Math.abs(q.x - hc.x) < Math.abs(b.x - hc.x) ? q : b), null);
    if (p) goal = { x: p.x, y: p.y };
    else if (!st.cleared && s.level.entities.some((e) => e.type === 'Monster')) { st.cleared = true; s.hint('autoClear', t('auto.clear')); }
  }
  if (!goal) return out;
  st.cleared = false;
  const dx = goal.x - hc.x, dy = goal.y - hc.y;
  const reach = !tgt ? 6 : d.ranged ? Math.min(d.range * 0.7, 220) : (h.w + tgt.w) / 2 + 26;
  const lined = !tgt || !d.ranged || Math.abs(dy) < 60; // arrows fly straight: get level with the target
  if (Math.abs(dx) > reach || !lined) out.dir = (Math.sign(dx) || h.dir) as -1 | 1;
  else if (tgt) { h.dir = (dx >= 0 ? 1 : -1); if (forced && !on) out.attack = Math.abs(dy) < 70; }
  // hops: walls, targets above, drop through thin platforms to targets below
  st.holdT = Math.max(0, st.holdT - dt);
  const wantUp = dy < -70 && Math.abs(dx) < 170;
  if (h.onGround && ((out.dir && wallAhead(s, out.dir)) || wantUp)) { out.jump = true; st.holdT = 0.35; }
  else if (!h.onGround && h.vy > 40 && wantUp && h.canDouble && s.abilities.has('double')) { out.jump = true; st.holdT = 0.3; }
  else if (h.onGround && dy > 70 && Math.abs(dx) < 120 && onOneWay(s)) out.down = true;
  out.hold = st.holdT > 0;
  // stuck (wall too high, pit): give up on that target for a while
  if (out.dir && Math.abs(h.x - st.lastX) < 1.5) st.stuckT += dt; else st.stuckT = 0;
  st.lastX = h.x;
  if (st.stuckT > 1.4 && tgt) { st.banned.set(tgt.id, now + 8); if (forced) st.forced = null; st.stuckT = 0; }
  return out;
}
