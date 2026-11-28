import { t } from '../app/i18n';
import type { Content } from '../data/content';
import type { GameEvent, RunState } from '../sim/types';
import { TUNING } from './anim/tuning';
import type { Tweener } from './anim/tween';
import { stars, tileName } from './describe';
import { TEXT } from './layout';
import { UI_COLOR } from './theme';
import type { BattleView } from './views/BattleView';
import type { BoardView } from './views/BoardView';
import type { HudView } from './views/HudView';

const HEAD_OFFSET = 150;
const BOSS_HEAD_OFFSET = 300;
const HIT_FX: Record<string, string> = { melee: 'fx_slash', backline: 'fx_arrow_hit', aoe: 'fx_magic_burst', healer: 'fx_slash' };

/** Turns the sim's event list into what the player sees, in order, one beat at a time. */
export class EventPlayer {
  private lastAreaSource = -1;

  constructor(
    private readonly content: Content,
    private readonly tweener: Tweener,
    private readonly board: BoardView,
    private readonly battle: BattleView,
    private readonly hud: HudView,
  ) {}

  async play(events: GameEvent[], after: RunState): Promise<void> {
    for (const event of events) await this.playOne(event, after);
    this.lastAreaSource = -1;
  }

  private unitName(state: RunState, uid: number): string {
    const unit = state.team.find((u) => u.uid === uid);
    return unit ? t(`unit.${unit.unitId}.name`) : '';
  }

  private monsterName(uid: number): string {
    const id = this.battle.monsterIdOf(uid);
    return id ? t(`monster.${id}.name`) : '';
  }

  private headOf(uid: number): { x: number; y: number } {
    const actor = this.battle.actor(uid);
    if (!actor) return { x: 0, y: 0 };
    const id = this.battle.monsterIdOf(uid);
    const tall = id !== undefined && this.content.monsters[id]?.traits.includes('boss');
    return { x: actor.x, y: actor.y - (tall ? BOSS_HEAD_OFFSET : HEAD_OFFSET) };
  }

