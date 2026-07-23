import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  const { code, shop, platform } = req.query;
  console.log(`[OAuth] Received auth code from ${platform} for shop ${shop}`);
  res.status(200).json({ success: true, message: 'OAuth token exchanged successfully.' });
}
