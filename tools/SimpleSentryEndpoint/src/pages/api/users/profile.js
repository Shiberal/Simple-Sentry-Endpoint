import prisma from '@/lib/prisma';
import { parse } from 'cookie';

export default async function handler(req, res) {
  try {
    // Get session from cookie
    const cookies = parse(req.headers.cookie || '');
    const session = cookies.session;

    if (!session) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const sessionData = JSON.parse(session);
    const userId = sessionData.userId;

    switch (req.method) {
      case 'GET':
        try {
          const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
              id: true,
              email: true,
              username: true,
              name: true,
              isAdmin: true,
              createdAt: true,
              updatedAt: true
            }
          });

          if (!user) {
            return res.status(404).json({ error: 'User not found' });
          }

          res.status(200).json({
            success: true,
            user
          });
        } catch (error) {
          console.error('Error fetching user profile:', error);
          res.status(500).json({
            success: false,
            error: 'Failed to fetch user profile',
            message: error.message
          });
        }
        break;

      case 'PUT':
        try {
          const { username, name } = req.body;

          // Validate username if provided
          if (username !== undefined) {
            if (username.trim().length === 0) {
              return res.status(400).json({
                success: false,
                error: 'Username cannot be empty'
              });
            }

            // Check if username is already taken by another user
            const existingUser = await prisma.user.findUnique({
              where: { username: username.trim() }
            });

            if (existingUser && existingUser.id !== userId) {
              return res.status(400).json({
                success: false,
                error: 'Username already taken'
              });
            }
          }

          // Build update data
          const updateData = {};
          if (username !== undefined) {
            updateData.username = username.trim() || null;
          }
          if (name !== undefined) {
            updateData.name = name.trim() || null;
          }

          const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: updateData,
            select: {
              id: true,
              email: true,
              username: true,
              name: true,
              isAdmin: true,
              createdAt: true,
              updatedAt: true
            }
          });

          res.status(200).json({
            success: true,
            user: updatedUser
          });
        } catch (error) {
          console.error('Error updating user profile:', error);
          res.status(500).json({
            success: false,
            error: 'Failed to update user profile',
            message: error.message
          });
        }
        break;

      default:
        res.setHeader('Allow', ['GET', 'PUT']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({ error: 'Not authenticated' });
  }
}
