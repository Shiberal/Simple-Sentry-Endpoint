import prisma from '@/lib/prisma';
import { parse } from 'cookie';

function getUser(req) {
  try {
    const cookies = parse(req.headers.cookie || '');
    const session = cookies.session;
    return session ? JSON.parse(session) : null;
  } catch {
    return null;
  }
}

async function userHasProject(userId, projectId) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      users: { select: { id: true } }
    }
  });
  return project?.users.some((u) => u.id === userId);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end();
  }

  const user = getUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { targetIssueId, sourceIssueIds, projectId } = req.body || {};
  const pid = parseInt(projectId, 10);
  const targetId = parseInt(targetIssueId, 10);

  const sources = Array.isArray(sourceIssueIds)
    ? sourceIssueIds.map((x) => parseInt(x, 10)).filter((n) => !isNaN(n))
    : [];

  if (
    !projectId ||
    isNaN(pid) ||
    isNaN(targetId) ||
    sources.length === 0
  ) {
    return res.status(400).json({
      success: false,
      error:
        'projectId (number), targetIssueId (number), and sourceIssueIds (number[]) required'
    });
  }

  if (sources.includes(targetId)) {
    return res.status(400).json({
      success: false,
      error: 'targetIssueId must not appear in sourceIssueIds'
    });
  }

  if (!(await userHasProject(user.userId, pid))) {
    return res.status(403).json({ success: false, error: 'Access denied' });
  }

  try {
    const target = await prisma.issue.findUnique({ where: { id: targetId } });
    if (!target || target.projectId !== pid) {
      return res.status(404).json({ success: false, error: 'Target issue not found' });
    }

    const merged = [];

    await prisma.$transaction(async (tx) => {
      for (const sid of sources) {
        const src = await tx.issue.findUnique({ where: { id: sid } });
        if (!src || src.projectId !== pid) continue;

        await tx.event.updateMany({
          where: { issueId: sid },
          data: { issueId: targetId }
        });

        await tx.issue.update({
          where: { id: sid },
          data: { mergedIntoId: targetId }
        });

        merged.push(sid);
      }

      const newCount = await tx.event.count({ where: { issueId: targetId } });

      await tx.issue.update({
        where: { id: targetId },
        data: {
          lastSeen: new Date(),
          count: newCount
        }
      });
    });

    return res.status(200).json({ success: true, mergedIssueIds: merged });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      error: 'Merge failed',
      message: error.message
    });
  }
}
