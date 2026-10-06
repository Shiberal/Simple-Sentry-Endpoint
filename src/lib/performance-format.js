// Pure formatting helpers for the performance page.

const getHeaderValue = (headers, names) => {
  if (!headers) return null;
  const wanted = names.map((name) => name.toLowerCase());

  if (Array.isArray(headers)) {
    const match = headers.find((entry) => {
      if (!Array.isArray(entry) || entry.length < 2) return false;
      return wanted.includes(String(entry[0]).toLowerCase());
    });
    return match ? String(match[1]) : null;
  }

  if (typeof headers === 'object') {
    const key = Object.keys(headers).find((headerName) =>
      wanted.includes(headerName.toLowerCase())
    );
    return key ? String(headers[key]) : null;
  }

  return null;
};

const formatSourceUrl = (url) => {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.pathname}${parsed.search}`;
  } catch {
    return String(url);
  }
};

export const getTransactionSourceContext = (transaction) => {
  const data = transaction.data || {};
  const request = data.request || {};
  const extra = data.extra || {};
  const sourceUrl =
    transaction.promotedPageUrl ||
    request.url ||
    extra.page_url ||
    extra.pageUrl ||
    getHeaderValue(request.headers, ['referer', 'referrer', 'origin']);
  const sdk = data.sdk?.name
    ? `${data.sdk.name}${data.sdk.version ? ` ${data.sdk.version}` : ''}`
    : null;

  return {
    endpoint: data.transaction || data.name || 'Unknown',
    sourceUrl: sourceUrl || null,
    sourceLabel: formatSourceUrl(sourceUrl) || 'Unknown source',
    method: request.method || null,
    platform: data.platform || null,
    environment: data.environment || transaction.promotedEnv || null,
    release: data.release || transaction.promotedRelease || null,
    sdk
  };
};

export const formatBytes = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

export const formatDuration = (seconds) => {
  if (seconds < 1) return `${Math.round(seconds * 1000)}ms`;
  return `${seconds.toFixed(2)}s`;
};

export const formatPingDuration = (ms) => {
  if (!Number.isFinite(ms) || ms <= 0) return '0ms';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
};
