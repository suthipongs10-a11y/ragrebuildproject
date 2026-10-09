import Phaser from 'phaser';

/** Bottom dialog box (sign / NPC text). Tap anywhere or press a button to advance. */
export class DialogBox {
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly body: Phaser.GameObjects.Text;
  private readonly hint: Phaser.GameObjects.Text;
  private pages: string[] = [];
  private idx = 0;
  private openedAt = 0;

  constructor(private readonly scene: Phaser.Scene) {
    const { width: w, height: h } = scene.scale;
    const bw = Math.min(w - 40, 760), bh = 120, x = (w - bw) / 2, y = h - bh - 18;
    this.bg = scene.add.graphics().setScrollFactor(0).setDepth(300).setVisible(false);
    this.bg.fillStyle(0x2a1d12, 0.92).fillRoundedRect(x, y, bw, bh, 14).lineStyle(3, 0xc99a4a, 1).strokeRoundedRect(x, y, bw, bh, 14);
    const font = { fontFamily: 'Itim', color: '#fff6e2' };
    this.title = scene.add.text(x + 20, y + 10, '', { ...font, fontSize: '22px', color: '#ffd88a' }).setScrollFactor(0).setDepth(301).setVisible(false);
    this.body = scene.add.text(x + 20, y + 40, '', { ...font, fontSize: '22px', wordWrap: { width: bw - 40 } }).setScrollFactor(0).setDepth(301).setVisible(false);
    this.hint = scene.add.text(x + bw - 20, y + bh - 12, '▼', { ...font, fontSize: '20px' }).setOrigin(1, 1).setScrollFactor(0).setDepth(301).setVisible(false);
    scene.input.on('pointerdown', () => { if (this.isOpen && scene.time.now - this.openedAt > 150) this.next(); });
  }

  get isOpen(): boolean { return this.bg.visible; }

  open(title: string, pages: string[]): void {
    this.pages = pages; this.idx = 0; this.openedAt = this.scene.time.now;
    this.title.setText(title);
    for (const o of [this.bg, this.title, this.body, this.hint]) o.setVisible(true);
    this.show();
  }

  next(): void {
    if (this.scene.time.now - this.openedAt < 150) return;
    this.idx++;
    if (this.idx >= this.pages.length) this.close(); else this.show();
  }

  close(): void { for (const o of [this.bg, this.title, this.body, this.hint]) o.setVisible(false); }

  private show(): void {
    this.body.setText(this.pages[this.idx] ?? '');
    this.hint.setText(this.idx < this.pages.length - 1 ? '▼' : '✓');
  }
}
