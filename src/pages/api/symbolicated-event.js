import prisma from '@/lib/prisma';
import { parse } from 'cookie';
import { symbolicatedEventPayload } from '@/lib/symbolicate';

function getUser(req) {
  try {
    const cookies = parse(req.headers.cookie || '');
    const session = cookies.session;
    return session ? JSON.parse(session) : null;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end();
  }

  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const eid = req.query.eventId != null ? parseInt(req.query.eventId, 10) : NaN;
  if (isNaN(eid)) return res.status(400).json({ error: 'eventId query required' });

  const symbolic =
    req.query.symbolic === '1' || req.query.symbolic === 'true';

  const event = await prisma.event.findUnique({
    where: { id: eid },
    include: {
      project: {
        include: {
          users: { select: { id: true } }
        }
      }
    }
  });

  if (!event) return res.status(404).json({ error: 'Event not found' });

  const allowed = event.project.users.some((u) => u.id === user.userId);
  if (!allowed) return res.status(403).json({ error: 'Access denied' });

  let outData =
    typeof event.data === 'object' && event.data
      ? event.data
      : {};
  if (
    symbolic &&
    (event.eventType === 'ERROR' || event.eventType === 'MESSAGE')
  ) {
    try {
      outData = await symbolicatedEventPayload(
        JSON.parse(JSON.stringify(event.data)),
        event.project.id
      );
    } catch (err) {
      console.warn('symbolicate failed:', err.message);
      outData = event.data;
    }
  }

  return res.status(200).json({ success: true, data: outData, symbolic });
}
