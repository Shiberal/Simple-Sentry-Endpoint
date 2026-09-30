import prisma from '@/lib/prisma';
import { generateFingerprint } from '@/lib/fingerprint';

const LEVEL_RANK = { debug: 0, info: 1, warning: 2, error: 3, fatal: 4 };

// Only these event types get their fingerprint from generateFingerprint();
// CSP and crash issues use their own grouping and must not be regrouped here.
const REGROUPABLE_TYPES = ['ERROR', 'MESSAGE'];

/**
 * Merge `sourceIds` into `targetId` (all in the same project).
 * Events and comments move to the target, counts and dates are combined, and the
 * sources' fingerprints are remembered so future events keep landing on the target.
 */
export async function mergeIssues({ targetId, sourceIds }) {
  const ids = [...new Set(sourceIds)].filter((id) => id !== targetId);
  if (ids.length === 0) {
    const error = new Error('Nothing to merge');
    error.statusCode = 400;
    throw error;
  }

  return prisma.$transaction(async (tx) => {
    const target = await tx.issue.findUnique({ where: { id: targetId } });
    const sources = await tx.issue.findMany({ where: { id: { in: ids } } });

    if (!target || sources.length !== ids.length) {
      const error = new Error('Issue not found');
      error.statusCode = 404;
      throw error;
    }
    if (sources.some((s) => s.projectId !== target.projectId)) {
      const error = new Error('Issues must belong to the same project');
      error.statusCode = 400;
      throw error;
    }

    await tx.event.updateMany({ where: { issueId: { in: ids } }, data: { issueId: targetId } });
    await tx.comment.updateMany({ where: { issueId: { in: ids } }, data: { issueId: targetId } });

    const all = [target, ...sources];
    const fingerprints = new Set(target.mergedFingerprints);
    for (const s of sources) {
      fingerprints.add(s.fingerprint);
      s.mergedFingerprints.forEach((f) => fingerprints.add(f));
    }
    fingerprints.delete(target.fingerprint);

    const github = all.find((i) => i.githubIssueNumber);

    await tx.issue.deleteMany({ where: { id: { in: ids } } });

    return tx.issue.update({
      where: { id: targetId },
      data: {
        count: all.reduce((sum, i) => sum + i.count, 0),
        firstSeen: new Date(Math.min(...all.map((i) => new Date(i.firstSeen)))),
        lastSeen: new Date(Math.max(...all.map((i) => new Date(i.lastSeen)))),
        level: all.map((i) => i.level).sort((a, b) => (LEVEL_RANK[b] ?? 0) - (LEVEL_RANK[a] ?? 0))[0],
        mergedFingerprints: [...fingerprints],
        assignedToId: target.assignedToId ?? all.find((i) => i.assignedToId)?.assignedToId ?? null,
        githubIssueUrl: target.githubIssueUrl ?? github?.githubIssueUrl ?? null,
        githubIssueNumber: target.githubIssueNumber ?? github?.githubIssueNumber ?? null
      }
    });
  });
}

/**
 * Recompute each issue's fingerprint from its latest event and report which
 * issues now collide (duplicates) or just carry an outdated fingerprint.
 * Read-only: nothing is changed until applyDuplicateGroups() runs.
 */
export async function findDuplicateGroups(projectId) {
  const issues = await prisma.issue.findMany({
    where: { projectId },
    select: {
      id: true, title: true, fingerprint: true, count: true, status: true, level: true,
      firstSeen: true, lastSeen: true, githubIssueNumber: true
    },
    orderBy: { firstSeen: 'asc' }
  });

  const byFingerprint = new Map();
  const BATCH = 25;
  for (let i = 0; i < issues.length; i += BATCH) {
    await Promise.all(issues.slice(i, i + BATCH).map(async (issue) => {
      const latest = await prisma.event.findFirst({
        where: { issueId: issue.id },
        orderBy: { createdAt: 'desc' },
        select: { eventType: true, data: true }
      });
      if (!latest || !REGROUPABLE_TYPES.includes(latest.eventType)) return;
      const fingerprint = generateFingerprint(latest.data);
      if (!byFingerprint.has(fingerprint)) byFingerprint.set(fingerprint, []);
      byFingerprint.get(fingerprint).push(issue);
    }));
  }

  const groups = [];
  const outdated = [];
  for (const [fingerprint, members] of byFingerprint) {
    members.sort((a, b) => new Date(a.firstSeen) - new Date(b.firstSeen));
    if (members.length > 1) {
      groups.push({ fingerprint, primaryId: members[0].id, issues: members });
    } else if (members[0].fingerprint !== fingerprint) {
      outdated.push({ id: members[0].id, fingerprint });
    }
  }
  groups.sort((a, b) => b.issues.length - a.issues.length);
  return { groups, outdated, totalIssues: issues.length };
}

/**
 * Merge the given duplicate groups (by primaryId; all when omitted) and bring
 * outdated fingerprints up to date so new events group with the right issue.
 */
export async function applyDuplicateGroups(projectId, { primaryIds } = {}) {
  const { groups, outdated } = await findDuplicateGroups(projectId);
  const selected = primaryIds ? groups.filter((g) => primaryIds.includes(g.primaryId)) : groups;

  let merged = 0;
  for (const group of selected) {
    const [primary, ...rest] = group.issues;
    await mergeIssues({ targetId: primary.id, sourceIds: rest.map((i) => i.id) });
    const current = await prisma.issue.findUnique({ where: { id: primary.id } });
    if (current.fingerprint !== group.fingerprint) {
      await setFingerprint(current, group.fingerprint);
    }
    merged += rest.length;
  }

  let refreshed = 0;
  if (!primaryIds) {
    for (const { id, fingerprint } of outdated) {
      const issue = await prisma.issue.findUnique({ where: { id } });
      if (issue && await setFingerprint(issue, fingerprint)) refreshed++;
    }
  }

  return { groupsMerged: selected.length, issuesMerged: merged, fingerprintsUpdated: refreshed };
}

async function setFingerprint(issue, fingerprint) {
  try {
    await prisma.issue.update({
      where: { id: issue.id },
      data: {
        fingerprint,
        mergedFingerprints: [...new Set([...issue.mergedFingerprints.filter((f) => f !== fingerprint), issue.fingerprint])]
      }
    });
    return true;
  } catch (error) {
    if (error.code === 'P2002') return false; // another issue already owns this fingerprint
    throw error;
  }
}
