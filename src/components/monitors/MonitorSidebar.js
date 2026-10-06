import Link from 'next/link';
import { useEffect, useState } from 'react';
import { REFRESH_MS, projectLabel, scopeOf, span } from './helpers';
import { History } from './panels';
import m from '@/styles/Monitors.module.css';

/** Left rail on the monitor page: every monitor with its 24h success badge and a mini run strip, searchable. */
export function MonitorSidebar({ activeId, scope = null }) {
  const [monitors, setMonitors] = useState(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    let live = true;
    const load = () => {
      if (document.hidden) return;
      fetch('/api/monitors').then((r) => r.json()).then((j) => live && j.monitors && setMonitors(j.monitors)).catch(() => {});
    };
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => { live = false; clearInterval(t); };
  }, []);

  const term = q.trim().toLowerCase();
  const shown = (monitors || []).filter((x) => (scope == null || scopeOf(x) === scope) && (!term || `${x.name || ''} ${x.slug} ${projectLabel(x)}`.toLowerCase().includes(term)));

  return (
    <aside className={m.sideList} aria-label="Monitors">
      <input className={m.sideSearch} type="search" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search monitors" />
      <ul className={m.sideItems}>
        {shown.map((x) => {
          const up = x.stats?.windows?.['24h']?.uptime;
          return (
            <li key={x.id}>
              <Link href={`/monitors/${x.id}`} className={`${m.sideItem} ${x.id === activeId ? m.sideItemOn : ''}`}>
                <span className={`${m.sideBadge} ${up == null ? m.sideBadgeNone : up >= 99 ? m.sideBadgeOk : up >= 95 ? m.sideBadgeWarn : m.sideBadgeBad}`}>{up == null ? '–' : `${Math.round(up)}%`}</span>
                <span className={m.sideName}>{x.name || x.slug}<small>{projectLabel(x)}</small></span>
                <span className={m.sideStrip}><History history={x.history || []} slots={12} /></span>
              </Link>
            </li>
          );
        })}
        {monitors && !shown.length && <li className={m.faint}>No monitors match.</li>}
      </ul>
      <Link href="/monitors" className={m.editButton}>All monitors</Link>
    </aside>
  );
}
