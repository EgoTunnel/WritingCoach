// Rendering coach responses: the four-layer review, imitation comparisons,
// editor's questions, and logged rewrites.

import { api } from '../api.js';
import { esc, prose, fmtDateTime, money, busy, toast, modal, confirmModal } from '../ui.js';

const FOCUS_LABEL = { general: 'General', structure: 'Structure', voice: 'Voice', line: 'Line level', argument: 'Argument', works: 'Does it work?', spar: 'Sparring partner' };
const TONE_LABEL = ['', 'gentle', 'warm', 'candid', 'blunt', 'red pen'];

const quote = (q, unverified) => {
  const bad = unverified?.includes(q);
  return `<div class="quote ${bad ? 'unverified' : ''}">“${esc(q)}”${bad ? ' <span class="chip amber" title="This quote was not found in your text. Treat the judgment with suspicion.">not in your text</span>' : ''}</div>`;
};

function metaLine(fb, currentVersion) {
  const bits = [fmtDateTime(fb.at)];
  if (fb.version) bits.push(`on v${fb.version}${fb.version < currentVersion ? ` <a href="#" data-since="${fb.version}">see changes since</a>` : ''}`);
  if (fb.options) {
    bits.push(FOCUS_LABEL[fb.options.focus] || fb.options.focus);
    bits.push(`tone: ${TONE_LABEL[fb.options.tone]}`);
    if (fb.options.blind) bits.push('<strong>blind re-review</strong>');
  }
  if (fb.cost != null) bits.push(money(fb.cost));
  return `<div class="fb-meta">${bits.join(' · ')}</div>`;
}

function withheldBlock(fb) {
  if (!fb.withheld?.length) return '';
  return fb.withheld.map((w) => w.revealed
    ? `<div class="withheld"><strong>Revealed suggestion (logged as a rewrite):</strong><br>${esc(w.text)}</div>`
    : `<div class="withheld">The guard withheld ${w.words} words of suggested wording — the coach tried to write a sentence for you.
        <button class="small ghost" data-reveal="${w.index}">Reveal (logs a rewrite)</button></div>`).join('');
}

function review(fb) {
  const r = fb.response;
  const u = fb.unverified || [];
  const parts = [];
  if (!r.critiqued) parts.push('<div class="notice sage" style="margin-bottom:10px">Encouragement only, as you asked. This piece has <strong>not</strong> been critiqued.</div>');
  if (r.readerResponse) parts.push(`<div class="fb-layer"><div class="eyebrow">${fb.options?.focus === 'spar' ? 'The other side' : 'Reader response'}</div>${prose(r.readerResponse)}</div>`);
  if (r.working?.length) parts.push(`<div class="fb-layer layer-working"><div class="eyebrow">What's working</div>${r.working.map((w) => `${quote(w.quote, u)}<p>${esc(w.why)}</p>`).join('')}</div>`);
  if (r.changes?.length) parts.push(`<div class="fb-layer layer-change"><div class="eyebrow">The highest-leverage change</div>${r.changes.map((c) => `<p><span class="craft">${esc(c.name)}</span>${c.skill && c.skill !== c.name ? ` <span class="chip">${esc(c.skill)}</span>` : ''}</p>${c.quote ? quote(c.quote, u) : ''}<p>${esc(c.why)}</p>`).join('')}</div>`);
  if (r.wayIn) parts.push(`<div class="fb-layer"><div class="eyebrow">A way in</div>${prose(r.wayIn)}</div>`);
  if (r.progressNote) parts.push(`<div class="progress-note">${esc(r.progressNote)}</div>`);
  if (r.lineEdits?.length) parts.push(`<div class="fb-layer" style="margin-top:10px"><div class="eyebrow">Line edits (requested, logged)</div>${r.lineEdits.map((l) => `${quote(l.quote, u)}<p>→ ${esc(l.suggestion)}</p>`).join('')}</div>`);
  return parts.join('');
}

function compare(fb) {
  const r = fb.response;
  const u = fb.unverified || [];
  return `
    <div class="fb-layer"><div class="eyebrow">Side by side</div>${prose(r.readerResponse)}</div>
    <div class="fb-layer"><div class="eyebrow">Move by move</div>
      ${r.moves.map((m) => `<div style="margin-bottom:12px"><p class="craft">${esc(m.move)}</p>
        <div class="quote ${u.includes(m.original) ? 'unverified' : ''}" style="border-left-color:var(--ink-3)">Original: “${esc(m.original)}”</div>
        ${m.yours ? `<div class="quote ${u.includes(m.yours) ? 'unverified' : ''}" style="border-left-color:var(--sage)">Yours: “${esc(m.yours)}”</div>` : '<div class="muted" style="font-size:.85rem">Not in your version.</div>'}
        <p>${esc(m.observation)}</p></div>`).join('')}
    </div>
    ${r.keep ? `<div class="fb-layer layer-working"><div class="eyebrow">Keep — this is yours</div>${prose(r.keep)}</div>` : ''}
    ${r.takeaway ? `<div class="fb-layer"><div class="eyebrow">Practise next</div>${prose(r.takeaway)}</div>` : ''}`;
}

