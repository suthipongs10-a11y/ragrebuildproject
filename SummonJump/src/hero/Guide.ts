import Phaser from 'phaser';
import { addItem, advanceQuest, currentQuest, itemDef, newUnlocks, questBase, questProgress, type QuestFacts, type QuestState } from '@shared/index';
import type { HeroSession } from './HeroSession';
import type { SaveData } from '../save/local';
import { t } from '../i18n';

/**
 * New-player guide: the current main quest under the HUD ("🎯 ปราบโพริ่ง 3/5"), auto-claimed with a toast when done,
 * and a "🔓 unlocked" toast when a level-up opens a feature. Tap the line to read the full hint.
 */
export class Guide {
  private readonly text: Phaser.GameObjects.Text;
  private shown = '';
  private tick = 0;
  private lastLv: number;

  constructor(scene: Phaser.Scene, private readonly session: HeroSession, private readonly save: SaveData,
    private readonly toast: (m: string) => void, private readonly flush: () => void, openHint: (text: string) => void) {
    this.lastLv = session.data.baseLv;
    this.text = scene.add.text(16, 136, '', { fontFamily: 'Itim', fontSize: '15px', color: '#ffe9b0', stroke: '#2a1a0a', strokeThickness: 4, wordWrap: { width: 300 }, backgroundColor: 'rgba(20, 12, 4, 0.55)', padding: { x: 6, y: 2 } })
      .setScrollFactor(0).setDepth(101).setInteractive({ useHandCursor: true });
    this.text.on('pointerup', () => { const q = currentQuest(session.content, this.state); if (q) openHint(t(`${q.text_key}.hint`)); });
    if (!save.quest) { save.quest = { i: 0, base: 0 }; const q = currentQuest(session.content, save.quest); if (q) save.quest.base = questBase(q, this.facts()); }
  }

  private get state(): QuestState { return this.save.quest as QuestState; }

  private facts(): QuestFacts {
    const s = this.session;
    return { kills: s.book.kills, level: s.data.baseLv, spirits: s.box.spirits.length, seen: this.save.seen, job: s.data.job, tower: s.arena.tower };
  }

  update(dt: number): void {
    this.tick -= dt;
    if (this.tick > 0) return;
    this.tick = 0.5;
    const s = this.session, c = s.content, f = this.facts();
    // level-ups that open a feature
    if (s.data.baseLv > this.lastLv) {
      for (const u of newUnlocks(c, this.lastLv, s.data.baseLv)) this.toast(t('lock.opened').replace('{name}', t(u.name_key)));
      this.lastLv = s.data.baseLv;
    }
    const done = advanceQuest(c, this.state, f);
    if (done) {
      const got: string[] = [];
      for (const [id, n] of Object.entries(done.reward)) {
        if (id === 'zeny') { this.save.zeny += n; got.push(`${n}z`); } else if (addItem(s.data, c, id, n)) got.push(`${t(itemDef(c, id)?.name_key ?? id)} ×${n}`);
      }
      this.toast(t('quest.done').replace('{name}', t(done.text_key)).replace('{got}', got.join(', ')));
      s.emit(); this.flush();
    }
    const q = currentQuest(c, this.state);
    const line = q ? (() => { const p = questProgress(q, this.state, f); return `🎯 ${t(q.text_key)}${p.need > 1 ? ` ${p.have}/${p.need}` : ''}`; })() : t('quest.all');
    if (line !== this.shown) { this.shown = line; this.text.setText(line); }
  }
}
