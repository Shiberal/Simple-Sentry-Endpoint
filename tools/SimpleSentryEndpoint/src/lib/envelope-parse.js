/**
 * Parse newline-delimited Sentry envelope body into items.
 */
export function parseSentryEnvelope(rawBody) {
  const lines = rawBody.split(/\n/);
  const items = [];
  let i = 0;
  let envelopeHeader = {};
  if (i < lines.length && lines[i].trim()) {
    try {
      envelopeHeader = JSON.parse(lines[i]);
    } catch {
      envelopeHeader = {};
    }
    i++;
  }

  while (i < lines.length) {
    const line = lines[i];
    if (line === '' || line === undefined) {
      i++;
      continue;
    }
    let itemHeader;
    try {
      itemHeader = JSON.parse(line);
    } catch {
      i++;
      continue;
    }
    i++;
    const payloadLine = lines[i] ?? '';
    i++;

    let payload = payloadLine;
    if (payloadLine && (typeof itemHeader.type === 'string' || itemHeader.length != null)) {
      try {
        payload = JSON.parse(payloadLine);
      } catch {
        payload = { _raw: payloadLine };
      }
    }

    items.push({ header: itemHeader, payload });
  }

  return { envelopeHeader, items };
}
