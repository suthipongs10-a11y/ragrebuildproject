import { Container, Graphics } from 'pixi.js';
import { t } from '../app/i18n';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../app/viewport';
import type { Content } from '../data/content';
import { applyAction, legalActions } from '../sim/apply';
import { upgradeCost } from '../sim/board';
import { createRun } from '../sim/run';
import type { Action, GameEvent, RewardOption, RunState } from '../sim/types';
import { TUNING } from './anim/tuning';
import { Tweener } from './anim/tween';
import type { GameAssets } from './assets';
import { relicText, shopItemText, stars, tileEffectText, tileHoverText, tileName } from './describe';
import { EventPlayer } from './EventPlayer';
import { LAYOUT } from './layout';
import { COLOR } from './theme';
import { Button } from './ui/widgets';
import { BattleView } from './views/BattleView';
import { BoardView } from './views/BoardView';
import { ChoiceOverlay, type ChoiceCard } from './views/ChoiceOverlay';
import { ControlsView } from './views/ControlsView';
import { HudView } from './views/HudView';

/** Art used by Act 1. Later acts swap these per lap (M5). */
export const ACT1_IMAGES = { board: 'board_act1_desert', backdrop: 'bg_act1_desert' } as const;
const RESTART_WIDTH = 360;
const SPEED_WIDTH = 190;
const SPEED_HEIGHT = 56;

/** The playable screen: owns the run state, sends actions to the sim and plays back what happened. */
export class GameScene extends Container {
  private readonly tweener = new Tweener();
  private readonly board: BoardView;
  private readonly battle: BattleView;
  private readonly hud: HudView;
  private readonly controls: ControlsView;
  private readonly overlay: ChoiceOverlay;
  private readonly player: EventPlayer;
  private readonly restart: Button;
  private readonly speedButton: Button;
  private state: RunState | null = null;
  private busy = false;
  private speedIndex = 0;
  private baseInfo = '';

  constructor(
    private readonly content: Content,
    private readonly assets: GameAssets,
    private readonly newSeed: () => number,
  ) {
    super();
    this.addChild(new Graphics().rect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT).fill(COLOR.background));
    this.board = new BoardView(content, assets, this.tweener, ACT1_IMAGES.board, (index) => this.hoverTile(index), (index) => void this.tryAction({ type: 'placeTile', index }));
    this.board.position.set(LAYOUT.board.x, LAYOUT.board.y);
    this.battle = new BattleView(content, assets, this.tweener, ACT1_IMAGES.backdrop);
    this.battle.position.set(LAYOUT.battle.x, LAYOUT.battle.y);
    this.hud = new HudView(content, assets, this.tweener, (hint) => this.controls.setInfo(hint ?? this.baseInfo));
    this.controls = new ControlsView(assets, (action) => void this.tryAction(action));
    this.controls.position.set(LAYOUT.controls.x, LAYOUT.controls.y);
    this.overlay = new ChoiceOverlay(assets.frame('btn_purple'), assets.frame('btn_purple_pressed'));
    this.player = new EventPlayer(content, this.tweener, this.board, this.battle, this.hud);

