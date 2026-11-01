// A "session" is this browser tab: cost shown in the sidebar is since it opened.
let since = null;
try {
  since = sessionStorage.getItem('wc-session-start');
  if (!since) {
    since = new Date().toISOString();
    sessionStorage.setItem('wc-session-start', since);
  }
} catch {
  since = new Date().toISOString();
}
export const sessionStart = since;

async function request(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  get: (url) => request('GET', url),
  post: (url, body = {}) => request('POST', url, body),
  put: (url, body = {}) => request('PUT', url, body),
};
