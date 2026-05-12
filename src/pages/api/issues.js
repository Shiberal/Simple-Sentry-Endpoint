import prisma from '@/lib/prisma';

export default async function handler(req, res) {
  const { method } = req;
  const {
    projectId,
    status,
    level,
    search,
    environment,
    platform,
    dateFrom,
    dateTo,
    page = 1,
    pageSize = 50,
    sortBy = 'lastSeen',
    sortOrder = 'desc',
    assignedToUserId,
    pageUrlFacet,
    releaseFacet,
    inbox
  } = req.query;

  switch (method) {
    case 'GET':
      try {
        const where = {
          mergedIntoId: null
        };

        if (projectId) {
          where.projectId = parseInt(projectId);
        }

        if (status && status !== 'all') {
          where.status = status.toUpperCase();
        }

        if (level && level !== 'all') {
          where.level = level.toLowerCase();
        }

        if (search) {
          where.title = {
            contains: search,
            mode: 'insensitive'
          };
        }

        if (assignedToUserId && assignedToUserId !== '') {
          where.assignedToId = parseInt(assignedToUserId, 10);
        }

        if (inbox === 'unassigned') {
          where.assignedToId = null;
        }

        const eventSome = {};
        if (pageUrlFacet) {
          eventSome.promotedPageUrl = {
            contains: pageUrlFacet,
            mode: 'insensitive'
          };
        }
        if (releaseFacet) {
          eventSome.promotedRelease = String(releaseFacet);
        }
        if (Object.keys(eventSome).length) {
          where.events = { some: eventSome };
        }

        // Date range filter
        if (dateFrom || dateTo) {
          where.lastSeen = {};
          if (dateFrom) {
            where.lastSeen.gte = new Date(dateFrom);
          }
          if (dateTo) {
            where.lastSeen.lte = new Date(dateTo);
          }
        }
        const skip = (parseInt(page) - 1) * parseInt(pageSize);
        const take = parseInt(pageSize);

        // Sorting
        const orderBy = {};
        orderBy[sortBy] = sortOrder;

        // Fetch issues with counts and latest event
        const [issues, totalCount] = await Promise.all([
          prisma.issue.findMany({
            where,
            include: {
              project: {
                select: {
                  id: true,
                  name: true,
                  key: true
                }
              },
              assignedTo: {
                select: {
                  id: true,
                  name: true,
                  email: true
                }
              },
              events: {
                select: {
                  id: true,
                  eventType: true,
                  createdAt: true
                },
                orderBy: {
                  createdAt: 'desc'
                },
                take: 1 // Only get the latest event for event type badge
              },
              _count: {
                select: {
                  events: true,
                  comments: true
                }
              }
            },
            orderBy,
            skip,
            take
          }),
          prisma.issue.count({ where })
        ]);

        res.status(200).json({ 
          success: true, 
          issues,
          pagination: {
            page: parseInt(page),
            pageSize: parseInt(pageSize),
            totalCount,
            totalPages: Math.ceil(totalCount / parseInt(pageSize))
          }
        });
      } catch (error) {
        console.error('Error fetching issues:', error);
        res.status(500).json({ 
          success: false, 
          error: 'Failed to fetch issues',
          message: error.message
        });
      }
      break;

    default:
      res.setHeader('Allow', ['GET']);
      res.status(405).end(`Method ${method} Not Allowed`);
  }
}


