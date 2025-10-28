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
  
  // Normalize message by removing variable parts
  message = message
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<uuid>')  // UUIDs first
    .replace(/\b(https?:\/\/[^\s]+)/g, '<url>')  // Full URLs
    .replace(/\/[^\s,;]*(\.php|\.js|\.css|\.ico|\.png|\.jpg|\.svg)/gi, '<path>')  // File paths
    .replace(/\d{4,}/g, '<num>')  // Large numbers (IDs, timestamps)
    .replace(/\s+\d+\s+/g, ' <num> ')  // Numbers with spaces
    .replace(/["']([^"']+)["']/g, '<str>')  // String literals
    .replace(/\s+/g, ' ')  // Normalize whitespace
    .toLowerCase()
    .trim();
  
  components.push(message);

  // 3. Stack trace (first 2-3 frames for signature)
  if (eventData.exception?.values?.[0]?.stacktrace?.frames && 
      eventData.exception.values[0].stacktrace.frames.length > 0) {
    const frames = eventData.exception.values[0].stacktrace.frames;
    // Get last few frames (most relevant) or first few if reversed
    const relevantFrames = frames.slice(-3).map(frame => {
      // Normalize file paths
      let filename = (frame.filename || frame.module || '').replace(/^.*\/(vendor|node_modules)\//, '<vendor>/');
      const func = frame.function || '';
      // Don't include line numbers in fingerprint as they can change
      return `${filename}:${func}`;
    });
    components.push(...relevantFrames);
  } else {
    // For errors without stack traces, use additional context
    // Include platform to differentiate similar errors from different sources
    if (eventData.platform) {
      components.push(`platform:${eventData.platform}`);
    }
    // Include environment to separate prod/dev issues
    if (eventData.environment) {
      components.push(`env:${eventData.environment}`);
    }
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


