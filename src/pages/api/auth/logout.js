import { clearSessionCookie } from '@/lib/session';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Clear session cookie
  res.setHeader('Set-Cookie', clearSessionCookie());
  res.status(200).json({ success: true, message: 'Logged out successfully' });
}

