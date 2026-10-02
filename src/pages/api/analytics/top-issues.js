import prisma from '@/lib/prisma';
import { scopeToAccessibleProjects } from '@/lib/session';

export default async function handler(req, res) {
  const { method } = req;
  const { projectId, limit = 10, days = 30 } = req.query;

  if (method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${method} Not Allowed`);
  }

  const scope = await scopeToAccessibleProjects(req, res, projectId);
  if (!scope) return;

  try {
    const where = {};

    if (scope.projectId !== undefined) {
      where.projectId = scope.projectId;
    } else {
      where.project = scope.projectWhere;
    }

    // Optionally filter by date range
    if (days) {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(days));
      where.lastSeen = {
        gte: startDate
      };
    }

    const topIssues = await prisma.issue.findMany({
      where,
      include: {
        project: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        count: 'desc'
      },
      take: parseInt(limit)
    });

    res.status(200).json({
      success: true,
      topIssues
    });
  } catch (error) {
    console.error('Error fetching top issues:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch top issues',
      message: error.message
    });
  }
}


