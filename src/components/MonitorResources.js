import { useCallback, useEffect, useState } from 'react';
import m from '@/styles/Monitors.module.css';

const fmtBytes = (n) => {
  if (n == null) return '—';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(i > 1 ? 1 : 0)} ${u[i]}`;
};

function Spark({ values, max, label }) {
  if (values.length < 2) return <p className={m.faint}>Collecting samples…</p>;
  const top = Math.max(max || 0, ...values, 1);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${30 - (v / top) * 28}`).join(' ');
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" width="100%" height="44" role="img" aria-label={label} style={{ color: 'var(--accent, currentColor)' }}>
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default function MonitorResources({ projectId, monitorId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const base = `/api/projects/${projectId}/monitors/resources`;

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${base}?monitorId=${monitorId}&hours=6`);
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Could not load');
      setData(j);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, [base, monitorId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  const generate = async () => {
    if (data?.reportToken && !window.confirm('Generate a new token? The current one stops working.')) return;
    setBusy(true);
    try {
      const res = await fetch(base, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ monitorId }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Failed');
      setData((d) => ({ ...d, reportToken: j.reportToken }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const samples = data?.samples || [];
  const latest = data?.latest;
  const cpu = samples.map((s) => s.cpuPercent).filter((v) => v != null);
  const mem = samples.map((s) => s.memUsedBytes).filter((v) => v != null);
  const limitCores = latest?.cpuLimitCores;

  return (
    <div className={m.detailGrid} style={{ marginTop: 16 }}>
      <div>
        <h3 className={m.detailTitle}>Resource usage</h3>
        {error && <p className={m.faint}>{error}</p>}
        {data && samples.length === 0 && (
          <p className={m.faint}>
            {data.reportToken
              ? 'Token created. Waiting for the first sample from your service.'
              : 'Not reporting yet. Generate a token and run the reporter in your service container.'}
          </p>
        )}
        {samples.length > 0 && (
          <>
            <p className={m.detailLine}><span>CPU</span> {latest.cpuPercent == null ? '—' : `${latest.cpuPercent.toFixed(1)}%`}{limitCores ? ` of ${limitCores} core limit` : ''} (100% = 1 core)</p>
            <Spark values={cpu} max={limitCores ? limitCores * 100 : 100} label="CPU, last 6 hours" />
            <p className={m.detailLine}><span>RAM</span> {fmtBytes(latest.memUsedBytes)}{latest.memLimitBytes ? ` of ${fmtBytes(latest.memLimitBytes)}` : ''}</p>
            <Spark values={mem} max={latest.memLimitBytes || 0} label="RAM, last 6 hours" />
            <p className={m.faint}>Last 6 hours, latest sample {new Date(latest.createdAt).toLocaleTimeString()}</p>
          </>
        )}
      </div>
      <div>
        <h3 className={m.detailTitle}>Reporter</h3>
        {data?.reportToken && (
          <p className={m.detailLine}><span>Token</span> <code className={m.code}>{data.reportToken}</code></p>
        )}
        <p className={m.faint}>Run <code className={m.code}>reporter/resource-reporter.sh</code> in the service container with <code className={m.code}>SENTRY_REPORT_URL</code> and <code className={m.code}>SENTRY_REPORT_TOKEN</code> set. See reporter/README.md.</p>
        <div className={m.detailActions}>
          <button type="button" className={m.editButton} onClick={generate} disabled={busy}>
            {data?.reportToken ? 'Regenerate token' : 'Generate token'}
          </button>
        </div>
      </div>
    </div>
  );
}
