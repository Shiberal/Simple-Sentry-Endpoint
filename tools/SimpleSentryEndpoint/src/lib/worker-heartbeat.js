import os from 'node:os';
import prisma from './prisma.js';

/**
 * Record that a scheduler is alive. Never throws: a heartbeat problem (for example the table not
 * existing yet during a rolling deploy) must not stop monitors from being pinged.
 */
export async function recordHeartbeat({ id, kind, startedAt, intervalMs, ran = 0, error = null }) {
  const now = new Date();
  try {
    await prisma.workerHeartbeat.upsert({
      where: { id },
      create: { id, kind, startedAt, lastTickAt: now, intervalMs, ticks: 1, lastRan: ran, lastError: error },
      update: { kind, lastTickAt: now, intervalMs, ticks: { increment: 1 }, lastRan: ran, lastError: error }
    });
  } catch (e) {
    console.warn('[worker-heartbeat]', e.message || e);
  }
}

export const workerInstanceId = (kind) => `${kind}:${os.hostname()}:${process.pid}`;

/** A scheduler counts as alive if it ticked within a couple of its own intervals. */
export function isHeartbeatAlive(beat, now = Date.now()) {
  return now - new Date(beat.lastTickAt).getTime() < beat.intervalMs * 2.5 + 30000;
}
