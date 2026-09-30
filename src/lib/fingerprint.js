import crypto from 'crypto';
import { normalizePageUrl } from './event-normalize.js';

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

/**
 * Replace the variable parts of a message (ids, hashes, urls, numbers, quoted
 * values) so "User 42 not found" and "User 97 not found" group together.
 */
export function normalizeMessage(message) {
  return String(message || '')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<uuid>')
    .replace(/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, '<email>')
    .replace(/\bhttps?:\/\/[^\s"')]+/gi, '<url>')
    .replace(/\b\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?\b/g, '<ip>')
    .replace(/\b0x[0-9a-f]+\b/gi, '<hex>')
    .replace(/\b[0-9a-f]{12,}\b/gi, '<hash>')
    .replace(/(?:\/[\w.@~-]+){2,}/g, '<path>')
    .replace(/["'`][^"'`]*["'`]/g, '<str>')
    .replace(/\b\d+(?:\.\d+)?\b/g, '<num>')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
}

/**
 * Strip host, query string and content hashes from a filename so the same code
 * groups together across deploys (main.4f9a2c1b.js -> main.js).
 */
export function normalizeFilename(filename) {
  return String(filename || '')
    .replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]+/i, '')
    .replace(/[?#].*$/, '')
    .replace(/^.*\/(node_modules|vendor)\//, '<vendor>/')
    .replace(/[.-][0-9a-f]{8,}(?=\.[a-z]+$)/i, '')
    .replace(/^\/+/, '');
}

function frameSignature(frame) {
  const file = normalizeFilename(frame.module || frame.filename || frame.abs_path);
  const func = frame.function || '<anonymous>';
  // Line numbers are deliberately left out: they shift with every edit
  return `${file}:${func}`;
}

/**
 * Most relevant frames: prefer the application's own code; frames are ordered
 * oldest to newest so the newest ones are at the end.
 */
export function relevantFrames(frames, max = 3) {
  if (!Array.isArray(frames) || frames.length === 0) return [];
  const inApp = frames.filter((f) => f.in_app === true);
  const source = inApp.length > 0 ? inApp : frames;
  return source.slice(-max).map(frameSignature);
}

/**
 * Default grouping key. Follows the same precedence as Sentry: the stack trace
 * when there is one (the message often carries variable data), otherwise the
 * exception type and normalized message.
 */
export function defaultFingerprintComponents(eventData) {
  const exception = eventData.exception?.values?.[0];
  const frames = relevantFrames(exception?.stacktrace?.frames);
  const components = [];

  if (exception?.type) components.push(exception.type);

  if (frames.length > 0) {
    components.push(...frames);
    return components;
  }

  components.push(normalizeMessage(eventData.message || exception?.value || ''));

  // Without a stack, the source of the event separates otherwise-identical messages
  if (eventData.logger) components.push(`logger:${eventData.logger}`);
  if (eventData.platform) components.push(`platform:${eventData.platform}`);
  if (eventData.culprit) components.push(eventData.culprit);
  return components;
}

/**
 * Generate a fingerprint for error grouping.
 * Honors an SDK-provided `fingerprint` array, where "{{ default }}" stands for
 * the default grouping key.
 *
 * @param {Object} eventData
 * @param {{ fingerprintByPageUrl?: boolean }} [options] Project setting: also split issues per page URL
 */
export function generateFingerprint(eventData, options = {}) {
  const components = defaultFingerprintComponents(eventData);

  if (options.fingerprintByPageUrl) {
    const page = normalizePageUrl(eventData);
    if (page) components.push(`page:${page}`);
  }

  const defaultKey = components.filter(Boolean).join('||');

  const custom = eventData.fingerprint;
  if (Array.isArray(custom) && custom.length > 0 && !custom.every((part) => part === '{{ default }}')) {
    const parts = custom.map((part) => (part === '{{ default }}' ? defaultKey : String(part)));
    return sha256(`custom||${parts.join('||')}`);
  }

  return sha256(defaultKey);
}

/**
 * Extract issue title from event data
 * @param {Object} eventData 
 * @returns {string}
 */
export function extractTitle(eventData) {
  // Try to extract from exception data
  if (eventData.exception?.values?.[0]) {
    const exc = eventData.exception.values[0];
    const errorType = exc.type || 'Error';
    const errorValue = exc.value || 'No error message provided';
    return `${errorType}: ${errorValue}`;
  }
  
  // Try to extract from message field
  if (eventData.message) {
    return eventData.message;
  }

  // Handle edge cases - event with empty/malformed exception data
  if (eventData.exception && (!eventData.exception.values || eventData.exception.values.length === 0)) {
    console.warn('⚠️ Event has exception field but no values array:', JSON.stringify(eventData.exception));
    return 'Malformed Error: Empty exception data';
  }

  // Check if this is an incomplete SDK capture (has SDK fields but no actual error data)
  if (eventData.event_id && (eventData.originalException !== undefined || eventData.syntheticException !== undefined)) {
    console.warn('⚠️ Event appears to be incomplete SDK capture:', {
      event_id: eventData.event_id,
      hasOriginalException: eventData.originalException !== undefined,
      hasSyntheticException: eventData.syntheticException !== undefined,
      keys: Object.keys(eventData)
    });
    return 'Unknown Error: Incomplete error data (missing exception details)';
  }

  // Last resort
  return 'Unknown Error: No error information provided';
}

/**
 * Extract culprit (function/file) from event data
 * @param {Object} eventData 
 * @returns {string|null}
 */
export function extractCulprit(eventData) {
  if (eventData.culprit) {
    return eventData.culprit;
  }

  // Try to get from stack trace
  if (eventData.exception?.values?.[0]?.stacktrace?.frames) {
    const frames = eventData.exception.values[0].stacktrace.frames;
    const lastFrame = frames[frames.length - 1];
    if (lastFrame) {
      const filename = lastFrame.filename || lastFrame.module || '';
      const func = lastFrame.function || '';
      return func ? `${func} (${filename})` : filename;
    }
  }

  return null;
}

/**
 * Extract error level from event data
 * @param {Object} eventData 
 * @returns {string}
 */
export function extractLevel(eventData) {
  return (eventData.level || 'error').toLowerCase();
}