    this.speedButton = new Button(assets.frame('btn_green'), assets.frame('btn_green_pressed'), SPEED_WIDTH, SPEED_HEIGHT, '', () => this.cycleSpeed());
    this.speedButton.position.set(LAYOUT.status.x + LAYOUT.status.width - SPEED_WIDTH - LAYOUT.panelPad, LAYOUT.status.y + LAYOUT.panelPad / 2);
    this.restart = new Button(assets.frame('btn_gold'), assets.frame('btn_gold_pressed'), RESTART_WIDTH, LAYOUT.controls.buttonHeight, t('ui.new_run'), () => this.chooseLeader());
    this.restart.position.set((DESIGN_WIDTH - RESTART_WIDTH) / 2, LAYOUT.banner.y + 200);
    this.restart.visible = false;
    this.addChild(this.battle, this.board, this.controls, this.hud, this.speedButton, this.restart, this.overlay);
    this.cycleSpeed(0);
  }

  /** Called by the app every frame. */
  update(deltaMs: number): void {
    this.tweener.tick(deltaMs);
    this.battle.update(deltaMs * this.tweener.speed);
  }

  private cycleSpeed(to?: number): void {
    this.speedIndex = to ?? (this.speedIndex + 1) % TUNING.speeds.length;
    this.tweener.speed = TUNING.speeds[this.speedIndex] ?? 1;
    this.speedButton.setText(t('ui.speed', { n: this.tweener.speed }));
  }

  /** Every run opens here: who leads decides the starting team and a passive bonus. */
  chooseLeader(): void {
    if (this.busy) return;
    this.restart.visible = false;
    this.hud.hideResult();
    const cards = Object.values(this.content.leaders).map((leader): ChoiceCard => ({
      icon: this.assets.frame(leader.portrait),
      tag: t(`skill.${leader.id}.name`),
      title: t(`leader.${leader.id}.name`),
      body: t(`leader.${leader.id}.desc`),
      footer: '',
      enabled: true,
      onPick: () => void this.startRun(leader.id),
    }));
    this.overlay.show(t('ui.choose_leader'), cards, null, null);
  }

  private async startRun(leaderId: string): Promise<void> {
    if (this.busy) return;
    this.overlay.hide();
    this.board.setPawn(this.content.leaders[leaderId]?.pawn ?? '');
    const { state, events } = createRun(this.content, this.newSeed(), leaderId);
    await this.present(state, events);
  }

  /** Keyboard: Space/Enter = gold button, R/Esc = purple button or close, 1-6 = die face or card, F = speed. */
  handleKey(key: string): void {
    if (key === 'f' || key === 'F') return this.cycleSpeed();
    // Nothing may start while the last action is still playing out (it would overlap two runs).
    if (this.busy) return;
    const digit = Number(key);
    const confirm = key === ' ' || key === 'Enter';
    const cancel = key === 'r' || key === 'R' || key === 'Escape';
    if (this.overlay.visible) {
      if (Number.isInteger(digit) && digit >= 1) this.overlay.pick(digit - 1);
      else if (cancel) this.overlay.close();
      return;
    }
    if (!this.state || this.state.phase === 'ended') {
      if (confirm) this.chooseLeader();
      return;
    }
    if (confirm) return void this.tryAction(this.controls.primaryChoice);
    if (cancel) return void this.tryAction(this.controls.secondaryChoice);
    if (Number.isInteger(digit) && digit >= 1) void this.tryAction(this.controls.faceAction(digit));
  }

  private async tryAction(action: Action | null): Promise<void> {
    if (!action || !this.state || this.busy) return;
    if (!legalActions(this.content, this.state).some((a) => JSON.stringify(a) === JSON.stringify(action))) return;
    this.overlay.hide();
    const { state, events } = applyAction(this.content, this.state, action);
    await this.present(state, events);
  }

  private async present(state: RunState, events: GameEvent[]): Promise<void> {
    this.busy = true;
    this.state = state;
    if (events[0]?.type === 'RunStarted') {
      this.board.sync(state);
      this.hud.sync({ ...state, nextWave: [] });
      this.battle.clear();
      this.hud.clearLog();
    }
    this.refreshControls();
    await this.player.play(events, state);
    // The state is the truth: whatever the animations showed, end on exactly what the sim says.
    this.board.sync(state);
    this.battle.syncTeam(state);
    this.battle.syncEnemies(state);
    this.hud.sync(state);
    this.busy = false;
    this.refreshControls();
    this.showPhaseOverlay();
    if (state.phase === 'ended') {
      this.hud.showResult(state.result === 'won' ? 'banner_victory' : 'banner_defeat');
      this.restart.visible = true;
    }
  }

  private rewardCard(option: RewardOption, index: number): ChoiceCard {
    const onPick = (): void => void this.tryAction({ type: 'chooseReward', index });
    if (option.kind === 'relic') {
      const relic = this.content.relics[option.relicId];
      return { icon: this.assets.frame(relic?.icon ?? ''), tag: t('ui.reward_relic'), title: t(`relic.${option.relicId}.name`), body: relicText(this.content, option.relicId), footer: '', enabled: true, onPick };
    }
    if (option.kind === 'face') {
      const face = this.content.faces[option.faceId];
      return { icon: this.assets.frame(face?.icon ?? ''), tag: t('ui.reward_face'), title: t(`face.${option.faceId}.name`), body: t(`face.${option.faceId}.desc`), footer: '', enabled: true, onPick };
    }
    const tile = { tileId: option.tileId, stars: 1 };
    return { icon: this.assets.frame(this.content.tiles[option.tileId]?.icon ?? ''), tag: t('ui.reward_tile'), title: tileName(tile), body: tileEffectText(this.content, tile), footer: '', enabled: true, onPick };
  }

  /** Shop and reward phases are answered on a card overlay rather than with the two buttons. */
  private showPhaseOverlay(): void {
    const state = this.state;
    if (!state) return;
    if (state.phase === 'reward') {
      this.overlay.show(t('ui.reward'), state.rewardOptions.map((option, index) => this.rewardCard(option, index)), null, null);
    } else if (state.phase === 'shop') {
      const cards = state.shop.map((offer, index): ChoiceCard => {
        const text = shopItemText(this.content, offer.itemId, offer.relicId);
        const icon = offer.relicId ? this.content.relics[offer.relicId]?.icon : this.content.shopItems[offer.itemId]?.icon;
        return {
          icon: this.assets.frame(icon ?? ''),
          tag: t(`shop.${offer.itemId}.name`),
          title: text.name,
          body: text.body,
          footer: offer.sold ? t('ui.sold') : t('ui.cost', { cost: offer.cost }),
          enabled: !offer.sold && state.gold >= offer.cost,
          onPick: () => void this.tryAction({ type: 'buy', index }),
        };
      });
      this.overlay.show(`${t('ui.shop')} — ${t('ui.cost', { cost: state.gold })}`, cards, t('ui.leave'), () => void this.tryAction({ type: 'leaveShop' }));
    }
  }

  private hoverTile(index: number | null): void {
    if (!this.state || this.overlay.visible) return;
    this.controls.setInfo(index === null ? this.baseInfo : tileHoverText(this.content, this.state, index));
  }

  private setInfo(text: string): void {
    this.baseInfo = text;
    this.controls.setInfo(text);
  }

  private refreshControls(): void {
    const { state, content } = this;
    if (!state) return;
    const here = state.board[state.position];
    this.controls.sync({
      actions: state.phase === 'ended' ? [] : legalActions(content, state),
      rerollsLeft: state.rerollsLeft,
      forceDice: state.forceDice,
      upgradeCost: state.phase === 'upgrade' ? upgradeCost(content, state) : null,
      busy: this.busy,
    });
    this.board.setTarget(null);
    if (!here) return;
    switch (state.phase) {
      case 'ended':
        return this.setInfo(t(state.result === 'won' ? 'info.won' : 'info.lost'));
      case 'roll':
        return this.setInfo(t('info.roll', { tile: tileName(here) }));
      case 'shop':
        return this.setInfo(t('info.shop'));
      case 'reward':
        return this.setInfo(t('info.reward'));
      case 'placeTile': {
        const tile = { tileId: state.pendingTile ?? '', stars: 1 };
        return this.setInfo(t('info.place_tile', { tile: tileName(tile), effect: tileEffectText(content, tile) }));
      }
      case 'placeFace':
        return this.setInfo(t('info.place_face', { face: t(`face.${state.pendingFace}.name`), effect: t(`face.${state.pendingFace}.desc`) }));
      case 'upgrade':
        return this.setInfo(
          t('info.upgrade', { tile: tileName(here), stars: stars(here.stars + 1), now: tileEffectText(content, here), after: tileEffectText(content, here, here.stars + 1) }),
        );
      case 'decide': {
        const roll = state.turnState.roll ?? 0;
        const landing = state.position + roll;
        const index = landing % state.board.length;
        const target = state.board[index];
        if (!target) return;
        // Hidden while the die is still tumbling; shown again once input is back.
        this.board.setTarget(this.busy ? null : index);
        return this.setInfo(
          t(landing >= state.board.length ? 'info.target_gate' : 'info.target', { roll, tile: tileName(target), stars: stars(target.stars), effect: tileEffectText(content, target) }),
        );
      }
    }
  }
}

