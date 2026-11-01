import { api } from '../api.js';
import { esc, busy, modal, relDay } from '../ui.js';
import { IMITATION_EXERCISES } from './kinds.js';

export default async function render(el, _p, ctx) {
  const [{ models }, pieces] = await Promise.all([api.get('/api/library'), api.get('/api/pieces')]);
  const done = pieces.filter((p) => p.kind === 'imitation');

  el.innerHTML = `
    <div class="page-head"><div>
      <h1>Imitation studio</h1>
      <p>The oldest method. Copy a model, rebuild it from notes, or borrow its manner for your own subject.</p>
    </div></div>
    <div class="grid three" style="margin-bottom:18px">
      ${Object.entries(IMITATION_EXERCISES).map(([k, ex]) => `<div class="card"><h3>${ex.name}</h3><p class="muted" style="font-size:.9rem;margin:0">${ex.how}</p></div>`).join('')}
    </div>
    <div class="grid auto">
      ${models.map((m) => `<article class="card" style="display:flex;flex-direction:column">
        <div class="eyebrow">${esc(m.genre)} · ${esc(m.year)}</div>
        <h3>${esc(m.author)}</h3>
        <p class="muted" style="margin-top:-4px"><em>${esc(m.title)}</em></p>
        <p style="font-family:var(--serif);font-size:.95rem;flex:1">${esc(m.text.slice(0, 150))}…</p>
        <div class="row" style="gap:4px;margin-bottom:10px">${(m.tags || []).map((t) => `<span class="chip">${esc(t)}</span>`).join('')}</div>
        <button data-model="${m.id}">Work with this passage</button>
      </article>`).join('')}
    </div>
    ${done.length ? `<section class="card" style="margin-top:18px"><div class="eyebrow">Your imitations</div><ul class="list">${done.map((p) => `<li class="row"><a href="#/piece/${p.id}">${esc(p.title)}</a><span class="chip">${esc(IMITATION_EXERCISES[p.imitation?.exercise]?.name || '')}</span><span class="spacer"></span><span class="muted" style="font-size:.85rem">${relDay(p.updated)}</span></li>`).join('')}</ul></section>` : ''}
    <p class="muted" style="font-size:.82rem;margin-top:18px">Passages live in <code>library/models/</code>. Add your own as Markdown files.</p>`;

  el.querySelectorAll('[data-model]').forEach((b) => b.addEventListener('click', () => {
    const m = models.find((x) => x.id === b.dataset.model);
    modal(`
      <h2>${esc(m.author)}</h2>
      <p class="muted"><em>${esc(m.title)}</em></p>
      <div class="passage">${esc(m.text)}</div>
      <div class="field" style="margin-top:14px"><label>Exercise</label>
        ${Object.entries(IMITATION_EXERCISES).map(([k, ex], i) => `<label class="check" style="margin:6px 0"><input type="radio" name="ex" value="${k}" ${i === 0 ? 'checked' : ''}> <span><strong>${ex.name}</strong> — <span class="muted">${ex.how}</span></span></label>`).join('')}
      </div>
      <div class="actions"><button data-x>Cancel</button><button class="primary" data-go>Begin</button></div>
    `, (dlg, close) => {
      dlg.querySelector('[data-x]').onclick = () => close();
      dlg.querySelector('[data-go]').onclick = (e) => busy(e.currentTarget, async () => {
        const exercise = dlg.querySelector('input[name=ex]:checked').value;
        const { meta } = await api.post('/api/pieces', {
          kind: 'imitation',
          title: `${IMITATION_EXERCISES[exercise].name}: ${m.author}`,
          imitation: { modelId: m.id, exercise, stage: 1 },
        });
        close();
        ctx.go(`#/piece/${meta.id}`);
      });
    }, { wide: true });
  }));
}
