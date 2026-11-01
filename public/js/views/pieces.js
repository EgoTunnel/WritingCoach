import { api } from '../api.js';
import { esc, fmtDate, KIND_LABEL } from '../ui.js';

export default async function render(el, _p, ctx) {
  const pieces = await api.get('/api/pieces');
  let kind = 'all';
  let q = '';

  el.innerHTML = `
    <div class="page-head">
      <div><h1>All writing</h1><p>${pieces.length} piece${pieces.length === 1 ? '' : 's'} · ${ctx.state.stats.versions} versions · every one a plain file in <code>${esc(ctx.state.dataDir)}</code></p></div>
      <div class="row">
        <input type="search" data-q placeholder="Search titles" style="width:200px">
        <select data-kind style="width:auto"><option value="all">All kinds</option>${Object.entries(KIND_LABEL).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select>
      </div>
    </div>
    <section class="card" data-table></section>`;

  const paint = () => {
    const list = pieces.filter((p) => (kind === 'all' || p.kind === kind) && p.title.toLowerCase().includes(q));
    el.querySelector('[data-table]').innerHTML = list.length ? `<table>
      <thead><tr><th>Title</th><th>Kind</th><th class="num">Words</th><th class="num">Versions</th><th class="num">Coach</th><th>Started</th><th>Updated</th></tr></thead>
      <tbody>${list.map((p) => `<tr class="link" data-id="${p.id}">
        <td><strong>${esc(p.title)}</strong></td>
        <td><span class="chip">${KIND_LABEL[p.kind] || p.kind}</span></td>
        <td class="num">${p.versions.at(-1)?.words ?? 0}</td>
        <td class="num">${p.versions.length}</td>
        <td class="num">${p.feedback.length}${p.feedback.some((f) => f.kind === 'rewrite') ? ' <span class="chip accent" title="Includes a requested rewrite">R</span>' : ''}</td>
        <td class="muted">${fmtDate(p.created)}</td>
        <td class="muted">${fmtDate(p.updated)}</td></tr>`).join('')}</tbody></table>`
      : '<div class="empty"><h3>Nothing here yet.</h3><a href="#/">Start with today\'s drill</a></div>';
    el.querySelectorAll('tr[data-id]').forEach((tr) => tr.addEventListener('click', () => ctx.go(`#/piece/${tr.dataset.id}`)));
  };
  el.querySelector('[data-q]').addEventListener('input', (e) => { q = e.target.value.toLowerCase(); paint(); });
  el.querySelector('[data-kind]').addEventListener('change', (e) => { kind = e.target.value; paint(); });
  paint();
}
