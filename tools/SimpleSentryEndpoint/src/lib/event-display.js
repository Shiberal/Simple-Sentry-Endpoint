// Pure helpers for presenting events and issues in the UI.

// Prettify function to format JSON or text (loosely)
export const prettifyContent = (content) => {
  if (!content) return content;

  const trimmed = content.trim();

  // Helper function to find balanced JSON structures
  const findBalancedJson = (str, startChar, endChar) => {
    let depth = 0;
    let start = -1;
    for (let i = 0; i < str.length; i++) {
      if (str[i] === startChar) {
        if (depth === 0) start = i;
        depth++;
      } else if (str[i] === endChar) {
        depth--;
        if (depth === 0 && start !== -1) {
          return str.substring(start, i + 1);
        }
      }
    }
    return null;
  };

  // Try to parse as direct JSON
  try {
    const parsed = JSON.parse(trimmed);
    return JSON.stringify(parsed, null, 2);
  } catch (e) {
    // Try to find JSON objects/arrays embedded in the content
    const jsonObject = findBalancedJson(trimmed, '{', '}');
    const jsonArray = findBalancedJson(trimmed, '[', ']');

    // Try object first
    if (jsonObject) {
      try {
        const parsed = JSON.parse(jsonObject);
        const formatted = JSON.stringify(parsed, null, 2);
        return trimmed.replace(jsonObject, formatted);
      } catch (e2) {
        // Try unescaping common escape sequences
        try {
          const unescaped = jsonObject
            .replace(/\\"/g, '"')
            .replace(/\\n/g, '\n')
            .replace(/\\t/g, '\t')
            .replace(/\\r/g, '\r');
          const parsed = JSON.parse(unescaped);
          const formatted = JSON.stringify(parsed, null, 2);
          return trimmed.replace(jsonObject, formatted);
        } catch (e3) {
          // Continue to try array or other methods
        }
      }
    }

    // Try array
    if (jsonArray) {
      try {
        const parsed = JSON.parse(jsonArray);
        const formatted = JSON.stringify(parsed, null, 2);
        return trimmed.replace(jsonArray, formatted);
      } catch (e2) {
        // Continue to other methods
      }
    }

    // Try parsing as a JSON string (double-encoded, e.g., "{\"key\":\"value\"}")
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      try {
        // First unescape the outer quotes
        const unescaped = trimmed.slice(1, -1)
          .replace(/\\"/g, '"')
          .replace(/\\n/g, '\n')
          .replace(/\\t/g, '\t')
          .replace(/\\r/g, '\r')
          .replace(/\\\\/g, '\\');
        const parsed = JSON.parse(unescaped);
        return JSON.stringify(parsed, null, 2);
      } catch (e2) {
        // Continue to text formatting
      }
    }

    // If not JSON, format as text with better line breaks
    // Replace common escape sequences and format
    return content
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\r/g, '\r')
      .replace(/\\"/g, '"')
      .replace(/\\'/g, "'")
      .replace(/\\\\/g, '\\');
  }
};

export const getEventType = (event) => {
  // Support both event and issue data structures
  const data = event.data || event;

  // Check if it's a message event (has message but no exception)
  if (data.message && !data.exception) return 'message';

  // Otherwise check by level
  if (data.level === 'error' || event.level === 'error' || data.exception) return 'error';
  if (data.level === 'warning' || event.level === 'warning') return 'warning';
  if (data.level === 'info' || event.level === 'info') return 'info';
  return 'event';
};

// Get event type badge info (for CSP, minidump, etc.)
export const getEventTypeBadge = (issue) => {
  // Check if issue has CSP-specific fields
  if (issue.violatedDirective || issue.blockedUri) {
    return { icon: '🛡️', label: 'CSP', color: '#f97316' }; // Orange
  }
  // Check events array for event type if available
  if (issue.events && issue.events.length > 0) {
    const latestEvent = issue.events[0];
    if (latestEvent.eventType === 'MINIDUMP') {
      return { icon: '💥', label: 'Crash', color: '#9333ea' }; // Purple
    }
    if (latestEvent.eventType === 'TRANSACTION') {
      return { icon: '⚡', label: 'Perf', color: '#3b82f6' }; // Blue
    }
    if (latestEvent.eventType === 'MESSAGE') {
      return { icon: '💬', label: 'Message', color: '#10b981' }; // Green
    }
    if (latestEvent.eventType === 'CSP') {
      return { icon: '🛡️', label: 'CSP', color: '#f97316' }; // Orange
    }
  }
  // Default for regular errors
  return null;
};

export const getEventTitle = (event) => {
  // If it's an issue object (has title field)
  if (event.title) {
    return event.title;
  }
  // Otherwise it's an event object
  const data = event.data || {};
  if (data.exception?.values?.[0]?.value) {
    return data.exception.values[0].value;
  }
  if (data.message) return data.message;
  if (data.transaction) return data.transaction;
  return 'Unknown Event';
};
