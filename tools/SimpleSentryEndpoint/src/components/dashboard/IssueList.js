import Icon from '@/components/Icon';
import shell from '@/styles/AppShell.module.css';
import styles from '@/styles/Dashboard.module.css';
import IssueCard from './IssueCard';
import IssueListSkeleton from './IssueListSkeleton';

export default function IssueList({
  loading, hasProjects, issues, filteredIssues, issuesTotal, loadingMore, hasActiveFilters, onClearFilters, onCreateProject,
  selectedIds, isSelectionMode, onToggleSelect, onOpen, activeItemId, isNewSinceLastVisit, issueEventIndices,
  onPrevEvent, onNextEvent, onResolve, onIgnore, onLoadMore,
}) {
  if (loading) return <IssueListSkeleton rows={9} />;

  if (!hasProjects) {
    return (
    <div className={shell.empty}>
      <div className={shell.emptyIcon}><Icon name="plus" size={36} strokeWidth={1.25} /></div>
      <h3 className={shell.emptyTitle}>Get Started</h3>
      <p className={shell.emptyText}>
        Create your first project to start monitoring errors.
      </p>
      <button 
        onClick={() => onCreateProject()}
        className={styles.createButton}
      >
        Create Project
      </button>
    </div>
    );
  }

  if (filteredIssues.length === 0) {
    return (
    <div className={shell.empty}>
      <div className={shell.emptyIcon}><Icon name="inbox" size={36} strokeWidth={1.25} /></div>
      <h3 className={shell.emptyTitle}>
        {issues.length === 0 ? 'No issues for these filters' : 'No matching issues'}
      </h3>
      <p className={shell.emptyText}>
        {issues.length === 0
          ? 'Projects “Active issues” counts every open issue (any level). Switch Level to All Levels, or open Issues from the project card.'
          : 'Try adjusting your search or filter criteria.'
        }
      </p>
      {hasActiveFilters && (
        <button onClick={onClearFilters} className={styles.createButton}>Show all levels &amp; statuses</button>
      )}
    </div>
    );
  }

  return (
    <div className={styles.eventsContainer}>
      {filteredIssues.map(issue => (
        <IssueCard
          key={issue.id}
          issue={issue}
          isSelected={selectedIds.includes(issue.id)}
          isActive={activeItemId === issue.id}
          isNew={!!isNewSinceLastVisit(issue)}
          isSelectionMode={isSelectionMode}
          eventIndex={issueEventIndices[issue.id] || 0}
          onToggleSelect={() => onToggleSelect(issue.id)}
          onOpen={() => onOpen(issue)}
          onPrevEvent={(e) => onPrevEvent(issue, e)}
          onNextEvent={(e) => onNextEvent(issue, e)}
          onResolve={() => onResolve(issue)}
          onIgnore={() => onIgnore(issue)}
        />
      ))}
        {issues.length < issuesTotal && (
          <button
            onClick={onLoadMore}
            disabled={loadingMore}
            className={styles.loadMoreButton}
          >
            {loadingMore ? 'Loading…' : `Load more (${issues.length} of ${issuesTotal})`}
          </button>
        )}
    </div>
  );
}
