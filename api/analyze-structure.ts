import { GoogleGenAI, createUserContent, createPartFromUri, MediaResolution } from '@google/genai';
import { geminiWithRetry } from './_gemini-retry.js';
import { handleCors } from './_cors.js';

export const config = { maxDuration: 300 };

const STRUCTURE_PROMPT = `You are a pickleball video analyst. Your job is to watch this ENTIRE video and identify the structure of the match — where are actual games being played vs dead time (between games, warmup, walking around, talking, etc.).

Break the video into segments of gameplay vs non-gameplay. For each gameplay segment, estimate:
1. Start time in seconds
2. End time in seconds
3. Which game number it is (1, 2, 3, etc.)
4. Rally density: "high" (continuous rallies, fast pace), "medium" (normal recreational pace), or "low" (lots of pauses between points)

Also estimate:
- Total number of rallies across the whole video
- Total duration of actual gameplay in seconds (excluding dead time)

Return ONLY valid JSON, no markdown, no code fences:
{
  "segments": [
    { "start": 0, "end": 180, "game_number": 1, "rally_density": "medium" },
    { "start": 200, "end": 400, "game_number": 2, "rally_density": "high" }
  ],
  "estimated_rally_count": 45,
  "estimated_duration_seconds": 600
}`;

export default async function handler(req: any, res: any) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { geminiFileUri, mimeType, playerContext } = req.body;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (!geminiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
  }
  if (!geminiFileUri) {
    return res.status(400).json({ error: 'No geminiFileUri provided' });
  }

  const startTime = Date.now();
  const step = (name: string) => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[analyze-structure] [${elapsed}s] ${name}`);
  };

  try {
    step('Starting structure scan (Phase 1)');
    const ai = new GoogleGenAI({ apiKey: geminiKey });

    const playerInfo = playerContext ? `\n\nPlayers in this match:\n${playerContext}` : '';

    step('Gemini scanning full video at LOW resolution...');
    const response = await geminiWithRetry(
      () => ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: createUserContent([
          createPartFromUri(geminiFileUri, mimeType || 'video/mp4'),
          `${STRUCTURE_PROMPT}${playerInfo}`,
        ]),
        config: {
          mediaResolution: MediaResolution.MEDIA_RESOLUTION_LOW,
        },
      }),
      step,
    );

    const text = response.text || '';
    step(`Got response (${text.length} chars)`);

    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const result = JSON.parse(cleaned);

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    step(`SUCCESS — ${result.segments?.length ?? 0} segments found in ${totalTime}s`);

    return res.status(200).json(result);
  } catch (error: any) {
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`[analyze-structure] FAILED after ${totalTime}s:`, error);
    return res.status(500).json({
      error: error.message || 'Structure scan failed',
      failedAfterSeconds: parseFloat(totalTime),
    });
  }
}
