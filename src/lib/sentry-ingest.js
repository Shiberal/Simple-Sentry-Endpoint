import { prepareEventForIngest } from '@/lib/ingest-process';
import {
  persistErrorLikeEvent,
  persistTransactionEvent,
  persistCheckInEvent
} from '@/lib/sentry-ingest-persist';

export function ingestKind(eventData) {
  if (eventData?.type === 'transaction') return 'transaction';
  if (eventData?.message && !eventData?.exception) return 'message';
  return 'error';
}

export async function ingestPreparedEnvelopePayload(prisma, project, payload, tracker, req) {
  const kind = ingestKind(payload);
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
    const event = await persistTransactionEvent(prisma, project, data, tracker);
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

export async function ingestCheckInPayload(prisma, project, payload, tracker) {
  const ev = await persistCheckInEvent(prisma, project, payload, tracker);
  if (!ev) {
    return { skipped: true, reason: 'missing_monitor_slug', event: null, issue: null };
  }
  tracker.mark('save_event');
  return { skipped: false, eventType: 'CHECK_IN', event: ev, issue: null };
}
