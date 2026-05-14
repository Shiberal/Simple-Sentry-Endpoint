import prisma from '@/lib/prisma';
import { pingUrlListSequential } from '@/lib/monitor-http-ping';

export async function runMonitorHttpPings(filters = {}) {
  const where = {};
  if (filters.monitorId != null) where.id = filters.monitorId;
  if (filters.projectId != null) where.projectId = filters.projectId;

  const monitors = await prisma.cronMonitor.findMany({ where });

  const summaries = [];

  for (const m of monitors) {
    const urls = Array.isArray(m.pingUrls) ? m.pingUrls : [];
    if (!urls.length) continue;

    const { allOk, results, totalMs } = await pingUrlListSequential(urls);

    await prisma.$transaction(async (tx) => {
      await tx.cronMonitor.update({
        where: { id: m.id },
        data: {
          lastCheckInAt: new Date(),
          status: allOk ? 'ok' : 'error'
        }
      });

      await tx.monitorCheckIn.create({
        data: {
          monitorId: m.id,
          status: allOk ? 'ok' : 'error',
          environment: m.environment,
          durationMs: totalMs,
          data: {
            source: 'server_http',
            results,
            totalMs,
            urls
          }
        }
      });

      await tx.event.create({
        data: {
          projectId: m.projectId,
          issueId: null,
          eventType: 'CHECK_IN',
          promotedEnv: m.environment,
          data: {
            monitor_slug: m.slug,
            status: allOk ? 'ok' : 'error',
            source: 'server_http',
            results,
            totalMs,
            urls
          }
        }
      });
    });

    summaries.push({
      monitorId: m.id,
      slug: m.slug,
      allOk,
      urls,
      totalMs,
      results
    });
  }

  return summaries;
}
