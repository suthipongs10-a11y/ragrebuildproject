import Phaser from 'phaser';
import {
  act, addItem, addRune, autoChoice, battleMembers, battleTeam, canEnterTower, clearTower, createBattle, createRng, dailyLeft, dayKey,
  dungeonOf, dungeonReward, dungeonWaves, giveSpiritExp, nextTurn, ready, rollRune, spiritOf, tbc, towerWaves, turnOrder, unitOf, useDailyEntry,
  type ArenaReward, type ArenaRun, type Battle, type TbEvent, type TbUnit, type WaveSpawn,
} from '@shared/index';
import type { HeroSession } from '../hero/HeroSession';
import { loadTextures, monsterKeys, monsterSetKeys, monsterTint, zoneKey } from '../assets/packs';
import { ART } from '../assets/manifest.generated';
import { elementColor, spiritTexture, teamArtKeys } from '../spirits/art';
import { hitFx } from '../spirits/Ultimate';
import { popInfo, popNumber } from '../vfx/DamageText';
import { ELEMENT_COLOR, burst, spark } from '../vfx/Effects';
import { writeSave } from '../save/local';
import { rewardItems } from '../ui/menu/arenaText';
import { t } from '../i18n';
import { UnitView } from './UnitView';
import { BattleUi } from './BattleUi';
import { showPrep, showResult, type Foe, type ResultButton } from './panels';

/** Turn battle for the tower and the daily dungeon (owner: "หอคอย ดันพิเศษ ใช้ภูติ สู้แบบ SW"). GDD §4.1. */
const ALLY_POS: [number, number][] = [[310, 372], [205, 292], [205, 452], [100, 372]];
const FOE_POS: [number, number][] = [[650, 372], [755, 292], [755, 452], [860, 372], [860, 212]];
const STAGE: Record<string, string> = { water: 'abyss', wind: 'sky', earth: 'forest', fire: 'desert', neutral: 'deep', holy: 'town', dark: 'deep' };
type Choice = { skill: number; target: string | null } | null;
const store = (k: string, v?: string): string | null => { try { if (v !== undefined) localStorage.setItem(k, v); return localStorage.getItem(k); } catch { return null; } };

export class TurnBattleScene extends Phaser.Scene {
  private run!: ArenaRun;
  private seed = 1;
  private session!: HeroSession;
  private waves: WaveSpawn[][] = [];
  private b: Battle | null = null;
  private ui: BattleUi | null = null;
  private readonly views = new Map<string, UnitView>();
  private auto = false;
  private speed = 1;
  private pick: ((c: Choice) => void) | null = null;
  private leaving = false;
  private done = false;

  constructor() { super('TurnBattle'); }

  init(data: { run: ArenaRun; seed?: number }): void {
    this.run = data.run; this.seed = data.seed ?? ((Date.now() & 0xffffff) | 1);
    this.b = null; this.ui = null; this.views.clear(); this.pick = null; this.leaving = false; this.done = false;
    this.auto = store('sj_tb_auto') === '1'; this.speed = Number(store('sj_tb_speed') ?? 1) || 1;
  }

  create(): void {
    document.body.classList.add('tb');
    this.events.once('shutdown', () => { document.body.classList.remove('tb'); document.querySelectorAll('.tb-panel').forEach((p) => p.remove()); });
    this.session = this.registry.get('session') as HeroSession;
    const c = this.session.content, run = this.run;
    const day = run.mode === 'dungeon' ? dungeonOf(c, run.day) : undefined;
    this.waves = run.mode === 'dungeon' ? (day ? dungeonWaves(c, day, run.heroLv, createRng(this.seed)) : []) : towerWaves(c, run.floor);
    const stage = this.stageKey(day?.element ?? null);
    loadTextures(this, [...(stage ? [stage] : []), ...monsterSetKeys(this.waves.flat().map((w) => w.id))], () => {
      this.drawStage(stage);
      showPrep(this.session, this.busy(), this.title(), this.foes(), () => this.start(), () => this.goTown());
    });
  }

  private title(): string {
    const r = this.run;
    if (r.mode === 'tower') return `🗼 ${t('arena.floor').replace('{n}', String(r.floor))}`;
    return `🌀 ${t('arena.startDungeon').replace('{el}', t(`el.${dungeonOf(this.session.content, r.day)?.element ?? 'neutral'}`))}`;
  }

  private busy(): number[] { return this.session.save.explore?.uids ?? []; }

