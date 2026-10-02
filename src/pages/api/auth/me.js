import prisma from '@/lib/prisma';
import { readSession } from '@/lib/session';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get session from cookie
    const sessionData = readSession(req);

    if (!sessionData) {
      return res.status(200).json({ success: true, user: null });
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: sessionData.userId },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        isAdmin: true,
        createdAt: true
      }
    });

    if (!user) {
      return res.status(200).json({ success: true, user: null });
    }

    res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Auth check error:', error);
    res.status(200).json({ success: true, user: null });
  }
}

