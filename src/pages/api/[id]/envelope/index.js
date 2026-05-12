import { promisify } from 'util';
import { gunzip } from 'zlib';
import prisma from '@/lib/prisma';
import { createTracker } from '@/lib/server-performance';
import { parseSentryEnvelope } from '@/lib/envelope-parse';
import {
  ingestPreparedEnvelopePayload,
  ingestCheckInPayload,
  ingestKind
} from '@/lib/sentry-ingest';
import { extractSentryKey } from '@/lib/sentry-ingest-auth';

const gunzipAsync = promisify(gunzip);

export const config = {
  api: {
    bodyParser: false
  }
};

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  const { id } = req.query;
  const { method } = req;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Content-Encoding, X-Sentry-Auth'
  );
  res.setHeader('Access-Control-Max-Age', '86400');

  if (method === 'OPTIONS') {
    return res.status(200).end();
  }

  switch (method) {
    case 'GET':
      return res.status(200).json({
        success: true,
        message: `Envelope endpoint project ID: ${id}`,
        id
      });

    case 'POST': {
      const tracker = createTracker();
      try {
        const rawBody = await getRawBody(req);
        tracker.mark('receive_body');

        const contentEncoding = req.headers['content-encoding'];
        const decompressedData =
          contentEncoding === 'gzip'
            ? (await gunzipAsync(rawBody)).toString('utf-8')
            : rawBody.toString('utf-8');
        tracker.mark('decompress');

        const projectId = parseInt(id);
        if (isNaN(projectId)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid project ID',
            message: 'Project ID must be a number'
          });
        }

        const project = await prisma.project.findFirst({
          where: { id: projectId }
        });
        tracker.mark('project_lookup');

        if (!project) {
          return res.status(404).json({
            success: false,
            error: 'Project not found',
            message: 'Invalid project ID'
          });
        }

        const sentryKey = extractSentryKey(req);
        if (sentryKey && sentryKey !== project.key) {
          return res.status(403).json({
            success: false,
            error: 'Invalid sentry_key',
            message: 'Key does not match project DSN public key'
          });
        }

        const { envelopeHeader, items } = parseSentryEnvelope(decompressedData);
        tracker.mark('parse_envelope');

        const results = [];
        let lastPayload = {};

        const skipEnvelopeTypes = new Set([
          'attachment',
          'session',
          'sessions',
          'user_report',
          'replay_recording',
          'replay_event',
          'profile'
        ]);

        for (const { header, payload } of items) {
          const itemType = header.type;

          if (itemType === 'check_in') {
            results.push({
              ...(await ingestCheckInPayload(
                prisma,
                project,
                payload,
                tracker
              )),
              itemType: 'check_in'
            });
            continue;
          }

          if (itemType && skipEnvelopeTypes.has(itemType)) continue;

          if (
            typeof payload !== 'object' ||
            payload === null ||
            Array.isArray(payload)
          )
            continue;

          lastPayload = payload;

          results.push({
            ...(await ingestPreparedEnvelopePayload(
              prisma,
              project,
              payload,
              tracker,
              req
            )),
            itemType: itemType || 'event'
          });
        }

        tracker.mark('notifications');

        const lastProcessed = [...results].reverse().find((r) => !r.skipped);

        console.log(
          '✅ envelope ok',
          'items',
          results.length,
          'last',
          lastProcessed?.event?.id
        );

        return res.status(200).json({
          success: true,
          message: `Envelope processed for project: ${project.name}`,
          projectId: project.id,
          envelopeId: envelopeHeader.event_id ?? null,
          envelopeHeader,
          processed: results.map((r) => ({
            skipped: !!r.skipped,
            reason: r.reason ?? null,
            eventType: r.eventType ?? null,
            issueId: r.issue?.id ?? null,
            eventId: r.event?.id ?? null,
            isNewIssue: r.isNewIssue ?? false
          })),
          eventId: lastProcessed?.event?.id ?? null,
          issueId: lastProcessed?.issue?.id ?? null,
          eventType:
            lastProcessed?.eventType ?? ingestKind(lastPayload || {}),
          isNewIssue: lastProcessed?.isNewIssue ?? false,
          id: lastPayload?.event_id ?? lastProcessed?.event?.id ?? null,
          body: decompressedData.split('\n')
        });
      } catch (error) {
        console.error('❌ envelope error:', error);
        return res.status(400).json({
          success: false,
          error: 'Failed to process envelope data',
          message: error.message,
          details:
            process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
      }
    }

    default:
      res.setHeader('Allow', ['GET', 'POST']);
      return res.status(405).json({
        success: false,
        error: 'Method Not Allowed',
        allowed: ['GET', 'POST']
      });
  }
}
