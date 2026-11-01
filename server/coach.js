// Everything the coach does with a model. Prompts are read fresh from prompts/ and
// coaches/ on every call, so you can tune them while the app runs.

import fs from 'node:fs/promises';
import path from 'node:path';
import * as store from './store.js';
import { chat } from './openrouter.js';
import { guardResponse } from './guard.js';
import { getExercises, getModel, pickExercise } from './library.js';
import { httpError, localDate, shortId, wordCount } from './util.js';

// ---------- prompt assembly ----------

async function loadPrompt(name) {
  return fs.readFile(path.join(store.ROOT, 'prompts', `${name}.md`), 'utf8');
}

async function loadCoach(name) {
  try {
    const raw = await fs.readFile(path.join(store.ROOT, 'coaches', `${name}.md`), 'utf8');
    return raw.replace(/<!--[\s\S]*?-->/g, '').trim();
  } catch {
    throw httpError(500, `Coach config "${name}" not found in coaches/.`);
  }
}

export async function listCoaches() {
  const files = await fs.readdir(path.join(store.ROOT, 'coaches'));
  return files.filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, ''));
}

const fill = (tpl, vars) => tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '');

async function system(task, vars = {}) {
  const settings = await store.getSettings();
  const [coach, guard, prompt] = await Promise.all([loadCoach(settings.coach), loadPrompt('guardrails'), loadPrompt(task)]);
  return [coach, guard, fill(prompt, vars)].join('\n\n---\n\n');
}

function profileBlock(p, { includeHypotheses = true } = {}) {
  const lines = [];
  lines.push(`Writer: ${p.writer || 'the writer'}`);
  if (p.goals?.length) lines.push('Goals (in their words):', ...p.goals.map((g) => `- ${g}`));
  if (p.focus?.skill) lines.push(`Current focus skill: ${p.focus.skill} (${p.focus.genre || 'any genre'}, since ${p.focus.since || 'recently'})`);
  if (p.phase) lines.push(`Drill phase: ${p.phase === 'rotate-fiction' ? 'fiction rotates in alongside non-fiction' : 'non-fiction leads until the habit holds'}`);
  if (p.influences?.length) lines.push('Influences and target voices:', ...p.influences.map((x) => `- ${x}`));
  const confirmed = (p.patterns || []).filter((x) => x.status === 'confirmed');
  const proposed = (p.patterns || []).filter((x) => x.status !== 'confirmed');
  if (confirmed.length) lines.push('Confirmed patterns (the writer agrees these are true):', ...confirmed.map((x) => `- [${x.id}] ${x.text}`));
  if (includeHypotheses && proposed.length) lines.push('Hypotheses (NOT confirmed — do not treat as fact):', ...proposed.map((x) => `- [${x.id}] ${x.text}`));
  if (p.strengths?.length) lines.push('Strengths to protect (do not edit these out):', ...p.strengths.map((x) => `- ${x.text}`));
  const open = (p.issues || []).filter((i) => !i.resolvedAt);
  const resolved = (p.issues || []).filter((i) => i.resolvedAt);
  if (open.length) lines.push('Open issues:', ...open.map((i) => `- [${i.id}] ${i.skill}: ${i.text} (since ${i.firstSeen})`));
  if (resolved.length) lines.push('Resolved issues:', ...resolved.map((i) => `- ${i.skill}: ${i.text} (seen ${i.firstSeen}, resolved ${i.resolvedAt})`));
  return lines.join('\n');
}

/** The highest-leverage changes named in recent feedback, newest first, with dates. */
export async function recentIssues(limit = 12, excludePieceId) {
  const pieces = await store.listPieces();
  const out = [];
  for (const meta of pieces) {
    if (meta.id === excludePieceId) continue;
    const reviews = meta.feedback.filter((f) => f.kind === 'review').slice(-3);
    for (const f of reviews) {
      try {
        const fb = await store.getFeedback(meta.id, f.id);
        for (const c of fb.response?.changes || []) {
          out.push({ date: localDate(new Date(fb.at)), piece: meta.title, skill: c.skill || c.name, name: c.name });
        }
      } catch { /* skip unreadable */ }
    }
  }
  return out.sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
}

const issuesBlock = (issues) => issues.length
  ? issues.map((i) => `- ${i.date} · "${i.piece}" · ${i.skill}${i.name && i.name !== i.skill ? ` (${i.name})` : ''}`).join('\n')
  : '(none yet)';

