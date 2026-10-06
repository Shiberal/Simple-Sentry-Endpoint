import { useState, useEffect, useRef } from 'react';
import Head from "next/head";
import Router, { useRouter } from 'next/router';
import ThemeToggle from '@/components/ThemeToggle';
import Icon from '@/components/Icon';
import AppNav from '@/components/shared/AppNav';
import EventDetail from '@/components/dashboard/EventDetail';
import FilterSidebar from '@/components/dashboard/FilterSidebar';
import IssueToolbar from '@/components/dashboard/IssueToolbar';
import IssueList from '@/components/dashboard/IssueList';
import NotificationStack from '@/components/dashboard/NotificationStack';
import NewProjectModal from '@/components/dashboard/NewProjectModal';
import DeleteConfirmModal from '@/components/dashboard/DeleteConfirmModal';
import GitHubIssueModal from '@/components/dashboard/GitHubIssueModal';
import DuplicatesModal from '@/components/dashboard/DuplicatesModal';
import MergeModal from '@/components/dashboard/MergeModal';
import ShortcutsModal from '@/components/dashboard/ShortcutsModal';
import usePersistedState from '@/hooks/usePersistedState';
import useMediaQuery from '@/hooks/useMediaQuery';
import useMountEffect from '@/hooks/useMountEffect';
import useNotifications from '@/hooks/useNotifications';
import useIssuesFeed from '@/hooks/dashboard/useIssuesFeed';
import useIssueDetail from '@/hooks/dashboard/useIssueDetail';
import useIssueStatusActions from '@/hooks/dashboard/useIssueStatusActions';
import useIssueDeletion from '@/hooks/dashboard/useIssueDeletion';
import useDuplicateMerge from '@/hooks/dashboard/useDuplicateMerge';
import useGitHubIssue from '@/hooks/dashboard/useGitHubIssue';
import { combineItems, filterItems } from '@/lib/issue-list';
import { statusLabel, downloadIssues } from '@/lib/ui';
import shell from '@/styles/AppShell.module.css';
import styles from '@/styles/Dashboard.module.css';

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [selectedProject, setSelectedProject] = usePersistedState('sm.project', null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = usePersistedState('sm.refreshMs', 5000);
  const [sortBy, setSortBy] = usePersistedState('sm.sortBy', 'lastSeen');
  const [timeRange, setTimeRange] = usePersistedState('sm.timeRange', 'all');
  const [desktopAlerts, setDesktopAlerts] = usePersistedState('sm.desktopAlerts', false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const searchInputRef = useRef(null);
  const lastVisitRef = useRef(null);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLevel, setFilterLevel] = usePersistedState('sm.filterLevel', 'error');
  const [filterStatus, setFilterStatus] = usePersistedState('sm.filterStatus', 'active'); // 'all', 'active' (not resolved/ignored), 'unresolved', 'resolved', 'ignored', 'in_progress'
  const [filterOrigin, setFilterOrigin] = useState('all'); // host events came from
  const [filterEventType, setFilterEventType] = usePersistedState('sm.filterType', 'all'); // 'all', 'ERROR', 'CSP', 'MINIDUMP', 'TRANSACTION', 'MESSAGE'
  // Filter sidebar: starts closed on phone-sized screens until the user toggles it
  const isPhone = useMediaQuery('(max-width: 768px)');
  const [sidebarChoice, setSidebarChoice] = useState(null);
  const sidebarCollapsed = sidebarChoice ?? isPhone;
  const [selectedEvents, setSelectedEvents] = useState([]); // ids ticked in selection mode
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  const { notifications, showNotification, removeNotification } = useNotifications();

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/me');
      const data = await response.json();
      if (!data?.user) {
        Router.push('/login');
        return;
      }
      setUser(data.user);
    } catch (error) {
      Router.push('/login');
    }
  };
  useMountEffect(checkAuth);

  useEffect(() => {
    if (!router.isReady || !router.query.projectId) return;

    const projectId = parseInt(router.query.projectId, 10);
    if (!isNaN(projectId)) {
      setSelectedProject(projectId);
    }
  }, [router.isReady, router.query.projectId, setSelectedProject]);

  const {
    issues, setIssues, standaloneEvents, projects, issuesTotal, loading, loadingMore, refreshing,
    lastUpdated, origins, fetchData, loadMoreIssues,
  } = useIssuesFeed({
    user, selectedProject, sortBy, filterStatus, filterLevel, filterOrigin, setFilterOrigin,
    searchQuery, autoRefresh, refreshInterval, desktopAlerts, showNotification,
  });

  const {
    selectedEvent, setSelectedEvent, activeTab, setActiveTab, activeItemId, issueEventIndices,
    openItem, closeDetail, navigateToPreviousEvent, navigateToNextEvent,
  } = useIssueDetail({ router, user });

  const exitSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedEvents([]);
  };

  const { handleResolveIssue, handleIgnoreIssue } = useIssueStatusActions({
    setIssues, selectedEvent, setSelectedEvent, fetchData, showNotification,
  });

  const {
    showDeleteConfirm, setShowDeleteConfirm, deletingIssue, setDeletingIssue, deletingEvent, setDeletingEvent,
    cancelDelete, handleDeleteIssue, handleDeleteEvent, handleBulkDelete,
  } = useIssueDeletion({
    selectedEvent, setSelectedEvent, selectedIds: selectedEvents, clearSelection: exitSelectionMode, fetchData, showNotification,
  });

  const {
    isDeduplicating, dupPreview, setDupPreview, dupSelected, setDupSelected, mergeDraft, setMergeDraft,
    handleDeduplicate, applyDuplicates, startMerge, confirmMerge,
  } = useDuplicateMerge({
    projects, selectedProject, issues, selectedIds: selectedEvents, selectedEvent, closeDetail, exitSelectionMode, fetchData, showNotification,
  });

  const { showGitHubModal, setShowGitHubModal, githubIssueData, setGithubIssueData, handleCreateGitHubIssue } =
    useGitHubIssue({ setIssues, showNotification });

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
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

  const toggleEventSelection = (issueId) => {
    setSelectedEvents(prev =>
      prev.includes(issueId)
        ? prev.filter(id => id !== issueId)
        : [...prev, issueId]
    );
  };

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

  const filteredIssues = filterItems(combineItems(issues, standaloneEvents, sortBy), {
    searchQuery, filterLevel, filterStatus, filterEventType, timeRange,
  });

  const toggleSelectAll = () => {
    if (selectedEvents.length === filteredIssues.length) {
      setSelectedEvents([]);
    } else {
      setSelectedEvents(filteredIssues.map(e => e.id));
    }
  };

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
        else if (showDeleteConfirm) cancelDelete();
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
        <AppNav active={selectedProject ? undefined : 'dashboard'} isAdmin={user.isAdmin} onLogout={handleLogout}>
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
        </AppNav>

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
              <FilterSidebar
                selectedProject={selectedProject}
                projects={projects}
                filterStatus={filterStatus}
                setFilterStatus={setFilterStatus}
                filterLevel={filterLevel}
                setFilterLevel={setFilterLevel}
                refreshInterval={refreshInterval}
                setRefreshInterval={setRefreshInterval}
                desktopAlerts={desktopAlerts}
                onToggleDesktopAlerts={toggleDesktopAlerts}
                onExport={handleExport}
                onShowShortcuts={() => setShowShortcuts(true)}
              />
            )}

            <div className={`${shell.contentWrapper} ${styles.contentWrapper}`}>
            {/* Sidebar toggle button */}
            <button
              onClick={() => setSidebarChoice(!sidebarCollapsed)}
              className={`${shell.sidebarToggle} ${styles.sidebarToggle}`}
              aria-label={sidebarCollapsed ? 'Show filters' : 'Hide filters'}
              title={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
            >
              <Icon name={sidebarCollapsed ? 'chevronRight' : 'chevronLeft'} size={14} strokeWidth={2} />
            </button>

            <div className={`${styles.content} ${selectedEvent ? styles.contentDetailOpen : ''}`}>
              <div className={styles.eventsList}>
                <IssueToolbar
                  isSelectionMode={isSelectionMode}
                  setIsSelectionMode={setIsSelectionMode}
                  selectedCount={selectedEvents.length}
                  allSelected={selectedEvents.length === filteredIssues.length && filteredIssues.length > 0}
                  onToggleSelectAll={toggleSelectAll}
                  onMerge={startMerge}
                  onBulkStatus={handleBulkStatus}
                  onBulkDelete={() => {
                    setDeletingIssue({ bulk: true, count: selectedEvents.length });
                    setShowDeleteConfirm(true);
                  }}
                  onExitSelection={exitSelectionMode}
                  searchInputRef={searchInputRef}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  sortBy={sortBy}
                  setSortBy={setSortBy}
                  timeRange={timeRange}
                  setTimeRange={setTimeRange}
                  origins={origins}
                  filterOrigin={filterOrigin}
                  setFilterOrigin={setFilterOrigin}
                  filterEventType={filterEventType}
                  setFilterEventType={setFilterEventType}
                  shownCount={filteredIssues.length}
                  loadedCount={issues.length}
                  issuesTotal={issuesTotal}
                  lastUpdated={lastUpdated}
                  hasActiveFilters={hasActiveFilters}
                  onClearFilters={clearFilters}
                />

                <IssueList
                  loading={loading}
                  hasProjects={projects.length > 0}
                    filteredIssues={filteredIssues}
                  issuesTotal={issuesTotal}
                  loadingMore={loadingMore}
                  hasActiveFilters={hasActiveFilters}
                  onClearFilters={clearFilters}
                  onCreateProject={() => setShowNewProjectModal(true)}
                  selectedIds={selectedEvents}
                  isSelectionMode={isSelectionMode}
                  onToggleSelect={toggleEventSelection}
                  onOpen={openItem}
                  activeItemId={activeItemId}
                  isNewSinceLastVisit={isNewSinceLastVisit}
                  issueEventIndices={issueEventIndices}
                  onPrevEvent={navigateToPreviousEvent}
                  onNextEvent={navigateToNextEvent}
                  onResolve={handleResolveIssue}
                  onIgnore={handleIgnoreIssue}
                  onLoadMore={loadMoreIssues}
                />
              </div>

              <EventDetail
                key={selectedEvent?.id ?? 'none'}
                activeTab={activeTab}
                closeDetail={closeDetail}
                copyIssueLink={copyIssueLink}
                copyToClipboard={copyToClipboard}
                handleCreateGitHubIssue={handleCreateGitHubIssue}
                handleIgnoreIssue={handleIgnoreIssue}
                handleResolveIssue={handleResolveIssue}
                selectedEvent={selectedEvent}
                setActiveTab={setActiveTab}
                setDeletingEvent={setDeletingEvent}
                setDeletingIssue={setDeletingIssue}
                setShowDeleteConfirm={setShowDeleteConfirm}
              />
            </div>
          </div>
        </div>
        </div>

        {showNewProjectModal && (
          <NewProjectModal
            name={newProjectName}
            setName={setNewProjectName}
            onSubmit={handleCreateProject}
            onClose={() => setShowNewProjectModal(false)}
          />
        )}

        {showDeleteConfirm && (deletingIssue || deletingEvent) && (
          <DeleteConfirmModal
            deletingIssue={deletingIssue}
            deletingEvent={deletingEvent}
            onCancel={cancelDelete}
            onConfirmIssue={handleDeleteIssue}
            onConfirmEvent={handleDeleteEvent}
            onConfirmBulk={handleBulkDelete}
          />
        )}

        {showGitHubModal && (
          <GitHubIssueModal
            data={githubIssueData}
            setData={setGithubIssueData}
            onCopy={() => {
              navigator.clipboard.writeText(`Title: ${githubIssueData.title}\n\n${githubIssueData.body}`);
              showNotification('Copied to clipboard!', 'success');
            }}
            onClose={() => setShowGitHubModal(false)}
          />
        )}

        {dupPreview && (
          <DuplicatesModal
            preview={dupPreview}
            selected={dupSelected}
            setSelected={setDupSelected}
            busy={isDeduplicating}
            onApply={applyDuplicates}
            onClose={() => setDupPreview(null)}
          />
        )}

        {mergeDraft && (
          <MergeModal
            draft={mergeDraft}
            setDraft={setMergeDraft}
            onConfirm={confirmMerge}
            onClose={() => setMergeDraft(null)}
          />
        )}

        {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}

        <NotificationStack notifications={notifications} onDismiss={removeNotification} />
      </div>
    </>
  );
}
