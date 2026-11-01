// The no-ghostwriting rule, in code.
//
// Two checks run on every coach response before you see it:
//   1. Evidence: every quote offered as evidence of a strength or weakness must
//      actually appear in your text. Unverified quotes are flagged, not hidden.
//   2. Replacement prose: any passage that looks like the coach writing your
//      sentences for you is withheld. That means a quoted span of more than
//      MAX_PHRASE_WORDS words that isn't from your text (or a model passage), or an
//      unquoted sentence that closely paraphrases one of yours.
// Withheld passages are kept server-side; revealing one is logged as a rewrite.

export const MAX_PHRASE_WORDS = 12;

export function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[^\p{L}\p{N}'\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const words = (s) => normalize(s).split(' ').filter(Boolean);

function ngrams(ws, n) {
  const out = new Set();
  for (let i = 0; i + n <= ws.length; i++) out.add(ws.slice(i, i + n).join(' '));
  return out;
}

/** True if `quote` appears in `source`, tolerating punctuation, case and small slips. */
export function appearsIn(quote, source) {
  const q = normalize(quote).replace(/^(\.\.\.|…)|(\.\.\.|…)$/g, '').trim();
  if (!q) return true;
  const src = normalize(source);
  if (src.includes(q)) return true;
  // Tolerate ellipses inside the quote: every fragment must appear in order.
  const parts = String(quote).split(/\.\.\.|…|\[\.\.\.\]/).map(normalize).filter(Boolean);
  if (parts.length > 1) {
    let from = 0;
    const ok = parts.every((p) => {
      const at = src.indexOf(p, from);
      if (at < 0) return false;
      from = at + p.length;
      return true;
    });
    if (ok) return true;
  }
  // Fuzzy: most of the quote's word trigrams are in the source.
  const qw = q.split(' ');
  if (qw.length < 4) return false;
  const qg = ngrams(qw, 3);
  const sg = ngrams(src.split(' '), 3);
  let hit = 0;
  for (const g of qg) if (sg.has(g)) hit++;
  return hit / qg.size >= 0.85;
}

/** Fraction of `sentence`'s word trigrams that appear in `source`. */
function overlap(sentence, sourceGrams) {
  const g = ngrams(words(sentence), 3);
  if (!g.size) return 0;
  let hit = 0;
  for (const x of g) if (sourceGrams.has(x)) hit++;
  return hit / g.size;
}

const QUOTE_RE = /“([^”]+)”|"([^"]+)"|^>\s?(.+)$/gm;

/**
 * Scan coach prose and withhold replacement prose.
 * @returns {{ text: string, withheld: {words:number, text:string}[] }}
 */
export function guardProse(text, { draft = '', sources = [], paraphrase = true } = {}) {
  if (typeof text !== 'string' || !text) return { text, withheld: [] };
  const allSources = [draft, ...sources].join('\n\n');
  const withheld = [];

  // 1. Long quoted spans that aren't the writer's (or a model passage).
  let out = text.replace(QUOTE_RE, (match, a, b, c) => {
    const inner = a ?? b ?? c;
    const n = words(inner).length;
    if (n <= MAX_PHRASE_WORDS || appearsIn(inner, allSources)) return match;
    withheld.push({ words: n, text: inner });
    return `[withheld: ${n} words of suggested wording]`;
  });

  // 2. Unquoted sentences that paraphrase the writer's own sentences.
  if (draft && paraphrase) {
    const draftGrams = ngrams(words(draft), 3);
    out = out.replace(/[^.!?\n]+[.!?]?/g, (sentence) => {
      if (/\[withheld:/.test(sentence)) return sentence;
      // Leave alone anything that is quoting.
      if (/[“”"]/.test(sentence)) return sentence;
      const n = words(sentence).length;
      if (n <= MAX_PHRASE_WORDS) return sentence;
      const ov = overlap(sentence, draftGrams);
      if (ov >= 0.5 && !appearsIn(sentence, draft)) {
        withheld.push({ words: n, text: sentence.trim() });
        const lead = sentence.match(/^\s*/)[0];
        return `${lead}[withheld: ${n} words that rewrite your sentence]`;
      }
      return sentence;
    });
  }
  return { text: out, withheld };
}

/**
 * Walk a structured coach response. Fields named `quote` / `yours` are evidence and
 * are verified against the draft; `original` is verified against the model passage;
 * all other strings are prose and are guarded. Mutates and returns { value, withheld, unverified }.
 */
export function guardResponse(value, { draft = '', sources = [], allowRewrite = false, allowLineEdits = false, paraphrase = true } = {}) {
  const withheld = [];
  const unverified = [];
  const walk = (v, key) => {
    if (typeof v === 'string') {
      if (key === 'quote' || key === 'yours') {
        if (!appearsIn(v, draft)) unverified.push(v);
        return v;
      }
      if (key === 'original') {
        if (sources.length && !appearsIn(v, sources.join('\n'))) unverified.push(v);
        return v;
      }
      if (allowRewrite) return v;
      const g = guardProse(v, { draft, sources, paraphrase });
      withheld.push(...g.withheld);
      return g.text;
    }
    if (Array.isArray(v)) return v.map((x) => walk(x, key));
    if (v && typeof v === 'object') {
      for (const k of Object.keys(v)) {
        // Explicitly requested line edits are a logged rewrite, not prose to guard.
        if (k === 'lineEdits' && allowLineEdits) continue;
        v[k] = walk(v[k], k);
      }
      return v;
    }
    return v;
  };
  const out = walk(value, null);
  return { value: out, withheld, unverified };
}
