export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).end();
  }

  const expected = process.env.MONITOR_CRON_SECRET;
  if (!expected || String(expected).trim() === '') {
    return res.status(503).json({
      error: 'MONITOR_CRON_SECRET must be configured to run pings from this endpoint'
    });
  }

  const bearer =
    typeof req.headers.authorization === 'string' &&
    req.headers.authorization.startsWith('Bearer ')
      ? req.headers.authorization.slice(7).trim()
      : null;
  const qSecret =
    typeof req.query.secret === 'string' ? req.query.secret.trim() : null;

  if (bearer !== expected && qSecret !== expected) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const { runMonitorHttpPings } = await import('@/lib/monitor-ping-runner');
    const summaries = await runMonitorHttpPings();
    return res.status(200).json({
      success: true,
      ranMonitors: summaries.length,
      summaries
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message || 'cron ping failed' });
  }
}
