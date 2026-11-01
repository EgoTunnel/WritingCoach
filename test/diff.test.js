import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diffWords, diffStats } from '../public/js/diff.js';
import { parseModelJSON } from '../server/util.js';
import { pickExercise, parseFrontmatter } from '../server/library.js';

test('diffWords reconstructs both texts', () => {
  const a = 'The claim comes fourth in this paragraph.';
  const b = 'The claim comes first in this short paragraph.';
  const parts = diffWords(a, b);
  assert.equal(parts.filter((p) => p.type !== 'add').map((p) => p.text).join(''), a);
  assert.equal(parts.filter((p) => p.type !== 'del').map((p) => p.text).join(''), b);
  assert.deepEqual(diffStats(parts), { added: 2, removed: 1 });
});

test('parseModelJSON handles fences and surrounding prose', () => {
  assert.deepEqual(parseModelJSON('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(parseModelJSON('Here you go: {"a":2} hope it helps'), { a: 2 });
  assert.throws(() => parseModelJSON('no json here'));
});

test('parseFrontmatter reads model passages', () => {
  const { meta, body } = parseFrontmatter('---\nauthor: Bacon\ntags: a, b\n---\nStudies serve for delight.');
  assert.equal(meta.author, 'Bacon');
  assert.deepEqual(meta.tags, ['a', 'b']);
  assert.equal(body, 'Studies serve for delight.');
});

test('pickExercise prefers the focus skill and the writer\'s level', () => {
  const ex = [
    { id: 'a', level: 'adult-advanced', genre: 'fiction', skills: ['dialogue'] },
    { id: 'b', level: 'adult-advanced', genre: 'non-fiction', skills: ['leading with the claim'] },
    { id: 'c', level: 'ages 8-10', genre: 'non-fiction', skills: ['leading with the claim'] },
  ];
  const profile = { level: 'adult-advanced', phase: 'nonfiction-first', focus: { skill: 'leading with the claim' } };
  for (let i = 0; i < 20; i++) assert.equal(pickExercise(ex, profile).id, 'b');
});
