import { api } from '../api.js';
import { esc, busy, relDay, wordCount } from '../ui.js';

export default async function render(el, _p, ctx) {
  const pieces = await api.get('/api/pieces');
  const projects = pieces.filter((p) => p.kind === 'project');

  el.innerHTML = `
    <div class="page-head"><div>
      <h1>Projects</h1>
      <p>For longer work. The companion holds your plan, tracks revisions, and asks what an editor would ask. It never writes the outline.</p>
    </div></div>
    <div class="grid two">
      <section class="card">
        <div class="eyebrow">Your projects</div>
        ${projects.length ? `<table><thead><tr><th>Title</th><th>Reader</th><th class="num">Versions</th><th class="num">Words</th><th>Updated</th></tr></thead><tbody>
          ${projects.map((p) => `<tr class="link" data-id="${p.id}"><td><strong>${esc(p.title)}</strong></td><td class="muted">${esc(p.project?.reader || '')}</td><td class="num">${p.versions.length}</td><td class="num">${p.versions.at(-1)?.words ?? 0}</td><td class="muted">${relDay(p.updated)}</td></tr>`).join('')}
        </tbody></table>` : '<div class="empty"><h3>No projects yet.</h3><p>A story, an essay, a course chapter.</p></div>'}
      </section>
      <section class="card">
        <div class="eyebrow">Start a project</div>
        <div class="field"><label>Working title</label><input type="text" data-title></div>
        <div class="field"><label>What is it trying to do?</label><input type="text" data-purpose placeholder="e.g. Argue that rubrics teach compliance"></div>
        <div class="field"><label>Who is it for?</label><input type="text" data-reader placeholder="e.g. Faculty who've never questioned their rubrics"></div>
        <div class="field"><label>Your plan, as rough as you like</label><textarea data-plan rows="6" placeholder="1. Open on the student who got full marks and learned nothing&#10;2. …"></textarea></div>
        <button class="primary" data-go style="margin-top:12px">Create project</button>
      </section>
    </div>`;

  el.querySelectorAll('tr[data-id]').forEach((tr) => tr.addEventListener('click', () => ctx.go(`#/piece/${tr.dataset.id}`)));
  el.querySelector('[data-go]').addEventListener('click', (e) => busy(e.currentTarget, async () => {
    const v = (k) => el.querySelector(`[data-${k}]`).value.trim();
    const { meta } = await api.post('/api/pieces', {
      kind: 'project',
      title: v('title') || 'Untitled project',
      project: { purpose: v('purpose'), reader: v('reader'), plan: el.querySelector('[data-plan]').value },
    });
    ctx.go(`#/piece/${meta.id}`);
  }));
}
