import prisma from '@/lib/prisma';
import { parse } from 'cookie';

function getUser(req) {
  try {
    const session = parse(req.headers.cookie || '').session;
    return session ? JSON.parse(session) : null;
  } catch {
    return null;
  }
}

/**
 * GET /api/issues/origins[?projectId=N]
 * Hosts events came from (last 30 days) with event counts, for the "From" filter.
 * Events saved before origins were recorded fall back to the host of their page URL.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const projectId = parseInt(req.query.projectId, 10);

  try {
    const projects = await prisma.project.findMany({
      where: { users: { some: { id: user.userId } }, ...(isNaN(projectId) ? {} : { id: projectId }) },
      select: { id: true }
    });
    const ids = projects.map((p) => p.id);
    if (!ids.length) return res.status(200).json({ success: true, origins: [] });
    const rows = await prisma.$queryRaw`
      SELECT COALESCE("promotedOrigin", lower(substring("promotedPageUrl" from '^[a-zA-Z][a-zA-Z0-9+.-]*://([^/?#]+)'))) AS origin, COUNT(*)::int AS count
      FROM "Event"
      WHERE "projectId" = ANY(${ids}) AND "eventType" IN ('ERROR', 'MESSAGE') AND "createdAt" >= ${new Date(Date.now() - 30 * 86400000)}
      GROUP BY 1
      HAVING COALESCE("promotedOrigin", lower(substring("promotedPageUrl" from '^[a-zA-Z][a-zA-Z0-9+.-]*://([^/?#]+)'))) IS NOT NULL
      ORDER BY 2 DESC
      LIMIT 50`;
    return res.status(200).json({ success: true, origins: rows });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}
