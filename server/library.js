// The exercise library is tagged (skill, genre, level), not personal: a profile picks
// from it, so a second writer's profile would pick from the same library.

import fs from 'node:fs/promises';
import path from 'node:path';
import { ROOT, readJSON } from './store.js';

const LIB = path.join(ROOT, 'library');

export const getExercises = () => readJSON(path.join(LIB, 'exercises.json'), []);
export const getConstraints = () => readJSON(path.join(LIB, 'constraints.json'), []);

export function parseFrontmatter(src) {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: src.trim() };
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  if (meta.tags) meta.tags = meta.tags.split(',').map((t) => t.trim()).filter(Boolean);
  return { meta, body: m[2].trim() };
}

export async function getModels() {
  const dir = path.join(LIB, 'models');
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.md') && f !== 'README.md');
  const models = await Promise.all(files.map(async (f) => {
    const { meta, body } = parseFrontmatter(await fs.readFile(path.join(dir, f), 'utf8'));
    return { id: f.replace(/\.md$/, ''), ...meta, text: body };
  }));
  return models.sort((a, b) => (a.author || '').localeCompare(b.author || ''));
}

export async function getModel(id) {
  const models = await getModels();
  return models.find((m) => m.id === id) || null;
}

/**
 * Choose a seed exercise for today. Matches the focus skill first, respects the
 * phase (non-fiction leads until the habit holds), and avoids recent repeats.
 */
export function pickExercise(exercises, profile, recentIds = [], { skip = [] } = {}) {
  const level = profile.level || 'adult-advanced';
  const focus = (profile.focus?.skill || '').toLowerCase();
  let pool = exercises.filter((e) => e.level === level && !skip.includes(e.id));

  let genre = 'non-fiction';
  if (profile.phase === 'rotate-fiction') {
    // Alternate by day once fiction rotates in.
    genre = new Date().getDate() % 2 === 0 ? 'fiction' : 'non-fiction';
  }
  if (profile.focus?.genre === 'fiction' && profile.phase === 'rotate-fiction') genre = 'fiction';

  const score = (e) => {
    let s = 0;
    if (focus && e.skills.some((k) => k.toLowerCase() === focus)) s += 10;
    else if (focus && e.skills.some((k) => focus.includes(k.toLowerCase()) || k.toLowerCase().includes(focus))) s += 5;
    if (e.genre === genre) s += 4;
    const recentIdx = recentIds.indexOf(e.id);
    if (recentIdx >= 0) s -= 12 - Math.min(recentIdx, 10);
    return s + Math.random() * 3;
  };
  pool = pool.map((e) => ({ e, s: score(e) })).sort((a, b) => b.s - a.s);
  return pool[0]?.e || exercises[0];
}
