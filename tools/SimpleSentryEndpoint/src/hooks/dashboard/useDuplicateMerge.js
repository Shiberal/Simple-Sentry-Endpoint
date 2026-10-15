import { useState } from 'react';

/** Duplicate-issue review/merge dialog and the manual "merge selected issues" flow. */
export default function useDuplicateMerge({
  projects, selectedProject, issues, selectedIds, selectedEvent, closeDetail, exitSelectionMode, fetchData, showNotification,
}) {
  const [isDeduplicating, setIsDeduplicating] = useState(false);
  const [dupPreview, setDupPreview] = useState(null); // { groups, outdated } awaiting confirmation
  const [dupSelected, setDupSelected] = useState([]); // primaryIds of groups to merge
  const [mergeDraft, setMergeDraft] = useState(null); // { issues, targetId } for manual merge

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
    const chosen = issues.filter(i => selectedIds.includes(i.id));
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

  return {
    isDeduplicating, dupPreview, setDupPreview, dupSelected, setDupSelected, mergeDraft, setMergeDraft,
    handleDeduplicate, applyDuplicates, startMerge, confirmMerge,
  };
}
