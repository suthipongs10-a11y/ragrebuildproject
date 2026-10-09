import { t } from '../i18n';

/**
 * Phone-friendly diagnostics: script errors and failed downloads are shown on screen (owner can screenshot them),
 * plus a "loading…" curtain for room changes.
 */
function box(id: string, css: string): HTMLDivElement {
  let el = document.getElementById(id) as HTMLDivElement | null;
  if (!el) { el = document.createElement('div'); el.id = id; el.style.cssText = css; document.body.appendChild(el); }
  return el;
}

const shown: string[] = [];
export function showError(msg: string): void {
  if (shown.includes(msg) || shown.length >= 4) return;
  shown.push(msg);
  const el = box('errbox', 'position:fixed;left:8px;bottom:8px;max-width:80vw;z-index:99;background:rgba(120,20,20,.92);color:#fff;font:12px/1.4 system-ui;padding:6px 10px;border-radius:8px;white-space:pre-wrap;pointer-events:auto');
  el.textContent = `⚠ ${shown.join('\n⚠ ')}`;
  el.onclick = () => el.remove();
}

export function installErrorOverlay(): void {
  addEventListener('error', (e) => showError(`${e.message} @ ${(e.filename ?? '').split('/').pop()}:${e.lineno}`));
  addEventListener('unhandledrejection', (e) => showError(String((e.reason as Error)?.message ?? e.reason)));
}

export function setLoading(on: boolean): void {
  const el = box('loadbox', 'position:fixed;inset:0;z-index:40;display:none;align-items:center;justify-content:center;color:#f6ecd8;font:20px Itim,system-ui;pointer-events:none');
  el.textContent = t('ui.loading');
  el.style.display = on ? 'flex' : 'none';
}

/** Some images never arrived (bad mobile network): tell the player and offer a reload instead of showing broken art. */
export function showLoadProblem(missing: string[]): void {
  const el = box('loadfail', 'position:fixed;inset:0;z-index:98;display:flex;flex-direction:column;gap:12px;align-items:center;justify-content:center;background:rgba(23,18,12,.94);color:#f6ecd8;font:18px Itim,system-ui;text-align:center;padding:24px');
  el.innerHTML = `<div>${t('ui.loadFail')}</div><small style="opacity:.6">${missing.slice(0, 4).join(', ')}${missing.length > 4 ? '…' : ''}</small><button style="min-height:48px;padding:0 24px;border-radius:12px;border:2px solid #8a6a36;background:#d8a84a;color:#2a1a00;font:600 18px Itim,system-ui">${t('ui.retry')}</button>`;
  el.querySelector('button')?.addEventListener('click', () => location.reload());
}
