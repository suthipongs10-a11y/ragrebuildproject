/** Unified input: keyboard + on-screen joystick/buttons. Read `state`, edge-detect with `pressed()`. */
export type InputKey = 'left' | 'right' | 'up' | 'down' | 'jump' | 'atk' | 'sk1' | 'sk2' | 'sk3' | 'ult' | 'menu';

const KEYMAP: Record<string, InputKey> = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
  Space: 'jump', KeyZ: 'jump', KeyX: 'atk', KeyJ: 'atk', KeyC: 'sk1', KeyK: 'sk1', KeyV: 'sk2', KeyL: 'sk2', KeyB: 'sk3',
  KeyF: 'ult', KeyM: 'menu', Escape: 'menu',
};

export class Controls {
  readonly state: Record<InputKey, boolean> = { left: false, right: false, up: false, down: false, jump: false, atk: false, sk1: false, sk2: false, sk3: false, ult: false, menu: false };
  private prev: Record<InputKey, boolean> = { ...this.state };
  /** presses that started and ended between two frames still count as one press */
  private latched = new Set<InputKey>();

  constructor() {
    // ↑ / W also jump (most players expect it); Phase 1 gives "interact" priority when standing at an object
    addEventListener('keydown', (e) => { const k = KEYMAP[e.code]; if (k) { this.press(k); if (k === 'up') this.press('jump'); e.preventDefault(); } });
    addEventListener('keyup', (e) => { const k = KEYMAP[e.code]; if (k) { this.state[k] = false; if (k === 'up') this.state.jump = false; } });
    addEventListener('blur', () => { for (const k of Object.keys(this.state) as InputKey[]) this.state[k] = false; });
    this.bindButtons();
    this.bindJoystick();
  }

  private press(k: InputKey): void { if (!this.state[k]) this.latched.add(k); this.state[k] = true; }

  /** Forget everything held (after a menu closed or the page lost focus). */
  reset(): void { for (const k of Object.keys(this.state) as InputKey[]) this.state[k] = false; this.prev = { ...this.state }; this.latched.clear(); }

  pressed(k: InputKey): boolean { return this.latched.has(k) || (this.state[k] && !this.prev[k]); }
  /** Call once at the end of every game step. */
  endFrame(): void { this.prev = { ...this.state }; this.latched.clear(); }

  private bindButtons(): void {
    document.querySelectorAll<HTMLButtonElement>('.pb[data-k]').forEach((b) => {
      const k = b.dataset.k as InputKey;
      const on = (e: PointerEvent) => { e.preventDefault(); this.press(k); b.classList.add('held'); try { b.setPointerCapture(e.pointerId); } catch { /* ignore */ } };
      const off = () => { this.state[k] = false; b.classList.remove('held'); };
      b.addEventListener('pointerdown', on);
      for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(ev, off);
      b.addEventListener('contextmenu', (e) => e.preventDefault());
    });
  }

  private bindJoystick(): void {
    const joy = document.getElementById('joy'), knob = document.getElementById('knob');
    if (!joy || !knob) return;
    let id: number | null = null, cx = 0, cy = 0;
    const set = (dx: number, dy: number) => {
      const r = 46, m = Math.hypot(dx, dy), s = m > r ? r / m : 1;
      dx *= s; dy *= s;
      knob.style.transform = `translate(${dx}px,${dy}px)`;
      const nx = dx / r, ny = dy / r;
      if (ny < -0.65) this.press('up'); if (ny > 0.65) this.press('down');
      this.state.left = nx < -0.3; this.state.right = nx > 0.3; this.state.up = ny < -0.65; this.state.down = ny > 0.65;
    };
    joy.addEventListener('pointerdown', (e) => {
      e.preventDefault(); id = e.pointerId;
      const r = joy.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2;
      try { joy.setPointerCapture(id); } catch { /* ignore */ }
      set(e.clientX - cx, e.clientY - cy);
    });
    joy.addEventListener('pointermove', (e) => { if (e.pointerId === id) set(e.clientX - cx, e.clientY - cy); });
    const end = (e: PointerEvent) => { if (e.pointerId !== id) return; id = null; knob.style.transform = ''; this.state.left = this.state.right = this.state.up = this.state.down = false; };
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) joy.addEventListener(ev, end);
  }
}
