import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import * as store from './store.js';
import * as coach from './coach.js';
import { getConstraints, getExercises, getModels } from './library.js';
import { listModels, MOCK } from './openrouter.js';
import { HttpError, httpError } from './util.js';

const PORT = Number(process.env.PORT) || 4317;
const HOST = '127.0.0.1'; // local only: your writing never leaves this machine except in model requests
const PUBLIC = path.join(store.ROOT, 'public');

const routes = [];
const route = (method, pattern, handler) => {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
  routes.push({ method, re, keys, handler });
};

// ---------- state & settings ----------

route('GET', '/api/state', async (req, { query }) => {
  const [profile, settings, key, stats, coaches] = await Promise.all([
    store.getProfile(), store.getSettings(), store.getKey(), coach.stats({ since: query.get('since') }), coach.listCoaches(),
  ]);
  return { profile, settings, hasKey: !!key || MOCK, keySource: store.keySource(), mock: MOCK, dataDir: store.DATA, stats, coaches };
});

route('GET', '/api/stats', (req, { query }) => coach.stats({ since: query.get('since') }));

route('PUT', '/api/settings', async (req, { body }) => store.saveSettings(body));

route('PUT', '/api/key', async (req, { body }) => {
  await store.setKey((body.key || '').trim());
  return { ok: true, keySource: store.keySource() };
});

route('GET', '/api/models', () => listModels());

route('GET', '/api/usage', async () => (await store.listUsage()).slice(-200).reverse());

// ---------- profile ----------

route('GET', '/api/profile', () => store.getProfile());
route('PUT', '/api/profile', async (req, { body }) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw httpError(400, 'Profile must be an object');
  await store.saveProfile(body);
  return body;
});
route('GET', '/api/proposals', () => store.getProposals());
route('POST', '/api/proposals/:id', (req, { params, body }) => coach.decideProposal(params.id, body.decision, body.edits));

// ---------- library ----------

route('GET', '/api/library', async () => {
  const [exercises, constraints, models] = await Promise.all([getExercises(), getConstraints(), getModels()]);
  return { exercises, constraints, models };
});

// ---------- daily drill ----------

route('GET', '/api/today', () => coach.today());
route('POST', '/api/today', (req, { body }) => coach.today({ action: body.action }));

// ---------- pieces ----------

route('GET', '/api/pieces', () => store.listPieces());
route('POST', '/api/pieces', (req, { body }) => store.createPiece(body));
route('GET', '/api/pieces/:id', async (req, { params }) => {
  const piece = await store.getPiece(params.id);
  const feedback = (await store.listFeedback(params.id)).map(coach.publicFeedback);
  return { ...piece, feedback };
});
route('PUT', '/api/pieces/:id', (req, { params, body }) => store.savePiece(params.id, body));
route('GET', '/api/pieces/:id/versions/:n', (req, { params }) => store.getVersion(params.id, params.n));

route('POST', '/api/pieces/:id/feedback', (req, { params, body }) => coach.critique(params.id, body));
route('POST', '/api/pieces/:id/compare', (req, { params }) => coach.compareImitation(params.id));
route('POST', '/api/pieces/:id/questions', (req, { params }) => coach.editorQuestions(params.id));
route('POST', '/api/pieces/:id/rewrite', (req, { params, body }) => coach.rewrite(params.id, body));
route('POST', '/api/pieces/:id/feedback/:fid/reveal', (req, { params, body }) => coach.revealWithheld(params.id, params.fid, Number(body.index)));
route('PUT', '/api/pieces/:id/feedback/:fid/answers', async (req, { params, body }) => {
  const fb = await store.updateFeedback(params.id, params.fid, { answers: Array.isArray(body.answers) ? body.answers.map(String) : [] });
  return coach.publicFeedback(fb);
});

// ---------- reflection ----------

route('GET', '/api/reflections', () => store.listReflections());
route('POST', '/api/reflections', async (req, { body }) => {
  const { pieceId, hard = '', liked = '', note = '', propose = true } = body;
  if (!hard.trim() && !liked.trim() && !note.trim()) throw httpError(400, 'One line is enough — but write one.');
  let pieceTitle = '';
  if (pieceId) pieceTitle = (await store.getPiece(pieceId)).meta.title;
  const reflection = await store.addReflection({ pieceId: pieceId || null, pieceTitle, hard, liked, note });
  let proposals = [];
  let proposalError = null;
  if (propose) {
    try {
      proposals = await coach.proposeProfileUpdates({ pieceId, reflection });
    } catch (e) {
      proposalError = e.message;
    }
  }
  return { reflection, proposals, proposalError };
});

// ---------- plumbing ----------

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json' };

async function serveStatic(req, res, pathname) {
  let file = path.normalize(path.join(PUBLIC, decodeURIComponent(pathname)));
  if (!file.startsWith(PUBLIC)) throw httpError(403, 'Forbidden');
  try {
    if ((await fs.stat(file)).isDirectory()) file = path.join(file, 'index.html');
  } catch {
    file = path.join(PUBLIC, 'index.html');
  }
  const data = await fs.readFile(file);
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  res.end(data);
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > 5e6) throw httpError(413, 'Too large');
    chunks.push(c);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw httpError(400, 'Invalid JSON');
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname.startsWith('/api/')) {
      // Reject cross-site requests: only this app's own pages may call the API.
      const origin = req.headers.origin;
      if (origin && origin !== `http://${req.headers.host}`) throw httpError(403, 'Cross-origin request refused');
      const r = routes.find((x) => x.method === req.method && x.re.test(url.pathname));
      if (!r) throw httpError(404, 'Not found');
      const m = url.pathname.match(r.re);
      const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
      const body = ['POST', 'PUT'].includes(req.method) ? await readBody(req) : {};
      const result = await r.handler(req, { params, body, query: url.searchParams });
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(result ?? null));
    } else {
      await serveStatic(req, res, url.pathname);
    }
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    if (status === 500) console.error(e);
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: e.message || 'Server error' }));
  }
});

await store.init();
server.listen(PORT, HOST, () => {
  console.log(`Writing Coach is open at http://localhost:${PORT}`);
  console.log(`Your writing lives in ${store.DATA}`);
  if (MOCK) console.log('Mock mode: no model calls are made; replies are canned.');
});