  private async playOne(event: GameEvent, after: RunState): Promise<void> {
    const { hud, board, battle, tweener } = this;
    switch (event.type) {
      case 'RunStarted':
      case 'RoundStarted':
        if (event.type === 'RoundStarted' && event.round > 1) await tweener.wait(TUNING.round.gap);
        return;
      case 'DiceRolled':
        board.setTarget(null);
        await hud.rollDie(event.value);
        hud.log(t(event.source === 'forced' ? 'log.forced' : 'log.rolled', { value: event.value }));
        if (event.crit) {
          hud.log(t('log.crit'));
          void board.fx.play('fx_six_burst', board.center(0).x + 300, board.center(0).y + 300, 2);
          await hud.banner('banner_six', TUNING.dice.critHold);
        }
        return;
      case 'PawnMoved':
        board.setTarget(null);
        await board.movePawn(event.from, event.steps, after.board.length);
        void board.playAt(event.to, 'fx_dice_land');
        hud.hideDie();
        return;
      case 'TileLanded': {
        const tile = after.board[event.index];
        if (tile) hud.log(t('log.landed', { tile: `${tileName(tile)} ${stars(event.stars)}` }));
        await board.pulse(event.index);
        return;
      }
      case 'GoldChanged':
        hud.changeGold(event.total);
        if (event.reason === 'stolen') hud.log(t('log.stolen', { n: -event.delta }));
        else if (event.reason !== 'kill') hud.log(t(event.delta >= 0 ? 'log.gold_gain' : 'log.gold_loss', { n: Math.abs(event.delta) }));
        if (event.reason === 'tile' || event.reason === 'gamble') void board.playAt(after.position, 'fx_coin_burst');
        return;
      case 'UnitRecruited':
        battle.addUnit(after, event.uid, event.hp);
        hud.log(t('log.recruited', { unit: t(`unit.${event.unitId}.name`) }));
        await battle.fx.play('fx_summon_circle', battle.actor(event.uid)?.x ?? 0, (battle.actor(event.uid)?.y ?? 0) - 40);
        return;
      case 'UnitXpGained': {
        const head = this.headOf(event.uid);
        battle.fx.float(t('float.xp', { n: event.xp }), head.x, head.y, UI_COLOR.gold, TEXT.small);
        return;
      }
      case 'UnitTierUp': {
        const actor = battle.actor(event.uid);
        const unit = after.team.find((u) => u.uid === event.uid);
        const def = unit ? this.content.units[unit.unitId] : undefined;
        if (actor && def) {
          void battle.fx.play('fx_level_up_beam', actor.x, actor.y - 110, 1.3);
          await tweener.wait(TUNING.fx.frame * 3);
          actor.setPrefix(`${def.sprite}_t${event.tier}`);
          actor.setPose('victory');
          battle.fx.float(t('float.tier'), actor.x, actor.y - HEAD_OFFSET - 30, UI_COLOR.gold, TEXT.title);
        }
        hud.log(t('log.tier_up', { unit: this.unitName(after, event.uid), tier: event.tier }));
        await hud.banner('banner_level_up');
        actor?.setPose('idle');
        return;
      }
      case 'TeamHealed':
        if (event.amounts.length > 0) hud.log(t('log.healed'));
        for (const { uid, amount } of event.amounts) this.heal(uid, amount);
        if (event.amounts.length > 0) await tweener.wait(TUNING.fx.frame * 4);
        return;
      case 'TeamDamaged':
        hud.log(t('log.trap'));
        for (const { uid, amount } of event.amounts) {
          const actor = battle.actor(uid);
          const head = this.headOf(uid);
          actor?.hurt();
          actor?.changeHp(-amount);
          battle.fx.float(String(amount), head.x, head.y, UI_COLOR.warn);
        }
        void board.playAt(after.position, 'fx_curse_chains');
        await tweener.wait(TUNING.hurt.duration);
        return;
      case 'BuffApplied':
        if (event.kind === 'enemy_atk_pct') hud.log(t('log.ambush'));
        else {
          hud.log(t(event.kind === 'team_atk_pct' ? 'log.buff_atk' : 'log.buff_shield'));
          for (const unit of after.team) {
            const actor = battle.actor(unit.uid);
            if (!actor || actor.dead) continue;
            void battle.fx.play(event.kind === 'team_atk_pct' ? 'fx_crit_flash' : 'fx_holy_heal', actor.x, actor.y - 90, 0.8);
            if (event.kind === 'team_shield') actor.changeHp(0, event.value);
          }
        }
        await tweener.wait(TUNING.fx.frame * 4);
        return;
      case 'GambleResolved':
        hud.log(t(event.won ? 'log.gamble_won' : 'log.gamble_lost'));
        return;
      case 'TileUpgraded': {
        const tile = after.board[event.index];
        void board.playAt(event.index, 'fx_level_up_beam');
        await tweener.wait(TUNING.fx.frame * 3);
        board.sync(after);
        if (tile) hud.log(t('log.upgraded', { tile: tileName(tile), stars: stars(event.stars) }));
        return;
      }
      case 'SynergyActivated':
        hud.log(t('log.synergy', { name: t(`synergy.${event.id}.name`), tier: event.tier }));
        board.sync(after);
        await hud.banner('banner_synergy');
        return;
      case 'WaveSpawned':
        hud.setNextWave(event.nextWave);
        hud.log(t('log.wave'));
        await battle.spawnEnemies(event.enemies);
        return;
      case 'GateFightStarted': {
        const lead = event.enemies[0];
        const name = lead ? t(`monster.${lead.monsterId}.name`) : '';
        hud.log(t(event.kind === 'boss' ? 'log.gate_boss' : 'log.gate_elite', { name }));
        if (event.kind === 'boss') void hud.banner('banner_boss');
        await battle.spawnEnemies(event.enemies);
        return;
      }
      case 'UnitAttacked':
        await this.playAttack(event, after);
        return;
      case 'UnitHealed':
        battle.actor(event.source)?.setPose('attack');
        this.heal(event.target, event.amount);
        await tweener.wait(TUNING.attack.stagger);
        battle.actor(event.source)?.setPose('idle');
        return;
      case 'UnitDied': {
        const actor = battle.actor(event.uid);
        if (!actor) return;
        const id = this.battle.monsterIdOf(event.uid);
        const boss = id !== undefined && this.content.monsters[id]?.traits.includes('boss');
        void battle.fx.play(boss ? 'fx_explosion' : 'fx_death_poof', actor.x, actor.y - 80, boss ? 2.2 : 1);
        if (boss) battle.shake(TUNING.shake.heavy);
        await actor.die(boss ? 'defeated' : null);
        return;
      }
      case 'BossWindup': {
        const actor = battle.actor(event.uid);
        const id = this.battle.monsterIdOf(event.uid);
        actor?.setPose('windup');
        const head = this.headOf(event.uid);
        battle.fx.float(t('float.warning'), head.x, head.y, UI_COLOR.warn, TEXT.big);
        hud.log(t('log.windup', { name: this.monsterName(event.uid), skill: t(`skill.${id ?? ''}.special`) }));
        await tweener.wait(TUNING.bossWindup.hold);
        return;
      }
      case 'BossSpecial': {
        const actor = battle.actor(event.uid);
        const id = this.battle.monsterIdOf(event.uid);
        hud.log(t('log.special', { name: this.monsterName(event.uid), skill: t(`skill.${id ?? ''}.special`) }));
        if (actor) {
          await actor.attack('special');
          void battle.fx.play('fx_ground_slam', actor.x - 260, actor.y - 40, 2.4);
          battle.shake(TUNING.shake.heavy);
          await tweener.wait(TUNING.hurt.hitStop);
        }
        // The hits that follow belong to this one swing.
        this.lastAreaSource = event.uid;
        return;
      }
      case 'WaveCleared':
        hud.log(t('log.wave_cleared'));
        for (const unit of after.team) battle.actor(unit.uid)?.setPose('victory');
        await tweener.wait(TUNING.banner.in + TUNING.round.gap);
        for (const unit of after.team) if (!battle.actor(unit.uid)?.dead) battle.actor(unit.uid)?.setPose('idle');
        return;
      case 'TeamWiped':
        hud.log(t('log.wiped'));
        return;
      case 'HeartLost':
        hud.setHearts(event.hearts);
        hud.log(t('log.heart', { n: event.hearts }));
        await tweener.wait(TUNING.banner.hold / 2);
        return;
      case 'TeamRevived':
        hud.log(t('log.revived'));
        battle.syncTeam(after);
        for (const unit of after.team) {
          const actor = battle.actor(unit.uid);
          if (actor) void battle.fx.play('fx_revive', actor.x, actor.y - 90);
        }
        await tweener.wait(TUNING.fx.frame * 6);
        return;
      case 'GateFightEnded':
        hud.log(t(event.won ? 'log.gate_won' : 'log.gate_lost'));
        if (event.won) await hud.banner('banner_lap_clear');
        return;
      case 'LapStarted':
        hud.log(t('log.lap', { lap: event.lap }));
        return;
      case 'RunEnded':
        return;
    }
  }

