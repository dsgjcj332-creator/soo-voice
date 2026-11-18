/**
 * Vercel serverless function — /api/voice-preview
 *
 * Generates a short audio sample of a given text in a given prebuilt voice
 * using Gemini's text-to-speech. Used by the Voice Studio page for A/B
 * voice comparison before the owner publishes a voice persona.
 *
 * Standalone (no Express) for clean bundling in the Vercel Node runtime.
 */
import { GoogleGenAI, Modality } from '@google/genai';

export const config = {
  maxDuration: 25,
};

interface VercelRequest {
  method?: string;
  body?: any;
}

async function parseBody(req: VercelRequest): Promise<any> {
  // Vercel parses JSON bodies for us when Content-Type is JSON.
  return req.body || {};
}

export default async function handler(req: VercelRequest, res: any) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.statusCode = 503;
    res.end(JSON.stringify({ error: 'Voice service not configured: GEMINI_API_KEY is missing server-side' }));
    return;
  }

  const body = await parseBody(req);
  const text = String(body?.text || '').trim().slice(0, 280);
  const voice = String(body?.voice || '').trim();
  if (!text || !voice) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: 'Both `text` and `voice` are required' }));
    return;
  }

  try {
    const client = new GoogleGenAI({ apiKey, httpOptions: { apiVersion: 'v1alpha' } });
    const response: any = await client.models.generateContent({
      model: 'gemini-3.1-flash-live-preview',
      contents: [{ role: 'user', parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
        },
      },
    });

    const candidate = response?.candidates?.[0];
    const parts = candidate?.content?.parts || [];
    let inline: any = null;
    for (const p of parts) {
      if (p?.inlineData?.data) {
        inline = p.inlineData;
        break;
      }
    }
    if (!inline?.data) {
      res.statusCode = 502;
      res.end(JSON.stringify({ error: 'No audio data returned from Gemini' }));
      return;
    }
    res.setHeader('Cache-Control', 'no-store');
    res.statusCode = 200;
    res.end(JSON.stringify({ audio: inline.data, mime: inline.mimeType || 'audio/L16' }));
  } catch (err: any) {
    console.error('[api/voice-preview] error:', err?.message || err);
    res.statusCode = 502;
    res.end(JSON.stringify({
      error: 'Failed to generate preview',
      detail: err?.message ? String(err.message).slice(0, 200) : undefined,
    }));
  }
}
