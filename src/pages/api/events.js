import prisma from '@/lib/prisma';

export default async function handler(req, res) {
  const { method } = req;
  const { projectId, limit = 50 } = req.query;

  switch (method) {
    case 'GET':
      try {
        const where = projectId ? { projectId: parseInt(projectId) } : {};
        
        const events = await prisma.event.findMany({
          where,
          include: {
            project: true
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: parseInt(limit)
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

