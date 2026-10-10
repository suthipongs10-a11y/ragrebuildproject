import {
  addItem, addRune, canEnterTower, clearTower, createRng, dayKey, useDailyEntry, dungeonOf, dungeonReward, dungeonWaves, rollRune, towerWaves, TILE,
  type ArenaReward, type ArenaRun, type WaveSpawn,
} from '@shared/index';
import type { WorldScene } from '../scenes/WorldScene';
import { rewardItems } from '../ui/menu/arenaText';
import { monsterSetKeys } from '../assets/packs';
import { t } from '../i18n';

/** Runs a daily dungeon / tower floor in the arena room: waves one after another, rewards, then back to town. */
export class ArenaController {
  private readonly waves: WaveSpawn[][];
  private wave = -1;
  private wait = 1.2;
  private done = false;
  private readonly rng = createRng(Date.now() & 0xffffff);

  constructor(private readonly s: WorldScene, private readonly run: ArenaRun) {
    const c = s.session.content;
    const day = run.mode === 'dungeon' ? dungeonOf(c, run.day) : undefined;
    this.waves = run.mode === 'dungeon' ? (day ? dungeonWaves(c, day, run.heroLv, this.rng) : []) : towerWaves(c, run.floor);
    s.toast(run.mode === 'dungeon' ? t('arena.startDungeon').replace('{el}', t(`el.${day?.element ?? 'neutral'}`)) : t('arena.floor').replace('{n}', String(run.floor)));
  }

  update(dt: number): void {
    if (this.done || this.s.busy) return;
    if (this.s.combat.enemies.some((e) => !e.dead && e.id.startsWith('arena#'))) return;
    this.wait -= dt;
    if (this.wait > 0) return;
    this.wave++;
    if (this.wave < this.waves.length) { this.spawnWave(this.waves[this.wave] as WaveSpawn[]); this.wait = 1; }
    else this.finish();
  }

  private spawnWave(list: WaveSpawn[]): void {
    const g = this.s.grid, floor = (this.s.level.floorRow ?? 15) * TILE;
    list.forEach((sp, i) => {
      const x = 160 + ((i * 197 + this.wave * 83) % Math.max(1, g.pxW - 320));
      this.s.combat.spawn(`arena#${this.wave}_${i}`, sp.id, x, floor, sp.scale);
    });
    this.s.toast(t('arena.wave').replace('{n}', String(this.wave + 1)).replace('{max}', String(this.waves.length)));
  }

  private finish(): void {
    this.done = true;
    const s = this.s, c = s.session.content, a = s.session.arena;
    const r: ArenaReward | null = this.run.mode === 'dungeon'
      ? (() => { const d = dungeonOf(c, this.run.day); return d ? dungeonReward(d, this.run.heroLv, this.rng) : null; })()
      : clearTower(c, a, this.run.floor);
    const lines = [t('arena.clear')];
    if (r) {
      for (const [id, n] of Object.entries(r.items)) addItem(s.session.data, c, id, n);
      s.save.zeny += r.zeny;
      lines.push(`${rewardItems(c, r.items)} · ${r.zeny}z`);
      if (r.runeStar) { addRune(s.session.box, rollRune(c, this.rng, r.runeStar, Math.floor(this.rng.next() * 4))); lines.push(t('spirit.runeDrop').replace('{n}', String(r.runeStar))); }
    } else lines.push(t('arena.noReward'));
    s.session.emit();
    s.flush();
    s.openDialog(t('arena.clearTitle'), [lines.join('\n'), t('arena.back')]);
    s.time.delayedCall(4500, () => s.goHome(t('arena.home')));
  }
}

/** Monster textures an arena run needs (loaded with the room). */
export function arenaKeys(s: WorldScene, roomId: string): string[] {
  const run = s.registry.get('arenaRun') as ArenaRun | undefined, c = s.session.content;
  if (roomId !== 'arena' || !run) return [];
  const ids = run.mode === 'dungeon' ? dungeonOf(c, run.day)?.monsters ?? [] : towerWaves(c, run.floor).flat().map((w) => w.id);
  return monsterSetKeys(ids);
}

/** Portal NPC: spend a daily entry / check the tower floor, then go to the arena room. Returns a reason when refused. */
export function enterArena(s: WorldScene, run: ArenaRun): string | null {
  const a = s.session.arena;
  if (run.mode === 'dungeon' && !useDailyEntry(a, dayKey(new Date()))) return t('arena.noEntries');
  if (run.mode === 'tower' && !canEnterTower(s.session.content, a, run.floor)) return t('arena.locked');
  s.registry.set('arenaRun', run);
  s.flush();
  s.goRoom('arena', { kind: 'default' }, 250);
  return null;
}
