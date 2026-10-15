import prisma from './prisma.js';
import { parse } from 'cookie';

export function getSessionUser(req) {
  try {
    const session = parse(req.headers.cookie || '').session;
    return session ? JSON.parse(session) : null;
  } catch {
    return null;
  }
}

/** Monitors a user can see: those of their projects plus the standalone ones they own. */
export const visibleMonitorsWhere = (userId) => ({
  OR: [{ project: { users: { some: { id: userId } } } }, { projectId: null, ownerId: userId }]
});

/**
 * Resolve the `[id]` of /api/projects/[id]/monitors* routes. A number is a project (the user must be a
 * member); the word "standalone" means monitors that belong to no project, owned by the user.
 * @returns {{ error, status } | { user, projectId, project, where, create }}
 *   where = filter for this scope's monitors, create = fields to set on a new monitor
 */
export async function resolveMonitorScope(req, idParam) {
  const user = getSessionUser(req);
  if (!user) return { error: 'Not authenticated', status: 401 };
  if (idParam === 'standalone') {
    return { user, projectId: null, project: null, where: { projectId: null, ownerId: user.userId }, create: { projectId: null, ownerId: user.userId } };
  }
  const projectId = parseInt(idParam, 10);
  if (isNaN(projectId)) return { error: 'Bad project id', status: 400 };
  const project = await prisma.project.findUnique({ where: { id: projectId }, include: { users: { select: { id: true } } } });
  if (!project) return { error: 'Not found', status: 404 };
  if (!project.users.some((u) => u.id === user.userId)) return { error: 'Forbidden', status: 403 };
  return { user, projectId, project, where: { projectId }, create: { projectId } };
}
