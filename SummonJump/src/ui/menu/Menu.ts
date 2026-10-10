import './menu.css';
import {
  addItem, changeJob, claimBook, createRng, equip, instance, itemDef, learnSkill, raiseStat, refineCost, rollRefine, setSlot, socketCard, unequip, useItem, EQUIP_SLOTS,
  type ArenaRun, type ArenaState, type EquipSlot, type JobId, type StatKey,
} from '@shared/index';
import { ART } from '../../assets/manifest.generated';
import { t } from '../../i18n';
import type { HeroSession } from '../../hero/HeroSession';
import type { SaveData } from '../../save/local';
import { jobTab } from './jobTab';
import { bagTab, cardsTab, equipTab, refineTab, shopTab, skillsTab, statusTab } from './tabs';
import { bookTab, newSpiritMenuState, spiritsTab, summonTab } from './spiritTabs';
import { spiritAct } from './spiritActions';
import './spirits.css';
import { adventureTab } from './adventureTab';
import { arenaTab } from './arenaTab';
import { lockedBody, lockMsg } from './lock';

export type MenuTab = 'status' | 'skills' | 'equip' | 'bag' | 'cards' | 'spirits' | 'book' | 'adventure' | 'arena' | 'job' | 'refine' | 'shop' | 'summon';
/** PC shortcuts: open (or close) a menu tab straight from the game. */
const HOTKEYS: Record<string, MenuTab> = { KeyI: 'bag', KeyE: 'equip', KeyU: 'status', KeyY: 'skills', KeyP: 'spirits' };
const KEY_OF = Object.fromEntries(Object.entries(HOTKEYS).map(([k, tab]) => [tab, k.slice(3)])) as Partial<Record<MenuTab, string>>;
const MAIN_TABS: MenuTab[] = ['status', 'skills', 'equip', 'bag', 'cards', 'spirits', 'book', 'summon', 'adventure'];

export interface MenuHost {
  session: HeroSession; save: SaveData;
  pause(): void; resume(): void; flush(): void;
  /** potion effects and job change need the live scene (HP bar, rig) */
  applyUse(effect: Record<string, number>): void; onJobChanged(): void; onEquipChanged(): void; onSpiritsChanged(): void;
  arena(): ArenaState; enterArena(run: ArenaRun): string | null;
  /** live HP / SP (shown in the menu, potions check them) */
  vitals(): { hp: number; maxHp: number; sp: number; maxSp: number };
}

/** One DOM overlay for every hero menu. Opened by ☰ / M / Esc or by NPCs (job, refine, shop). */
export class Menu {
  private readonly root = document.getElementById('menu') as HTMLDivElement;
  private host: MenuHost | null = null;
  private tab: MenuTab = 'status';
  private note = '';
  /** job picked on the job screen, waiting for "are you sure?" */
  private jobAsk = '';
  private readonly rng = createRng(Date.now() & 0xffffff);
  private unsub: (() => void) | null = null;
  private readonly sp = newSpiritMenuState();
  private lastAnim = 0;

  constructor() {
    this.root.addEventListener('click', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
      if (el && !(el as HTMLButtonElement).disabled) this.act(el.dataset.act as string);
    });
    // keep taps on the menu from reaching the game
    for (const ev of ['pointerdown', 'touchstart']) this.root.addEventListener(ev, (e) => e.stopPropagation());
    addEventListener('keydown', (e) => {
      if (this.isOpen && (e.code === 'Escape' || e.code === 'KeyM')) { e.stopPropagation(); this.close(); return; }
      const tab = HOTKEYS[e.code];
      if (!tab || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      e.stopPropagation();
      if (this.isOpen && this.tab === tab) this.close(); else if (this.isOpen) { this.tab = tab; this.note = ''; this.jobAsk = ''; this.render(); } else this.open(tab);
    }, true);
    // PC: double-click an item row in the bag / equipment to use or equip it
    this.root.addEventListener('dblclick', (e) => {
      if (this.tab !== 'bag' && this.tab !== 'equip') return;
      const btn = (e.target as HTMLElement).closest('.mn-row')?.querySelector<HTMLButtonElement>('button[data-act]:not([disabled])');
      if (btn && !(e.target as HTMLElement).closest('button')) this.act(btn.dataset.act as string);
    });
  }

