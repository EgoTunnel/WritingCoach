// End-of-session reflection, and the coach's proposed profile changes that follow it.
// Reflection is the only way the coach's picture of the writer changes, and
// every change is confirmed or rejected here, in the open.

import { api } from '../api.js';
import { esc, busy, modal, toast } from '../ui.js';

const TYPE_LABEL = {
  add_pattern: 'New observed pattern',
  confirm_pattern: 'Confirm a hypothesis',
  remove_pattern: 'Drop a pattern',
  add_strength: 'A strength to protect',
  add_issue: 'An issue to track',
  resolve_issue: 'An issue resolved',
  change_focus: 'Change focus skill',
  set_phase: 'Change drill phase',
};

function describe(p, profile) {
  const pl = p.payload || {};
  switch (p.type) {
    case 'add_pattern': case 'add_strength': return esc(pl.text);
    case 'add_issue': return `${esc(pl.skill)}: ${esc(pl.text)}`;
    case 'confirm_pattern': case 'remove_pattern':
      return esc(profile?.patterns?.find((x) => x.id === pl.id)?.text || pl.id);
    case 'resolve_issue': {
      const i = profile?.issues?.find((x) => x.id === pl.id);
      return esc(i ? `${i.skill}: ${i.text}` : pl.id);
    }
    case 'change_focus': return `${esc(pl.skill)}${pl.genre ? ` (${esc(pl.genre)})` : ''}`;
    case 'set_phase': return pl.phase === 'rotate-fiction' ? 'Rotate fiction drills in alongside non-fiction' : 'Non-fiction drills lead';
    default: return esc(JSON.stringify(pl));
  }
}

export function proposalHTML(p, profile) {
  const editable = ['add_pattern', 'add_strength'].includes(p.type);
  return `<div class="proposal" data-pid="${p.id}">
    <div class="eyebrow">${TYPE_LABEL[p.type] || p.type}</div>
    ${editable ? `<input type="text" data-edit value="${esc(p.payload.text)}" aria-label="Edit before accepting">` : `<p><strong>${describe(p, profile)}</strong></p>`}
    ${p.rationale ? `<p class="muted" style="font-size:.88rem;margin:6px 0 2px">${esc(p.rationale)}</p>` : ''}
    ${p.evidence ? `<div class="quote" style="font-size:.9rem">${esc(p.evidence)}</div>` : ''}
    <div class="row" style="margin-top:8px">
      <button class="small primary" data-decide="accept">${p.type === 'add_pattern' ? 'Confirm' : 'Accept'}</button>
      ${p.type === 'add_pattern' ? '<button class="small" data-decide="hypothesis" title="Record it as unconfirmed; the coach treats it as a hypothesis">Keep as hypothesis</button>' : ''}
      <button class="small ghost" data-decide="reject">Reject</button>
    </div>
  </div>`;
}

export function bindProposals(root, onDone) {
  root.querySelectorAll('[data-pid]').forEach((card) => {
    card.querySelectorAll('[data-decide]').forEach((b) => b.addEventListener('click', () => busy(b, async () => {
      const edit = card.querySelector('[data-edit]');
      await api.post(`/api/proposals/${card.dataset.pid}`, { decision: b.dataset.decide, edits: edit ? { text: edit.value } : {} });
      card.innerHTML = `<p class="muted" style="margin:0">${b.dataset.decide === 'reject' ? 'Rejected.' : b.dataset.decide === 'hypothesis' ? 'Kept as a hypothesis.' : 'Recorded in your profile.'}</p>`;
      onDone?.();
    })));
  });
}

export function reflectModal({ pieceId, pieceTitle, hasKey, profile }) {
  return modal(`
    <h2>Before you go</h2>
    <p class="muted">One or two lines. Over time this becomes evidence.${pieceTitle ? ` <br>Session: <em>${esc(pieceTitle)}</em>` : ''}</p>
    <div class="field"><label>What was hard?</label><textarea data-hard rows="2"></textarea></div>
    <div class="field"><label>What did you like in your own sentences? Quote one if you can.</label><textarea data-liked rows="2"></textarea></div>
    <label class="check" style="margin-top:12px"><input type="checkbox" data-propose ${hasKey ? 'checked' : 'disabled'}> Let the coach propose changes to my profile (I'll confirm each one)</label>
    <div class="actions"><button data-x>Skip</button><button class="primary" data-go>Save reflection</button></div>
  `, (el, close) => {
    el.querySelector('[data-x]').onclick = () => close(null);
    el.querySelector('[data-go]').onclick = (e) => busy(e.currentTarget, async () => {
      const res = await api.post('/api/reflections', {
        pieceId,
        hard: el.querySelector('[data-hard]').value,
        liked: el.querySelector('[data-liked]').value,
        propose: el.querySelector('[data-propose]').checked,
      });
      if (res.proposalError) toast(`Reflection saved. The coach couldn't propose changes: ${res.proposalError}`, 'error');
      if (!res.proposals.length) {
        toast(res.proposalError ? 'Reflection saved.' : 'Reflection saved. No profile changes proposed.');
        close(res);
        return;
      }
      el.innerHTML = `
        <h2>The coach noticed something</h2>
        <p class="muted">Nothing is recorded until you agree. You can also edit the wording first.</p>
        <div data-list>${res.proposals.map((p) => proposalHTML(p, profile)).join('')}</div>
        <div class="actions"><button class="primary" data-done>Done</button></div>`;
      bindProposals(el);
      el.querySelector('[data-done]').onclick = () => close(res);
    });
  });
}
