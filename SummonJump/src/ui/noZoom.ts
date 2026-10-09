/**
 * Keep the page locked at 1:1 on phones. iOS Safari ignores `user-scalable=no`, so rapid taps on the
 * on-screen buttons (double-tap) or a two-finger touch could zoom the page and push buttons off screen.
 */
export function lockZoom(): void {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  const VIEWPORT = 'width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, viewport-fit=cover, user-scalable=no';
  if (meta) meta.content = VIEWPORT;

  const stop = (e: Event) => { if (e.cancelable) e.preventDefault(); };
  // iOS pinch gestures
  for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, stop, { passive: false });
  // two-finger touch moves
  document.addEventListener('touchmove', (e) => { if (e.touches.length > 1) stop(e); }, { passive: false });
  // double-tap zoom: swallow a second touchend that arrives too quickly
  let lastEnd = 0;
  document.addEventListener('touchend', (e) => { const now = Date.now(); if (now - lastEnd < 350) stop(e); lastEnd = now; }, { passive: false });
  document.addEventListener('dblclick', stop, { passive: false });
  // ctrl/⌘ + wheel zoom on desktop trackpads
  addEventListener('wheel', (e) => { if (e.ctrlKey) stop(e); }, { passive: false });

  // if the browser still zoomed somehow (e.g. accessibility zoom), snap back when the user stops touching
  const vv = window.visualViewport;
  if (vv && meta) {
    vv.addEventListener('resize', () => {
      if (vv.scale > 1.01) { meta.content = VIEWPORT.replace('maximum-scale=1', 'maximum-scale=1.01'); requestAnimationFrame(() => { meta.content = VIEWPORT; }); }
    });
  }
}