  get isOpen(): boolean { return !this.root.hidden; }

  attach(host: MenuHost): void {
    this.host = host;
    this.unsub?.();
    this.unsub = host.session.onChange(() => { if (this.isOpen) this.render(); });
  }

  /** ☰ / M reopen the last main tab; NPCs (job, refine, shop) and the altar pass their own tab. */
  open(tab?: MenuTab): void {
    if (!this.host) return;
    this.tab = tab ?? (MAIN_TABS.includes(this.tab) ? this.tab : 'status'); this.note = ''; this.jobAsk = '';
    this.root.hidden = false;
    this.host.pause();
    this.render();
  }

  close(): void {
    if (!this.isOpen) return;
    this.root.hidden = true;
    this.host?.flush();
    this.host?.resume();
  }

  private render(): void {
    const h = this.host; if (!h) return;
    const tabs = (MAIN_TABS.includes(this.tab) ? MAIN_TABS : [...MAIN_TABS, this.tab]).map((x) => `<button class="mn-tab${x === this.tab ? ' on' : ''}" data-act="tab:${x}">${t(`tab.${x}`)}${KEY_OF[x] ? `<kbd>${KEY_OF[x]}</kbd>` : ''}${(x === 'summon' || x === 'adventure') && lockMsg(h.session, x) ? '🔒' : ''}</button>`).join('');
    const bodies = { status: () => statusTab(h.session), skills: () => skillsTab(h.session), equip: () => equipTab(h.session, h.save), cards: () => cardsTab(h.session, h.save),
      job: () => jobTab(h.session, this.jobAsk), refine: () => refineTab(h.session, h.save), shop: () => shopTab(h.session, h.save),
      spirits: () => spiritsTab(h.session, h.save, this.sp), summon: () => summonTab(h.session, this.sp),
      bag: () => bagTab(h.session, h.save), book: () => bookTab(h.session, this.sp), adventure: () => adventureTab(h.session, h.save), arena: () => arenaTab(h.session, h.arena()) };
    const lock = this.tab === 'summon' || this.tab === 'adventure' ? lockMsg(h.session, this.tab) : null;
    const body = lock ? lockedBody(lock) : bodies[this.tab]();
    const scroll = this.root.querySelector('.mn-body')?.scrollTop ?? 0;
    const v = h.vitals(), pct = (a: number, b: number) => Math.round((100 * Math.max(0, a)) / Math.max(1, b));
    const vit = `<div class="mn-vit"><span>HP ${Math.ceil(v.hp)}/${v.maxHp}<i><b class="hp" style="width:${pct(v.hp, v.maxHp)}%"></b></i></span><span>SP ${Math.floor(v.sp)}/${v.maxSp}<i><b class="sp" style="width:${pct(v.sp, v.maxSp)}%"></b></i></span><span>${h.save.soul}${t('hud.soul')}</span></div>`;
    this.root.innerHTML = `<div class="mn"><div class="mn-top"><div class="mn-tabs">${tabs}</div><button class="mn-x" data-act="close" aria-label="close">✕</button></div>${vit}
      ${this.note ? `<div class="mn-note" style="color:#ffd88a">${this.note}</div>` : ''}<div class="mn-body">${body}</div></div>`;
    const panel = this.root.querySelector<HTMLElement>('.mn');
    const art = ART.ui_panel_main;
    if (panel && art) panel.style.borderImageSource = `url(${art.url})`;
    const b = this.root.querySelector('.mn-body'); if (b) b.scrollTop = scroll;
    // the summon reveal animation plays once per summon, not on every re-render
    if (this.sp.anim === this.lastAnim) this.root.querySelector('.sm-res')?.classList.add('still');
    this.lastAnim = this.sp.anim;
  }

