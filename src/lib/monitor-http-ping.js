/** @typedef {{ url: string, ok?: boolean, status?: number, ms?: number, error?: string }} PingResult */

const DEFAULT_MS = parseInt(process.env.MONITOR_HTTP_TIMEOUT_MS || '15000', 10);

/**
 * @param {unknown} input
 * @returns {string[]}
 */
export function parsePingUrlsInput(input) {
  if (input == null) return [];
  if (Array.isArray(input)) {
    return [...new Set(input.map((x) => String(x).trim()).filter(Boolean))];
  }
  if (typeof input === 'string') {
    const parts = [];
    const lines = String(input).split(/[\r\n]+/);
    for (const line of lines) {
      for (const part of line.split(',')) {
        const t = part.trim();
        if (t) parts.push(t);
      }
    }
    return [...new Set(parts)];
  }
  return [];
}

export function sanitizePingUrls(urls) {
  const out = [];
  for (const raw of urls) {
    const s = String(raw).trim();
    if (!s) continue;
    try {
      const u = new URL(s);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') continue;
      out.push(u.toString());
    } catch {
      continue;
    }
  }
  return [...new Set(out)];
}

/**
 * GET each URL (sequential); any non-2xx counts as failure.
 */
export async function pingUrlListSequential(urls, timeoutMs = DEFAULT_MS) {
  /** @type {PingResult[]} */
  const results = [];
  const t0All = Date.now();

  for (const url of urls) {
    const t0 = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Sentry-Monitor-Uptime/1.0'
        }
      });
      clearTimeout(timer);
      const ms = Date.now() - t0;
      const ok = res.ok;
      results.push({ url, ok, status: res.status, ms });
    } catch (e) {
      clearTimeout(timer);
      const aborted = e.name === 'AbortError';
      results.push({
        url,
        ok: false,
        error: aborted ? `timeout (${timeoutMs}ms)` : String(e.message || e),
        ms: Date.now() - t0
      });
    }
  }

  const allOk = urls.length === 0 ? true : results.every((r) => r.ok === true);

  return {
    allOk,
    results,
    totalMs: Date.now() - t0All
  };
}
