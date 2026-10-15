import { normalizePageUrl } from '@/lib/event-normalize';

function clonePayload(data) {
  try {
    return structuredClone(data);
  } catch {
    return JSON.parse(JSON.stringify(data));
  }
}

const DEFAULT_DENY = ['password', 'passwd', 'secret', 'token', 'apikey', 'api_key', 'authorization', 'cookie'];

/** @param {any} scrubRules Project.scrubRules */
export function applyScrubRules(data, scrubRules) {
  if (!scrubRules || typeof scrubRules !== 'object') return data;
  const deny = Array.isArray(scrubRules.denyKeys)
    ? scrubRules.denyKeys.map((x) => String(x).toLowerCase())
    : DEFAULT_DENY;

  const walk = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    if (Array.isArray(obj)) {
      obj.forEach(walk);
      return;
    }
    for (const k of Object.keys(obj)) {
      const lower = k.toLowerCase();
      if (deny.some((d) => lower.includes(d))) {
        obj[k] = '[Filtered]';
      } else {
        walk(obj[k]);
      }
    }
  };

  walk(data);
  return data;
}

function transactionName(eventData) {
  return eventData.transaction || eventData.name || '';
}

/**
 * @returns {{ drop: boolean, reason?: string }}
 */
export function ingestShouldDrop(project, eventData, kind) {
  const f = project.ingestFilters;
  if (!f || typeof f !== 'object') return { drop: false };

  const page = normalizePageUrl(eventData);
  if (
    kind !== 'transaction' &&
    page &&
    Array.isArray(f.blockedUrlSubstrings)
  ) {
    for (const sub of f.blockedUrlSubstrings) {
      if (sub && page.includes(String(sub))) {
        return { drop: true, reason: 'blocked_url' };
      }
    }
  }

  if (kind === 'transaction' && Array.isArray(f.blockedTransactions)) {
    const tn = transactionName(eventData);
    for (const sub of f.blockedTransactions) {
      if (sub && String(tn).includes(String(sub))) {
        return { drop: true, reason: 'blocked_transaction' };
      }
    }
  }

  return { drop: false };
}

/** @returns {boolean} true = discard event */
export function ingestSampleDiscard(project, eventData) {
  let combined = 1;
  if (typeof project.sampleRate === 'number' && project.sampleRate >= 0) {
    combined = Math.min(combined, project.sampleRate);
  }
  if (typeof eventData.sample_rate === 'number' && eventData.sample_rate >= 0) {
    combined = Math.min(combined, eventData.sample_rate);
  }
  if (combined >= 1) return false;
  return Math.random() > combined;
}

/** Prepare cloned + scrubbed payload or skip reason */
export function prepareEventForIngest(project, eventData, kind) {
  if (ingestSampleDiscard(project, eventData)) {
    return { skipped: true, reason: 'sampled' };
  }

  const { drop, reason } = ingestShouldDrop(project, eventData, kind);
  if (drop) {
    return { skipped: true, reason };
  }

  let data = clonePayload(eventData);
  applyScrubRules(data, project.scrubRules);
  return { skipped: false, data };
}
