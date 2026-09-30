import prisma from '@/lib/prisma';
import { parse } from 'cookie';

/**
 * Current user from the session cookie, or null.
 */
export async function getSessionUser(req) {
  try {
    const session = parse(req.headers.cookie || '').session;
    if (!session) return null;
    const { userId } = JSON.parse(session);
    if (!userId) return null;
    return await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, isAdmin: true }
    });
  } catch {
    return null;
  }
}

/**
 * Admins can access every project; other users need to be a member or owner.
 */
export async function canAccessProject(user, projectId) {
  if (!user) return false;
  if (user.isAdmin) return true;
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      OR: [{ users: { some: { id: user.id } } }, { projectOwners: { some: { id: user.id } } }]
    },
    select: { id: true }
  });
  return !!project;
}
