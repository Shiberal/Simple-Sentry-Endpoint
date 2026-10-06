import { useState, useEffect, useRef, useCallback } from 'react';
import Head from "next/head";
import { useRouter } from 'next/router';
import Link from 'next/link';
import ThemeToggle from '@/components/ThemeToggle';
import IssueListSkeleton from '@/components/dashboard/IssueListSkeleton';
import Icon from '@/components/Icon';
import { parseGitHubRepo } from '@/lib/github';
import { buildGitHubIssueBody, buildGitHubLabels } from '@/lib/github-issue-body';
import { getEventTypeBadge, getEventTitle } from '@/lib/event-display';
import usePersistedState from '@/hooks/usePersistedState';
import { statusLabel, levelColors, relativeTime, TIME_RANGES, SORT_OPTIONS, downloadIssues } from '@/lib/ui';
import EventDetail from '@/components/dashboard/EventDetail';
import shell from '@/styles/AppShell.module.css';
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


  // Initial load once the user is known (later changes go through filtersKey below)
  useEffect(() => {
    if (user) fetchData();
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
    
    const body = buildGitHubIssueBody({ event, issue, data });
    const labels = buildGitHubLabels(data);

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

  if (!user) return null;

  return (
    <>
      <Head>
        <title>{`${unresolvedCount > 0 ? `(${unresolvedCount}) ` : ''}Dashboard - Sentry Monitor`}</title>
      </Head>
      
      <div className={shell.container}>
        {/* Left Navigation Sidebar */}
        <nav className={shell.navSidebar} aria-label="Primary">
          <Link href="/projects" style={{ textDecoration: 'none' }} aria-label="Projects">
            <div
              className={`${shell.navItem} ${router.pathname === '/projects' ? shell.navItemActive : ''}`}
              title="Projects"
            >
              <Icon name="folder" size={18} />
              <div className={shell.navItemTooltip}>Projects</div>
            </div>
          </Link>
          <Link href="/dashboard" style={{ textDecoration: 'none' }} aria-label="Global Dashboard">

            <div 
              className={`${shell.navItem} ${router.pathname === '/dashboard' && !selectedProject ? shell.navItemActive : ''}`}
              title="Global Dashboard"
            >
              <Icon name="dashboard" size={18} />
              <div className={shell.navItemTooltip}>Global Dashboard</div>
            </div>
          </Link>
          <Link href="/performance" style={{ textDecoration: 'none' }} aria-label="Performance">
            <div 
              className={`${shell.navItem} ${router.pathname === '/performance' ? shell.navItemActive : ''}`}
              title="Performance"
            >
              <Icon name="activity" size={18} />
              <div className={shell.navItemTooltip}>Performance</div>
            </div>
          </Link>
          <Link href="/monitors" style={{ textDecoration: 'none' }}>
            <div 
              className={`${shell.navItem} ${router.pathname === '/monitors' ? shell.navItemActive : ''}`}
              title="Cron monitors"
            >
              <Icon name="clock" size={18} />
              <div className={shell.navItemTooltip}>Monitors</div>
            </div>
          </Link>
          
          <div className={shell.navDivider}></div>

          {/* Project Selector (Discord-like) */}
          <div 
            className={`${shell.navProjectItem} ${selectedProject === null ? shell.navProjectItemActive : ''}`}
            onClick={() => setSelectedProject(null)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedProject(null); } }}
            role="button"
            tabIndex={0}
            aria-pressed={selectedProject === null}
            aria-label="All projects"
            title="All Projects"
          >
            ALL
            <div className={shell.navItemTooltip}>All Projects</div>
          </div>

          {projects.map(project => (
            <div 
              key={project.id}
              className={`${shell.navProjectItem} ${selectedProject === project.id ? shell.navProjectItemActive : ''}`}
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
                <span className={shell.projectBadge}>{project._count.issues}</span>
              )}
              <div className={shell.navItemTooltip}>{project.name}</div>
            </div>
          ))}

          <button 
            className={shell.navProjectItem}
            onClick={() => setShowNewProjectModal(true)}
            aria-label="Create new project"
            title="Create New Project"
            style={{ color: 'var(--text-secondary)' }}
          >
            <Icon name="plus" size={18} />
            <div className={shell.navItemTooltip}>Create New Project</div>
          </button>

          <div className={shell.navDivider}></div>

          {user.isAdmin && (
            <Link href="/admin" style={{ textDecoration: 'none' }} aria-label="Admin settings">
              <div 
                className={`${shell.navItem} ${router.pathname === '/admin' ? shell.navItemActive : ''}`}
                title="Admin"
              >
                <Icon name="settings" size={18} />
                <div className={shell.navItemTooltip}>Admin Settings</div>
              </div>
            </Link>
          )}
          
          <Link href="/profile" style={{ textDecoration: 'none' }} aria-label="Your profile">
            <div 
              className={`${shell.navItem} ${router.pathname === '/profile' ? shell.navItemActive : ''}`}
              title="Profile"
            >
              <Icon name="user" size={18} />
              <div className={shell.navItemTooltip}>Your Profile</div>
            </div>
          </Link>
          
          <button 
            className={shell.navItem}
            onClick={handleLogout}
            aria-label="Log out"
            title="Logout"
          >
            <Icon name="logout" size={18} />
            <div className={shell.navItemTooltip}>Logout</div>
          </button>
        </nav>

        <div className={shell.main}>
          <header className={shell.header}>
            <div className={shell.headerContent}>
              <h1 className={shell.logo}>
                <span className={shell.logoIcon}><Icon name="bolt" size={16} strokeWidth={2} /></span>
                Sentry Monitor
              </h1>
              <div className={shell.headerActions}>
                <button 
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  className={shell.headerButton}
                  title={autoRefresh ? 'Pause auto-refresh' : 'Resume auto-refresh'}
                >
                  <span className={autoRefresh ? styles.liveDot : undefined}>{autoRefresh ? '●' : '○'}</span> {autoRefresh ? 'Live' : 'Paused'}
                </button>
                <button 
                  onClick={handleDeduplicate}
                  className={shell.headerButton}
                  disabled={isDeduplicating}
                  title="Find duplicate issues"
                  aria-label="Find duplicate issues"
                >
                  <Icon name="merge" size={16} />
                </button>
                <button 
                  onClick={() => fetchData()} 
                  className={shell.headerButton}
                  title={lastUpdated ? `Refresh data (updated ${lastUpdated.toLocaleTimeString()})` : 'Refresh data'}
                  aria-label="Refresh data"
                  disabled={refreshing}
                >
                  <span className={refreshing ? shell.spinning : shell.iconWrap}><Icon name="refresh" size={16} /></span>
                </button>
                <ThemeToggle />
                <span className={shell.userEmail}>{user.email}</span>
              </div>
            </div>
          </header>

          <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            {!sidebarCollapsed && (
              <aside className={shell.sidebar}>
                <div className={shell.sidebarSection}>
                  <div className={shell.sidebarHeader}>
                    <h3 className={shell.sidebarTitle}>Current View</h3>
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

                <div className={shell.sidebarSection}>
                  <div className={shell.sidebarHeader}>
                    <h3 className={shell.sidebarTitle}>Issues</h3>
                  </div>
                  <div className={shell.projectsList}>
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

                <div className={shell.sidebarSection}>
                  <div className={shell.sidebarHeader}>
                    <h3 className={shell.sidebarTitle}>Level</h3>
                  </div>
                  <div className={shell.projectsList}>
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

                <div className={shell.sidebarSection}>
                  <div className={shell.sidebarHeader}>
                    <h3 className={shell.sidebarTitle}>Tools</h3>
                  </div>
                  <div className={shell.projectsList}>
                    <label className={styles.sidebarField}>
                      <span>Refresh every</span>
                      <select
                        className={shell.filterSelect}
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

            <div className={`${shell.contentWrapper} ${styles.contentWrapper}`}>
            {/* Sidebar toggle button */}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className={`${shell.sidebarToggle} ${styles.sidebarToggle}`}
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
                  <select className={`${shell.filterSelect} ${styles.filterSelect}`} value={sortBy} onChange={(e) => setSortBy(e.target.value)} aria-label="Sort issues">
                    {Object.entries(SORT_OPTIONS).map(([value, label]) => (
                      <option key={value} value={value}>Sort: {label}</option>
                    ))}
                  </select>
                  <select className={`${shell.filterSelect} ${styles.filterSelect}`} value={timeRange} onChange={(e) => setTimeRange(e.target.value)} aria-label="Time range">
                    {Object.entries(TIME_RANGES).map(([value, r]) => (
                      <option key={value} value={value}>{r.label}</option>
                    ))}
                  </select>
                  {(origins.length > 1 || filterOrigin !== 'all') && (
                    <select className={`${shell.filterSelect} ${styles.filterSelect}`} value={filterOrigin} onChange={(e) => setFilterOrigin(e.target.value)} aria-label="Source host">
                      <option value="all">All sources</option>
                      {origins.map((o) => <option key={o.origin} value={o.origin}>From {o.origin} ({o.count})</option>)}
                      {filterOrigin !== 'all' && !origins.some((o) => o.origin === filterOrigin) && <option value={filterOrigin}>From {filterOrigin}</option>}
                    </select>
                  )}
                  <select className={`${shell.filterSelect} ${styles.filterSelect}`} value={filterEventType} onChange={(e) => setFilterEventType(e.target.value)} aria-label="Event type">
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
                <div className={shell.empty}>
                  <div className={shell.emptyIcon}><Icon name="plus" size={36} strokeWidth={1.25} /></div>
                  <h3 className={shell.emptyTitle}>Get Started</h3>
                  <p className={shell.emptyText}>
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
                <div className={shell.empty}>
                  <div className={shell.emptyIcon}><Icon name="inbox" size={36} strokeWidth={1.25} /></div>
                  <h3 className={shell.emptyTitle}>
                    {issues.length === 0 ? 'No issues yet' : 'No matching issues'}
                  </h3>
                  <p className={shell.emptyText}>
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

            <EventDetail
              activeTab={activeTab}
              closeDetail={closeDetail}
              copiedCode={copiedCode}
              copiedError={copiedError}
              copyIssueLink={copyIssueLink}
              copyToClipboard={copyToClipboard}
              handleCreateGitHubIssue={handleCreateGitHubIssue}
              handleIgnoreIssue={handleIgnoreIssue}
              handleResolveIssue={handleResolveIssue}
              issues={issues}
              prettifiedError={prettifiedError}
              prettifiedMessage={prettifiedMessage}
              selectedEvent={selectedEvent}
              setActiveTab={setActiveTab}
              setCopiedCode={setCopiedCode}
              setCopiedError={setCopiedError}
              setDeletingEvent={setDeletingEvent}
              setDeletingIssue={setDeletingIssue}
              setPrettifiedError={setPrettifiedError}
              setPrettifiedMessage={setPrettifiedMessage}
              setShowDeleteConfirm={setShowDeleteConfirm}
            />
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

