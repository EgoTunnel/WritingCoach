// Kind-specific context: what sits beside the page for a drill, an imitation,
// a constraint, or a project.

import { esc, wordCount } from '../ui.js';
import { diffWords, diffStats } from '../diff.js';

// ---------- constraint checks ----------

const sentencesOf = (t) => (String(t).replace(/\n+/g, ' ').match(/[^.!?]+[.!?]+["'”’)]*|[^.!?]+$/g) || []).map((s) => s.trim()).filter(Boolean);

export function constraintChecks(check = {}, text = '') {
  const wc = wordCount(text);
  const out = [];
  if (check.exactWords) out.push({ label: `Exactly ${check.exactWords} words (now ${wc})`, ok: wc === check.exactWords });
  if (check.maxWords) out.push({ label: `At most ${check.maxWords} words (now ${wc})`, ok: wc > 0 && wc <= check.maxWords });
  if (check.minWords) out.push({ label: `At least ${check.minWords} words (now ${wc})`, ok: wc >= check.minWords });
  if (check.dialogueOnly) {
    const paras = text.split(/\n+/).map((p) => p.trim()).filter(Boolean);
    const bad = paras.filter((p) => !/^["“'‘—–-]/.test(p)).length;
    out.push({ label: bad ? `Dialogue only (${bad} paragraph${bad > 1 ? 's' : ''} aren't speech)` : 'Dialogue only', ok: paras.length > 0 && !bad });
  }
  if (check.lineWords) {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const bad = lines.filter((l) => wordCount(l) !== check.lineWords).length;
    out.push({ label: `Every line exactly ${check.lineWords} words${bad ? ` (${bad} off)` : ''}`, ok: lines.length > 0 && !bad });
  }
  if (check.maxSentences) {
    const n = sentencesOf(text).length;
    out.push({ label: `At most ${check.maxSentences} sentence${check.maxSentences > 1 ? 's' : ''} (now ${n})`, ok: n > 0 && n <= check.maxSentences });
  }
  if (check.maxSentenceWords) {
    const long = sentencesOf(text).filter((s) => wordCount(s) > check.maxSentenceWords).length;
    out.push({ label: `No sentence over ${check.maxSentenceWords} words${long ? ` (${long} over)` : ''}`, ok: wc > 0 && !long });
  }
  if (check.forbidLetter) {
    const n = (text.match(new RegExp(check.forbidLetter, 'gi')) || []).length;
    out.push({ label: `No letter “${check.forbidLetter}”${n ? ` (${n} found)` : ''}`, ok: wc > 0 && !n });
  }
  if (check.forbidWords) {
    const set = new Set(check.forbidWords.map((w) => w.toLowerCase()));
    const found = (text.toLowerCase().match(/[a-z']+/g) || []).filter((w) => set.has(w));
    out.push({ label: found.length ? `Forbidden words found: ${[...new Set(found)].join(', ')}` : `None of: ${check.forbidWords.slice(0, 6).join(', ')}…`, ok: wc > 0 && !found.length });
  }
  if (check.allQuestions) {
    const s = sentencesOf(text);
    const bad = s.filter((x) => !/\?["'”’)]*$/.test(x)).length;
    out.push({ label: `Every sentence a question${bad ? ` (${bad} aren't)` : ''}`, ok: s.length > 0 && !bad });
  }
  return out;
}

export const checksHTML = (checks) => `<ul class="check-list">${checks.map((c) => `<li class="${c.ok ? 'ok' : 'no'}">${c.ok ? '✓' : '○'} ${esc(c.label)}</li>`).join('')}</ul>`;

// ---------- context panels ----------

export function drillPanel(meta) {
  const d = meta.drill || {};
  return `<section class="card prompt-card">
    <div class="eyebrow">Daily drill · ${esc(d.skill || '')} · ${d.minutes || 15} min${d.wordTarget ? ` · ~${d.wordTarget} words` : ''}</div>
    <p class="prompt-text" style="margin:0">${esc(d.prompt)}</p>
    ${d.why ? `<p class="muted" style="margin:8px 0 0;font-size:.88rem"><em>${esc(d.why)}</em></p>` : ''}
  </section>`;
}

export function constraintPanel(meta, text) {
  const c = meta.constraint || {};
  return `<section class="card prompt-card">
    <div class="eyebrow">Constraint lab · ${esc(c.title || '')}</div>
    <p class="prompt-text">${esc(c.prompt)}</p>
    <div data-checks>${checksHTML(constraintChecks(c.check, text))}</div>
  </section>`;
}

export function draftPanel(meta) {
  return `<section class="card">
    <div class="field"><label>What is this for?</label>
      <input type="text" data-meta="purpose" value="${esc(meta.purpose || '')}" placeholder="e.g. A LinkedIn post for colleagues in learning design"></div>
  </section>`;
}

export function projectPanel(meta) {
  const p = meta.project || {};
  return `<section class="card">
    <div class="eyebrow">Project</div>
    <div class="field"><label>Purpose</label><input type="text" data-project="purpose" value="${esc(p.purpose || '')}" placeholder="What is this piece trying to do?"></div>
    <div class="field"><label>Reader</label><input type="text" data-project="reader" value="${esc(p.reader || '')}" placeholder="Who is it for?"></div>
    <p class="muted" style="font-size:.82rem;margin:10px 0 0">The plan is yours. The editor reads it and asks questions; it never writes the outline.</p>
  </section>`;
}

const EXERCISE = {
  copywork: { name: 'Copywork with annotation', how: 'Copy the passage by hand, slowly — typing it is the point. Then note what you noticed: sentence shapes, punctuation, the job each sentence does.' },
  franklin: { name: 'The Franklin rebuild', how: 'Read the passage and make short notes on its moves — not its sentences. Set it aside. Rebuild it from your notes alone. Then compare.' },
  pastiche: { name: 'Pastiche', how: 'Write on a new subject in the manner of the model: its sentence shapes, rhythm, stance — your content.' },
};

export function imitationPanel(meta, model, text) {
  const im = meta.imitation || {};
  const ex = EXERCISE[im.exercise] || EXERCISE.copywork;
  const stage = im.stage || 1;
  const hidden = im.exercise === 'franklin' && stage === 2;
  let steps = '';
  if (im.exercise === 'franklin') {
    steps = `<div class="segmented" style="margin:10px 0">
      ${['Read & outline', 'Rebuild', 'Compare'].map((s, i) => `<button class="small ${stage === i + 1 ? 'on' : ''}" data-stage="${i + 1}">${i + 1}. ${s}</button>`).join('')}
    </div>`;
  }
  const passage = model
    ? `<div class="passage ${hidden ? 'hidden-passage' : ''}" ${hidden ? 'aria-hidden="true"' : ''}>${esc(model.text)}</div>
       <div class="attribution">${esc(model.author)}, <em>${esc(model.title)}</em> (${esc(model.year)})</div>`
    : '<p class="muted">Model passage not found.</p>';

  let extra = '';
  if (im.exercise === 'franklin') {
    extra = `<div class="field" style="margin-top:12px"><label>Your notes on its moves (not its sentences)</label>
      <textarea data-imitation="outline" rows="5" ${stage === 3 ? 'readonly' : ''} placeholder="1. Opens with a general truth stated as if obvious&#10;2. Qualifies it with an ironic 'however'…">${esc(im.outline || '')}</textarea></div>
      ${stage === 1 ? '<button class="primary small" data-stage="2" style="margin-top:8px">Set it aside and rebuild →</button>' : ''}
      ${stage === 2 ? '<button class="primary small" data-stage="3" style="margin-top:8px">Done — compare →</button>' : ''}`;
  }
  if (im.exercise === 'copywork') {
    extra = `<div class="field" style="margin-top:12px"><label>What you noticed</label>
      <textarea data-imitation="annotations" rows="5" placeholder="Where the main clause lands; what the semicolons are doing; which word carries the weight…">${esc(im.annotations || '')}</textarea></div>`;
  }
  if (im.exercise === 'pastiche') {
    extra = `<div class="field" style="margin-top:12px"><label>Your new subject</label>
      <input type="text" data-imitation="subject" value="${esc(im.subject || '')}" placeholder="e.g. the first day of a new LMS rollout"></div>`;
  }

  let fidelity = '';
  if (model && text.trim() && (im.exercise === 'copywork' || (im.exercise === 'franklin' && stage === 3))) {
    const parts = diffWords(model.text, text);
    const st = diffStats(parts);
    fidelity = `<details style="margin-top:12px" ${im.exercise === 'franklin' ? 'open' : ''}><summary style="cursor:pointer;font-size:.9rem">${im.exercise === 'copywork' ? 'Check my copy' : 'Original vs. your rebuild'} <span class="muted">(${st.added} added, ${st.removed} removed)</span></summary>
      <div class="diff" style="margin-top:8px;font-size:.95rem">${parts.map((p) => p.type === 'same' ? esc(p.text) : p.type === 'add' ? `<ins>${esc(p.text)}</ins>` : `<del>${esc(p.text)}</del>`).join('')}</div>
      <p class="muted" style="font-size:.8rem">Struck through: the original's words you didn't use. Highlighted: yours.</p></details>`;
  }

  return `<section class="card prompt-card">
    <div class="eyebrow">Imitation · ${ex.name}</div>
    <p class="muted" style="font-size:.88rem">${ex.how}</p>
    ${steps}
    ${hidden ? '<p class="notice">The original is set aside. Rebuild it from your notes.</p>' : ''}
    ${passage}
    ${extra}
    ${fidelity}
  </section>`;
}

export const IMITATION_EXERCISES = EXERCISE;
