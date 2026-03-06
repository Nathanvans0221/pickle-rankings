import { GoogleGenAI, createUserContent, createPartFromUri, MediaResolution } from '@google/genai';
import { geminiWithRetry } from './_gemini-retry.js';
import { handleCors } from './_cors.js';

export const config = { maxDuration: 300 };

const IDENTIFY_PROMPT = `You are watching a pickleball game video. Your ONLY job is to identify each distinct player on the court and describe their physical appearance so a human can match names to faces.

Watch the video and identify every unique player. For each player, provide:
1. A clear physical description (clothing color, hat, build, hair, distinguishing features)
2. Which side of the court they primarily play on (left/right, near/far)
3. Any other identifying details

IMPORTANT:
- Look at the ENTIRE video — players may change sides or partners between games
- Be very specific about clothing (e.g., "navy blue sleeveless shirt" not just "dark shirt")
- Note any accessories: hats, sunglasses, wristbands, etc.
- If you can see jersey numbers or text on clothing, include that
- Describe build (tall, short, stocky, slim) and hair if visible

Return ONLY a valid JSON array, no markdown, no code fences:
[
  {
    "label": "Player A",
    "description": "Tall, wearing a red sleeveless shirt and black shorts, white baseball cap worn backwards, athletic build",
    "court_position": "Usually on the left/near side"
  },
  {
    "label": "Player B",
    "description": "...",
    "court_position": "..."
  }
]

Return between 2 and 6 players. If you see the same person from different angles, combine into one entry.`;

export default async function handler(req: any, res: any) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { blobUrl, mimeType } = req.body;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (!geminiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
  }
  if (!blobUrl) {
    return res.status(400).json({ error: 'No blobUrl provided' });
  }

  const startTime = Date.now();
  const step = (name: string) => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[identify] [${elapsed}s] ${name}`);
  };

  try {
    step('Starting player identification');
    const ai = new GoogleGenAI({ apiKey: geminiKey });

    // Download video from blob
    step('Downloading video from blob...');
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
    let videoResponse = await fetch(blobUrl,
      blobToken ? { headers: { 'Authorization': `Bearer ${blobToken}` } } : {}
    );
    if (!videoResponse.ok && blobToken) {
      videoResponse = await fetch(blobUrl);
    }
    if (!videoResponse.ok) {
      throw new Error(`Failed to download video (HTTP ${videoResponse.status})`);
    }

    const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
    const sizeMB = (videoBuffer.length / (1024 * 1024)).toFixed(1);
    step(`Downloaded ${sizeMB}MB`);

    // Upload to Gemini
    step('Uploading to Gemini...');
    const uploadedFile = await ai.files.upload({
      file: new Blob([videoBuffer], { type: mimeType || 'video/mp4' }),
      config: { mimeType: mimeType || 'video/mp4' },
    });
    step(`Uploaded as ${uploadedFile.name}`);

    // Wait for ACTIVE
    step('Waiting for processing...');
    let file = await ai.files.get({ name: uploadedFile.name! });
    let attempts = 0;
    while (file.state === 'PROCESSING' && attempts < 120) {
      await new Promise(r => setTimeout(r, 3000));
      file = await ai.files.get({ name: uploadedFile.name! });
      attempts++;
    }

    if (file.state !== 'ACTIVE') {
      throw new Error(`Video processing failed. State: ${file.state}`);
    }
    step(`File ACTIVE after ${attempts} polls`);

    // Ask Gemini to identify players (with retry for 503/429)
    step('Identifying players...');
    const response = await geminiWithRetry(
      () => ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: createUserContent([
          createPartFromUri(file.uri!, mimeType || 'video/mp4'),
          IDENTIFY_PROMPT,
        ]),
        config: {
          mediaResolution: MediaResolution.MEDIA_RESOLUTION_LOW,
        },
      }),
      step,
    );

    const text = response.text || '';
    step(`Got response (${text.length} chars)`);

    // Parse JSON
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const players = JSON.parse(cleaned);

    // Store the Gemini file name so the analyze endpoint can reuse it
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    step(`SUCCESS — ${players.length} players identified in ${totalTime}s`);

    return res.status(200).json({
      players,
      geminiFileName: uploadedFile.name,
      geminiFileUri: file.uri,
    });
  } catch (error: any) {
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`[identify] FAILED after ${totalTime}s:`, error);
    return res.status(500).json({
      error: error.message || 'Player identification failed',
      failedAfterSeconds: parseFloat(totalTime),
    });
  }
}
