export async function upsertRelease(prisma, projectId, version) {
  if (!version || !String(version).trim()) return;
  const v = String(version);
  const now = new Date();
  await prisma.release.upsert({
    where: {
      projectId_version: { projectId, version: v }
    },
    create: {
      projectId,
      version: v,
      firstSeen: now,
      lastSeen: now,
      eventCount: 1
    },
    update: {
      lastSeen: now,
      eventCount: { increment: 1 }
    }
  });
}
