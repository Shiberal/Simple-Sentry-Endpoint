function parseIntWithMin(value, fallback, min) {
  const parsed = parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed >= min ? parsed : fallback;
}

const DEFAULT_MS = parseIntWithMin(process.env.MONITOR_HTTP_TIMEOUT_MS, 15000, 1);
const DEFAULT_RETRY_COUNT = parseIntWithMin(
  process.env.MONITOR_HTTP_RETRY_COUNT,
  2,
  0
);
const DEFAULT_RETRY_DELAY_MS = parseIntWithMin(
  process.env.MONITOR_HTTP_RETRY_DELAY_MS,
  10000,
  0
);

function sleep(ms) {
  if (!ms) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function parsePingUrlsInput(input) {
  if (input == null) return [];
  if (Array.isArray(input)) {
    return [...new Set(input.map((x) => String(x).trim()).filter(Boolean))];
  }
  if (typeof input === 'string') {
    const parts = [];
    for (const line of String(input).split(/[\r\n]+/)) {
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

async function pingUrlOnce(url, timeoutMs) {
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
    return {
      ok: res.ok,
      status: res.status,
      ms: Date.now() - t0
    };
  } catch (e) {
    clearTimeout(timer);
    const aborted = e?.name === 'AbortError';
    return {
      ok: false,
      error: aborted ? `timeout (${timeoutMs}ms)` : String(e?.message || e),
      ms: Date.now() - t0
    };
  }
}

export async function pingUrlListSequential(
  urls,
  options = {}
) {
  /** @type {Array<{ url: string, ok?: boolean, status?: number, ms?: number, error?: string, attempts?: Array<{ ok?: boolean, status?: number, ms?: number, error?: string }> }>} */
  const results = [];
  const t0All = Date.now();
  const {
    timeoutMs = DEFAULT_MS,
    retries = DEFAULT_RETRY_COUNT,
    retryDelayMs = DEFAULT_RETRY_DELAY_MS
  } = typeof options === 'number' ? { timeoutMs: options } : options;
  const resolvedTimeoutMs = parseIntWithMin(timeoutMs, DEFAULT_MS, 1);
  const resolvedRetries = parseIntWithMin(retries, DEFAULT_RETRY_COUNT, 0);
  const resolvedRetryDelayMs = parseIntWithMin(
    retryDelayMs,
    DEFAULT_RETRY_DELAY_MS,
    0
  );

  for (const url of urls) {
    const attempts = [];
    const maxAttempts = 1 + resolvedRetries;

    for (let i = 0; i < maxAttempts; i += 1) {
      const attempt = await pingUrlOnce(url, resolvedTimeoutMs);
      attempts.push(attempt);

      if (attempt.ok === true) break;
      if (i < maxAttempts - 1) await sleep(resolvedRetryDelayMs);
    }

    const finalAttempt = attempts[attempts.length - 1] || { ok: false };
    results.push({
      url,
      ...finalAttempt,
      attempts
    });
  }

  const allOk = urls.length === 0 ? true : results.every((r) => r.ok === true);

  return {
    allOk,
    results,
    totalMs: Date.now() - t0All
  };
}
