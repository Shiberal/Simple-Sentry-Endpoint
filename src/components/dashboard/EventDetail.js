import Icon from '@/components/Icon';
import { prettifyContent, getEventType, getEventTitle } from '@/lib/event-display';
import styles from '@/styles/Dashboard.module.css';

export default function EventDetail({
  activeTab,
  closeDetail,
  copiedCode,
  copiedError,
  copyIssueLink,
  copyToClipboard,
  handleCreateGitHubIssue,
  handleIgnoreIssue,
  handleResolveIssue,
  issues,
  prettifiedError,
  prettifiedMessage,
  selectedEvent,
  setActiveTab,
  setCopiedCode,
  setCopiedError,
  setDeletingEvent,
  setDeletingIssue,
  setPrettifiedError,
  setPrettifiedMessage,
  setShowDeleteConfirm,
}) {
const renderStackTrace = (exception) => {
  if (!exception?.values?.[0]?.stacktrace?.frames) {
    return <pre className={styles.codeBlock}>{JSON.stringify(exception, null, 2)}</pre>;
  }

  const frames = exception.values[0].stacktrace.frames;
  const reversedFrames = frames.slice().reverse();
  
  return (
    <div className={styles.stackTraceContainer}>
      {reversedFrames.map((frame, idx) => {
        const isLast = idx === reversedFrames.length - 1;
        const indentLevel = idx;
        
        return (
          <div key={idx} className={styles.stackFrameWrapper}>
            {/* Tree connector lines */}
            <div 
              className={styles.stackFrameTreeLine}
              style={{
                marginLeft: `${indentLevel * 1.5}rem`,
              }}
            >
              <div className={styles.treeConnector}>
                <span className={styles.treeBranch}>{isLast ? '└─' : '├─'}</span>
                <span className={styles.treeArrow}>▶</span>
              </div>
            </div>
            
            {/* Frame content */}
            <div 
              className={`${styles.stackFrame} ${isLast ? styles.stackFrameLast : ''}`}
              style={{
                marginLeft: `${indentLevel * 1.5 + 2.5}rem`,
              }}
            >
              <div className={styles.stackFrameHeader}>
                <span className={styles.stackFrameFunction}>
                  {frame.function || 'anonymous'}
                </span>
                {frame.filename && (
                  <span className={styles.stackFrameFile}>
                    {frame.filename}:{frame.lineno}
                  </span>
                )}
              </div>
              {frame.context_line && (
                <pre className={styles.stackFrameCode}>{frame.context_line.trim()}</pre>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

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
          <>
            <div className={styles.detailSection}>
              <div className={styles.overviewGrid}>
                <div className={styles.overviewItem}>
                  <span className={styles.overviewLabel}>Event ID</span>
                  <div className={styles.overviewValueWithCopy}>
                    <span className={styles.overviewValue}>{selectedEvent.id}</span>
                    <button 
                      onClick={() => copyToClipboard(selectedEvent.id.toString())}
                      className={styles.copyIconButton}
                      title="Copy"
                    >
                      <Icon name="copy" size={14} />
                    </button>
                  </div>
                </div>
                
                <div className={styles.overviewItem}>
                  <span className={styles.overviewLabel}>Type</span>
                  <span 
                    className={styles.eventType}
                    style={{
                      backgroundColor: getEventType(selectedEvent) === 'error' ? 'var(--error-bg)' : 
                                     getEventType(selectedEvent) === 'warning' ? 'var(--warning-bg)' : 
                                     getEventType(selectedEvent) === 'message' ? 'var(--success-bg)' : 'var(--info-bg)',
                      color: getEventType(selectedEvent) === 'error' ? 'var(--error)' : 
                             getEventType(selectedEvent) === 'warning' ? 'var(--warning)' : 
                             getEventType(selectedEvent) === 'message' ? 'var(--success)' : 'var(--info)'
                    }}
                  >
                    {getEventType(selectedEvent) === 'message' ? 'MESSAGE' : getEventType(selectedEvent).toUpperCase()}
                  </span>
                </div>

                {selectedEvent.issue && (
                  <div className={styles.overviewItem}>
                    <span className={styles.overviewLabel}>Status</span>
                    <span 
                      className={styles.eventType}
                      style={{
                        backgroundColor: selectedEvent.issue.status === 'RESOLVED' ? 'var(--success-bg)' : 
                                       selectedEvent.issue.status === 'IGNORED' ? 'var(--bg-tertiary)' : 
                                       selectedEvent.issue.status === 'IN_PROGRESS' ? 'var(--warning-bg)' : 'var(--error-bg)',
                        color: selectedEvent.issue.status === 'RESOLVED' ? 'var(--success)' : 
                              selectedEvent.issue.status === 'IGNORED' ? 'var(--text-secondary)' : 
                              selectedEvent.issue.status === 'IN_PROGRESS' ? 'var(--warning)' : 'var(--error)'
                      }}
                    >
                      {selectedEvent.issue.status === 'IN_PROGRESS' ? 'IN PROGRESS' : selectedEvent.issue.status}
                    </span>
                  </div>
                )}

                <div className={styles.overviewItem}>
                  <span className={styles.overviewLabel}>Project</span>
                  <span className={styles.overviewValue}>{selectedEvent.project?.name || 'Unknown Project'}</span>
                </div>

                <div className={styles.overviewItem}>
                  <span className={styles.overviewLabel}>Timestamp</span>
                  <span className={styles.overviewValue}>
                    {new Date(selectedEvent.createdAt).toLocaleString()}
                  </span>
                </div>

                {data.level && (
                  <div className={styles.overviewItem}>
                    <span className={styles.overviewLabel}>Level</span>
                    <span className={styles.overviewValue}>{data.level}</span>
                  </div>
                )}

                {data.environment && (
                  <div className={styles.overviewItem}>
                    <span className={styles.overviewLabel}>Environment</span>
                    <span className={styles.overviewValue}>{data.environment}</span>
                  </div>
                )}

                {data.platform && (
                  <div className={styles.overviewItem}>
                    <span className={styles.overviewLabel}>Platform</span>
                    <span className={styles.overviewValue}>{data.platform}</span>
                  </div>
                )}

                {data.release && (
                  <div className={styles.overviewItem}>
                    <span className={styles.overviewLabel}>Release</span>
                    <span className={styles.overviewValue}>{data.release}</span>
                  </div>
                )}
              </div>
            </div>

            {/* User Information */}
            {data.user && (
              <div className={styles.detailSection}>
                <h4 className={styles.detailSectionTitle}>User Information</h4>
                <div className={styles.infoCard}>
                  <div className={styles.infoGrid}>
                    {data.user.id && (
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>User ID</span>
                        <span className={styles.infoValue}>{data.user.id}</span>
                      </div>
                    )}
                    {data.user.username && (
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Username</span>
                        <span className={styles.infoValue}>{data.user.username}</span>
                      </div>
                    )}
                    {data.user.email && (
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Email</span>
                        <span className={styles.infoValue}>{data.user.email}</span>
                      </div>
                    )}
                    {data.user.ip_address && (
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>IP Address</span>
                        <span className={styles.infoValue}>{data.user.ip_address}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Device & Browser Information */}
            {(data.contexts?.device || data.contexts?.browser || data.contexts?.os) && (
              <div className={styles.detailSection}>
                <h4 className={styles.detailSectionTitle}>Device & Browser</h4>
                <div className={styles.infoCard}>
                  <div className={styles.infoGrid}>
                    {data.contexts?.browser?.name && (
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Browser</span>
                        <span className={styles.infoValue}>
                          {data.contexts.browser.name} {data.contexts.browser.version || ''}
                        </span>
                      </div>
                    )}
                    {data.contexts?.os?.name && (
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Operating System</span>
                        <span className={styles.infoValue}>
                          {data.contexts.os.name} {data.contexts.os.version || ''}
                        </span>
                      </div>
                    )}
                    {data.contexts?.device?.family && (
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Device</span>
                        <span className={styles.infoValue}>
                          {data.contexts.device.family} {data.contexts.device.model || ''}
                        </span>
                      </div>
                    )}
                    {data.contexts?.device?.screen_resolution && (
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Screen Resolution</span>
                        <span className={styles.infoValue}>{data.contexts.device.screen_resolution}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* SDK Information */}
            {data.sdk && (
              <div className={styles.detailSection}>
                <h4 className={styles.detailSectionTitle}>SDK Information</h4>
                <div className={styles.infoCard}>
                  <div className={styles.infoGrid}>
                    {data.sdk.name && (
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>SDK Name</span>
                        <span className={styles.infoValue}>{data.sdk.name}</span>
                      </div>
                    )}
                    {data.sdk.version && (
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>SDK Version</span>
                        <span className={styles.infoValue}>{data.sdk.version}</span>
                      </div>
                    )}
                    {data.sdk.packages && (
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Packages</span>
                        <span className={styles.infoValue}>
                          {data.sdk.packages.map(p => `${p.name}@${p.version}`).join(', ')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Runtime Information */}
            {data.contexts?.runtime && (
              <div className={styles.detailSection}>
                <h4 className={styles.detailSectionTitle}>Runtime Information</h4>
                <div className={styles.infoCard}>
                  <div className={styles.infoGrid}>
                    {data.contexts.runtime.name && (
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Runtime</span>
                        <span className={styles.infoValue}>
                          {data.contexts.runtime.name} {data.contexts.runtime.version || ''}
                        </span>
                      </div>
                    )}
                    {data.contexts.runtime.build && (
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Build</span>
                        <span className={styles.infoValue}>{data.contexts.runtime.build}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* CSP Violation Details */}
            {(data.type === 'csp' || data.csp || selectedEvent.issue?.violatedDirective) && (
              <div className={styles.detailSection}>
                <h4 className={styles.detailSectionTitle}>CSP Violation Details</h4>
                <div className={styles.infoCard}>
                  <div className={styles.infoGrid}>
                    {(data.contexts?.csp?.violated_directive || selectedEvent.issue?.violatedDirective) && (
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Violated Directive</span>
                        <span className={styles.infoValue}>
                          {data.contexts?.csp?.violated_directive || selectedEvent.issue?.violatedDirective}
                        </span>
                      </div>
                    )}
                    {(data.contexts?.csp?.blocked_uri || selectedEvent.issue?.blockedUri) && (
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Blocked URI</span>
                        <span className={styles.infoValue}>
                          {data.contexts?.csp?.blocked_uri || selectedEvent.issue?.blockedUri}
                        </span>
                      </div>
                    )}
                    {(data.contexts?.csp?.document_uri || data.csp?.['document-uri']) && (
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Document URI</span>
                        <span className={styles.infoValue}>
                          {data.contexts?.csp?.document_uri || data.csp?.['document-uri']}
                        </span>
                      </div>
                    )}
                    {(data.contexts?.csp?.source_file || selectedEvent.issue?.sourceFile) && (
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Source File</span>
                        <span className={styles.infoValue}>
                          {data.contexts?.csp?.source_file || selectedEvent.issue?.sourceFile}
                        </span>
                      </div>
                    )}
                    {(data.contexts?.csp?.disposition || data.csp?.disposition) && (
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Disposition</span>
                        <span className={styles.infoValue}>
                          {data.contexts?.csp?.disposition || data.csp?.disposition}
                        </span>
                      </div>
                    )}
                  </div>
                  {(data.contexts?.csp?.original_policy || data.csp?.['original-policy']) && (
                    <div style={{ marginTop: 'var(--space-3)' }}>
                      <span className={styles.infoLabel}>Original Policy</span>
                      <pre className={styles.codeBlock} style={{ fontSize: '10px', marginTop: 'var(--space-1)' }}>
                        {data.contexts?.csp?.original_policy || data.csp?.['original-policy']}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Minidump/Crash Details */}
            {(data.type === 'minidump' || data.minidump) && (
              <div className={styles.detailSection}>
                <h4 className={styles.detailSectionTitle}>Native Crash Details</h4>
                <div className={styles.infoCard}>
                  <div className={styles.infoGrid}>
                    {data.minidump?.crash_reason && (
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Crash Reason</span>
                        <span className={styles.infoValue}>{data.minidump.crash_reason}</span>
                      </div>
                    )}
                    {data.minidump?.crash_address && (
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Crash Address</span>
                        <span className={styles.infoValue}>{data.minidump.crash_address}</span>
                      </div>
                    )}
                    {data.minidump?.platform && (
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Platform</span>
                        <span className={styles.infoValue}>{data.minidump.platform}</span>
                      </div>
                    )}
                    {data.minidump?.os_version && (
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>OS Version</span>
                        <span className={styles.infoValue}>{data.minidump.os_version}</span>
                      </div>
                    )}
                    {data.minidump?.app_version && (
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>App Version</span>
                        <span className={styles.infoValue}>{data.minidump.app_version}</span>
                      </div>
                    )}
                  </div>
                  {data.minidump?.note && (
                    <div style={{ marginTop: 'var(--space-2)', fontSize: '11px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                      ℹ️ {data.minidump.note}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Server Performance Information */}
            {data._serverPerformance && (
              <div className={styles.detailSection}>
                <h4 className={styles.detailSectionTitle}>Server Performance</h4>
                <div className={styles.infoCard}>
                  <div className={styles.infoGrid}>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Total Processing Time</span>
                      <span className={`${styles.infoValue} ${data._serverPerformance.totalTime > 500 ? styles.valueWarning : styles.valueSuccess}`}>
                        {data._serverPerformance.totalTime}ms
                      </span>
                    </div>
                    {Object.entries(data._serverPerformance).map(([key, value]) => {
                      if (key === 'totalTime' || key === '_start') return null;
                      return (
                        <div key={key} className={styles.infoItem}>
                          <span className={styles.infoLabel}>{key.replace(/_/g, ' ')}</span>
                          <span className={styles.infoValue}>{value}ms</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Message or Exception */}
            {data.exception ? (
              <div className={styles.detailSection}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                  <h4 className={styles.detailSectionTitle}>Exception</h4>
                  <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                    <button
                      className={styles.prettifyButton}
                      onClick={() => {
                        const errorText = prettifiedError 
                          ? prettifyContent(data.exception.values?.[0]?.value || 'No message')
                          : (data.exception.values?.[0]?.value || 'No message');
                        copyToClipboard(errorText, setCopiedError);
                      }}
                      title={copiedError ? 'Copied!' : 'Copy error'}
                      style={{ 
                        opacity: copiedError ? 0.7 : 1,
                        transition: 'opacity 0.2s'
                      }}
                    >
                      {copiedError ? 'Copied' : 'Copy'}
                    </button>
                    <button
                      className={styles.prettifyButton}
                      onClick={() => setPrettifiedError(!prettifiedError)}
                      title={prettifiedError ? 'Show original' : 'Prettify'}
                    >
                      {prettifiedError ? 'Original' : 'Prettify'}
                    </button>
                  </div>
                </div>
                <div className={styles.exceptionBox}>
                  <div className={styles.exceptionType}>
                    {data.exception.values?.[0]?.type || 'Exception'}
                  </div>
                  <div className={styles.exceptionValue} style={prettifiedError ? { whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '12px' } : {}}>
                    {prettifiedError 
                      ? prettifyContent(data.exception.values?.[0]?.value || 'No message')
                      : (data.exception.values?.[0]?.value || 'No message')
                    }
                  </div>
                </div>
                
                {/* Error Snippet */}
                {(() => {
                  const frames = data.exception.values?.[0]?.stacktrace?.frames;
                  if (!frames || frames.length === 0) return null;
                  
                  // Find the last frame (the one that triggered the error)
                  const errorFrame = frames[frames.length - 1];
                  
                  // Check if we have context lines
                  const hasContext = errorFrame.pre_context || errorFrame.context_line || errorFrame.post_context;
                  if (!hasContext) return null;
                  
                  // Build the snippet with line numbers
                  const lines = [];
                  const startLine = errorFrame.lineno - (errorFrame.pre_context?.length || 0);
                  
                  // Add pre-context lines
                  if (errorFrame.pre_context) {
                    errorFrame.pre_context.forEach((line, idx) => {
                      lines.push({
                        number: startLine + idx,
                        content: line,
                        isError: false
                      });
                    });
                  }
                  
                  // Add the error line
                  if (errorFrame.context_line) {
                    lines.push({
                      number: errorFrame.lineno,
                      content: errorFrame.context_line,
                      isError: true
                    });
                  }
                  
                  // Add post-context lines
                  if (errorFrame.post_context) {
                    errorFrame.post_context.forEach((line, idx) => {
                      lines.push({
                        number: errorFrame.lineno + idx + 1,
                        content: line,
                        isError: false
                      });
                    });
                  }
                  
                  // Format code snippet for copying
                  const formatCodeForCopy = () => {
                    let formatted = '';
                    if (errorFrame.filename) {
                      formatted += `${errorFrame.filename}:${errorFrame.lineno}\n`;
                    }
                    lines.forEach(line => {
                      formatted += `${line.number}: ${line.content}\n`;
                    });
                    return formatted.trim();
                  };

                  return (
                    <div style={{ marginTop: 'var(--space-3)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                        <h4 className={styles.detailSectionTitle}>Code Snippet</h4>
                        <button
                          className={styles.prettifyButton}
                          onClick={() => copyToClipboard(formatCodeForCopy(), setCopiedCode)}
                          title={copiedCode ? 'Copied!' : 'Copy code'}
                          style={{ 
                            opacity: copiedCode ? 0.7 : 1,
                            transition: 'opacity 0.2s'
                          }}
                        >
                          {copiedCode ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      {errorFrame.filename && (
                        <div style={{ 
                          fontSize: '11px', 
                          color: 'var(--text-secondary)', 
                          marginBottom: 'var(--space-2)',
                          fontFamily: 'monospace'
                        }}>
                          {errorFrame.filename}:{errorFrame.lineno}
                        </div>
                      )}
                      <div className={styles.codeSnippet}>
                        {lines.map((line, idx) => (
                          <div 
                            key={idx} 
                            className={`${styles.snippetLine} ${line.isError ? styles.snippetLineError : ''}`}
                          >
                            <span className={styles.snippetLineNumber}>{line.number}</span>
                            <span className={styles.snippetLineContent}>{line.content}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : data.message ? (
              <div className={styles.detailSection}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                  <h4 className={styles.detailSectionTitle}>Message</h4>
                  <button
                    className={styles.prettifyButton}
                    onClick={() => setPrettifiedMessage(!prettifiedMessage)}
                    title={prettifiedMessage ? 'Show original' : 'Prettify'}
                  >
                    {prettifiedMessage ? 'Original' : 'Prettify'}
                  </button>
                </div>
                <div className={styles.exceptionBox} style={{ backgroundColor: 'var(--success-bg)', borderColor: 'var(--success)' }}>
                  <div className={styles.exceptionValue} style={{ 
                    color: 'var(--text-primary)',
                    ...(prettifiedMessage ? { whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '12px' } : {})
                  }}>
                    {prettifiedMessage 
                      ? prettifyContent(data.message)
                      : data.message
                    }
                  </div>
                </div>
              </div>
            ) : null}

            {data.tags && Object.keys(data.tags).length > 0 && (
              <div className={styles.detailSection}>
                <h4 className={styles.detailSectionTitle}>Tags</h4>
                <div className={styles.tagsContainer}>
                  {Object.entries(data.tags).map(([key, value]) => (
                    <div key={key} className={styles.tag}>
                      <span className={styles.tagKey}>{key}:</span>
                      <span className={styles.tagValue}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'stacktrace' && data.exception && (
          <div className={styles.detailSection}>
            <h4 className={styles.detailSectionTitle}>Stack Trace</h4>
            {renderStackTrace(data.exception)}
          </div>
        )}

        {activeTab === 'breadcrumbs' && (data.breadcrumbs?.values || (Array.isArray(data.breadcrumbs) && data.breadcrumbs.length > 0)) && (
          <div className={styles.detailSection}>
            <h4 className={styles.detailSectionTitle}>Breadcrumbs</h4>
            <div className={styles.breadcrumbsContainer}>
              {(Array.isArray(data.breadcrumbs) ? data.breadcrumbs : data.breadcrumbs.values).map((crumb, idx) => {
                // Format timestamp if it's a unix timestamp
                const timestamp = crumb.timestamp 
                  ? (typeof crumb.timestamp === 'number' && crumb.timestamp > 1000000000000 
                      ? new Date(crumb.timestamp).toLocaleString()
                      : typeof crumb.timestamp === 'number' && crumb.timestamp > 1000000000
                      ? new Date(crumb.timestamp * 1000).toLocaleString()
                      : crumb.timestamp)
                  : '';
                
                return (
                  <div key={idx} className={styles.breadcrumb}>
                    <div className={styles.breadcrumbHeader}>
                      <span className={styles.breadcrumbType}>
                        {crumb.type || crumb.category || crumb.level || 'default'}
                      </span>
                      <span className={styles.breadcrumbTime}>{timestamp}</span>
                    </div>
                    {crumb.message && (
                      <div className={styles.breadcrumbMessage}>{crumb.message}</div>
                    )}
                    {crumb.data && (
                      <pre className={styles.breadcrumbData}>
                        {JSON.stringify(crumb.data, null, 2)}
                      </pre>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
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

        {activeTab === 'performance' && (
          <>
            {(() => {
              // Extract performance metrics
              const duration = data.timestamp && data.start_timestamp 
                ? (data.timestamp - data.start_timestamp) 
                : 0;
              
              const formatBytes = (bytes) => {
                if (!bytes || bytes === 0) return '0 Bytes';
                const k = 1024;
                const sizes = ['Bytes', 'KB', 'MB', 'GB'];
                const i = Math.floor(Math.log(bytes) / Math.log(k));
                return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
              };

              const formatDuration = (seconds) => {
                if (!seconds) return '0ms';
                if (seconds < 1) return `${Math.round(seconds * 1000)}ms`;
                return `${seconds.toFixed(3)}s`;
              };

              // Extract metrics from breadcrumbs
              const metrics = {};
              if (data.breadcrumbs) {
                const breadcrumbs = data.breadcrumbs.values || data.breadcrumbs;
                if (Array.isArray(breadcrumbs)) {
                  breadcrumbs.forEach(bc => {
                    const msg = bc.message || '';
                    
                    // Memory metrics
                    if (msg.includes('Heap Used:')) {
                      const match = msg.match(/([\d.]+)\s*MB/);
                      if (match) metrics.heapUsed = parseFloat(match[1]);
                    }
                    if (msg.includes('Heap Total:')) {
                      const match = msg.match(/([\d.]+)\s*MB/);
                      if (match) metrics.heapTotal = parseFloat(match[1]);
                    }
                    if (msg.includes('RSS:')) {
                      const match = msg.match(/([\d.]+)\s*MB/);
                      if (match) metrics.rss = parseFloat(match[1]);
                    }
                    
                    // Performance metrics
                    if (msg.includes('CPU usage:')) {
                      const match = msg.match(/([\d.]+)%/);
                      if (match) metrics.cpu = parseFloat(match[1]);
                    }
                    if (msg.includes('event loop lag:')) {
                      const match = msg.match(/([\d.]+)\s*ms/);
                      if (match) metrics.eventLoopLag = parseFloat(match[1]);
                    }
                    if (msg.includes('active connections:')) {
                      const match = msg.match(/:\s*(\d+)/);
                      if (match) metrics.activeConnections = parseInt(match[1]);
                    }
                    if (msg.includes('throughput:')) {
                      const match = msg.match(/([\d.]+)\s*req\/s/);
                      if (match) metrics.throughput = parseFloat(match[1]);
                    }
                  });
                }
              }

              // Get memory from contexts
              const appMemory = data.contexts?.app?.app_memory;

              const renderMetricCard = (label, value, color = '#3b82f6') => (
                <div style={{
                  background: 'var(--bg-secondary)',
                  padding: '16px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-primary)'
                }}>
                  <div style={{
                    fontSize: '12px',
                    color: 'var(--text-secondary)',
                    marginBottom: '8px',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    {label}
                  </div>
                  <div style={{
                    fontSize: '24px',
                    fontWeight: 'bold',
                    color: color
                  }}>
                    {value}
                  </div>
                </div>
              );

              const renderBarChart = (label, value, max, color, unit = '') => {
                const percentage = max > 0 ? (value / max) * 100 : 0;
                return (
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: '6px',
                      fontSize: '13px'
                    }}>
                      <span style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{label}</span>
                      <span style={{ color: 'var(--text-secondary)' }}>{value.toFixed(2)}{unit}</span>
                    </div>
                    <div style={{
                      width: '100%',
                      height: '20px',
                      background: 'var(--bg-tertiary)',
                      borderRadius: '4px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${percentage}%`,
                        height: '100%',
                        background: color,
                        transition: 'width 0.3s ease'
                      }}></div>
                    </div>
                  </div>
                );
              };

              return (
                <>
                  {/* Transaction Info */}
                  <div className={styles.detailSection}>
                    <h4 className={styles.detailSectionTitle}>Transaction Overview</h4>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: '16px',
                      marginBottom: '20px'
                    }}>
                      {renderMetricCard('Duration', formatDuration(duration), '#8b5cf6')}
                      {data.transaction && renderMetricCard('Transaction', data.transaction, '#3b82f6')}
                      {data.contexts?.trace?.status && renderMetricCard('Status', data.contexts.trace.status.toUpperCase(), '#10b981')}
                      {data.environment && renderMetricCard('Environment', data.environment, '#f59e0b')}
                    </div>
                  </div>

                  {/* Memory Metrics */}
                  {(metrics.heapUsed || metrics.heapTotal || metrics.rss || appMemory) && (
                    <div className={styles.detailSection}>
                      <h4 className={styles.detailSectionTitle}>Memory Metrics</h4>
                      <div style={{
                        background: 'var(--bg-secondary)',
                        padding: '20px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-primary)'
                      }}>
                        {metrics.heapUsed && metrics.heapTotal && (
                          <>
                            {renderBarChart('Heap Used', metrics.heapUsed, metrics.heapTotal, 'linear-gradient(90deg, #00E396 0%, #00A875 100%)', ' MB')}
                            <div style={{
                              fontSize: '12px',
                              color: 'var(--text-secondary)',
                              marginBottom: '12px'
                            }}>
                              Heap Utilization: {((metrics.heapUsed / metrics.heapTotal) * 100).toFixed(1)}%
                            </div>
                          </>
                        )}
                        {metrics.rss && (
                          renderBarChart('RSS Memory', metrics.rss, metrics.rss * 1.2, 'linear-gradient(90deg, #FEB019 0%, #FF6B6B 100%)', ' MB')
                        )}
                        {appMemory && (
                          renderBarChart('App Memory', appMemory / 1024 / 1024, (appMemory / 1024 / 1024) * 1.2, 'linear-gradient(90deg, #008FFB 0%, #00E396 100%)', ' MB')
                        )}
                        
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                          gap: '12px',
                          marginTop: '16px',
                          paddingTop: '16px',
                          borderTop: '1px solid var(--border-primary)'
                        }}>
                          {metrics.heapUsed && (
                            <div>
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Heap Used</div>
                              <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>{metrics.heapUsed.toFixed(2)} MB</div>
                            </div>
                          )}
                          {metrics.heapTotal && (
                            <div>
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Heap Total</div>
                              <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>{metrics.heapTotal.toFixed(2)} MB</div>
                            </div>
                          )}
                          {metrics.rss && (
                            <div>
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>RSS</div>
                              <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>{metrics.rss.toFixed(2)} MB</div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* System Metrics */}
                  {(metrics.cpu !== undefined || metrics.eventLoopLag || metrics.activeConnections) && (
                    <div className={styles.detailSection}>
                      <h4 className={styles.detailSectionTitle}>System Performance</h4>
                      <div style={{
                        background: 'var(--bg-secondary)',
                        padding: '20px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-primary)'
                      }}>
                        {metrics.cpu !== undefined && (
                          <>
                            {renderBarChart('CPU Usage', metrics.cpu, 100, 'linear-gradient(90deg, #FF4560 0%, #FF6B6B 100%)', '%')}
                            <div style={{
                              fontSize: '12px',
                              color: metrics.cpu < 1 ? '#10b981' : metrics.cpu < 50 ? '#f59e0b' : '#ef4444',
                              marginBottom: '12px',
                              fontWeight: '500'
                            }}>
                              {metrics.cpu < 1 ? 'Excellent (very low)' : metrics.cpu < 50 ? 'Moderate' : 'High: needs attention'}
                            </div>
                          </>
                        )}
                        {metrics.eventLoopLag && (
                          <>
                            {renderBarChart('Event Loop Lag', metrics.eventLoopLag, 10, 'linear-gradient(90deg, #775DD0 0%, #9B7FE8 100%)', ' ms')}
                            <div style={{
                              fontSize: '12px',
                              color: metrics.eventLoopLag < 10 ? '#10b981' : metrics.eventLoopLag < 50 ? '#f59e0b' : '#ef4444',
                              marginBottom: '12px',
                              fontWeight: '500'
                            }}>
                              {metrics.eventLoopLag < 10 ? 'Healthy (< 10ms)' : metrics.eventLoopLag < 50 ? 'Moderate' : 'High latency'}
                            </div>
                          </>
                        )}
                        
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                          gap: '12px',
                          marginTop: '16px',
                          paddingTop: '16px',
                          borderTop: '1px solid var(--border-primary)'
                        }}>
                          {metrics.cpu !== undefined && (
                            <div>
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>CPU Usage</div>
                              <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>{metrics.cpu.toFixed(2)}%</div>
                            </div>
                          )}
                          {metrics.eventLoopLag && (
                            <div>
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Event Loop Lag</div>
                              <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>{metrics.eventLoopLag.toFixed(2)} ms</div>
                            </div>
                          )}
                          {metrics.activeConnections && (
                            <div>
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Active Connections</div>
                              <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>{metrics.activeConnections}</div>
                            </div>
                          )}
                          {metrics.throughput && (
                            <div>
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Throughput</div>
                              <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>{metrics.throughput.toFixed(2)} req/s</div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Device Info */}
                  {data.contexts?.device && (
                    <div className={styles.detailSection}>
                      <h4 className={styles.detailSectionTitle}>Device Information</h4>
                      <div style={{
                        background: 'var(--bg-secondary)',
                        padding: '16px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-primary)',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: '12px'
                      }}>
                        {data.contexts.device.cpu_description && (
                          <div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>CPU</div>
                            <div style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{data.contexts.device.cpu_description}</div>
                          </div>
                        )}
                        {data.contexts.device.processor_count && (
                          <div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Cores</div>
                            <div style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{data.contexts.device.processor_count}</div>
                          </div>
                        )}
                        {data.contexts.device.memory_size && (
                          <div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Total Memory</div>
                            <div style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{formatBytes(data.contexts.device.memory_size)}</div>
                          </div>
                        )}
                        {data.contexts.device.free_memory && (
                          <div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Free Memory</div>
                            <div style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{formatBytes(data.contexts.device.free_memory)}</div>
                          </div>
                        )}
                        {data.contexts.device.arch && (
                          <div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Architecture</div>
                            <div style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{data.contexts.device.arch}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Performance Summary */}
                  <div className={styles.detailSection}>
                    <h4 className={styles.detailSectionTitle}>Performance Summary</h4>
                    <div style={{
                      background: 'var(--bg-secondary)',
                      padding: '20px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-primary)'
                    }}>
                      <div style={{
                        fontSize: '18px',
                        fontWeight: 'bold',
                        marginBottom: '12px',
                        color: 'var(--text-primary)'
                      }}>
                        Overall Assessment
                      </div>
                      <div style={{
                        fontSize: '14px',
                        lineHeight: '1.6',
                        color: 'var(--text-secondary)'
                      }}>
                        {metrics.cpu !== undefined && metrics.eventLoopLag ? (
                          metrics.cpu < 1 && metrics.eventLoopLag < 10 ? (
                            <div style={{ color: '#10b981', fontWeight: '600' }}>
                              Excellent: system is performing optimally
                            </div>
                          ) : metrics.cpu < 5 && metrics.eventLoopLag < 50 ? (
                            <div style={{ color: '#f59e0b', fontWeight: '600' }}>
                              Good: system is performing well
                            </div>
                          ) : (
                            <div style={{ color: '#ef4444', fontWeight: '600' }}>
                              Needs attention: consider optimization
                            </div>
                          )
                        ) : (
                          <div>Performance metrics available. Review individual sections above for details.</div>
                        )}
                      </div>
                      <div style={{
                        marginTop: '16px',
                        paddingTop: '16px',
                        borderTop: '1px solid var(--border-primary)',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                        gap: '12px'
                      }}>
                        <div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Transaction Duration</div>
                          <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>{formatDuration(duration)}</div>
                        </div>
                        {data.spans && (
                          <div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Spans</div>
                            <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>{data.spans.length}</div>
                          </div>
                        )}
                        {data.server_name && (
                          <div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Server</div>
                            <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>{data.server_name}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              );
            })()}
          </>
        )}

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
