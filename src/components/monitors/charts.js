import { useEffect, useRef, useState } from 'react';
import { CHART_MODES, bucketLabel, fmtDuration, pct, span } from './helpers';
import m from '@/styles/Monitors.module.css';

/** Interactive chart over a bucketed series: hover for exact values. */
export function Chart({ series, range, mode, height = 150 }) {
  const [hover, setHover] = useState(null);
  // Draw at the real pixel width so axis text stays readable at any size
  const wrapRef = useRef(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const measure = () => setW(Math.max(280, Math.round(el.clientWidth)));
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const padL = 40;
  const padB = 18;
  const padT = 8;
  const H = height;
  const n = series.length;
  const step = (W - padL) / Math.max(1, n);
  const x = (i) => padL + step * i + step / 2;

  let max = 100;
  let min = 0;
  if (mode === 'uptime') {
    const vals = series.map((d) => d.uptime).filter((v) => v != null);
    min = vals.length ? Math.max(0, Math.floor((Math.min(...vals) - 5) / 10) * 10) : 0;
    if (min >= 100) min = 90;
  }
  if (mode === 'latency') max = Math.max(10, ...series.map((d) => d.p95Ms || d.avgMs || 0));
  if (mode === 'failures') max = Math.max(1, ...series.map((d) => d.ok + d.error));
  const y = (v) => padT + (H - padT - padB) * (1 - (v - min) / (max - min));
  const line = (key) => {
    let path = '';
    let pen = false;
    series.forEach((d, i) => {
      if (d[key] == null) { pen = false; return; }
      path += `${pen ? 'L' : 'M'}${x(i).toFixed(1)} ${y(d[key]).toFixed(1)} `;
      pen = true;
    });
    return path;
  };
  const ticks = [0, 0.5, 1].map((f) => min + (max - min) * f);
  const fmtTick = (v) => (mode === 'uptime' ? `${Math.round(v)}%` : mode === 'latency' ? fmtDuration(v) : Math.round(v));
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor((W - padL) / 110))));

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    setHover(Math.min(n - 1, Math.max(0, Math.floor((px - padL) / step))));
  };
  const h = hover != null ? series[hover] : null;

  return (
    <div className={m.chartWrap} ref={wrapRef}>
      <svg viewBox={`0 0 ${W} ${H}`} className={m.chart} role="img" aria-label={`${mode} over the last ${range}`} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W} y1={y(t)} y2={y(t)} className={m.gridLine} />
            <text x={padL - 6} y={y(t) + 3} textAnchor="end" className={m.axisText}>{fmtTick(t)}</text>
          </g>
        ))}
        {series.map((d, i) => i % labelEvery === 0 && (
          <text key={d.date} x={x(i)} y={H - 4} textAnchor="middle" className={m.axisText}>{bucketLabel(d.date, range)}</text>
        ))}
        {mode === 'failures' && series.map((d, i) => {
          const bw = Math.max(2, step * 0.7);
          const okH = (H - padT - padB) * (d.ok / max);
          const errH = (H - padT - padB) * (d.error / max);
          return (
            <g key={d.date}>
              <rect x={x(i) - bw / 2} y={H - padB - okH} width={bw} height={okH} className={m.fillOk} />
              <rect x={x(i) - bw / 2} y={H - padB - okH - errH} width={bw} height={errH} className={m.fillBad} />
            </g>
          );
        })}
        {mode === 'uptime' && (
          <>
            {series.map((d, i) => d.uptime != null && d.uptime < 90 && <rect key={d.date} x={x(i) - step / 2} y={padT} width={step} height={H - padT - padB} className={m.fillBadSoft} />)}
            <path d={line('uptime')} className={m.lineOk} fill="none" />
            {series.map((d, i) => d.uptime != null && <circle key={d.date} cx={x(i)} cy={y(d.uptime)} r={n > 40 ? 1.5 : 2.5} className={d.error ? m.dotBad : m.dotOk} />)}
          </>
        )}
        {mode === 'latency' && (
          <>
            <path d={line('p95Ms')} className={m.lineWarn} fill="none" strokeDasharray="4 3" />
            <path d={line('avgMs')} className={m.lineInfo} fill="none" />
          </>
        )}
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={padT} y2={H - padB} className={m.cursor} />}
      </svg>
      {h && (
        <div className={m.tooltip} style={{ left: `${(x(hover) / W) * 100}%` }}>
          <strong>{bucketLabel(h.date, range)}</strong>
          <span>{h.ok + h.error} run{h.ok + h.error === 1 ? '' : 's'} · {h.error} failed</span>
          <span>Uptime {pct(h.uptime)}</span>
          <span>Avg {fmtDuration(h.avgMs)}{h.p95Ms != null && <> · p95 {fmtDuration(h.p95Ms)}</>}</span>
        </div>
      )}
      {mode === 'latency' && <p className={m.legend}><span className={m.keyInfo} /> Average <span className={m.keyWarn} /> p95 (successful runs)</p>}
      {mode === 'failures' && <p className={m.legend}><span className={m.keyOk} /> Succeeded <span className={m.keyBad} /> Failed</p>}
    </div>
  );
}

export function ChartPanel({ series, range, modes = CHART_MODES, height }) {
  const [mode, setMode] = useState(modes[0][0]);
  return (
    <div>
      <div className={m.segmented} role="tablist" aria-label="Chart">
        {modes.map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={mode === k} className={`${m.segment} ${mode === k ? m.segmentOn : ''}`} onClick={() => setMode(k)}>{label}</button>
        ))}
      </div>
      <Chart series={series} range={range} mode={mode} height={height} />
    </div>
  );
}


