import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appearsIn, guardProse, guardResponse } from '../server/guard.js';

const draft = 'Most course syllabi begin with a list of policies. Students skim them on the first day. The syllabus is a promise the course cannot keep, because the course changes and the document does not.';

test('appearsIn tolerates case, punctuation and curly quotes', () => {
  assert.ok(appearsIn('the syllabus is a promise the course cannot keep', draft));
  assert.ok(appearsIn('Students skim them on the first day…', draft));
  assert.ok(appearsIn('Most course syllabi … the first day', draft));
  assert.ok(!appearsIn('The rubric is a contract nobody signed', draft));
});

test('short quoted phrases pass through', () => {
  const g = guardProse('Try something like "a promise broken" here.', { draft });
  assert.equal(g.withheld.length, 0);
});

test('long quoted replacement prose is withheld', () => {
  const g = guardProse('Open with "Every syllabus is a contract the course will break before the first assignment is even due."', { draft });
  assert.equal(g.withheld.length, 1);
  assert.match(g.text, /\[withheld: \d+ words/);
});

test('long quotes of the writer\'s own text are allowed', () => {
  const g = guardProse('Your best line is "The syllabus is a promise the course cannot keep, because the course changes and the document does not."', { draft });
  assert.equal(g.withheld.length, 0);
});

test('unquoted paraphrase of the writer\'s sentence is withheld', () => {
  const g = guardProse('The syllabus is a promise the course cannot keep, because the course changes while the document does not.', { draft });
  assert.equal(g.withheld.length, 1);
});

test('discussing the writer\'s sentence loosely is not mistaken for a rewrite', () => {
  const g = guardProse('When you call the syllabus a promise, the reader finally knows what the paragraph is arguing about.', { draft });
  assert.equal(g.withheld.length, 0);
});

test('model passages are allowed sources', () => {
  const model = 'Ye who listen with credulity to the whispers of fancy, and pursue with eagerness the phantoms of hope';
  const g = guardProse(`Johnson writes "${model}".`, { draft, sources: [model] });
  assert.equal(g.withheld.length, 0);
});

test('guardResponse verifies evidence quotes and guards prose', () => {
  const r = {
    working: [{ quote: 'Students skim them on the first day.', why: 'Plain and true.' }],
    changes: [{ name: 'Buried claim', quote: 'This sentence is not in the draft at all', why: 'x' }],
    wayIn: 'Write "Every syllabus is a contract the course will break before the first assignment is even due."',
  };
  const g = guardResponse(r, { draft });
  assert.deepEqual(g.unverified, ['This sentence is not in the draft at all']);
  assert.equal(g.withheld.length, 1);
  assert.match(g.value.wayIn, /withheld/);
});

test('requested line edits are not withheld', () => {
  const r = { lineEdits: [{ quote: 'Students skim them on the first day.', suggestion: '"On day one, students skim the syllabus and then forget it exists until the week it matters."' }] };
  const g = guardResponse(r, { draft, allowLineEdits: true });
  assert.equal(g.withheld.length, 0);
});
