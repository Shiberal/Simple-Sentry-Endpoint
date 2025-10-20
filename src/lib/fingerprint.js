import crypto from 'crypto';

/**
 * Generate a fingerprint for error grouping
 * @param {Object} eventData - The event data from Sentry
 * @returns {string} - SHA256 hash fingerprint
 */
export function generateFingerprint(eventData) {
  // Extract key components for fingerprinting
  const components = [];

  // 1. Error type/name
  if (eventData.exception?.values?.[0]?.type) {
    components.push(eventData.exception.values[0].type);
  }

  // 2. Error message (normalized)
  let message = eventData.message || eventData.exception?.values?.[0]?.value || '';
  
  // Normalize message by removing numbers, UUIDs, timestamps, etc.
  message = message
    .replace(/\d+/g, '<num>')  // Replace numbers
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<uuid>')  // UUIDs
    .replace(/\b(https?:\/\/[^\s]+)/g, '<url>')  // URLs
    .replace(/["']([^"']+)["']/g, '<str>')  // String literals
    .toLowerCase()
    .trim();
  
  components.push(message);

  // 3. Stack trace (first 2-3 frames for signature)
  if (eventData.exception?.values?.[0]?.stacktrace?.frames) {
    const frames = eventData.exception.values[0].stacktrace.frames;
    // Get last few frames (most relevant) or first few if reversed
    const relevantFrames = frames.slice(-3).map(frame => {
      const filename = frame.filename || frame.module || '';
      const func = frame.function || '';
      const line = frame.lineno || '';
      return `${filename}:${func}:${line}`;
    });
    components.push(...relevantFrames);
  }

  // 4. Culprit (if available)
  if (eventData.culprit) {
    components.push(eventData.culprit);
  }

  // Create fingerprint string
  const fingerprintString = components.filter(Boolean).join('||');

  // Return SHA256 hash
  return crypto
    .createHash('sha256')
    .update(fingerprintString)
    .digest('hex');
}

/**
 * Extract issue title from event data
 * @param {Object} eventData 
 * @returns {string}
 */
export function extractTitle(eventData) {
  if (eventData.exception?.values?.[0]) {
    const exc = eventData.exception.values[0];
    return `${exc.type || 'Error'}: ${exc.value || 'Unknown error'}`;
  }
  
  if (eventData.message) {
    return eventData.message;
  }

  return 'Unknown Error';
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


