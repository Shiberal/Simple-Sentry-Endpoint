/**
 * Sentry structured logs (envelope item type `log`).
 * Flutter / mobile SDKs send batches as { items: [ { body, level, attributes, ... } ] }.
 * @see https://develop.sentry.dev/sdk/telemetry/logs/
 */

const SENTRY_ATTR_PREFIX = 'sentry.';

function attrValue(attr) {
  if (attr == null) return undefined;
  if (typeof attr === 'object' && !Array.isArray(attr) && 'value' in attr) {
    return attr.value;
  }
  return attr;
}

export function isLogEntry(entry) {
  return (
    entry != null &&
    typeof entry === 'object' &&
    !Array.isArray(entry) &&
    typeof entry.body === 'string' &&
    typeof entry.level === 'string'
  );
}

/** True when payload is a log container (not a normal error/transaction event). */
export function isLogContainer(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
  if (!Array.isArray(payload.items) || payload.items.length === 0) return false;
  // Avoid mistaking unrelated { items: [...] } for logs
  return payload.items.every(isLogEntry);
}

function pickPrefixed(attrs, prefix) {
  const out = {};
  for (const [key, raw] of Object.entries(attrs || {})) {
    if (!key.startsWith(prefix)) continue;
    const short = key.slice(prefix.length);
    if (!short || short.includes('.')) continue;
    const v = attrValue(raw);
    if (v !== undefined) out[short] = v;
  }
  return out;
}

function inferPlatform(sdkName, osName) {
  const sdk = String(sdkName || '').toLowerCase();
  if (sdk.includes('flutter') || sdk.includes('dart')) return 'flutter';
  if (sdk.includes('react-native')) return 'javascript';
  if (sdk.includes('cocoa') || sdk.includes('android')) return 'native';
  const os = String(osName || '').toLowerCase();
  if (os === 'ios' || os === 'android') return 'flutter';
  return undefined;
}

/**
 * Map one wire log entry to a Sentry event-shaped object for MESSAGE ingest.
 */
export function logEntryToEvent(entry, envelopeHeader = {}) {
  const attrs = entry.attributes && typeof entry.attributes === 'object' ? entry.attributes : {};
  const get = (key) => attrValue(attrs[key]);

  const release = get('sentry.release') ?? envelopeHeader.release ?? undefined;
  const environment =
    get('sentry.environment') ?? envelopeHeader.environment ?? undefined;
  const sdkName = get('sentry.sdk.name');
  const sdkVersion = get('sentry.sdk.version');
  const template = get('sentry.message.template');
  const osName = get('os.name');

  const user = pickPrefixed(attrs, 'user.');
  const os = pickPrefixed(attrs, 'os.');
  const device = pickPrefixed(attrs, 'device.');

  const tags = {};
  const extra = {};
  for (const [key, raw] of Object.entries(attrs)) {
    if (
      key.startsWith('user.') ||
      key.startsWith('os.') ||
      key.startsWith('device.') ||
      key === 'sentry.release' ||
      key === 'sentry.environment' ||
      key === 'sentry.sdk.name' ||
      key === 'sentry.sdk.version' ||
      key === 'sentry.message.template' ||
      key.startsWith('sentry.message.parameter.')
    ) {
      continue;
    }
    const v = attrValue(raw);
    if (v === undefined) continue;
    if (key.startsWith(SENTRY_ATTR_PREFIX)) {
      extra[key] = v;
    } else if (
      (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') &&
      String(v).length < 200
    ) {
      tags[key] = String(v);
    } else {
      extra[key] = v;
    }
  }

  if (entry.severity_number != null) extra.severity_number = entry.severity_number;

  const contexts = {};
  if (Object.keys(os).length) contexts.os = os;
  if (Object.keys(device).length) contexts.device = device;
  if (entry.trace_id || entry.span_id) {
    contexts.trace = {
      ...(entry.trace_id ? { trace_id: entry.trace_id } : {}),
      ...(entry.span_id ? { span_id: entry.span_id } : {})
    };
  }

  const event = {
    message: entry.body,
    level: String(entry.level || 'info').toLowerCase(),
    logger: 'sentry.log',
    timestamp: entry.timestamp,
    ...(release != null ? { release: String(release) } : {}),
    ...(environment != null ? { environment: String(environment) } : {}),
    ...(Object.keys(user).length ? { user } : {}),
    ...(Object.keys(contexts).length ? { contexts } : {}),
    ...(Object.keys(tags).length ? { tags } : {}),
    ...(Object.keys(extra).length ? { extra } : {}),
    ...(sdkName
      ? { sdk: { name: String(sdkName), ...(sdkVersion != null ? { version: String(sdkVersion) } : {}) } }
      : {})
  };

  const platform = inferPlatform(sdkName, osName);
  if (platform) event.platform = platform;

  // Parameterized logs group on the template, not the interpolated body
  if (typeof template === 'string' && template.trim()) {
    event.fingerprint = ['sentry.log', template];
  }

  return event;
}

export function logContainerToEvents(payload, envelopeHeader = {}) {
  if (!isLogContainer(payload)) return [];
  return payload.items.map((entry) => logEntryToEvent(entry, envelopeHeader));
}
