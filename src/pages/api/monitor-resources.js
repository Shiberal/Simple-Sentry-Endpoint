import prisma from '@/lib/prisma';
import { parseSample, MIN_SAMPLE_GAP_MS, RESOURCE_RETENTION_MS } from '@/lib/monitor-resources';

// Ingest for the reporter running next to a monitored service. The bearer token identifies the monitor.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return res.status(401).json({ error: 'Missing bearer token' });

  const monitor = await prisma.cronMonitor.findUnique({ where: { reportToken: token }, select: { id: true } });
  if (!monitor) return res.status(401).json({ error: 'Invalid token' });

  const { sample, error } = parseSample(req.body);
  if (error) return res.status(400).json({ error });

  try {
    const last = await prisma.monitorResourceSample.findFirst({
      where: { monitorId: monitor.id },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true }
    });
    if (last && Date.now() - last.createdAt.getTime() < MIN_SAMPLE_GAP_MS) {
      return res.status(429).json({ error: 'Too frequent; send about once a minute' });
    }
    await prisma.monitorResourceSample.create({ data: { monitorId: monitor.id, ...sample } });
    await prisma.monitorResourceSample.deleteMany({
      where: { monitorId: monitor.id, createdAt: { lt: new Date(Date.now() - RESOURCE_RETENTION_MS) } }
    });
    return res.status(201).json({ success: true });
  } catch (e) {
    console.error('[monitor-resources]', e);
    return res.status(500).json({ error: 'Failed to store sample' });
  }
}
