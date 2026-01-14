import prisma from '@/lib/prisma';
import { parse } from 'cookie';

function getUserFromCookie(req) {
  try {
    const cookies = parse(req.headers.cookie || '');
    const session = cookies.session;
    if (!session) return null;
    return JSON.parse(session);
  } catch {
    return null;
  }
}

async function isProjectOwner(userId, projectId) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      projectOwners: {
        select: { id: true }
      }
    }
  });
  
  if (!project) return false;
  return project.projectOwners.some(owner => owner.id === userId);
}

export default async function handler(req, res) {
  const { method, query } = req;
  const { id, userId } = query;
  const user = getUserFromCookie(req);

  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const projectId = parseInt(id);
  const targetUserId = parseInt(userId);

  // Verify project exists and user is a project owner
  const isOwner = await isProjectOwner(user.userId, projectId);
  if (!isOwner) {
    return res.status(403).json({ error: 'Access denied. Only project owners can manage users.' });
  }

  switch (method) {
    case 'DELETE':
      try {
        // Verify project exists
        const project = await prisma.project.findUnique({
          where: { id: projectId },
          include: {
            users: {
              select: { id: true }
            }
          }
        });

        if (!project) {
          return res.status(404).json({ error: 'Project not found' });
        }

        // Check if user is in the project
        if (!project.users.some(u => u.id === targetUserId)) {
          return res.status(404).json({ error: 'User is not a member of this project' });
        }

        // Check if trying to remove all users (not allowed - need at least one)
        if (project.users.length === 1) {
          return res.status(400).json({ 
            error: 'Cannot remove the last user',
            message: 'At least one user must remain in the project'
          });
        }

        // Remove user from both users and projectOwners relations
        await prisma.project.update({
          where: { id: projectId },
          data: {
            users: {
              disconnect: { id: targetUserId }
            },
            projectOwners: {
              disconnect: { id: targetUserId }
            }
          }
        });

        res.status(200).json({
          success: true,
          message: 'User removed from project successfully'
        });
      } catch (error) {
        console.error('Error removing user from project:', error);
        res.status(500).json({
          error: 'Failed to remove user from project',
          message: error.message
        });
      }
      break;

    case 'PATCH':
      try {
        const { isAdmin } = req.body;

        if (typeof isAdmin !== 'boolean') {
          return res.status(400).json({ error: 'isAdmin must be a boolean value' });
        }

        // Verify project exists
        const project = await prisma.project.findUnique({
          where: { id: projectId },
          include: {
            users: {
              select: { id: true }
            },
            projectOwners: {
              select: { id: true }
            }
          }
        });

        if (!project) {
          return res.status(404).json({ error: 'Project not found' });
        }

        // Check if user is in the project
        if (!project.users.some(u => u.id === targetUserId)) {
          return res.status(404).json({ error: 'User is not a member of this project' });
        }

        const isCurrentlyAdmin = project.projectOwners.some(owner => owner.id === targetUserId);

        // If status hasn't changed, return early
        if (isCurrentlyAdmin === isAdmin) {
          const targetUser = await prisma.user.findUnique({
            where: { id: targetUserId },
            select: {
              id: true,
              email: true,
              name: true,
              username: true
            }
          });

          return res.status(200).json({
            success: true,
            member: {
              ...targetUser,
              isAdmin
            },
            message: 'User admin status unchanged'
          });
        }

        // Update admin status
        const updateData = {};
        if (isAdmin) {
          updateData.projectOwners = {
            connect: { id: targetUserId }
          };
        } else {
          updateData.projectOwners = {
            disconnect: { id: targetUserId }
          };
        }

        await prisma.project.update({
          where: { id: projectId },
          data: updateData
        });

        const updatedUser = await prisma.user.findUnique({
          where: { id: targetUserId },
          select: {
            id: true,
            email: true,
            name: true,
            username: true
          }
        });

        res.status(200).json({
          success: true,
          member: {
            ...updatedUser,
            isAdmin
          },
          message: `User ${isAdmin ? 'promoted to' : 'removed from'} project admin`
        });
      } catch (error) {
        console.error('Error updating user admin status:', error);
        res.status(500).json({
          error: 'Failed to update user admin status',
          message: error.message
        });
      }
      break;

    default:
      res.setHeader('Allow', ['DELETE', 'PATCH']);
      res.status(405).end(`Method ${method} Not Allowed`);
  }
}
