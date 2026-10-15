import styles from '@/styles/Dashboard.module.css';

/** User, device, SDK, runtime, CSP, native crash and server-timing cards. */
export default function OverviewDetails({ selectedEvent, data }) {
  return (
    <>
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
    </>
  );
}
