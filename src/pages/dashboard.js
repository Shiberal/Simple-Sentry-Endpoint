import { useState, useEffect, useRef, useCallback } from 'react';
import Head from "next/head";
import { useRouter } from 'next/router';
import Link from 'next/link';
import ThemeToggle from '@/components/ThemeToggle';
import IssueListSkeleton from '@/components/IssueListSkeleton';
import Icon from '@/components/Icon';
import { parseGitHubRepo } from '@/lib/github';
import usePersistedState from '@/hooks/usePersistedState';
import { statusLabel, levelColors, relativeTime, TIME_RANGES, SORT_OPTIONS, downloadIssues } from '@/lib/ui';
import styles from '@/styles/Dashboard.module.css';

export default function Dashboard() {
  const router = useRouter();
  const [issues, setIssues] = useState([]); // Changed from events to issues
  const [standaloneEvents, setStandaloneEvents] = useState([]); // For transactions and other standalone events
  const [projects, setProjects] = useState([]);
  const [user, setUser] = useState(null);
  const [selectedProject, setSelectedProject] = usePersistedState('sm.project', null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = usePersistedState('sm.refreshMs', 5000);
  const [sortBy, setSortBy] = usePersistedState('sm.sortBy', 'lastSeen');
  const [timeRange, setTimeRange] = usePersistedState('sm.timeRange', 'all');
  const [desktopAlerts, setDesktopAlerts] = usePersistedState('sm.desktopAlerts', false);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [issuesTotal, setIssuesTotal] = useState(0);
  const [issuesPage, setIssuesPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [dupPreview, setDupPreview] = useState(null); // { groups, outdated } awaiting confirmation
  const [dupSelected, setDupSelected] = useState([]); // primaryIds of groups to merge
  const [mergeDraft, setMergeDraft] = useState(null); // { issues, targetId } for manual merge
  const searchInputRef = useRef(null);
  const seenIdsRef = useRef(null);
  const lastVisitRef = useRef(null);
  const detailPushedRef = useRef(false);
  const deepLinkHandledRef = useRef(false);
  const deepLinkPendingRef = useRef(false);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLevel, setFilterLevel] = usePersistedState('sm.filterLevel', 'error');
  const [filterStatus, setFilterStatus] = usePersistedState('sm.filterStatus', 'active'); // 'all', 'active' (not resolved/ignored), 'unresolved', 'resolved', 'ignored', 'in_progress'
  const [filterOrigin, setFilterOrigin] = useState('all'); // host events came from
  const [origins, setOrigins] = useState([]);
  const [filterEventType, setFilterEventType] = usePersistedState('sm.filterType', 'all'); // 'all', 'ERROR', 'CSP', 'MINIDUMP', 'TRANSACTION', 'MESSAGE'
  const [projectsCollapsed, setProjectsCollapsed] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingEvent, setDeletingEvent] = useState(null);
  const [deletingIssue, setDeletingIssue] = useState(null);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Start with the project sidebar closed on phone-sized screens
  useEffect(() => {
    if (window.matchMedia('(max-width: 768px)').matches) {
      setSidebarCollapsed(true);
    }
  }, []);
  const [selectedEvents, setSelectedEvents] = useState([]); // Keep for backward compatibility
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [showGitHubModal, setShowGitHubModal] = useState(false);
  const [githubIssueData, setGithubIssueData] = useState({ title: '', body: '' });
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [analyticsData, setAnalyticsData] = useState(null);
  const [isDeduplicating, setIsDeduplicating] = useState(false);
  const [issueEventIndices, setIssueEventIndices] = useState({}); // Track current event index per issue
  const [notifications, setNotifications] = useState([]); // Notification system
  const [prettifiedError, setPrettifiedError] = useState(false); // Track if error message is prettified
  const [prettifiedMessage, setPrettifiedMessage] = useState(false); // Track if message is prettified
  const [copiedError, setCopiedError] = useState(false); // Track if error was copied
  const [copiedCode, setCopiedCode] = useState(false); // Track if code snippet was copied

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (!router.isReady || !router.query.projectId) return;

    const projectId = parseInt(router.query.projectId, 10);
    if (!isNaN(projectId)) {
      setSelectedProject(projectId);
    }
  }, [router.isReady, router.query.projectId]);

  // Reset prettified states when selected event changes
  useEffect(() => {
    setPrettifiedError(false);
    setPrettifiedMessage(false);
    setCopiedError(false);
    setCopiedCode(false);
  }, [selectedEvent]);

  // Notification system
  const showNotification = (message, type = 'info', action = null) => {
    const id = Date.now() + Math.random();
    const notification = { id, message, type, action };
    
    setNotifications(prev => [...prev, notification]);
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 10000);
  };

  const removeNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };


  // Prettify function to format JSON or text (loosely)
  const prettifyContent = (content) => {
    if (!content) return content;
    
    const trimmed = content.trim();
    
    // Helper function to find balanced JSON structures
    const findBalancedJson = (str, startChar, endChar) => {
      let depth = 0;
      let start = -1;
      for (let i = 0; i < str.length; i++) {
        if (str[i] === startChar) {
          if (depth === 0) start = i;
          depth++;
        } else if (str[i] === endChar) {
          depth--;
          if (depth === 0 && start !== -1) {
            return str.substring(start, i + 1);
          }
        }
      }
      return null;
    };
    
    // Try to parse as direct JSON
    try {
      const parsed = JSON.parse(trimmed);
      return JSON.stringify(parsed, null, 2);
    } catch (e) {
      // Try to find JSON objects/arrays embedded in the content
      const jsonObject = findBalancedJson(trimmed, '{', '}');
      const jsonArray = findBalancedJson(trimmed, '[', ']');
      
      // Try object first
      if (jsonObject) {
        try {
          const parsed = JSON.parse(jsonObject);
          const formatted = JSON.stringify(parsed, null, 2);
          return trimmed.replace(jsonObject, formatted);
        } catch (e2) {
          // Try unescaping common escape sequences
          try {
            const unescaped = jsonObject
              .replace(/\\"/g, '"')
              .replace(/\\n/g, '\n')
              .replace(/\\t/g, '\t')
              .replace(/\\r/g, '\r');
            const parsed = JSON.parse(unescaped);
            const formatted = JSON.stringify(parsed, null, 2);
            return trimmed.replace(jsonObject, formatted);
          } catch (e3) {
            // Continue to try array or other methods
          }
        }
      }
      
      // Try array
      if (jsonArray) {
        try {
          const parsed = JSON.parse(jsonArray);
          const formatted = JSON.stringify(parsed, null, 2);
          return trimmed.replace(jsonArray, formatted);
        } catch (e2) {
          // Continue to other methods
        }
      }
      
      // Try parsing as a JSON string (double-encoded, e.g., "{\"key\":\"value\"}")
      if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
        try {
          // First unescape the outer quotes
          const unescaped = trimmed.slice(1, -1)
            .replace(/\\"/g, '"')
            .replace(/\\n/g, '\n')
            .replace(/\\t/g, '\t')
            .replace(/\\r/g, '\r')
            .replace(/\\\\/g, '\\');
          const parsed = JSON.parse(unescaped);
          return JSON.stringify(parsed, null, 2);
        } catch (e2) {
          // Continue to text formatting
        }
      }
      
      // If not JSON, format as text with better line breaks
      // Replace common escape sequences and format
      return content
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t')
        .replace(/\\r/g, '\r')
        .replace(/\\"/g, '"')
        .replace(/\\'/g, "'")
        .replace(/\\\\/g, '\\');
    }
  };

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/me');
      const data = await response.json();
      if (!data?.user) {
        router.push('/login');
        return;
      }
      setUser(data.user);
    } catch (error) {
      router.push('/login');
    }
  };

  const PAGE_SIZE = 50;

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

  const fetchAnalytics = async () => {
    try {
      const projectParam = selectedProject ? `projectId=${selectedProject}&` : '';
      const [trendsRes, topIssuesRes, breakdownRes] = await Promise.all([
        fetch(`/api/analytics/trends?${projectParam}days=7`),
        fetch(`/api/analytics/top-issues?${projectParam}limit=10`),
        fetch(`/api/analytics/breakdown?${projectParam}`)
      ]);

      const [trends, topIssues, breakdown] = await Promise.all([
        trendsRes.json(),
        topIssuesRes.json(),
        breakdownRes.json()
      ]);

      setAnalyticsData({
        trends: trends.success ? trends.trends : [],
        topIssues: topIssues.success ? topIssues.topIssues : [],
        breakdown: breakdown.success ? breakdown.breakdown : null
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
      setAnalyticsData({
        trends: [],
        topIssues: [],
        breakdown: null
      });
    }
  };


  // Initial load once the user is known (later changes go through filtersKey below)
  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  useEffect(() => {
    if (user) fetchAnalytics();
  }, [selectedProject, user, filterLevel, activeTab]);

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
  }, [selectedProject, user]);

  // Refetch from page 1 whenever server-side filters change
  const filtersKey = `${selectedProject}|${filterLevel}|${filterStatus}|${sortBy}|${debouncedSearch}|${filterOrigin}`;
  const filtersKeyRef = useRef(filtersKey);
  useEffect(() => {
    if (filtersKeyRef.current === filtersKey) return;
    filtersKeyRef.current = filtersKey;
    if (user) fetchData();
  }, [filtersKey]);

  // Poll only while the tab is visible; catch up immediately when it becomes visible again
  useEffect(() => {
    if (!autoRefresh || !user) return;
    const tick = () => {
      if (!document.hidden) fetchData({ silent: true });
    };
    const interval = setInterval(tick, refreshInterval);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [autoRefresh, refreshInterval, user, filtersKey]);

  // Open an issue (or standalone event) in the detail panel
  const openItem = useCallback(async (issue) => {
    if (issue._isStandaloneEvent) {
      setSelectedEvent(issue._event);
      setActiveTab('overview');
      return;
    }
    try {
      const response = await fetch(`/api/issues/${issue.id}`);
      const data = await response.json();
      if (data.success && data.issue.events && data.issue.events.length > 0) {
        setSelectedEvent({ ...data.issue.events[0], issue: issue.title ? issue : data.issue });
        setActiveTab('overview');
      }
    } catch (error) {
      console.error('Error fetching issue details:', error);
    }
  }, []);

  const closeDetail = () => {
    setSelectedEvent(null);
    setActiveTab('overview');
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  // Preview duplicates first; nothing is merged until the user confirms
  const handleDeduplicate = async () => {
    if (isDeduplicating) return;

    setIsDeduplicating(true);
    try {
      const targets = selectedProject ? projects.filter(p => p.id === selectedProject) : projects;
      const results = await Promise.all(targets.map(async (project) => {
        const response = await fetch(`/api/issues/duplicates?projectId=${project.id}`);
        const data = await response.json();
        return data.success ? { project, ...data } : null;
      }));
      const found = results.filter(Boolean);
      const groups = found.flatMap(r => r.groups.map(g => ({ ...g, projectId: r.project.id, projectName: r.project.name })));
      const outdated = found.reduce((sum, r) => sum + r.outdatedFingerprints, 0);

      if (groups.length === 0 && outdated === 0) {
        showNotification('No duplicate issues found', 'success');
      } else {
        setDupSelected(groups.map(g => g.primaryId));
        setDupPreview({ groups, outdated });
      }
    } catch (error) {
      console.error('Error finding duplicates:', error);
      showNotification('Could not check for duplicates', 'error');
    } finally {
      setIsDeduplicating(false);
    }
  };

  const applyDuplicates = async () => {
    if (!dupPreview || isDeduplicating) return;
    setIsDeduplicating(true);
    try {
      const allSelected = dupSelected.length === dupPreview.groups.length;
      const projectIds = [...new Set(dupPreview.groups.map(g => g.projectId))];
      let merged = 0;
      for (const projectId of projectIds) {
        const primaryIds = dupPreview.groups.filter(g => g.projectId === projectId && dupSelected.includes(g.primaryId)).map(g => g.primaryId);
        if (primaryIds.length === 0) continue;
        const response = await fetch('/api/issues/duplicates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // Omitting primaryIds also refreshes outdated fingerprints, so only do that when everything is selected
          body: JSON.stringify(allSelected ? { projectId } : { projectId, primaryIds })
        });
        const data = await response.json();
        if (!data.success) throw new Error(data.message || data.error || 'Merge failed');
        merged += data.issuesMerged;
      }
      showNotification(`Merged ${merged} duplicate issue${merged === 1 ? '' : 's'}`, 'success');
      setDupPreview(null);
      fetchData();
    } catch (error) {
      console.error('Error merging duplicates:', error);
      showNotification(`Failed to merge duplicates: ${error.message}`, 'error');
    } finally {
      setIsDeduplicating(false);
    }
  };

  // Merge the issues ticked in selection mode into one chosen issue
  const startMerge = () => {
    const chosen = issues.filter(i => selectedEvents.includes(i.id));
    if (chosen.length < 2) {
      showNotification('Select at least two issues to merge', 'info');
      return;
    }
    if (new Set(chosen.map(i => i.projectId)).size > 1) {
      showNotification('Issues can only be merged within the same project', 'warning');
      return;
    }
    const oldest = [...chosen].sort((a, b) => new Date(a.firstSeen) - new Date(b.firstSeen))[0];
    setMergeDraft({ issues: chosen, targetId: oldest.id });
  };

  const confirmMerge = async () => {
    if (!mergeDraft) return;
    try {
      const response = await fetch('/api/issues/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: mergeDraft.issues[0].projectId,
          targetIssueId: mergeDraft.targetId,
          sourceIssueIds: mergeDraft.issues.map(i => i.id).filter(id => id !== mergeDraft.targetId)
        })
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'Merge failed');
      const mergedCount = data.mergedIssueIds.length;
      showNotification(`Merged ${mergedCount} issue${mergedCount === 1 ? '' : 's'} into #${mergeDraft.targetId}`, 'success');
      setMergeDraft(null);
      exitSelectionMode();
      if (selectedEvent?.issue && mergeDraft.issues.some(i => i.id === selectedEvent.issue.id)) closeDetail();
      fetchData();
    } catch (error) {
      showNotification(`Merge failed: ${error.message}`, 'error');
    }
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newProjectName })
      });

      if (response.ok) {
        setNewProjectName('');
        setShowNewProjectModal(false);
        fetchData();
      }
    } catch (error) {
      console.error('Error creating project:', error);
    }
  };

  const handleDeleteIssue = async () => {
    if (!deletingIssue) return;
    
    try {
      let response;
      
      // Check if it's a standalone event
      if (deletingIssue._isStandaloneEvent) {
        const eventId = deletingIssue.id.replace('event-', '');
        response = await fetch(`/api/events/${eventId}`, {
          method: 'DELETE'
        });
      } else {
        // It's a regular issue
        response = await fetch(`/api/issues/${deletingIssue.id}`, {
          method: 'DELETE'
        });
      }

      if (response.ok) {
        // Close the detail panel if the deleted issue is currently selected
        if (selectedEvent?.issue?.id === deletingIssue.id) {
          setSelectedEvent(null);
        }
        // Refresh the issues list
        fetchData();
        setShowDeleteConfirm(false);
        setDeletingIssue(null);
      } else {
        console.error('Failed to delete item');
        showNotification('Failed to delete item', 'error');
      }
    } catch (error) {
      console.error('Error deleting item:', error);
      showNotification('Error deleting item', 'error');
    }
  };

  const handleDeleteEvent = async () => {
    if (!deletingEvent) return;
    
    try {
      const response = await fetch(`/api/events/${deletingEvent.id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        // Close the detail panel if the deleted event is currently selected
        if (selectedEvent?.id === deletingEvent.id) {
          setSelectedEvent(null);
        }
        // Refresh the events list
        fetchData();
        setShowDeleteConfirm(false);
        setDeletingEvent(null);
      } else {
        console.error('Failed to delete event');
        showNotification('Failed to delete event', 'error');
      }
    } catch (error) {
      console.error('Error deleting event:', error);
      showNotification('Error deleting event', 'error');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedEvents.length === 0) return;
    
    try {
      // Delete all selected issues and standalone events
      const deletePromises = selectedEvents.map(id => {
        // Check if it's a standalone event (format: "event-123")
        if (typeof id === 'string' && id.startsWith('event-')) {
          const eventId = id.replace('event-', '');
          return fetch(`/api/events/${eventId}`, { method: 'DELETE' });
        } else {
          // It's an issue
          return fetch(`/api/issues/${id}`, { method: 'DELETE' });
        }
      });
      
      const results = await Promise.all(deletePromises);
      const allSuccessful = results.every(res => res.ok);
      
      if (allSuccessful) {
        // Close detail panel if selected issue was deleted
        if (selectedEvent?.issue && selectedEvents.includes(selectedEvent.issue.id)) {
          setSelectedEvent(null);
        }
        // Clear selection and refresh
        setSelectedEvents([]);
        setIsSelectionMode(false);
        fetchData();
        setShowDeleteConfirm(false);
        setDeletingIssue(null);
      } else {
        showNotification('Some items failed to delete', 'error');
      }
    } catch (error) {
      console.error('Error deleting items:', error);
      showNotification('Error deleting items', 'error');
    }
  };

  const toggleEventSelection = (issueId) => {
    setSelectedEvents(prev => 
      prev.includes(issueId) 
        ? prev.filter(id => id !== issueId)
        : [...prev, issueId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedEvents.length === filteredIssues.length) {
      setSelectedEvents([]);
    } else {
      setSelectedEvents(filteredIssues.map(e => e.id));
    }
  };

  const exitSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedEvents([]);
  };

  const handleCreateGitHubIssue = async (event) => {
    const data = event.data;
    const issue = event.issue;
    const countSuffix = issue?.count > 1 ? ` (${issue.count}x)` : '';
    const title = `🐛 ${getEventTitle(event)}${countSuffix}`;
    
    // Check if issue is ignored
    if (issue?.status === 'IGNORED') {
      showNotification(
        `Cannot Create GitHub Issue - This issue is currently ignored. Please unignore it first before creating a GitHub issue.`,
        'warning'
      );
      return;
    }
    
    // Check if GitHub issue already exists for this error
    if (issue?.githubIssueUrl) {
      const confirmed = confirm(
        `GitHub Issue Already Exists!\n\n` +
        `This error already has a GitHub issue:\n` +
        `${issue.githubIssueUrl}\n\n` +
        `Would you like to open it?`
      );
      
      if (confirmed) {
        window.open(issue.githubIssueUrl, '_blank');
      }
      return;
    }
    
    // Generate enhanced issue body
    let body = `## 🚨 Error Report\n\n`;
    body += `This issue was manually created from the error dashboard.\n\n`;
    if (issue?.fingerprint) {
      body += `**Error Fingerprint:** \`${issue.fingerprint}\`\n`;
    }
    if (issue?.count) {
      body += `**Occurrences:** ${issue.count} time${issue.count !== 1 ? 's' : ''}\n`;
    }
    body += `\n`;
    
    // Error summary
    if (data.exception?.values?.[0]) {
      const exc = data.exception.values[0];
      body += `### Exception Details\n\n`;
      body += `**Type:** \`${exc.type}\`\n`;
      body += `**Message:** ${exc.value}\n`;
      if (data.culprit) body += `**Culprit:** \`${data.culprit}\`\n`;
      body += `\n`;
      
      // Stack trace with better formatting
      if (exc.stacktrace?.frames) {
        body += `### 📍 Stack Trace\n\n`;
        body += `\`\`\`${data.platform || 'text'}\n`;
        exc.stacktrace.frames.slice().reverse().forEach((frame, idx) => {
          const fn = frame.function || frame.module || 'anonymous';
          const file = frame.filename || frame.abs_path || 'unknown';
          const line = frame.lineno || '?';
          const col = frame.colno ? `:${frame.colno}` : '';
          body += `${idx + 1}. ${fn}\n   at ${file}:${line}${col}\n`;
          
          // Add context lines if available
          if (frame.context_line) {
            body += `   > ${frame.context_line.trim()}\n`;
          }
        });
        body += `\`\`\`\n\n`;
      }
    } else if (data.message) {
      body += `**Message:** ${data.message}\n\n`;
    }
    
    // Occurrence information
    if (issue) {
      body += `### 📊 Occurrence Information\n\n`;
      body += `- **Times Occurred:** ${issue.count} time${issue.count !== 1 ? 's' : ''}\n`;
      body += `- **First Seen:** ${new Date(issue.firstSeen).toLocaleString()}\n`;
      body += `- **Last Seen:** ${new Date(issue.lastSeen).toLocaleString()}\n`;
      body += `- **Severity Level:** ${issue.level.toUpperCase()}\n`;
      body += `- **Status:** ${issue.status}\n\n`;
    }
    
    // Environment & Context
    body += `### 🔧 Environment\n\n`;
    if (data.environment) body += `- **Environment:** ${data.environment}\n`;
    if (data.platform) body += `- **Platform:** ${data.platform}\n`;
    if (data.release) body += `- **Release:** ${data.release}\n`;
    if (data.server_name) body += `- **Server:** ${data.server_name}\n`;
    if (data.sdk) body += `- **SDK:** ${data.sdk.name} ${data.sdk.version}\n`;
    body += `\n`;
    
    // User context
    if (data.user) {
      body += `### 👤 User Context\n\n`;
      if (data.user.id) body += `- **User ID:** ${data.user.id}\n`;
      if (data.user.username) body += `- **Username:** ${data.user.username}\n`;
      if (data.user.email) body += `- **Email:** ${data.user.email}\n`;
      if (data.user.ip_address) body += `- **IP Address:** ${data.user.ip_address}\n`;
      body += `\n`;
    }
    
    // Tags
    if (data.tags && Object.keys(data.tags).length > 0) {
      body += `### 🏷️ Tags\n\n`;
      Object.entries(data.tags).forEach(([key, value]) => {
        body += `- **${key}:** ${value}\n`;
      });
      body += `\n`;
    }
    
    // Breadcrumbs (last 10)
    const breadcrumbs = Array.isArray(data.breadcrumbs) ? data.breadcrumbs : data.breadcrumbs?.values;
    if (breadcrumbs && breadcrumbs.length > 0) {
      body += `### 🍞 Breadcrumbs (Last 10)\n\n`;
      breadcrumbs.slice(-10).forEach((crumb, idx) => {
        // Handle different timestamp formats
        let time = '';
        if (crumb.timestamp) {
          if (typeof crumb.timestamp === 'number' && crumb.timestamp > 1000000000000) {
            time = new Date(crumb.timestamp).toLocaleTimeString();
          } else if (typeof crumb.timestamp === 'number' && crumb.timestamp > 1000000000) {
            time = new Date(crumb.timestamp * 1000).toLocaleTimeString();
          } else {
            time = crumb.timestamp;
          }
        }
        body += `${idx + 1}. **[${crumb.category || crumb.level || 'default'}]** ${crumb.message || crumb.type} `;
        if (time) body += `_(${time})_`;
        body += `\n`;
      });
      body += `\n`;
    }
    
    // Extra context
    if (data.contexts && Object.keys(data.contexts).length > 0) {
      body += `### 📦 Additional Context\n\n`;
      Object.entries(data.contexts).forEach(([key, value]) => {
        if (key !== 'trace' && typeof value === 'object') {
          body += `**${key}:**\n\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\`\n\n`;
        }
      });
    }
    
    // Request info
    if (data.request) {
      body += `### 🌐 Request Information\n\n`;
      if (data.request.url) body += `- **URL:** ${data.request.url}\n`;
      if (data.request.method) body += `- **Method:** ${data.request.method}\n`;
      if (data.request.headers?.['User-Agent']) body += `- **User Agent:** ${data.request.headers['User-Agent']}\n`;
      body += `\n`;
    }
    
    // Footer with links
    body += `---\n\n`;
    body += `📅 **Event ID:** \`${event.id}\`\n`;
    body += `⏰ **Timestamp:** ${new Date(event.createdAt).toLocaleString()}\n`;
    body += `📁 **Project:** ${event.project?.name || 'Unknown Project'}\n`;
    
    // Add link to dashboard if available
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    if (issue) {
      body += `🔗 **[View in Dashboard](${baseUrl}/dashboard?issue=${issue.id})**\n`;
    }
    
    // Generate labels
    const labels = [];
    if (data.level) labels.push(data.level);
    if (data.platform) labels.push(data.platform);
    if (data.environment) labels.push(data.environment);
    labels.push('sentry');
    labels.push('automated');
    
    // Check if project has GitHub configuration
    if (event.project?.githubRepo) {
      try {
        const parsed = parseGitHubRepo(event.project.githubRepo);
        if (!parsed) {
          throw new Error('Invalid GitHub repository format');
        }
        const { owner, repo: repoName } = parsed;

        // Create issue via GitHub API
        const headers = {
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        };
        
        if (event.project?.githubToken) {
          headers['Authorization'] = `Bearer ${event.project.githubToken}`;
        }
        
        const response = await fetch(`https://api.github.com/repos/${owner}/${repoName}/issues`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ 
            title, 
            body,
            labels: labels.filter(Boolean) // Add labels to the issue
          })
        });
        
        if (response.ok) {
          const githubIssue = await response.json();
          
          // Save GitHub issue info to database to prevent duplicates
          if (issue?.id) {
            try {
              await fetch(`/api/issues/${issue.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  githubIssueUrl: githubIssue.html_url,
                  githubIssueNumber: githubIssue.number
                })
              });
              
              // Update local state to reflect the change
              setIssues(prevIssues => 
                prevIssues.map(iss => 
                  iss.id === issue.id 
                    ? {
                        ...iss,
                        githubIssueUrl: githubIssue.html_url,
                        githubIssueNumber: githubIssue.number
                      }
                    : iss
                )
              );
            } catch (err) {
              console.error('Failed to save GitHub issue info:', err);
            }
          }
          
          showNotification(
            `✅ GitHub Issue #${githubIssue.number} created successfully! Opening in new tab...`,
            'success'
          );
          
          // Open the issue in a new tab
          window.open(githubIssue.html_url, '_blank');
          return;
        } else {
          const error = await response.json();
          const errorMsg = error.message || error.errors?.[0]?.message || 'Failed to create issue';
          throw new Error(errorMsg);
        }
      } catch (error) {
        console.error('Error creating GitHub issue:', error);
        const errorDetails = error.message.includes('Bad credentials') 
          ? 'Invalid GitHub token. Please check your project settings.'
          : error.message.includes('Not Found')
          ? 'Repository not found. Please check the repository name in project settings.'
          : error.message;
        showNotification(`❌ Failed to create GitHub issue: ${errorDetails}. Falling back to manual mode...`, 'error');
      }
    }
    
    // Fallback to manual mode if no GitHub config or API call failed
    setGithubIssueData({ title, body, labels: labels.join(', ') });
    setShowGitHubModal(true);
  };

  // Issue workflow handlers
  const handleStatusChange = async (issueId, newStatus) => {
    try {
      const response = await fetch(`/api/issues/${issueId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      if (response.ok) {
        // Update selected issue if it's the one being updated
        if (selectedIssue?.id === issueId) {
          const data = await response.json();
          setSelectedIssue(data.issue);
        }
        // Refresh issues list
        fetchData();
      } else {
        showNotification('Failed to update status', 'error');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      showNotification('Error updating status', 'error');
    }
  };

  const handleAssignIssue = async (issueId, userId) => {
    try {
      const response = await fetch(`/api/issues/${issueId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedToId: userId })
      });

      if (response.ok) {
        // Update selected issue if it's the one being updated
        if (selectedIssue?.id === issueId) {
          const data = await response.json();
          setSelectedIssue(data.issue);
        }
        // Refresh issues list
        fetchData();
      } else {
        showNotification('Failed to assign issue', 'error');
      }
    } catch (error) {
      console.error('Error assigning issue:', error);
      showNotification('Error assigning issue', 'error');
    }
  };

  const handleResolveIssue = async (issue, { allowUndo = true } = {}) => {
    if (!issue) return;

    // Toggle between RESOLVED and UNRESOLVED
    const newStatus = issue.status === 'RESOLVED' ? 'UNRESOLVED' : 'RESOLVED';
    // Optimistic update so the list reacts instantly
    setIssues(prev => prev.map(iss => iss.id === issue.id ? { ...iss, status: newStatus } : iss));

    try {
      
      const response = await fetch(`/api/issues/${issue.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      if (response.ok) {
        const data = await response.json();
        
        // Update the selected event's issue
        if (selectedEvent?.issue?.id === issue.id) {
          setSelectedEvent({
            ...selectedEvent,
            issue: data.issue
          });
        }
        
        // Update selected issue if it's the one being updated
        if (selectedIssue?.id === issue.id) {
          setSelectedIssue(data.issue);
        }
        
        // Update issues list
        setIssues(prevIssues => 
          prevIssues.map(iss => 
            iss.id === issue.id ? data.issue : iss
          )
        );
        
        // Show success message with GitHub info if applicable
        let message = `Issue ${newStatus === 'RESOLVED' ? 'resolved' : 'reopened'} successfully!`;
        if (issue.githubIssueNumber) {
          message += ` GitHub issue #${issue.githubIssueNumber} has been ${newStatus === 'RESOLVED' ? 'closed' : 'reopened'}.`;
        }
        showNotification(message, 'success', allowUndo ? {
          label: 'Undo',
          onClick: () => handleResolveIssue({ ...issue, status: newStatus }, { allowUndo: false })
        } : null);
        
        // Refresh data
        fetchData({ silent: true });
      } else {
        setIssues(prev => prev.map(iss => iss.id === issue.id ? { ...iss, status: issue.status } : iss));
        const errorData = await response.json();
        showNotification(`Failed to ${newStatus === 'RESOLVED' ? 'resolve' : 'reopen'} issue: ${errorData.error || 'Unknown error'}`, 'error');
      }
    } catch (error) {
      setIssues(prev => prev.map(iss => iss.id === issue.id ? { ...iss, status: issue.status } : iss));
      console.error('Error resolving issue:', error);
      showNotification('Error updating issue status', 'error');
    }
  };

  const handleIgnoreIssue = async (issue, { allowUndo = true } = {}) => {
    if (!issue) return;

    // Toggle between IGNORED and UNRESOLVED
    const newStatus = issue.status === 'IGNORED' ? 'UNRESOLVED' : 'IGNORED';
    setIssues(prev => prev.map(iss => iss.id === issue.id ? { ...iss, status: newStatus } : iss));

    try {
      
      const response = await fetch(`/api/issues/${issue.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      if (response.ok) {
        const data = await response.json();
        
        // Update the selected event's issue
        if (selectedEvent?.issue?.id === issue.id) {
          setSelectedEvent({
            ...selectedEvent,
            issue: data.issue
          });
        }
        
        // Update selected issue if it's the one being updated
        if (selectedIssue?.id === issue.id) {
          setSelectedIssue(data.issue);
        }
        
        // Update issues list
        setIssues(prevIssues => 
          prevIssues.map(iss => 
            iss.id === issue.id ? data.issue : iss
          )
        );
        
        // Show success message
        showNotification(`Issue ${newStatus === 'IGNORED' ? 'ignored - will not appear in main view or auto-report to GitHub' : 'unignored'} successfully!`, 'success', allowUndo ? {
          label: 'Undo',
          onClick: () => handleIgnoreIssue({ ...issue, status: newStatus }, { allowUndo: false })
        } : null);
        
        // Refresh data
        fetchData({ silent: true });
      } else {
        setIssues(prev => prev.map(iss => iss.id === issue.id ? { ...iss, status: issue.status } : iss));
        const errorData = await response.json();
        showNotification(`Failed to ${newStatus === 'IGNORED' ? 'ignore' : 'unignore'} issue: ${errorData.error || 'Unknown error'}`, 'error');
      }
    } catch (error) {
      setIssues(prev => prev.map(iss => iss.id === issue.id ? { ...iss, status: issue.status } : iss));
      console.error('Error ignoring issue:', error);
      showNotification('Error updating issue status', 'error');
    }
  };

  const handleAddComment = async (issueId) => {
    if (!newComment.trim()) return;

    try {
      const response = await fetch(`/api/issues/${issueId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: newComment })
      });

      if (response.ok) {
        const data = await response.json();
        setComments([...comments, data.comment]);
        setNewComment('');
        
        // Refresh issue details to get updated comment count
        if (selectedIssue?.id === issueId) {
          const issueRes = await fetch(`/api/issues/${issueId}`);
          const issueData = await issueRes.json();
          if (issueData.success) {
            setSelectedIssue(issueData.issue);
            setComments(issueData.issue.comments || []);
          }
        }
      } else {
        showNotification('Failed to add comment', 'error');
      }
    } catch (error) {
      console.error('Error adding comment:', error);
      showNotification('Error adding comment', 'error');
    }
  };

  const loadIssueDetails = async (issueId) => {
    try {
      const response = await fetch(`/api/issues/${issueId}`);
      const data = await response.json();
      
      if (data.success) {
        setSelectedIssue(data.issue);
        setComments(data.issue.comments || []);
      }
    } catch (error) {
      console.error('Error loading issue details:', error);
    }
  };

  // Navigate to previous duplicate event
  const navigateToPreviousEvent = async (issue, e) => {
    e.stopPropagation();
    if (!issue || issue.count <= 1) return;
    
    const currentIndex = issueEventIndices[issue.id] || 0;
    const newIndex = currentIndex > 0 ? currentIndex - 1 : issue.count - 1;
    
    setIssueEventIndices(prev => ({ ...prev, [issue.id]: newIndex }));
    
    // Fetch and show the event at this index
    await showEventAtIndex(issue, newIndex);
  };

  // Navigate to next duplicate event
  const navigateToNextEvent = async (issue, e) => {
    e.stopPropagation();
    if (!issue || issue.count <= 1) return;
    
    const currentIndex = issueEventIndices[issue.id] || 0;
    const newIndex = (currentIndex + 1) % issue.count;
    
    setIssueEventIndices(prev => ({ ...prev, [issue.id]: newIndex }));
    
    // Fetch and show the event at this index
    await showEventAtIndex(issue, newIndex);
  };

  // Show event at specific index for an issue
  const showEventAtIndex = async (issue, index) => {
    try {
      const response = await fetch(`/api/issues/${issue.id}`);
      const data = await response.json();
      if (data.success && data.issue.events && data.issue.events.length > index) {
        setSelectedEvent({
          ...data.issue.events[index],
          issue: issue
        });
        setActiveTab('overview');
      }
    } catch (error) {
      console.error('Error fetching issue event:', error);
    }
  };

  const getEventType = (event) => {
    // Support both event and issue data structures
    const data = event.data || event;
    
    // Check if it's a message event (has message but no exception)
    if (data.message && !data.exception) return 'message';
    
    // Otherwise check by level
    if (data.level === 'error' || event.level === 'error' || data.exception) return 'error';
    if (data.level === 'warning' || event.level === 'warning') return 'warning';
    if (data.level === 'info' || event.level === 'info') return 'info';
    return 'event';
  };

  // Get event type badge info (for CSP, minidump, etc.)
  const getEventTypeBadge = (issue) => {
    // Check if issue has CSP-specific fields
    if (issue.violatedDirective || issue.blockedUri) {
      return { icon: '🛡️', label: 'CSP', color: '#f97316' }; // Orange
    }
    // Check events array for event type if available
    if (issue.events && issue.events.length > 0) {
      const latestEvent = issue.events[0];
      if (latestEvent.eventType === 'MINIDUMP') {
        return { icon: '💥', label: 'Crash', color: '#9333ea' }; // Purple
      }
      if (latestEvent.eventType === 'TRANSACTION') {
        return { icon: '⚡', label: 'Perf', color: '#3b82f6' }; // Blue
      }
      if (latestEvent.eventType === 'MESSAGE') {
        return { icon: '💬', label: 'Message', color: '#10b981' }; // Green
      }
      if (latestEvent.eventType === 'CSP') {
        return { icon: '🛡️', label: 'CSP', color: '#f97316' }; // Orange
      }
    }
    // Default for regular errors
    return null;
  };

  const getEventTitle = (event) => {
    // If it's an issue object (has title field)
    if (event.title) {
      return event.title;
    }
    // Otherwise it's an event object
    const data = event.data || {};
    if (data.exception?.values?.[0]?.value) {
      return data.exception.values[0].value;
    }
    if (data.message) return data.message;
    if (data.transaction) return data.transaction;
    return 'Unknown Event';
  };

  const formatDate = relativeTime;

  const copyToClipboard = async (text, setCopiedState) => {
    try {
      await navigator.clipboard.writeText(text);
      if (setCopiedState) {
        setCopiedState(true);
        setTimeout(() => {
          setCopiedState(false);
        }, 2000); // Reset after 2 seconds
      }
    } catch (err) {
      console.error('Failed to copy:', err);
      showNotification('Failed to copy to clipboard', 'error');
    }
  };

  // Combine issues and standalone events for filtering and display
  const combinedItems = [
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

  const filteredIssues = combinedItems.filter(issue => {
    const matchesSearch = !searchQuery || 
      issue.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (issue.project?.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesLevel = filterLevel === 'all' || 
      issue.level === filterLevel;
    
    const matchesStatus = (() => {
      // Standalone events should appear in "active" and "all" filters
      if (issue._isStandaloneEvent) {
        return filterStatus === 'all' || filterStatus === 'active';
      }
      if (filterStatus === 'all') return true;
      if (filterStatus === 'active') return issue.status !== 'RESOLVED' && issue.status !== 'IGNORED';
      if (filterStatus === 'unresolved') return issue.status === 'UNRESOLVED';
      if (filterStatus === 'resolved') return issue.status === 'RESOLVED';
      if (filterStatus === 'ignored') return issue.status === 'IGNORED';
      if (filterStatus === 'in_progress') return issue.status === 'IN_PROGRESS';
      return true;
    })();

    const matchesEventType = (() => {
      if (filterEventType === 'all') return true;
      // For standalone events, check the eventType directly
      if (issue._isStandaloneEvent) {
        return issue.eventType === filterEventType;
      }
      // Check for CSP issues
      if (filterEventType === 'CSP' && (issue.violatedDirective || issue.blockedUri)) return true;
      // Check event type in events array
      if (issue.events && issue.events.length > 0) {
        return issue.events.some(event => event.eventType === filterEventType);
      }
      // Default: show ERROR type issues when filtering by ERROR
      if (filterEventType === 'ERROR' && !issue.violatedDirective && !issue.blockedUri) return true;
      return false;
    })();
    
    const rangeMs = TIME_RANGES[timeRange]?.ms;
    const matchesTime = !rangeMs || (Date.now() - new Date(issue.lastSeen).getTime()) <= rangeMs;

    return matchesSearch && matchesLevel && matchesStatus && matchesEventType && matchesTime;
  });

  const hasActiveFilters = filterLevel !== 'all' || filterStatus !== 'all' || filterOrigin !== 'all' ||
    filterEventType !== 'all' || timeRange !== 'all' || !!searchQuery;

  const clearFilters = () => {
    setFilterLevel('all');
    setFilterStatus('all');
    setFilterEventType('all');
    setFilterOrigin('all');
    setTimeRange('all');
    setSearchQuery('');
  };

  const unresolvedCount = issues.filter(i => i.status === 'UNRESOLVED').length;
  const activeItemId = selectedEvent
    ? (selectedEvent.issue ? selectedEvent.issue.id : `event-${selectedEvent.id}`)
    : null;

  const isNewSinceLastVisit = (issue) =>
    !issue._isStandaloneEvent && lastVisitRef.current && issue.firstSeen &&
    new Date(issue.firstSeen).getTime() > lastVisitRef.current;

  const handleBulkStatus = async (status) => {
    const ids = selectedEvents.filter(id => typeof id === 'number');
    if (ids.length === 0) {
      showNotification('Standalone events have no status to change', 'info');
      return;
    }
    try {
      const results = await Promise.all(ids.map(id =>
        fetch(`/api/issues/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status })
        })
      ));
      const failed = results.filter(r => !r.ok).length;
      showNotification(
        failed ? `${ids.length - failed} updated, ${failed} failed` : `${ids.length} issue${ids.length === 1 ? '' : 's'} marked ${statusLabel(status).toLowerCase()}`,
        failed ? 'warning' : 'success'
      );
      exitSelectionMode();
      fetchData();
    } catch (error) {
      console.error('Bulk update failed:', error);
      showNotification('Bulk update failed', 'error');
    }
  };

  const handleExport = (format) => {
    if (filteredIssues.length === 0) {
      showNotification('Nothing to export with the current filters', 'info');
      return;
    }
    downloadIssues(filteredIssues.filter(i => !i._isStandaloneEvent), format);
  };

  const toggleDesktopAlerts = async () => {
    if (desktopAlerts) {
      setDesktopAlerts(false);
      return;
    }
    if (typeof Notification === 'undefined') {
      showNotification('This browser does not support desktop notifications', 'warning');
      return;
    }
    const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (permission === 'granted') {
      setDesktopAlerts(true);
      showNotification('Desktop alerts enabled for new issues', 'success');
    } else {
      showNotification('Notification permission was denied', 'warning');
    }
  };

  const copyIssueLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      showNotification('Link copied to clipboard', 'success');
    } catch (err) {
      showNotification('Failed to copy link', 'error');
    }
  };

  // "New since your last visit" marker
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem('sm.lastVisit');
      lastVisitRef.current = stored ? new Date(stored).getTime() : null;
    } catch (e) { /* storage unavailable */ }
    const save = () => {
      try { window.localStorage.setItem('sm.lastVisit', new Date().toISOString()); } catch (e) { /* ignore */ }
    };
    window.addEventListener('pagehide', save);
    return () => window.removeEventListener('pagehide', save);
  }, []);

  // Deep link: /dashboard?issue=123 opens that issue, and the URL follows the open issue
  useEffect(() => {
    if (!router.isReady || !user) return;
    const issueParam = router.query.issue;
    if (!deepLinkHandledRef.current) {
      deepLinkHandledRef.current = true;
      if (issueParam) {
        deepLinkPendingRef.current = true;
        openItem({ id: parseInt(issueParam) }).finally(() => { deepLinkPendingRef.current = false; });
        return;
      }
    }
    if (deepLinkPendingRef.current) return;
    const openId = selectedEvent?.issue?.id ? String(selectedEvent.issue.id) : null;
    if ((issueParam || null) === openId) return;
    const query = { ...router.query };
    if (openId) query.issue = openId; else delete query.issue;
    router.replace({ pathname: router.pathname, query }, undefined, { shallow: true });
  }, [router.isReady, user, selectedEvent]);

  // Phone back button closes the detail view instead of leaving the dashboard
  useEffect(() => {
    const isPhone = window.matchMedia('(max-width: 768px)').matches;
    if (!isPhone) return;
    if (selectedEvent && !detailPushedRef.current) {
      window.history.pushState({ smDetail: true }, '');
      detailPushedRef.current = true;
    } else if (!selectedEvent && detailPushedRef.current) {
      detailPushedRef.current = false;
      if (window.history.state?.smDetail) window.history.back();
    }
  }, [!!selectedEvent]);

  useEffect(() => {
    const onPop = () => {
      if (detailPushedRef.current) {
        detailPushedRef.current = false;
        setSelectedEvent(null);
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e) => {
      const tag = e.target.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable;
      const modalOpen = showDeleteConfirm || showGitHubModal || showNewProjectModal || showShortcuts || !!dupPreview || !!mergeDraft;

      if (e.key === 'Escape') {
        if (dupPreview) setDupPreview(null);
        else if (mergeDraft) setMergeDraft(null);
        else if (showShortcuts) setShowShortcuts(false);
        else if (showDeleteConfirm) { setShowDeleteConfirm(false); setDeletingIssue(null); setDeletingEvent(null); }
        else if (showGitHubModal) setShowGitHubModal(false);
        else if (showNewProjectModal) setShowNewProjectModal(false);
        else if (typing && e.target === searchInputRef.current) { setSearchQuery(''); e.target.blur(); }
        else if (!typing && isSelectionMode) exitSelectionMode();
        else if (!typing && selectedEvent) closeDetail();
        return;
      }

      if (typing || modalOpen || e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === '?') {
        setShowShortcuts(true);
      } else if (e.key === 'j' || e.key === 'k') {
        if (filteredIssues.length === 0) return;
        const idx = filteredIssues.findIndex(i => i.id === activeItemId);
        const next = e.key === 'j'
          ? Math.min(idx + 1, filteredIssues.length - 1)
          : Math.max(idx === -1 ? 0 : idx - 1, 0);
        openItem(filteredIssues[next]);
        document.querySelector(`[data-item-id="${filteredIssues[next].id}"]`)?.scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'r' && selectedEvent?.issue) {
        handleResolveIssue(selectedEvent.issue);
      } else if (e.key === 'i' && selectedEvent?.issue) {
        handleIgnoreIssue(selectedEvent.issue);
      } else if (e.key === 'R') {
        fetchData();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const renderStackTrace = (exception) => {
    if (!exception?.values?.[0]?.stacktrace?.frames) {
      return <pre className={styles.codeBlock}>{JSON.stringify(exception, null, 2)}</pre>;
    }

    const frames = exception.values[0].stacktrace.frames;
    const reversedFrames = frames.slice().reverse();
    
    return (
      <div className={styles.stackTraceContainer}>
        {reversedFrames.map((frame, idx) => {
          const isLast = idx === reversedFrames.length - 1;
          const indentLevel = idx;
          
          return (
            <div key={idx} className={styles.stackFrameWrapper}>
              {/* Tree connector lines */}
              <div 
                className={styles.stackFrameTreeLine}
                style={{
                  marginLeft: `${indentLevel * 1.5}rem`,
                }}
              >
                <div className={styles.treeConnector}>
                  <span className={styles.treeBranch}>{isLast ? '└─' : '├─'}</span>
                  <span className={styles.treeArrow}>▶</span>
                </div>
              </div>
              
              {/* Frame content */}
              <div 
                className={`${styles.stackFrame} ${isLast ? styles.stackFrameLast : ''}`}
                style={{
                  marginLeft: `${indentLevel * 1.5 + 2.5}rem`,
                }}
              >
                <div className={styles.stackFrameHeader}>
                  <span className={styles.stackFrameFunction}>
                    {frame.function || 'anonymous'}
                  </span>
                  {frame.filename && (
                    <span className={styles.stackFrameFile}>
                      {frame.filename}:{frame.lineno}
                    </span>
                  )}
                </div>
                {frame.context_line && (
                  <pre className={styles.stackFrameCode}>{frame.context_line.trim()}</pre>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderEventDetail = () => {
    if (!selectedEvent) {
      return (
        <div className={styles.detailPanelEmpty}>
          <div className={styles.emptyDetailContent}>
            <div className={styles.emptyDetailIcon}><Icon name="search" size={40} strokeWidth={1.25} /></div>
            <h3 className={styles.emptyDetailTitle}>Select an Event</h3>
            <p className={styles.emptyDetailText}>
              Click on any event from the list to view detailed information,
              stack traces, breadcrumbs, and more.
            </p>
            <p className={styles.emptyDetailText} style={{ marginTop: 'var(--space-3)' }}>
              Tip: press <kbd className={styles.kbd}>j</kbd> / <kbd className={styles.kbd}>k</kbd> to move through issues, or <kbd className={styles.kbd}>?</kbd> for all shortcuts.
            </p>
          </div>
        </div>
      );
    }

    const data = selectedEvent.data;
    
    return (
      <div className={styles.detailPanel}>
        <div className={styles.detailHeader}>
          <h3 className={styles.detailTitle}>{getEventTitle(selectedEvent)}</h3>
          <div className={styles.detailHeaderActions}>
            {selectedEvent.issue && (
              <>
                <button 
                  onClick={() => handleResolveIssue(selectedEvent.issue)}
                  className={styles.resolveButton}
                  title={selectedEvent.issue.status === 'RESOLVED' ? "Reopen issue" : "Resolve issue"}
                  data-on={selectedEvent.issue.status === 'RESOLVED' ? 'success' : undefined}
                >
                  {selectedEvent.issue.status === 'RESOLVED' ? <><Icon name="checkCircle" size={14} /> Resolved</> : <><Icon name="circle" size={14} /> Resolve</>}
                </button>
                <button 
                  onClick={() => handleIgnoreIssue(selectedEvent.issue)}
                  className={styles.ignoreButton}
                  title={selectedEvent.issue.status === 'IGNORED' ? "Unignore issue" : "Ignore issue - won't appear in main view or auto-report to GitHub"}
                  data-on={selectedEvent.issue.status === 'IGNORED' ? 'muted' : undefined}
                >
                  <><Icon name="eyeOff" size={14} /> {selectedEvent.issue.status === 'IGNORED' ? 'Ignored' : 'Ignore'}</>
                </button>
              </>
            )}
            <button 
              onClick={() => handleCreateGitHubIssue(selectedEvent)}
              className={styles.githubButton}
              title={selectedEvent.issue?.githubIssueUrl ? "Open existing GitHub issue" : "Create GitHub issue"}
              data-on={selectedEvent.issue?.githubIssueUrl ? 'success' : undefined}
            >
              <Icon name="github" size={15} />
            </button>
            <button 
              onClick={() => {
                if (selectedEvent.issue) {
                  setDeletingIssue(selectedEvent.issue);
                } else {
                  setDeletingEvent(selectedEvent);
                }
                setShowDeleteConfirm(true);
              }}
              className={styles.deleteButton}
              title={selectedEvent.issue ? "Delete this issue" : "Delete this event"}
            >
              <Icon name="trash" size={15} />
            </button>
            {selectedEvent.issue && (
              <button
                onClick={copyIssueLink}
                className={styles.closeButton}
                title="Copy link to this issue"
                aria-label="Copy link to this issue"
              >
                <Icon name="link" size={15} />
              </button>
            )}
            <button 
              onClick={closeDetail}
              className={styles.closeButton}
              aria-label="Close detail (Esc)"
              title="Close (Esc)"
            >
              <Icon name="x" size={15} />
            </button>
          </div>
        </div>

        <div className={styles.tabsContainer}>
          <button
            onClick={() => setActiveTab('overview')}
            className={`${styles.tab} ${activeTab === 'overview' ? styles.tabActive : ''}`}
          >
            Overview
          </button>
          {data.exception?.values?.[0]?.stacktrace?.frames && (
            <button
              onClick={() => setActiveTab('stacktrace')}
              className={`${styles.tab} ${activeTab === 'stacktrace' ? styles.tabActive : ''}`}
            >
              Stack Trace
            </button>
          )}
          {((data.breadcrumbs?.values?.length > 0) || (Array.isArray(data.breadcrumbs) && data.breadcrumbs.length > 0)) && (
            <button
              onClick={() => setActiveTab('breadcrumbs')}
              className={`${styles.tab} ${activeTab === 'breadcrumbs' ? styles.tabActive : ''}`}
            >
              Breadcrumbs ({Array.isArray(data.breadcrumbs) ? data.breadcrumbs.length : data.breadcrumbs.values.length})
            </button>
          )}
          {(data.request || data.contexts) && (
            <button
              onClick={() => setActiveTab('context')}
              className={`${styles.tab} ${activeTab === 'context' ? styles.tabActive : ''}`}
            >
              Context
            </button>
          )}
          {(data.type === 'transaction' || selectedEvent.eventType === 'TRANSACTION') && (
            <button
              onClick={() => setActiveTab('performance')}
              className={`${styles.tab} ${activeTab === 'performance' ? styles.tabActive : ''}`}
            >
              Performance
            </button>
          )}
          <button
            onClick={() => setActiveTab('raw')}
            className={`${styles.tab} ${activeTab === 'raw' ? styles.tabActive : ''}`}
          >
            Raw JSON
          </button>
        </div>
        
        <div className={styles.detailContent}>
          {activeTab === 'overview' && (
            <>
              <div className={styles.detailSection}>
                <div className={styles.overviewGrid}>
                  <div className={styles.overviewItem}>
                    <span className={styles.overviewLabel}>Event ID</span>
                    <div className={styles.overviewValueWithCopy}>
                      <span className={styles.overviewValue}>{selectedEvent.id}</span>
                      <button 
                        onClick={() => copyToClipboard(selectedEvent.id.toString())}
                        className={styles.copyIconButton}
                        title="Copy"
                      >
                        <Icon name="copy" size={14} />
                      </button>
                    </div>
                  </div>
                  
                  <div className={styles.overviewItem}>
                    <span className={styles.overviewLabel}>Type</span>
                    <span 
                      className={styles.eventType}
                      style={{
                        backgroundColor: getEventType(selectedEvent) === 'error' ? 'var(--error-bg)' : 
                                       getEventType(selectedEvent) === 'warning' ? 'var(--warning-bg)' : 
                                       getEventType(selectedEvent) === 'message' ? 'var(--success-bg)' : 'var(--info-bg)',
                        color: getEventType(selectedEvent) === 'error' ? 'var(--error)' : 
                               getEventType(selectedEvent) === 'warning' ? 'var(--warning)' : 
                               getEventType(selectedEvent) === 'message' ? 'var(--success)' : 'var(--info)'
                      }}
                    >
                      {getEventType(selectedEvent) === 'message' ? 'MESSAGE' : getEventType(selectedEvent).toUpperCase()}
                    </span>
                  </div>

                  {selectedEvent.issue && (
                    <div className={styles.overviewItem}>
                      <span className={styles.overviewLabel}>Status</span>
                      <span 
                        className={styles.eventType}
                        style={{
                          backgroundColor: selectedEvent.issue.status === 'RESOLVED' ? 'var(--success-bg)' : 
                                         selectedEvent.issue.status === 'IGNORED' ? 'var(--bg-tertiary)' : 
                                         selectedEvent.issue.status === 'IN_PROGRESS' ? 'var(--warning-bg)' : 'var(--error-bg)',
                          color: selectedEvent.issue.status === 'RESOLVED' ? 'var(--success)' : 
                                selectedEvent.issue.status === 'IGNORED' ? 'var(--text-secondary)' : 
                                selectedEvent.issue.status === 'IN_PROGRESS' ? 'var(--warning)' : 'var(--error)'
                        }}
                      >
                        {selectedEvent.issue.status === 'IN_PROGRESS' ? 'IN PROGRESS' : selectedEvent.issue.status}
                      </span>
                    </div>
                  )}

                  <div className={styles.overviewItem}>
                    <span className={styles.overviewLabel}>Project</span>
                    <span className={styles.overviewValue}>{selectedEvent.project?.name || 'Unknown Project'}</span>
                  </div>

                  <div className={styles.overviewItem}>
                    <span className={styles.overviewLabel}>Timestamp</span>
                    <span className={styles.overviewValue}>
                      {new Date(selectedEvent.createdAt).toLocaleString()}
                    </span>
                  </div>

                  {data.level && (
                    <div className={styles.overviewItem}>
                      <span className={styles.overviewLabel}>Level</span>
                      <span className={styles.overviewValue}>{data.level}</span>
                    </div>
                  )}

                  {data.environment && (
                    <div className={styles.overviewItem}>
                      <span className={styles.overviewLabel}>Environment</span>
                      <span className={styles.overviewValue}>{data.environment}</span>
                    </div>
                  )}

                  {data.platform && (
                    <div className={styles.overviewItem}>
                      <span className={styles.overviewLabel}>Platform</span>
                      <span className={styles.overviewValue}>{data.platform}</span>
                    </div>
                  )}

                  {data.release && (
                    <div className={styles.overviewItem}>
                      <span className={styles.overviewLabel}>Release</span>
                      <span className={styles.overviewValue}>{data.release}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* User Information */}
              {data.user && (
                <div className={styles.detailSection}>
                  <h4 className={styles.detailSectionTitle}>User Information</h4>
                  <div className={styles.infoCard}>
                    <div className={styles.infoGrid}>
                      {data.user.id && (
                        <div className={styles.infoItem}>
                          <span className={styles.infoLabel}>User ID</span>
                          <span className={styles.infoValue}>{data.user.id}</span>
                        </div>
                      )}
                      {data.user.username && (
                        <div className={styles.infoItem}>
                          <span className={styles.infoLabel}>Username</span>
                          <span className={styles.infoValue}>{data.user.username}</span>
                        </div>
                      )}
                      {data.user.email && (
                        <div className={styles.infoItem}>
                          <span className={styles.infoLabel}>Email</span>
                          <span className={styles.infoValue}>{data.user.email}</span>
                        </div>
                      )}
                      {data.user.ip_address && (
                        <div className={styles.infoItem}>
                          <span className={styles.infoLabel}>IP Address</span>
                          <span className={styles.infoValue}>{data.user.ip_address}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Device & Browser Information */}
              {(data.contexts?.device || data.contexts?.browser || data.contexts?.os) && (
                <div className={styles.detailSection}>
                  <h4 className={styles.detailSectionTitle}>Device & Browser</h4>
                  <div className={styles.infoCard}>
                    <div className={styles.infoGrid}>
                      {data.contexts?.browser?.name && (
                        <div className={styles.infoItem}>
                          <span className={styles.infoLabel}>Browser</span>
                          <span className={styles.infoValue}>
                            {data.contexts.browser.name} {data.contexts.browser.version || ''}
                          </span>
                        </div>
                      )}
                      {data.contexts?.os?.name && (
                        <div className={styles.infoItem}>
                          <span className={styles.infoLabel}>Operating System</span>
                          <span className={styles.infoValue}>
                            {data.contexts.os.name} {data.contexts.os.version || ''}
                          </span>
                        </div>
                      )}
                      {data.contexts?.device?.family && (
                        <div className={styles.infoItem}>
                          <span className={styles.infoLabel}>Device</span>
                          <span className={styles.infoValue}>
                            {data.contexts.device.family} {data.contexts.device.model || ''}
                          </span>
                        </div>
                      )}
                      {data.contexts?.device?.screen_resolution && (
                        <div className={styles.infoItem}>
                          <span className={styles.infoLabel}>Screen Resolution</span>
                          <span className={styles.infoValue}>{data.contexts.device.screen_resolution}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* SDK Information */}
              {data.sdk && (
                <div className={styles.detailSection}>
                  <h4 className={styles.detailSectionTitle}>SDK Information</h4>
                  <div className={styles.infoCard}>
                    <div className={styles.infoGrid}>
                      {data.sdk.name && (
                        <div className={styles.infoItem}>
                          <span className={styles.infoLabel}>SDK Name</span>
                          <span className={styles.infoValue}>{data.sdk.name}</span>
                        </div>
                      )}
                      {data.sdk.version && (
                        <div className={styles.infoItem}>
                          <span className={styles.infoLabel}>SDK Version</span>
                          <span className={styles.infoValue}>{data.sdk.version}</span>
                        </div>
                      )}
                      {data.sdk.packages && (
                        <div className={styles.infoItem}>
                          <span className={styles.infoLabel}>Packages</span>
                          <span className={styles.infoValue}>
                            {data.sdk.packages.map(p => `${p.name}@${p.version}`).join(', ')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Runtime Information */}
              {data.contexts?.runtime && (
                <div className={styles.detailSection}>
                  <h4 className={styles.detailSectionTitle}>Runtime Information</h4>
                  <div className={styles.infoCard}>
                    <div className={styles.infoGrid}>
                      {data.contexts.runtime.name && (
                        <div className={styles.infoItem}>
                          <span className={styles.infoLabel}>Runtime</span>
                          <span className={styles.infoValue}>
                            {data.contexts.runtime.name} {data.contexts.runtime.version || ''}
                          </span>
                        </div>
                      )}
                      {data.contexts.runtime.build && (
                        <div className={styles.infoItem}>
                          <span className={styles.infoLabel}>Build</span>
                          <span className={styles.infoValue}>{data.contexts.runtime.build}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* CSP Violation Details */}
              {(data.type === 'csp' || data.csp || selectedEvent.issue?.violatedDirective) && (
                <div className={styles.detailSection}>
                  <h4 className={styles.detailSectionTitle}>CSP Violation Details</h4>
                  <div className={styles.infoCard}>
                    <div className={styles.infoGrid}>
                      {(data.contexts?.csp?.violated_directive || selectedEvent.issue?.violatedDirective) && (
                        <div className={styles.infoItem}>
                          <span className={styles.infoLabel}>Violated Directive</span>
                          <span className={styles.infoValue}>
                            {data.contexts?.csp?.violated_directive || selectedEvent.issue?.violatedDirective}
                          </span>
                        </div>
                      )}
                      {(data.contexts?.csp?.blocked_uri || selectedEvent.issue?.blockedUri) && (
                        <div className={styles.infoItem}>
                          <span className={styles.infoLabel}>Blocked URI</span>
                          <span className={styles.infoValue}>
                            {data.contexts?.csp?.blocked_uri || selectedEvent.issue?.blockedUri}
                          </span>
                        </div>
                      )}
                      {(data.contexts?.csp?.document_uri || data.csp?.['document-uri']) && (
                        <div className={styles.infoItem}>
                          <span className={styles.infoLabel}>Document URI</span>
                          <span className={styles.infoValue}>
                            {data.contexts?.csp?.document_uri || data.csp?.['document-uri']}
                          </span>
                        </div>
                      )}
                      {(data.contexts?.csp?.source_file || selectedEvent.issue?.sourceFile) && (
                        <div className={styles.infoItem}>
                          <span className={styles.infoLabel}>Source File</span>
                          <span className={styles.infoValue}>
                            {data.contexts?.csp?.source_file || selectedEvent.issue?.sourceFile}
                          </span>
                        </div>
                      )}
                      {(data.contexts?.csp?.disposition || data.csp?.disposition) && (
                        <div className={styles.infoItem}>
                          <span className={styles.infoLabel}>Disposition</span>
                          <span className={styles.infoValue}>
                            {data.contexts?.csp?.disposition || data.csp?.disposition}
                          </span>
                        </div>
                      )}
                    </div>
                    {(data.contexts?.csp?.original_policy || data.csp?.['original-policy']) && (
                      <div style={{ marginTop: 'var(--space-3)' }}>
                        <span className={styles.infoLabel}>Original Policy</span>
                        <pre className={styles.codeBlock} style={{ fontSize: '10px', marginTop: 'var(--space-1)' }}>
                          {data.contexts?.csp?.original_policy || data.csp?.['original-policy']}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Minidump/Crash Details */}
              {(data.type === 'minidump' || data.minidump) && (
                <div className={styles.detailSection}>
                  <h4 className={styles.detailSectionTitle}>Native Crash Details</h4>
                  <div className={styles.infoCard}>
                    <div className={styles.infoGrid}>
                      {data.minidump?.crash_reason && (
                        <div className={styles.infoItem}>
                          <span className={styles.infoLabel}>Crash Reason</span>
                          <span className={styles.infoValue}>{data.minidump.crash_reason}</span>
                        </div>
                      )}
                      {data.minidump?.crash_address && (
                        <div className={styles.infoItem}>
                          <span className={styles.infoLabel}>Crash Address</span>
                          <span className={styles.infoValue}>{data.minidump.crash_address}</span>
                        </div>
                      )}
                      {data.minidump?.platform && (
                        <div className={styles.infoItem}>
                          <span className={styles.infoLabel}>Platform</span>
                          <span className={styles.infoValue}>{data.minidump.platform}</span>
                        </div>
                      )}
                      {data.minidump?.os_version && (
                        <div className={styles.infoItem}>
                          <span className={styles.infoLabel}>OS Version</span>
                          <span className={styles.infoValue}>{data.minidump.os_version}</span>
                        </div>
                      )}
                      {data.minidump?.app_version && (
                        <div className={styles.infoItem}>
                          <span className={styles.infoLabel}>App Version</span>
                          <span className={styles.infoValue}>{data.minidump.app_version}</span>
                        </div>
                      )}
                    </div>
                    {data.minidump?.note && (
                      <div style={{ marginTop: 'var(--space-2)', fontSize: '11px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                        ℹ️ {data.minidump.note}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Server Performance Information */}
              {data._serverPerformance && (
                <div className={styles.detailSection}>
                  <h4 className={styles.detailSectionTitle}>Server Performance</h4>
                  <div className={styles.infoCard}>
                    <div className={styles.infoGrid}>
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Total Processing Time</span>
                        <span className={`${styles.infoValue} ${data._serverPerformance.totalTime > 500 ? styles.valueWarning : styles.valueSuccess}`}>
                          {data._serverPerformance.totalTime}ms
                        </span>
                      </div>
                      {Object.entries(data._serverPerformance).map(([key, value]) => {
                        if (key === 'totalTime' || key === '_start') return null;
                        return (
                          <div key={key} className={styles.infoItem}>
                            <span className={styles.infoLabel}>{key.replace(/_/g, ' ')}</span>
                            <span className={styles.infoValue}>{value}ms</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Message or Exception */}
              {data.exception ? (
                <div className={styles.detailSection}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                    <h4 className={styles.detailSectionTitle}>Exception</h4>
                    <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                      <button
                        className={styles.prettifyButton}
                        onClick={() => {
                          const errorText = prettifiedError 
                            ? prettifyContent(data.exception.values?.[0]?.value || 'No message')
                            : (data.exception.values?.[0]?.value || 'No message');
                          copyToClipboard(errorText, setCopiedError);
                        }}
                        title={copiedError ? 'Copied!' : 'Copy error'}
                        style={{ 
                          opacity: copiedError ? 0.7 : 1,
                          transition: 'opacity 0.2s'
                        }}
                      >
                        {copiedError ? 'Copied' : 'Copy'}
                      </button>
                      <button
                        className={styles.prettifyButton}
                        onClick={() => setPrettifiedError(!prettifiedError)}
                        title={prettifiedError ? 'Show original' : 'Prettify'}
                      >
                        {prettifiedError ? 'Original' : 'Prettify'}
                      </button>
                    </div>
                  </div>
                  <div className={styles.exceptionBox}>
                    <div className={styles.exceptionType}>
                      {data.exception.values?.[0]?.type || 'Exception'}
                    </div>
                    <div className={styles.exceptionValue} style={prettifiedError ? { whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '12px' } : {}}>
                      {prettifiedError 
                        ? prettifyContent(data.exception.values?.[0]?.value || 'No message')
                        : (data.exception.values?.[0]?.value || 'No message')
                      }
                    </div>
                  </div>
                  
                  {/* Error Snippet */}
                  {(() => {
                    const frames = data.exception.values?.[0]?.stacktrace?.frames;
                    if (!frames || frames.length === 0) return null;
                    
                    // Find the last frame (the one that triggered the error)
                    const errorFrame = frames[frames.length - 1];
                    
                    // Check if we have context lines
                    const hasContext = errorFrame.pre_context || errorFrame.context_line || errorFrame.post_context;
                    if (!hasContext) return null;
                    
                    // Build the snippet with line numbers
                    const lines = [];
                    const startLine = errorFrame.lineno - (errorFrame.pre_context?.length || 0);
                    
                    // Add pre-context lines
                    if (errorFrame.pre_context) {
                      errorFrame.pre_context.forEach((line, idx) => {
                        lines.push({
                          number: startLine + idx,
                          content: line,
                          isError: false
                        });
                      });
                    }
                    
                    // Add the error line
                    if (errorFrame.context_line) {
                      lines.push({
                        number: errorFrame.lineno,
                        content: errorFrame.context_line,
                        isError: true
                      });
                    }
                    
                    // Add post-context lines
                    if (errorFrame.post_context) {
                      errorFrame.post_context.forEach((line, idx) => {
                        lines.push({
                          number: errorFrame.lineno + idx + 1,
                          content: line,
                          isError: false
                        });
                      });
                    }
                    
                    // Format code snippet for copying
                    const formatCodeForCopy = () => {
                      let formatted = '';
                      if (errorFrame.filename) {
                        formatted += `${errorFrame.filename}:${errorFrame.lineno}\n`;
                      }
                      lines.forEach(line => {
                        formatted += `${line.number}: ${line.content}\n`;
                      });
                      return formatted.trim();
                    };

                    return (
                      <div style={{ marginTop: 'var(--space-3)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                          <h4 className={styles.detailSectionTitle}>Code Snippet</h4>
                          <button
                            className={styles.prettifyButton}
                            onClick={() => copyToClipboard(formatCodeForCopy(), setCopiedCode)}
                            title={copiedCode ? 'Copied!' : 'Copy code'}
                            style={{ 
                              opacity: copiedCode ? 0.7 : 1,
                              transition: 'opacity 0.2s'
                            }}
                          >
                            {copiedCode ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                        {errorFrame.filename && (
                          <div style={{ 
                            fontSize: '11px', 
                            color: 'var(--text-secondary)', 
                            marginBottom: 'var(--space-2)',
                            fontFamily: 'monospace'
                          }}>
                            {errorFrame.filename}:{errorFrame.lineno}
                          </div>
                        )}
                        <div className={styles.codeSnippet}>
                          {lines.map((line, idx) => (
                            <div 
                              key={idx} 
                              className={`${styles.snippetLine} ${line.isError ? styles.snippetLineError : ''}`}
                            >
                              <span className={styles.snippetLineNumber}>{line.number}</span>
                              <span className={styles.snippetLineContent}>{line.content}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ) : data.message ? (
                <div className={styles.detailSection}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                    <h4 className={styles.detailSectionTitle}>Message</h4>
                    <button
                      className={styles.prettifyButton}
                      onClick={() => setPrettifiedMessage(!prettifiedMessage)}
                      title={prettifiedMessage ? 'Show original' : 'Prettify'}
                    >
                      {prettifiedMessage ? 'Original' : 'Prettify'}
                    </button>
                  </div>
                  <div className={styles.exceptionBox} style={{ backgroundColor: 'var(--success-bg)', borderColor: 'var(--success)' }}>
                    <div className={styles.exceptionValue} style={{ 
                      color: 'var(--text-primary)',
                      ...(prettifiedMessage ? { whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '12px' } : {})
                    }}>
                      {prettifiedMessage 
                        ? prettifyContent(data.message)
                        : data.message
                      }
                    </div>
                  </div>
                </div>
              ) : null}

              {data.tags && Object.keys(data.tags).length > 0 && (
                <div className={styles.detailSection}>
                  <h4 className={styles.detailSectionTitle}>Tags</h4>
                  <div className={styles.tagsContainer}>
                    {Object.entries(data.tags).map(([key, value]) => (
                      <div key={key} className={styles.tag}>
                        <span className={styles.tagKey}>{key}:</span>
                        <span className={styles.tagValue}>{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === 'stacktrace' && data.exception && (
            <div className={styles.detailSection}>
              <h4 className={styles.detailSectionTitle}>Stack Trace</h4>
              {renderStackTrace(data.exception)}
            </div>
          )}

          {activeTab === 'breadcrumbs' && (data.breadcrumbs?.values || (Array.isArray(data.breadcrumbs) && data.breadcrumbs.length > 0)) && (
            <div className={styles.detailSection}>
              <h4 className={styles.detailSectionTitle}>Breadcrumbs</h4>
              <div className={styles.breadcrumbsContainer}>
                {(Array.isArray(data.breadcrumbs) ? data.breadcrumbs : data.breadcrumbs.values).map((crumb, idx) => {
                  // Format timestamp if it's a unix timestamp
                  const timestamp = crumb.timestamp 
                    ? (typeof crumb.timestamp === 'number' && crumb.timestamp > 1000000000000 
                        ? new Date(crumb.timestamp).toLocaleString()
                        : typeof crumb.timestamp === 'number' && crumb.timestamp > 1000000000
                        ? new Date(crumb.timestamp * 1000).toLocaleString()
                        : crumb.timestamp)
                    : '';
                  
                  return (
                    <div key={idx} className={styles.breadcrumb}>
                      <div className={styles.breadcrumbHeader}>
                        <span className={styles.breadcrumbType}>
                          {crumb.type || crumb.category || crumb.level || 'default'}
                        </span>
                        <span className={styles.breadcrumbTime}>{timestamp}</span>
                      </div>
                      {crumb.message && (
                        <div className={styles.breadcrumbMessage}>{crumb.message}</div>
                      )}
                      {crumb.data && (
                        <pre className={styles.breadcrumbData}>
                          {JSON.stringify(crumb.data, null, 2)}
                        </pre>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'context' && (
            <>
              {data.request && (
                <div className={styles.detailSection}>
                  <h4 className={styles.detailSectionTitle}>Request</h4>
                  <pre className={styles.codeBlock}>
                    {JSON.stringify(data.request, null, 2)}
                  </pre>
                </div>
              )}
              {data.contexts && (
                <div className={styles.detailSection}>
                  <h4 className={styles.detailSectionTitle}>Contexts</h4>
                  <pre className={styles.codeBlock}>
                    {JSON.stringify(data.contexts, null, 2)}
                  </pre>
                </div>
              )}
            </>
          )}

          {activeTab === 'performance' && (
            <>
              {(() => {
                // Extract performance metrics
                const duration = data.timestamp && data.start_timestamp 
                  ? (data.timestamp - data.start_timestamp) 
                  : 0;
                
                const formatBytes = (bytes) => {
                  if (!bytes || bytes === 0) return '0 Bytes';
                  const k = 1024;
                  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
                  const i = Math.floor(Math.log(bytes) / Math.log(k));
                  return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
                };

                const formatDuration = (seconds) => {
                  if (!seconds) return '0ms';
                  if (seconds < 1) return `${Math.round(seconds * 1000)}ms`;
                  return `${seconds.toFixed(3)}s`;
                };

                // Extract metrics from breadcrumbs
                const metrics = {};
                if (data.breadcrumbs) {
                  const breadcrumbs = data.breadcrumbs.values || data.breadcrumbs;
                  if (Array.isArray(breadcrumbs)) {
                    breadcrumbs.forEach(bc => {
                      const msg = bc.message || '';
                      
                      // Memory metrics
                      if (msg.includes('Heap Used:')) {
                        const match = msg.match(/([\d.]+)\s*MB/);
                        if (match) metrics.heapUsed = parseFloat(match[1]);
                      }
                      if (msg.includes('Heap Total:')) {
                        const match = msg.match(/([\d.]+)\s*MB/);
                        if (match) metrics.heapTotal = parseFloat(match[1]);
                      }
                      if (msg.includes('RSS:')) {
                        const match = msg.match(/([\d.]+)\s*MB/);
                        if (match) metrics.rss = parseFloat(match[1]);
                      }
                      
                      // Performance metrics
                      if (msg.includes('CPU usage:')) {
                        const match = msg.match(/([\d.]+)%/);
                        if (match) metrics.cpu = parseFloat(match[1]);
                      }
                      if (msg.includes('event loop lag:')) {
                        const match = msg.match(/([\d.]+)\s*ms/);
                        if (match) metrics.eventLoopLag = parseFloat(match[1]);
                      }
                      if (msg.includes('active connections:')) {
                        const match = msg.match(/:\s*(\d+)/);
                        if (match) metrics.activeConnections = parseInt(match[1]);
                      }
                      if (msg.includes('throughput:')) {
                        const match = msg.match(/([\d.]+)\s*req\/s/);
                        if (match) metrics.throughput = parseFloat(match[1]);
                      }
                    });
                  }
                }

                // Get memory from contexts
                const appMemory = data.contexts?.app?.app_memory;
                const freeMemory = data.contexts?.device?.free_memory;
                const totalMemory = data.contexts?.device?.memory_size;

                const renderMetricCard = (label, value, color = '#3b82f6') => (
                  <div style={{
                    background: 'var(--bg-secondary)',
                    padding: '16px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-primary)'
                  }}>
                    <div style={{
                      fontSize: '12px',
                      color: 'var(--text-secondary)',
                      marginBottom: '8px',
                      fontWeight: '600',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      {label}
                    </div>
                    <div style={{
                      fontSize: '24px',
                      fontWeight: 'bold',
                      color: color
                    }}>
                      {value}
                    </div>
                  </div>
                );

                const renderBarChart = (label, value, max, color, unit = '') => {
                  const percentage = max > 0 ? (value / max) * 100 : 0;
                  return (
                    <div style={{ marginBottom: '16px' }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: '6px',
                        fontSize: '13px'
                      }}>
                        <span style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{label}</span>
                        <span style={{ color: 'var(--text-secondary)' }}>{value.toFixed(2)}{unit}</span>
                      </div>
                      <div style={{
                        width: '100%',
                        height: '20px',
                        background: 'var(--bg-tertiary)',
                        borderRadius: '4px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          width: `${percentage}%`,
                          height: '100%',
                          background: color,
                          transition: 'width 0.3s ease'
                        }}></div>
                      </div>
                    </div>
                  );
                };

                return (
                  <>
                    {/* Transaction Info */}
                    <div className={styles.detailSection}>
                      <h4 className={styles.detailSectionTitle}>Transaction Overview</h4>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: '16px',
                        marginBottom: '20px'
                      }}>
                        {renderMetricCard('Duration', formatDuration(duration), '#8b5cf6')}
                        {data.transaction && renderMetricCard('Transaction', data.transaction, '#3b82f6')}
                        {data.contexts?.trace?.status && renderMetricCard('Status', data.contexts.trace.status.toUpperCase(), '#10b981')}
                        {data.environment && renderMetricCard('Environment', data.environment, '#f59e0b')}
                      </div>
                    </div>

                    {/* Memory Metrics */}
                    {(metrics.heapUsed || metrics.heapTotal || metrics.rss || appMemory) && (
                      <div className={styles.detailSection}>
                        <h4 className={styles.detailSectionTitle}>Memory Metrics</h4>
                        <div style={{
                          background: 'var(--bg-secondary)',
                          padding: '20px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-primary)'
                        }}>
                          {metrics.heapUsed && metrics.heapTotal && (
                            <>
                              {renderBarChart('Heap Used', metrics.heapUsed, metrics.heapTotal, 'linear-gradient(90deg, #00E396 0%, #00A875 100%)', ' MB')}
                              <div style={{
                                fontSize: '12px',
                                color: 'var(--text-secondary)',
                                marginBottom: '12px'
                              }}>
                                Heap Utilization: {((metrics.heapUsed / metrics.heapTotal) * 100).toFixed(1)}%
                              </div>
                            </>
                          )}
                          {metrics.rss && (
                            renderBarChart('RSS Memory', metrics.rss, metrics.rss * 1.2, 'linear-gradient(90deg, #FEB019 0%, #FF6B6B 100%)', ' MB')
                          )}
                          {appMemory && (
                            renderBarChart('App Memory', appMemory / 1024 / 1024, (appMemory / 1024 / 1024) * 1.2, 'linear-gradient(90deg, #008FFB 0%, #00E396 100%)', ' MB')
                          )}
                          
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                            gap: '12px',
                            marginTop: '16px',
                            paddingTop: '16px',
                            borderTop: '1px solid var(--border-primary)'
                          }}>
                            {metrics.heapUsed && (
                              <div>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Heap Used</div>
                                <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>{metrics.heapUsed.toFixed(2)} MB</div>
                              </div>
                            )}
                            {metrics.heapTotal && (
                              <div>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Heap Total</div>
                                <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>{metrics.heapTotal.toFixed(2)} MB</div>
                              </div>
                            )}
                            {metrics.rss && (
                              <div>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>RSS</div>
                                <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>{metrics.rss.toFixed(2)} MB</div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* System Metrics */}
                    {(metrics.cpu !== undefined || metrics.eventLoopLag || metrics.activeConnections) && (
                      <div className={styles.detailSection}>
                        <h4 className={styles.detailSectionTitle}>System Performance</h4>
                        <div style={{
                          background: 'var(--bg-secondary)',
                          padding: '20px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-primary)'
                        }}>
                          {metrics.cpu !== undefined && (
                            <>
                              {renderBarChart('CPU Usage', metrics.cpu, 100, 'linear-gradient(90deg, #FF4560 0%, #FF6B6B 100%)', '%')}
                              <div style={{
                                fontSize: '12px',
                                color: metrics.cpu < 1 ? '#10b981' : metrics.cpu < 50 ? '#f59e0b' : '#ef4444',
                                marginBottom: '12px',
                                fontWeight: '500'
                              }}>
                                {metrics.cpu < 1 ? 'Excellent (very low)' : metrics.cpu < 50 ? 'Moderate' : 'High: needs attention'}
                              </div>
                            </>
                          )}
                          {metrics.eventLoopLag && (
                            <>
                              {renderBarChart('Event Loop Lag', metrics.eventLoopLag, 10, 'linear-gradient(90deg, #775DD0 0%, #9B7FE8 100%)', ' ms')}
                              <div style={{
                                fontSize: '12px',
                                color: metrics.eventLoopLag < 10 ? '#10b981' : metrics.eventLoopLag < 50 ? '#f59e0b' : '#ef4444',
                                marginBottom: '12px',
                                fontWeight: '500'
                              }}>
                                {metrics.eventLoopLag < 10 ? 'Healthy (< 10ms)' : metrics.eventLoopLag < 50 ? 'Moderate' : 'High latency'}
                              </div>
                            </>
                          )}
                          
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                            gap: '12px',
                            marginTop: '16px',
                            paddingTop: '16px',
                            borderTop: '1px solid var(--border-primary)'
                          }}>
                            {metrics.cpu !== undefined && (
                              <div>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>CPU Usage</div>
                                <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>{metrics.cpu.toFixed(2)}%</div>
                              </div>
                            )}
                            {metrics.eventLoopLag && (
                              <div>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Event Loop Lag</div>
                                <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>{metrics.eventLoopLag.toFixed(2)} ms</div>
                              </div>
                            )}
                            {metrics.activeConnections && (
                              <div>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Active Connections</div>
                                <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>{metrics.activeConnections}</div>
                              </div>
                            )}
                            {metrics.throughput && (
                              <div>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Throughput</div>
                                <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>{metrics.throughput.toFixed(2)} req/s</div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Device Info */}
                    {data.contexts?.device && (
                      <div className={styles.detailSection}>
                        <h4 className={styles.detailSectionTitle}>Device Information</h4>
                        <div style={{
                          background: 'var(--bg-secondary)',
                          padding: '16px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-primary)',
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                          gap: '12px'
                        }}>
                          {data.contexts.device.cpu_description && (
                            <div>
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>CPU</div>
                              <div style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{data.contexts.device.cpu_description}</div>
                            </div>
                          )}
                          {data.contexts.device.processor_count && (
                            <div>
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Cores</div>
                              <div style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{data.contexts.device.processor_count}</div>
                            </div>
                          )}
                          {data.contexts.device.memory_size && (
                            <div>
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Total Memory</div>
                              <div style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{formatBytes(data.contexts.device.memory_size)}</div>
                            </div>
                          )}
                          {data.contexts.device.free_memory && (
                            <div>
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Free Memory</div>
                              <div style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{formatBytes(data.contexts.device.free_memory)}</div>
                            </div>
                          )}
                          {data.contexts.device.arch && (
                            <div>
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Architecture</div>
                              <div style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{data.contexts.device.arch}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Performance Summary */}
                    <div className={styles.detailSection}>
                      <h4 className={styles.detailSectionTitle}>Performance Summary</h4>
                      <div style={{
                        background: 'var(--bg-secondary)',
                        padding: '20px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-primary)'
                      }}>
                        <div style={{
                          fontSize: '18px',
                          fontWeight: 'bold',
                          marginBottom: '12px',
                          color: 'var(--text-primary)'
                        }}>
                          Overall Assessment
                        </div>
                        <div style={{
                          fontSize: '14px',
                          lineHeight: '1.6',
                          color: 'var(--text-secondary)'
                        }}>
                          {metrics.cpu !== undefined && metrics.eventLoopLag ? (
                            metrics.cpu < 1 && metrics.eventLoopLag < 10 ? (
                              <div style={{ color: '#10b981', fontWeight: '600' }}>
                                Excellent: system is performing optimally
                              </div>
                            ) : metrics.cpu < 5 && metrics.eventLoopLag < 50 ? (
                              <div style={{ color: '#f59e0b', fontWeight: '600' }}>
                                Good: system is performing well
                              </div>
                            ) : (
                              <div style={{ color: '#ef4444', fontWeight: '600' }}>
                                Needs attention: consider optimization
                              </div>
                            )
                          ) : (
                            <div>Performance metrics available. Review individual sections above for details.</div>
                          )}
                        </div>
                        <div style={{
                          marginTop: '16px',
                          paddingTop: '16px',
                          borderTop: '1px solid var(--border-primary)',
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                          gap: '12px'
                        }}>
                          <div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Transaction Duration</div>
                            <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>{formatDuration(duration)}</div>
                          </div>
                          {data.spans && (
                            <div>
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Spans</div>
                              <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>{data.spans.length}</div>
                            </div>
                          )}
                          {data.server_name && (
                            <div>
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Server</div>
                              <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>{data.server_name}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </>
          )}

          {activeTab === 'raw' && (
            <div className={styles.detailSection}>
              <div className={styles.rawHeaderWithCopy}>
                <h4 className={styles.detailSectionTitle}>Raw Event Data</h4>
                <button 
                  onClick={() => copyToClipboard(JSON.stringify(data, null, 2))}
                  className={styles.copyButton}
                >
                  Copy JSON
                </button>
              </div>
              <pre className={styles.codeBlock}>
                {JSON.stringify(data, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (!user) return null;

  return (
    <>
      <Head>
        <title>{`${unresolvedCount > 0 ? `(${unresolvedCount}) ` : ''}Dashboard - Sentry Monitor`}</title>
      </Head>
      
      <div className={styles.container}>
        {/* Left Navigation Sidebar */}
        <nav className={styles.navSidebar} aria-label="Primary">
          <Link href="/projects" style={{ textDecoration: 'none' }} aria-label="Projects">
            <div
              className={`${styles.navItem} ${router.pathname === '/projects' ? styles.navItemActive : ''}`}
              title="Projects"
            >
              <Icon name="folder" size={18} />
              <div className={styles.navItemTooltip}>Projects</div>
            </div>
          </Link>
          <Link href="/dashboard" style={{ textDecoration: 'none' }} aria-label="Global Dashboard">

            <div 
              className={`${styles.navItem} ${router.pathname === '/dashboard' && !selectedProject ? styles.navItemActive : ''}`}
              title="Global Dashboard"
            >
              <Icon name="dashboard" size={18} />
              <div className={styles.navItemTooltip}>Global Dashboard</div>
            </div>
          </Link>
          <Link href="/performance" style={{ textDecoration: 'none' }} aria-label="Performance">
            <div 
              className={`${styles.navItem} ${router.pathname === '/performance' ? styles.navItemActive : ''}`}
              title="Performance"
            >
              <Icon name="activity" size={18} />
              <div className={styles.navItemTooltip}>Performance</div>
            </div>
          </Link>
          <Link href="/monitors" style={{ textDecoration: 'none' }}>
            <div 
              className={`${styles.navItem} ${router.pathname === '/monitors' ? styles.navItemActive : ''}`}
              title="Cron monitors"
            >
              <Icon name="clock" size={18} />
              <div className={styles.navItemTooltip}>Monitors</div>
            </div>
          </Link>
          
          <div className={styles.navDivider}></div>

          {/* Project Selector (Discord-like) */}
          <div 
            className={`${styles.navProjectItem} ${selectedProject === null ? styles.navProjectItemActive : ''}`}
            onClick={() => setSelectedProject(null)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedProject(null); } }}
            role="button"
            tabIndex={0}
            aria-pressed={selectedProject === null}
            aria-label="All projects"
            title="All Projects"
          >
            ALL
            <div className={styles.navItemTooltip}>All Projects</div>
          </div>

          {projects.map(project => (
            <div 
              key={project.id}
              className={`${styles.navProjectItem} ${selectedProject === project.id ? styles.navProjectItemActive : ''}`}
              onClick={() => setSelectedProject(project.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedProject(project.id); } }}
              role="button"
              tabIndex={0}
              aria-pressed={selectedProject === project.id}
              aria-label={`Project ${project.name}`}
              title={project.name}
            >
              {project.name.substring(0, 2).toUpperCase()}
              {project._count.issues > 0 && (
                <span className={styles.projectBadge}>{project._count.issues}</span>
              )}
              <div className={styles.navItemTooltip}>{project.name}</div>
            </div>
          ))}

          <button 
            className={styles.navProjectItem}
            onClick={() => setShowNewProjectModal(true)}
            aria-label="Create new project"
            title="Create New Project"
            style={{ color: 'var(--text-secondary)' }}
          >
            <Icon name="plus" size={18} />
            <div className={styles.navItemTooltip}>Create New Project</div>
          </button>

          <div className={styles.navDivider}></div>

          {user.isAdmin && (
            <Link href="/admin" style={{ textDecoration: 'none' }} aria-label="Admin settings">
              <div 
                className={`${styles.navItem} ${router.pathname === '/admin' ? styles.navItemActive : ''}`}
                title="Admin"
              >
                <Icon name="settings" size={18} />
                <div className={styles.navItemTooltip}>Admin Settings</div>
              </div>
            </Link>
          )}
          
          <Link href="/profile" style={{ textDecoration: 'none' }} aria-label="Your profile">
            <div 
              className={`${styles.navItem} ${router.pathname === '/profile' ? styles.navItemActive : ''}`}
              title="Profile"
            >
              <Icon name="user" size={18} />
              <div className={styles.navItemTooltip}>Your Profile</div>
            </div>
          </Link>
          
          <button 
            className={styles.navItem}
            onClick={handleLogout}
            aria-label="Log out"
            title="Logout"
          >
            <Icon name="logout" size={18} />
            <div className={styles.navItemTooltip}>Logout</div>
          </button>
        </nav>

        <div className={styles.main}>
          <header className={styles.header}>
            <div className={styles.headerContent}>
              <h1 className={styles.logo}>
                <span className={styles.logoIcon}><Icon name="bolt" size={16} strokeWidth={2} /></span>
                Sentry Monitor
              </h1>
              <div className={styles.headerActions}>
                <button 
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  className={styles.headerButton}
                  title={autoRefresh ? 'Pause auto-refresh' : 'Resume auto-refresh'}
                >
                  <span className={autoRefresh ? styles.liveDot : undefined}>{autoRefresh ? '●' : '○'}</span> {autoRefresh ? 'Live' : 'Paused'}
                </button>
                <button 
                  onClick={handleDeduplicate}
                  className={styles.headerButton}
                  disabled={isDeduplicating}
                  title="Find duplicate issues"
                  aria-label="Find duplicate issues"
                >
                  <Icon name="merge" size={16} />
                </button>
                <button 
                  onClick={() => fetchData()} 
                  className={styles.headerButton}
                  title={lastUpdated ? `Refresh data (updated ${lastUpdated.toLocaleTimeString()})` : 'Refresh data'}
                  aria-label="Refresh data"
                  disabled={refreshing}
                >
                  <span className={refreshing ? styles.spinning : styles.iconWrap}><Icon name="refresh" size={16} /></span>
                </button>
                <ThemeToggle />
                <span className={styles.userEmail}>{user.email}</span>
              </div>
            </div>
          </header>

          <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            {!sidebarCollapsed && (
              <aside className={styles.sidebar}>
                <div className={styles.sidebarSection}>
                  <div className={styles.sidebarHeader}>
                    <h3 className={styles.sidebarTitle}>Current View</h3>
                  </div>
                  <div style={{ padding: 'var(--space-2) var(--space-4)' }}>
                    <div style={{ 
                      background: 'var(--bg-tertiary)', 
                      padding: 'var(--space-2) var(--space-3)', 
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--accent-primary)',
                      fontWeight: 'var(--weight-bold)',
                      fontSize: 'var(--font-sm)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-2)'
                    }}>
                      <Icon name={selectedProject ? 'inbox' : 'dashboard'} size={16} />
                      {selectedProject ? projects.find(p => p.id === selectedProject)?.name : 'All Projects'}
                    </div>
                  </div>
                  {selectedProject && (
                    <div style={{ padding: '0 var(--space-4) var(--space-2)' }}>
                      <Link 
                        href={`/project/${selectedProject}`}
                        className={styles.projectSettingsButton}
                        style={{ width: '100%', justifyContent: 'center' }}
                      >
                        <Icon name="settings" size={14} /> Project Settings
                      </Link>
                    </div>
                  )}
                </div>

                <div className={styles.sidebarSection}>
                  <div className={styles.sidebarHeader}>
                    <h3 className={styles.sidebarTitle}>Issues</h3>
                  </div>
                  <div className={styles.projectsList}>
                    <button
                      onClick={() => setFilterStatus('all')}
                      className={`${styles.projectItem} ${filterStatus === 'all' ? styles.projectItemActive : ''}`}
                    >
                      <span>All Issues</span>
                    </button>
                    <button
                      onClick={() => setFilterStatus('active')}
                      className={`${styles.projectItem} ${filterStatus === 'active' ? styles.projectItemActive : ''}`}
                    >
                      <span>Active</span>
                    </button>
                    <button
                      onClick={() => setFilterStatus('resolved')}
                      className={`${styles.projectItem} ${filterStatus === 'resolved' ? styles.projectItemActive : ''}`}
                    >
                      <span>Resolved</span>
                    </button>
                    <button
                      onClick={() => setFilterStatus('ignored')}
                      className={`${styles.projectItem} ${filterStatus === 'ignored' ? styles.projectItemActive : ''}`}
                    >
                      <span>Ignored</span>
                    </button>
                  </div>
                </div>

                <div className={styles.sidebarSection}>
                  <div className={styles.sidebarHeader}>
                    <h3 className={styles.sidebarTitle}>Level</h3>
                  </div>
                  <div className={styles.projectsList}>
                    <button
                      onClick={() => setFilterLevel('all')}
                      className={`${styles.projectItem} ${filterLevel === 'all' ? styles.projectItemActive : ''}`}
                    >
                      <span>All Levels</span>
                    </button>
                    <button
                      onClick={() => setFilterLevel('error')}
                      className={`${styles.projectItem} ${filterLevel === 'error' ? styles.projectItemActive : ''}`}
                    >
                      <span className={styles.levelDot} style={{ backgroundColor: 'var(--error)' }}></span>
                      <span>Error</span>
                    </button>
                    <button
                      onClick={() => setFilterLevel('warning')}
                      className={`${styles.projectItem} ${filterLevel === 'warning' ? styles.projectItemActive : ''}`}
                    >
                      <span className={styles.levelDot} style={{ backgroundColor: 'var(--warning)' }}></span>
                      <span>Warning</span>
                    </button>
                    <button
                      onClick={() => setFilterLevel('info')}
                      className={`${styles.projectItem} ${filterLevel === 'info' ? styles.projectItemActive : ''}`}
                    >
                      <span className={styles.levelDot} style={{ backgroundColor: 'var(--info)' }}></span>
                      <span>Info</span>
                    </button>
                  </div>
                </div>

                <div className={styles.sidebarSection}>
                  <div className={styles.sidebarHeader}>
                    <h3 className={styles.sidebarTitle}>Tools</h3>
                  </div>
                  <div className={styles.projectsList}>
                    <label className={styles.sidebarField}>
                      <span>Refresh every</span>
                      <select
                        className={styles.filterSelect}
                        value={refreshInterval}
                        onChange={(e) => setRefreshInterval(parseInt(e.target.value))}
                      >
                        <option value={5000}>5 seconds</option>
                        <option value={15000}>15 seconds</option>
                        <option value={30000}>30 seconds</option>
                        <option value={60000}>1 minute</option>
                      </select>
                    </label>
                    <button onClick={toggleDesktopAlerts} className={`${styles.projectItem} ${desktopAlerts ? styles.projectItemActive : ''}`}>
                      <span className={styles.iconLabel}><Icon name="bell" size={14} /> Desktop alerts {desktopAlerts ? 'on' : 'off'}</span>
                    </button>
                    <button onClick={() => handleExport('csv')} className={styles.projectItem}>
                      <span className={styles.iconLabel}><Icon name="download" size={14} /> Export CSV</span>
                    </button>
                    <button onClick={() => handleExport('json')} className={styles.projectItem}>
                      <span className={styles.iconLabel}><Icon name="download" size={14} /> Export JSON</span>
                    </button>
                    <button onClick={() => setShowShortcuts(true)} className={styles.projectItem}>
                      <span className={styles.iconLabel}><Icon name="keyboard" size={14} /> Keyboard shortcuts</span>
                    </button>
                  </div>
                </div>
              </aside>
            )}

            <div className={styles.contentWrapper}>
            {/* Sidebar toggle button */}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className={styles.sidebarToggle}
              aria-label={sidebarCollapsed ? 'Show filters' : 'Hide filters'}
              title={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
            >

              
              <Icon name={sidebarCollapsed ? 'chevronRight' : 'chevronLeft'} size={14} strokeWidth={2} />
            </button>

            <div className={`${styles.content} ${selectedEvent ? styles.contentDetailOpen : ''}`}>
            <div className={styles.eventsList}>
              <div className={styles.eventsHeader}>
                {isSelectionMode && (
                  <div className={styles.selectionToolbar}>
                    <div className={styles.selectionToolbarLeft}>
                      <input
                        type="checkbox"
                        checked={selectedEvents.length === filteredIssues.length && filteredIssues.length > 0}
                        onChange={toggleSelectAll}
                        className={styles.checkbox}
                      />
                      <span className={styles.selectionCount}>
                        {selectedEvents.length} selected
                      </span>
                    </div>
                    <div className={styles.selectionToolbarRight}>
                      <button
                        onClick={startMerge}
                        disabled={selectedEvents.length < 2}
                        className={styles.cancelSelectionButton}
                        title="Merge the selected issues into one"
                      >
                        <Icon name="merge" size={13} /> Merge
                      </button>
                      <button
                        onClick={() => handleBulkStatus('RESOLVED')}
                        disabled={selectedEvents.length === 0}
                        className={styles.cancelSelectionButton}
                      >
                        <Icon name="check" size={13} /> Resolve
                      </button>
                      <button
                        onClick={() => handleBulkStatus('IGNORED')}
                        disabled={selectedEvents.length === 0}
                        className={styles.cancelSelectionButton}
                      >
                        <Icon name="eyeOff" size={13} /> Ignore
                      </button>
                      <button
                        onClick={() => {
                          setDeletingIssue({ bulk: true, count: selectedEvents.length });
                          setShowDeleteConfirm(true);
                        }}
                        disabled={selectedEvents.length === 0}
                        className={styles.bulkDeleteButton}
                      >
                        <Icon name="trash" size={13} /> Delete ({selectedEvents.length})
                      </button>
                      <button
                        onClick={exitSelectionMode}
                        className={styles.cancelSelectionButton}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
                <input
                  ref={searchInputRef}
                  type="search"
                  placeholder="Search issues…  ( / )"
                  aria-label="Search issues"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={styles.searchInput}
                />
                <div className={styles.filterToolbar} style={{ marginTop: 'var(--space-2)' }}>
                  <select className={styles.filterSelect} value={sortBy} onChange={(e) => setSortBy(e.target.value)} aria-label="Sort issues">
                    {Object.entries(SORT_OPTIONS).map(([value, label]) => (
                      <option key={value} value={value}>Sort: {label}</option>
                    ))}
                  </select>
                  <select className={styles.filterSelect} value={timeRange} onChange={(e) => setTimeRange(e.target.value)} aria-label="Time range">
                    {Object.entries(TIME_RANGES).map(([value, r]) => (
                      <option key={value} value={value}>{r.label}</option>
                    ))}
                  </select>
                  {(origins.length > 1 || filterOrigin !== 'all') && (
                    <select className={styles.filterSelect} value={filterOrigin} onChange={(e) => setFilterOrigin(e.target.value)} aria-label="Source host">
                      <option value="all">All sources</option>
                      {origins.map((o) => <option key={o.origin} value={o.origin}>From {o.origin} ({o.count})</option>)}
                      {filterOrigin !== 'all' && !origins.some((o) => o.origin === filterOrigin) && <option value={filterOrigin}>From {filterOrigin}</option>}
                    </select>
                  )}
                  <select className={styles.filterSelect} value={filterEventType} onChange={(e) => setFilterEventType(e.target.value)} aria-label="Event type">
                    <option value="all">All types</option>
                    <option value="ERROR">Errors</option>
                    <option value="CSP">CSP</option>
                    <option value="MINIDUMP">Minidumps</option>
                    <option value="TRANSACTION">Transactions</option>
                    <option value="MESSAGE">Messages</option>
                  </select>
                  {!isSelectionMode && (
                    <button onClick={() => setIsSelectionMode(true)} className={styles.selectButton}>
                      <Icon name="select" size={13} /> Select
                    </button>
                  )}
                </div>
                <div className={styles.resultsSummary} aria-live="polite">
                  <span>
                    {filteredIssues.length} shown
                    {issuesTotal > issues.length ? ` · ${issuesTotal} match on server` : ''}
                    {lastUpdated ? ` · updated ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                  </span>
                  {hasActiveFilters && (
                    <button onClick={clearFilters} className={styles.clearFilters}>Clear filters</button>
                  )}
                </div>
              </div>

              {loading ? (
                <IssueListSkeleton rows={9} />

              ) : projects.length === 0 ? (
                <div className={styles.empty}>
                  <div className={styles.emptyIcon}><Icon name="plus" size={36} strokeWidth={1.25} /></div>
                  <h3 className={styles.emptyTitle}>Get Started</h3>
                  <p className={styles.emptyText}>
                    Create your first project to start monitoring errors.
                  </p>
                  <button 
                    onClick={() => setShowNewProjectModal(true)}
                    className={styles.createButton}
                  >
                    Create Project
                  </button>
                </div>
              ) : filteredIssues.length === 0 ? (
                <div className={styles.empty}>
                  <div className={styles.emptyIcon}><Icon name="inbox" size={36} strokeWidth={1.25} /></div>
                  <h3 className={styles.emptyTitle}>
                    {issues.length === 0 ? 'No issues yet' : 'No matching issues'}
                  </h3>
                  <p className={styles.emptyText}>
                    {issues.length === 0 
                      ? 'Send your first error to see it appear here.'
                      : 'Try adjusting your search or filter criteria.'
                    }
                  </p>
                  {issues.length > 0 && hasActiveFilters && (
                    <button onClick={clearFilters} className={styles.createButton}>Clear filters</button>
                  )}
                </div>
              ) : (
                <>
                  <div className={styles.eventsContainer}>
                  {filteredIssues.map(issue => {
                    const type = issue.level;
                    const isSelected = selectedEvents.includes(issue.id);
                    return (
                      <div
                        key={issue.id}
                        onClick={() => (isSelectionMode ? toggleEventSelection(issue.id) : openItem(issue))}
                        onKeyDown={(e) => {
                          if (e.target !== e.currentTarget) return;
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            if (isSelectionMode) toggleEventSelection(issue.id); else openItem(issue);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                        data-item-id={issue.id}
                        aria-current={activeItemId === issue.id ? 'true' : undefined}
                        className={`${styles.eventCard} ${isSelected ? styles.eventCardSelected : ''} ${activeItemId === issue.id ? styles.eventCardActive : ''}`}
                      >
                        {isSelectionMode && (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleEventSelection(issue.id)}
                            className={styles.eventCheckbox}
                            onClick={(e) => e.stopPropagation()}
                          />
                        )}
                        <div className={styles.eventHeader}>
                          <span className={styles.eventLevel} style={{ color: levelColors(type).fg }}>
                            <span className={styles.levelMark} style={{ backgroundColor: levelColors(type).fg }} />
                            {String(type).toUpperCase()}
                          </span>
                          <span className={styles.eventProject}>{issue.project?.name || 'Unknown project'}</span>
                          {isNewSinceLastVisit(issue) && <span className={styles.newBadge}>New</span>}
                          {issue.regressedAt && issue.status === 'UNRESOLVED' && (
                            <span
                              className={styles.regressedBadge}
                              title={`Reopened ${new Date(issue.regressedAt).toLocaleString()} after it was resolved`}
                            >
                              Regressed
                            </span>
                          )}
                          {(() => {
                            const typeBadge = getEventTypeBadge(issue);
                            return typeBadge ? (
                              <span className={styles.eventTypeBadge} title={`${typeBadge.label} event`}>
                                {typeBadge.label}
                              </span>
                            ) : null;
                          })()}
                          <span
                            className={styles.eventTime}
                            title={`Last seen ${new Date(issue.lastSeen).toLocaleString()}`}
                          >
                            {formatDate(issue.lastSeen)}
                          </span>
                        </div>
                        <h4 className={styles.eventTitle}>{issue.title}</h4>
                        <div className={styles.eventMeta}>
                          <span className={`${styles.statusText} ${styles[`status${issue._isStandaloneEvent ? 'Active' : (issue.status || '').charAt(0) + (issue.status || '').slice(1).toLowerCase().replace(/_(.)/g, (m, c) => c.toUpperCase())}`] || ''}`}>
                            <span className={styles.statusDot} />
                            {issue._isStandaloneEvent ? String(issue.eventType || 'event').toLowerCase() : statusLabel(issue.status)}
                          </span>
                          {issue.count > 1 && (
                            <span className={styles.occurrenceBadge} title={`${issue.count} events in this issue`}>
                              <button
                                onClick={(e) => navigateToPreviousEvent(issue, e)}
                                className={styles.navButton}
                                title="Previous duplicate event"
                                aria-label="Previous event"
                              >
                                <Icon name="chevronLeft" size={12} strokeWidth={2.25} />
                              </button>
                              <span className={styles.eventCounter}>
                                {(issueEventIndices[issue.id] || 0) + 1}/{issue.count}
                              </span>
                              <button
                                onClick={(e) => navigateToNextEvent(issue, e)}
                                className={styles.navButton}
                                title="Next duplicate event"
                                aria-label="Next event"
                              >
                                <Icon name="chevronRight" size={12} strokeWidth={2.25} />
                              </button>
                            </span>
                          )}
                          {issue.githubIssueUrl && (
                            <span className={styles.githubBadge} title="GitHub issue exists">
                              <Icon name="github" size={13} />
                            </span>
                          )}
                          {!issue._isStandaloneEvent && issue.status !== 'RESOLVED' && issue.status !== 'IGNORED' && (
                            <span className={styles.quickActions}>
                              <button
                                className={styles.quickResolveButton}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleResolveIssue(issue);
                                }}
                                title="Resolve this issue (r)"
                              >
                                <Icon name="check" size={12} strokeWidth={2.25} /> Resolve
                              </button>
                              <button
                                className={styles.quickIgnoreButton}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleIgnoreIssue(issue);
                                }}
                                title="Ignore this issue: hides it and stops GitHub auto-reports (i)"
                              >
                                <Icon name="eyeOff" size={12} /> Ignore
                              </button>
                            </span>
                          )}
                          {!issue._isStandaloneEvent && (issue.status === 'RESOLVED' || issue.status === 'IGNORED') && (
                            <span className={styles.quickActions}>
                              <button
                                className={styles.quickResolveButton}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (issue.status === 'RESOLVED') handleResolveIssue(issue); else handleIgnoreIssue(issue);
                                }}
                              >
                                {issue.status === 'RESOLVED' ? 'Reopen' : 'Unignore'}
                              </button>
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {issues.length < issuesTotal && (
                    <button
                      onClick={loadMoreIssues}
                      disabled={loadingMore}
                      className={styles.loadMoreButton}
                    >
                      {loadingMore ? 'Loading…' : `Load more (${issues.length} of ${issuesTotal})`}
                    </button>
                  )}
                </div>
                </>
              )}
            </div>

            {renderEventDetail()}
            </div>
          </div>
        </div>
        </div>

        {/* New Project Modal */}
        {showNewProjectModal && (
          <div className={styles.modalOverlay} onClick={() => setShowNewProjectModal(false)}>
            <div className={styles.modal} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
              <h3 className={styles.modalTitle}>Create New Project</h3>
              <form onSubmit={handleCreateProject}>
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="Project name"
                  className={styles.modalInput}
                  required
                  autoFocus
                />
                <div className={styles.modalButtons}>
                  <button type="button" onClick={() => setShowNewProjectModal(false)} className={styles.modalButtonCancel}>
                    Cancel
                  </button>
                  <button type="submit" className={styles.modalButtonSubmit}>
                    Create
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (deletingIssue || deletingEvent) && (
          <div className={styles.modalOverlay} onClick={() => {
            setShowDeleteConfirm(false);
            setDeletingIssue(null);
            setDeletingEvent(null);
          }}>
            <div className={styles.modal} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
              <h3 className={styles.modalTitle}>
                {deletingIssue 
                  ? (deletingIssue.bulk ? 'Delete Multiple Issues' : 'Delete Issue')
                  : (deletingEvent?.bulk ? 'Delete Multiple Events' : 'Delete Event')
                }
              </h3>
              <p className={styles.modalText}>
                {deletingIssue 
                  ? (deletingIssue.bulk 
                      ? `Are you sure you want to delete ${deletingIssue.count} issue${deletingIssue.count > 1 ? 's' : ''}? This will also delete all associated events. This action cannot be undone.`
                      : `Are you sure you want to delete this issue? This will also delete ${deletingIssue.count || 1} associated event${(deletingIssue.count || 1) > 1 ? 's' : ''}. This action cannot be undone.`
                  )
                  : (deletingEvent?.bulk 
                      ? `Are you sure you want to delete ${deletingEvent.count} event${deletingEvent.count > 1 ? 's' : ''}? This action cannot be undone.`
                      : 'Are you sure you want to delete this event? This action cannot be undone.'
                  )
                }
              </p>
              {deletingIssue && !deletingIssue.bulk && (
                <div className={styles.modalEventPreview}>
                  <strong>{deletingIssue.title}</strong>
                  <br />
                  <span className={styles.modalEventMeta}>
                    {deletingIssue.project?.name || 'Unknown Project'} • {deletingIssue.count || 1} occurrence{(deletingIssue.count || 1) > 1 ? 's' : ''}
                  </span>
                </div>
              )}
              {!deletingIssue && deletingEvent && !deletingEvent.bulk && (
                <div className={styles.modalEventPreview}>
                  <strong>{getEventTitle(deletingEvent)}</strong>
                  <br />
                  <span className={styles.modalEventMeta}>
                    {deletingEvent.project?.name || 'Unknown Project'} • {new Date(deletingEvent.createdAt).toLocaleString()}
                  </span>
                </div>
              )}
              {deletingIssue?.bulk && (
                <div className={styles.modalEventPreview}>
                  <strong>You are about to delete {deletingIssue.count} issue{deletingIssue.count > 1 ? 's' : ''}</strong>
                </div>
              )}
              {!deletingIssue && deletingEvent?.bulk && (
                <div className={styles.modalEventPreview}>
                  <strong>You are about to delete {deletingEvent.count} event{deletingEvent.count > 1 ? 's' : ''}</strong>
                </div>
              )}
              <div className={styles.modalButtons}>
                <button 
                  type="button" 
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeletingIssue(null);
                    setDeletingEvent(null);
                  }} 
                  className={styles.modalButtonCancel}
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  onClick={deletingIssue 
                    ? (deletingIssue.bulk ? handleBulkDelete : handleDeleteIssue)
                    : (deletingEvent?.bulk ? handleBulkDelete : handleDeleteEvent)
                  }
                  className={styles.modalButtonDelete}
                >
                  Delete {deletingIssue 
                    ? (deletingIssue.bulk ? `${deletingIssue.count} Issue${deletingIssue.count > 1 ? 's' : ''}` : 'Issue')
                    : (deletingEvent?.bulk ? `${deletingEvent.count} Event${deletingEvent.count > 1 ? 's' : ''}` : 'Event')
                  }
                </button>
              </div>
            </div>
          </div>
        )}

        {/* GitHub Issue Modal */}
        {showGitHubModal && (
          <div className={styles.modalOverlay} onClick={() => setShowGitHubModal(false)}>
            <div className={styles.modal} role="dialog" aria-modal="true" style={{ maxWidth: '600px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
              <h3 className={styles.modalTitle}>Create GitHub Issue</h3>
              <p className={styles.modalText}>
                Copy the information below and create an issue on your GitHub repository.
              </p>
              
              <div className={styles.githubFormGroup}>
                <label className={styles.githubLabel}>Issue Title</label>
                <input
                  type="text"
                  value={githubIssueData.title}
                  onChange={(e) => setGithubIssueData({...githubIssueData, title: e.target.value})}
                  className={styles.modalInput}
                  placeholder="Issue title"
                />
              </div>
              
              <div className={styles.githubFormGroup}>
                <label className={styles.githubLabel}>Issue Body (Markdown)</label>
                <textarea
                  value={githubIssueData.body}
                  onChange={(e) => setGithubIssueData({...githubIssueData, body: e.target.value})}
                  className={styles.modalTextarea}
                  style={{ height: '300px' }}
                  placeholder="Issue description"
                />
              </div>
              
              <div className={styles.githubInstructions}>
                <strong>Instructions</strong>
                <ol className={styles.githubSteps}>
                  <li>Copy the title and body above</li>
                  <li>Go to your GitHub repository</li>
                  <li>Click &quot;Issues&quot; → &quot;New Issue&quot;</li>
                  <li>Paste the content and submit</li>
                </ol>
              </div>
              
              <div className={styles.modalButtons}>
                <button 
                  type="button" 
                  onClick={() => {
                    navigator.clipboard.writeText(`Title: ${githubIssueData.title}\n\n${githubIssueData.body}`);
                    showNotification('Copied to clipboard!', 'success');
                  }} 
                  className={styles.modalButtonSubmit}
                >
                  Copy all
                </button>
                <button 
                  type="button"
                  onClick={() => setShowGitHubModal(false)}
                  className={styles.modalButtonCancel}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Duplicate review */}
        {dupPreview && (
          <div className={styles.modalOverlay} onClick={() => setDupPreview(null)}>
            <div className={styles.modal} role="dialog" aria-modal="true" aria-label="Duplicate issues" style={{ maxWidth: '640px', width: '92%' }} onClick={(e) => e.stopPropagation()}>
              <h3 className={styles.modalTitle}>
                {dupPreview.groups.length > 0
                  ? `${dupPreview.groups.length} group${dupPreview.groups.length === 1 ? '' : 's'} of duplicate issues`
                  : 'Update issue grouping'}
              </h3>
              <p className={styles.modalText}>
                {dupPreview.groups.length > 0
                  ? 'Issues in a group have the same error signature. Merging keeps the oldest issue, moves every event and comment into it, and makes future events land there.'
                  : `${dupPreview.outdated} issue${dupPreview.outdated === 1 ? ' uses' : 's use'} an older grouping key. Applying refreshes it so new events group correctly.`}
              </p>
              <div className={styles.dupList}>
                {dupPreview.groups.map(group => (
                  <label key={`${group.projectId}-${group.primaryId}`} className={styles.dupGroup}>
                    <input
                      type="checkbox"
                      checked={dupSelected.includes(group.primaryId)}
                      onChange={() => setDupSelected(prev => prev.includes(group.primaryId) ? prev.filter(id => id !== group.primaryId) : [...prev, group.primaryId])}
                    />
                    <div className={styles.dupGroupBody}>
                      <div className={styles.dupGroupTitle}>{group.issues[0].title}</div>
                      <div className={styles.dupGroupMeta}>
                        {group.projectName} · {group.issues.length} issues · {group.issues.reduce((n, i) => n + i.count, 0)} events
                        {' · '}keeps #{group.primaryId}, merges {group.issues.slice(1).map(i => `#${i.id}`).join(', ')}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
              <div className={styles.modalButtons}>
                <button onClick={() => setDupPreview(null)} className={styles.modalButtonCancel}>Cancel</button>
                <button
                  onClick={applyDuplicates}
                  disabled={isDeduplicating || (dupPreview.groups.length > 0 && dupSelected.length === 0)}
                  className={styles.modalButtonSubmit}
                >
                  {isDeduplicating ? 'Merging…' : dupPreview.groups.length > 0 ? `Merge ${dupSelected.length} group${dupSelected.length === 1 ? '' : 's'}` : 'Apply'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Manual merge */}
        {mergeDraft && (
          <div className={styles.modalOverlay} onClick={() => setMergeDraft(null)}>
            <div className={styles.modal} role="dialog" aria-modal="true" aria-label="Merge issues" style={{ maxWidth: '560px', width: '92%' }} onClick={(e) => e.stopPropagation()}>
              <h3 className={styles.modalTitle}>Merge {mergeDraft.issues.length} issues</h3>
              <p className={styles.modalText}>
                Choose the issue to keep. The others are removed and their events, comments and counts move into it. Future events matching any of them land in the kept issue.
              </p>
              <div className={styles.dupList}>
                {mergeDraft.issues.map(issue => (
                  <label key={issue.id} className={styles.dupGroup}>
                    <input
                      type="radio"
                      name="merge-target"
                      checked={mergeDraft.targetId === issue.id}
                      onChange={() => setMergeDraft({ ...mergeDraft, targetId: issue.id })}
                    />
                    <div className={styles.dupGroupBody}>
                      <div className={styles.dupGroupTitle}>{issue.title}</div>
                      <div className={styles.dupGroupMeta}>
                        #{issue.id} · {issue.count} events · first seen {formatDate(issue.firstSeen)} · {statusLabel(issue.status)}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
              <div className={styles.modalButtons}>
                <button onClick={() => setMergeDraft(null)} className={styles.modalButtonCancel}>Cancel</button>
                <button onClick={confirmMerge} className={styles.modalButtonSubmit}>Merge into #{mergeDraft.targetId}</button>
              </div>
            </div>
          </div>
        )}

        {/* Keyboard shortcuts */}
        {showShortcuts && (
          <div className={styles.modalOverlay} onClick={() => setShowShortcuts(false)}>
            <div className={styles.modal} role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" onClick={(e) => e.stopPropagation()}>
              <h3 className={styles.modalTitle}>Keyboard shortcuts</h3>
              <ul className={styles.shortcutList}>
                <li><kbd className={styles.kbd}>j</kbd> / <kbd className={styles.kbd}>k</kbd><span>Next / previous issue</span></li>
                <li><kbd className={styles.kbd}>r</kbd><span>Resolve / reopen open issue</span></li>
                <li><kbd className={styles.kbd}>i</kbd><span>Ignore / unignore open issue</span></li>
                <li><kbd className={styles.kbd}>/</kbd><span>Focus search</span></li>
                <li><kbd className={styles.kbd}>Shift</kbd>+<kbd className={styles.kbd}>R</kbd><span>Refresh now</span></li>
                <li><kbd className={styles.kbd}>Esc</kbd><span>Close panel, dialog or selection</span></li>
                <li><kbd className={styles.kbd}>?</kbd><span>Show this help</span></li>
              </ul>
              <div className={styles.modalButtons}>
                <button onClick={() => setShowShortcuts(false)} className={styles.modalButtonCancel}>Close</button>
              </div>
            </div>
          </div>
        )}

        {/* Notification System */}
        <div className={styles.notificationContainer} role="status" aria-live="polite">
          {notifications.map((notification) => (
            <div 
              key={notification.id} 
              className={`${styles.notification} ${styles[`notification${notification.type.charAt(0).toUpperCase() + notification.type.slice(1)}`]}`}
            >
              <div className={styles.notificationContent}>
                <span className={styles.notificationIcon}>
                  <Icon name={notification.type === 'success' ? 'checkCircle' : notification.type === 'error' ? 'x' : notification.type === 'warning' ? 'alert' : 'info'} size={16} />
                </span>
                <span className={styles.notificationMessage}>{notification.message}</span>
                {notification.action && (
                  <button
                    className={styles.notificationAction}
                    onClick={() => {
                      notification.action.onClick();
                      removeNotification(notification.id);
                    }}
                  >
                    {notification.action.label}
                  </button>
                )}
              </div>
              <button 
                className={styles.notificationClose}
                onClick={() => removeNotification(notification.id)}
                aria-label="Close notification"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

