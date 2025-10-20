import prisma from '@/lib/prisma';

export default async function handler(req, res) {
  const { method } = req;
  const { projectId, days = 30 } = req.query;

  if (method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${method} Not Allowed`);
  }

  try {
    const where = {};

    if (projectId) {
      where.projectId = parseInt(projectId);
    }

    // Optionally filter by date range
    if (days) {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(days));
      where.lastSeen = {
        gte: startDate
      };
    }

    // Get all issues
    const issues = await prisma.issue.findMany({
      where,
      select: {
        level: true,
        count: true,
        events: {
          select: {
            data: true
          }
        }
      }
    });

    // Breakdown by level
    const levelBreakdown = {
      error: 0,
      warning: 0,
      info: 0
    };

    // Breakdown by environment and platform
    const environmentBreakdown = {};
    const platformBreakdown = {};

    issues.forEach(issue => {
      // Count by level
      if (levelBreakdown[issue.level] !== undefined) {
        levelBreakdown[issue.level] += issue.count;
      } else {
        levelBreakdown[issue.level] = issue.count;
      }

      // Extract environment and platform from events
      issue.events.forEach(event => {
        const eventData = event.data;
        
        // Environment
        const env = eventData.environment || 'unknown';
        environmentBreakdown[env] = (environmentBreakdown[env] || 0) + 1;

        // Platform
        const platform = eventData.platform || 'unknown';
        platformBreakdown[platform] = (platformBreakdown[platform] || 0) + 1;
      });
    });

    // Convert to arrays for easier frontend consumption
    const levelData = Object.entries(levelBreakdown).map(([level, count]) => ({
      level,
      count
    }));

    const environmentData = Object.entries(environmentBreakdown)
      .map(([environment, count]) => ({ environment, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 environments

    const platformData = Object.entries(platformBreakdown)
      .map(([platform, count]) => ({ platform, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 platforms

    res.status(200).json({
      success: true,
      breakdown: {
        byLevel: levelData,
        byEnvironment: environmentData,
        byPlatform: platformData
      }
    });
  } catch (error) {
    console.error('Error fetching breakdown:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch breakdown',
      message: error.message
    });
  }
}


