import { useEffect, useRef, useState } from 'react';

const PAGE_SIZE = 50;

/**
 * Issues, standalone events and projects for the dashboard: paging, server-side filtering,
 * background polling and desktop alerts for newly seen issues.
 */
export default function useIssuesFeed({
  user, selectedProject, sortBy, filterStatus, filterLevel, filterOrigin, setFilterOrigin,
  searchQuery, autoRefresh, refreshInterval, desktopAlerts, showNotification,
}) {
  const [issues, setIssues] = useState([]);
  const [standaloneEvents, setStandaloneEvents] = useState([]);
  const [projects, setProjects] = useState([]);
  const [issuesTotal, setIssuesTotal] = useState(0);
  const [issuesPage, setIssuesPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [origins, setOrigins] = useState([]);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const seenIdsRef = useRef(null);

  const buildIssuesUrl = (page) => {
    const params = new URLSearchParams({
      sortBy,
      sortOrder: sortBy === 'title' ? 'asc' : 'desc',
      page: String(page),
      pageSize: String(PAGE_SIZE),
      status: filterStatus
    });
    if (selectedProject) params.set('projectId', selectedProject);
    if (filterLevel !== 'all') params.set('level', filterLevel);
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (filterOrigin !== 'all') params.set('originFacet', filterOrigin);
    return `/api/issues?${params.toString()}`;
  };

  // Detect issues that appeared since the last poll (for desktop alerts)
  const announceNewIssues = (incoming) => {
    if (seenIdsRef.current === null) {
      seenIdsRef.current = new Set(incoming.map(i => i.id));
      return;
    }
    const fresh = incoming.filter(i => !seenIdsRef.current.has(i.id));
    incoming.forEach(i => seenIdsRef.current.add(i.id));
    if (!desktopAlerts || fresh.length === 0) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const first = fresh[0];
    new Notification(
      fresh.length === 1 ? `New ${first.level}: ${first.title}` : `${fresh.length} new issues`,
      { body: fresh.length === 1 ? (first.project?.name || '') : fresh.map(i => i.title).slice(0, 3).join('\n'), tag: 'sentry-monitor-new' }
    );
  };

  // silent = background poll: only refresh the first page and keep any extra pages already loaded
  const fetchData = async ({ silent = false } = {}) => {
    if (!silent) setRefreshing(true);
    try {
      const eventsUrl = selectedProject
        ? `/api/events?projectId=${selectedProject}&limit=100`
        : `/api/events?limit=100`;

      const [issuesRes, projectsRes, eventsRes] = await Promise.all([
        fetch(buildIssuesUrl(1)),
        fetch('/api/projects'),
        fetch(eventsUrl)
      ]);

      const issuesData = await issuesRes.json();
      const projectsData = await projectsRes.json();
      const eventsData = await eventsRes.json();

      if (issuesData.success) {
        announceNewIssues(issuesData.issues);
        setIssues(prev => {
          if (!silent || prev.length <= PAGE_SIZE) return issuesData.issues;
          // Keep later pages the user already loaded, replacing anything refreshed
          const fresh = new Map(issuesData.issues.map(i => [i.id, i]));
          const tail = prev.slice(PAGE_SIZE).filter(i => !fresh.has(i.id));
          return [...issuesData.issues, ...tail];
        });
        if (!silent) setIssuesPage(1);
        setIssuesTotal(issuesData.pagination?.totalCount ?? issuesData.issues.length);
      }
      if (projectsData.success) setProjects(projectsData.projects);
      if (eventsData.success) {
        // Filter to only standalone events (those without issueId)
        const standalone = eventsData.events.filter(event => !event.issueId);
        setStandaloneEvents(standalone);
      }
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadMoreIssues = async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const nextPage = issuesPage + 1;
      const res = await fetch(buildIssuesUrl(nextPage));
      const data = await res.json();
      if (data.success) {
        setIssues(prev => {
          const known = new Set(prev.map(i => i.id));
          return [...prev, ...data.issues.filter(i => !known.has(i.id))];
        });
        setIssuesPage(nextPage);
        setIssuesTotal(data.pagination?.totalCount ?? issuesTotal);
      }
    } catch (error) {
      console.error('Error loading more issues:', error);
      showNotification('Could not load more issues', 'error');
    } finally {
      setLoadingMore(false);
    }
  };

  // Effects below call the newest fetchData without listing it as a dependency
  const fetchDataRef = useRef(fetchData);
  useEffect(() => {
    fetchDataRef.current = fetchData;
  });

  // Initial load once the user is known (later changes go through filtersKey below)
  useEffect(() => {
    if (user) fetchDataRef.current();
  }, [user]);

  // Debounce the search box before hitting the API
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Sources (hosts) seen for the selected project; reset the filter if the project changes
  useEffect(() => {
    if (!user) return;
    setFilterOrigin('all');
    fetch(`/api/issues/origins${selectedProject ? `?projectId=${selectedProject}` : ''}`)
      .then((r) => r.json())
      .then((j) => setOrigins(j.origins || []))
      .catch(() => setOrigins([]));
  }, [selectedProject, user, setFilterOrigin]);

  // Refetch from page 1 whenever server-side filters change
  const filtersKey = `${selectedProject}|${filterLevel}|${filterStatus}|${sortBy}|${debouncedSearch}|${filterOrigin}`;
  const filtersKeyRef = useRef(filtersKey);
  useEffect(() => {
    if (filtersKeyRef.current === filtersKey) return;
    filtersKeyRef.current = filtersKey;
    if (user) fetchDataRef.current();
  }, [filtersKey, user]);

  // Poll only while the tab is visible; catch up immediately when it becomes visible again
  useEffect(() => {
    if (!autoRefresh || !user) return;
    const tick = () => {
      if (!document.hidden) fetchDataRef.current({ silent: true });
    };
    const interval = setInterval(tick, refreshInterval);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [autoRefresh, refreshInterval, user, filtersKey]);

  return {
    issues, setIssues, standaloneEvents, projects, issuesTotal, loading, loadingMore, refreshing,
    lastUpdated, origins, fetchData, loadMoreIssues,
  };
}
