import prisma from '@/lib/prisma';
import { parse } from 'cookie';

/**
 * Check if the current user is authenticated and is an admin
 * @param {Object} req - The request object
 * @returns {Promise<Object>} - The admin user object
 * @throws {Error} - If user is not authenticated or not an admin
 */
export async function checkAdminAuth(req) {
  try {
    // Get session from cookie
    const cookies = parse(req.headers.cookie || '');
    const session = cookies.session;

    if (!session) {
      const error = new Error('Not authenticated');
      error.statusCode = 401;
      throw error;
    }

    const sessionData = JSON.parse(session);
    
    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: sessionData.userId },
      select: {
        id: true,
        email: true,
        name: true,
        isAdmin: true
      }
    });

    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 401;
      throw error;
    }

    if (!user.isAdmin) {
      const error = new Error('Admin access required');
      error.statusCode = 403;
      throw error;
    }

    return user;
  } catch (error) {
    // Re-throw if it's already our custom error
    if (error.statusCode) {
      throw error;
    }
    // Otherwise wrap it
    const authError = new Error('Authentication failed');
    authError.statusCode = 401;
    throw authError;
  }
}
