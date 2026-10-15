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
        const users = await prisma.user.findMany({
          select: {
            id: true,
            email: true,
            name: true,
            isAdmin: true,
            createdAt: true,
            _count: {
              select: {
                projects: true,
                ownedProjects: true,
                assignedIssues: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        });

        res.status(200).json({
          success: true,
          users
        });
      } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to fetch users',
          message: error.message
        });
      }
      break;

    default:
      res.setHeader('Allow', ['GET']);
      res.status(405).end(`Method ${method} Not Allowed`);
  }
}
