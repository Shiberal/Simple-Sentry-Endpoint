import prisma from '@/lib/prisma';

export default async function handler(req, res) {
  const { method } = req;
  const {
    projectId,
    limit = 50,
    promotedPageUrl,
    promotedRelease,
    promotedEnv,
    eventType,
    cursor
  } = req.query;

  switch (method) {
    case 'GET':
      try {
        const where = projectId ? { projectId: parseInt(projectId) } : {};

        // Monitor check-ins (SDK and server pings) are not errors: keep them out of the event
        // list that feeds issue views unless they are asked for explicitly
        where.eventType = eventType ? String(eventType).toUpperCase() : { not: 'CHECK_IN' };

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

