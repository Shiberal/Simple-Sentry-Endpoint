import prisma from '@/lib/prisma';

export default async function handler(req, res) {
  const { method } = req;
  const { id } = req.query;

  switch (method) {
    case 'DELETE':
      try {
        const eventId = parseInt(id);
        
        if (isNaN(eventId)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid event ID'
          });
        }
        
        // Check if event exists
        const event = await prisma.event.findUnique({
          where: { id: eventId }
        });

        if (!event) {
          return res.status(404).json({
            success: false,
            error: 'Event not found'
          });
        }

        // Delete the event
        await prisma.event.delete({
          where: { id: eventId }
        });

        res.status(200).json({
          success: true,
          message: 'Event deleted successfully'
        });
      } catch (error) {
        console.error('Error deleting event:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to delete event',
          message: error.message
        });
      }
      break;

    default:
      res.setHeader('Allow', ['DELETE']);
      res.status(405).end(`Method ${method} Not Allowed`);
  }
}

