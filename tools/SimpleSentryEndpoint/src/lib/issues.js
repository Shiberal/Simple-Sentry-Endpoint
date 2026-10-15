import prisma from '@/lib/prisma';

const LEVEL_RANK = { debug: 0, info: 1, warning: 2, error: 3, fatal: 4 };

/**
 * Follow the merge chain: a merged issue points at the issue it was folded
 * into (mergedIntoId), so events for its fingerprint land on the survivor.
 */
export async function resolveMergeTarget(issue) {
  let current = issue;
  const visited = new Set();
  while (current?.mergedIntoId && !visited.has(current.id)) {
    visited.add(current.id);
    const next = await prisma.issue.findUnique({ where: { id: current.mergedIntoId } });
    if (!next) break;
    current = next;
  }
  return current || issue;
}

export async function findIssueByFingerprint(projectId, fingerprint) {
  const issue = await prisma.issue.findUnique({
    where: { projectId_fingerprint: { projectId, fingerprint } }
  });
  return issue ? resolveMergeTarget(issue) : null;
}

async function recordOccurrence(existing, { level, culprit }) {
  const now = new Date();
  const data = { count: { increment: 1 }, lastSeen: now };

  if (culprit) data.culprit = culprit;
  // An issue only ever gets more severe as new events arrive
  if ((LEVEL_RANK[level] ?? 0) > (LEVEL_RANK[existing.level] ?? 0)) data.level = level;

  let issue = await prisma.issue.update({ where: { id: existing.id }, data });

  // Regression: a resolved issue that fires again is reopened. The status guard
  // keeps this correct when several events for it arrive at once.
  let reopened = false;
  if (existing.status === 'RESOLVED') {
    const result = await prisma.issue.updateMany({
      where: { id: existing.id, status: 'RESOLVED' },
      data: { status: 'UNRESOLVED', regressedAt: now }
    });
    reopened = result.count > 0;
    if (reopened) issue = await prisma.issue.findUnique({ where: { id: existing.id } });
  }

  return { issue, reopened };
}

/**
 * Attach an event to its issue, creating the issue on first sight.
 *
 * Safe under concurrency: two identical events arriving together used to race
 * between the lookup and the create, and the loser failed on the unique index.
 * Here the loser falls back to updating the winner's issue.
 *
 * @returns {{ issue, isNewIssue: boolean, reopened: boolean }}
 */
export async function upsertIssueForEvent({ projectId, fingerprint, level, culprit, create }) {
  const existing = await findIssueByFingerprint(projectId, fingerprint);
  if (existing) {
    const { issue, reopened } = await recordOccurrence(existing, { level, culprit });
    return { issue, isNewIssue: false, reopened };
  }

  try {
    const now = new Date();
    const issue = await prisma.issue.create({
      data: { projectId, fingerprint, level, culprit, count: 1, firstSeen: now, lastSeen: now, ...create }
    });
    return { issue, isNewIssue: true, reopened: false };
  } catch (error) {
    if (error.code !== 'P2002') throw error;
    const winner = await findIssueByFingerprint(projectId, fingerprint);
    if (!winner) throw error;
    const { issue, reopened } = await recordOccurrence(winner, { level, culprit });
    return { issue, isNewIssue: false, reopened };
  }
}
