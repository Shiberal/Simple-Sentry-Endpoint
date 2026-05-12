import fs from 'fs/promises';
import path from 'path';
import { SourceMapConsumer } from 'source-map';
import prisma from '@/lib/prisma';

const consumerCache = new Map();

function cacheKey(projectId, debugFileId) {
  return `${projectId}:${debugFileId}`;
}

async function getConsumer(projectId, dbFile) {
  const k = cacheKey(projectId, dbFile.id);
  if (consumerCache.has(k)) return consumerCache.get(k);
  const root =
    process.env.DEBUG_FILES_DIR || path.join(process.cwd(), 'data', 'debug-files');
  const abs = path.join(root, dbFile.storagePath);
  const raw = await fs.readFile(abs, 'utf8');
  const parsed = JSON.parse(raw);
  const consumer = await new SourceMapConsumer(parsed);
  consumerCache.set(k, consumer);
  return consumer;
}

function framePath(frame) {
  return frame.abs_path || frame.filename || frame.module || '';
}

export async function symbolicatedEventPayload(eventData, localProjectId) {
  const release = eventData.release;
  const exc = eventData.exception?.values?.[0];
  if (!release || !exc?.stacktrace?.frames?.length) {
    return eventData;
  }

  const dist = eventData.dist ?? null;

  const files = await prisma.debugFile.findMany({
    where: {
      projectId: localProjectId,
      release: String(release),
      ...(dist != null && dist !== '' ? { dist: String(dist) } : {})
    }
  });

  if (!files.length) return eventData;

  const mappedFrames = await Promise.all(
    exc.stacktrace.frames.map(async (frame) => {
      const lineno = frame.lineno != null ? Number(frame.lineno) : 1;
      const colno = frame.colno != null ? Number(frame.colno) : 0;
      let out = {
        ...frame,
        __original: { filename: frame.filename, lineno, colno }
      };

      const hintBase = path.basename(String(framePath(frame) || '').split('?')[0]);

      const candidates =
        hintBase ?
          files.filter((f) => {
            const hn = String(f.headerName || '');
            const base = hn.replace(/\.map$/i, '');
            return hn === hintBase || hn === `${hintBase}.map` || base === hintBase || hintBase.includes(base);
          })
        : files;

      for (const dbf of candidates) {
        try {
          const consumer = await getConsumer(localProjectId, dbf);
          const pos = consumer.originalPositionFor({
            line: Math.max(1, lineno),
            column: Math.max(0, colno)
          });
          if (pos.source) {
            out = {
              ...out,
              filename: pos.source,
              function: pos.name || frame.function,
              lineno: pos.line,
              colno: pos.column ?? 0,
              __symbolicated: true
            };
            break;
          }
        } catch {
          continue;
        }
      }
      return out;
    })
  );

  return {
    ...eventData,
    exception: {
      ...eventData.exception,
      values: [
        {
          ...exc,
          stacktrace: { ...exc.stacktrace, frames: mappedFrames }
        },
        ...eventData.exception.values.slice(1)
      ]
    }
  };
}
