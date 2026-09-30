import { upsertRelease } from '@/lib/release-service';
import { upsertIssueForEvent } from '@/lib/issues';
import { generateFingerprint, extractTitle, extractCulprit, extractLevel } from '@/lib/fingerprint';
import { promoteEventFacets } from '@/lib/event-normalize';
import { withPerformance } from '@/lib/server-performance';
import {
  persistAlertAndIntegrationsAfterError
} from '@/lib/sentry-ingest-alerting';

export async function persistErrorLikeEvent(prisma, project, preparedData, tracker, req) {
  const eventData = preparedData;
  const eventTypeEnum =
    eventData.message && !eventData.exception ? 'MESSAGE' : 'ERROR';

  const facets = promoteEventFacets(eventData);
  await upsertRelease(prisma, project.id, facets.promotedRelease);

  const fingerprint = generateFingerprint(eventData, {
    fingerprintByPageUrl: project.fingerprintByPageUrl === true
  });

  const title = extractTitle(eventData);
  const culprit = extractCulprit(eventData);
  const level = extractLevel(eventData);

  // Find or create the issue: follows merges, survives concurrent events, and
  // reopens a resolved issue (regression)
  const upserted = await upsertIssueForEvent({
    projectId: project.id,
    fingerprint,
    level,
    culprit: culprit || undefined,
    create: { title }
  });
  const { issue, isNewIssue } = upserted;
  const wasRegression = upserted.reopened;
  tracker.mark(isNewIssue ? 'issue_create' : 'issue_update');

  const event = await prisma.event.create({
    data: {
      projectId: project.id,
      issueId: issue.id,
      eventType: eventTypeEnum,
      ...facets,
      data: withPerformance(eventData, tracker.getTimings())
    }
  });
  tracker.mark('save_event');

  await persistAlertAndIntegrationsAfterError({
    prisma,
    project,
    issue,
    event,
    eventData,
    isNewIssue,
    wasRegression,
    req
  });

  return { issue, event, isNewIssue, wasRegression };
}

export async function persistTransactionEvent(prisma, project, preparedData, tracker) {
  const eventData = preparedData;
  const facets = promoteEventFacets(eventData);
  await upsertRelease(prisma, project.id, facets.promotedRelease);

  return prisma.event.create({
    data: {
      projectId: project.id,
      issueId: null,
      eventType: 'TRANSACTION',
      ...facets,
      data: withPerformance(eventData, tracker.getTimings())
    }
  });
}

/**
 * Record a Sentry SDK check-in only if a monitor with this slug was created on the server.
 * Name/schedule/environment are not created or renamed by the SDK.
 */
export async function persistCheckInEvent(prisma, project, payload, tracker) {
  const slug = payload.monitor_slug || payload.monitorSlug;
  if (!slug) {
    return { ok: false, reason: 'missing_monitor_slug', event: null };
  }

  const monitor = await prisma.cronMonitor.findUnique({
    where: {
      projectId_slug: { projectId: project.id, slug: String(slug) }
    }
  });

  if (!monitor) {
    return { ok: false, reason: 'unknown_monitor_slug', event: null };
  }

  await prisma.cronMonitor.update({
    where: { id: monitor.id },
    data: {
      lastCheckInAt: new Date(),
      // A paused monitor stays paused: check-ins are still recorded but do not resume it
      status: monitor.status === 'paused' ? 'paused' : String(payload.status || 'unknown')
    }
  });

  await prisma.monitorCheckIn.create({
    data: {
      monitorId: monitor.id,
      status: String(payload.status || 'unknown'),
      environment: payload.environment || null,
      // Sentry SDKs report check-in duration in seconds; we store milliseconds
      durationMs:
        payload.duration !== undefined && Number.isFinite(Number(payload.duration))
          ? Math.round(Number(payload.duration) * 1000)
          : null,
      data: payload
    }
  });

  const event = await prisma.event.create({
    data: {
      projectId: project.id,
      issueId: null,
      eventType: 'CHECK_IN',
      promotedEnv: payload.environment || null,
      data: withPerformance(payload, tracker.getTimings())
    }
  });

  return { ok: true, event };
}
