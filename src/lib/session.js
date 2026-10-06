import prisma from '@/lib/prisma';
import { parse } from 'cookie';

/**
 * Raw session cookie payload ({ userId, ... }) or null. Not verified against the database.
 */
export function getSessionPayload(req) {
  try {
    const session = parse(req.headers.cookie || '').session;
    return session ? JSON.parse(session) : null;
  } catch {
    return null;
  }
}

/**
 * Current user from the session cookie, or null.
 */
export async function getSessionUser(req) {
  try {
    const userId = getSessionPayload(req)?.userId;
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
