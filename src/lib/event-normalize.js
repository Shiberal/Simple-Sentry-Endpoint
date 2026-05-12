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
export function promoteEventFacets(eventData) {
  return {
    promotedPageUrl: normalizePageUrl(eventData),
    promotedRelease: normalizeRelease(eventData),
    promotedEnv:
      eventData.environment != null && String(eventData.environment).trim()
        ? String(eventData.environment)
        : null
  };
}
