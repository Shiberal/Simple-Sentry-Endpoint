import { useState } from 'react';

/** Delete confirmation state plus the single-issue, single-event and bulk delete requests. */
export default function useIssueDeletion({ selectedEvent, setSelectedEvent, selectedIds, clearSelection, fetchData, showNotification }) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingEvent, setDeletingEvent] = useState(null);
  const [deletingIssue, setDeletingIssue] = useState(null);

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setDeletingIssue(null);
    setDeletingEvent(null);
  };

  const handleDeleteIssue = async () => {
    if (!deletingIssue) return;

    try {
      let response;

      // Check if it's a standalone event
      if (deletingIssue._isStandaloneEvent) {
        const eventId = deletingIssue.id.replace('event-', '');
        response = await fetch(`/api/events/${eventId}`, { method: 'DELETE' });
      } else {
        response = await fetch(`/api/issues/${deletingIssue.id}`, { method: 'DELETE' });
      }

      if (response.ok) {
        // Close the detail panel if the deleted issue is currently selected
        if (selectedEvent?.issue?.id === deletingIssue.id) {
          setSelectedEvent(null);
        }
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
      const response = await fetch(`/api/events/${deletingEvent.id}`, { method: 'DELETE' });

      if (response.ok) {
        // Close the detail panel if the deleted event is currently selected
        if (selectedEvent?.id === deletingEvent.id) {
          setSelectedEvent(null);
        }
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
    if (selectedIds.length === 0) return;

    try {
      // Delete all selected issues and standalone events
      const results = await Promise.all(selectedIds.map(id => {
        // Standalone events are selected as "event-123"
        if (typeof id === 'string' && id.startsWith('event-')) {
          return fetch(`/api/events/${id.replace('event-', '')}`, { method: 'DELETE' });
        }
        return fetch(`/api/issues/${id}`, { method: 'DELETE' });
      }));

      if (results.every(res => res.ok)) {
        // Close detail panel if selected issue was deleted
        if (selectedEvent?.issue && selectedIds.includes(selectedEvent.issue.id)) {
          setSelectedEvent(null);
        }
        clearSelection();
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

  return {
    showDeleteConfirm, setShowDeleteConfirm, deletingIssue, setDeletingIssue, deletingEvent, setDeletingEvent,
    cancelDelete, handleDeleteIssue, handleDeleteEvent, handleBulkDelete,
  };
}
