/**
 * Normalize page URL from Sentry event payload (request.url vs extra.page_url).
 * @param {Object} eventData
 * @returns {string|null}
 */
export function normalizePageUrl(eventData) {
  if (!eventData || typeof eventData !== 'object') return null;
  const req = eventData.request;
  if (req?.url) return String(req.url);
  const extra = eventData.extra;
  if (extra && typeof extra === 'object') {
    if (extra.page_url != null) return String(extra.page_url);
    if (extra.pageUrl != null) return String(extra.pageUrl);
  }
  return null;
}

const hostOf = (value) => {
  if (!value) return null;
  try {
    return new URL(String(value)).host.toLowerCase() || null;
  } catch {
    return null;
  }
};

/**
 * Where an event came from, as host[:port]: the page/request URL when the SDK sent one,
 * otherwise the HTTP Origin/Referer of the ingest request, otherwise the SDK's server_name.
 * @param {Object} eventData
 * @param {{ headers?: Record<string, string|string[]> }} [req]
 * @returns {string|null}
 */
export function normalizeOrigin(eventData, req) {
  const h = eventData?.request?.headers || {};
  const fromEvent = hostOf(normalizePageUrl(eventData)) || hostOf(h.Origin || h.origin) || hostOf(h.Referer || h.referer);
  if (fromEvent) return fromEvent;
  const rh = req?.headers || {};
  const fromRequest = hostOf(rh.origin) || hostOf(rh.referer);
  if (fromRequest) return fromRequest;
  const name = eventData?.server_name;
  return typeof name === 'string' && name.trim() ? name.trim().toLowerCase() : null;
}

/**
 * Release string from SDK event.
 * @param {Object} eventData
 * @returns {string|null}
 */
export function normalizeRelease(eventData) {
  if (!eventData) return null;
  if (eventData.release != null && String(eventData.release).trim()) {
    return String(eventData.release);
  }
  return null;
}

/**
 * Promoted facets for indexing / filters.
 */
export function promoteEventFacets(eventData, req) {
  return {
    promotedPageUrl: normalizePageUrl(eventData),
    promotedOrigin: normalizeOrigin(eventData, req),
    promotedRelease: normalizeRelease(eventData),
    promotedEnv:
      eventData.environment != null && String(eventData.environment).trim()
        ? String(eventData.environment)
        : null
  };
}
