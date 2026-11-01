export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function wordCount(text) {
  const m = String(text || '').trim().match(/\S+/g);
  return m ? m.length : 0;
}

/** Plain text with paragraphs and *emphasis* — enough for coach replies and logs. */
export function prose(text) {
  return String(text || '').split(/\n{2,}/).map((p) => `<p>${esc(p)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[withheld: ([^\]]+)\]/g, '<span class="chip amber" title="The guard withheld replacement prose here">withheld: $1</span>')
    .replace(/\n/g, '<br>')}</p>`).join('');
}

export function fmtDate(iso, opts = {}) {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(opts.year ? { year: 'numeric' } : {}) });
}

export function fmtDateTime(iso) {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function relDay(iso) {
  const d = new Date(iso);
  const days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 864e5);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return fmtDate(iso);
}

export const localDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const money = (n) => (n == null ? '—' : n < 0.01 && n > 0 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`);

export function toast(msg, type = '') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.getElementById('toasts').append(el);
  setTimeout(() => el.remove(), type === 'error' ? 7000 : 3500);
}

/** Run an async action with a busy button and error toast. */
export async function busy(btn, fn) {
  if (btn) { btn.disabled = true; btn.classList.add('busy'); }
  try {
    return await fn();
  } catch (e) {
    toast(e.message, 'error');
    return undefined;
  } finally {
    if (btn) { btn.disabled = false; btn.classList.remove('busy'); }
  }
}

/** Show a modal; `build(el, close)` fills it. Resolves with whatever close() is called with. */
export function modal(html, build, { wide = false } = {}) {
  return new Promise((resolve) => {
    const back = document.createElement('div');
    back.className = 'modal-back';
    back.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">${html}</div>`;
    const close = (v) => { back.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
    const onKey = (e) => { if (e.key === 'Escape') close(undefined); };
    back.addEventListener('mousedown', (e) => { if (e.target === back) close(undefined); });
    document.addEventListener('keydown', onKey);
    document.body.append(back);
    build?.(back.firstElementChild, close);
    back.querySelector('textarea, input, button.primary')?.focus();
  });
}

export function confirmModal(title, body, okLabel = 'OK') {
  return modal(`<h2>${esc(title)}</h2><div>${body}</div><div class="actions"><button data-x>Cancel</button><button class="primary" data-ok>${esc(okLabel)}</button></div>`, (el, close) => {
    el.querySelector('[data-x]').onclick = () => close(false);
    el.querySelector('[data-ok]').onclick = () => close(true);
  });
}

export function autosize(ta) {
  const fit = () => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; };
  ta.addEventListener('input', fit);
  requestAnimationFrame(fit);
  return fit;
}

export const KIND_LABEL = { drill: 'Drill', draft: 'Draft', imitation: 'Imitation', constraint: 'Constraint', project: 'Project' };
