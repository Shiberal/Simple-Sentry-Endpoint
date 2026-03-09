import prisma from '@/lib/prisma';
import { checkAdminAuth } from '@/lib/admin';

export default async function handler(req, res) {
  try {
    await checkAdminAuth(req);
  } catch (error) {
    return res.status(error.statusCode || 401).json({ 
      error: error.message || 'Unauthorized' 
    });
  }

  switch (req.method) {
    case 'GET':
      try {
        let settings = await prisma.systemSettings.findUnique({
          where: { id: 0 }
        });

        // If settings don't exist, create default
        if (!settings) {
          settings = await prisma.systemSettings.create({
            data: {
              id: 0,
              allowSelfRegistration: true,
              allowProjectCreation: false
            }
          });
        }

        res.status(200).json({
          success: true,
          settings
        });
      } catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to fetch settings',
          message: error.message
        });
      }
      break;

    case 'PUT':
      try {
        const { allowSelfRegistration, allowProjectCreation } = req.body;

        const settings = await prisma.systemSettings.upsert({
          where: { id: 0 },
          update: {
            allowSelfRegistration: allowSelfRegistration !== undefined ? allowSelfRegistration : undefined,
            allowProjectCreation: allowProjectCreation !== undefined ? allowProjectCreation : undefined
          },
          create: {
            id: 0,
            allowSelfRegistration: allowSelfRegistration ?? true,
            allowProjectCreation: allowProjectCreation ?? false
          }
        });

        res.status(200).json({
          success: true,
          settings
        });
      } catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to update settings',
          message: error.message
        });
      }
      break;

    default:
      res.setHeader('Allow', ['GET', 'PUT']);
      res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
