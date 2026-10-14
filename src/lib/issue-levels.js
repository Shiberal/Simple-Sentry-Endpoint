/** Levels treated as "error" in the dashboard filter (matches Sentry severity). */
export const ERROR_LEVELS = ['error', 'fatal'];

/** Prisma / client level list for a filter value, or null for no level filter. */
export function levelsForFilter(filterLevel) {
  if (!filterLevel || filterLevel === 'all') return null;
  const key = String(filterLevel).toLowerCase();
  if (key === 'error') return ERROR_LEVELS;
  return [key];
}

export function matchesLevel(itemLevel, filterLevel) {
  const levels = levelsForFilter(filterLevel);
  if (!levels) return true;
  return levels.includes(String(itemLevel || '').toLowerCase());
}