  private foes(): Foe[] {
    const c = this.session.content, out = new Map<string, Foe>();
    for (const w of this.waves.flat()) {
      const m = c.monsters.find((x) => x.id === w.id);
      if (!m) continue;
      const f = out.get(m.id) ?? { name: t(m.name_key), el: m.element, boss: m.tier !== 'normal', n: 0 };
      f.n++; out.set(m.id, f);
    }
    return [...out.values()];
  }

  private stageKey(el: string | null): string | null {
    const own = el ? [`tb_stage_${el}`, 'tb_stage_dungeon'] : ['tb_stage_tower'];
    const zone = el ? (STAGE[el] ?? 'deep') : 'sky';
    return [...own, zoneKey(zone, null, 'far'), 'zone_town_far'].find((k) => ART[k]) ?? null;
  }

  private drawStage(key: string | null): void {
    if (key && this.textures.exists(key)) {
      const img = this.add.image(480, 270, key);
      img.setScale(Math.max(960 / img.width, 540 / img.height));
    } else this.add.rectangle(480, 270, 960, 540, 0x2a2238);
    this.add.rectangle(480, 405, 960, 270, 0x120c06, 0.35);
    this.add.ellipse(480, 400, 1000, 190, 0x000000, 0.18);
  }

  // ───────────────────────── battle flow ─────────────────────────
  private start(): void {
    const s = this.session, c = s.content, team = battleTeam(s.box, c, this.busy());
    if (!team.length) { this.goTown(); return; }
    loadTextures(this, teamArtKeys(c, team), () => {
      this.b = createBattle(c, battleMembers(s.box, team), this.waves, this.seed);
      this.ui = new BattleUi(this, this.title(), { skill: (i) => this.onSkill(i), auto: () => this.toggleAuto(), speed: () => this.toggleSpeed(), leave: () => this.leave() });
      this.ui.setAuto(this.auto); this.setSpeed(this.speed);
      for (const u of this.b.units) this.addView(u);
      this.waveTitle();
      void this.loop();
    });
  }

  private addView(u: TbUnit): void {
    const [x, y] = (u.side === 'ally' ? ALLY_POS : FOE_POS)[u.slot] ?? [480, 372];
    const v = new UnitView(this, this.session.content, u, x, y);
    if (u.side === 'enemy') {
      v.c.setInteractive(new Phaser.Geom.Rectangle(-60, -v.h, 120, v.h + 20), Phaser.Geom.Rectangle.Contains);
      v.c.on('pointerup', () => { if (this.pick && !u.dead) this.pick({ skill: this.ui?.skill ?? 0, target: u.key }); });
    }
    this.views.set(u.key, v);
  }

  private async loop(): Promise<void> {
    const b = this.b;
    while (b && !b.result && !this.leaving) {
      await this.play(nextTurn(b));
      const u = b.active;
      this.refresh();
      if (!u) continue;
      const v = this.views.get(u.key);
      v?.setTurn(true);
      const choice = u.side === 'ally' && !this.auto ? await this.playerChoice(u) : (await this.wait(320), autoChoice(b, u));
      v?.setTurn(false);
      this.ui?.showSkills(null); this.ui?.setHint('');
      if (this.leaving || !choice) break;
      await this.play(act(b, choice.skill, choice.target));
      this.refresh();
    }
    if (b?.result && !this.done) this.finish(b.result === 'win');
  }

  private playerChoice(u: TbUnit): Promise<Choice> {
    this.ui?.showSkills(u, 0);
    this.ui?.setHint(t('tb.yourTurn').replace('{name}', t(u.name_key)));
    return new Promise((res) => { this.pick = (c) => { this.pick = null; res(c); }; });
  }

  private onSkill(i: number): void {
    const u = this.b?.active;
    if (!u || !this.pick || !ready(u, i)) return;
    if (u.skills[i]?.target === 'all') { this.pick({ skill: i, target: null }); return; }
    this.ui?.showSkills(u, i);
    this.ui?.setHint(t('tb.pick'));
  }

  private toggleAuto(): void {
    this.auto = !this.auto; store('sj_tb_auto', this.auto ? '1' : '0'); this.ui?.setAuto(this.auto);
    const u = this.b?.active;
    if (this.auto && u && this.pick && this.b) this.pick(autoChoice(this.b, u));
  }

