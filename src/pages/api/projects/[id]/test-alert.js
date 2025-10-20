import prisma from '@/lib/prisma';
import { sendTestAlert } from '@/lib/email';

export default async function handler(req, res) {
  const { method } = req;
  const { id } = req.query;

  if (method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${method} Not Allowed`);
  }

  try {
    const projectId = parseInt(id);
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email address is required'
      });
    }

    // Get project
    const project = await prisma.project.findUnique({
      where: { id: projectId }
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }

    // Send test email
    const result = await sendTestAlert({
      recipient: email,
      projectName: project.name
    });

    if (result.success) {
      res.status(200).json({
        success: true,
        message: 'Test alert sent successfully',
        details: result
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to send test alert',
        message: result.error
      });
    }
  } catch (error) {
    console.error('Error sending test alert:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send test alert',
      message: error.message
    });
  }
}


