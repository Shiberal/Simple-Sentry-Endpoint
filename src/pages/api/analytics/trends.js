import prisma from '@/lib/prisma';
import { scopeToAccessibleProjects } from '@/lib/session';

export default async function handler(req, res) {
  const { method } = req;
  const { projectId, days = 7 } = req.query;

  if (method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${method} Not Allowed`);
  }

  const scope = await scopeToAccessibleProjects(req, res, projectId);
  if (!scope) return;

  try {
    const daysInt = parseInt(days);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysInt);
    startDate.setHours(0, 0, 0, 0);

    const where = {
      createdAt: {
        gte: startDate
      }
    };

    if (scope.projectId !== undefined) {
      where.projectId = scope.projectId;
    } else {
      where.project = scope.projectWhere;
    }

    // Fetch all issues within date range
    const issues = await prisma.issue.findMany({
      where,
      select: {
        id: true,
        createdAt: true,
        level: true
      }
    });

    // Group by date
    const dateMap = {};
    
    // Initialize all dates in range
    for (let i = 0; i < daysInt; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];
      dateMap[dateKey] = {
        date: dateKey,
        count: 0,
        error: 0,
        warning: 0,
        info: 0
      };
    }

    // Count issues by date
    issues.forEach(issue => {
      const dateKey = issue.createdAt.toISOString().split('T')[0];
      if (dateMap[dateKey]) {
        dateMap[dateKey].count++;
        if (issue.level === 'error') dateMap[dateKey].error++;
        else if (issue.level === 'warning') dateMap[dateKey].warning++;
        else if (issue.level === 'info') dateMap[dateKey].info++;
      }
    });

    // Convert to array and sort by date
    const trends = Object.values(dateMap).sort((a, b) => 
      new Date(a.date) - new Date(b.date)
    );

    res.status(200).json({
      success: true,
      trends
    });
  } catch (error) {
    console.error('Error fetching trends:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trends',
      message: error.message
    });
  }
}


