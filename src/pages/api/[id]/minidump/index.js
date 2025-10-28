import { promisify } from 'util';
import { gunzip } from 'zlib';
import prisma from '@/lib/prisma';
import crypto from 'crypto';
import { sendErrorNotification } from '@/lib/telegram';

const gunzipAsync = promisify(gunzip);

// Disable Next.js body parser to handle raw buffer and multipart
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

// Simple multipart parser to extract metadata (not processing binary minidump)
function parseMultipartMetadata(buffer, boundary) {
  const parts = {};
  const boundaryString = `--${boundary}`;
  const content = buffer.toString('utf-8', 0, Math.min(buffer.length, 10000)); // Only parse first 10KB for metadata
  
  const sections = content.split(boundaryString);
  
  for (const section of sections) {
    if (!section.trim() || section.trim() === '--') continue;
    
    // Extract field name from Content-Disposition header
    const nameMatch = section.match(/name="([^"]+)"/);
    if (!nameMatch) continue;
    
    const fieldName = nameMatch[1];
    
    // Skip binary fields (upload_file_minidump, etc.)
    if (fieldName.includes('minidump') || fieldName.includes('file')) continue;
    
    // Extract value (text after headers)
    const headerEnd = section.indexOf('\r\n\r\n');
    if (headerEnd === -1) continue;
    
    const value = section.substring(headerEnd + 4).trim();
    if (value) {
      parts[fieldName] = value;
    }
  }
  
  return parts;
}

// Generate fingerprint for minidump
function generateMinidumpFingerprint(metadata) {
  const platform = metadata.platform || 'unknown';
  const crashReason = metadata.crash_reason || metadata.exception_type || 'unknown';
  const crashAddress = metadata.crash_address || '';
  
  const fingerprintString = `minidump:${platform}:${crashReason}:${crashAddress}`;
  return crypto.createHash('md5').update(fingerprintString).digest('hex');
}

export default async function handler(req, res) {
  const { id } = req.query;
  const { method } = req;

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Content-Encoding, X-Sentry-Auth');
  res.setHeader('Access-Control-Max-Age', '86400');

  // Handle preflight OPTIONS request
  if (method === 'OPTIONS') {
    return res.status(200).end();
  }

  console.log('\n💥 MINIDUMP HANDLER REACHED (Native crash dumps)');
  console.log(`   Project ID: ${id}`);
  console.log(`   Method: ${method}`);

  switch (method) {
    case 'GET':
      console.log('ℹ️  GET request to minidump endpoint (test/health check)');
      res.status(200).json({ 
        success: true, 
        message: `Minidump endpoint for project ID: ${id}`,
        id,
        note: 'This endpoint accepts multipart/form-data minidump uploads'
      });
      break;

    case 'POST':
      console.log('💥 Processing POST request with minidump data...');
      try {
        // Get raw body buffer
        const rawBody = await getRawBody(req);
        
        console.log('📄 Received data length:', rawBody.length, 'bytes');
        
        // Parse metadata from multipart form data
        const contentType = req.headers['content-type'] || '';
        let metadata = {};
        
        if (contentType.includes('multipart/form-data')) {
          // Extract boundary
          const boundaryMatch = contentType.match(/boundary=([^;]+)/);
          if (boundaryMatch) {
            const boundary = boundaryMatch[1].trim();
            console.log('📦 Parsing multipart data with boundary:', boundary);
            metadata = parseMultipartMetadata(rawBody, boundary);
            console.log('✅ Extracted metadata:', Object.keys(metadata).join(', '));
          }
        } else if (contentType.includes('application/json')) {
          // Some SDKs send metadata as JSON
          try {
            const jsonData = rawBody.toString('utf-8');
            metadata = JSON.parse(jsonData);
          } catch (e) {
            console.log('⚠️  Failed to parse as JSON, continuing with empty metadata');
          }
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

        // Extract crash information from metadata
        const platform = metadata.platform || metadata.os || 'unknown';
        const osVersion = metadata.os_version || metadata.osVersion || '';
        const crashReason = metadata.crash_reason || metadata.exception_type || 'Native crash';
        const crashAddress = metadata.crash_address || '';
        const appVersion = metadata.version || metadata.app_version || '';
        
        // Generate fingerprint
        const fingerprint = generateMinidumpFingerprint(metadata);
        
        // Create a descriptive title
        const title = `Native Crash: ${crashReason} on ${platform}`;
        
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
          console.log('🔄 Updating existing minidump issue:', issue.title);
          issue = await prisma.issue.update({
            where: { id: issue.id },
            data: {
              count: { increment: 1 },
              lastSeen: new Date()
            }
          });
        } else {
          // Create new issue
          console.log('🆕 Creating NEW minidump issue:', title);
          isNewIssue = true;
          issue = await prisma.issue.create({
            data: {
              projectId: project.id,
              fingerprint,
              title,
              culprit: crashAddress || 'Unknown address',
              level: 'fatal', // Crashes are fatal
              count: 1,
              firstSeen: new Date(),
              lastSeen: new Date()
            }
          });
        }

        // Transform minidump metadata into event data
        const eventData = {
          type: 'minidump',
          level: 'fatal',
          message: title,
          culprit: crashAddress,
          timestamp: new Date().toISOString(),
          platform: platform,
          minidump: {
            crash_reason: crashReason,
            crash_address: crashAddress,
            platform: platform,
            os_version: osVersion,
            app_version: appVersion,
            metadata: metadata,
            note: 'Full minidump analysis not implemented - only metadata stored'
          },
          contexts: {
            os: {
              name: platform,
              version: osVersion
            },
            app: {
              version: appVersion
            }
          },
          tags: {
            crash_reason: crashReason,
            platform: platform
          }
        };

        // Save event to database
        const event = await prisma.event.create({
          data: {
            projectId: project.id,
            issueId: issue.id,
            eventType: 'MINIDUMP',
            data: eventData
          }
        });
        
        console.log('💾 Minidump event saved to database (ID:', event.id, ')');
        console.log('ℹ️  Note: Full minidump binary analysis is not implemented');

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

        console.log('✅ SUCCESS: Minidump processed successfully!');
        console.log(`   Event ID: ${event.id}`);
        console.log(`   Issue ID: ${issue.id}`);
        
        // Return success response
        res.status(200).json({ 
          id: event.id.toString(),
          success: true,
          note: 'Minidump metadata stored. Full binary analysis not implemented.'
        });
      } catch (error) {
        console.error('\n❌ ERROR PROCESSING MINIDUMP:');
        console.error('   Error Type:', error.constructor.name);
        console.error('   Error Message:', error.message);
        console.error('   Stack Trace:', error.stack);
        
        res.status(400).json({ 
          success: false, 
          error: 'Failed to process minidump',
          message: error.message,
          details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
      }
      break;

    default:
      console.log(`❌ Method ${method} not allowed on minidump endpoint`);
      res.setHeader('Allow', ['GET', 'POST']);
      res.status(405).json({
        success: false,
        error: 'Method Not Allowed',
        message: `Method ${method} is not allowed. Use POST to send minidumps or GET to test the endpoint.`,
        allowed: ['GET', 'POST']
      });
  }
}

