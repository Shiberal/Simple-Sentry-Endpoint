import { upsertRelease } from '@/lib/release-service';
import { generateFingerprint, extractTitle, extractCulprit, extractLevel } from '@/lib/fingerprint';
import { promoteEventFacets } from '@/lib/event-normalize';
import { withPerformance } from '@/lib/server-performance';
import {
  persistAlertAndIntegrationsAfterError
} from '@/lib/sentry-ingest-alerting';

async function mergeChainIssue(prisma, issue) {
  let cur = issue;
  const visited = new Set();
  while (cur?.mergedIntoId && !visited.has(cur.id)) {
    visited.add(cur.id);
    cur = await prisma.issue.findUnique({ where: { id: cur.mergedIntoId } });
  }
  return cur || issue;
}

export async function persistErrorLikeEvent(prisma, project, preparedData, tracker, req) {
  const eventData = preparedData;
  const eventTypeEnum =
    eventData.message && !eventData.exception ? 'MESSAGE' : 'ERROR';

  const facets = promoteEventFacets(eventData);
  await upsertRelease(prisma, project.id, facets.promotedRelease);

  const fingerprint = generateFingerprint(eventData, {
    fingerprintByPageUrl: project.fingerprintByPageUrl === true
  });

  let issue = await prisma.issue.findUnique({
    where: {
      projectId_fingerprint: { projectId: project.id, fingerprint }
    }
  });
  tracker.mark('issue_lookup');

  let isNewIssue = false;
  let wasRegression = false;

  const title = extractTitle(eventData);
  const culprit = extractCulprit(eventData);
  const level = extractLevel(eventData);

  if (issue) {
    issue = await mergeChainIssue(prisma, issue);
    const prevResolved = issue.status === 'RESOLVED';
    issue = await prisma.issue.update({
      where: { id: issue.id },
      data: {
        count: { increment: 1 },
        lastSeen: new Date(),
        ...(prevResolved ? { status: 'UNRESOLVED' } : {}),
        culprit: culprit || undefined,
        level
      }
    });
    wasRegression = prevResolved;
    tracker.mark('issue_update');
  } else {
    isNewIssue = true;
    issue = await prisma.issue.create({
      data: {
        projectId: project.id,
        fingerprint,
        title,
        culprit,
        level,
        count: 1,
        firstSeen: new Date(),
        lastSeen: new Date()
      }
    });
    tracker.mark('issue_create');
  }

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
      status: String(payload.status || 'unknown')
    }
  });

  await prisma.monitorCheckIn.create({
    data: {
      monitorId: monitor.id,
      status: String(payload.status || 'unknown'),
      environment: payload.environment || null,
      durationMs:
        payload.duration !== undefined ? Number(payload.duration) : null,
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
