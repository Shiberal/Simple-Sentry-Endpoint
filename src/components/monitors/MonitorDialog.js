import { useState } from 'react';
import { describeSchedule } from '@/lib/monitor-health';
import { parseCronSchedule } from '@/lib/monitor-schedule';
import { PRESETS } from './shared';
import m from '@/styles/Monitors.module.css';

/** Create (monitor = null) or edit a monitor, including its alert settings. */
export default function MonitorDialog({ projects, monitor = null, defaultProjectId, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({
    projectId: monitor?.projectId ?? defaultProjectId ?? projects[0]?.id,
    slug: monitor?.slug || '',
    name: monitor?.name || '',
    schedule: monitor?.schedule || '',
    environment: monitor?.environment || '',
    urls: (monitor?.pingUrls || []).join('\n'),
    alertsEnabled: monitor?.alertsEnabled ?? true,
    failureThreshold: monitor?.failureThreshold ?? 1,
    alertEmails: monitor?.alertEmails || '',
    alertSlackUrl: monitor?.alertSlackUrl || '',
    alertWebhookUrl: monitor?.alertWebhookUrl || ''
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const scheduleOk = !form.schedule.trim() || !!parseCronSchedule(form.schedule.trim());

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const alerts = {
        alertsEnabled: form.alertsEnabled,
        failureThreshold: Number(form.failureThreshold) || 1,
        alertEmails: form.alertEmails.trim(),
        alertSlackUrl: form.alertSlackUrl.trim(),
        alertWebhookUrl: form.alertWebhookUrl.trim()
      };
      // Empty strings clear a field; the slug is fixed because SDK check-ins are matched by it
      const body = monitor
        ? { monitorId: monitor.id, name: form.name.trim(), schedule: form.schedule.trim(), environment: form.environment.trim(), urls: form.urls.trim(), ...alerts }
        : { slug: form.slug.trim(), name: form.name.trim() || undefined, schedule: form.schedule.trim() || undefined, environment: form.environment.trim() || undefined, urls: form.urls.trim(), ...alerts };
      const res = await fetch(`/api/projects/${form.projectId}/monitors`, {
        method: monitor ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'Save failed');
      onSaved?.(j.monitor);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={m.overlay} onClick={onClose}>
      <form className={m.dialog} role="dialog" aria-modal="true" aria-label={monitor ? 'Edit monitor' : 'New monitor'} onClick={(e) => e.stopPropagation()} onSubmit={save}>
        <h2 className={m.dialogTitle}>{monitor ? `Edit ${monitor.slug}` : 'New monitor'}</h2>
        <p className={m.dialogText}>Use the same slug in your SDK&apos;s <code className={m.code}>monitor_slug</code>. Add ping URLs if the server should check them for you.</p>
        {error && <div className={m.error} role="alert">{error}</div>}

        {!monitor && projects.length > 1 && (
          <label className={m.field}>
            <span className={m.label}>Project</span>
            <select value={form.projectId} onChange={(e) => setForm({ ...form, projectId: parseInt(e.target.value, 10) })} className={m.input}>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
        )}
        <label className={m.field}>
          <span className={m.label}>Slug</span>
          <input required autoFocus={!monitor} disabled={!!monitor} value={form.slug} onChange={set('slug')} placeholder="nightly-backup" pattern="^[a-zA-Z0-9_\-]{1,128}$" className={m.input} />
        </label>
        <label className={m.field}>
          <span className={m.label}>Display name <em>(optional)</em></span>
          <input value={form.name} onChange={set('name')} placeholder="Nightly backup" className={m.input} />
        </label>
        <label className={m.field}>
          <span className={m.label}>Schedule <em>(cron, server time)</em></span>
          <input value={form.schedule} onChange={set('schedule')} placeholder="*/5 * * * *" list="cron-presets" className={`${m.input} ${m.mono}`} aria-invalid={!scheduleOk} />
          <datalist id="cron-presets">{PRESETS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</datalist>
          <span className={`${m.hint} ${scheduleOk ? '' : m.textBad}`}>
            {!form.schedule.trim() ? 'Without a schedule, missed runs cannot be detected.' : scheduleOk ? describeSchedule(form.schedule) : 'Not a valid 5-field cron expression.'}
          </span>
        </label>
        <label className={m.field}>
          <span className={m.label}>Environment <em>(optional)</em></span>
          <input value={form.environment} onChange={set('environment')} placeholder="production" className={m.input} />
        </label>
        <label className={m.field}>
          <span className={m.label}>URLs to ping <em>(optional)</em></span>
          <textarea value={form.urls} onChange={set('urls')} placeholder="https://example.com/health" rows={3} className={`${m.input} ${m.mono}`} />
          <span className={m.hint}>One per line. The server GETs them on schedule.</span>
        </label>

        <h3 className={m.detailTitle}>Alerts</h3>
        <label className={m.check}>
          <input type="checkbox" checked={form.alertsEnabled} onChange={set('alertsEnabled')} /> Notify when this monitor starts failing and when it recovers
        </label>
        {form.alertsEnabled && (
          <>
            <label className={m.field}>
              <span className={m.label}>Failed runs in a row before alerting</span>
              <input type="number" min={1} max={20} value={form.failureThreshold} onChange={set('failureThreshold')} className={m.input} />
            </label>
            <label className={m.field}>
              <span className={m.label}>Email recipients <em>(comma separated)</em></span>
              <input value={form.alertEmails} onChange={set('alertEmails')} placeholder="ops@example.com" className={m.input} />
            </label>
            <label className={m.field}>
              <span className={m.label}>Slack webhook URL <em>(optional)</em></span>
              <input value={form.alertSlackUrl} onChange={set('alertSlackUrl')} placeholder="https://hooks.slack.com/services/..." className={m.input} />
            </label>
            <label className={m.field}>
              <span className={m.label}>Generic webhook URL <em>(optional)</em></span>
              <input value={form.alertWebhookUrl} onChange={set('alertWebhookUrl')} placeholder="https://example.com/hook" className={m.input} />
              <span className={m.hint}>The project&apos;s Telegram chat, if set, is notified too.</span>
            </label>
          </>
        )}

        <div className={m.dialogActions}>
          <button type="button" className={m.cancelButton} onClick={onClose}>Cancel</button>
          <button type="submit" className={m.newButton} disabled={saving || !scheduleOk}>{saving ? 'Saving…' : monitor ? 'Save changes' : 'Create monitor'}</button>
        </div>
      </form>
    </div>
  );
}
