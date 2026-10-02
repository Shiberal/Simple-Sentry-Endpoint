import prisma from '@/lib/prisma';
import { checkAdminAuth } from '@/lib/admin';

// Legacy admin-only endpoint; the UI uses /api/admin/users.
export default async function handler(req, res) {
  const { method } = req;

  try {
    await checkAdminAuth(req);
  } catch (error) {
    return res.status(error.statusCode || 401).json({ success: false, error: error.message });
  }

  switch (method) {
    case 'GET':
      try {
        const users = await prisma.user.findMany({
          select: { id: true, email: true, username: true, name: true, isAdmin: true, createdAt: true }
        });
        res.status(200).json({ success: true, data: users });
      } catch (error) {
        res.status(400).json({ success: false, error: error.message });
      }
      break;

    default:
      res.setHeader('Allow', ['GET']);
      res.status(405).end(`Method ${method} Not Allowed`);
  }
}
