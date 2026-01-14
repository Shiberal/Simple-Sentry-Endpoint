import prisma from '@/lib/prisma';
import { checkAdminAuth } from '@/lib/admin';

export default async function handler(req, res) {
  const { method, query } = req;
  const { id } = query;

  try {
    // Verify admin access
    await checkAdminAuth(req);
  } catch (error) {
    return res.status(error.statusCode || 401).json({ 
      error: error.message || 'Unauthorized' 
    });
  }

  switch (method) {
    case 'PUT':
      try {
        const { 
          name, 
          githubRepo, 
          githubToken, 
          autoGithubReport, 
          autoGithubReportFilters, 
          telegramChatId,
          userIds,
          ownerIds
        } = req.body;
        const projectId = parseInt(id);

        if (isNaN(projectId)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid project ID'
          });
        }

        // Check if project exists
        const existingProject = await prisma.project.findUnique({
          where: { id: projectId }
        });

        if (!existingProject) {
          return res.status(404).json({
            success: false,
            error: 'Project not found'
          });
        }

        // Build update data
        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (githubRepo !== undefined) updateData.githubRepo = githubRepo || null;
        if (githubToken !== undefined) updateData.githubToken = githubToken || null;
        if (autoGithubReport !== undefined) updateData.autoGithubReport = autoGithubReport;
        if (autoGithubReportFilters !== undefined) updateData.autoGithubReportFilters = autoGithubReportFilters || null;
        if (telegramChatId !== undefined) updateData.telegramChatId = telegramChatId || null;

        // Handle user assignments
        if (userIds !== undefined) {
          updateData.users = {
            set: userIds.map(id => ({ id: parseInt(id) }))
          };
        }

        // Handle owner assignments
        if (ownerIds !== undefined) {
          updateData.projectOwners = {
            set: ownerIds.map(id => ({ id: parseInt(id) }))
          };
        }

        const updatedProject = await prisma.project.update({
          where: { id: projectId },
          data: updateData,
          include: {
            users: {
              select: {
                id: true,
                email: true,
                name: true
              }
            },
            projectOwners: {
              select: {
                id: true,
                email: true,
                name: true
              }
            },
            _count: {
              select: {
                events: true,
                issues: true
              }
            }
          }
        });

        res.status(200).json({
          success: true,
          project: updatedProject
        });
      } catch (error) {
        console.error('Error updating project:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to update project',
          message: error.message
        });
      }
      break;

    case 'DELETE':
      try {
        const projectId = parseInt(id);

        if (isNaN(projectId)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid project ID'
          });
        }

        // Check if project exists
        const existingProject = await prisma.project.findUnique({
          where: { id: projectId }
        });

        if (!existingProject) {
          return res.status(404).json({
            success: false,
            error: 'Project not found'
          });
        }

        // Delete project (cascade will handle related records)
        await prisma.project.delete({
          where: { id: projectId }
        });

        res.status(200).json({
          success: true,
          message: 'Project deleted successfully'
        });
      } catch (error) {
        console.error('Error deleting project:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to delete project',
          message: error.message
        });
      }
      break;

    default:
      res.setHeader('Allow', ['PUT', 'DELETE']);
      res.status(405).end(`Method ${method} Not Allowed`);
  }
}
