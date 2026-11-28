import { Container, Graphics } from 'pixi.js';
import { t } from '../app/i18n';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../app/viewport';
import type { Content } from '../data/content';
import { applyAction, legalActions } from '../sim/apply';
import { upgradeCost } from '../sim/board';
import { createRun } from '../sim/run';
import type { Action, GameEvent, RunState } from '../sim/types';
import { TUNING } from './anim/tuning';
import { Tweener } from './anim/tween';
import type { GameAssets } from './assets';
import { stars, tileEffectText, tileName } from './describe';
import { EventPlayer } from './EventPlayer';
import { LAYOUT } from './layout';
import { COLOR } from './theme';
import { Button } from './ui/widgets';
import { BattleView } from './views/BattleView';
import { BoardView } from './views/BoardView';
import { ControlsView } from './views/ControlsView';
import { HudView } from './views/HudView';

/** Art used by Act 1. Later acts swap these per lap (M5). */
export const ACT1_IMAGES = { board: 'board_act1_desert', backdrop: 'bg_act1_desert' } as const;
const PAWN = 'pawn_captain';
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
  private readonly player: EventPlayer;
  private readonly restart: Button;
  private readonly speedButton: Button;
  private state!: RunState;
  private busy = false;
  private speedIndex = 0;

  constructor(
    private readonly content: Content,
    assets: GameAssets,
    private readonly newSeed: () => number,
  ) {
    super();
    this.addChild(new Graphics().rect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT).fill(COLOR.background));
    this.board = new BoardView(content, assets, this.tweener, ACT1_IMAGES.board, PAWN);
    this.board.position.set(LAYOUT.board.x, LAYOUT.board.y);
    this.battle = new BattleView(content, assets, this.tweener, ACT1_IMAGES.backdrop);
    this.battle.position.set(LAYOUT.battle.x, LAYOUT.battle.y);
    this.hud = new HudView(content, assets, this.tweener);
    this.controls = new ControlsView(assets, (action) => void this.dispatch(action));
    this.controls.position.set(LAYOUT.controls.x, LAYOUT.controls.y);
    this.player = new EventPlayer(content, this.tweener, this.board, this.battle, this.hud);

    this.speedButton = new Button(assets.frame('btn_green'), assets.frame('btn_green_pressed'), SPEED_WIDTH, SPEED_HEIGHT, '', () => this.cycleSpeed());
    this.speedButton.position.set(LAYOUT.status.x + LAYOUT.status.width - SPEED_WIDTH - LAYOUT.panelPad, LAYOUT.status.y + LAYOUT.panelPad / 2);
    this.restart = new Button(assets.frame('btn_gold'), assets.frame('btn_gold_pressed'), RESTART_WIDTH, LAYOUT.controls.buttonHeight, t('ui.new_run'), () => void this.startRun());
    this.restart.position.set((DESIGN_WIDTH - RESTART_WIDTH) / 2, LAYOUT.banner.y + 200);
    this.restart.visible = false;
    this.addChild(this.battle, this.board, this.controls, this.hud, this.speedButton, this.restart);
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

  async startRun(): Promise<void> {
    if (this.busy) return;
    this.restart.visible = false;
    this.hud.hideResult();
    const { state, events } = createRun(this.content, this.newSeed());
    await this.present(state, events);
  }

  /** Keyboard: Space/Enter = gold button, R/Esc = purple button, 1-6 = force die, F = speed. */
  handleKey(key: string): void {
    if (key === 'f' || key === 'F') return this.cycleSpeed();
    // Nothing may start while the last action is still playing out (it would overlap two runs).
    if (this.busy) return;
    if (this.state?.phase === 'ended') {
      if (key === ' ' || key === 'Enter') void this.startRun();
      return;
    }
    if (key === ' ' || key === 'Enter') return void this.tryAction(this.controls.primaryChoice);
    if (key === 'r' || key === 'R' || key === 'Escape') return void this.tryAction(this.controls.secondaryChoice);
    const face = Number(key);
    if (Number.isInteger(face) && face >= 1) void this.tryAction({ type: 'forceDie', face });
  }

  private tryAction(action: Action | null): Promise<void> {
    if (!action) return Promise.resolve();
    const legal = legalActions(this.content, this.state).some((a) => JSON.stringify(a) === JSON.stringify(action));
    return legal ? this.dispatch(action) : Promise.resolve();
  }

  private async dispatch(action: Action): Promise<void> {
    if (this.busy) return;
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
    if (state.phase === 'ended') {
      this.hud.showResult(state.result === 'won' ? 'banner_victory' : 'banner_defeat');
      this.restart.visible = true;
    }
  }

  private refreshControls(): void {
    const { state, content } = this;
    const here = state.board[state.position];
    this.controls.sync({
      actions: state.phase === 'ended' ? [] : legalActions(content, state),
      rerollsLeft: state.rerollsLeft,
      forceDice: state.forceDice,
      upgradeCost: state.phase === 'upgrade' ? upgradeCost(content, state) : null,
      busy: this.busy,
    });
    if (!here) return;
    if (state.phase === 'ended') {
      this.controls.setInfo(t(state.result === 'won' ? 'info.won' : 'info.lost'));
      this.board.setTarget(null);
    } else if (state.phase === 'roll') {
      this.controls.setInfo(t('info.roll', { tile: tileName(here) }));
      this.board.setTarget(null);
    } else if (state.phase === 'decide' && state.turnState.roll !== null) {
      const landing = state.position + state.turnState.roll;
      const index = landing % state.board.length;
      const target = state.board[index];
      if (target) {
        this.controls.setInfo(
          t(landing >= state.board.length ? 'info.target_gate' : 'info.target', {
            roll: state.turnState.roll,
            tile: tileName(target),
            stars: stars(target.stars),
            effect: tileEffectText(content, target),
          }),
        );
      }
      // Hidden while the die is still tumbling; shown again once input is back.
      this.board.setTarget(this.busy ? null : index);
    } else if (state.phase === 'upgrade') {
      this.controls.setInfo(
        t('info.upgrade', { tile: tileName(here), stars: stars(here.stars + 1), now: tileEffectText(content, here), after: tileEffectText(content, here, here.stars + 1) }),
      );
    }
  }
}
