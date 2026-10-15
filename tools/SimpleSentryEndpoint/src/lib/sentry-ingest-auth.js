/**
 * Extract DSN public key from X-Sentry-Auth or Authorization.
 */
export function extractSentryKey(req) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  const xa = req.headers['x-sentry-auth'];
  if (!xa || typeof xa !== 'string') return null;
  const match = xa.match(/sentry_key=([^,\s]+)/);
  return match ? match[1].trim() : null;
}

export async function authenticateProject(prisma, projectId, req) {
  const project = await prisma.project.findFirst({
    where: { id: projectId }
  });
  if (!project) return { ok: false, project: null, error: 'not_found' };
  const key = extractSentryKey(req);
  if (!key || key !== project.key) {
    return { ok: false, project: null, error: 'invalid_key' };
  }
  return { ok: true, project };
}
