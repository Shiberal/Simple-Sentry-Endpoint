import { promisify } from 'util';
import { gunzip } from 'zlib';
import prisma from '@/lib/prisma';
import crypto from 'crypto';
import { sendErrorNotification } from '@/lib/telegram';
import { createTracker, withPerformance } from '@/lib/server-performance';

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

// Generate fingerprint for CSP violations based on directive and blocked URI
function generateCSPFingerprint(cspReport) {
  const directive = cspReport['violated-directive'] || cspReport['effective-directive'] || 'unknown';
  const blockedUri = cspReport['blocked-uri'] || 'unknown';
  const sourceFile = cspReport['source-file'] || cspReport['document-uri'] || '';
  
  // Create fingerprint from directive + blocked URI (ignore source file for better grouping)
  const fingerprintString = `csp:${directive}:${blockedUri}`;
  return crypto.createHash('md5').update(fingerprintString).digest('hex');
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

  console.log('\n🛡️  SECURITY HANDLER REACHED (CSP violations)');
  console.log(`   Project ID: ${id}`);
  console.log(`   Method: ${method}`);

  switch (method) {
    case 'GET':
      console.log('ℹ️  GET request to security endpoint (test/health check)');
      res.status(200).json({ 
        success: true, 
        message: `Security endpoint for project ID: ${id}`,
        id 
      });
      break;

    case 'POST':
      console.log('🛡️  Processing POST request with CSP violation report...');
      const tracker = createTracker();
      try {
        // Get raw body buffer
        const rawBody = await getRawBody(req);
        tracker.mark('receive_body');
        
        // Check if content is gzipped
        const contentEncoding = req.headers['content-encoding'];
        let decompressedData;
        
        if (contentEncoding === 'gzip') {
          const decompressed = await gunzipAsync(rawBody);
          decompressedData = decompressed.toString('utf-8');
        } else {
          decompressedData = rawBody.toString('utf-8');
        }
        tracker.mark('decompress');
        
        console.log('📄 Decompressed data length:', decompressedData.length, 'bytes');
        
        // Parse CSP report
        let cspData = {};
        try {
          const parsed = JSON.parse(decompressedData);
          // CSP reports come in format: { "csp-report": { ... } }
          cspData = parsed['csp-report'] || parsed;
          tracker.mark('parse_json');
          console.log('✅ Parsed CSP report successfully');
          console.log('   Violated Directive:', cspData['violated-directive'] || cspData['effective-directive']);
          console.log('   Blocked URI:', cspData['blocked-uri']);
        } catch (parseError) {
          console.error('❌ Failed to parse CSP report:', parseError.message);
          return res.status(400).json({ 
            success: false, 
            error: 'Invalid JSON',
            message: 'CSP report must be valid JSON'
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
        tracker.mark('project_lookup');

        if (!project) {
          console.error('❌ Project not found with ID:', projectId);
          return res.status(404).json({ 
            success: false, 
            error: 'Project not found',
            message: 'Invalid project ID'
          });
        }

        console.log('✅ Project found:', project.name, '(ID:', project.id, ')');

        // Extract CSP-specific information
        const violatedDirective = cspData['violated-directive'] || cspData['effective-directive'] || 'unknown';
        const blockedUri = cspData['blocked-uri'] || 'unknown';
        const sourceFile = cspData['source-file'] || cspData['document-uri'] || 'unknown';
        const originalPolicy = cspData['original-policy'] || '';
        
        // Generate fingerprint for grouping
        const fingerprint = generateCSPFingerprint(cspData);
        
        // Create a descriptive title
        const title = `CSP Violation: ${violatedDirective} blocked ${blockedUri}`;
        tracker.mark('extract_metadata');
        
        // Find or create issue
        let issue = await prisma.issue.findUnique({
          where: {
            projectId_fingerprint: {
              projectId: project.id,
              fingerprint: fingerprint
            }
          }
        });
        tracker.mark('issue_lookup');

        let isNewIssue = false;

        if (issue) {
          // Update existing issue
          console.log('🔄 Updating existing CSP issue:', issue.title);
          issue = await prisma.issue.update({
            where: { id: issue.id },
            data: {
              count: { increment: 1 },
              lastSeen: new Date()
            }
          });
          tracker.mark('issue_update');
        } else {
          // Create new issue
          console.log('🆕 Creating NEW CSP issue:', title);
          isNewIssue = true;
          issue = await prisma.issue.create({
            data: {
              projectId: project.id,
              fingerprint,
              title,
              culprit: sourceFile,
              level: 'warning', // CSP violations are typically warnings
              violatedDirective,
              blockedUri,
              sourceFile,
              count: 1,
              firstSeen: new Date(),
              lastSeen: new Date()
            }
          });
          tracker.mark('issue_create');
        }

        // Transform CSP report into Sentry-like event data for storage
        const eventData = {
          type: 'csp',
          level: 'warning',
          message: title,
          culprit: sourceFile,
          timestamp: new Date().toISOString(),
          platform: 'javascript',
          csp: cspData,
          contexts: {
            csp: {
              violated_directive: violatedDirective,
              blocked_uri: blockedUri,
              source_file: sourceFile,
              document_uri: cspData['document-uri'],
              referrer: cspData.referrer,
              original_policy: originalPolicy,
              disposition: cspData.disposition || 'enforce'
            }
          },
          tags: {
            violated_directive: violatedDirective,
            blocked_uri: blockedUri
          }
        };

        // Save event to database linked to issue
        const event = await prisma.event.create({
          data: {
            projectId: project.id,
            issueId: issue.id,
            eventType: 'CSP',
            data: withPerformance(eventData, tracker.getTimings())
          }
        });
        tracker.mark('save_event');
        
        console.log('💾 CSP violation saved to database (ID:', event.id, ')');

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
        
        tracker.mark('notifications');
        console.log('✅ SUCCESS: CSP report processed successfully!');
        console.log(`   Event ID: ${event.id}`);
        console.log(`   Issue ID: ${issue.id}`);
        
        // Return success response
        res.status(200).json({ 
          id: event.id.toString(),
          success: true
        });
      } catch (error) {
        console.error('\n❌ ERROR PROCESSING CSP REPORT:');
        console.error('   Error Type:', error.constructor.name);
        console.error('   Error Message:', error.message);
        console.error('   Stack Trace:', error.stack);
        
        res.status(400).json({ 
          success: false, 
          error: 'Failed to process CSP report',
          message: error.message,
          details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
      }
      break;

    default:
      console.log(`❌ Method ${method} not allowed on security endpoint`);
      res.setHeader('Allow', ['GET', 'POST']);
      res.status(405).json({
        success: false,
        error: 'Method Not Allowed',
        message: `Method ${method} is not allowed. Use POST to send CSP reports or GET to test the endpoint.`,
        allowed: ['GET', 'POST']
      });
  }
}