const wrap = (name, body, attrs = '') => `<${name}${attrs ? ' ' + attrs : ''}>\n${body}\n</${name}>`;

function purposeOf(meta) {
  if (meta.kind === 'drill' && meta.drill) return `Daily drill: ${meta.drill.prompt}`;
  if (meta.kind === 'constraint' && meta.constraint) return `Constraint lab: ${meta.constraint.prompt}`;
  if (meta.kind === 'project' && meta.project) return `Project: ${meta.project.purpose || ''} Reader: ${meta.project.reader || ''}`;
  return meta.purpose || '(no purpose stated)';
}

// ---------- daily drill ----------

export async function today({ action } = {}) {
  const profile = await store.getProfile();
  const state = (await store.getToday()) || { history: [] };
  const date = localDate();

  if (!action && state.date === date && state.drill) return state.drill;

  if (action === 'tailor') {
    if (state.date !== date || !state.drill) {
      await today();
      return today({ action });
    }
    const seed = state.drill;
    const exercises = await getExercises();
    const ex = exercises.find((e) => e.id === seed.exerciseId) || seed;
    const issues = await recentIssues(6);
    const { data, cost } = await chat({
      task: 'drill',
      modelRole: 'drill',
      temperature: 0.9,
      maxTokens: 600,
      messages: [
        { role: 'system', content: await system('drill') },
        { role: 'user', content: [
          wrap('writer_profile', profileBlock(profile)),
          wrap('recent_issues', issuesBlock(issues)),
          wrap('seed_exercise', `${ex.title}: ${ex.prompt}\nSkills: ${(ex.skills || [ex.skill]).join(', ')}\nGenre: ${ex.genre}`),
        ].join('\n\n') },
      ],
    });
    const drill = {
      date,
      exerciseId: seed.exerciseId,
      title: String(data.title || seed.title),
      prompt: String(data.prompt || seed.prompt),
      skill: String(data.skill || seed.skill),
      genre: data.genre || seed.genre,
      minutes: Number(data.minutes) || seed.minutes,
      wordTarget: Number(data.wordTarget) || seed.wordTarget,
      why: data.why || '',
      source: 'coach',
      cost,
    };
    await store.saveToday({ ...state, date, drill });
    return drill;
  }

  // New library drill (first open of the day, or "another one").
  const exercises = await getExercises();
  const skip = action === 'shuffle' && state.drill ? [state.drill.exerciseId] : [];
  const ex = pickExercise(exercises, profile, state.history || [], { skip });
  const settings = await store.getSettings();
  const drill = {
    date,
    exerciseId: ex.id,
    title: ex.title,
    prompt: ex.prompt,
    skill: ex.skills[0],
    genre: ex.genre,
    minutes: ex.minutes || settings.drillMinutes,
    wordTarget: ex.wordTarget,
    source: 'library',
  };
  const history = [ex.id, ...(state.history || []).filter((x) => x !== ex.id)].slice(0, 20);
  await store.saveToday({ date, drill, history });
  return drill;
}

// ---------- draft review: the four-layer feedback ----------

const TONES = {
  1: 'Gentle. Warm and patient; lead with what works; frame the change as an invitation. The evidence rule still applies.',
  2: 'Warm. Encouraging but honest; the change is named clearly and kindly.',
  3: 'Candid. A good workshop colleague: direct, specific, no padding.',
  4: 'Blunt. Say the problem plainly and don\'t cushion it. Still one or two issues only.',
  5: 'Editor\'s red pen. Exacting and unsentimental, as if this were going to print tomorrow. Still one or two issues only, and still quote everything.',
};

const FOCUS = {
  general: 'General: whatever matters most for this piece\'s purpose.',
  structure: 'Structure: order, proportion, where things arrive, the shape of the whole.',
  voice: 'Voice: diction, rhythm, stance — does it sound like a person, and like this writer?',
  line: 'Line level: sentences, word choice, cadence. Still at most two issues; name the move, don\'t rewrite.',
  argument: 'Argument: claim, evidence, concession, the turn. Is the reasoning sound and the claim where it should be?',
  works: 'Just tell me if it works: one honest paragraph of reader response, then the single most important change. Keep everything short.',
  spar: 'Sparring partner: argue back against the piece\'s central claim as a sharp, fair opponent would. Use `readerResponse` for your counter-argument, `changes` for the weakest point in their reasoning, and `wayIn` for the question they must answer to win.',
};

