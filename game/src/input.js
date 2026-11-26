// input.js — keyboard state, discrete key callbacks, and optional mouse-drag steering, all
// collapsed into a plain controls snapshot the flight model reads each step.

const HELD = new Set([
  'KeyW', 'KeyS', 'KeyA', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'ShiftLeft', 'ControlLeft', 'Space',
]);

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.callbacks = new Map();
    this.mouse = { down: false };
    this.mousePitch = 0;
    this.mouseRoll = 0;

    window.addEventListener('keydown', (e) => {
      if (HELD.has(e.code)) e.preventDefault();
      if (!e.repeat && this.callbacks.has(e.code)) this.callbacks.get(e.code)();
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    if (canvas) {
      canvas.addEventListener('pointerdown', () => {
        this.mouse.down = true;
      });
      window.addEventListener('pointermove', (e) => {
        if (!this.mouse.down) return;
        const w = window.innerWidth, h = window.innerHeight;
        this.mouseRoll = Math.max(-1, Math.min(1, (e.clientX - w / 2) / (w * 0.32)));
        this.mousePitch = Math.max(-1, Math.min(1, (h / 2 - e.clientY) / (h * 0.32)));
      });
      window.addEventListener('pointerup', () => {
        this.mouse.down = false;
        this.mousePitch = 0;
        this.mouseRoll = 0;
      });
    }
  }

  on(code, fn) {
    this.callbacks.set(code, fn);
  }

  holding(code) {
    return this.keys.has(code);
  }

  snapshot() {
    const k = (c) => (this.keys.has(c) ? 1 : 0);
    return {
      thr: (k('KeyW') + k('ShiftLeft')) - (k('KeyS') + k('ControlLeft')),
      pitch: (k('ArrowUp') - k('ArrowDown')) + this.mousePitch,
      roll: (k('ArrowRight') - k('ArrowLeft')) + this.mouseRoll,
      yaw: k('KeyD') - k('KeyA'),
    };
  }
}
