import { promisify } from 'util';
import { gunzip } from 'zlib';
import prisma from '@/lib/prisma';
import { generateFingerprint, extractTitle, extractCulprit, extractLevel } from '@/lib/fingerprint';
import { sendNewIssueAlert } from '@/lib/email';

const gunzipAsync = promisify(gunzip);

// Disable Next.js body parser to handle raw buffer
export const config = {
  api: {
    bodyParser: false,
  },
};

// Helper function to read raw body
async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  const { id } = req.query;
  const { method } = req;

  console.log('\n🎯 ENVELOPE HANDLER REACHED');
  console.log(`   Project ID: ${id}`);
  console.log(`   Method: ${method}`);
  console.log(`   Headers:`, {
    'content-type': req.headers['content-type'],
    'content-encoding': req.headers['content-encoding'],
    'content-length': req.headers['content-length']
  });

  switch (method) {
    case 'GET':
      console.log('ℹ️  GET request to envelope endpoint (test/health check)');
      res.status(200).json({ 
        success: true, 
        message: `Get envelope for project ID: ${id}`,
        id 
      });
      break;

    case 'POST':
      console.log('📦 Processing POST request with error data...');
      try {
        // Get raw body buffer
        const rawBody = await getRawBody(req);
        
        // Check if content is gzipped
        const contentEncoding = req.headers['content-encoding'];
        let decompressedData;
        
        if (contentEncoding === 'gzip') {
          // Decompress gzip data
          const decompressed = await gunzipAsync(rawBody);
          decompressedData = decompressed.toString('utf-8');
        } else {
          // If not gzipped, just convert to string
          decompressedData = rawBody.toString('utf-8');
        }
        
        console.log('📄 Decompressed data length:', decompressedData.length, 'bytes');
        console.log('📄 First 200 chars:', decompressedData.substring(0, 200));
        
        // Parse the envelope data (Sentry envelopes are newline-delimited JSON)
        const lines = decompressedData.split('\n').filter(line => line.trim());
        console.log('📋 Envelope has', lines.length, 'lines');
        
        // Parse and save the event to database
        let eventData = {};
        try {
          // Sentry envelope format:
          // Line 0: Envelope header
          // Line 1: Item header (describes the item type)
          // Line 2+: Actual item data (event, transaction, etc.)
          if (lines.length > 2) {
            // Third line contains the actual event data
            eventData = JSON.parse(lines[2]);
          } else if (lines.length > 1) {
            // Fallback to second line for simpler formats
            eventData = JSON.parse(lines[1]);
          }
        } catch (parseError) {
          console.log('Could not parse event data:', parseError);
          console.log('Available lines:', lines.length);
          lines.forEach((line, idx) => {
            console.log(`Line ${idx}:`, line.substring(0, 100));
          });
        }

        // Find project by numeric ID
        const projectId = parseInt(id);
        if (isNaN(projectId)) {
          return res.status(400).json({ 
            success: false, 
            error: 'Invalid project ID',
            message: 'Project ID must be a number'
          });
        }

        const project = await prisma.project.findFirst({
          where: { id: projectId }
        });

        if (!project) {
          console.error('❌ Project not found with ID:', projectId);
          return res.status(404).json({ 
            success: false, 
            error: 'Project not found',
            message: 'Invalid project ID'
          });
        }

        console.log('✅ Project found:', project.name, '(ID:', project.id, ')');

        // Generate fingerprint for grouping
        const fingerprint = generateFingerprint(eventData);
        const title = extractTitle(eventData);
        const culprit = extractCulprit(eventData);
        const level = extractLevel(eventData);

        // Find or create issue
        let issue = await prisma.issue.findUnique({
          where: {
            projectId_fingerprint: {
              projectId: project.id,
              fingerprint: fingerprint
            }
          }
        });

        let isNewIssue = false;

        if (issue) {
          // Update existing issue
          console.log('🔄 Updating existing issue:', issue.title);
          issue = await prisma.issue.update({
            where: { id: issue.id },
            data: {
              count: { increment: 1 },
              lastSeen: new Date()
            }
          });
        } else {
          // Create new issue
          console.log('🆕 Creating NEW issue:', title);
          isNewIssue = true;
          issue = await prisma.issue.create({
            data: {
              projectId: project.id,
              fingerprint,
              title,
              culprit,
              level,
              count: 1,
              firstSeen: new Date(),
              lastSeen: new Date()
            }
          });
        }

        // Save event to database linked to issue
        const event = await prisma.event.create({
          data: {
            projectId: project.id,
            issueId: issue.id,
            data: eventData
          }
        });
        
        console.log('💾 Event saved to database (ID:', event.id, ')');

        // Check alert rules and send notifications
        const alertRules = await prisma.alertRule.findMany({
          where: {
            projectId: project.id,
            enabled: true
          }
        });

        for (const rule of alertRules) {
          const condition = rule.condition;
          let shouldTrigger = false;

          // Check if conditions match
          if (condition.level && Array.isArray(condition.level)) {
            if (condition.level.includes(level)) {
              shouldTrigger = true;
            }
          } else {
            // No level filter, trigger for all
            shouldTrigger = true;
          }

          // Check environment filter if specified
          if (shouldTrigger && condition.environment) {
            const eventEnv = eventData.environment || '';
            if (eventEnv !== condition.environment) {
              shouldTrigger = false;
            }
          }

          // Only trigger for new issues or based on condition
          if (shouldTrigger && (isNewIssue || condition.triggerOn === 'all')) {
            // Rate limiting: don't send more than once per hour for same issue
            if (rule.lastTriggered) {
              const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
              if (new Date(rule.lastTriggered) > hourAgo && !isNewIssue) {
                continue;
              }
            }

            // Send alert
            const recipients = rule.emailRecipients.split(',').map(e => e.trim()).filter(Boolean);
            if (recipients.length > 0) {
              console.log('📧 Sending alert to:', recipients.join(', '));
              await sendNewIssueAlert({
                recipients,
                issue,
                project,
                baseUrl: process.env.BASE_URL || 'http://localhost:3000'
              });

              // Update last triggered time
              await prisma.alertRule.update({
                where: { id: rule.id },
                data: { lastTriggered: new Date() }
              });
            }
          }
        }
        
        console.log('✅ SUCCESS: Envelope processed successfully!');
        console.log(`   Event ID: ${event.id}`);
        console.log(`   Issue ID: ${issue.id}`);
        console.log(`   New Issue: ${isNewIssue}`);
        
        res.status(200).json({ 
          success: true, 
          message: `Envelope received for project: ${project.name}`,
          projectId: project.id,
          eventId: event.id,
          issueId: issue.id,
          isNewIssue,
          body: lines
        });
      } catch (error) {
        console.error('Error processing envelope:', error);
        res.status(400).json({ 
          success: false, 
          error: 'Failed to process envelope data',
          message: error.message
        });
      }
      break;

    default:
      res.setHeader('Allow', ['GET', 'POST']);
      res.status(405).end(`Method ${method} Not Allowed`);
  }
}

