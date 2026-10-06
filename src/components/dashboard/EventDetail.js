import { useState } from 'react';
import Icon from '@/components/Icon';
import { getEventTitle } from '@/lib/event-display';
import styles from '@/styles/Dashboard.module.css';
import OverviewTab from './event-detail/OverviewTab';
import StackTrace from './event-detail/StackTrace';
import BreadcrumbsTab from './event-detail/BreadcrumbsTab';
import PerformanceTab from './event-detail/PerformanceTab';

export default function EventDetail({
  activeTab,
  closeDetail,
  copyIssueLink,
  copyToClipboard,
  handleCreateGitHubIssue,
  handleIgnoreIssue,
  handleResolveIssue,
  selectedEvent,
  setActiveTab,
  setDeletingEvent,
  setDeletingIssue,
  setShowDeleteConfirm,
}) {
  // Reset by the parent keying this component on the open event
  const [prettifiedError, setPrettifiedError] = useState(false);
  const [prettifiedMessage, setPrettifiedMessage] = useState(false);
  const [copiedError, setCopiedError] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

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
          <OverviewTab
            selectedEvent={selectedEvent}
            data={data}
            copyToClipboard={copyToClipboard}
            prettifiedError={prettifiedError}
            setPrettifiedError={setPrettifiedError}
            prettifiedMessage={prettifiedMessage}
            setPrettifiedMessage={setPrettifiedMessage}
            copiedError={copiedError}
            setCopiedError={setCopiedError}
            copiedCode={copiedCode}
            setCopiedCode={setCopiedCode}
          />
        )}

        {activeTab === 'stacktrace' && data.exception && (
          <div className={styles.detailSection}>
            <h4 className={styles.detailSectionTitle}>Stack Trace</h4>
            <StackTrace exception={data.exception} />
          </div>
        )}

        {activeTab === 'breadcrumbs' && (data.breadcrumbs?.values || (Array.isArray(data.breadcrumbs) && data.breadcrumbs.length > 0)) && (
          <BreadcrumbsTab data={data} />
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

        {activeTab === 'performance' && <PerformanceTab data={data} />}

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
}
