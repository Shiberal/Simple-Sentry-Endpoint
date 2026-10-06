import Link from 'next/link';
import { useEffect, useState } from 'react';
import { HEALTH, ago, fmtDuration, pct, projectLabel, rateTone, span } from './helpers';
import { ActivityStrip, Heatmap } from './charts';
import m from '@/styles/Monitors.module.css';

/** All-projects activity: 24h strip plus the yearly grid, across every monitor. */
export function ActivityOverview({ projectId = null, refreshKey, monitors = [], now }) {
  const [data, setData] = useState(null);
  const [day, setDay] = useState(null);

  useEffect(() => {
    let live = true;
    const q = new URLSearchParams({ tzOffset: String(-new Date().getTimezoneOffset()) });
    if (projectId) q.set('projectId', String(projectId));
    fetch(`/api/monitors/activity?${q}`).then((r) => r.json()).then((j) => live && j.success && setData(j)).catch(() => {});
    return () => { live = false; };
  }, [projectId, refreshKey]);

  if (!data || !data.slices.length) return null;
  return (
    <>
    {monitors.length > 0 && <SiteGlance monitors={monitors} slicesById={data.perMonitor || {}} now={now} />}
    <section className={m.overview} aria-label="Activity">
      <h2 className={m.detailTitle}>Last 24 hours</h2>
      <ActivityStrip slices={data.slices} />
      <h2 className={`${m.detailTitle} ${m.activityGap}`}>Last year</h2>
      <Heatmap daysData={Object.fromEntries(data.days.map((d) => [d.date, d]))} selected={day} onSelect={setDay} />
    </section>
    </>
  );
}

const hostOfUrl = (u) => { try { return new URL(u).host; } catch { return null; } };

/** One card per monitored site: status, 24h success, last run and the last 24 hours in 5-minute slices. */
export function SiteGlance({ monitors, slicesById, now }) {
  return (
    <section aria-label="Sites at a glance" className={m.glanceGrid}>
      {monitors.map((x) => {
        const h = HEALTH[x.health] || HEALTH.unknown;
        const w = x.stats?.windows?.['24h'];
        const host = hostOfUrl(x.pingUrls?.[0]);
        const label = x.name || x.slug;
        return (
          <Link key={x.id} href={`/monitors/${x.id}`} className={`${m.glanceCard} ${m[`glance_${h.tone}`]}`}>
            <div className={m.glanceHead}>
              <span className={`${m.status} ${m[`tone_${h.tone}`]}`}><span className={m.statusDot} />{h.label}</span>
              <span className={`${m.glanceUptime} ${rateTone(w?.uptime)}`}>{pct(w?.uptime)}</span>
            </div>
            <div className={m.glanceName} title={label}>{label}</div>
            <div className={m.glanceSub}>{host && host !== label ? `${host} · ` : ''}{projectLabel(x)}{x.environment ? ` · ${x.environment}` : ''}</div>
            <ActivityStrip slices={slicesById[x.id] || []} />
            <div className={m.glanceFoot}>
              <span>{x.lastRunAt ? `Last run ${ago(x.lastRunAt, now)}` : 'No runs yet'}{x.lastDurationMs != null ? ` · ${fmtDuration(x.lastDurationMs)}` : ''}</span>
              <span>{w?.runs ?? 0} runs · avg {fmtDuration(w?.avgMs)}</span>
            </div>
            {x.health !== 'ok' && x.healthReason && <div className={m.glanceReason}>{x.healthReason}</div>}
          </Link>
        );
      })}
    </section>
  );
}