export async function critique(pieceId, opts = {}) {
  const { meta, text } = await store.getPiece(pieceId);
  if (!text.trim()) throw httpError(400, 'There\'s nothing to read yet. Write something first.');
  const profile = await store.getProfile();
  const settings = await store.getSettings();
  const depth = Math.min(4, Math.max(1, Number(opts.depth) || 4));
  const tone = Math.min(5, Math.max(1, Number(opts.tone) || settings.defaultTone));
  const focus = FOCUS[opts.focus] ? opts.focus : 'general';
  const blind = !!opts.blind;
  const encouragementOnly = !!opts.encouragementOnly;
  const lineEdits = !!opts.lineEdits && !encouragementOnly;

  const vars = {
    depth,
    focus: FOCUS[focus],
    tone: `${tone}/5 — ${TONES[tone]}`,
    encouragement: encouragementOnly
      ? 'ENCOURAGEMENT ONLY was requested. Give reader response and what\'s working (quoted, specific, earned). Omit `changes` and `wayIn`. Set `critiqued` to false.'
      : 'A full critique was requested.',
    lineEdits: lineEdits
      ? 'The writer explicitly asked for line edits (this is logged as a rewrite). Add up to five `lineEdits`, each quoting their exact words with a minimal suggestion.'
      : 'Line edits were NOT requested. Do not include `lineEdits`.',
    blind: blind
      ? 'BLIND RE-REVIEW: read this as if for the first time, without the writer\'s history. This checks whether earlier feedback was too kind.'
      : '',
  };

  const issues = blind ? [] : await recentIssues(10, pieceId);
  const userParts = [
    wrap('writer_profile', blind ? `Writer: ${profile.writer}\n(Blind re-review: history withheld.)` : profileBlock(profile)),
    blind ? '' : wrap('recent_issues', issuesBlock(issues)),
    wrap('purpose', purposeOf(meta) + (opts.purpose ? `\nWhat they want from this reading: ${opts.purpose}` : '')),
    wrap('draft', text, `title="${(meta.title || '').replace(/"/g, "'")}" kind="${meta.kind}" words="${wordCount(text)}"`),
  ].filter(Boolean);

  const { data, cost, model } = await chat({
    task: 'critique',
    modelRole: 'critique',
    temperature: 0.5,
    maxTokens: 1800,
    messages: [
      { role: 'system', content: await system('feedback', vars) },
      { role: 'user', content: userParts.join('\n\n') },
    ],
  });

  // Enforce the shape in code, whatever the model did.
  const response = {
    readerResponse: String(data.readerResponse || ''),
    working: depth >= 2 ? (data.working || []).slice(0, 2) : [],
    changes: depth >= 3 && !encouragementOnly ? (data.changes || []).slice(0, 2) : [],
    wayIn: depth >= 4 && !encouragementOnly ? String(data.wayIn || '') : '',
    progressNote: blind ? '' : String(data.progressNote || ''),
    lineEdits: lineEdits ? (data.lineEdits || []).slice(0, 5) : [],
    critiqued: !encouragementOnly,
  };

  const g = guardResponse(response, { draft: text, allowLineEdits: lineEdits });
  if (lineEdits) await store.logRewrite({ type: 'line-edits', pieceId, title: meta.title, count: response.lineEdits.length });

  const record = await store.addFeedback(pieceId, {
    kind: 'review',
    options: { depth, tone, focus, blind, encouragementOnly, lineEdits, purpose: opts.purpose || '' },
    response: g.value,
    withheld: g.withheld,
    unverified: g.unverified,
    model,
    cost,
  }, feedbackMarkdown(meta, g.value, { depth, tone, focus, blind, encouragementOnly }));
  return publicFeedback(record);
}

function feedbackMarkdown(meta, r, o) {
  const out = [`# Feedback on "${meta.title}"`, '', `*${new Date().toLocaleString()} · ${o.focus} · tone ${o.tone}/5 · depth ${o.depth}${o.blind ? ' · blind re-review' : ''}*`, ''];
  if (o.encouragementOnly) out.push('> Encouragement only — this piece has not been critiqued.', '');
  if (r.readerResponse) out.push('## Reader response', '', r.readerResponse, '');
  if (r.working?.length) out.push('## What\'s working', '', ...r.working.map((w) => `- "${w.quote}" — ${w.why}`), '');
  if (r.changes?.length) out.push('## The highest-leverage change', '', ...r.changes.map((c) => `- **${c.name}** at "${c.quote}" — ${c.why}`), '');
  if (r.wayIn) out.push('## A way in', '', r.wayIn, '');
  if (r.progressNote) out.push('## Progress', '', r.progressNote, '');
  if (r.lineEdits?.length) out.push('## Line edits (requested, logged)', '', ...r.lineEdits.map((l) => `- "${l.quote}" → ${l.suggestion}`), '');
  return out.join('\n');
}

