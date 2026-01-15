import prisma from '@/lib/prisma';
import { checkAdminAuth } from '@/lib/admin';

export default async function handler(req, res) {
  const { method } = req;

  try {
    // Verify admin access
    await checkAdminAuth(req);
  } catch (error) {
    return res.status(error.statusCode || 401).json({ 
      error: error.message || 'Unauthorized' 
    });
  }

  switch (method) {
    case 'GET':
      try {
        const projects = await prisma.project.findMany({
          include: {
            users: {
              select: {
                id: true,
                email: true,
                name: true
              }
            },
            projectOwners: {
              select: {
                id: true,
                email: true,
                name: true
              }
            },
            _count: {
              select: {
                events: true,
                issues: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        });

        res.status(200).json({
          success: true,
          projects
        });
      } catch (error) {
        console.error('Error fetching projects:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to fetch projects',
          message: error.message
        });
      }
      break;

    default:
      res.setHeader('Allow', ['GET']);
      res.status(405).end(`Method ${method} Not Allowed`);
  }
}
