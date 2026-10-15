import { useMemo } from 'react';
import Icon from '@/components/Icon';
import styles from '@/styles/Admin.module.css';

function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

function formatUptime(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatHourLabel(iso) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: 'numeric' });
  } catch {
    return '';
  }
}

function relativeChange(current, previous) {
  if (!previous) return null;
  const pct = ((current - previous) / previous) * 100;
  return pct;
}

export default function InsightsTab({ insights, onRefresh }) {
  const stats = insights?.stats;
  const storage = insights?.storage;
  const ingest = insights?.ingest;
  const processInfo = insights?.process;
  const workers = insights?.workers || [];
  const alerts = insights?.alerts || [];

  const maxHourly = useMemo(() => {
    const counts = ingest?.hourly?.map((h) => h.count) || [];
    return Math.max(1, ...counts);
  }, [ingest?.hourly]);

  const maxTable = useMemo(() => {
    const sizes = storage?.tables?.map((t) => t.totalBytes) || [];
    return Math.max(1, ...sizes);
  }, [storage?.tables]);

  const maxProject = useMemo(() => {
    const sizes = ingest?.topProjects?.map((p) => p.events) || [];
    return Math.max(1, ...sizes);
  }, [ingest?.topProjects]);

  if (!stats) {
    return (
      <div className={styles.emptyState}>
        <p>No insights available yet.</p>
      </div>
    );
  }

  const dayChange = relativeChange(stats.recentEvents, stats.eventsPrev24h);

  return (
    <>
      <div className={styles.sectionHeader}>
        <div>
          <h2 className={styles.sectionTitle}>Insights</h2>
          <p className={styles.sectionSubtitle}>
            Storage, ingest volume, and early warnings — so you can see problems coming.
          </p>
        </div>
        {onRefresh && (
          <button type="button" className={styles.headerButton} onClick={onRefresh}>
            <Icon name="refresh" size={14} /> Refresh
          </button>
        )}
      </div>

      {alerts.length > 0 && (
        <div className={styles.alertStack}>
          {alerts.map((alert) => (
            <div
              key={alert.code}
              className={`${styles.alertBanner} ${styles[`alert${alert.level.charAt(0).toUpperCase()}${alert.level.slice(1)}`]}`}
            >
              <Icon
                name={alert.level === 'info' ? 'info' : 'alert'}
                size={16}
              />
              <span>{alert.message}</span>
            </div>
          ))}
        </div>
      )}

      {alerts.length === 0 && (
        <div className={`${styles.alertBanner} ${styles.alertOk}`}>
          <Icon name="checkCircle" size={16} />
          <span>No storage or ingest warnings right now.</span>
        </div>
      )}

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statCardLabel}>Database size</div>
          <div className={styles.statCardValue}>{storage?.databaseLabel || '—'}</div>
          <div className={styles.statCardSubtext}>
            Events ~{Math.round((storage?.eventTableShare || 0) * 100)}% of DB
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statCardLabel}>Events / hour</div>
          <div className={styles.statCardValue}>{(stats.eventsLastHour || 0).toLocaleString()}</div>
          <div className={styles.statCardSubtext}>
            {(stats.recentEvents || 0).toLocaleString()} in last 24h
            {dayChange != null && (
              <> · {dayChange >= 0 ? '+' : ''}{dayChange.toFixed(0)}% vs prior day</>
            )}
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statCardLabel}>Unresolved issues</div>
          <div className={styles.statCardValue}>{(stats.unresolvedIssues || 0).toLocaleString()}</div>
          <div className={styles.statCardSubtext}>
            {(stats.regressedIssues || 0).toLocaleString()} ever regressed · +{stats.recentIssues || 0} new / 24h
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statCardLabel}>Process memory</div>
          <div className={styles.statCardValue}>{formatBytes(processInfo?.rssBytes)}</div>
          <div className={styles.statCardSubtext}>
            Heap {formatBytes(processInfo?.heapUsedBytes)} · up {formatUptime(processInfo?.uptimeSeconds)}
          </div>
        </div>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statCardLabel}>Total events</div>
          <div className={styles.statCardValue}>{(stats.events || 0).toLocaleString()}</div>
          <div className={styles.statCardSubtext}>{(stats.eventsLast7d || 0).toLocaleString()} in last 7 days</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statCardLabel}>Projects / users</div>
          <div className={styles.statCardValue}>{stats.projects} / {stats.users}</div>
          <div className={styles.statCardSubtext}>{stats.monitors || 0} monitors · {stats.debugFiles || 0} debug files</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statCardLabel}>Check-ins / 24h</div>
          <div className={styles.statCardValue}>{(stats.checkInsLast24h || 0).toLocaleString()}</div>
          <div className={styles.statCardSubtext}>{stats.releases || 0} releases tracked</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statCardLabel}>Event span</div>
          <div className={styles.statCardValue} style={{ fontSize: 'var(--font-lg)' }}>
            {ingest?.oldestEventAt
              ? `${Math.round((Date.now() - new Date(ingest.oldestEventAt).getTime()) / 86400000)}d`
              : '—'}
          </div>
          <div className={styles.statCardSubtext}>
            Oldest retained event age
            {ingest?.newestEventAt && (
              <> · newest {new Date(ingest.newestEventAt).toLocaleString()}</>
            )}
          </div>
        </div>
      </div>

      <div className={styles.insightPanels}>
        <section className={styles.insightPanel}>
          <h3 className={styles.insightPanelTitle}>Ingest — last 24 hours</h3>
          <div className={styles.sparkBars} role="img" aria-label="Hourly event counts">
            {(ingest?.hourly || []).map((bucket) => (
              <div key={bucket.hour} className={styles.sparkCol} title={`${formatHourLabel(bucket.hour)}: ${bucket.count}`}>
                <div
                  className={styles.sparkBar}
                  style={{ height: `${Math.max(4, (bucket.count / maxHourly) * 100)}%` }}
                />
                <span className={styles.sparkLabel}>{formatHourLabel(bucket.hour)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.insightPanel}>
          <h3 className={styles.insightPanelTitle}>By event type (24h)</h3>
          {(ingest?.byType || []).length === 0 ? (
            <p className={styles.mutedText}>No events in the last 24 hours.</p>
          ) : (
            <ul className={styles.barList}>
              {ingest.byType.map((row) => {
                const max = Math.max(1, ...ingest.byType.map((r) => r.count));
                return (
                  <li key={row.type} className={styles.barRow}>
                    <span className={styles.barLabel}>{row.type}</span>
                    <div className={styles.barTrack}>
                      <div className={styles.barFill} style={{ width: `${(row.count / max) * 100}%` }} />
                    </div>
                    <span className={styles.barValue}>{row.count.toLocaleString()}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <div className={styles.insightPanels}>
        <section className={styles.insightPanel}>
          <h3 className={styles.insightPanelTitle}>Top projects by events (24h)</h3>
          {(ingest?.topProjects || []).length === 0 ? (
            <p className={styles.mutedText}>No project activity in the last 24 hours.</p>
          ) : (
            <ul className={styles.barList}>
              {ingest.topProjects.map((p) => (
                <li key={p.id} className={styles.barRow}>
                  <span className={styles.barLabel} title={p.name}>{p.name}</span>
                  <div className={styles.barTrack}>
                    <div className={styles.barFill} style={{ width: `${(p.events / maxProject) * 100}%` }} />
                  </div>
                  <span className={styles.barValue}>{p.events.toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={styles.insightPanel}>
          <h3 className={styles.insightPanelTitle}>Database tables</h3>
          {(storage?.tables || []).length === 0 ? (
            <p className={styles.mutedText}>Could not read table sizes.</p>
          ) : (
            <ul className={styles.barList}>
              {storage.tables.slice(0, 10).map((t) => (
                <li key={t.name} className={styles.barRow}>
                  <span className={styles.barLabel} title={t.name}>{t.name}</span>
                  <div className={styles.barTrack}>
                    <div
                      className={`${styles.barFill} ${styles.barFillStorage}`}
                      style={{ width: `${(t.totalBytes / maxTable) * 100}%` }}
                    />
                  </div>
                  <span className={styles.barValue}>{formatBytes(t.totalBytes)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {workers.length > 0 && (
        <section className={styles.insightPanel} style={{ marginTop: 'var(--space-4)' }}>
          <h3 className={styles.insightPanelTitle}>Workers</h3>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Kind</th>
                  <th>Last tick</th>
                  <th>Ticks</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {workers.map((w) => (
                  <tr key={w.id}>
                    <td>{w.id}</td>
                    <td>{w.kind}</td>
                    <td>{w.lastTickAt ? new Date(w.lastTickAt).toLocaleString() : '—'}</td>
                    <td>{w.ticks?.toLocaleString?.() ?? w.ticks}</td>
                    <td>
                      {w.stale ? (
                        <span className={styles.badgeWarn}>Stale</span>
                      ) : w.lastError ? (
                        <span className={styles.badgeWarn} title={w.lastError}>Error</span>
                      ) : (
                        <span className={styles.badgeOk}>OK</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {insights?.generatedAt && (
        <p className={styles.mutedText} style={{ marginTop: 'var(--space-4)' }}>
          Generated {new Date(insights.generatedAt).toLocaleString()}
          {processInfo?.nodeVersion ? ` · Node ${processInfo.nodeVersion}` : ''}
        </p>
      )}
    </>
  );
}
