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
    sortOrder = 'desc'
  } = req.query;

  switch (method) {
    case 'GET':
      try {
        // Build where clause
        const where = {};
        
        if (projectId) {
          where.projectId = parseInt(projectId);
        }

        if (status && status !== 'all') {
          where.status = status.toUpperCase();
        }

        if (level && level !== 'all') {
          where.level = level.toLowerCase();
        }

        // Search in title
        if (search) {
          where.title = {
            contains: search,
            mode: 'insensitive'
          };
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

        // For environment and platform, we need to filter by related events
        // This is more complex with SQLite, so we'll do a simpler approach
        // We can add these filters to the event data JSON field later if needed

        // Pagination
        const skip = (parseInt(page) - 1) * parseInt(pageSize);
        const take = parseInt(pageSize);

        // Sorting
        const orderBy = {};
        orderBy[sortBy] = sortOrder;

        // Fetch issues with counts
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


