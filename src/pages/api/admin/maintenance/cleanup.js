import prisma from '@/lib/prisma';
import { checkAdminAuth } from '@/lib/admin';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
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
    const { days = 30 } = req.body;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));

    // Count events to be deleted
    const eventCount = await prisma.event.count({
      where: {
        createdAt: {
          lt: cutoffDate
        }
      }
    });

    // Delete old events
    const result = await prisma.event.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate
        }
      }
    });

    res.status(200).json({
      success: true,
      message: `Deleted ${result.count} events older than ${days} days`,
      deletedCount: result.count,
      cutoffDate: cutoffDate.toISOString()
    });
  } catch (error) {
    console.error('Error cleaning up data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clean up data',
      message: error.message
    });
  }
}
