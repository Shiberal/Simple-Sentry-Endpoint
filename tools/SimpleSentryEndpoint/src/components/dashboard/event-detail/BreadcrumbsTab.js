import { useMemo, useState } from 'react';
import styles from '@/styles/Dashboard.module.css';

function crumbTimestamp(crumb) {
  if (crumb.timestamp == null || crumb.timestamp === '') return null;
  const raw = crumb.timestamp;
  if (typeof raw === 'number') {
    const ms = raw > 1e12 ? raw : raw > 1e9 ? raw * 1000 : raw;
    return new Date(ms);
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDelta(ms) {
  if (ms == null || !Number.isFinite(ms)) return '';
  if (ms < 1000) return `+${Math.round(ms)}ms`;
  if (ms < 60000) return `+${(ms / 1000).toFixed(ms < 10000 ? 1 : 0)}s`;
  return `+${Math.round(ms / 60000)}m`;
}

function crumbKind(crumb) {
  const cat = String(crumb.category || crumb.type || 'default').toLowerCase();
  if (cat.includes('error') || crumb.level === 'error' || crumb.level === 'fatal') return 'error';
  if (cat.includes('http') || cat === 'fetch' || cat === 'xhr') return 'http';
  if (cat.includes('nav') || cat === 'navigation') return 'nav';
  if (cat.includes('ui') || cat.includes('click') || cat.includes('input')) return 'ui';
  if (cat.includes('console') || cat === 'log') return 'console';
  if (cat.includes('query') || cat.includes('db') || cat.includes('sql')) return 'db';
  return 'default';
}

function crumbLabel(crumb) {
  return crumb.category || crumb.type || crumb.level || 'event';
}

function crumbSummary(crumb) {
  if (crumb.message) return crumb.message;
  if (!crumb.data || typeof crumb.data !== 'object') return null;
  const d = crumb.data;
  if (d.method && d.url) return `${d.method} ${d.url}`;
  if (d.url) return String(d.url);
  if (d.from && d.to) return `${d.from} → ${d.to}`;
  if (d.path) return String(d.path);
  return null;
}

function CrumbRow({ crumb, deltaMs, isLast }) {
  const [open, setOpen] = useState(false);
  const kind = crumbKind(crumb);
  const when = crumbTimestamp(crumb);
  const summary = crumbSummary(crumb);
  const hasData = crumb.data && typeof crumb.data === 'object' && Object.keys(crumb.data).length > 0;
  const level = crumb.level && crumb.level !== 'info' ? crumb.level : null;

  return (
    <li className={`${styles.crumbItem} ${styles[`crumbKind_${kind}`]} ${isLast ? styles.crumbItemLast : ''}`}>
      <div className={styles.crumbRail} aria-hidden="true">
        <span className={styles.crumbDot} />
        {!isLast && <span className={styles.crumbLine} />}
      </div>
      <div className={styles.crumbBody}>
        <div className={styles.crumbHead}>
          <span className={styles.crumbType}>{crumbLabel(crumb)}</span>
          {level && <span className={styles.crumbLevel}>{level}</span>}
          <span className={styles.crumbTime}>
            {deltaMs != null && <span className={styles.crumbDelta}>{formatDelta(deltaMs)}</span>}
            {when && (
              <time dateTime={when.toISOString()} title={when.toLocaleString()}>
                {when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </time>
            )}
          </span>
        </div>
        {summary && <p className={styles.crumbMessage}>{summary}</p>}
        {hasData && (
          <button
            type="button"
            className={styles.crumbDataToggle}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? 'Hide data' : 'Show data'}
          </button>
        )}
        {hasData && open && (
          <pre className={styles.breadcrumbData}>{JSON.stringify(crumb.data, null, 2)}</pre>
        )}
      </div>
    </li>
  );
}

export default function BreadcrumbsTab({ data }) {
  const crumbs = useMemo(() => {
    const raw = Array.isArray(data.breadcrumbs) ? data.breadcrumbs : data.breadcrumbs?.values;
    return Array.isArray(raw) ? raw : [];
  }, [data.breadcrumbs]);

  const times = useMemo(() => crumbs.map(crumbTimestamp), [crumbs]);
  const firstMs = times.find((t) => t)?.getTime() ?? null;

  if (!crumbs.length) {
    return (
      <div className={styles.detailSection}>
        <h4 className={styles.detailSectionTitle}>Breadcrumbs</h4>
        <p className={styles.emptyDetailText}>No breadcrumbs on this event.</p>
      </div>
    );
  }

  return (
    <div className={styles.detailSection}>
      <div className={styles.crumbTitleRow}>
        <h4 className={styles.detailSectionTitle}>Breadcrumbs</h4>
        <span className={styles.crumbCount}>{crumbs.length} step{crumbs.length === 1 ? '' : 's'}</span>
      </div>
      <ol className={styles.crumbTimeline}>
        {crumbs.map((crumb, idx) => {
          const t = times[idx];
          const delta = firstMs != null && t ? t.getTime() - firstMs : null;
          return (
            <CrumbRow
              key={`${idx}-${crumb.category || ''}-${crumb.timestamp || ''}`}
              crumb={crumb}
              deltaMs={delta}
              isLast={idx === crumbs.length - 1}
            />
          );
        })}
      </ol>
    </div>
  );
}
