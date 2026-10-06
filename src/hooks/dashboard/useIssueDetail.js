import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * The open issue/event in the detail panel: opening, cycling through an issue's events,
 * the ?issue= deep link and the phone back-button behaviour.
 */
export default function useIssueDetail({ router, user }) {
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [issueEventIndices, setIssueEventIndices] = useState({}); // current event index per issue
  const detailPushedRef = useRef(false);
  const deepLinkHandledRef = useRef(false);
  const deepLinkPendingRef = useRef(false);

  const fetchIssue = useCallback(async (id) => {
    try {
      const response = await fetch(`/api/issues/${id}`);
      const data = await response.json();
      return data.success ? data.issue : null;
    } catch (error) {
      console.error('Error fetching issue details:', error);
      return null;
    }
  }, []);

  // Show an issue's first event; `summary` is the list row (or just { id }) the panel was opened from
  const showFirstEvent = useCallback((summary, issue) => {
    if (issue?.events?.length > 0) {
      setSelectedEvent({ ...issue.events[0], issue: summary.title ? summary : issue });
      setActiveTab('overview');
    }
  }, []);

  // Open an issue (or standalone event) in the detail panel
  const openItem = useCallback(async (item) => {
    if (item._isStandaloneEvent) {
      setSelectedEvent(item._event);
      setActiveTab('overview');
      return;
    }
    showFirstEvent(item, await fetchIssue(item.id));
  }, [fetchIssue, showFirstEvent]);

  const closeDetail = () => {
    setSelectedEvent(null);
    setActiveTab('overview');
  };

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

  const stepEvent = async (issue, e, step) => {
    e.stopPropagation();
    if (!issue || issue.count <= 1) return;
    const currentIndex = issueEventIndices[issue.id] || 0;
    const newIndex = (currentIndex + step + issue.count) % issue.count;
    setIssueEventIndices(prev => ({ ...prev, [issue.id]: newIndex }));
    await showEventAtIndex(issue, newIndex);
  };

  const navigateToPreviousEvent = (issue, e) => stepEvent(issue, e, -1);
  const navigateToNextEvent = (issue, e) => stepEvent(issue, e, 1);

  // Deep link: /dashboard?issue=123 opens that issue, and the URL follows the open issue
  useEffect(() => {
    if (!router.isReady || !user) return;
    const issueParam = router.query.issue;
    if (!deepLinkHandledRef.current) {
      deepLinkHandledRef.current = true;
      if (issueParam) {
        deepLinkPendingRef.current = true;
        const id = parseInt(issueParam);
        fetchIssue(id).then((issue) => showFirstEvent({ id }, issue)).finally(() => { deepLinkPendingRef.current = false; });
        return;
      }
    }
    if (deepLinkPendingRef.current) return;
    const openId = selectedEvent?.issue?.id ? String(selectedEvent.issue.id) : null;
    if ((issueParam || null) === openId) return;
    const query = { ...router.query };
    if (openId) query.issue = openId; else delete query.issue;
    router.replace({ pathname: router.pathname, query }, undefined, { shallow: true });
  }, [router, user, selectedEvent, fetchIssue, showFirstEvent]);

  // Phone back button closes the detail view instead of leaving the dashboard
  const detailOpen = !!selectedEvent;
  useEffect(() => {
    const isPhone = window.matchMedia('(max-width: 768px)').matches;
    if (!isPhone) return;
    if (detailOpen && !detailPushedRef.current) {
      window.history.pushState({ smDetail: true }, '');
      detailPushedRef.current = true;
    } else if (!detailOpen && detailPushedRef.current) {
      detailPushedRef.current = false;
      if (window.history.state?.smDetail) window.history.back();
    }
  }, [detailOpen]);

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

  const activeItemId = selectedEvent
    ? (selectedEvent.issue ? selectedEvent.issue.id : `event-${selectedEvent.id}`)
    : null;

  return {
    selectedEvent, setSelectedEvent, activeTab, setActiveTab, activeItemId, issueEventIndices,
    openItem, closeDetail, navigateToPreviousEvent, navigateToNextEvent,
  };
}
