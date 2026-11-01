import { api } from '../api.js';
import { esc, busy } from '../ui.js';

export default async function render(el, _p, ctx) {
  const { constraints } = await api.get('/api/library');
  let filter = 'all';

  el.innerHTML = `
    <div class="page-head">
      <div><h1>Constraint lab</h1><p>Constraints remove the blank page. Pick one, or let chance pick.</p></div>
      <div class="row">
        <div class="segmented" data-filter>
          ${['all', 'fiction', 'non-fiction'].map((f) => `<button class="small ${f === filter ? 'on' : ''}" data-f="${f}">${f}</button>`).join('')}
        </div>
        <button class="primary" data-random>Surprise me</button>
      </div>
    </div>
    <div class="grid auto" data-grid></div>`;

  const start = (c, btn) => busy(btn, async () => {
    const { meta } = await api.post('/api/pieces', { kind: 'constraint', title: c.title, constraint: c });
    ctx.go(`#/piece/${meta.id}`);
  });

  const paint = () => {
    const list = constraints.filter((c) => filter === 'all' || c.genre === filter || c.genre === 'either');
    el.querySelector('[data-grid]').innerHTML = list.map((c) => `
      <article class="card" style="display:flex;flex-direction:column">
        <div class="eyebrow">${esc(c.genre)}</div>
        <h3>${esc(c.title)}</h3>
        <p style="flex:1;font-family:var(--serif)">${esc(c.prompt)}</p>
        <button data-id="${c.id}">Try it</button>
      </article>`).join('');
    el.querySelectorAll('[data-id]').forEach((b) => b.addEventListener('click', () => start(constraints.find((c) => c.id === b.dataset.id), b)));
  };

  el.querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => {
    filter = b.dataset.f;
    el.querySelectorAll('[data-f]').forEach((x) => x.classList.toggle('on', x === b));
    paint();
  }));
  el.querySelector('[data-random]').addEventListener('click', (e) => {
    const list = constraints.filter((c) => filter === 'all' || c.genre === filter || c.genre === 'either');
    start(list[Math.floor(Math.random() * list.length)], e.currentTarget);
  });
  paint();
}
