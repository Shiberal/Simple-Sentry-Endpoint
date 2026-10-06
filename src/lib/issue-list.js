import { TIME_RANGES } from '@/lib/ui';

/** Issues plus standalone events (transactions etc.) as one sortable list. */
export function combineItems(issues, standaloneEvents, sortBy) {
  return [
    ...issues,
    ...standaloneEvents.map(event => ({
      id: `event-${event.id}`,
      _isStandaloneEvent: true,
      _event: event,
      title: event.data?.transaction || event.data?.message || 'Unnamed Event',
      level: event.data?.level || 'info',
      status: 'ACTIVE', // Standalone events don't have status
      lastSeen: event.createdAt,
      createdAt: event.createdAt,
      project: event.project,
      events: [event],
      eventType: event.eventType
    }))
  ].sort((a, b) => {
    if (sortBy === 'count') return (b.count || 1) - (a.count || 1);
    if (sortBy === 'title') return String(a.title).localeCompare(String(b.title));
    const key = sortBy === 'firstSeen' ? 'firstSeen' : 'lastSeen';
    return new Date(b[key] || b.createdAt) - new Date(a[key] || a.createdAt);
  });
}

function matchesStatus(item, filterStatus) {
  // Standalone events should appear in "active" and "all" filters
  if (item._isStandaloneEvent) return filterStatus === 'all' || filterStatus === 'active';
  if (filterStatus === 'all') return true;
  if (filterStatus === 'active') return item.status !== 'RESOLVED' && item.status !== 'IGNORED';
  if (filterStatus === 'unresolved') return item.status === 'UNRESOLVED';
  if (filterStatus === 'resolved') return item.status === 'RESOLVED';
  if (filterStatus === 'ignored') return item.status === 'IGNORED';
  if (filterStatus === 'in_progress') return item.status === 'IN_PROGRESS';
  return true;
}

function matchesEventType(item, filterEventType) {
  if (filterEventType === 'all') return true;
  // For standalone events, check the eventType directly
  if (item._isStandaloneEvent) return item.eventType === filterEventType;
  // Check for CSP issues
  if (filterEventType === 'CSP' && (item.violatedDirective || item.blockedUri)) return true;
  // Check event type in events array
  if (item.events && item.events.length > 0) return item.events.some(event => event.eventType === filterEventType);
  // Default: show ERROR type issues when filtering by ERROR
  return filterEventType === 'ERROR' && !item.violatedDirective && !item.blockedUri;
}

/** Client-side filters applied on top of what the server already filtered. */
export function filterItems(items, { searchQuery, filterLevel, filterStatus, filterEventType, timeRange }) {
  const needle = searchQuery.toLowerCase();
  const now = Date.now();
  const rangeMs = TIME_RANGES[timeRange]?.ms;
  return items.filter(item => {
    const matchesSearch = !searchQuery ||
      item.title.toLowerCase().includes(needle) ||
      (item.project?.name || '').toLowerCase().includes(needle);
    const matchesLevel = filterLevel === 'all' || item.level === filterLevel;
    const matchesTime = !rangeMs || (now - new Date(item.lastSeen).getTime()) <= rangeMs;
    return matchesSearch && matchesLevel && matchesStatus(item, filterStatus) &&
      matchesEventType(item, filterEventType) && matchesTime;
  });
}
