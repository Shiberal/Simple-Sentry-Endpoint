/**
 * Format JSON or text embedded in error/message strings for display.
 */
export function prettifyContent(content) {
  if (!content) return content;

  const trimmed = content.trim();

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

  try {
    const parsed = JSON.parse(trimmed);
    return JSON.stringify(parsed, null, 2);
  } catch {
    const jsonObject = findBalancedJson(trimmed, '{', '}');
    const jsonArray = findBalancedJson(trimmed, '[', ']');

    if (jsonObject) {
      try {
        const parsed = JSON.parse(jsonObject);
        const formatted = JSON.stringify(parsed, null, 2);
        return trimmed.replace(jsonObject, formatted);
      } catch {
        try {
          const unescaped = jsonObject
            .replace(/\\"/g, '"')
            .replace(/\\n/g, '\n')
            .replace(/\\t/g, '\t')
            .replace(/\\r/g, '\r');
          const parsed = JSON.parse(unescaped);
          const formatted = JSON.stringify(parsed, null, 2);
          return trimmed.replace(jsonObject, formatted);
        } catch {
          /* continue */
        }
      }
    }

    if (jsonArray) {
      try {
        const parsed = JSON.parse(jsonArray);
        const formatted = JSON.stringify(parsed, null, 2);
        return trimmed.replace(jsonArray, formatted);
      } catch {
        /* continue */
      }
    }

    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      try {
        const unescaped = trimmed
          .slice(1, -1)
          .replace(/\\"/g, '"')
          .replace(/\\n/g, '\n')
          .replace(/\\t/g, '\t')
          .replace(/\\r/g, '\r')
          .replace(/\\\\/g, '\\');
        const parsed = JSON.parse(unescaped);
        return JSON.stringify(parsed, null, 2);
      } catch {
        /* fall through */
      }
    }

    return content
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\r/g, '\r')
      .replace(/\\"/g, '"')
      .replace(/\\'/g, "'")
      .replace(/\\\\/g, '\\');
  }
}
