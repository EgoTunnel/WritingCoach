import { api } from '../api.js';
import { esc, busy, fmtDate, relDay, localDate, KIND_LABEL } from '../ui.js';

function greeting(name) {
  const h = new Date().getHours();
  const part = h < 5 ? 'Still up' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  return `${part}, ${esc(name || 'writer')}.`;
}

function week(days) {
  const set = new Set(days);
  const out = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 864e5);
    const key = localDate(d);
    out.push(`<div class="day ${set.has(key) ? 'on' : ''} ${i === 0 ? 'today' : ''}"><div class="dot"></div>${d.toLocaleDateString(undefined, { weekday: 'narrow' })}</div>`);
  }
  return `<div class="week">${out.join('')}</div>`;
}

function heatmap(days) {
  const set = new Set(days);
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - (7 * 12 - 1) - start.getDay());
  const cells = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const k = localDate(d);
    cells.push(`<i class="${set.has(k) ? 'on' : ''}" title="${k}"></i>`);
  }
  return `<div class="heat" aria-label="Writing days, last 12 weeks">${cells.join('')}</div>`;
}

function spark(weeks) {
  const max = Math.max(1, ...weeks);
  return `<div class="spark" aria-label="Rewrite requests per week, last 8 weeks">${weeks.map((n, i) => `<i class="${i === weeks.length - 1 ? 'now' : ''}" style="height:${Math.max(6, (n / max) * 100)}%" title="${n}"></i>`).join('')}</div>`;
}

export default async function render(el, _params, ctx) {
  const { profile, stats, hasKey, mock } = ctx.state;
  const [drill, pieces] = await Promise.all([api.get('/api/today'), api.get('/api/pieces')]);
  const existing = pieces.find((p) => p.kind === 'drill' && p.drill?.date === drill.date && p.drill?.exerciseId === drill.exerciseId && p.drill?.title === drill.title);
  const evidence = stats.lastReflection?.liked;

  el.innerHTML = `
    ${mock ? '<div class="mock-banner">Mock mode: the coach replies with canned text and nothing is sent to OpenRouter.</div>' : ''}
    ${!hasKey ? '<div class="notice amber" style="margin-bottom:14px">Drills work without a key. To get feedback, <a href="#/settings">add your OpenRouter key</a>.</div>' : ''}
    <div class="page-head hero">
      <div>
        <h1>${greeting(profile.writer)}</h1>
        <p>${stats.daysLast7 ? `You've written on ${stats.daysLast7} of the last 7 days.` : 'Ten minutes is enough. The sentences are yours.'}</p>
      </div>
    </div>

    <div class="grid two">
      <section class="card prompt-card">
        <div class="eyebrow">Today's drill · ${esc(drill.skill)} · ${esc(drill.genre)} · ${drill.minutes} min${drill.wordTarget ? ` · ~${drill.wordTarget} words` : ''}</div>
        <h2>${esc(drill.title)}</h2>
        <p class="prompt-text">${esc(drill.prompt)}</p>
        ${drill.why ? `<p class="muted"><em>${esc(drill.why)}</em></p>` : ''}
        <div class="row" style="margin-top:14px">
          ${existing
            ? `<a class="btn primary" href="#/piece/${existing.id}">Continue today's drill</a>`
            : '<button class="primary" data-start>Start writing</button>'}
          <button data-tailor title="The coach adapts this drill to your focus skill and recent work (cheap model)">${drill.source === 'coach' ? 'Re-tailor' : 'Tailor to me'}</button>
          <button class="ghost" data-shuffle>Another drill</button>
        </div>
      </section>

      <section class="card">
        <div class="eyebrow">This week</div>
        ${week(stats.writingDays)}
        <p class="muted" style="margin:10px 0 14px;font-size:.88rem">No streak to break. Just the days you showed up.</p>
        <div class="eyebrow">Last 12 weeks</div>
        ${heatmap(stats.writingDays)}
      </section>
    </div>

    <div class="grid three" style="margin-top:14px">
      <section class="card">
        <div class="eyebrow">Focus skill</div>
        <h3>${esc(profile.focus?.skill || 'Not set')}</h3>
        <p class="muted" style="font-size:.88rem">${esc(profile.focus?.genre || '')}${profile.focus?.since ? ` · since ${fmtDate(profile.focus.since)}` : ''}</p>
        <a href="#/profile" style="font-size:.88rem">See everything the coach believes about you →</a>
      </section>
      <section class="card">
        <div class="eyebrow">Rewrites requested this week</div>
        <div class="row between"><div class="big-num">${stats.rewritesThisWeek}</div>${spark(stats.rewriteWeeks)}</div>
        <p class="muted" style="font-size:.85rem;margin-top:8px">The goal is a line that trends toward zero.</p>
      </section>
      <section class="card">
        <div class="eyebrow">Evidence</div>
        ${evidence
          ? `<p class="evidence">${esc(evidence)}</p><p class="muted" style="font-size:.85rem">— you, ${relDay(stats.lastReflection.at)}</p>`
          : '<p class="muted" style="font-size:.9rem">After each session, note one thing you liked in your own sentences. It collects here, as evidence against the belief that you can\'t write.</p>'}
      </section>
    </div>

    ${stats.pendingProposals ? `<div class="notice accent" style="margin-top:14px">The coach has ${stats.pendingProposals} proposed change${stats.pendingProposals > 1 ? 's' : ''} to your profile. Nothing is recorded until you agree. <a href="#/profile">Review</a></div>` : ''}

    <section class="card" style="margin-top:14px">
      <div class="row between"><div class="eyebrow">Recent writing</div><a href="#/pieces" style="font-size:.85rem">All writing →</a></div>
      ${pieces.length ? `<ul class="list">${pieces.slice(0, 6).map((p) => `
        <li class="row"><a href="#/piece/${p.id}"><strong>${esc(p.title)}</strong></a>
          <span class="chip">${KIND_LABEL[p.kind] || p.kind}</span>
          <span class="spacer"></span>
          <span class="muted" style="font-size:.85rem">${p.versions.length} version${p.versions.length === 1 ? '' : 's'} · ${relDay(p.updated)}</span></li>`).join('')}</ul>`
        : '<p class="muted">Nothing yet. Start with today\'s drill.</p>'}
    </section>
  `;

  el.querySelector('[data-start]')?.addEventListener('click', (e) => busy(e.currentTarget, async () => {
    const { meta } = await api.post('/api/pieces', { kind: 'drill', title: drill.title, drill });
    ctx.go(`#/piece/${meta.id}`);
  }));
  el.querySelector('[data-tailor]').addEventListener('click', (e) => busy(e.currentTarget, async () => {
    await api.post('/api/today', { action: 'tailor' });
    await ctx.refresh();
    render(el, _params, ctx);
  }));
  el.querySelector('[data-shuffle]').addEventListener('click', (e) => busy(e.currentTarget, async () => {
    await api.post('/api/today', { action: 'shuffle' });
    render(el, _params, ctx);
  }));
}
