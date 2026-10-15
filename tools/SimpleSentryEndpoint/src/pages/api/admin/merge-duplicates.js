import prisma from '@/lib/prisma';
import { checkAdminAuth } from '@/lib/admin';
import { applyDuplicateGroups } from '@/lib/issue-merge';

// Admin bulk regroup: runs the per-project duplicate merge for every project.
// Duplicates are only ever detected within one project.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await checkAdminAuth(req);

    const projects = await prisma.project.findMany({ select: { id: true, name: true } });
    const details = [];
    let duplicatesMerged = 0;

    for (const project of projects) {
      const result = await applyDuplicateGroups(project.id);
      duplicatesMerged += result.issuesMerged;
      if (result.issuesMerged > 0 || result.fingerprintsUpdated > 0) {
        details.push({ projectId: project.id, project: project.name, ...result });
      }
    }

    res.status(200).json({
      success: true,
      message: `Merged ${duplicatesMerged} duplicate issues`,
      details,
      duplicatesMerged
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, error: error.message });
    }
    console.error('Error merging duplicates:', error);
    res.status(500).json({ success: false, error: 'Failed to merge duplicates', message: error.message });
  }
}