  private toggleSpeed(): void { this.setSpeed(this.speed === 1 ? 2 : this.speed === 2 ? 3 : 1); }
  private setSpeed(n: number): void { this.speed = n; store('sj_tb_speed', String(n)); this.time.timeScale = n; this.tweens.timeScale = n; this.ui?.setSpeed(n); }

  private leave(): void {
    if (this.done) return;
    this.leaving = true;
    this.pick?.(null);
    this.finish(false);
  }

  private wait(ms: number): Promise<void> { return new Promise((res) => this.time.delayedCall(ms, () => res())); }

  private refresh(): void {
    const b = this.b;
    if (!b) return;
    for (const v of this.views.values()) v.draw();
    const order = turnOrder(b, 7).map((k) => unitOf(b, k)).filter((u): u is TbUnit => !!u);
    this.ui?.showOrder(order, (u) => this.picture(u));
  }

  private picture(u: TbUnit): { key: string; tint: number | null } {
    if (u.side === 'ally') return spiritTexture(this, this.session.content, { id: u.id, el: u.el, awk: u.awk });
    return { key: monsterKeys(u.id)[0] ?? '__MISSING', tint: monsterTint(u.id) };
  }

  private waveTitle(): void {
    const b = this.b;
    if (!b || !this.ui) return;
    this.ui.setTitle(`${this.title()} · ${t('tb.wave').replace('{n}', String(b.wave + 1)).replace('{max}', String(b.waves.length))}`);
  }

  // ───────────────────────── showing events ─────────────────────────
  private async play(events: TbEvent[]): Promise<void> {
    const b = this.b;
    if (!b) return;
    let cast: Extract<TbEvent, { kind: 'cast' }> | null = null;
    for (const ev of events) {
      const v = (k: string) => this.views.get(k);
      switch (ev.kind) {
        case 'stunned': { const x = v(ev.unit); if (x) popInfo(this, x.x, x.headY - 30, t('tb.stunned'), '#ffe066'); await this.wait(380); break; }
        case 'cast': cast = ev; await this.castFx(ev); break;
        case 'hit': {
          const d = v(ev.dst), dst = unitOf(b, ev.dst);
          if (!d || !dst) break;
          d.flash(); d.pose('hurt');
          if (cast?.skill.target === 'one') spark(this, d.x, d.midY, 0xffffff, 1.2);
          popNumber(this, d.x, d.headY - 10, ev.amount, dst.side === 'ally' ? 'taken' : ev.crit ? 'crit' : ev.mult > 1 ? 'weak' : ev.mult < 1 ? 'resist' : 'normal');
          d.draw();
          if (cast?.skill.target === 'all') await this.wait(70);
          break;
        }
        case 'heal': { const d = v(ev.dst); if (d && ev.amount > 0) { popNumber(this, d.x, d.headY, ev.amount, 'heal'); d.draw(); } break; }
        case 'shield': { const d = v(ev.dst); if (d) { popInfo(this, d.x, d.headY - 24, '🛡️', '#dff4ff'); d.draw(); } break; }
        case 'status': { const d = v(ev.dst); if (d) { popInfo(this, d.x, d.headY - 34, ev.status === 'stun' ? `💫 ${t('tb.stunned')}` : t('tb.defdown'), '#ffd27a'); d.draw(); } break; }
        case 'die': { const d = v(ev.unit); if (d) { d.die(); this.views.delete(ev.unit); } await this.wait(200); break; }
        case 'phase': { const u = unitOf(b, ev.unit), d = v(ev.unit); if (u && d) { this.cameras.main.flash(250, 255, 120, 120); popInfo(this, d.x, d.headY - 50, t('combat.enraged').replace('{name}', t(u.name_key)), '#ff8a6a'); } await this.wait(400); break; }
        case 'summon': { const u = unitOf(b, ev.unit); if (u) { this.addView(u); const d = v(ev.unit); if (d) { burst(this, d.x, d.midY, 0xc9a6ff, 12, 200); popInfo(this, d.x, d.headY - 40, t('tb.called'), '#c9a6ff'); } } await this.wait(300); break; }
        case 'wave': {
          if (ev.n === 1) break;
          await this.wait(450);
          for (const u of b.units) if (u.side === 'enemy' && !this.views.has(u.key)) this.addView(u);
          this.waveTitle();
          popInfo(this, 480, 230, t('tb.wave').replace('{n}', String(ev.n)).replace('{max}', String(ev.max)), '#ffe9a8');
          await this.wait(500);
          break;
        }
        default: break;
      }
    }
    if (cast) await this.wait(260);
  }

