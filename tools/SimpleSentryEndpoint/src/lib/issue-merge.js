import prisma from '@/lib/prisma';
import { generateFingerprint } from '@/lib/fingerprint';

const LEVEL_RANK = { debug: 0, info: 1, warning: 2, error: 3, fatal: 4 };

// Only these event types get their fingerprint from generateFingerprint();
// CSP and crash issues use their own grouping and must not be regrouped here.
const REGROUPABLE_TYPES = ['ERROR', 'MESSAGE'];

function httpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

/**
 * Merge `sourceIds` into `targetId` (all in one project).
 *
 * Merging is soft: events and comments move to the target, and each source
 * keeps its row with mergedIntoId pointing at the target. New events carrying a
 * source's fingerprint follow that pointer, so merged issues never re-split.
 * Counts and dates are combined onto the target.
 */
export async function mergeIssues({ targetId, sourceIds }) {
  const ids = [...new Set(sourceIds)].filter((id) => id !== targetId);
  if (ids.length === 0) throw httpError('Nothing to merge', 400);

  return prisma.$transaction(async (tx) => {
    const target = await tx.issue.findUnique({ where: { id: targetId } });
    if (!target) throw httpError('Target issue not found', 404);
    if (target.mergedIntoId) throw httpError('Target issue was already merged into another issue', 400);

    const found = await tx.issue.findMany({ where: { id: { in: ids } } });
    if (found.length !== ids.length) throw httpError('Issue not found', 404);
    if (found.some((s) => s.projectId !== target.projectId)) {
      throw httpError('Issues must belong to the same project', 400);
    }
    // Sources that were merged elsewhere already are out of the picture
    const sources = found.filter((s) => !s.mergedIntoId);
    if (sources.length === 0) throw httpError('Selected issues were already merged', 400);
    const sourceIdList = sources.map((s) => s.id);

    await tx.event.updateMany({ where: { issueId: { in: sourceIdList } }, data: { issueId: targetId } });
    await tx.comment.updateMany({ where: { issueId: { in: sourceIdList } }, data: { issueId: targetId } });
    // Anything already merged into a source now points straight at the target
    await tx.issue.updateMany({ where: { mergedIntoId: { in: sourceIdList } }, data: { mergedIntoId: targetId } });
    await tx.issue.updateMany({ where: { id: { in: sourceIdList } }, data: { mergedIntoId: targetId } });

    const all = [target, ...sources];
    const github = all.find((i) => i.githubIssueNumber);

    const merged = await tx.issue.update({
      where: { id: targetId },
      data: {
        count: all.reduce((sum, i) => sum + i.count, 0),
        firstSeen: new Date(Math.min(...all.map((i) => new Date(i.firstSeen)))),
        lastSeen: new Date(Math.max(...all.map((i) => new Date(i.lastSeen)))),
        level: all.map((i) => i.level).sort((a, b) => (LEVEL_RANK[b] ?? 0) - (LEVEL_RANK[a] ?? 0))[0],
        assignedToId: target.assignedToId ?? all.find((i) => i.assignedToId)?.assignedToId ?? null,
        githubIssueUrl: target.githubIssueUrl ?? github?.githubIssueUrl ?? null,
        githubIssueNumber: target.githubIssueNumber ?? github?.githubIssueNumber ?? null
      }
    });

    return { issue: merged, mergedIssueIds: sourceIdList };
  });
}

/**
 * Recompute each issue's fingerprint from its latest event and report which
 * issues now collide (duplicates) or just carry an outdated fingerprint.
 * Read-only: nothing is changed until applyDuplicateGroups() runs.
 */
export async function findDuplicateGroups(projectId) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { fingerprintByPageUrl: true }
  });
  const options = { fingerprintByPageUrl: project?.fingerprintByPageUrl === true };

  const all = await prisma.issue.findMany({
    where: { projectId },
    select: {
      id: true, title: true, fingerprint: true, mergedIntoId: true, count: true, status: true,
      level: true, firstSeen: true, lastSeen: true, githubIssueNumber: true
    },
    orderBy: { firstSeen: 'asc' }
  });

  const byId = new Map(all.map((i) => [i.id, i]));
  const byFingerprint = new Map(all.map((i) => [i.fingerprint, i]));
  const rootOf = (issue) => {
    let current = issue;
    const seen = new Set();
    while (current.mergedIntoId && byId.has(current.mergedIntoId) && !seen.has(current.id)) {
      seen.add(current.id);
      current = byId.get(current.mergedIntoId);
    }
    return current;
  };

  const roots = all.filter((i) => !i.mergedIntoId);
  const bucket = new Map(); // key -> { fingerprint, members: Map<id, issue>, owner }
  const BATCH = 25;

  for (let i = 0; i < roots.length; i += BATCH) {
    await Promise.all(roots.slice(i, i + BATCH).map(async (issue) => {
      const latest = await prisma.event.findFirst({
        where: { issueId: issue.id },
        orderBy: { createdAt: 'desc' },
        select: { eventType: true, data: true }
      });
      if (!latest || !REGROUPABLE_TYPES.includes(latest.eventType)) return;

      const fingerprint = generateFingerprint(latest.data, options);
      // Whoever already owns this fingerprint (or was merged into its owner) is the natural home
      const owner = byFingerprint.get(fingerprint);
      const ownerRoot = owner ? rootOf(owner) : null;
      const key = ownerRoot ? `issue:${ownerRoot.id}` : `fp:${fingerprint}`;

      if (!bucket.has(key)) bucket.set(key, { fingerprint, members: new Map(), ownerRoot });
      const entry = bucket.get(key);
      entry.members.set(issue.id, issue);
      if (ownerRoot) entry.members.set(ownerRoot.id, ownerRoot);
    }));
  }

  const groups = [];
  const outdated = [];
  for (const { fingerprint, members, ownerRoot } of bucket.values()) {
    const list = [...members.values()].sort((a, b) => new Date(a.firstSeen) - new Date(b.firstSeen));
    if (list.length > 1) {
      groups.push({ fingerprint, primaryId: list[0].id, issues: list });
    } else if (!ownerRoot && list[0].fingerprint !== fingerprint) {
      outdated.push({ id: list[0].id, fingerprint });
    }
  }
  groups.sort((a, b) => b.issues.length - a.issues.length);
  return { groups, outdated, totalIssues: roots.length };
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
    const result = await mergeIssues({ targetId: primary.id, sourceIds: rest.map((i) => i.id) });
    merged += result.mergedIssueIds.length;
    // If a merged issue already carried the new fingerprint, events for it follow the merge
    // pointer; otherwise the survivor takes it over.
    if (primary.fingerprint !== group.fingerprint && !rest.some((i) => i.fingerprint === group.fingerprint)) {
      await setFingerprint(primary.id, group.fingerprint);
    }
  }

  let refreshed = 0;
  if (!primaryIds) {
    for (const { id, fingerprint } of outdated) {
      if (await setFingerprint(id, fingerprint)) refreshed++;
    }
  }

  return { groupsMerged: selected.length, issuesMerged: merged, fingerprintsUpdated: refreshed };
}

async function setFingerprint(id, fingerprint) {
  try {
    await prisma.issue.update({ where: { id }, data: { fingerprint } });
    return true;
  } catch (error) {
    if (error.code === 'P2002') return false; // another issue already owns this fingerprint
    throw error;
  }
}
