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
  const { method, query } = req;
  const { id } = query;
  const user = getUserFromCookie(req);

  switch (method) {
    case 'GET':
      try {
        const project = await prisma.project.findUnique({
          where: { id: parseInt(id) },
          include: {
            users: {
              select: {
                id: true,
                email: true,
                name: true
              }
            },
            _count: {
              select: { events: true }
            }
          }
        });

        if (!project) {
          return res.status(404).json({ error: 'Project not found' });
        }

        // Check if user has access to this project
        if (user && !project.users.some(u => u.id === user.userId)) {
          return res.status(403).json({ error: 'Access denied' });
        }

        res.status(200).json({
          success: true,
          project
        });
      } catch (error) {
        console.error('Error fetching project:', error);
        res.status(500).json({
          error: 'Failed to fetch project',
          message: error.message
        });
      }
      break;

    case 'DELETE':
      try {
        if (!user) {
          return res.status(401).json({ error: 'Not authenticated' });
        }

        const project = await prisma.project.findUnique({
          where: { id: parseInt(id) },
          include: {
            users: true
          }
        });

        if (!project) {
          return res.status(404).json({ error: 'Project not found' });
        }

        // Check if user has access to this project
        if (!project.users.some(u => u.id === user.userId)) {
          return res.status(403).json({ error: 'Access denied' });
        }

        // Delete all events first
        await prisma.event.deleteMany({
          where: { projectId: parseInt(id) }
        });

        // Delete the project
        await prisma.project.delete({
          where: { id: parseInt(id) }
        });

        res.status(200).json({
          success: true,
          message: 'Project deleted successfully'
        });
      } catch (error) {
        console.error('Error deleting project:', error);
        res.status(500).json({
          error: 'Failed to delete project',
          message: error.message
        });
      }
      break;

    case 'PUT':
      try {
        if (!user) {
          return res.status(401).json({ error: 'Not authenticated' });
        }

        const project = await prisma.project.findUnique({
          where: { id: parseInt(id) },
          include: {
            users: true
          }
        });

        if (!project) {
          return res.status(404).json({ error: 'Project not found' });
        }

        // Check if user has access to this project
        if (!project.users.some(u => u.id === user.userId)) {
          return res.status(403).json({ error: 'Access denied' });
        }

        const { githubRepo, githubToken, autoGithubReport, autoGithubReportFilters } = req.body;

        // Update the project with GitHub configuration
        const updatedProject = await prisma.project.update({
          where: { id: parseInt(id) },
          data: {
            githubRepo: githubRepo || null,
            githubToken: githubToken || null,
            autoGithubReport: autoGithubReport !== undefined ? autoGithubReport : false,
            autoGithubReportFilters: autoGithubReportFilters || null
          }
        });

        res.status(200).json({
          success: true,
          project: updatedProject
        });
      } catch (error) {
        console.error('Error updating project:', error);
        res.status(500).json({
          error: 'Failed to update project',
          message: error.message
        });
      }
      break;

    default:
      res.setHeader('Allow', ['GET', 'DELETE', 'PUT']);
      res.status(405).end(`Method ${method} Not Allowed`);
  }
}

