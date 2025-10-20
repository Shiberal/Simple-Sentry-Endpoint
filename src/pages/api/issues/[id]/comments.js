import prisma from '@/lib/prisma';
import { parse } from 'cookie';

// Helper to get user from session cookie
async function getUserFromRequest(req) {
  const cookies = parse(req.headers.cookie || '');
  const sessionToken = cookies.session;
  
  if (!sessionToken) {
    return null;
  }

  // In a real app, you'd verify the session token
  // For now, we'll decode the user ID from the cookie
  // This matches the auth implementation in login.js
  try {
    const userId = parseInt(sessionToken.split('-')[0]);
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    return user;
  } catch (error) {
    return null;
  }
}

export default async function handler(req, res) {
  const { method } = req;
  const { id } = req.query;

  switch (method) {
    case 'GET':
      try {
        const issueId = parseInt(id);
        
        const comments = await prisma.comment.findMany({
          where: { issueId },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          },
          orderBy: {
            createdAt: 'asc'
          }
        });

        res.status(200).json({
          success: true,
          comments
        });
      } catch (error) {
        console.error('Error fetching comments:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to fetch comments',
          message: error.message
        });
      }
      break;

    case 'POST':
      try {
        const issueId = parseInt(id);
        const { text } = req.body;

        if (!text || text.trim().length === 0) {
          return res.status(400).json({
            success: false,
            error: 'Comment text is required'
          });
        }

        // Get authenticated user
        const user = await getUserFromRequest(req);
        if (!user) {
          return res.status(401).json({
            success: false,
            error: 'Authentication required'
          });
        }

        // Verify issue exists
        const issue = await prisma.issue.findUnique({
          where: { id: issueId }
        });

        if (!issue) {
          return res.status(404).json({
            success: false,
            error: 'Issue not found'
          });
        }

        // Create comment
        const comment = await prisma.comment.create({
          data: {
            issueId,
            userId: user.id,
            text: text.trim()
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        });

        res.status(201).json({
          success: true,
          comment
        });
      } catch (error) {
        console.error('Error creating comment:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to create comment',
          message: error.message
        });
      }
      break;

    default:
      res.setHeader('Allow', ['GET', 'POST']);
      res.status(405).end(`Method ${method} Not Allowed`);
  }
}


