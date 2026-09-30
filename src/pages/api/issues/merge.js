import prisma from '@/lib/prisma';
import { getSessionUser, canAccessProject } from '@/lib/session';
import { mergeIssues } from '@/lib/issue-merge';

// POST { projectId, targetIssueId, sourceIssueIds: [] }: fold the source issues into the target
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end();
  }

  const user = await getSessionUser(req);
  if (!user) return res.status(401).json({ success: false, error: 'Not authenticated' });

  const { targetIssueId, sourceIssueIds, projectId } = req.body || {};
  const pid = parseInt(projectId, 10);
  const targetId = parseInt(targetIssueId, 10);
  const sources = Array.isArray(sourceIssueIds)
    ? sourceIssueIds.map((x) => parseInt(x, 10)).filter((n) => !isNaN(n))
    : [];

  if (!projectId || isNaN(pid) || isNaN(targetId) || sources.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'projectId (number), targetIssueId (number), and sourceIssueIds (number[]) required'
    });
  }
  if (sources.includes(targetId)) {
    return res.status(400).json({ success: false, error: 'targetIssueId must not appear in sourceIssueIds' });
  }
  if (!(await canAccessProject(user, pid))) {
    return res.status(403).json({ success: false, error: 'Access denied' });
  }

  try {
    const target = await prisma.issue.findUnique({ where: { id: targetId }, select: { projectId: true } });
    if (!target || target.projectId !== pid) {
      return res.status(404).json({ success: false, error: 'Target issue not found' });
    }

    const { issue, mergedIssueIds } = await mergeIssues({ targetId, sourceIds: sources });
    return res.status(200).json({ success: true, mergedIssueIds, issue });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ success: false, error: error.message });
    console.error('Error merging issues:', error);
    return res.status(500).json({ success: false, error: 'Merge failed', message: error.message });
  }
}
