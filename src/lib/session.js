import crypto from 'crypto';
import { parse, serialize } from 'cookie';
import prisma from '@/lib/prisma';

export const SESSION_COOKIE = 'session';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 1 week

const MIN_SECRET_LENGTH = 16;

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`SESSION_SECRET must be set (at least ${MIN_SECRET_LENGTH} characters)`);
  }
  return secret;
}

function hmac(value, secret) {
  return crypto.createHmac('sha256', secret).update(value).digest('base64url');
}

/**
 * Signed session token: base64url(payload).hmac. Throws if SESSION_SECRET is unset.
 */
export function signSession({ userId, email }) {
  const payload = Buffer.from(
    JSON.stringify({ userId, email, exp: Date.now() + SESSION_MAX_AGE * 1000 })
  ).toString('base64url');
  return `${payload}.${hmac(payload, getSecret())}`;
}

/**
 * Verified session payload ({ userId, email }) or null. Fails closed when
 * SESSION_SECRET is unset, the signature is wrong, or the token has expired.
 */
export function verifySession(token) {
  try {
    if (!token || typeof token !== 'string') return null;
    const [payload, sig, extra] = token.split('.');
    if (!payload || !sig || extra !== undefined) return null;
    const expected = Buffer.from(hmac(payload, getSecret()));
    const given = Buffer.from(sig);
    if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!Number.isInteger(data.userId) || typeof data.exp !== 'number' || data.exp < Date.now()) {
      return null;
    }
    return { userId: data.userId, email: data.email };
  } catch {
    return null;
  }
}

/**
 * Verified { userId, email } from the session cookie, or null. No DB lookup.
 */
export function readSession(req) {
  try {
    return verifySession(parse(req.headers.cookie || '')[SESSION_COOKIE]);
  } catch {
    return null;
  }
}

export function sessionCookie(token) {
  return serialize(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: SESSION_MAX_AGE,
    path: '/'
  });
}

export function clearSessionCookie() {
  return serialize(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 0,
    path: '/'
  });
}

/**
 * Current user from the session cookie, or null.
 */
export async function getSessionUser(req) {
  try {
    const session = readSession(req);
    if (!session) return null;
    return await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, email: true, name: true, isAdmin: true }
    });
  } catch {
    return null;
  }
}

/**
 * Current user, or sends a 401 and returns null.
 */
export async function requireUser(req, res) {
  const user = await getSessionUser(req);
  if (!user) {
    res.status(401).json({ success: false, error: 'Not authenticated' });
    return null;
  }
  return user;
}

/**
 * Prisma `where` fragment matching projects the user can access.
 */
export function projectScope(user) {
  if (user.isAdmin) return {};
  return { OR: [{ users: { some: { id: user.id } } }, { projectOwners: { some: { id: user.id } } }] };
}

/**
 * Admins can access every project; other users need to be a member or owner.
 */
export async function canAccessProject(user, projectId) {
  if (!user) return false;
  if (user.isAdmin) return true;
  if (!Number.isInteger(projectId)) return false;
  const project = await prisma.project.findFirst({
    where: { id: projectId, ...projectScope(user) },
    select: { id: true }
  });
  return !!project;
}

/**
 * Requires a session and access to the project; sends 401/403 and returns null
 * otherwise. Pass the project id as a number.
 */
export async function requireProjectAccess(req, res, projectId) {
  const user = await requireUser(req, res);
  if (!user) return null;
  if (!(await canAccessProject(user, projectId))) {
    res.status(403).json({ success: false, error: 'Access denied' });
    return null;
  }
  return user;
}

/**
 * For routes with an optional projectId filter: requires a session, checks
 * access to the requested project, or scopes the query to accessible projects.
 * Returns { user, projectWhere } where projectWhere is a fragment for the
 * `project` relation, or null after sending the error response.
 */
export async function scopeToAccessibleProjects(req, res, rawProjectId) {
  const user = await requireUser(req, res);
  if (!user) return null;
  if (rawProjectId !== undefined && rawProjectId !== null && rawProjectId !== '') {
    const projectId = parseInt(rawProjectId, 10);
    if (!(await canAccessProject(user, projectId))) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return null;
    }
    return { user, projectId };
  }
  return { user, projectId: undefined, projectWhere: projectScope(user) };
}
