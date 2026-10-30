import { prepareEventForIngest } from '@/lib/ingest-process';
import {
  persistErrorLikeEvent,
  persistTransactionEvent,
  persistCheckInEvent
} from '@/lib/sentry-ingest-persist';
import { isLogContainer, logContainerToEvents } from '@/lib/sentry-log';

export function ingestKind(eventData) {
  if (isLogContainer(eventData)) return 'log';
  if (eventData?.type === 'transaction') return 'transaction';
  if (eventData?.message && !eventData?.exception) return 'message';
  return 'error';
}

export async function ingestPreparedEnvelopePayload(prisma, project, payload, tracker, req) {
  const kind = ingestKind(payload);
  if (kind === 'log') {
    // Callers should use ingestLogPayload; refuse to store the raw batch as one event
    return {
      skipped: true,
      reason: 'use_log_ingest',
      eventType: 'log',
      event: null,
      issue: null
    };
  }
  const prep = prepareEventForIngest(
    project,
    payload,
    kind === 'transaction' ? 'transaction' : 'error'
  );
  if (prep.skipped) {
    return {
      skipped: true,
      reason: prep.reason,
      eventType: kind,
      event: null,
      issue: null
    };
  }
  const data = prep.data;

  if (kind === 'transaction') {
    const event = await persistTransactionEvent(prisma, project, data, tracker, req);
    return { skipped: false, eventType: 'TRANSACTION', event, issue: null };
  }

  const r = await persistErrorLikeEvent(prisma, project, data, tracker, req);
  return {
    skipped: false,
    eventType: r.event.eventType === 'MESSAGE' ? 'MESSAGE' : 'ERROR',
    event: r.event,
    issue: r.issue,
    isNewIssue: r.isNewIssue,
    wasRegression: r.wasRegression
  };
}

/**
 * Ingest a Sentry `log` envelope item (batch of structured log entries).
 * Each entry becomes a MESSAGE event with contexts from typed attributes.
 */
export async function ingestLogPayload(prisma, project, payload, tracker, req, envelopeHeader = {}) {
  const events = logContainerToEvents(payload, envelopeHeader);
  if (events.length === 0) {
    return [
      {
        skipped: true,
        reason: 'empty_or_invalid_log_container',
        eventType: 'log',
        event: null,
        issue: null
      }
    ];
  }

  const results = [];
  for (const eventData of events) {
    const prep = prepareEventForIngest(project, eventData, 'error');
    if (prep.skipped) {
      results.push({
        skipped: true,
        reason: prep.reason,
        eventType: 'MESSAGE',
        event: null,
        issue: null
      });
      continue;
    }
    const r = await persistErrorLikeEvent(prisma, project, prep.data, tracker, req);
    results.push({
      skipped: false,
      eventType: 'MESSAGE',
      event: r.event,
      issue: r.issue,
      isNewIssue: r.isNewIssue,
      wasRegression: r.wasRegression
    });
  }
  return results;
}

export async function ingestCheckInPayload(prisma, project, payload, tracker) {
  const result = await persistCheckInEvent(prisma, project, payload, tracker);
  if (!result.ok) {
    return {
      skipped: true,
      reason: result.reason,
      event: null,
      issue: null
    };
  }
  tracker.mark('save_event');
  return {
    skipped: false,
    eventType: 'CHECK_IN',
    event: result.event,
    issue: null
  };
}
