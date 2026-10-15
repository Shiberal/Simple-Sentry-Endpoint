import Icon from '@/components/Icon';
import { SORT_OPTIONS, TIME_RANGES } from '@/lib/ui';
import shell from '@/styles/AppShell.module.css';
import styles from '@/styles/Dashboard.module.css';

export default function IssueToolbar({ isSelectionMode, setIsSelectionMode, selectedCount, allSelected, onToggleSelectAll, onMerge, onBulkStatus, onBulkDelete, onExitSelection, searchInputRef, searchQuery, setSearchQuery, sortBy, setSortBy, timeRange, setTimeRange, origins, filterOrigin, setFilterOrigin, filterEventType, setFilterEventType, shownCount, loadedCount, issuesTotal, lastUpdated, hasActiveFilters, onClearFilters }) {
  return (
    <div className={styles.eventsHeader}>
      {isSelectionMode && (
        <div className={styles.selectionToolbar}>
          <div className={styles.selectionToolbarLeft}>
            <input
              type="checkbox"
              checked={allSelected}
              onChange={onToggleSelectAll}
              className={styles.checkbox}
            />
            <span className={styles.selectionCount}>
              {selectedCount} selected
            </span>
          </div>
          <div className={styles.selectionToolbarRight}>
            <button
              onClick={onMerge}
              disabled={selectedCount < 2}
              className={styles.cancelSelectionButton}
              title="Merge the selected issues into one"
            >
              <Icon name="merge" size={13} /> Merge
            </button>
            <button
              onClick={() => onBulkStatus('RESOLVED')}
              disabled={selectedCount === 0}
              className={styles.cancelSelectionButton}
            >
              <Icon name="check" size={13} /> Resolve
            </button>
            <button
              onClick={() => onBulkStatus('IGNORED')}
              disabled={selectedCount === 0}
              className={styles.cancelSelectionButton}
            >
              <Icon name="eyeOff" size={13} /> Ignore
            </button>
            <button
              onClick={onBulkDelete}
              disabled={selectedCount === 0}
              className={styles.bulkDeleteButton}
            >
              <Icon name="trash" size={13} /> Delete ({selectedCount})
            </button>
            <button
              onClick={onExitSelection}
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
          {shownCount} shown
          {issuesTotal > loadedCount ? ` · ${issuesTotal} match on server` : ''}
          {lastUpdated ? ` · updated ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
        </span>
        {hasActiveFilters && (
          <button onClick={onClearFilters} className={styles.clearFilters}>Clear filters</button>
        )}
      </div>
    </div>
  );
}