/** Tiny uptime trend for compact headers. */
export function Sparkline({ series, width = 120, height = 22 }) {
  const pts = (series || []).map((d, i) => ({ i, v: d.uptime })).filter((p) => p.v != null);
  if (pts.length < 2) return null;
  const lo = Math.min(90, ...pts.map((p) => p.v));
  const n = series.length - 1 || 1;
  const d = pts.map((p) => `${((p.i / n) * width).toFixed(1)},${(height - ((p.v - lo) / (100 - lo || 1)) * (height - 2) - 1).toFixed(1)}`).join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={m.spark} role="img" aria-label="Uptime trend">
      <polyline points={d} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}


const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** 0 = no runs, 1 = all ok, 2 = under 5% failed, 3 = under 25%, 4 = 25%+ */
function dayLevel(d) {
  const total = d ? d.ok + d.error : 0;
  if (!total) return 0;
  const rate = d.error / total;
  return rate === 0 ? 1 : rate < 0.05 ? 2 : rate < 0.25 ? 3 : 4;
}

const WEEKS = 53;

/** GitHub-style year grid: one cell per local day, colour = share of failed runs. Click a day to select it. */
export function Heatmap({ projectId, monitorId, selected, onSelect, refreshKey, daysData = null }) {
  const [fetched, setFetched] = useState(null);
  const days = daysData || fetched;
  const [err, setErr] = useState('');

  useEffect(() => {
    if (daysData) return undefined;
    let live = true;
    const q = new URLSearchParams({ monitorId: String(monitorId), days: String(WEEKS * 7), tzOffset: String(-new Date().getTimezoneOffset()) });
    fetch(`/api/projects/${projectId}/monitors/heatmap?${q}`)
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (!live) return;
        if (!ok) throw new Error(j.error || 'Could not load history');
        setFetched(Object.fromEntries(j.days.map((d) => [d.date, d])));
      })
      .catch((e) => live && setErr(e.message));
    return () => { live = false; };
  }, [projectId, monitorId, refreshKey, daysData]);

  if (err) return <p className={m.textBad}>{err}</p>;
  if (!days) return <p className={m.faint}>Loading history…</p>;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(start.getDate() - ((WEEKS - 1) * 7 + today.getDay()));
  const cells = [];
  for (let i = 0; i < WEEKS * 7; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    if (d > today) break;
    cells.push({ date: d, key: dayKey(d), data: days[dayKey(d)] });
  }
  const months = [];
  cells.forEach((c, i) => {
    if (i % 7 === 0 && (i === 0 || c.date.getMonth() !== cells[i - 7].date.getMonth())) months.push({ week: i / 7, label: c.date.toLocaleString([], { month: 'short' }) });
  });
  const failedDays = Object.values(days).filter((d) => d.error > 0).length;
  const runs = Object.values(days).reduce((n, d) => n + d.ok + d.error, 0);
  const sel = selected ? days[selected] : null;

  return (
    <div>
      <p className={m.faint}>{runs.toLocaleString()} runs in the last year · {failedDays} day{failedDays === 1 ? '' : 's'} with failures</p>
      <div className={m.heatScroll}>
        <div className={m.heatMonths} style={{ gridTemplateColumns: `repeat(${Math.ceil(cells.length / 7)}, 12px)` }}>
          {months.map((mo) => <span key={mo.week} style={{ gridColumn: mo.week + 1 }}>{mo.label}</span>)}
        </div>
        <div className={m.heatGrid} role="group" aria-label="Daily results, last year">
          {cells.map((c, i) => {
            const total = c.data ? c.data.ok + c.data.error : 0;
            const label = `${c.date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}: ${total ? `${c.data.error} failed of ${total} runs` : 'no runs'}`;
            return (
              <button
                key={c.key}
                type="button"
                title={label}
                aria-label={label}
                aria-pressed={selected === c.key}
                className={`${m.heatCell} ${m[`heat${dayLevel(c.data)}`]} ${selected === c.key ? m.heatSel : ''}`}
                style={i < 7 ? { gridRow: c.date.getDay() + 1, gridColumn: 1 } : undefined}
                onClick={() => onSelect(selected === c.key ? null : c.key)}
              />
            );
          })}
        </div>
      </div>
      <div className={m.heatLegend}>
        <span>Healthy</span>
        {[1, 2, 3, 4].map((l) => <span key={l} className={`${m.heatCell} ${m[`heat${l}`]}`} />)}
        <span>Failing</span>
      </div>
      {selected && (
        <p className={m.detailLine}>
          <strong>{new Date(`${selected}T00:00:00`).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</strong>
          {sel
            ? <> · {sel.ok + sel.error} runs · <span className={sel.error ? m.textBad : m.textOk}>{sel.error} failed</span> · {Math.round((sel.ok / (sel.ok + sel.error)) * 1000) / 10}% success{sel.avgMs != null ? ` · avg ${fmtDuration(sel.avgMs)}` : ''}</>
            : ' · no runs'}
        </p>
      )}
    </div>
  );
}



/** Last 24h as 5-minute slices: green = all ok, red = any failure (taller with more failures), gray = no runs. */
export function ActivityStrip({ slices }) {
  const peak = Math.max(1, ...slices.map((s) => s.error));
  return (
    <div className={m.activityStrip} role="img" aria-label="Runs over the last 24 hours">
      {slices.map((s) => {
        const total = s.ok + s.error;
        const tone = !total ? m.barEmpty : s.error ? m.barBad : m.barOk;
        const height = !total ? 12 : s.error ? 55 + Math.round((s.error / peak) * 45) : 30;
        return (
          <span
            key={s.at}
            className={`${m.bar} ${tone}`}
            style={{ height: `${height}%` }}
            title={`${new Date(s.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · ${total ? `${s.error} failed of ${total} runs` : 'no runs'}`}
          />
        );
      })}
    </div>
  );
}