  private async castFx(ev: Extract<TbEvent, { kind: 'cast' }>): Promise<void> {
    const b = this.b, src = b && unitOf(b, ev.unit), sv = this.views.get(ev.unit);
    if (!b || !src || !sv) return;
    const targets = ev.targets.map((k) => this.views.get(k)).filter((x): x is UnitView => !!x);
    const color = src.side === 'ally' ? elementColor(this.session.content, src.el) : (ELEMENT_COLOR[src.el] ?? 0xffffff);
    const sk = ev.skill;
    if (sk.kind !== 'basic') popInfo(this, sv.x, sv.headY - 50, t(sk.name_key), sk.kind === 'boss' ? '#ff9b7a' : '#e8c6ff');
    if (src.side === 'enemy') {
      sv.pose(sk.kind === 'boss' ? 'skill' : 'attack', 420);
      if (sk.kind === 'boss') { this.cameras.main.shake(260, 0.01); await this.wait(250); for (const d of targets) hitFx(this, 'slam', d.x, d.y, d.midY, color); }
      else if (targets[0]) await sv.lunge(targets[0].x);
      return;
    }
    if (sk.target === 'all') {
      this.cameras.main.flash(160, 255, 240, 200);
      await this.wait(260);
      for (const d of targets) hitFx(this, sk.vfx, d.x, d.y, d.midY, color);
      return;
    }
    const d = targets[0];
    if (!d) return;
    const orb = this.add.circle(sv.x + 30, sv.midY, 12, color, 0.95).setDepth(60).setBlendMode(Phaser.BlendModes.ADD);
    await new Promise<void>((res) => this.tweens.add({ targets: orb, x: d.x, y: d.midY, duration: 220, ease: 'Quad.in', onComplete: () => { orb.destroy(); res(); } }));
  }

  // ───────────────────────── end ─────────────────────────
  private finish(win: boolean): void {
    this.done = true;
    const s = this.session, c = s.content, run = this.run, rng = createRng(this.seed ^ 0x51ed), lines: string[] = [];
    if (win) {
      const r: ArenaReward | null = run.mode === 'dungeon'
        ? (() => { const d = dungeonOf(c, run.day); return d ? dungeonReward(d, run.heroLv, rng) : null; })()
        : clearTower(c, s.arena, run.floor);
      if (r) {
        for (const [id, n] of Object.entries(r.items)) addItem(s.data, c, id, n);
        s.save.soul += r.soul;
        lines.push(`${rewardItems(c, r.items)} · ${r.soul}${t('hud.soul')}`);
        if (r.runeStar) { addRune(s.box, rollRune(c, rng, r.runeStar, Math.floor(rng.next() * 4))); lines.push(t('spirit.runeDrop').replace('{n}', String(r.runeStar))); }
      } else lines.push(t('arena.noReward'));
      const exp = Math.round((this.b?.exp ?? 0) * tbc(c, 'exp', 1));
      if (exp > 0) {
        lines.push(t('tb.exp').replace('{n}', String(exp)));
        for (const u of this.b?.units.filter((x) => x.side === 'ally') ?? []) {
          const sp = spiritOf(s.box, u.uid);
          if (sp && giveSpiritExp(sp, exp) > 0) lines.push(t('tb.lvup').replace('{name}', t(u.name_key)).replace('{n}', String(sp.lv)));
        }
      }
    } else lines.push(t('tb.loseHint'));
    writeSave(s.save);
    s.emit();
    const buttons: ResultButton[] = [{ label: t('tb.home'), run: () => this.goTown() }];
    const again = (next: ArenaRun) => () => this.scene.restart({ run: next });
    if (run.mode === 'tower') {
      if (win && canEnterTower(c, s.arena, run.floor + 1) && run.floor < c.tower.length) buttons.push({ label: t('tb.next'), primary: true, run: again({ mode: 'tower', floor: run.floor + 1 }) });
      else if (!win) buttons.push({ label: t('tb.retry'), primary: true, run: again(run) });
    } else if (dailyLeft(s.arena, dayKey(new Date())) > 0) {
      buttons.push({ label: t('tb.again'), primary: true, run: () => { if (useDailyEntry(s.arena, dayKey(new Date()))) { writeSave(s.save); again(run)(); } else this.goTown(); } });
    }
    this.time.delayedCall(win ? 500 : 300, () => showResult(win, lines, buttons));
  }

  private goTown(): void {
    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('World', { room: 'town', place: { kind: 'default' } }));
  }
}
