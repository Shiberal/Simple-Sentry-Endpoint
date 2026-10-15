import prisma from '@/lib/prisma';
import { checkAdminAuth } from '@/lib/admin';

export default async function handler(req, res) {
  const { method, query } = req;
  const { id } = query;

  try {
    // Verify admin access
    await checkAdminAuth(req);
  } catch (error) {
    return res.status(error.statusCode || 401).json({ 
      error: error.message || 'Unauthorized' 
    });
  }

  switch (method) {
    case 'PUT':
      try {
        const { name, email, isAdmin } = req.body;
        const userId = parseInt(id);

        if (isNaN(userId)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid user ID'
          });
        }

        // Check if user exists
        const existingUser = await prisma.user.findUnique({
          where: { id: userId }
        });

        if (!existingUser) {
          return res.status(404).json({
            success: false,
            error: 'User not found'
          });
        }

        // Build update data
        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (email !== undefined) {
          // Check if email is already taken by another user
          const emailUser = await prisma.user.findUnique({
            where: { email }
          });
          if (emailUser && emailUser.id !== userId) {
            return res.status(400).json({
              success: false,
              error: 'Email already in use'
            });
          }
          updateData.email = email;
        }
        if (isAdmin !== undefined) updateData.isAdmin = isAdmin;

        const updatedUser = await prisma.user.update({
          where: { id: userId },
          data: updateData,
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
          }
        });

        res.status(200).json({
          success: true,
          user: updatedUser
        });
      } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to update user',
          message: error.message
        });
      }
      break;

    case 'DELETE':
      try {
        const userId = parseInt(id);

        if (isNaN(userId)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid user ID'
          });
        }

        // Check if user exists
        const existingUser = await prisma.user.findUnique({
          where: { id: userId }
        });

        if (!existingUser) {
          return res.status(404).json({
            success: false,
            error: 'User not found'
          });
        }

        // Delete user (cascade will handle related records)
        await prisma.user.delete({
          where: { id: userId }
        });

        res.status(200).json({
          success: true,
          message: 'User deleted successfully'
        });
      } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to delete user',
          message: error.message
        });
      }
      break;

    default:
      res.setHeader('Allow', ['PUT', 'DELETE']);
      res.status(405).end(`Method ${method} Not Allowed`);
  }
}
