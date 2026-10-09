import './menu.css';
import {
  addItem, changeJob, createRng, equip, instance, itemDef, learnSkill, raiseStat, refineCost, rollRefine, setSlot, socketCard, unequip, useItem, EQUIP_SLOTS,
  type EquipSlot, type JobId, type StatKey,
} from '@shared/index';
import { ART } from '../../assets/manifest.generated';
import { t } from '../../i18n';
import type { HeroSession } from '../../hero/HeroSession';
import type { SaveData } from '../../save/local';
import { bagTab, cardsTab, equipTab, jobTab, refineTab, shopTab, skillsTab, statusTab } from './tabs';
import { bookTab, newSpiritMenuState, spiritsTab, summonTab } from './spiritTabs';
import { spiritAct } from './spiritActions';
import './spirits.css';

export type MenuTab = 'status' | 'skills' | 'equip' | 'bag' | 'cards' | 'spirits' | 'book' | 'job' | 'refine' | 'shop' | 'summon';
const MAIN_TABS: MenuTab[] = ['status', 'skills', 'equip', 'bag', 'cards', 'spirits', 'book', 'summon'];

export interface MenuHost {
  session: HeroSession; save: SaveData;
  pause(): void; resume(): void; flush(): void;
  /** potion effects and job change need the live scene (HP bar, rig) */
  applyUse(effect: Record<string, number>): void; onJobChanged(): void; onEquipChanged(): void; onSpiritsChanged(): void;
}

/** One DOM overlay for every hero menu. Opened by ☰ / M / Esc or by NPCs (job, refine, shop). */
export class Menu {
  private readonly root = document.getElementById('menu') as HTMLDivElement;
  private host: MenuHost | null = null;
  private tab: MenuTab = 'status';
  private note = '';
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
    addEventListener('keydown', (e) => { if (this.isOpen && (e.code === 'Escape' || e.code === 'KeyM')) { e.stopPropagation(); this.close(); } }, true);
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
    this.tab = tab ?? (MAIN_TABS.includes(this.tab) ? this.tab : 'status'); this.note = '';
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
    const tabs = (MAIN_TABS.includes(this.tab) ? MAIN_TABS : [...MAIN_TABS, this.tab]).map((x) => `<button class="mn-tab${x === this.tab ? ' on' : ''}" data-act="tab:${x}">${t(`tab.${x}`)}</button>`).join('');
    const body = { status: () => statusTab(h.session), skills: () => skillsTab(h.session), equip: () => equipTab(h.session, h.save), cards: () => cardsTab(h.session, h.save),
      job: () => jobTab(h.session), refine: () => refineTab(h.session, h.save), shop: () => shopTab(h.session, h.save),
      spirits: () => spiritsTab(h.session, h.save, this.sp), summon: () => summonTab(h.session, this.sp),
      bag: () => bagTab(h.session, h.save), book: () => bookTab(h.session, this.sp) }[this.tab]();
    const scroll = this.root.querySelector('.mn-body')?.scrollTop ?? 0;
    this.root.innerHTML = `<div class="mn"><div class="mn-top"><div class="mn-tabs">${tabs}</div><button class="mn-x" data-act="close" aria-label="close">✕</button></div>
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
      case 'tab': this.tab = x as MenuTab; this.note = ''; this.sp.results = []; changed = false; this.root.querySelector('.mn-body')?.scrollTo(0, 0); break;
      case 'stat': raiseStat(d, x as StatKey); break;
      case 'learn': learnSkill(d, c, x); break;
      case 'slot': setSlot(d, c, Number(x), y); break;
      case 'equip': equip(d, c, Number(x)); break;
      case 'unequip': unequip(d, x as EquipSlot); break;
      case 'socket': if (socketCard(d, c, Number(x), y, h.save.cards)) this.note = t('menu.socketed'); break;
      case 'use': { const fx = useItem(d, c, Number(x)); if (fx) h.applyUse(fx); break; }
      case 'job': if (changeJob(d, c, x as JobId)) { this.note = t('menu.jobChanged').replace('{job}', t(`job.${x}`)); h.onJobChanged(); this.tab = 'skills'; } break;
      case 'buy': { const it = itemDef(c, x); if (it && h.save.zeny >= it.price && addItem(d, c, x, 1)) { h.save.zeny -= it.price; this.note = t('combat.got').replace('{name}', t(it.name_key)); } break; }
      case 'sell': { const it = instance(d, Number(x)); if (it) { const def = itemDef(c, it.id); h.save.zeny += Math.floor((def?.price ?? 0) / 2) * it.count; d.bag.splice(d.bag.indexOf(it), 1); } break; }
      case 'refine': this.refine(Number(x)); break;
      default: changed = false;
    }
    if (changed) { s.recompute(); h.flush(); h.onEquipChanged(); }
    this.render();
  }

  private refine(uid: number): void {
    const h = this.host as MenuHost, d = h.session.data, it = instance(d, uid);
    if (!it) return;
    const cost = refineCost(it.refine);
    if (h.save.zeny < cost) return;
    h.save.zeny -= cost;
    const r = rollRefine(it.refine, this.rng);
    it.refine = r.level;
    if (r.outcome === 'break') {
      for (const slot of EQUIP_SLOTS) if (d.equip[slot] === uid) unequip(d, slot);
      d.bag.splice(d.bag.indexOf(it), 1);
    }
    this.note = t(`refine.${r.outcome}`).replace('{n}', String(r.level));
  }
}
