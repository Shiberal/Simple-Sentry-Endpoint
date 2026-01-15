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
  const { id } = query;
  const user = getUserFromCookie(req);

  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const projectId = parseInt(id);

  // Verify project exists and user is a project owner
  const isOwner = await isProjectOwner(user.userId, projectId);
  if (!isOwner) {
    return res.status(403).json({ error: 'Access denied. Only project owners can manage users.' });
  }

  switch (method) {
    case 'GET':
      try {
        const project = await prisma.project.findUnique({
          where: { id: projectId },
          include: {
            users: {
              select: {
                id: true,
                email: true,
                name: true,
                username: true
              }
            },
            projectOwners: {
              select: {
                id: true
              }
            }
          }
        });

        if (!project) {
          return res.status(404).json({ error: 'Project not found' });
        }

        // Map users with admin status
        const members = project.users.map(u => ({
          ...u,
          isAdmin: project.projectOwners.some(owner => owner.id === u.id)
        }));

        res.status(200).json({
          success: true,
          members
        });
      } catch (error) {
        console.error('Error fetching project members:', error);
        res.status(500).json({
          error: 'Failed to fetch project members',
          message: error.message
        });
      }
      break;

    case 'POST':
      try {
        const { username, isAdmin } = req.body;

        if (!username) {
          return res.status(400).json({ error: 'Username is required' });
        }

        // Find user by username
        const userToAdd = await prisma.user.findUnique({
          where: { username }
        });

        if (!userToAdd) {
          return res.status(404).json({ error: 'User not found' });
        }

        // Check if project exists
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

        // Check if user is already in the project
        if (project.users.some(u => u.id === userToAdd.id)) {
          return res.status(400).json({ error: 'User is already a member of this project' });
        }

        // Add user to project
        const updateData = {
          users: {
            connect: { id: userToAdd.id }
          }
        };

        // If isAdmin is true, also add to projectOwners
        if (isAdmin) {
          updateData.projectOwners = {
            connect: { id: userToAdd.id }
          };
        }

        const updatedProject = await prisma.project.update({
          where: { id: projectId },
          data: updateData,
          include: {
            users: {
              select: {
                id: true,
                email: true,
                name: true,
                username: true
              }
            },
            projectOwners: {
              select: {
                id: true
              }
            }
          }
        });

        const addedMember = updatedProject.users.find(u => u.id === userToAdd.id);
        const memberWithAdmin = {
          ...addedMember,
          isAdmin: updatedProject.projectOwners.some(owner => owner.id === userToAdd.id)
        };

        res.status(200).json({
          success: true,
          member: memberWithAdmin,
          message: `User ${username} added successfully`
        });
      } catch (error) {
        console.error('Error adding user to project:', error);
        res.status(500).json({
          error: 'Failed to add user to project',
          message: error.message
        });
      }
      break;

    case 'DELETE':
      try {
        const { userIds } = req.body;

        if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
          return res.status(400).json({ error: 'User IDs array is required' });
        }

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

        // Check if trying to remove all users (not allowed - need at least one)
        const remainingUsers = project.users.filter(u => !userIds.includes(u.id));
        if (remainingUsers.length === 0) {
          return res.status(400).json({ 
            error: 'Cannot remove all users',
            message: 'At least one user must remain in the project'
          });
        }

        // Remove users from both users and projectOwners relations
        await prisma.project.update({
          where: { id: projectId },
          data: {
            users: {
              disconnect: userIds.map(id => ({ id }))
            },
            projectOwners: {
              disconnect: userIds.map(id => ({ id }))
            }
          }
        });

        res.status(200).json({
          success: true,
          message: `Successfully removed ${userIds.length} user(s) from project`
        });
      } catch (error) {
        console.error('Error removing users from project:', error);
        res.status(500).json({
          error: 'Failed to remove users from project',
          message: error.message
        });
      }
      break;

    default:
      res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
      res.status(405).end(`Method ${method} Not Allowed`);
  }
}
