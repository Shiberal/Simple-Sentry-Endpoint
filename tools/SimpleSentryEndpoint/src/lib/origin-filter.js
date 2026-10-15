/**
 * Prisma `where` fragment for "events from this host". Events saved before origins were recorded
 * only have the page URL, so those are matched on the URL's host.
 */
export function originWhere(origin) {
  const o = String(origin || '').trim().toLowerCase();
  if (!o) return null;
  return {
    OR: [
      { promotedOrigin: o },
      { promotedOrigin: null, promotedPageUrl: { contains: `://${o}`, mode: 'insensitive' } }
    ]
  };
}
