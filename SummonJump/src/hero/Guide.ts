import Phaser from 'phaser';
import { questRoom, type GuideRoom, autoSkills, autoStats, equip, isUpgrade, addItem, advanceQuest, currentQuest, itemDef, newUnlocks, questBase, questProgress, type QuestFacts, type QuestState } from '@shared/index';
import type { HeroSession } from './HeroSession';
import type { SaveData } from '../save/local';
import { t } from '../i18n';
import { UpgradePrompt } from '../ui/UpgradePrompt';

/**
 * New-player guide: the current main quest under the HUD ("🎯 ปราบโพริ่ง 3/5"), auto-claimed with a toast when done,
 * and a "🔓 unlocked" toast when a level-up opens a feature. Tap the line to read the full hint.
 */
export class Guide {
  private readonly text: Phaser.GameObjects.Text;
  /** "🧭 พาไป": warp to where the current quest happens */
  private readonly go: Phaser.GameObjects.Text;
  private dest: string | null = null;
  private shown = '';
  private tick = 0;
  private lastLv: number;
  /** bag items already looked at for the better-gear prompt */
  private seenItems: Set<number>;
  private readonly upg = UpgradePrompt.get();

  constructor(scene: Phaser.Scene, private readonly session: HeroSession, private readonly save: SaveData,
    private readonly toast: (m: string) => void, private readonly flush: () => void, openHint: (text: string) => void, private readonly onEquip: () => void = () => {},
    private readonly here: () => string = () => '', travel: (room: string) => void = () => {}) {
    this.lastLv = session.data.baseLv;
    this.seenItems = new Set(session.data.bag.map((it) => it.uid));
    this.text = scene.add.text(16, 136, '', { fontFamily: 'Itim', fontSize: '15px', color: '#ffe9b0', stroke: '#2a1a0a', strokeThickness: 4, wordWrap: { width: 300 }, backgroundColor: 'rgba(20, 12, 4, 0.55)', padding: { x: 6, y: 2 } })
      .setScrollFactor(0).setDepth(101).setInteractive({ useHandCursor: true });
    this.go = scene.add.text(0, 136, t('quest.go'), { fontFamily: 'Itim', fontSize: '15px', color: '#2a1a00', backgroundColor: '#e8b85a', padding: { x: 8, y: 3 } })
      .setScrollFactor(0).setDepth(101).setVisible(false).setInteractive({ useHandCursor: true });
    this.go.on('pointerup', () => { if (this.dest) travel(this.dest); });
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
    this.autoGrow();
    this.checkUpgrades();
    const done = advanceQuest(c, this.state, f);
    if (done) {
      const got: string[] = [];
      for (const [id, n] of Object.entries(done.reward)) {
        if (id === 'soul') { this.save.soul += n; got.push(`${n}${t('hud.soul')}`); } else if (addItem(s.data, c, id, n)) got.push(`${t(itemDef(c, id)?.name_key ?? id)} ×${n}`);
      }
      this.toast(t('quest.done').replace('{name}', t(done.text_key)).replace('{got}', got.join(', ')));
      s.emit(); this.flush();
    }
    const q = currentQuest(c, this.state);
    const line = q ? (() => { const p = questProgress(q, this.state, f); return `🎯 ${t(q.text_key)}${p.need > 1 ? ` ${p.have}/${p.need}` : ''}`; })() : t('quest.all');
    if (line !== this.shown) { this.shown = line; this.text.setText(line); }
    this.dest = q ? questRoom(c, q, this.rooms(), s.data.baseLv) : null;
    this.go.setVisible(!!this.dest && this.dest !== this.here()).setX(this.text.x + this.text.width + 8);
  }

  /** Auto growth (status tab switch): spend new stat / skill points by the job plan. */
  private autoGrow(): void {
    const h = this.session.data, c = this.session.content;
    if (!this.save.autoGrow || (h.statPoints <= 0 && h.skillPoints <= 0)) return;
    if (autoStats(h, c) + autoSkills(h, c) > 0) { this.session.recompute(); this.session.emit(); this.flush(); this.toast(t('auto.grown')); }
  }

  /** A new bag item that beats what the hero wears → offer it. */
  private checkUpgrades(): void {
    const h = this.session.data, c = this.session.content;
    for (const it of h.bag) {
      if (this.seenItems.has(it.uid)) continue;
      this.seenItems.add(it.uid);
      if (!isUpgrade(h, c, it.uid)) continue;
      const d = itemDef(c, it.id);
      this.upg.show(t(d?.name_key ?? it.id), d?.icon ?? '', () => {
        if (equip(h, c, it.uid)) { this.session.recompute(); this.session.emit(); this.flush(); this.onEquip(); }
      });
    }
  }

  private roomList: GuideRoom[] | null = null;
  /** world rooms with their monsters (from the LDtk levels in the registry), arena / test rooms left out */
  private rooms(): GuideRoom[] {
    if (this.roomList) return this.roomList;
    const levels = this.text.scene.registry.get('levels') as Map<string, { id: string; test?: boolean; entities: { type: string; fields: Record<string, unknown> }[] }> | undefined;
    this.roomList = [...(levels?.values() ?? [])].filter((l) => !l.test && l.id !== 'arena')
      .map((l) => ({ id: l.id, monsters: l.entities.filter((e) => e.type === 'Monster').map((e) => String(e.fields.monster)) }));
    return this.roomList;
  }
}
