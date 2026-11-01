// Word-level diff (LCS), keeping whitespace attached so the result reads as prose.

export function tokenize(text) {
  return String(text || '').match(/\s+|[^\s]+/g) || [];
}

/** @returns {{type: 'same'|'add'|'del', text: string}[]} */
export function diffWords(a, b) {
  const A = tokenize(a);
  const B = tokenize(b);
  // Trim common prefix/suffix to keep the table small.
  let start = 0;
  while (start < A.length && start < B.length && A[start] === B[start]) start++;
  let endA = A.length, endB = B.length;
  while (endA > start && endB > start && A[endA - 1] === B[endB - 1]) { endA--; endB--; }
  const a2 = A.slice(start, endA), b2 = B.slice(start, endB);
  const n = a2.length, m = b2.length;

  const ops = [];
  if (n * m > 4e6) {
    // Too big for a table: show as replaced wholesale.
    if (n) ops.push({ type: 'del', text: a2.join('') });
    if (m) ops.push({ type: 'add', text: b2.join('') });
  } else {
    const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        dp[i][j] = a2[i] === b2[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (a2[i] === b2[j]) { ops.push({ type: 'same', text: a2[i] }); i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) { ops.push({ type: 'del', text: a2[i++] }); }
      else { ops.push({ type: 'add', text: b2[j++] }); }
    }
    while (i < n) ops.push({ type: 'del', text: a2[i++] });
    while (j < m) ops.push({ type: 'add', text: b2[j++] });
  }

  const out = [];
  const push = (type, text) => {
    if (!text) return;
    const last = out.at(-1);
    if (last && last.type === type) last.text += text;
    else out.push({ type, text });
  };
  push('same', A.slice(0, start).join(''));
  for (const o of ops) push(o.type, o.text);
  push('same', A.slice(endA).join(''));
  return out;
}

export function diffStats(parts) {
  const count = (t) => (t.match(/\S+/g) || []).length;
  return {
    added: parts.filter((p) => p.type === 'add').reduce((s, p) => s + count(p.text), 0),
    removed: parts.filter((p) => p.type === 'del').reduce((s, p) => s + count(p.text), 0),
  };
}
