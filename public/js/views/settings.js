import { api } from '../api.js';
import { esc, busy, toast, money, fmtDateTime } from '../ui.js';

const ROLES = [
  ['drill', 'Drills and prompts', 'Cheap and fast: tailoring the daily drill.'],
  ['critique', 'Critique', 'Strong: draft feedback, imitation comparisons, requested rewrites.'],
  ['companion', 'Companion', 'Editor\'s questions on projects, and profile proposals.'],
];

export default async function render(el, _p, ctx) {
  const { settings, hasKey, keySource, dataDir, coaches, mock } = ctx.state;
  const usage = await api.get('/api/usage');

  el.innerHTML = `
    <div class="page-head"><div><h1>Settings</h1><p>Your key, your models, your spending.</p></div></div>
    <div class="grid two">
      <div class="stack">
        <section class="card">
          <div class="eyebrow">OpenRouter key</div>
          <p style="font-size:.9rem">${hasKey && !mock ? `<span class="chip sage">Set</span> Stored in <code>${esc(keySource)}</code> — outside your writing folder, so it's never in files you share.` : mock ? '<span class="chip amber">Mock mode</span> No key needed.' : '<span class="chip amber">Not set</span> Drills work without one; feedback needs it.'}</p>
          <div class="row" style="flex-wrap:nowrap"><input type="password" data-key placeholder="sk-or-…" autocomplete="off"><button class="primary" data-savekey>Save</button>${hasKey && keySource !== 'environment' && !mock ? '<button class="ghost" data-clearkey>Remove</button>' : ''}</div>
          <p class="muted" style="font-size:.82rem;margin-top:8px">Get one at openrouter.ai/keys. Or set the <code>OPENROUTER_API_KEY</code> environment variable.</p>
        </section>
        <section class="card">
          <div class="eyebrow">Models by task</div>
          <p class="muted" style="font-size:.85rem">Any OpenRouter model id. <button class="small ghost" data-loadmodels>Load the model list</button></p>
          <datalist id="models"></datalist>
          ${ROLES.map(([k, l, d]) => `<div class="field"><label>${l} <span class="muted">— ${d}</span></label>
            <input type="text" list="models" data-model="${k}" value="${esc(settings.models[k])}"><div class="muted" data-price="${k}" style="font-size:.8rem"></div></div>`).join('')}
        </section>
      </div>
      <div class="stack">
        <section class="card">
          <div class="eyebrow">Coach</div>
          <div class="field"><label>Coach config <span class="muted">(how the coach talks — files in <code>coaches/</code>)</span></label>
            <select data-s="coach">${coaches.map((c) => `<option ${c === settings.coach ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div>
          <div class="field"><label>Default tone</label>
            <input type="range" min="1" max="5" data-s="defaultTone" value="${settings.defaultTone}">
            <div class="tone-scale"><span>gentle</span><span>candid</span><span>editor's red pen</span></div></div>
          <div class="field"><label>Default drill length (minutes)</label><input type="text" data-s="drillMinutes" value="${settings.drillMinutes}" inputmode="numeric"></div>
          <div class="field"><label class="check"><input type="checkbox" data-privacy ${settings.privacy.denyDataCollection ? 'checked' : ''}> Only use providers that don't retain or train on prompts</label></div>
          <button class="primary" data-save style="margin-top:12px">Save settings</button>
        </section>
        <section class="card">
          <div class="eyebrow">Where things live</div>
          <p style="font-size:.88rem;margin:0">Writing, profile and logs: <code>${esc(dataDir)}</code><br>Prompts: <code>prompts/</code> · Coach configs: <code>coaches/</code> · Library: <code>library/</code></p>
        </section>
      </div>
    </div>
    <section class="card" style="margin-top:14px">
      <div class="row between"><div class="eyebrow">Recent model calls</div><span class="muted" style="font-size:.85rem">Month to date: ${money(ctx.state.stats.cost.month)}</span></div>
      ${usage.length ? `<table><thead><tr><th>When</th><th>Task</th><th>Model</th><th class="num">Tokens in / out</th><th class="num">Cost</th></tr></thead><tbody>
        ${usage.slice(0, 40).map((u) => `<tr><td class="muted">${fmtDateTime(u.at)}</td><td>${esc(u.task)}</td><td><code>${esc(u.model)}</code></td><td class="num">${u.promptTokens ?? '—'} / ${u.completionTokens ?? '—'}</td><td class="num">${money(u.cost)}</td></tr>`).join('')}
      </tbody></table>` : '<p class="muted">No calls yet.</p>'}
    </section>`;

  let models = null;
  const showPrices = () => {
    if (!models) return;
    el.querySelectorAll('[data-model]').forEach((i) => {
      const m = models.find((x) => x.id === i.value.trim());
      el.querySelector(`[data-price="${i.dataset.model}"]`).innerHTML = m
        ? `${esc(m.name)} · $${m.prompt.toFixed(2)} in / $${m.completion.toFixed(2)} out per million tokens`
        : '<span style="color:var(--accent)">Not in the OpenRouter list — check the id.</span>';
    });
  };
  el.querySelector('[data-loadmodels]').addEventListener('click', (e) => busy(e.currentTarget, async () => {
    models = await api.get('/api/models');
    el.querySelector('#models').innerHTML = models.map((m) => `<option value="${esc(m.id)}">${esc(m.name)}</option>`).join('');
    showPrices();
  }));
  el.querySelectorAll('[data-model]').forEach((i) => i.addEventListener('input', showPrices));

  el.querySelector('[data-savekey]').addEventListener('click', (e) => busy(e.currentTarget, async () => {
    const key = el.querySelector('[data-key]').value.trim();
    if (!key) throw new Error('Paste a key first.');
    await api.put('/api/key', { key });
    toast('Key saved.');
    await ctx.refresh();
    render(el, _p, ctx);
  }));
  el.querySelector('[data-clearkey]')?.addEventListener('click', (e) => busy(e.currentTarget, async () => {
    await api.put('/api/key', { key: '' });
    toast('Key removed.');
    await ctx.refresh();
    render(el, _p, ctx);
  }));
  el.querySelector('[data-save]').addEventListener('click', (e) => busy(e.currentTarget, async () => {
    const modelsPatch = {};
    el.querySelectorAll('[data-model]').forEach((i) => { modelsPatch[i.dataset.model] = i.value.trim(); });
    await api.put('/api/settings', {
      coach: el.querySelector('[data-s=coach]').value,
      defaultTone: Number(el.querySelector('[data-s=defaultTone]').value),
      drillMinutes: Number(el.querySelector('[data-s=drillMinutes]').value) || 15,
      privacy: { denyDataCollection: el.querySelector('[data-privacy]').checked },
      models: modelsPatch,
    });
    toast('Settings saved.');
    ctx.refresh();
  }));
}
