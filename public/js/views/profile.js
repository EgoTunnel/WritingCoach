// Principle 8: the writer can see and edit everything the coach believes about them.

import { api } from '../api.js';
import { esc, busy, toast, fmtDate, localDate } from '../ui.js';
import { proposalHTML, bindProposals } from './reflect.js';

const lines = (arr) => (arr || []).join('\n');
const fromLines = (s) => s.split('\n').map((x) => x.trim()).filter(Boolean);
const rid = (p) => `${p}-${Math.random().toString(36).slice(2, 8)}`;

export default async function render(el, _p, ctx) {
  const [profile, proposals] = await Promise.all([api.get('/api/profile'), api.get('/api/proposals')]);
  const p = structuredClone(profile);
  p.patterns ||= []; p.strengths ||= []; p.issues ||= [];
  const pending = proposals.filter((x) => x.status === 'pending');
  const decided = proposals.filter((x) => x.status !== 'pending').reverse();
  let view = 'form';

  const patternRow = (x) => `<div class="row" data-row="patterns" data-id="${x.id}" style="margin-bottom:8px;flex-wrap:nowrap">
    <input type="text" data-k="text" value="${esc(x.text)}">
    <select data-k="status" style="width:140px"><option value="confirmed" ${x.status === 'confirmed' ? 'selected' : ''}>confirmed</option><option value="proposed" ${x.status !== 'confirmed' ? 'selected' : ''}>hypothesis</option></select>
    <button class="small ghost" data-del title="${esc(x.evidence || '')}">Remove</button></div>`;
  const strengthRow = (x) => `<div class="row" data-row="strengths" data-id="${x.id}" style="margin-bottom:8px;flex-wrap:nowrap">
    <input type="text" data-k="text" value="${esc(x.text)}"><button class="small ghost" data-del>Remove</button></div>`;
  const issueRow = (x) => `<div class="row" data-row="issues" data-id="${x.id}" style="margin-bottom:8px;flex-wrap:nowrap">
    <input type="text" data-k="skill" value="${esc(x.skill)}" style="width:180px" placeholder="skill">
    <input type="text" data-k="text" value="${esc(x.text)}" placeholder="issue">
    <span class="muted" style="font-size:.8rem;white-space:nowrap">since ${fmtDate(x.firstSeen)}</span>
    <label class="check" style="white-space:nowrap"><input type="checkbox" data-k="resolved" ${x.resolvedAt ? 'checked' : ''}> resolved${x.resolvedAt ? ` ${fmtDate(x.resolvedAt)}` : ''}</label>
    <button class="small ghost" data-del>Remove</button></div>`;

  function formHTML() {
    return `
      <div class="grid two">
        <div class="stack">
          <section class="card">
            <div class="eyebrow">Goals, in your words</div>
            <textarea data-f="goals" rows="4" placeholder="One per line">${esc(lines(p.goals))}</textarea>
          </section>
          <section class="card">
            <div class="eyebrow">Observed patterns</div>
            <p class="muted" style="font-size:.85rem">The coach may notice a pattern; it can't record one as fact until you agree. Hypotheses are shown to the coach as unconfirmed.</p>
            <div data-list="patterns">${p.patterns.map(patternRow).join('') || '<p class="muted" data-none>None yet.</p>'}</div>
            <button class="small" data-add="patterns">Add a pattern</button>
          </section>
          <section class="card">
            <div class="eyebrow">Strengths to protect</div>
            <p class="muted" style="font-size:.85rem">Things the coach should not edit out of you.</p>
            <div data-list="strengths">${p.strengths.map(strengthRow).join('') || '<p class="muted" data-none>None yet.</p>'}</div>
            <button class="small" data-add="strengths">Add a strength</button>
          </section>
          <section class="card">
            <div class="eyebrow">Issues — history</div>
            <p class="muted" style="font-size:.85rem">So the coach can say “three weeks ago this was the issue; it isn't now.”</p>
            <div data-list="issues">${p.issues.map(issueRow).join('') || '<p class="muted" data-none>None yet.</p>'}</div>
            <button class="small" data-add="issues">Add an issue</button>
          </section>
        </div>
        <div class="stack">
          <section class="card">
            <div class="field"><label>Name</label><input type="text" data-f="writer" value="${esc(p.writer || '')}"></div>
            <div class="field"><label>Current focus skill (one at a time, 2–4 weeks)</label><input type="text" data-f="focus.skill" value="${esc(p.focus?.skill || '')}"></div>
            <div class="row" style="margin-top:10px">
              <div style="flex:1"><label>Genre</label><select data-f="focus.genre"><option ${p.focus?.genre === 'non-fiction' ? 'selected' : ''}>non-fiction</option><option ${p.focus?.genre === 'fiction' ? 'selected' : ''}>fiction</option></select></div>
              <div style="flex:1"><label>Since</label><input type="text" data-f="focus.since" value="${esc(p.focus?.since || '')}" placeholder="YYYY-MM-DD"></div>
            </div>
            <div class="field"><label>Drill phase</label><select data-f="phase">
              <option value="nonfiction-first" ${p.phase !== 'rotate-fiction' ? 'selected' : ''}>Non-fiction leads (building the habit)</option>
              <option value="rotate-fiction" ${p.phase === 'rotate-fiction' ? 'selected' : ''}>Rotate fiction in</option></select></div>
            ${p.focusHistory?.length ? `<p class="muted" style="font-size:.82rem;margin-top:10px">Earlier focus: ${p.focusHistory.map((f) => `${esc(f.skill)} (${fmtDate(f.since)}–${fmtDate(f.until)})`).join(', ')}</p>` : ''}
          </section>
          <section class="card">
            <div class="eyebrow">Influences and target voices</div>
            <textarea data-f="influences" rows="4" placeholder="One per line">${esc(lines(p.influences))}</textarea>
          </section>
          <section class="card">
            <div class="eyebrow">Notes</div>
            <textarea data-f="notes" rows="4">${esc(p.notes || '')}</textarea>
          </section>
          ${decided.length ? `<section class="card"><details><summary style="cursor:pointer" class="eyebrow">Past proposals (${decided.length})</summary>
            <ul class="list" style="font-size:.85rem">${decided.map((d) => `<li><span class="chip ${d.status === 'rejected' ? '' : 'sage'}">${d.status}</span> ${esc(d.type.replace('_', ' '))}: ${esc(d.payload.text || d.payload.skill || d.payload.phase || d.payload.id || '')} <span class="muted">· ${fmtDate(d.created)}</span></li>`).join('')}</ul></details></section>` : ''}
        </div>
      </div>`;
  }

  function paint() {
    el.innerHTML = `
      <div class="page-head">
        <div><h1>Writer profile</h1><p>Everything the coach believes about you. No hidden profile, no opaque scoring. Stored as <code>profile.json</code>.</p></div>
        <div class="row">
          <div class="segmented"><button class="small ${view === 'form' ? 'on' : ''}" data-view="form">Profile</button><button class="small ${view === 'json' ? 'on' : ''}" data-view="json">Raw file</button></div>
          <button class="primary" data-save>Save profile</button>
        </div>
      </div>
      ${pending.length ? `<section class="card" style="margin-bottom:14px;border-color:var(--accent)">
        <div class="eyebrow">Proposed by the coach — waiting for you</div>
        <div data-proposals>${pending.map((x) => proposalHTML(x, profile)).join('')}</div></section>` : ''}
      <div data-body>${view === 'form' ? formHTML() : `<section class="card"><textarea data-json rows="30" style="font-family:var(--mono);font-size:.85rem">${esc(JSON.stringify(p, null, 2))}</textarea></section>`}</div>`;

    // A decision changes profile.json on the server, so reload rather than let a stale form overwrite it.
    if (pending.length) bindProposals(el.querySelector('[data-proposals]'), () => setTimeout(async () => { await ctx.refresh(); render(el, _p, ctx); }, 700));
    el.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => {
      try { collect(); } catch (e) { toast(e.message, 'error'); return; }
      view = b.dataset.view;
      paint();
    }));
    el.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => {
      const list = el.querySelector(`[data-list="${b.dataset.add}"]`);
      list.querySelector('[data-none]')?.remove();
      const html = { patterns: () => patternRow({ id: rid('p'), text: '', status: 'confirmed' }), strengths: () => strengthRow({ id: rid('s'), text: '' }), issues: () => issueRow({ id: rid('i'), skill: '', text: '', firstSeen: localDate() }) }[b.dataset.add]();
      list.insertAdjacentHTML('beforeend', html);
      bindDel(list.lastElementChild);
      list.lastElementChild.querySelector('input').focus();
    }));
    el.querySelectorAll('[data-row]').forEach(bindDel);
    el.querySelector('[data-save]').addEventListener('click', (e) => busy(e.currentTarget, async () => {
      collect();
      const saved = await api.put('/api/profile', p);
      Object.assign(profile, saved);
      toast('Profile saved.');
      ctx.refresh();
    }));
  }

  const bindDel = (row) => row.querySelector('[data-del]')?.addEventListener('click', () => row.remove());

  /** Read the form (or raw JSON) back into `p`. */
  function collect() {
    if (view === 'json') {
      const raw = el.querySelector('[data-json]').value;
      let parsed;
      try { parsed = JSON.parse(raw); } catch { throw new Error('The raw profile is not valid JSON.'); }
      Object.keys(p).forEach((k) => delete p[k]);
      Object.assign(p, parsed);
      p.patterns ||= []; p.strengths ||= []; p.issues ||= [];
      return;
    }
    const f = (k) => el.querySelector(`[data-f="${k}"]`).value;
    p.writer = f('writer').trim();
    p.goals = fromLines(f('goals'));
    p.influences = fromLines(f('influences'));
    p.notes = f('notes');
    p.phase = f('phase');
    const newSkill = f('focus.skill').trim();
    p.focus = { ...p.focus, skill: newSkill, genre: f('focus.genre'), since: f('focus.since').trim() || localDate() };
    const rows = (kind) => [...el.querySelectorAll(`[data-row="${kind}"]`)];
    const old = (kind, id) => (profile[kind] || []).find((x) => x.id === id) || {};
    p.patterns = rows('patterns').map((r) => ({ ...old('patterns', r.dataset.id), id: r.dataset.id, text: r.querySelector('[data-k=text]').value.trim(), status: r.querySelector('[data-k=status]').value, since: old('patterns', r.dataset.id).since || localDate() })).filter((x) => x.text);
    p.strengths = rows('strengths').map((r) => ({ ...old('strengths', r.dataset.id), id: r.dataset.id, text: r.querySelector('[data-k=text]').value.trim(), since: old('strengths', r.dataset.id).since || localDate() })).filter((x) => x.text);
    p.issues = rows('issues').map((r) => {
      const o = old('issues', r.dataset.id);
      const resolved = r.querySelector('[data-k=resolved]').checked;
      return { ...o, id: r.dataset.id, skill: r.querySelector('[data-k=skill]').value.trim(), text: r.querySelector('[data-k=text]').value.trim(), firstSeen: o.firstSeen || localDate(), resolvedAt: resolved ? (o.resolvedAt || localDate()) : null };
    }).filter((x) => x.text || x.skill);
  }

  paint();
}
