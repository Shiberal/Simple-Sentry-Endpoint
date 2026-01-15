import prisma from '@/lib/prisma';
import { checkAdminAuth } from '@/lib/admin';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await checkAdminAuth(req);
  } catch (error) {
    return res.status(error.statusCode || 401).json({ 
      error: error.message || 'Unauthorized' 
    });
  }

  try {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [users, projects, events, issues, recentEvents, recentIssues] = await Promise.all([
      prisma.user.count(),
      prisma.project.count(),
      prisma.event.count(),
      prisma.issue.count(),
      prisma.event.count({
        where: {
          createdAt: {
            gte: last24Hours
          }
        }
      }),
      prisma.issue.count({
        where: {
          firstSeen: {
            gte: last24Hours
          }
        }
      })
    ]);

    res.status(200).json({
      success: true,
      stats: {
        users,
        projects,
        events,
        issues,
        recentEvents,
        recentIssues
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch stats',
      message: error.message
    });
  }
}
