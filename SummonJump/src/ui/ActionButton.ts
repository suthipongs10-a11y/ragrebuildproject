/** Big contextual button above the touch pad ("💬 คุย", "▼ ลงท่อ", "🔥 ทุบหิน"); hidden when there is nothing to do. */
export class ActionButton {
  private readonly el = document.getElementById('b_act') as HTMLButtonElement | null;
  private label: string | null = null;
  private queued = false;

  constructor() {
    this.el?.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); this.queued = true; });
  }

  show(label: string | null): void {
    if (label === this.label || !this.el) return;
    this.label = label;
    this.el.hidden = !label;
    if (label) this.el.textContent = label;
    if (!label) this.queued = false;
  }

  /** True once per tap. */
  take(): boolean { const q = this.queued; this.queued = false; return q; }
}
