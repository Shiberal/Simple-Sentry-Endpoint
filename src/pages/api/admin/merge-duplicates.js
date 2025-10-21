import prisma from '@/lib/prisma';
import { generateFingerprint } from '@/lib/fingerprint';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get all issues with their events
    const issues = await prisma.issue.findMany({
      include: {
        events: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 1 // Get the latest event to recalculate fingerprint
        },
        _count: {
          select: { events: true }
        }
      }
    });

    console.log(`Found ${issues.length} issues to check for duplicates...`);

    // Group issues by recalculated fingerprint
    const fingerprintMap = new Map();
    
    for (const issue of issues) {
      if (issue.events.length > 0) {
        // Recalculate fingerprint using improved logic
        const newFingerprint = generateFingerprint(issue.events[0].data);
        
        if (!fingerprintMap.has(newFingerprint)) {
          fingerprintMap.set(newFingerprint, []);
        }
        fingerprintMap.get(newFingerprint).push(issue);
      }
    }

    // Find and merge duplicates
    let mergedCount = 0;
    const mergeOps = [];

    for (const [fingerprint, issueGroup] of fingerprintMap.entries()) {
      if (issueGroup.length > 1) {
        // Sort by firstSeen to keep the oldest issue as primary
        issueGroup.sort((a, b) => new Date(a.firstSeen) - new Date(b.firstSeen));
        
        const primaryIssue = issueGroup[0];
        const duplicates = issueGroup.slice(1);

        console.log(`Merging ${duplicates.length} duplicates into issue #${primaryIssue.id}: "${primaryIssue.title}"`);

        for (const duplicate of duplicates) {
          // Move all events from duplicate to primary issue
          await prisma.event.updateMany({
            where: { issueId: duplicate.id },
            data: { issueId: primaryIssue.id }
          });

          // Move comments
          await prisma.comment.updateMany({
            where: { issueId: duplicate.id },
            data: { issueId: primaryIssue.id }
          });

          // Delete the duplicate issue
          await prisma.issue.delete({
            where: { id: duplicate.id }
          });

          mergedCount++;
        }

        // Update primary issue with correct counts and timestamps
        const allEvents = await prisma.event.findMany({
          where: { issueId: primaryIssue.id },
          orderBy: { createdAt: 'asc' }
        });

        if (allEvents.length > 0) {
          await prisma.issue.update({
            where: { id: primaryIssue.id },
            data: {
              fingerprint: fingerprint,
              count: allEvents.length,
              firstSeen: allEvents[0].createdAt,
              lastSeen: allEvents[allEvents.length - 1].createdAt
            }
          });
        }

        mergeOps.push({
          primaryId: primaryIssue.id,
          title: primaryIssue.title,
          mergedCount: duplicates.length,
          totalEvents: allEvents.length
        });
      }
    }

    console.log(`✅ Merged ${mergedCount} duplicate issues`);

    res.status(200).json({
      success: true,
      message: `Merged ${mergedCount} duplicate issues`,
      details: mergeOps,
      totalIssuesChecked: issues.length,
      duplicatesMerged: mergedCount
    });

  } catch (error) {
    console.error('Error merging duplicates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to merge duplicates',
      message: error.message
    });
  }
}

