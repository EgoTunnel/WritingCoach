// Plain-file storage. Everything here is readable without the app:
//   data/profile.json            the writer model (you can edit it by hand)
//   data/settings.json           models, tone, privacy (no secrets)
//   data/pieces/<id>/piece.md    current text of a piece
//   data/pieces/<id>/versions/   every saved version (v001.md, v002.md, ...)
//   data/pieces/<id>/feedback/   every coach response, as .md (readable) and .json (structured)
//   data/pieces/<id>/meta.json   title, kind, purpose, version list, feedback index
//   data/reflections.md          the reflection log, appended after each session
//   data/rewrites.jsonl          every rewrite you explicitly asked for
//   data/usage.jsonl             every model call with its cost
// The OpenRouter key lives outside the data folder, in ~/.writing-coach/secrets.json.

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { httpError, localDate, slugify, wordCount, shortId } from './util.js';

export const ROOT = path.resolve(import.meta.dirname, '..');
const MOCK = process.argv.includes('--mock') || process.env.WRITING_COACH_MOCK === '1';
// Mock mode gets its own folder so practice clicks never mix with real writing.
export const DATA = path.resolve(process.env.WRITING_COACH_DATA || path.join(ROOT, MOCK ? 'data-mock' : 'data'));
export const SECRETS_FILE = path.join(os.homedir(), '.writing-coach', 'secrets.json');

const P = {
  profile: path.join(DATA, 'profile.json'),
  settings: path.join(DATA, 'settings.json'),
  pieces: path.join(DATA, 'pieces'),
  reflectionsMd: path.join(DATA, 'reflections.md'),
  reflections: path.join(DATA, 'reflections.jsonl'),
  rewrites: path.join(DATA, 'rewrites.jsonl'),
  usage: path.join(DATA, 'usage.jsonl'),
  proposals: path.join(DATA, 'proposals.json'),
  today: path.join(DATA, 'today.json'),
};

export const DEFAULT_SETTINGS = {
  coach: 'andrew',
  models: {
    drill: 'anthropic/claude-haiku-5.5',
    critique: 'anthropic/claude-sonnet-5.5',
    companion: 'anthropic/claude-sonnet-5.5',
  },
  defaultTone: 3,
  privacy: { denyDataCollection: true },
  drillMinutes: 15,
};

// ---------- low-level helpers ----------

export async function readJSON(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return structuredClone(fallback);
    throw e;
  }
}

export async function writeJSON(file, value) {
  await writeText(file, JSON.stringify(value, null, 2) + '\n');
}

export async function writeText(file, text) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, text, 'utf8');
  await fs.rename(tmp, file);
}

async function readText(file, fallback = '') {
  try {
    return await fs.readFile(file, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') return fallback;
    throw e;
  }
}

export async function appendJSONL(file, record) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.appendFile(file, JSON.stringify(record) + '\n', 'utf8');
}

