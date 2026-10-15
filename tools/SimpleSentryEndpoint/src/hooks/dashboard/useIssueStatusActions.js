/** Resolve / ignore toggles with optimistic list updates and an Undo toast. */
export default function useIssueStatusActions({ setIssues, selectedEvent, setSelectedEvent, fetchData, showNotification }) {
  const setStatusLocally = (id, status) =>
    setIssues(prev => prev.map(iss => iss.id === id ? { ...iss, status } : iss));

  const applyStatus = async (issue, newStatus, { allowUndo, successMessage, failureVerb, undo }) => {
    // Optimistic update so the list reacts instantly
    setStatusLocally(issue.id, newStatus);

    try {
      const response = await fetch(`/api/issues/${issue.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      if (response.ok) {
        const data = await response.json();

        if (selectedEvent?.issue?.id === issue.id) {
          setSelectedEvent({ ...selectedEvent, issue: data.issue });
        }
        setIssues(prev => prev.map(iss => iss.id === issue.id ? data.issue : iss));

        showNotification(successMessage, 'success', allowUndo ? {
          label: 'Undo',
          onClick: () => undo({ ...issue, status: newStatus })
        } : null);

        fetchData({ silent: true });
      } else {
        setStatusLocally(issue.id, issue.status);
        const errorData = await response.json();
        showNotification(`Failed to ${failureVerb} issue: ${errorData.error || 'Unknown error'}`, 'error');
      }
    } catch (error) {
      setStatusLocally(issue.id, issue.status);
      console.error(`Error trying to ${failureVerb} issue:`, error);
      showNotification('Error updating issue status', 'error');
    }
  };

  const handleResolveIssue = async (issue, { allowUndo = true } = {}) => {
    if (!issue) return;
    const resolving = issue.status !== 'RESOLVED';
    let successMessage = `Issue ${resolving ? 'resolved' : 'reopened'} successfully!`;
    if (issue.githubIssueNumber) {
      successMessage += ` GitHub issue #${issue.githubIssueNumber} has been ${resolving ? 'closed' : 'reopened'}.`;
    }
    await applyStatus(issue, resolving ? 'RESOLVED' : 'UNRESOLVED', {
      allowUndo,
      successMessage,
      failureVerb: resolving ? 'resolve' : 'reopen',
      undo: (reverted) => handleResolveIssue(reverted, { allowUndo: false }),
    });
  };

  const handleIgnoreIssue = async (issue, { allowUndo = true } = {}) => {
    if (!issue) return;
    const ignoring = issue.status !== 'IGNORED';
    await applyStatus(issue, ignoring ? 'IGNORED' : 'UNRESOLVED', {
      allowUndo,
      successMessage: `Issue ${ignoring ? 'ignored - will not appear in main view or auto-report to GitHub' : 'unignored'} successfully!`,
      failureVerb: ignoring ? 'ignore' : 'unignore',
      undo: (reverted) => handleIgnoreIssue(reverted, { allowUndo: false }),
    });
  };

  return { handleResolveIssue, handleIgnoreIssue };
}
