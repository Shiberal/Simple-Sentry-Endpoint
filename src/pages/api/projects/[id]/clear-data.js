import prisma from '@/lib/prisma';
import { parse } from 'cookie';

function getUserFromCookie(req) {
  try {
    const cookies = parse(req.headers.cookie || '');
    const session = cookies.session;
    if (!session) return null;
    return JSON.parse(session);
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const user = getUserFromCookie(req);
    
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { id } = req.query;
    const projectId = parseInt(id);

    // Verify project exists and user has access
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        users: true,
        _count: {
          select: {
            issues: true,
            events: true
          }
        }
      }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check if user has access to this project
    if (!project.users.some(u => u.id === user.userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Delete all events for this project
    const deletedEvents = await prisma.event.deleteMany({
      where: { projectId }
    });

    // Delete all issues for this project (this will also delete comments due to cascade)
    const deletedIssues = await prisma.issue.deleteMany({
      where: { projectId }
    });

    res.status(200).json({
      success: true,
      message: 'All issues and events cleared successfully',
      deleted: {
        issues: deletedIssues.count,
        events: deletedEvents.count
      }
    });
  } catch (error) {
    console.error('Error clearing project data:', error);
    res.status(500).json({
      error: 'Failed to clear project data',
      message: error.message
    });
  }
}