function questions(fb) {
  const r = fb.response;
  return `
    ${r.observation ? `<div class="fb-layer"><div class="eyebrow">Where it stands</div>${prose(r.observation)}</div>` : ''}
    <div class="fb-layer"><div class="eyebrow">Editor's questions</div>
      ${r.questions.map((q, i) => `<div style="margin-bottom:12px">
        <p><strong>${i + 1}. ${esc(q.question)}</strong></p>
        ${q.quote ? `<div class="quote">“${esc(q.quote)}”</div>` : ''}
        ${q.why ? `<p class="muted" style="font-size:.85rem">${esc(q.why)}</p>` : ''}
        <textarea data-answer="${i}" rows="2" placeholder="Your answer (the next round of questions builds on it)">${esc(fb.answers?.[i] || '')}</textarea>
      </div>`).join('')}
      <button class="small" data-save-answers>Save answers</button>
    </div>`;
}

function rewriteBlock(fb) {
  const r = fb.response;
  return `
    <div class="notice accent" style="margin-bottom:10px">Requested rewrite — logged. Reason: ${esc(fb.reason)}</div>
    <div class="fb-layer"><div class="eyebrow">Your passage</div><div class="passage" style="font-size:.95rem">${esc(fb.passage)}</div></div>
    <div class="fb-layer"><div class="eyebrow">The coach's version</div><div class="passage" style="font-size:.95rem">${esc(r.rewrite)}</div></div>
    <div class="fb-layer"><div class="eyebrow">The move</div>${prose(r.lesson)}</div>
    <div class="fb-layer"><div class="eyebrow">Practise it yourself</div>${prose(r.tryNext)}</div>`;
}

export function renderFeedback(fb, currentVersion) {
  const body = { review, compare, questions, rewrite: rewriteBlock }[fb.kind]?.(fb) || '';
  const unverifiedNote = fb.unverified?.length && fb.kind !== 'rewrite'
    ? `<div class="notice amber" style="margin-top:8px">${fb.unverified.length} quote${fb.unverified.length > 1 ? 's' : ''} could not be found in the text. A judgment without evidence shouldn't be trusted.</div>` : '';
  return `<article class="fb" data-fid="${fb.id}">${metaLine(fb, currentVersion)}${body}${withheldBlock(fb)}${unverifiedNote}</article>`;
}

/** Wire up buttons inside a rendered feedback list. */
export function bindFeedback(root, pieceId, { onSince, onChange }) {
  root.querySelectorAll('[data-reveal]').forEach((b) => b.addEventListener('click', async () => {
    const ok = await confirmModal('Reveal the withheld wording?', '<p>This shows a sentence the coach wrote for you. It will be logged as a rewrite and counted on Today.</p>', 'Reveal and log it');
    if (!ok) return;
    const fid = b.closest('[data-fid]').dataset.fid;
    await busy(b, () => api.post(`/api/pieces/${pieceId}/feedback/${fid}/reveal`, { index: Number(b.dataset.reveal) }));
    onChange?.();
  }));
  root.querySelectorAll('[data-since]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    onSince?.(Number(a.dataset.since));
  }));
  root.querySelectorAll('[data-save-answers]').forEach((b) => b.addEventListener('click', () => busy(b, async () => {
    const art = b.closest('[data-fid]');
    const answers = [...art.querySelectorAll('[data-answer]')].map((t) => t.value);
    await api.put(`/api/pieces/${pieceId}/feedback/${art.dataset.fid}/answers`, { answers });
    toast('Answers saved.');
  })));
}

/** The rewrite request: deliberately a separate, logged, slightly effortful action. */
export function rewriteModal(pieceId, selection) {
  return modal(`
    <h2>Request a rewrite</h2>
    <p class="muted">This is the one place the coach writes your prose. It's logged, and the weekly count appears on Today. If you can name what's wrong, try asking for feedback with a narrower focus first.</p>
    <div class="field"><label>Passage</label><textarea data-passage rows="6" placeholder="Paste or select the passage. Leave blank for the whole piece.">${esc(selection || '')}</textarea></div>
    <div class="field"><label>Why do you want it rewritten? (required, goes in the log)</label><textarea data-reason rows="2" placeholder="e.g. I can't see how to get the claim to the front without losing the joke."></textarea></div>
    <div class="actions"><button data-x>Never mind</button><button class="accent" data-go>Rewrite it (logged)</button></div>
  `, (el, close) => {
    el.querySelector('[data-x]').onclick = () => close(null);
    el.querySelector('[data-go]').onclick = (e) => busy(e.currentTarget, async () => {
      const reason = el.querySelector('[data-reason]').value.trim();
      if (!reason) { toast('Say why — it goes in the log.', 'error'); return; }
      const fb = await api.post(`/api/pieces/${pieceId}/rewrite`, { passage: el.querySelector('[data-passage]').value, reason });
      close(fb);
    });
  });
}
