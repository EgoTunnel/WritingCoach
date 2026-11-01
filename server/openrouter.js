import { getKey, getSettings, logUsage } from './store.js';
import { httpError, parseModelJSON } from './util.js';
import { mockReply } from './mock.js';

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
export const MOCK = process.argv.includes('--mock') || process.env.WRITING_COACH_MOCK === '1';

/**
 * One chat completion through OpenRouter. Every call is logged to usage.jsonl with
 * its cost, so spending stays visible.
 * @param {{task: string, modelRole: 'drill'|'critique'|'companion', messages: object[], json?: boolean, temperature?: number, maxTokens?: number}} opts
 */
export async function chat({ task, modelRole, messages, json = true, temperature = 0.7, maxTokens = 2000 }) {
  const settings = await getSettings();
  const model = settings.models[modelRole];

  if (MOCK) {
    const content = mockReply(task, messages);
    await logUsage({ task, model: `mock/${model}`, promptTokens: 0, completionTokens: 0, cost: 0 });
    return { content, data: json ? parseModelJSON(content) : null, cost: 0, model };
  }

  const key = await getKey();
  if (!key) throw httpError(400, 'No OpenRouter API key yet. Add one in Settings.');

  const body = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
    usage: { include: true },
  };
  if (json) body.response_format = { type: 'json_object' };
  if (settings.privacy.denyDataCollection) body.provider = { data_collection: 'deny' };

  const send = (b) => fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost/writing-coach',
      'X-Title': 'Writing Coach',
    },
    body: JSON.stringify(b),
  });

  let res = await send(body);
  // Some providers reject response_format; the prompts ask for JSON anyway.
  if (res.status === 400 && json) {
    const { response_format, ...rest } = body;
    res = await send(rest);
  }
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    let msg = payload?.error?.message || `OpenRouter returned ${res.status}`;
    if (res.status === 404 && settings.privacy.denyDataCollection) {
      msg += ' — no provider for this model meets the no-retention setting. Pick another model or relax the privacy setting.';
    }
    if (res.status === 401) msg = 'OpenRouter rejected the API key. Check it in Settings.';
    throw httpError(502, msg);
  }

  const content = payload?.choices?.[0]?.message?.content ?? '';
  const u = payload?.usage || {};
  await logUsage({
    task,
    model: payload?.model || model,
    promptTokens: u.prompt_tokens ?? null,
    completionTokens: u.completion_tokens ?? null,
    cost: typeof u.cost === 'number' ? u.cost : null,
  });
  return { content, data: json ? parseModelJSON(content) : null, cost: u.cost ?? null, model: payload?.model || model };
}

let modelCache = null;
/** Public model list, for the Settings page's pickers. */
export async function listModels() {
  if (modelCache && Date.now() - modelCache.at < 3600_000) return modelCache.models;
  const res = await fetch('https://openrouter.ai/api/v1/models');
  if (!res.ok) throw httpError(502, 'Could not load the OpenRouter model list.');
  const { data } = await res.json();
  const models = data.map((m) => ({
    id: m.id,
    name: m.name,
    prompt: Number(m.pricing?.prompt || 0) * 1e6,
    completion: Number(m.pricing?.completion || 0) * 1e6,
  }));
  modelCache = { at: Date.now(), models };
  return models;
}
