import prisma from '@/lib/prisma';
import { getSessionUser, canAccessProject } from '@/lib/session';
import { mergeIssues } from '@/lib/issue-merge';

// POST { targetId, sourceIds: [] }: fold the source issues into the target
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const user = await getSessionUser(req);
  if (!user) return res.status(401).json({ success: false, error: 'Not authenticated' });

  const targetId = parseInt(req.body?.targetId);
  const sourceIds = Array.isArray(req.body?.sourceIds) ? req.body.sourceIds.map((id) => parseInt(id)) : [];
  if (isNaN(targetId) || sourceIds.length === 0 || sourceIds.some(isNaN)) {
    return res.status(400).json({ success: false, error: 'targetId and sourceIds are required' });
  }

  try {
    const target = await prisma.issue.findUnique({ where: { id: targetId }, select: { projectId: true } });
    if (!target) return res.status(404).json({ success: false, error: 'Issue not found' });
    if (!(await canAccessProject(user, target.projectId))) {
      return res.status(403).json({ success: false, error: 'No access to this project' });
    }

    const issue = await mergeIssues({ targetId, sourceIds });
    res.status(200).json({ success: true, issue, merged: sourceIds.length });
  } catch (error) {
    console.error('Error merging issues:', error);
    res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
}
