import prisma from '@/lib/prisma';
import { scopeToAccessibleProjects } from '@/lib/session';

export default async function handler(req, res) {
  const { method } = req;
  const {
    projectId,
    limit = 50,
    promotedPageUrl,
    promotedRelease,
    promotedEnv,
    cursor
  } = req.query;

  if (method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${method} Not Allowed`);
  }

  const scope = await scopeToAccessibleProjects(req, res, projectId);
  if (!scope) return;

  switch (method) {
    case 'GET':
      try {
        const where = scope.projectId !== undefined ? { projectId: scope.projectId } : { project: scope.projectWhere };

        if (promotedPageUrl) {
          where.promotedPageUrl = {
            contains: String(promotedPageUrl),
            mode: 'insensitive'
          };
        }
        if (promotedRelease) {
          where.promotedRelease = String(promotedRelease);
        }
        if (promotedEnv) {
          where.promotedEnv = String(promotedEnv);
        }

        const skipCursor = cursor ? parseInt(cursor, 10) : 0;
        
        const events = await prisma.event.findMany({
          where,
          include: {
            project: true
          },
          orderBy: {
            createdAt: 'desc'
          },
          skip: Number.isFinite(skipCursor) ? skipCursor : 0,
          take: parseInt(limit, 10)
        });

        res.status(200).json({ 
          success: true, 
          events 
        });
      } catch (error) {
        console.error('Error fetching events:', error);
        res.status(500).json({ 
          success: false, 
          error: 'Failed to fetch events',
          message: error.message
        });
      }
      break;

    default:
      res.setHeader('Allow', ['GET']);
      res.status(405).end(`Method ${method} Not Allowed`);
  }
}

