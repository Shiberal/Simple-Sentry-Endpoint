import prisma from '@/lib/prisma';
import { parse } from 'cookie';
import crypto from 'crypto';

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
  const { method } = req;
  const user = getUserFromCookie(req);

  switch (method) {
    case 'GET':
      try {
        // If user is logged in, only show their projects
        const where = user ? {
          users: {
            some: {
              id: user.userId
            }
          }
        } : {};

        const projects = await prisma.project.findMany({
          where,
          include: {
            _count: {
              select: { 
                events: true,
                issues: {
                  where: {
                    status: {
                      notIn: ['RESOLVED', 'IGNORED']
                    }
                  }
                }
              }
            },
            users: {
              select: {
                id: true,
                email: true,
                name: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        });

        res.status(200).json({ 
          success: true, 
          projects 
        });
      } catch (error) {
        console.error('Error fetching projects:', error);
        res.status(500).json({ 
          success: false, 
          error: 'Failed to fetch projects',
          message: error.message
        });
      }
      break;

    case 'POST':
      try {
        if (!user) {
          return res.status(401).json({ error: 'Not authenticated' });
        }

        const { name } = req.body;

        if (!name) {
          return res.status(400).json({ error: 'Project name is required' });
        }

        // Generate a unique project key
        const key = crypto.randomBytes(16).toString('hex');

        const project = await prisma.project.create({
          data: {
            name,
            key,
            users: {
              connect: {
                id: user.userId
              }
            }
          },
          include: {
            users: {
              select: {
                id: true,
                email: true,
                name: true
              }
            }
          }
        });

        res.status(201).json({
          success: true,
          project
        });
      } catch (error) {
        console.error('Error creating project:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to create project',
          message: error.message
        });
      }
      break;

    default:
      res.setHeader('Allow', ['GET', 'POST']);
      res.status(405).end(`Method ${method} Not Allowed`);
  }
}

