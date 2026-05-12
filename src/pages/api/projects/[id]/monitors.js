import prisma from '@/lib/prisma';
import { parse } from 'cookie';

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
  const { method, query } = req;
  const { id } = query;
  const projectId = parseInt(id, 10);

  if (method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end();
  }

  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  if (isNaN(projectId)) return res.status(400).json({ error: 'Bad project id' });

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      users: { select: { id: true } }
    }
  });

  if (!project) return res.status(404).json({ error: 'Not found' });
  if (!project.users.some((u) => u.id === user.userId)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const monitors = await prisma.cronMonitor.findMany({
      where: { projectId },
      orderBy: { updatedAt: 'desc' },
      include: {
        checkIns: {
          orderBy: { createdAt: 'desc' },
          take: 5
        }
      }
    });
    res.status(200).json({ success: true, monitors });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