export async function readJSONL(file) {
  const text = await readText(file);
  return text.split('\n').filter(Boolean).map((l) => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter(Boolean);
}

// ---------- init ----------

export async function init() {
  await fs.mkdir(P.pieces, { recursive: true });
  try {
    await fs.access(P.profile);
  } catch {
    const template = await readJSON(path.join(ROOT, 'templates', 'profile.json'), {});
    await writeJSON(P.profile, template);
  }
  try {
    await fs.access(P.settings);
  } catch {
    await writeJSON(P.settings, DEFAULT_SETTINGS);
  }
}

// ---------- profile, settings, secrets ----------

export const getProfile = () => readJSON(P.profile, {});
export const saveProfile = (p) => writeJSON(P.profile, p);

export async function getSettings() {
  const s = await readJSON(P.settings, DEFAULT_SETTINGS);
  return { ...DEFAULT_SETTINGS, ...s, models: { ...DEFAULT_SETTINGS.models, ...s.models }, privacy: { ...DEFAULT_SETTINGS.privacy, ...s.privacy } };
}
export async function saveSettings(patch) {
  const cur = await getSettings();
  const next = { ...cur, ...patch, models: { ...cur.models, ...patch.models }, privacy: { ...cur.privacy, ...patch.privacy } };
  await writeJSON(P.settings, next);
  return next;
}

export async function getKey() {
  if (process.env.OPENROUTER_API_KEY) return process.env.OPENROUTER_API_KEY;
  const s = await readJSON(SECRETS_FILE, {});
  return s.openrouterKey || '';
}
export async function setKey(key) {
  const s = await readJSON(SECRETS_FILE, {});
  if (key) s.openrouterKey = key; else delete s.openrouterKey;
  await writeJSON(SECRETS_FILE, s);
}
export const keySource = () => (process.env.OPENROUTER_API_KEY ? 'environment' : SECRETS_FILE);

// ---------- pieces ----------

const ID_RE = /^[a-z0-9-]{1,80}$/;
function pieceDir(id) {
  if (!ID_RE.test(id)) throw httpError(400, 'Bad piece id');
  return path.join(P.pieces, id);
}

export async function listPieces() {
  let entries = [];
  try {
    entries = await fs.readdir(P.pieces, { withFileTypes: true });
  } catch { return []; }
  const metas = await Promise.all(entries.filter((e) => e.isDirectory()).map(async (e) => {
    const meta = await readJSON(path.join(P.pieces, e.name, 'meta.json'), null);
    return meta;
  }));
  return metas.filter(Boolean).sort((a, b) => (b.updated || '').localeCompare(a.updated || ''));
}

export async function createPiece({ kind = 'draft', title = 'Untitled', text = '', ...extra }) {
  const base = `${localDate()}-${slugify(title)}`;
  let id = base;
  try {
    await fs.access(path.join(P.pieces, id));
    id = `${base}-${shortId()}`;
  } catch { /* free */ }
  const now = new Date().toISOString();
  const meta = { id, kind, title, created: now, updated: now, versions: [], feedback: [], ...extra };
  await writeJSON(path.join(pieceDir(id), 'meta.json'), meta);
  await writeText(path.join(pieceDir(id), 'piece.md'), '');
  if (text) return savePiece(id, { text });
  return { meta, text: '' };
}

export async function getPiece(id) {
  const dir = pieceDir(id);
  const meta = await readJSON(path.join(dir, 'meta.json'), null);
  if (!meta) throw httpError(404, 'Piece not found');
  const text = await readText(path.join(dir, 'piece.md'));
  return { meta, text };
}

const EDITABLE_META = ['title', 'purpose', 'drill', 'imitation', 'constraint', 'project', 'status', 'audience'];

export async function savePiece(id, { text, note, ...patch }) {
  const dir = pieceDir(id);
  const { meta, text: current } = await getPiece(id);
  for (const k of EDITABLE_META) if (k in patch) meta[k] = patch[k];
  meta.updated = new Date().toISOString();
  let newVersion = null;
  if (typeof text === 'string' && text !== current) {
    const last = meta.versions.at(-1);
    const lastText = last ? await readText(path.join(dir, 'versions', last.file)) : '';
    if (text !== lastText) {
      const n = (last?.n || 0) + 1;
      const file = `v${String(n).padStart(3, '0')}.md`;
      await writeText(path.join(dir, 'versions', file), text);
      newVersion = { n, file, at: meta.updated, words: wordCount(text), ...(note ? { note } : {}) };
      meta.versions.push(newVersion);
    }
    await writeText(path.join(dir, 'piece.md'), text);
  }
  await writeJSON(path.join(dir, 'meta.json'), meta);
  return { meta, text: typeof text === 'string' ? text : current, newVersion };
}

export async function getVersion(id, n) {
  const { meta } = await getPiece(id);
  const v = meta.versions.find((x) => x.n === Number(n));
  if (!v) throw httpError(404, 'Version not found');
  return { ...v, text: await readText(path.join(pieceDir(id), 'versions', v.file)) };
}

export async function addFeedback(id, record, markdown) {
  const dir = pieceDir(id);
  const { meta } = await getPiece(id);
  const at = new Date().toISOString();
  const fid = at.replace(/[:.]/g, '-');
  const full = { id: fid, at, version: meta.versions.at(-1)?.n || 0, ...record };
  await writeJSON(path.join(dir, 'feedback', `${fid}.json`), full);
  if (markdown) await writeText(path.join(dir, 'feedback', `${fid}.md`), markdown);
  meta.feedback.push({ id: fid, at, kind: record.kind, version: full.version });
  meta.updated = at;
  await writeJSON(path.join(dir, 'meta.json'), meta);
  return full;
}

export async function listFeedback(id) {
  const { meta } = await getPiece(id);
  const dir = pieceDir(id);
  const all = await Promise.all(meta.feedback.map((f) => readJSON(path.join(dir, 'feedback', `${f.id}.json`), null)));
  return all.filter(Boolean);
}

export async function getFeedback(id, fid) {
  if (!/^[0-9A-Za-z-]+$/.test(fid)) throw httpError(400, 'Bad feedback id');
  const fb = await readJSON(path.join(pieceDir(id), 'feedback', `${fid}.json`), null);
  if (!fb) throw httpError(404, 'Feedback not found');
  return fb;
}

export async function updateFeedback(id, fid, patch) {
  const fb = await getFeedback(id, fid);
  Object.assign(fb, patch);
  await writeJSON(path.join(pieceDir(id), 'feedback', `${fid}.json`), fb);
  return fb;
}

// ---------- logs ----------

export async function addReflection(r) {
  const record = { at: new Date().toISOString(), date: localDate(), ...r };
  await appendJSONL(P.reflections, record);
  const lines = [`## ${record.date}${r.pieceTitle ? ` — ${r.pieceTitle}` : ''}`, ''];
  if (r.hard) lines.push(`**What was hard:** ${r.hard}`, '');
  if (r.liked) lines.push(`**What I liked in my own sentences:** ${r.liked}`, '');
  if (r.note) lines.push(r.note, '');
  const existing = await readText(P.reflectionsMd, '# Reflection log\n\nEvidence against the belief that I can\'t write.\n\n');
  await writeText(P.reflectionsMd, existing + lines.join('\n') + '\n');
  return record;
}
export const listReflections = () => readJSONL(P.reflections);

export const logRewrite = (r) => appendJSONL(P.rewrites, { at: new Date().toISOString(), ...r });
export const listRewrites = () => readJSONL(P.rewrites);

export const logUsage = (u) => appendJSONL(P.usage, { at: new Date().toISOString(), ...u });
export const listUsage = () => readJSONL(P.usage);

export const getProposals = () => readJSON(P.proposals, []);
export const saveProposals = (p) => writeJSON(P.proposals, p);

export const getToday = () => readJSON(P.today, null);
export const saveToday = (t) => writeJSON(P.today, t);
