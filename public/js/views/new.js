import { api } from '../api.js';
import { busy, toast } from '../ui.js';

export default async function render(el, _p, ctx) {
  el.innerHTML = `
    <div class="page-head"><div>
      <h1>Draft review</h1>
      <p>Paste or write a piece, say what it's for, and choose the kind of reading you want.</p>
    </div></div>
    <div class="grid two">
      <section class="card">
        <div class="field"><label>Title</label><input type="text" data-title placeholder="Untitled"></div>
        <div class="field"><label>What is it for?</label><input type="text" data-purpose placeholder="e.g. A post for the AI Info Hub on assessment redesign"></div>
        <div class="field"><label>The piece (optional — you can write it on the next page)</label><textarea data-text rows="12" style="font-family:var(--serif);font-size:1.05rem"></textarea></div>
        <div class="row" style="margin-top:14px"><button class="primary" data-go>Open it</button></div>
      </section>
      <section class="card">
        <div class="eyebrow">How the coach reads</div>
        <ol style="padding-left:18px;margin:0 0 12px">
          <li><strong>Reader response.</strong> What happened to an attentive reader.</li>
          <li><strong>What's working.</strong> One or two strengths, quoted.</li>
          <li><strong>The highest-leverage change.</strong> One issue, two at most, in craft terms.</li>
          <li><strong>A way in.</strong> A question or technique — not a fix.</li>
        </ol>
        <p class="muted" style="font-size:.9rem">You choose the depth and the tone. Every judgment quotes your text, and quotes are checked. If the coach tries to write a sentence for you, it's withheld.</p>
      </section>
    </div>`;

  el.querySelector('[data-go]').addEventListener('click', (e) => busy(e.currentTarget, async () => {
    const title = el.querySelector('[data-title]').value.trim() || 'Untitled';
    const purpose = el.querySelector('[data-purpose]').value.trim();
    const text = el.querySelector('[data-text]').value;
    const { meta } = await api.post('/api/pieces', { kind: 'draft', title, purpose, text });
    if (text) toast('Saved as version 1.');
    ctx.go(`#/piece/${meta.id}`);
  }));
}
