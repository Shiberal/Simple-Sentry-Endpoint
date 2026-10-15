// Thin HTTP client for the Sentry Monitor API. Logs in once with email/password
// and reuses the session cookie, re-authenticating on a 401.
export class SentryClient {
  constructor({ baseUrl, email, password, cronSecret, fetchImpl = fetch }) {
    this.baseUrl = String(baseUrl || '').replace(/\/+$/, '');
    this.email = email;
    this.password = password;
    this.cronSecret = cronSecret;
    this.fetch = fetchImpl;
    this.cookie = null;
  }

  async login() {
    if (!this.email || !this.password) {
      throw new Error('SENTRY_MONITOR_EMAIL and SENTRY_MONITOR_PASSWORD are required');
    }
    const res = await this.fetch(`${this.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: this.email, password: this.password })
    });
    if (!res.ok) throw new Error(`Login failed (HTTP ${res.status})`);
    const setCookie = res.headers.getSetCookie?.() ?? [res.headers.get('set-cookie')].filter(Boolean);
    const session = setCookie.map((c) => c.split(';')[0]).find((c) => c.startsWith('session='));
    if (!session) throw new Error('Login succeeded but no session cookie was returned');
    this.cookie = session;
  }

  async request(method, path, { query, body, headers = {}, auth = 'session', retried = false } = {}) {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [k, v] of Object.entries(query || {})) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    }
    const h = { ...headers };
    if (auth === 'session') {
      if (!this.cookie) await this.login();
      h.cookie = this.cookie;
    }
    if (body !== undefined) h['content-type'] = 'application/json';
    const res = await this.fetch(url, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
    if (res.status === 401 && auth === 'session' && !retried) {
      this.cookie = null;
      return this.request(method, path, { query, body, headers, auth, retried: true });
    }
    const text = await res.text();
    let data;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!res.ok) {
      const msg = (data && (data.error || data.message)) || text || res.statusText;
      throw new Error(`${method} ${path} failed (HTTP ${res.status}): ${msg}`);
    }
    return data;
  }

  get(path, query) { return this.request('GET', path, { query }); }
  post(path, body, query) { return this.request('POST', path, { body, query }); }
  patch(path, body) { return this.request('PATCH', path, { body }); }
}
