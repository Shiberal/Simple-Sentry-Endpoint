import { useMemo, useState } from 'react';
import { summarizeTransactions } from '@/lib/performance-summary';
import p from '@/styles/PerformanceOverview.module.css';

const fmtMs = (ms) => (ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(ms < 10000 ? 2 : 1)} s`);
const fmtPct = (r) => `${r >= 0.1 ? Math.round(r * 100) : Math.round(r * 1000) / 10}%`;
const tone = (ms) => (ms < 500 ? p.ok : ms < 1500 ? p.warn : p.bad);
const BUCKET_LABELS = ['< 50 ms', '< 100 ms', '< 250 ms', '< 500 ms', '< 1 s', '< 2.5 s', '2.5 s +'];

const COLUMNS = [
  ['name', 'Endpoint'],
  ['count', 'Requests'],
  ['avg', 'Avg'],
  ['p50', 'p50'],
  ['p95', 'p95'],
  ['max', 'Max'],
  ['errorRate', 'Errors'],
  ['totalMs', 'Time share']
];

/** Where the time goes: headline latency numbers, per-endpoint table, distribution and slowest requests. */
export default function PerformanceOverview({ transactions, selectedEndpoint, onSelectEndpoint }) {
  const sum = useMemo(() => summarizeTransactions(transactions || []), [transactions]);
  const [sort, setSort] = useState({ key: 'p95', dir: -1 });
  const [query, setQuery] = useState('');
  const [all, setAll] = useState(false);

  if (!sum) return null;

  const q = query.trim().toLowerCase();
  const rows = sum.endpoints
    .filter((e) => !q || e.name.toLowerCase().includes(q))
    .sort((a, b) => (sort.key === 'name' ? a.name.localeCompare(b.name) : a[sort.key] - b[sort.key]) * sort.dir);
  const shown = all ? rows : rows.slice(0, 10);
  const maxBucket = Math.max(1, ...sum.histogram.map((b) => b.count));
  const worst = [...sum.endpoints].sort((a, b) => b.p95 - a.p95)[0];
  const trend = sum.p95Trend;

  const tiles = [
    { label: 'Median (p50)', value: fmtMs(sum.p50), cls: tone(sum.p50) },
    { label: 'p95', value: fmtMs(sum.p95), cls: tone(sum.p95), note: trend == null ? '' : `${trend > 0 ? '▲' : '▼'} ${Math.abs(Math.round(trend * 100))}% vs earlier`, noteCls: trend > 0.1 ? p.bad : trend < -0.1 ? p.ok : '' },
    { label: 'p99', value: fmtMs(sum.p99), cls: tone(sum.p99) },
    { label: 'Throughput', value: `${sum.throughputPerMin < 10 ? sum.throughputPerMin.toFixed(1) : Math.round(sum.throughputPerMin)}/min`, note: `${sum.total} requests` },
    { label: 'Error rate', value: fmtPct(sum.errorRate), cls: sum.errorRate === 0 ? p.ok : sum.errorRate < 0.05 ? p.warn : p.bad, note: `${sum.errors} failed` },
    { label: 'Slowest endpoint', value: worst.name, small: true, note: `p95 ${fmtMs(worst.p95)}` }
  ];

  const header = (key, label) => (
    <th key={key} className={key === 'name' ? p.left : ''} aria-sort={sort.key === key ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className={p.sortBtn} onClick={() => setSort((s) => (s.key === key ? { key, dir: -s.dir } : { key, dir: key === 'name' ? 1 : -1 }))}>
        {label}{sort.key === key ? (sort.dir > 0 ? ' ↑' : ' ↓') : ''}
      </button>
    </th>
  );

  return (
    <section className={p.wrap} aria-label="Performance overview">
      <div className={p.tiles}>
        {tiles.map((t) => (
          <div key={t.label} className={p.tile}>
            <span className={p.tileLabel}>{t.label}</span>
            <span className={`${p.tileValue} ${t.small ? p.tileSmall : ''} ${t.cls || ''}`} title={t.small ? t.value : undefined}>{t.value}</span>
            {t.note && <span className={`${p.tileNote} ${t.noteCls || ''}`}>{t.note}</span>}
          </div>
        ))}
      </div>

      <div className={p.card}>
        <div className={p.cardHead}>
          <h2 className={p.cardTitle}>Endpoints</h2>
          <input type="search" className={p.search} placeholder="Filter endpoints" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Filter endpoints" />
          {selectedEndpoint !== 'all' && <button type="button" className={p.link} onClick={() => onSelectEndpoint('all')}>Clear selection</button>}
        </div>
        <div className={p.scroll}>
          <table className={p.table}>
            <thead><tr>{COLUMNS.map(([k, l]) => header(k, l))}</tr></thead>
            <tbody>
              {shown.map((e) => (
                <tr key={e.name} className={`${p.row} ${selectedEndpoint === e.name ? p.rowOn : ''}`} onClick={() => onSelectEndpoint(selectedEndpoint === e.name ? 'all' : e.name)}>
                  <td className={`${p.left} ${p.name}`} title={e.name}>{e.name}</td>
                  <td>{e.count}</td>
                  <td>{fmtMs(e.avg)}</td>
                  <td>{fmtMs(e.p50)}</td>
                  <td className={tone(e.p95)}>{fmtMs(e.p95)}</td>
                  <td>{fmtMs(e.max)}</td>
                  <td className={e.errors ? p.bad : p.faint}>{e.errors ? `${e.errors} · ${fmtPct(e.errorRate)}` : '–'}</td>
                  <td><span className={p.share}><span className={p.shareFill} style={{ width: `${Math.max(2, Math.round(e.share * 100))}%` }} /></span> {Math.round(e.share * 100)}%</td>
                </tr>
              ))}
              {!shown.length && <tr><td colSpan={COLUMNS.length} className={p.faint}>No endpoints match.</td></tr>}
            </tbody>
          </table>
        </div>
        {rows.length > 10 && <button type="button" className={p.link} onClick={() => setAll(!all)}>{all ? 'Show top 10' : `Show all ${rows.length}`}</button>}
        <p className={p.hint}>Click a row to focus the response-time chart below on that endpoint. Time share = how much of all request time it uses.</p>
      </div>

      <div className={p.pair}>
        <div className={p.card}>
          <h2 className={p.cardTitle}>Response time distribution</h2>
          {sum.histogram.map((b, i) => (
            <div key={b.upTo} className={p.histRow}>
              <span className={p.histLabel}>{BUCKET_LABELS[i]}</span>
              <span className={p.histTrack}><span className={`${p.histFill} ${i < 4 ? p.fillOk : i < 6 ? p.fillWarn : p.fillBad}`} style={{ width: `${(b.count / maxBucket) * 100}%` }} /></span>
              <span className={p.histCount}>{b.count}</span>
            </div>
          ))}
        </div>
        <div className={p.card}>
          <h2 className={p.cardTitle}>Slowest requests</h2>
          <ul className={p.slowList}>
            {sum.slowest.map((r) => (
              <li key={r.id} className={p.slowItem}>
                <span className={`${p.slowMs} ${tone(r.ms)}`}>{fmtMs(r.ms)}</span>
                <span className={p.slowName} title={r.name}>{r.name}</span>
                <span className={p.faint} title={new Date(r.at).toLocaleString()}>{new Date(r.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                {r.failed && <span className={p.bad}>failed</span>}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
