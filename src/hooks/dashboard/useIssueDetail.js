import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * The open issue/event in the detail panel: opening, cycling through an issue's events,
 * the ?issue= deep link and phone back behaviour (URL history only — no extra pushState).
 */
export default function useIssueDetail({ router, user, showNotification }) {
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [issueEventIndices, setIssueEventIndices] = useState({}); // current event index per issue
  const deepLinkHandledRef = useRef(false);
  const skipUrlClearRef = useRef(false);
  const openedViaPushRef = useRef(false);

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
      return true;
    }
    return false;
  }, []);

  // Open an issue (or standalone event) in the detail panel
  const openItem = useCallback(async (item) => {
    if (item._isStandaloneEvent) {
      setSelectedEvent(item._event);
      setActiveTab('overview');
      setDetailLoading(false);
      return;
    }
    setDetailLoading(true);
    setSelectedEvent({ id: `loading-${item.id}`, issue: item, data: {}, _loading: true });
    setActiveTab('overview');
    const issue = await fetchIssue(item.id);
    if (!showFirstEvent(item, issue)) {
      setSelectedEvent(null);
      setDetailLoading(false);
      showNotification?.('Could not open this issue', 'error');
      return;
    }
    setDetailLoading(false);
  }, [fetchIssue, showFirstEvent, showNotification]);

  const closeDetail = useCallback(() => {
    setSelectedEvent(null);
    setActiveTab('overview');
    setDetailLoading(false);
    if (router.query.issue) {
      if (openedViaPushRef.current) {
        openedViaPushRef.current = false;
        skipUrlClearRef.current = true;
        router.back();
      } else {
        const query = { ...router.query };
        delete query.issue;
        router.replace({ pathname: router.pathname, query }, undefined, { shallow: true });
      }
    }
  }, [router]);

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

  // Deep link on first load; keep ?issue= in sync; browser back clears selection
  useEffect(() => {
    if (!router.isReady || !user) return;

    const issueParam = router.query.issue;

    if (!deepLinkHandledRef.current) {
      deepLinkHandledRef.current = true;
      if (issueParam) {
        const id = parseInt(issueParam, 10);
        if (!isNaN(id)) {
          let cancelled = false;
          fetchIssue(id).then((issue) => {
            if (cancelled) return;
            if (!showFirstEvent({ id }, issue)) {
              showNotification?.('Could not open this issue', 'error');
            }
          });
          return () => { cancelled = true; };
        }
      }
      return;
    }

    if (skipUrlClearRef.current) {
      skipUrlClearRef.current = false;
      return;
    }

    // Browser back / forward removed ?issue= while detail is open
    if (!issueParam && selectedEvent && !selectedEvent._loading) {
      queueMicrotask(() => {
        setSelectedEvent(null);
        setDetailLoading(false);
        openedViaPushRef.current = false;
      });
      return;
    }

    const openId = selectedEvent?.issue?.id && !selectedEvent._loading
      ? String(selectedEvent.issue.id)
      : null;

    if (!openId) return;
    if (issueParam === openId) return;

    const query = { ...router.query, issue: openId };
    if (!issueParam) {
      openedViaPushRef.current = true;
      router.push({ pathname: router.pathname, query }, undefined, { shallow: true });
    } else {
      router.replace({ pathname: router.pathname, query }, undefined, { shallow: true });
    }
  }, [router, user, selectedEvent, fetchIssue, showFirstEvent, showNotification]);

  const activeItemId = selectedEvent
    ? (selectedEvent.issue ? selectedEvent.issue.id : `event-${selectedEvent.id}`)
    : null;

  return {
    selectedEvent, setSelectedEvent, detailLoading, activeTab, setActiveTab, activeItemId, issueEventIndices,
    openItem, closeDetail, navigateToPreviousEvent, navigateToNextEvent,
  };
}
