import crypto from 'node:crypto';

export const RESOURCE_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
// Reporters push about once a minute; anything faster than this is dropped to protect the table
export const MIN_SAMPLE_GAP_MS = 5000;

export function generateReportToken() {
  return `smr_${crypto.randomBytes(24).toString('hex')}`;
}

const FIELDS = ['cpuPercent', 'memUsedBytes', 'memLimitBytes', 'cpuLimitCores'];
const MAX = { cpuPercent: 100000, memUsedBytes: 2 ** 50, memLimitBytes: 2 ** 50, cpuLimitCores: 100000 };

/** Accepts a reporter payload; returns { sample } with only valid numeric fields, or { error }. */
export function parseSample(body) {
  if (!body || typeof body !== 'object') return { error: 'JSON body required' };
  const sample = {};
  for (const f of FIELDS) {
    const v = body[f];
    if (v === undefined || v === null) continue;
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > MAX[f]) {
      return { error: `${f} must be a non-negative number` };
    }
    sample[f] = v;
  }
  if (sample.cpuPercent === undefined && sample.memUsedBytes === undefined) {
    return { error: 'cpuPercent or memUsedBytes required' };
  }
  return { sample };
}

/** Evenly thin a series to at most `max` points so long windows stay cheap to send and draw. */
export function downsample(rows, max = 240) {
  if (rows.length <= max) return rows;
  const step = rows.length / max;
  return Array.from({ length: max }, (_, i) => rows[Math.floor(i * step)]);
}
