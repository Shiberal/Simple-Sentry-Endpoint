import prisma from '@/lib/prisma';

export default async function handler(req, res) {
  const { method } = req;

  switch (method) {
    case 'GET':
      try {
        const users = await prisma.user.findMany();
        res.status(200).json({ success: true, data: users });
      } catch (error) {
        res.status(400).json({ success: false, error: error.message });
      }
      break;

    case 'POST':
      try {
        const { email, name } = req.body;
        const user = await prisma.user.create({
          data: {
            email,
            name,
          },
        });
        res.status(201).json({ success: true, data: user });
      } catch (error) {
        res.status(400).json({ success: false, error: error.message });
      }
      break;

    default:
      res.setHeader('Allow', ['GET', 'POST']);
      res.status(405).end(`Method ${method} Not Allowed`);
  }
}