/** Strip withheld passages before sending to the browser; keep only their size. */
export function publicFeedback(fb) {
  const { withheld = [], ...rest } = fb;
  return { ...rest, withheld: withheld.map((w, i) => ({ index: i, words: w.words, revealed: !!w.revealed, text: w.revealed ? w.text : undefined })) };
}

// ---------- imitation studio ----------

export async function compareImitation(pieceId) {
  const { meta, text } = await store.getPiece(pieceId);
  const im = meta.imitation || {};
  const model = await getModel(im.modelId);
  if (!model) throw httpError(404, 'Model passage not found.');
  if (!text.trim() && !(im.annotations || '').trim()) throw httpError(400, 'Write your version first.');

  const user = [
    wrap('model', model.text, `author="${model.author}" title="${model.title}"`),
    im.outline ? wrap('outline', im.outline) : '',
    im.annotations ? wrap('annotations', im.annotations) : '',
    im.subject ? wrap('new_subject', im.subject) : '',
    wrap('draft', text),
  ].filter(Boolean).join('\n\n');

  const { data, cost, model: used } = await chat({
    task: 'compare',
    modelRole: 'critique',
    temperature: 0.4,
    maxTokens: 1600,
    messages: [
      { role: 'system', content: await system('imitation', { exercise: im.exercise }) },
      { role: 'user', content: user },
    ],
  });
  const response = {
    readerResponse: String(data.readerResponse || ''),
    moves: (data.moves || []).slice(0, 6),
    keep: String(data.keep || ''),
    takeaway: String(data.takeaway || ''),
  };
  const g = guardResponse(response, { draft: text + '\n' + (im.annotations || ''), sources: [model.text] });
  const record = await store.addFeedback(pieceId, { kind: 'compare', response: g.value, withheld: g.withheld, unverified: g.unverified, model: used, cost },
    `# Comparison: "${meta.title}"\n\n${g.value.readerResponse}\n\n${g.value.moves.map((m) => `- **${m.move}** — original: "${m.original}" · yours: "${m.yours}" — ${m.observation}`).join('\n')}\n\n**Keep:** ${g.value.keep}\n\n**Next:** ${g.value.takeaway}\n`);
  return publicFeedback(record);
}

// ---------- project companion ----------

export async function editorQuestions(pieceId) {
  const { meta, text } = await store.getPiece(pieceId);
  const pr = meta.project || {};
  if (!(pr.plan || '').trim() && !text.trim()) throw httpError(400, 'Write your plan first. The editor interrogates your outline; it never makes one.');
  const previous = (await store.listFeedback(pieceId)).filter((f) => f.kind === 'questions').slice(-3);
  const qa = previous.flatMap((f) => (f.response.questions || []).map((q, i) => `Q (${localDate(new Date(f.at))}): ${q.question}\nA: ${f.answers?.[i] || '(unanswered)'}`)).join('\n\n');
  const draftWords = text.split(/\s+/);
  const draftExcerpt = draftWords.length > 6000 ? draftWords.slice(0, 6000).join(' ') + '\n[…truncated]' : text;

  const user = [
    wrap('project', `Title: ${meta.title}\nPurpose: ${pr.purpose || '(not stated)'}\nReader: ${pr.reader || '(not stated)'}\nVersions saved: ${meta.versions.length}`),
    wrap('plan', pr.plan || '(no plan yet)'),
    qa ? wrap('earlier_questions', qa) : '',
    wrap('draft', draftExcerpt || '(no draft yet)'),
  ].filter(Boolean).join('\n\n');

  const { data, cost, model } = await chat({
    task: 'questions',
    modelRole: 'companion',
    temperature: 0.6,
    maxTokens: 1200,
    messages: [
      { role: 'system', content: await system('questions') },
      { role: 'user', content: user },
    ],
  });
  const response = { observation: String(data.observation || ''), questions: (data.questions || []).slice(0, 5) };
  const g = guardResponse(response, { draft: (pr.plan || '') + '\n' + text, paraphrase: false });
  const record = await store.addFeedback(pieceId, { kind: 'questions', response: g.value, withheld: g.withheld, unverified: g.unverified, answers: [], model, cost },
    `# Editor's questions: "${meta.title}"\n\n${g.value.observation}\n\n${g.value.questions.map((q, i) => `${i + 1}. ${q.question}`).join('\n')}\n`);
  return publicFeedback(record);
}

