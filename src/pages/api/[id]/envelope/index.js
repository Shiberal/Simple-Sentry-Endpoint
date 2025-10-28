import { promisify } from 'util';
import { gunzip } from 'zlib';
import prisma from '@/lib/prisma';
import { generateFingerprint, extractTitle, extractCulprit, extractLevel } from '@/lib/fingerprint';
import { sendNewIssueAlert } from '@/lib/email';
import { createGitHubIssue, shouldAutoReport, updateGitHubIssue } from '@/lib/github';
import { sendErrorNotification } from '@/lib/telegram';

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

  // Set CORS headers to allow browser clients
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Content-Encoding, X-Sentry-Auth');
  res.setHeader('Access-Control-Max-Age', '86400');

  // Handle preflight OPTIONS request
  if (method === 'OPTIONS') {
    return res.status(200).end();
  }

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

        // Determine event type from data first
        let eventType = 'ERROR'; // Default
        if (eventData.type === 'transaction') {
          eventType = 'TRANSACTION';
        } else if (eventData.message && !eventData.exception) {
          eventType = 'MESSAGE';
        }

        let issue = null;
        let isNewIssue = false;
        let event = null;

        // Only create issues for errors and messages, not for transactions
        if (eventType === 'TRANSACTION') {
          console.log('📊 Processing TRANSACTION:', eventData.transaction || 'unnamed transaction');
          
          // Save transaction directly without creating an issue
          event = await prisma.event.create({
            data: {
              projectId: project.id,
              issueId: null, // Transactions don't have issues
              eventType: eventType,
              data: eventData
            }
          });
          
          console.log('💾 Transaction saved to database (ID:', event.id, ')');
        } else {
          // For errors and messages, create/update issues
          const fingerprint = generateFingerprint(eventData);
          const title = extractTitle(eventData);
          const culprit = extractCulprit(eventData);
          const level = extractLevel(eventData);

          // Find or create issue
          issue = await prisma.issue.findUnique({
            where: {
              projectId_fingerprint: {
                projectId: project.id,
                fingerprint: fingerprint
              }
            }
          });

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
          event = await prisma.event.create({
            data: {
              projectId: project.id,
              issueId: issue.id,
              eventType: eventType,
              data: eventData
            }
          });
        }
        
        console.log('💾 Event saved to database (ID:', event.id, ')');

        // Send Telegram notification for new issues
        if (isNewIssue && project.telegramChatId && issue.status !== 'IGNORED') {
          console.log('📱 Sending Telegram notification...');
          try {
            const telegramResult = await sendErrorNotification(issue, event, project);
            if (telegramResult.success) {
              console.log('✅ Telegram notification sent successfully');
            } else {
              console.warn('⚠️ Failed to send Telegram notification:', telegramResult.error);
            }
          } catch (error) {
            console.error('❌ Error sending Telegram notification:', error);
          }
        }

        // Auto-create GitHub issue if enabled and this is a new issue (but not ignored)
        if (isNewIssue && project.autoGithubReport && issue.status !== 'IGNORED') {
          // Check if error matches filters
          const filters = project.autoGithubReportFilters;
          if (shouldAutoReport({ issue, eventData, filters })) {
            console.log('🐙 Auto-creating GitHub issue...');
            // Detect base URL from request headers
            const protocol = req.headers['x-forwarded-proto'] || (req.connection.encrypted ? 'https' : 'http');
            const host = req.headers['x-forwarded-host'] || req.headers.host;
            const baseUrl = `${protocol}://${host}`;
            const githubIssue = await createGitHubIssue({
              issue,
              eventData,
              project,
              baseUrl
            });
            
            if (githubIssue && githubIssue.created) {
              console.log('✅ GitHub issue auto-created:', githubIssue.html_url);
              
              // Store GitHub issue info in database to prevent duplicates
              await prisma.issue.update({
                where: { id: issue.id },
                data: {
                  githubIssueUrl: githubIssue.html_url,
                  githubIssueNumber: githubIssue.number
                }
              });
            } else if (githubIssue && githubIssue.exists) {
              console.log('ℹ️  GitHub issue already exists:', githubIssue.html_url);
            } else {
              console.log('⚠️  Failed to auto-create GitHub issue');
            }
          }
        } else if (!isNewIssue && project.autoGithubReport && issue.githubIssueNumber && issue.status !== 'IGNORED') {
          // For recurring errors, update the GitHub issue (but skip if ignored)
          const filters = project.autoGithubReportFilters;
          if (shouldAutoReport({ issue, eventData, filters })) {
            const timeSinceFirst = new Date() - new Date(issue.firstSeen);
            const days = Math.floor(timeSinceFirst / (1000 * 60 * 60 * 24));
            const hours = Math.floor((timeSinceFirst % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            
            // Add comment on significant milestones or status changes
            const shouldComment = 
              issue.count % 10 === 0 ||  // Every 10 occurrences
              issue.count === 5 ||        // At 5 occurrences
              issue.count === 2 ||        // At 2nd occurrence
              issue.count % 25 === 0;     // Every 25 occurrences
            
            // Detect base URL from request headers
            const protocol = req.headers['x-forwarded-proto'] || (req.connection.encrypted ? 'https' : 'http');
            const host = req.headers['x-forwarded-host'] || req.headers.host;
            const baseUrl = `${protocol}://${host}`;
            
            const comment = shouldComment ? 
              `## 🔄 Error Recurred - ${issue.count} Total Occurrences\n\n` +
              `This error has now occurred **${issue.count} time${issue.count !== 1 ? 's' : ''}**.\n\n` +
              `### 📊 Statistics\n\n` +
              `- **First Seen:** ${new Date(issue.firstSeen).toLocaleString()}\n` +
              `- **Last Seen:** ${new Date(issue.lastSeen).toLocaleString()}\n` +
              `- **Time Span:** ${days > 0 ? `${days} day${days !== 1 ? 's' : ''} ` : ''}${hours} hour${hours !== 1 ? 's' : ''}\n` +
              `- **Severity:** ${issue.level.toUpperCase()}\n` +
              `- **Status:** ${issue.status}\n\n` +
              (eventData.environment ? `- **Environment:** ${eventData.environment}\n\n` : '') +
              `🔗 [View in Dashboard](${baseUrl}/dashboard)`
              : null;
            
            console.log(`🔄 Updating GitHub issue #${issue.githubIssueNumber} with new count: ${issue.count}`);
            await updateGitHubIssue({
              issueNumber: issue.githubIssueNumber,
              project,
              issue,
              comment
            });
          }
        }

        // Check alert rules and send notifications (only for errors, not transactions)
        if (issue && eventType !== 'TRANSACTION') {
          const alertRules = await prisma.alertRule.findMany({
            where: {
              projectId: project.id,
              enabled: true
            }
          });

          const level = extractLevel(eventData);

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
                // Detect base URL from request headers
                const protocol = req.headers['x-forwarded-proto'] || (req.connection.encrypted ? 'https' : 'http');
                const host = req.headers['x-forwarded-host'] || req.headers.host;
                const baseUrl = `${protocol}://${host}`;
                await sendNewIssueAlert({
                  recipients,
                  issue,
                  project,
                  baseUrl
                });

                // Update last triggered time
                await prisma.alertRule.update({
                  where: { id: rule.id },
                  data: { lastTriggered: new Date() }
                });
              }
            }
          }
        }
        
        console.log('✅ SUCCESS: Envelope processed successfully!');
        console.log(`   Event ID: ${event.id}`);
        console.log(`   Event Type: ${eventType}`);
        if (issue) {
          console.log(`   Issue ID: ${issue.id}`);
          console.log(`   New Issue: ${isNewIssue}`);
        } else {
          console.log(`   Issue ID: N/A (transaction)`);
        }
        
        res.status(200).json({ 
          success: true, 
          message: `Envelope received for project: ${project.name}`,
          projectId: project.id,
          eventId: event.id,
          eventType: eventType,
          issueId: issue ? issue.id : null,
          isNewIssue: issue ? isNewIssue : false,
          body: lines
        });
      } catch (error) {
        console.error('\n❌ ERROR PROCESSING ENVELOPE:');
        console.error('   Error Type:', error.constructor.name);
        console.error('   Error Message:', error.message);
        console.error('   Stack Trace:', error.stack);
        
        res.status(400).json({ 
          success: false, 
          error: 'Failed to process envelope data',
          message: error.message,
          details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
      }
      break;

    default:
      console.log(`❌ Method ${method} not allowed on envelope endpoint`);
      res.setHeader('Allow', ['GET', 'POST']);
      res.status(405).json({
        success: false,
        error: 'Method Not Allowed',
        message: `Method ${method} is not allowed. Use POST to send events or GET to test the endpoint.`,
        allowed: ['GET', 'POST']
      });
  }
}

