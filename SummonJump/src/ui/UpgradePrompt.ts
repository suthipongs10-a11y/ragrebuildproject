import { ART } from '../assets/manifest.generated';
import { t } from '../i18n';

/** "Better gear!" chip at the bottom of the screen: tap ✓ to wear it, ✕ or wait to dismiss. */
export class UpgradePrompt {
  private static one: UpgradePrompt | null = null;
  /** one DOM chip for the whole game (rooms come and go) */
  static get(): UpgradePrompt { return (UpgradePrompt.one ??= new UpgradePrompt()); }
  private readonly el: HTMLDivElement;
  private timer = 0;

  private constructor() {
    this.el = document.createElement('div');
    this.el.className = 'upg';
    this.el.hidden = true;
    document.getElementById('stage')?.appendChild(this.el);
    for (const ev of ['pointerdown', 'touchstart']) this.el.addEventListener(ev, (e) => e.stopPropagation());
  }

  show(name: string, icon: string, wear: () => void): void {
    const a = ART[icon];
    this.el.innerHTML = `${a ? `<span class="upg-ic" style="background-image:url(${a.url})"></span>` : ''}<span class="upg-tx"><b>${t('auto.upgrade')}</b> ${name}</span>
      <button class="upg-go">${t('auto.wear')}</button><button class="upg-x" aria-label="close">✕</button>`;
    this.el.hidden = false;
    this.el.querySelector<HTMLButtonElement>('.upg-go')!.onclick = () => { wear(); this.hide(); };
    this.el.querySelector<HTMLButtonElement>('.upg-x')!.onclick = () => this.hide();
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.hide(), 9000);
  }

  hide(): void { this.el.hidden = true; }
}
