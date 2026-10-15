import prisma from '@/lib/prisma';

/**
 * Emails listed in ADMIN_EMAIL / ADMIN_EMAILS are always treated as site admins.
 * Comma-separated, case-insensitive.
 */
export function adminEmailsFromEnv() {
  const raw = [process.env.ADMIN_EMAIL, process.env.ADMIN_EMAILS]
    .filter(Boolean)
    .join(',');
  return new Set(
    raw
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

/**
 * Ensure this user has site-admin when appropriate:
 * - already isAdmin
 * - email is in ADMIN_EMAIL(S)
 * - no site admins exist yet (bootstrap / recovery)
 *
 * Returns the user object (possibly with isAdmin flipped to true).
 */
export async function ensureSiteAdmin(user) {
  if (!user?.id) return user;
  if (user.isAdmin) return user;

  const email = String(user.email || '').toLowerCase();
  const envAdmins = adminEmailsFromEnv();
  const listed = email && envAdmins.has(email);

  let shouldPromote = listed;
  if (!shouldPromote) {
    const adminCount = await prisma.user.count({ where: { isAdmin: true } });
    shouldPromote = adminCount === 0;
  }

  if (!shouldPromote) return user;

  await prisma.user.update({
    where: { id: user.id },
    data: { isAdmin: true },
  });

  return { ...user, isAdmin: true };
}