// ---------- requested rewrites (logged) ----------

export async function rewrite(pieceId, { passage, reason }) {
  const { meta, text } = await store.getPiece(pieceId);
  const p = (passage || '').trim() || text.trim();
  if (!p) throw httpError(400, 'Nothing to rewrite.');
  if (!(reason || '').trim()) throw httpError(400, 'Say why you want the rewrite. It goes in the log.');
  const profile = await store.getProfile();
  await store.logRewrite({ type: 'rewrite', pieceId, title: meta.title, words: wordCount(p), reason });
  const { data, cost, model } = await chat({
    task: 'rewrite',
    modelRole: 'critique',
    temperature: 0.5,
    maxTokens: 1500,
    messages: [
      { role: 'system', content: await system('rewrite') },
      { role: 'user', content: [wrap('writer_profile', profileBlock(profile)), wrap('reason', reason), wrap('passage', p)].join('\n\n') },
    ],
  });
  const record = await store.addFeedback(pieceId, { kind: 'rewrite', reason, passage: p, response: { rewrite: String(data.rewrite || ''), lesson: String(data.lesson || ''), tryNext: String(data.tryNext || '') }, model, cost },
    `# Requested rewrite (logged): "${meta.title}"\n\n**Reason:** ${reason}\n\n## Passage\n\n${p}\n\n## Rewrite\n\n${data.rewrite}\n\n**The move:** ${data.lesson}\n\n**Try next:** ${data.tryNext}\n`);
  return publicFeedback(record);
}

export async function revealWithheld(pieceId, fid, index) {
  const fb = await store.getFeedback(pieceId, fid);
  const w = fb.withheld?.[index];
  if (!w) throw httpError(404, 'Nothing withheld there.');
  if (!w.revealed) {
    w.revealed = true;
    await store.updateFeedback(pieceId, fid, { withheld: fb.withheld });
    const { meta } = await store.getPiece(pieceId);
    await store.logRewrite({ type: 'revealed-suggestion', pieceId, title: meta.title, words: w.words });
  }
  return { text: w.text };
}

// ---------- the writer model: proposals after reflection ----------

export async function proposeProfileUpdates({ pieceId, reflection }) {
  const profile = await store.getProfile();
  let pieceBlock = '';
  if (pieceId) {
    const { meta, text } = await store.getPiece(pieceId);
    const fbs = (await store.listFeedback(pieceId)).filter((f) => f.kind === 'review' || f.kind === 'compare').slice(-2);
    pieceBlock = [
      wrap('draft', text, `title="${meta.title}" kind="${meta.kind}"`),
      fbs.length ? wrap('feedback', fbs.map((f) => JSON.stringify(f.response)).join('\n')) : '',
    ].join('\n\n');
  }
  const reflections = (await store.listReflections()).slice(-6);
  const days = await writingDays();
  const last14 = days.filter((d) => d >= localDate(new Date(Date.now() - 13 * 864e5))).length;
  const issues = await recentIssues(12);

  const user = [
    wrap('profile_json', JSON.stringify(profile, null, 2)),
    pieceBlock,
    reflection ? wrap('this_reflection', `Hard: ${reflection.hard || ''}\nLiked: ${reflection.liked || ''}`) : '',
    wrap('recent_reflections', reflections.map((r) => `${r.date}: hard — ${r.hard || ''}; liked — ${r.liked || ''}`).join('\n') || '(none)'),
    wrap('recent_issues', issuesBlock(issues)),
    wrap('habit', `Writing days in the last 14: ${last14}. Total writing days: ${days.length}.`),
  ].filter(Boolean).join('\n\n');

  const { data } = await chat({
    task: 'profile-update',
    modelRole: 'companion',
    temperature: 0.3,
    maxTokens: 1200,
    messages: [
      { role: 'system', content: await system('profile-update') },
      { role: 'user', content: user },
    ],
  });
  const valid = ['add_pattern', 'confirm_pattern', 'remove_pattern', 'add_strength', 'add_issue', 'resolve_issue', 'change_focus', 'set_phase'];
  const fresh = (data.proposals || []).filter((p) => valid.includes(p.type)).slice(0, 4).map((p) => ({
    id: shortId(),
    created: new Date().toISOString(),
    pieceId: pieceId || null,
    status: 'pending',
    type: p.type,
    payload: p.payload || {},
    rationale: String(p.rationale || ''),
    evidence: String(p.evidence || ''),
  }));
  const all = await store.getProposals();
  await store.saveProposals([...all, ...fresh]);
  return fresh;
}

