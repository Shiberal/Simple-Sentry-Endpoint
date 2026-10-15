import { getSessionUser, canAccessProject } from '@/lib/session';
import { findDuplicateGroups, applyDuplicateGroups } from '@/lib/issue-merge';

// GET  ?projectId=1                       preview duplicate groups (changes nothing)
// POST { projectId, primaryIds?: [] }     merge them (all groups when primaryIds is omitted)
export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const user = await getSessionUser(req);
  if (!user) return res.status(401).json({ success: false, error: 'Not authenticated' });

  const projectId = parseInt(req.method === 'GET' ? req.query.projectId : req.body?.projectId);
  if (isNaN(projectId)) return res.status(400).json({ success: false, error: 'projectId is required' });
  if (!(await canAccessProject(user, projectId))) {
    return res.status(403).json({ success: false, error: 'No access to this project' });
  }

  try {
    if (req.method === 'GET') {
      const { groups, outdated, totalIssues } = await findDuplicateGroups(projectId);
      return res.status(200).json({
        success: true,
        groups,
        outdatedFingerprints: outdated.length,
        totalIssues,
        duplicateIssues: groups.reduce((sum, g) => sum + g.issues.length - 1, 0)
      });
    }

    const primaryIds = Array.isArray(req.body?.primaryIds) ? req.body.primaryIds.map((id) => parseInt(id)) : undefined;
    const result = await applyDuplicateGroups(projectId, { primaryIds });
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error('Error handling duplicates:', error);
    res.status(500).json({ success: false, error: 'Failed to process duplicates', message: error.message });
  }
}
