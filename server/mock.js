// Canned replies for `npm run mock`: lets you click through every flow without an
// API key or spending anything. Replies are built from your own text so the
// evidence checks have something real to verify.

const tag = (messages, name) => {
  const all = messages.map((m) => m.content).join('\n');
  const m = all.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return m ? m[1].trim() : '';
};

const sentences = (t) => (t.match(/[^.!?\n]+[.!?]?/g) || []).map((s) => s.trim()).filter((s) => s.split(/\s+/).length >= 3);

export function mockReply(task, messages) {
  const draft = tag(messages, 'draft');
  const s = sentences(draft);
  const first = s[0] || draft.slice(0, 60) || 'the opening';
  const best = s.slice().sort((a, b) => b.length - a.length)[0] || first;
  const last = s.at(-1) || first;

  switch (task) {
    case 'drill':
      return JSON.stringify({
        title: 'Claim first, about your own week',
        prompt: 'Write one paragraph about a decision your team made this week that you think was wrong. Your first sentence must state why, in fewer than twenty words; everything after it either supports or complicates it.',
        skill: 'leading with the claim',
        genre: 'non-fiction',
        minutes: 15,
        wordTarget: 150,
        why: '(Mock) Your focus is leading with the claim, and workplace subjects are where you most often delegate.',
      });
    case 'critique':
      return JSON.stringify({
        readerResponse: `(Mock response.) I settled in quickly at "${first.slice(0, 80)}" and expected the argument to arrive soon after. By the end I knew your subject but had to reconstruct your position myself.`,
        working: [{ quote: best.slice(0, 120), why: 'Concrete and a little dangerous: this sentence takes a position the rest can lean on.' }],
        changes: [{ name: 'Buried claim', skill: 'leading with the claim', quote: last.slice(0, 100), why: 'Your claim arrives last, so the reader can\'t weigh the evidence while reading it.' }],
        wayIn: 'Try the sentence you think is your claim as the opening line. Which of the others do you still need? For example, you could open with "This is a deliberately long suggested replacement sentence that the coach should never be allowed to hand over to the writer."',
        progressNote: '',
        critiqued: true,
      });
    case 'compare':
      return JSON.stringify({
        readerResponse: '(Mock response.) Your rebuild keeps the original\'s shape for its first half, then relaxes into a looser rhythm.',
        moves: [
          { move: 'Periodic suspension', original: tag(messages, 'model').split(/[;,]/)[0], yours: first.slice(0, 60), observation: 'The original delays its main clause; yours arrives at it at once.' },
        ],
        keep: first.slice(0, 80),
        takeaway: 'Practise holding the main clause back until the reader is leaning forward.',
      });
    case 'questions':
      return JSON.stringify({
        observation: '(Mock response.) The plan names its sections but not what the reader carries out of each.',
        questions: [
          { question: 'What does the reader need to know by the end of section 2?', quote: '', why: 'Everything after it depends on that handover.' },
          { question: 'Where is the turn — and does the plan know it?', quote: '', why: 'Two sections seem to promise it.' },
          { question: 'Who will read this, and what will they do differently afterwards?', quote: '', why: 'The answer decides how much context the opening needs.' },
        ],
      });
    case 'profile-update':
      return JSON.stringify({
        proposals: draft ? [
          { type: 'add_pattern', payload: { text: 'Opens with context before stating the claim' }, rationale: '(Mock) Seen in this session\'s draft.', evidence: `"${first.slice(0, 80)}"` },
          { type: 'add_strength', payload: { text: 'Concrete, slightly dangerous sentences that take a position' }, rationale: '(Mock) The strongest sentence in the draft.', evidence: `"${best.slice(0, 80)}"` },
        ] : [],
      });
    case 'rewrite':
      return JSON.stringify({
        rewrite: `(Mock rewrite) ${tag(messages, 'passage')}`,
        lesson: 'Moved the claim to the front and cut the throat-clearing clause.',
        tryNext: 'Next draft, underline your claim before you send it, and check that it is in the first sentence.',
      });
    default:
      return JSON.stringify({ note: 'mock' });
  }
}