/** Apply (or reject) a proposal. `decision`: 'accept' | 'hypothesis' | 'reject'. */
export async function decideProposal(id, decision, edits = {}) {
  const all = await store.getProposals();
  const prop = all.find((p) => p.id === id);
  if (!prop) throw httpError(404, 'Proposal not found');
  if (prop.status !== 'pending') throw httpError(400, 'Already decided');
  const profile = await store.getProfile();
  const today = localDate();
  const payload = { ...prop.payload, ...edits };

  if (decision !== 'reject') {
    profile.patterns ||= []; profile.strengths ||= []; profile.issues ||= [];
    switch (prop.type) {
      case 'add_pattern':
        profile.patterns.push({ id: `p-${shortId()}`, text: payload.text, status: decision === 'hypothesis' ? 'proposed' : 'confirmed', since: today, evidence: prop.evidence });
        break;
      case 'confirm_pattern': {
        const pat = profile.patterns.find((x) => x.id === payload.id);
        if (pat) pat.status = 'confirmed';
        break;
      }
      case 'remove_pattern':
        profile.patterns = profile.patterns.filter((x) => x.id !== payload.id);
        break;
      case 'add_strength':
        profile.strengths.push({ id: `s-${shortId()}`, text: payload.text, since: today, evidence: prop.evidence });
        break;
      case 'add_issue':
        profile.issues.push({ id: `i-${shortId()}`, skill: payload.skill, text: payload.text, firstSeen: today, resolvedAt: null });
        break;
      case 'resolve_issue': {
        const iss = profile.issues.find((x) => x.id === payload.id);
        if (iss) iss.resolvedAt = today;
        break;
      }
      case 'change_focus':
        profile.focusHistory ||= [];
        if (profile.focus?.skill) profile.focusHistory.push({ ...profile.focus, until: today });
        profile.focus = { skill: payload.skill, genre: payload.genre || profile.focus?.genre, since: today };
        break;
      case 'set_phase':
        profile.phase = payload.phase;
        break;
    }
    await store.saveProfile(profile);
  }
  prop.status = decision === 'reject' ? 'rejected' : decision === 'hypothesis' ? 'hypothesis' : 'accepted';
  prop.decided = new Date().toISOString();
  await store.saveProposals(all);
  return { proposal: prop, profile };
}

// ---------- stats ----------

export async function writingDays() {
  const pieces = await store.listPieces();
  const days = new Set();
  for (const m of pieces) for (const v of m.versions) days.add(localDate(new Date(v.at)));
  return [...days].sort();
}

export async function stats({ since } = {}) {
  const [days, rewrites, usage, pieces, proposals, reflections] = await Promise.all([
    writingDays(), store.listRewrites(), store.listUsage(), store.listPieces(), store.getProposals(), store.listReflections(),
  ]);
  const now = Date.now();
  const weekAgo = now - 7 * 864e5;
  const rewriteWeeks = Array.from({ length: 8 }, (_, w) => rewrites.filter((r) => {
    const t = Date.parse(r.at);
    return t <= now - w * 7 * 864e5 && t > now - (w + 1) * 7 * 864e5;
  }).length).reverse();
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const sum = (arr) => arr.reduce((a, u) => a + (u.cost || 0), 0);
  const sessionUsage = since ? usage.filter((u) => u.at >= since) : [];
  const monthUsage = usage.filter((u) => Date.parse(u.at) >= monthStart.getTime());
  const reviews = pieces.reduce((a, m) => a + m.feedback.filter((f) => f.kind === 'review').length, 0);
  return {
    writingDays: days,
    daysLast7: days.filter((d) => d >= localDate(new Date(weekAgo + 864e5))).length,
    rewritesThisWeek: rewrites.filter((r) => Date.parse(r.at) > weekAgo).length,
    rewriteWeeks,
    cost: {
      session: sum(sessionUsage),
      month: sum(monthUsage),
      sessionCalls: sessionUsage.length,
      unknown: sessionUsage.some((u) => u.cost == null),
    },
    pieces: pieces.length,
    versions: pieces.reduce((a, m) => a + m.versions.length, 0),
    reviews,
    pendingProposals: proposals.filter((p) => p.status === 'pending').length,
    lastReflection: reflections.at(-1) || null,
  };
}
