// The page: where the writer writes. Every save is a version; the coach reads
// on request, in the writer's terms; rewrites are a separate, logged action.

import { api } from '../api.js';
import { $, esc, busy, toast, autosize, wordCount, fmtDateTime, KIND_LABEL } from '../ui.js';
import { diffWords, diffStats } from '../diff.js';
import { renderFeedback, bindFeedback, rewriteModal } from './feedback.js';
import { reflectModal } from './reflect.js';
import { drillPanel, constraintPanel, draftPanel, projectPanel, imitationPanel, constraintChecks, checksHTML } from './kinds.js';

const FOCUS_OPTIONS = [
  ['general', 'Whatever matters most'],
  ['structure', 'Structure'],
  ['voice', 'Voice'],
  ['line', 'Line level'],
  ['argument', 'Argument'],
  ['works', 'Just tell me if it works'],
  ['spar', 'Sparring partner: argue back'],
];
const DEPTH_LABEL = ['Reader response', '+ What\'s working', '+ The change', '+ A way in'];

const store = {
  get(k, d) { try { const v = sessionStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
};
const buffer = {
  key: (id) => `wc-buffer-${id}`,
  get(id) { try { return JSON.parse(localStorage.getItem(this.key(id))); } catch { return null; } },
  set(id, v) { try { localStorage.setItem(this.key(id), JSON.stringify(v)); } catch { /* ignore */ } },
  clear(id) { try { localStorage.removeItem(this.key(id)); } catch { /* ignore */ } },
};

export default async function render(el, [id], ctx) {
  const [data, library] = await Promise.all([api.get(`/api/pieces/${id}`), api.get('/api/library')]);
  let meta = data.meta;
  let feedback = data.feedback;
  let text = data.text;
  let title = meta.title;
  const model = meta.kind === 'imitation' ? library.models.find((m) => m.id === meta.imitation?.modelId) : null;
  const versionCache = new Map();

  const snap = () => JSON.stringify({ text, title, purpose: meta.purpose, imitation: meta.imitation, project: meta.project });
  let savedSnap = snap();
  const dirty = () => snap() !== savedSnap;

  ctx.canLeave = (silent) => !dirty() || (!silent && confirm('You have unsaved changes. Leave without saving a version?'));

  const opts = {
    purpose: '',
    focus: store.get('wc-focus', 'general'),
    depth: store.get('wc-depth', 4),
    tone: store.get('wc-tone', ctx.state.settings.defaultTone),
    encouragementOnly: false,
    lineEdits: false,
  };
  let tab = 'coach';
  let diffRange = null; // [from, to]
  let leftTab = 'draft';

  el.innerHTML = `
    <div class="page-head">
      <div class="row">
        <a href="#/pieces" class="muted" style="text-decoration:none">← All writing</a>
        <span class="chip">${KIND_LABEL[meta.kind] || meta.kind}</span>
        <span class="muted" style="font-size:.85rem" data-vcount></span>
      </div>
      <div class="row">
        <button data-finish title="End the session with a one-line reflection">Finish &amp; reflect</button>
      </div>
    </div>
    ${ctx.state.mock ? '<div class="mock-banner">Mock mode: coach replies are canned.</div>' : ''}
    <div class="editor-wrap">
      <div>
        ${meta.kind === 'project' ? `<div class="tabs" data-lefttabs><button data-left="draft" class="on">Draft</button><button data-left="plan">Plan &amp; notes</button></div>` : ''}
        <div class="paper" data-paper="draft">
          <input class="title-input" data-title value="${esc(title)}" aria-label="Title">
          <textarea class="writing" data-text placeholder="${placeholder(meta)}" spellcheck="true">${esc(text)}</textarea>
          <div class="paper-foot">
            <span data-wc></span>
            <span data-timer></span>
            <span class="status" data-status></span>
            <span class="spacer"></span>
            <button class="small ghost" data-rewrite title="A separate, logged action">Request a rewrite…</button>
            <button class="small primary" data-save title="Ctrl+S">Save version</button>
          </div>
        </div>
        ${meta.kind === 'project' ? `<div class="paper" data-paper="plan" hidden>
          <div class="eyebrow">Your plan</div>
          <p class="muted" style="font-size:.88rem">Sections, what each must do, what the reader carries out of it. Write it however you think; the editor will interrogate it.</p>
          <textarea class="writing" data-plan placeholder="1. Open on…&#10;2. …">${esc(meta.project?.plan || '')}</textarea>
          <div class="paper-foot"><span class="status" data-status2></span><span class="spacer"></span><button class="small primary" data-save>Save</button></div>
        </div>` : ''}
      </div>
      <aside class="side stack">
        <div data-context></div>
        <section class="card">
          <div class="tabs"><button data-tab="coach" class="on">Coach</button><button data-tab="versions">Versions</button></div>
          <div data-tabbody></div>
        </section>
      </aside>
    </div>`;

  const ta = $('[data-text]', el);
  const fit = autosize(ta);
  const planTa = $('[data-plan]', el);
  if (planTa) autosize(planTa);

  // ---------- restore an unsaved buffer ----------
  const buf = buffer.get(id);
  if (buf && buf.text !== text && buf.text.trim()) {
    const n = document.createElement('div');
    n.className = 'notice amber';
    n.style.marginBottom = '12px';
    n.innerHTML = `You have unsaved writing from ${fmtDateTime(buf.at)}. <button class="small" data-restore>Restore it</button> <button class="small ghost" data-discard>Discard</button>`;
    $('.editor-wrap', el).before(n);
    n.querySelector('[data-restore]').onclick = () => { ta.value = text = buf.text; fit(); paintFoot(); n.remove(); };
    n.querySelector('[data-discard]').onclick = () => { buffer.clear(id); n.remove(); };
  }

  // ---------- footer: words, timer, status ----------
  const target = meta.drill?.wordTarget;
  function paintFoot() {
    const wc = wordCount(text);
    $('[data-wc]', el).textContent = `${wc} word${wc === 1 ? '' : 's'}${target ? ` of ~${target}` : ''}`;
    const st = $('[data-status]', el);
    const last = meta.versions.at(-1);
    st.textContent = dirty() ? 'Unsaved changes' : last ? `Saved · v${last.n}` : 'Not saved yet';
    st.classList.toggle('dirty', dirty());
    const st2 = $('[data-status2]', el);
    if (st2) { st2.textContent = st.textContent; st2.className = st.className; }
    $('[data-vcount]', el).textContent = `${meta.versions.length} version${meta.versions.length === 1 ? '' : 's'}`;
    if (meta.kind === 'constraint') {
      const box = $('[data-checks]', el);
      if (box) box.innerHTML = checksHTML(constraintChecks(meta.constraint?.check, text));
    }
  }

  // Drill timer: starts on the first keystroke; ends gently.
  let timerStart = store.get(`wc-timer-${id}`, null);
  let timerInt = null;
  function paintTimer() {
    const t = $('[data-timer]', el);
    if (!t) return;
    if (meta.kind !== 'drill') { t.textContent = ''; return; }
    const total = (meta.drill?.minutes || 15) * 60;
    if (!timerStart) { t.textContent = `${meta.drill?.minutes || 15}:00 · starts when you type`; return; }
    const left = Math.round(total - (Date.now() - timerStart) / 1000);
    if (left <= 0) { t.textContent = 'Time. Finish your sentence.'; clearInterval(timerInt); return; }
    t.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} left`;
  }
  const startTimer = () => {
    if (meta.kind !== 'drill' || timerInt) return;
    if (!timerStart) { timerStart = Date.now(); store.set(`wc-timer-${id}`, timerStart); }
    timerInt = setInterval(() => { if (!document.body.contains(el) || !$('[data-timer]', el)) clearInterval(timerInt); else paintTimer(); }, 1000);
    paintTimer();
  };
  if (timerStart) startTimer(); else paintTimer();

  // ---------- inputs ----------
  ta.addEventListener('input', () => {
    text = ta.value;
    buffer.set(id, { text, at: new Date().toISOString() });
    startTimer();
    paintFoot();
  });
  $('[data-title]', el).addEventListener('input', (e) => { title = e.target.value; paintFoot(); });
  planTa?.addEventListener('input', () => { meta.project = { ...meta.project, plan: planTa.value }; paintFoot(); });

  el.querySelectorAll('[data-left]').forEach((b) => b.addEventListener('click', () => {
    leftTab = b.dataset.left;
    el.querySelectorAll('[data-left]').forEach((x) => x.classList.toggle('on', x === b));
    el.querySelectorAll('[data-paper]').forEach((p) => { p.hidden = p.dataset.paper !== leftTab; });
    if (leftTab === 'draft') fit();
  }));

  async function save({ quiet = false } = {}) {
    const res = await api.put(`/api/pieces/${id}`, {
      text, title, purpose: meta.purpose, imitation: meta.imitation, project: meta.project,
    });
    meta = res.meta;
    savedSnap = snap();
    buffer.clear(id);
    paintFoot();
    if (!quiet) toast(res.newVersion ? `Saved as version ${res.newVersion.n}.` : 'Saved.');
    if (tab === 'versions') paintTab();
    return res;
  }

  el.querySelectorAll('[data-save]').forEach((b) => b.addEventListener('click', () => busy(b, () => save())));
  const onKey = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      if (!document.body.contains(el) || !$('[data-text]', el)) { document.removeEventListener('keydown', onKey); return; }
      e.preventDefault();
      busy(null, () => save());
    }
  };
  document.addEventListener('keydown', onKey);
  window.addEventListener('hashchange', () => document.removeEventListener('keydown', onKey), { once: true });

  // ---------- context panel ----------
  function paintContext() {
    const box = $('[data-context]', el);
    box.innerHTML = {
      drill: () => drillPanel(meta),
      constraint: () => constraintPanel(meta, text),
      draft: () => draftPanel(meta),
      project: () => projectPanel(meta),
      imitation: () => imitationPanel(meta, model, text),
    }[meta.kind]?.() || '';
    box.querySelectorAll('[data-meta]').forEach((i) => i.addEventListener('input', () => { meta[i.dataset.meta] = i.value; paintFoot(); }));
    box.querySelectorAll('[data-project]').forEach((i) => i.addEventListener('input', () => { meta.project = { ...meta.project, [i.dataset.project]: i.value }; paintFoot(); }));
    box.querySelectorAll('[data-imitation]').forEach((i) => i.addEventListener('input', () => { meta.imitation = { ...meta.imitation, [i.dataset.imitation]: i.value }; paintFoot(); }));
    box.querySelectorAll('[data-stage]').forEach((b) => b.addEventListener('click', () => busy(b, async () => {
      meta.imitation = { ...meta.imitation, stage: Number(b.dataset.stage) };
      await save({ quiet: true });
      paintContext();
      paintEditorState();
      paintTab();
    })));
    autosizeAll(box);
  }
  const autosizeAll = (root) => root.querySelectorAll('textarea').forEach(autosize);

  function paintEditorState() {
    const locked = meta.kind === 'imitation' && meta.imitation?.exercise === 'franklin' && (meta.imitation?.stage || 1) === 1;
    ta.disabled = locked;
    ta.placeholder = locked ? 'Read the passage and make notes on its moves. When you set it aside, rebuild it here.' : placeholder(meta);
  }

  // ---------- side tabs ----------
  el.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => {
    tab = b.dataset.tab;
    el.querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('on', x === b));
    paintTab();
  }));

  function paintTab() {
    const body = $('[data-tabbody]', el);
    if (tab === 'versions') return paintVersions(body);
    body.innerHTML = coachHTML() + `<div data-fblist>${feedbackList()}</div>`;
    bindCoach(body);
    bindFeedback(body, id, {
      onSince: (v) => { diffRange = [v, 'current']; tab = 'versions'; el.querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('on', x.dataset.tab === 'versions')); paintTab(); },
      onChange: refreshFeedback,
    });
  }

  const feedbackList = () => {
    const current = meta.versions.at(-1)?.n || 0;
    if (!feedback.length) return '<p class="muted" style="font-size:.88rem;margin-top:14px">The coach hasn\'t read this yet.</p>';
    return `<div style="margin-top:18px">${feedback.slice().reverse().map((f) => renderFeedback(f, current)).join('')}</div>`;
  };

  async function refreshFeedback() {
    const d = await api.get(`/api/pieces/${id}`);
    feedback = d.feedback;
    meta = { ...meta, feedback: d.meta.feedback };
    paintTab();
    ctx.refresh();
  }

  function reviewControls() {
    return `
      <div class="field"><label>What do you want from this reading?</label>
        <input type="text" data-o="purpose" value="${esc(opts.purpose)}" placeholder="e.g. Does the turn in paragraph two land?"></div>
      <div class="field"><label>Kind of feedback</label>
        <select data-o="focus">${FOCUS_OPTIONS.map(([v, l]) => `<option value="${v}" ${opts.focus === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="field"><label>How deep: <span class="muted" data-depthlabel>${DEPTH_LABEL[opts.depth - 1]}</span></label>
        <div class="segmented">${[1, 2, 3, 4].map((n) => `<button class="small ${opts.depth === n ? 'on' : ''}" data-depth="${n}" title="${DEPTH_LABEL[n - 1]}">${n}</button>`).join('')}</div></div>
      <div class="field"><label>Tone this session</label>
        <input type="range" min="1" max="5" step="1" data-o="tone" value="${opts.tone}">
        <div class="tone-scale"><span>gentle</span><span>candid</span><span>editor's red pen</span></div></div>
      <div class="field">
        <label class="check"><input type="checkbox" data-o="encouragementOnly" ${opts.encouragementOnly ? 'checked' : ''}> Encouragement only — a bad day</label>
        <label class="check" style="margin-top:6px"><input type="checkbox" data-o="lineEdits" ${opts.lineEdits ? 'checked' : ''}> Include line edits <span class="muted">(logged as a rewrite)</span></label>
      </div>
      <div class="row" style="margin-top:14px">
        <button class="primary" data-ask>Read it</button>
        ${feedback.some((f) => f.kind === 'review') ? '<button class="ghost small" data-blind title="Re-read without your history, to check earlier feedback wasn\'t too kind">Blind re-review</button>' : ''}
      </div>`;
  }

  function coachHTML() {
    if (meta.kind === 'imitation') {
      const ex = meta.imitation?.exercise;
      const ready = ex !== 'franklin' || (meta.imitation?.stage || 1) === 3;
      return `<p class="muted" style="font-size:.88rem">${ready ? 'When you\'re done, the coach compares your version with the original, move by move.' : 'The comparison opens at step 3.'}</p>
        <button class="primary" data-compare ${ready ? '' : 'disabled'}>Compare with the original</button>
        <details style="margin-top:14px"><summary style="cursor:pointer;font-size:.9rem">Or get ordinary feedback</summary><div style="margin-top:10px">${reviewControls()}</div></details>`;
    }
    if (meta.kind === 'project') {
      return `<p class="muted" style="font-size:.88rem">The editor reads your plan and draft and asks what a good editor would ask now.</p>
        <button class="primary" data-questions>Ask the editor's questions</button>
        <details style="margin-top:14px"><summary style="cursor:pointer;font-size:.9rem">Review the draft itself</summary><div style="margin-top:10px">${reviewControls()}</div></details>`;
    }
    return reviewControls();
  }

  function bindCoach(body) {
    body.querySelectorAll('[data-o]').forEach((i) => i.addEventListener(i.type === 'checkbox' ? 'change' : 'input', () => {
      const k = i.dataset.o;
      opts[k] = i.type === 'checkbox' ? i.checked : i.type === 'range' ? Number(i.value) : i.value;
      if (k === 'tone') store.set('wc-tone', opts.tone);
      if (k === 'focus') store.set('wc-focus', opts.focus);
    }));
    body.querySelectorAll('[data-depth]').forEach((b) => b.addEventListener('click', () => {
      opts.depth = Number(b.dataset.depth);
      store.set('wc-depth', opts.depth);
      body.querySelectorAll('[data-depth]').forEach((x) => x.classList.toggle('on', x === b));
      body.querySelector('[data-depthlabel]').textContent = DEPTH_LABEL[opts.depth - 1];
    }));
    const ask = (btn, url, payload) => busy(btn, async () => {
      if (!ctx.state.hasKey) throw new Error('Add your OpenRouter key in Settings first.');
      if (dirty()) await save({ quiet: true });
      const fb = await api.post(url, payload);
      feedback.push(fb);
      meta.feedback = [...(meta.feedback || []), { id: fb.id, kind: fb.kind }];
      paintTab();
      $('[data-fblist] .fb', el)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      ctx.refresh();
    });
    body.querySelector('[data-ask]')?.addEventListener('click', (e) => ask(e.currentTarget, `/api/pieces/${id}/feedback`, opts));
    body.querySelector('[data-blind]')?.addEventListener('click', (e) => ask(e.currentTarget, `/api/pieces/${id}/feedback`, { ...opts, blind: true }));
    body.querySelector('[data-compare]')?.addEventListener('click', (e) => ask(e.currentTarget, `/api/pieces/${id}/compare`, {}));
    body.querySelector('[data-questions]')?.addEventListener('click', (e) => ask(e.currentTarget, `/api/pieces/${id}/questions`, {}));
  }

  async function versionText(n) {
    if (n === 'current') return text;
    if (!versionCache.has(n)) versionCache.set(n, (await api.get(`/api/pieces/${id}/versions/${n}`)).text);
    return versionCache.get(n);
  }

  async function paintVersions(body) {
    const vs = meta.versions;
    if (!vs.length) { body.innerHTML = '<p class="muted" style="font-size:.88rem">No versions yet. Every save is a version.</p>'; return; }
    if (!diffRange) diffRange = [vs.length > 1 ? vs.at(-2).n : vs[0].n, dirty() ? 'current' : vs.at(-1).n];
    const option = (v, sel) => `<option value="${v}" ${String(sel) === String(v) ? 'selected' : ''}>${v === 'current' ? 'Current (unsaved)' : `v${v}`}</option>`;
    const choices = [...vs.map((v) => v.n), ...(dirty() ? ['current'] : [])];
    body.innerHTML = `
      <div class="row"><select data-from style="width:auto">${choices.map((v) => option(v, diffRange[0])).join('')}</select>
        <span>→</span><select data-to style="width:auto">${choices.map((v) => option(v, diffRange[1])).join('')}</select>
        <span class="muted" data-dstats style="font-size:.85rem"></span></div>
      <div class="diff" data-diff style="margin-top:12px;max-height:46vh;overflow:auto"></div>
      <ul class="list" style="margin-top:14px">${vs.slice().reverse().map((v) => {
        const fbs = feedback.filter((f) => f.version === v.n).length;
        return `<li class="row" style="font-size:.88rem"><strong>v${v.n}</strong><span class="muted">${fmtDateTime(v.at)}</span><span class="spacer"></span><span>${v.words} words</span>${fbs ? `<span class="chip sage">${fbs} response${fbs > 1 ? 's' : ''}</span>` : ''}</li>`;
      }).join('')}</ul>`;
    const parse = (v) => (v === 'current' ? 'current' : Number(v));
    const draw = async () => {
      diffRange = [parse(body.querySelector('[data-from]').value), parse(body.querySelector('[data-to]').value)];
      const [a, b] = await Promise.all(diffRange.map(versionText));
      const parts = diffWords(a, b);
      const st = diffStats(parts);
      body.querySelector('[data-dstats]').textContent = `+${st.added} / −${st.removed} words`;
      body.querySelector('[data-diff]').innerHTML = parts.map((p) => p.type === 'same' ? esc(p.text) : p.type === 'add' ? `<ins>${esc(p.text)}</ins>` : `<del>${esc(p.text)}</del>`).join('') || '<span class="muted">No differences.</span>';
    };
    body.querySelector('[data-from]').onchange = draw;
    body.querySelector('[data-to]').onchange = draw;
    draw();
  }

  // ---------- rewrite & finish ----------
  $('[data-rewrite]', el).addEventListener('click', async () => {
    if (!ctx.state.hasKey) { toast('Add your OpenRouter key in Settings first.', 'error'); return; }
    if (dirty()) await save({ quiet: true });
    const selection = ta.value.slice(ta.selectionStart, ta.selectionEnd);
    const fb = await rewriteModal(id, selection);
    if (fb) {
      feedback.push(fb);
      tab = 'coach';
      paintTab();
      ctx.refresh();
    }
  });

  $('[data-finish]', el).addEventListener('click', async (e) => {
    if (dirty()) {
      const ok = await busy(e.currentTarget, () => save({ quiet: true }));
      if (!ok) return;
    }
    const res = await reflectModal({ pieceId: id, pieceTitle: title, hasKey: ctx.state.hasKey, profile: ctx.state.profile });
    if (res) {
      store.set(`wc-timer-${id}`, null);
      ctx.go('#/');
    }
  });

  paintFoot();
  paintContext();
  paintEditorState();
  paintTab();
  if (!text) ta.focus();
}

function placeholder(meta) {
  return {
    drill: 'Start anywhere. Ten minutes is enough.',
    draft: 'Write or paste your piece.',
    constraint: 'The constraint is the way in.',
    project: 'Draft here. Keep the plan in the other tab.',
    imitation: meta.imitation?.exercise === 'copywork' ? 'Copy the passage here, slowly.' : meta.imitation?.exercise === 'pastiche' ? 'Your subject, their manner.' : 'Rebuild it from your notes.',
  }[meta.kind] || '';
}
