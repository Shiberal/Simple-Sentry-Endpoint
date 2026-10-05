import { sendMonitorAlertEmail } from './email.js';
import { sendTelegramMessage } from './telegram.js';
import { postGenericWebhook, postSlackIncomingWebhook } from './webhook-alerts.js';

/** Last N finished runs, newest first, is enough to tell whether the failure threshold is reached. */
export function thresholdReached(recentFinished, threshold) {
  const need = Math.max(1, threshold || 1);
  return recentFinished.length >= need && recentFinished.slice(0, need).every((c) => c.status === 'error');
}

export function describeFailure(checkIn) {
  const failed = (checkIn?.data?.results || []).filter((r) => r.ok === false);
  if (!failed.length) return checkIn?.data?.error || null;
  return failed.slice(0, 2).map((r) => `${r.url}: ${r.status ? `HTTP ${r.status}` : r.error || 'failed'}`).join('; ');
}

export function buildAlertMessage({ kind, monitor, project, reason, downForMs, baseUrl }) {
  const name = monitor.name || monitor.slug;
  const link = baseUrl ? `${baseUrl}/monitors/${monitor.id}` : null;
  const head = kind === 'down' ? `🔴 Monitor failing: ${name}` : `✅ Monitor recovered: ${name}`;
  const lines = [head, `Project: ${project?.name || monitor.projectId}${monitor.environment ? ` · ${monitor.environment}` : ''}`];
  if (kind === 'down' && reason) lines.push(`Reason: ${reason}`);
  if (kind === 'recovered' && downForMs != null) lines.push(`Down for ${Math.max(1, Math.round(downForMs / 60000))} min`);
  if (link) lines.push(link);
  return { subject: `[${project?.name || 'Monitor'}] ${head.replace(/^\S+ /, '')}`, text: lines.join('\n') };
}

/** Fan a monitor state change out to every configured channel; one channel failing never blocks the others. */
export async function notifyMonitorChange({ kind, monitor, project, reason, downForMs, baseUrl }) {
  const { subject, text } = buildAlertMessage({ kind, monitor, project, reason, downForMs, baseUrl });
  const sent = [];
  const attempt = async (channel, fn) => {
    try {
      await fn();
      sent.push(channel);
    } catch (e) {
      console.warn(`[monitor-alerts] ${channel} failed:`, e.message || e);
    }
  };
  const emails = String(monitor.alertEmails || '').split(/[,\s]+/).filter(Boolean);
  if (emails.length) await attempt('email', () => sendMonitorAlertEmail({ recipients: emails, subject, text }));
  if (monitor.alertSlackUrl) await attempt('slack', () => postSlackIncomingWebhook(monitor.alertSlackUrl, text));
  if (monitor.alertWebhookUrl) {
    await attempt('webhook', () => postGenericWebhook(monitor.alertWebhookUrl, {
      type: kind === 'down' ? 'monitor.failing' : 'monitor.recovered',
      monitor: { id: monitor.id, slug: monitor.slug, name: monitor.name, environment: monitor.environment },
      project: project ? { id: project.id, name: project.name } : null,
      reason: reason || null,
      downForMs: downForMs ?? null,
      text
    }));
  }
  if (project?.telegramChatId) await attempt('telegram', () => sendTelegramMessage(project.telegramChatId, text));
  return sent;
}

const isHttpUrl = (u) => { try { return ['http:', 'https:'].includes(new URL(u).protocol); } catch { return false; } };

/** Validate alert settings from a request body. Returns { data } with only the fields that were sent, or { error }. */
export function parseAlertFields(body = {}) {
  const data = {};
  if (body.alertsEnabled !== undefined) data.alertsEnabled = !!body.alertsEnabled;
  if (body.failureThreshold !== undefined) {
    const n = parseInt(body.failureThreshold, 10);
    if (!Number.isFinite(n) || n < 1 || n > 20) return { error: 'failureThreshold must be between 1 and 20' };
    data.failureThreshold = n;
  }
  if (body.alertEmails !== undefined) {
    const list = String(body.alertEmails || '').split(/[,\s]+/).filter(Boolean);
    if (list.some((e) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e))) return { error: 'alertEmails must be valid email addresses' };
    data.alertEmails = list.join(', ');
  }
  for (const key of ['alertSlackUrl', 'alertWebhookUrl']) {
    if (body[key] === undefined) continue;
    const v = String(body[key] || '').trim();
    if (v && !isHttpUrl(v)) return { error: `${key} must be an http(s) URL` };
    data[key] = v || null;
  }
  return { data };
}
