import { api } from '../api.js';
import { esc, fmtDate } from '../ui.js';
import { reflectModal } from './reflect.js';

export default async function render(el, _p, ctx) {
  const list = (await api.get('/api/reflections')).reverse();
  const liked = list.filter((r) => r.liked?.trim());

  el.innerHTML = `
    <div class="page-head">
      <div><h1>Reflection log</h1><p>What was hard, what you liked in your own sentences. Also kept as <code>reflections.md</code>.</p></div>
      <button data-add>Add a reflection</button>
    </div>
    <div class="grid two">
      <section class="card">
        <div class="eyebrow">Sessions</div>
        ${list.length ? `<ul class="list">${list.map((r) => `<li>
          <div class="row"><strong>${fmtDate(r.date, { year: true })}</strong>${r.pieceId ? `<a href="#/piece/${r.pieceId}">${esc(r.pieceTitle || 'piece')}</a>` : ''}</div>
          ${r.hard ? `<p style="margin:4px 0 0"><span class="muted">Hard:</span> ${esc(r.hard)}</p>` : ''}
          ${r.liked ? `<p style="margin:4px 0 0"><span class="muted">Liked:</span> ${esc(r.liked)}</p>` : ''}
          ${r.note ? `<p style="margin:4px 0 0">${esc(r.note)}</p>` : ''}
        </li>`).join('')}</ul>` : '<div class="empty"><h3>No reflections yet.</h3><p>Use “Finish &amp; reflect” at the end of a session.</p></div>'}
      </section>
      <section class="card">
        <div class="eyebrow">Evidence file</div>
        <p class="muted" style="font-size:.88rem">Every sentence of yours you liked, in one place. Read this on the days you believe you can't write.</p>
        ${liked.length ? liked.map((r) => `<p class="evidence" style="margin-bottom:4px">${esc(r.liked)}</p><p class="muted" style="font-size:.8rem">${fmtDate(r.date, { year: true })}</p>`).join('') : '<p class="muted">Empty, for now.</p>'}
      </section>
    </div>`;

  el.querySelector('[data-add]').addEventListener('click', async () => {
    const res = await reflectModal({ hasKey: false, profile: ctx.state.profile });
    if (res) render(el, _p, ctx);
  });
}