  private heal(uid: number, amount: number): void {
    const actor = this.battle.actor(uid);
    if (!actor) return;
    const head = this.headOf(uid);
    actor.changeHp(amount);
    void this.battle.fx.play('fx_holy_heal', actor.x, actor.y - 90, 0.9);
    this.battle.fx.float(`+${amount}`, head.x, head.y, UI_COLOR.heal);
  }

  private async playAttack(event: Extract<GameEvent, { type: 'UnitAttacked' }>, after: RunState): Promise<void> {
    const { battle, tweener } = this;
    const source = battle.actor(event.source);
    const target = battle.actor(event.target);
    // One swing can hit several targets: only the first hit plays the wind-up.
    const sameSwing = event.area && this.lastAreaSource === event.source;
    if (source && !sameSwing) await source.attack();
    this.lastAreaSource = event.area ? event.source : -1;
    if (!target) return;
    const head = this.headOf(event.target);
    let fx = 'fx_slash';
    if (event.side === 'team') {
      const unit = after.team.find((u) => u.uid === event.source);
      fx = HIT_FX[(unit && this.content.units[unit.unitId]?.role) ?? 'melee'] ?? fx;
    }
    void battle.fx.play(fx, target.x, target.y - 90, event.side === 'enemy' && event.area ? 1.3 : 1);
    target.hurt();
    target.changeHp(-event.damage, -event.absorbed);
    if (event.absorbed > 0) battle.fx.float(t('float.shield'), head.x, head.y - 30, UI_COLOR.shield, TEXT.small);
    battle.fx.float(String(event.damage), head.x, head.y, event.side === 'team' ? UI_COLOR.damage : UI_COLOR.warn);
    if (after.turnState.crit && event.side === 'team') battle.shake(TUNING.shake.light);
    if (!sameSwing) await tweener.wait(TUNING.attack.stagger);
  }
}
