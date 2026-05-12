import { promisify } from 'util';
import { gunzip } from 'zlib';
import prisma from '@/lib/prisma';
import { createTracker } from '@/lib/server-performance';
import {
  ingestPreparedEnvelopePayload,
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

  if (method === 'OPTIONS') return res.status(200).end();

  switch (method) {
    case 'GET':
      return res.status(200).json({
        success: true,
        message: `Store endpoint for project ID: ${id}`,
        id
      });

    case 'POST': {
      const tracker = createTracker();
      try {
        const rawBody = await getRawBody(req);
        tracker.mark('receive_body');

        const contentEncoding = req.headers['content-encoding'];
        const decompressed =
          contentEncoding === 'gzip'
            ? await gunzipAsync(rawBody)
            : rawBody;
        const decompressedData =
          Buffer.isBuffer(decompressed)
            ? decompressed.toString('utf-8')
            : String(decompressed);
        tracker.mark('decompress');

        let eventData = {};
        try {
          eventData = JSON.parse(decompressedData);
          tracker.mark('parse_json');
        } catch {
          return res.status(400).json({
            success: false,
            error: 'Invalid JSON',
            message: 'Event data must be valid JSON'
          });
        }

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

        const result = await ingestPreparedEnvelopePayload(
          prisma,
          project,
          eventData,
          tracker,
          req
        );
        tracker.mark('notifications');

        if (result.skipped) {
          return res.status(200).json({
            id: eventData.event_id || 'skipped',
            skipped: true,
            reason: result.reason
          });
        }

        return res.status(200).json({
          id:
            eventData.event_id ??
            String(result.event?.id ?? ''),
          skipped: false
        });
      } catch (error) {
        console.error('❌ STORE error:', error);
        return res.status(400).json({
          success: false,
          error: 'Failed to process event data',
          message: error.message,
          details:
            process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
      }
    }

    default:
      res.setHeader('Allow', ['GET', 'POST']);
      return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }
}
