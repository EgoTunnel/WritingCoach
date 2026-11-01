import { api, sessionStart } from './api.js';
import { $, $$, esc, money, toast } from './ui.js';
import today from './views/today.js';
import newDraft from './views/new.js';
import piece from './views/piece.js';
import imitation from './views/imitation.js';
import constraints from './views/constraints.js';
import projects from './views/projects.js';
import pieces from './views/pieces.js';
import reflections from './views/reflections.js';
import profile from './views/profile.js';
import settings from './views/settings.js';

const ROUTES = [
  [/^\/?$/, 'today', today],
  [/^\/new$/, 'new', newDraft],
  [/^\/piece\/([\w-]+)$/, 'pieces', piece],
  [/^\/imitation$/, 'imitation', imitation],
  [/^\/constraints$/, 'constraints', constraints],
  [/^\/projects$/, 'projects', projects],
  [/^\/pieces$/, 'pieces', pieces],
  [/^\/reflections$/, 'reflections', reflections],
  [/^\/profile$/, 'profile', profile],
  [/^\/settings$/, 'settings', settings],
];

const ctx = {
  state: null,
  /** A view can set this to block navigation (returns true if it's OK to leave). */
  canLeave: null,
  go(hash) { location.hash = hash; },
  async refresh() {
    ctx.state = await api.get(`/api/state?since=${encodeURIComponent(sessionStart)}`);
    paintChrome();
    return ctx.state;
  },
};

function paintChrome() {
  const s = ctx.state;
  if (!s) return;
  const c = s.stats.cost;
  $('#cost').innerHTML = `Session ${money(c.session)}${c.unknown ? '*' : ''} · Month ${money(c.month)}${s.mock ? '<br><span class="chip amber">mock mode</span>' : ''}`;
  const badge = $('#proposal-badge');
  badge.hidden = !s.stats.pendingProposals;
  badge.textContent = s.stats.pendingProposals;
}

let lastHash = location.hash;
async function render() {
  const path = location.hash.replace(/^#/, '') || '/';
  if (ctx.canLeave && !ctx.canLeave()) {
    history.replaceState(null, '', lastHash || '#/');
    return;
  }
  ctx.canLeave = null;
  lastHash = location.hash;
  const match = ROUTES.map(([re, nav, view]) => ({ m: path.match(re), nav, view })).find((x) => x.m);
  const el = $('#view');
  if (!match) {
    el.innerHTML = '<div class="empty"><h3>Nothing here.</h3><a href="#/">Back to today</a></div>';
    return;
  }
  $$('#nav a').forEach((a) => a.classList.toggle('active', a.dataset.route === match.nav));
  try {
    await ctx.refresh();
    el.innerHTML = '';
    window.scrollTo(0, 0);
    await match.view(el, match.m.slice(1), ctx);
  } catch (e) {
    el.innerHTML = `<div class="empty"><h3>Something went wrong.</h3><p>${esc(e.message)}</p></div>`;
    toast(e.message, 'error');
  }
}

window.addEventListener('hashchange', render);
window.addEventListener('beforeunload', (e) => {
  if (ctx.canLeave && !ctx.canLeave(true)) { e.preventDefault(); e.returnValue = ''; }
});
render();
