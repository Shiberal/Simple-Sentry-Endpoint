import fs from 'fs/promises';
import path from 'path';
import prisma from '@/lib/prisma';
import { authenticateProject } from '@/lib/sentry-ingest-auth';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '32mb'
    }
  }
};

function safeBasename(name) {
  const b = path.basename(name || 'artifact.map').replace(/\.\./g, '');
  return b || 'artifact.map';
}

function sanitizeReleaseSegment(rel) {
  return String(rel).replace(/[^\w.@+/-]+/g, '_').replace(/\.\.\//g, '');
}

export default async function handler(req, res) {
  const { id } = req.query;
  const projectId = parseInt(Array.isArray(id) ? id[0] : id, 10);

  if (isNaN(projectId)) {
    return res.status(400).json({ error: 'Invalid project ID' });
  }

  const auth = await authenticateProject(prisma, projectId, req);
  if (auth.error === 'not_found') {
    return res.status(404).json({ error: 'Project not found' });
  }
  if (!auth.ok || !auth.project) {
    return res.status(403).json({ error: 'Invalid sentry_key' });
  }
  const project = auth.project;

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST', 'OPTIONS']);
    return res.status(405).end();
  }

  const release =
    typeof req.query.release === 'string' ? req.query.release : '';
  const headerName =
    typeof req.query.name === 'string' ? req.query.name : 'bundle.js.map';
  const dist =
    typeof req.query.dist === 'string' ? req.query.dist : null;

  if (!release) {
    return res.status(400).json({
      error:
        'release query parameter is required (e.g. ?release=my-app@1.0.0)'
    });
  }

  try {
    const mapPayload = typeof req.body === 'object' && req.body ? req.body : {};

    const root =
      process.env.DEBUG_FILES_DIR ||
      path.join(process.cwd(), 'data', 'debug-files');

    const seg = sanitizeReleaseSegment(release);
    const fileBase = `${Date.now()}-${safeBasename(headerName)}`;
    const relParts = [String(project.id), seg, fileBase];
    const abs = path.join(root, ...relParts);
    await fs.mkdir(path.dirname(abs), { recursive: true });

    await fs.writeFile(abs, JSON.stringify(mapPayload), 'utf8');

    const storagePath = relParts.join('/');

    await prisma.debugFile.create({
      data: {
        projectId: project.id,
        release,
        dist,
        headerName: safeBasename(headerName),
        storagePath,
        checksum: null
      }
    });

    return res.status(201).json({ success: true, path: storagePath });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message || 'upload failed' });
  }
}
