import prisma from '@/lib/prisma';
import { sendTestAlert } from '@/lib/email';

export default async function handler(req, res) {
  const { method } = req;
  const { id } = req.query;
  const projectId = parseInt(id);

  switch (method) {
    case 'GET':
      try {
        const alertRules = await prisma.alertRule.findMany({
          where: { projectId },
          orderBy: {
            createdAt: 'desc'
          }
        });

        res.status(200).json({
          success: true,
          alertRules
        });
      } catch (error) {
        console.error('Error fetching alert rules:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to fetch alert rules',
          message: error.message
        });
      }
      break;

    case 'POST':
      try {
        const {
          name,
          condition,
          emailRecipients = '',
          slackWebhookUrl,
          genericWebhookUrl,
          enabled = true
        } = req.body;

        if (!name) {
          return res.status(400).json({
            success: false,
            error: 'Name is required'
          });
        }

        const slug = slackWebhookUrl != null ? String(slackWebhookUrl).trim() : '';
        const hook = genericWebhookUrl != null ? String(genericWebhookUrl).trim() : '';
        const emails = emailRecipients != null ? String(emailRecipients).trim() : '';

        if (!emails && !slug && !hook) {
          return res.status(400).json({
            success: false,
            error: 'Provide at least one destination: email recipients, Slack webhook, or generic webhook URL'
          });
        }

        // Verify project exists
        const project = await prisma.project.findUnique({
          where: { id: projectId }
        });

        if (!project) {
          return res.status(404).json({
            success: false,
            error: 'Project not found'
          });
        }

        const alertRule = await prisma.alertRule.create({
          data: {
            projectId,
            name,
            condition: condition || {},
            emailRecipients: emails || '',
            slackWebhookUrl: slug || null,
            genericWebhookUrl: hook || null,
            enabled
          }
        });

        res.status(201).json({
          success: true,
          alertRule
        });
      } catch (error) {
        console.error('Error creating alert rule:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to create alert rule',
          message: error.message
        });
      }
      break;

    case 'PATCH':
      try {
        const { ruleId, name, condition, emailRecipients, slackWebhookUrl, genericWebhookUrl, enabled } = req.body;

        if (!ruleId) {
          return res.status(400).json({
            success: false,
            error: 'Rule ID is required'
          });
        }

        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (condition !== undefined) updateData.condition = condition;
        if (emailRecipients !== undefined) updateData.emailRecipients = emailRecipients;
        if (slackWebhookUrl !== undefined) {
          updateData.slackWebhookUrl = slackWebhookUrl || null;
        }
        if (genericWebhookUrl !== undefined) {
          updateData.genericWebhookUrl = genericWebhookUrl || null;
        }
        if (enabled !== undefined) updateData.enabled = enabled;

        const alertRule = await prisma.alertRule.update({
          where: { id: parseInt(ruleId) },
          data: updateData
        });

        res.status(200).json({
          success: true,
          alertRule
        });
      } catch (error) {
        console.error('Error updating alert rule:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to update alert rule',
          message: error.message
        });
      }
      break;

    case 'DELETE':
      try {
        const { ruleId } = req.query;

        if (!ruleId) {
          return res.status(400).json({
            success: false,
            error: 'Rule ID is required'
          });
        }

        await prisma.alertRule.delete({
          where: { id: parseInt(ruleId) }
        });

        res.status(200).json({
          success: true,
          message: 'Alert rule deleted successfully'
        });
      } catch (error) {
        console.error('Error deleting alert rule:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to delete alert rule',
          message: error.message
        });
      }
      break;

    default:
      res.setHeader('Allow', ['GET', 'POST', 'PATCH', 'DELETE']);
      res.status(405).end(`Method ${method} Not Allowed`);
  }
}


