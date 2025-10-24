import prisma from '@/lib/prisma';
import { updateGitHubIssueState } from '@/lib/github';

export default async function handler(req, res) {
  const { method } = req;
  const { id } = req.query;

  switch (method) {
    case 'GET':
      try {
        const issueId = parseInt(id);
        
        if (isNaN(issueId)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid issue ID'
          });
        }
        
        const issue = await prisma.issue.findUnique({
          where: { id: issueId },
          include: {
            project: {
              select: {
                id: true,
                name: true,
                key: true
              }
            },
            assignedTo: {
              select: {
                id: true,
                name: true,
                email: true
              }
            },
            events: {
              orderBy: {
                createdAt: 'desc'
              },
              take: 100 // Limit to last 100 events
            },
            comments: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true
                  }
                }
              },
              orderBy: {
                createdAt: 'asc'
              }
            },
            _count: {
              select: {
                events: true,
                comments: true
              }
            }
          }
        });

        if (!issue) {
          return res.status(404).json({
            success: false,
            error: 'Issue not found'
          });
        }

        res.status(200).json({
          success: true,
          issue
        });
      } catch (error) {
        console.error('Error fetching issue:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to fetch issue',
          message: error.message
        });
      }
      break;

    case 'PATCH':
      try {
        const issueId = parseInt(id);
        
        if (isNaN(issueId)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid issue ID'
          });
        }
        
        const { status, assignedToId, githubIssueUrl, githubIssueNumber } = req.body;

        // Get current issue to check for changes and GitHub info
        const currentIssue = await prisma.issue.findUnique({
          where: { id: issueId },
          include: {
            project: {
              select: {
                id: true,
                name: true,
                githubRepo: true,
                githubToken: true
              }
            }
          }
        });

        if (!currentIssue) {
          return res.status(404).json({
            success: false,
            error: 'Issue not found'
          });
        }

        const updateData = {};
        let shouldUpdateGitHub = false;
        let newGitHubState = null;
        
        if (status !== undefined) {
          // Validate status
          const validStatuses = ['UNRESOLVED', 'RESOLVED', 'IGNORED', 'IN_PROGRESS'];
          if (!validStatuses.includes(status)) {
            return res.status(400).json({
              success: false,
              error: 'Invalid status. Must be one of: ' + validStatuses.join(', ')
            });
          }
          updateData.status = status;

          // Check if we need to update GitHub issue state
          if (currentIssue.githubIssueNumber && currentIssue.project.githubRepo) {
            const oldStatus = currentIssue.status;
            
            // Close GitHub issue when marking as RESOLVED
            if (status === 'RESOLVED' && oldStatus !== 'RESOLVED') {
              shouldUpdateGitHub = true;
              newGitHubState = 'closed';
            }
            // Reopen GitHub issue when unmarking RESOLVED
            else if (status !== 'RESOLVED' && oldStatus === 'RESOLVED') {
              shouldUpdateGitHub = true;
              newGitHubState = 'open';
            }
          }
        }

        if (assignedToId !== undefined) {
          // null to unassign, or user ID
          if (assignedToId === null) {
            updateData.assignedToId = null;
          } else {
            // Verify user exists
            const user = await prisma.user.findUnique({
              where: { id: parseInt(assignedToId) }
            });
            if (!user) {
              return res.status(404).json({
                success: false,
                error: 'User not found'
              });
            }
            updateData.assignedToId = parseInt(assignedToId);
          }
        }

        // Update GitHub issue info
        if (githubIssueUrl !== undefined) {
          updateData.githubIssueUrl = githubIssueUrl;
        }
        
        if (githubIssueNumber !== undefined) {
          updateData.githubIssueNumber = githubIssueNumber;
        }

        const issue = await prisma.issue.update({
          where: { id: issueId },
          data: updateData,
          include: {
            assignedTo: {
              select: {
                id: true,
                name: true,
                email: true
              }
            },
            project: {
              select: {
                id: true,
                name: true,
                githubRepo: true,
                githubToken: true
              }
            }
          }
        });

        // Update GitHub issue state if needed
        if (shouldUpdateGitHub && newGitHubState) {
          const comment = newGitHubState === 'closed' 
            ? `✅ This issue has been marked as **resolved** in the error monitoring dashboard.`
            : `🔄 This issue has been **reopened** in the error monitoring dashboard.`;

          await updateGitHubIssueState({
            issueNumber: currentIssue.githubIssueNumber,
            project: currentIssue.project,
            state: newGitHubState,
            comment
          });
        }

        res.status(200).json({
          success: true,
          issue
        });
      } catch (error) {
        console.error('Error updating issue:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to update issue',
          message: error.message
        });
      }
      break;

    case 'DELETE':
      try {
        const issueId = parseInt(id);
        
        if (isNaN(issueId)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid issue ID'
          });
        }
        
        // Delete the issue (events will be cascade deleted or orphaned based on schema)
        await prisma.issue.delete({
          where: { id: issueId }
        });

        res.status(200).json({
          success: true,
          message: 'Issue deleted successfully'
        });
      } catch (error) {
        console.error('Error deleting issue:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to delete issue',
          message: error.message
        });
      }
      break;

    default:
      res.setHeader('Allow', ['GET', 'PATCH', 'DELETE']);
      res.status(405).end(`Method ${method} Not Allowed`);
  }
}


