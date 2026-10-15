import { resolveMonitorScope } from '@/lib/monitor-scope';
import { runMonitorHttpPings } from '@/lib/monitor-ping-runner';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end();
  }

  const scope = await resolveMonitorScope(req, req.query.id);
  if (scope.error) return res.status(scope.status).json({ error: scope.error });

  const body = req.body || {};
  const mid =
    body.monitorId != null ? parseInt(String(body.monitorId), 10) : NaN;

  try {
    const summaries = await runMonitorHttpPings(
      Number.isFinite(mid) && !isNaN(mid)
        ? { monitorId: mid, scope: scope.where, force: true }
        : { scope: scope.where, force: true }
    );

    return res.status(200).json({
      success: true,
      ran: summaries.length,
      summaries
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message || 'Ping run failed' });
  }
}