  private act(a: string): void {
    const h = this.host; if (!h) return;
    const [verb, x = '', y = ''] = a.split(':');
    const s = h.session, d = s.data, c = s.content;
    const sn = spiritAct(verb ?? '', x, y, this.sp, h, this.rng);
    if (sn !== null) {
      if (sn) this.note = sn;
      if (verb === 'spsel' || verb === 'spmode' || verb === 'sum' || verb === 'book') this.root.querySelector('.mn-body')?.scrollTo(0, 0); // new view starts at the top
      this.render(); return;
    }
    let changed = true;
    switch (verb) {
      case 'close': this.close(); return;
      case 'tab': this.tab = x as MenuTab; this.note = ''; this.jobAsk = ''; this.sp.results = []; changed = false; this.root.querySelector('.mn-body')?.scrollTo(0, 0); break;
      case 'stat': raiseStat(d, x as StatKey); break;
      case 'learn': learnSkill(d, c, x); break;
      case 'slot': setSlot(d, c, Number(x), y); break;
      case 'equip': equip(d, c, Number(x)); break;
      case 'unequip': unequip(d, x as EquipSlot); break;
      case 'socket': if (socketCard(d, c, Number(x), y, h.save.cards)) this.note = t('menu.socketed'); break;
      case 'use': {
        // don't waste a potion on a full bar
        const v = h.vitals(), use = itemDef(c, instance(d, Number(x))?.id ?? '')?.use ?? {};
        const hpOnly = (use.heal ?? 0) > 0 && !(use.sp ?? 0), spOnly = (use.sp ?? 0) > 0 && !(use.heal ?? 0);
        if ((hpOnly && v.hp >= v.maxHp) || (spOnly && v.sp >= v.maxSp)) { this.note = t(hpOnly ? 'menu.hpFull' : 'menu.spFull'); changed = false; break; }
        const fx = useItem(d, c, Number(x)); if (fx) h.applyUse(fx); break;
      }
      case 'jobask': this.jobAsk = x; changed = false; break;
      case 'jobno': this.jobAsk = ''; changed = false; break;
      case 'job': this.jobAsk = ''; if (changeJob(d, c, x as JobId)) { this.note = t('menu.jobChanged').replace('{job}', t(`job.${x}`)); h.onJobChanged(); this.tab = 'skills'; } break;
      case 'buy': { const it = itemDef(c, x); if (it && h.save.soul >= it.price && addItem(d, c, x, 1)) { h.save.soul -= it.price; this.note = t('combat.got').replace('{name}', t(it.name_key)); } break; }
      case 'sell': { const it = instance(d, Number(x)); if (it) { const def = itemDef(c, it.id); h.save.soul += Math.floor((def?.price ?? 0) / 2) * it.count; d.bag.splice(d.bag.indexOf(it), 1); } break; }
      case 'refine': this.refine(Number(x)); break;
      case 'arena': {
        const run: ArenaRun = x === 'tower' ? { mode: 'tower', floor: Number(y) } : { mode: 'dungeon', day: new Date().getDay(), heroLv: d.baseLv };
        const why = lockMsg(s, run.mode) ?? h.enterArena(run);
        if (why) this.note = why; else { this.close(); return; }
        changed = false; break;
      }
      case 'bookclaim': if (claimBook(c, s.book, x, h.save.seen)) { const n = c.book.find((e) => e.id === x)?.soul ?? 0; h.save.soul += n; this.note = `${t('adv.claimed')}${n ? ` +${n}${t('hud.soul')}` : ''}`; } break;
      default: changed = false;
    }
    if (changed) { s.recompute(); h.flush(); h.onEquipChanged(); }
    this.render();
  }

  private refine(uid: number): void {
    const h = this.host as MenuHost, d = h.session.data, it = instance(d, uid);
    if (!it) return;
    const cost = refineCost(it.refine);
    if (h.save.soul < cost) return;
    h.save.soul -= cost;
    const r = rollRefine(it.refine, this.rng);
    it.refine = r.level;
    if (r.outcome === 'break') {
      for (const slot of EQUIP_SLOTS) if (d.equip[slot] === uid) unequip(d, slot);
      d.bag.splice(d.bag.indexOf(it), 1);
    }
    this.note = t(`refine.${r.outcome}`).replace('{n}', String(r.level));
  }
}
