import { GoogleGenAI, createUserContent, createPartFromUri } from '@google/genai';

export const config = { maxDuration: 300 }; // 5 min — video processing takes time

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { systemPrompt, playerContext, videoBase64, mimeType } = req.body;
  const key = process.env.GEMINI_API_KEY;

  if (!key) {
    return res.status(400).json({ error: 'No Gemini API key configured. Set GEMINI_API_KEY env var on Vercel.' });
  }
  if (!videoBase64) {
    return res.status(400).json({ error: 'No video data provided' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey: key });

    // Upload the video to Gemini File API
    const videoBuffer = Buffer.from(videoBase64, 'base64');
    const blob = new Blob([videoBuffer], { type: mimeType || 'video/mp4' });

    const uploadedFile = await ai.files.upload({
      file: blob,
      config: { mimeType: mimeType || 'video/mp4' },
    });

    // Wait for file to finish processing
    let file = await ai.files.get({ name: uploadedFile.name! });
    let attempts = 0;
    while (file.state === 'PROCESSING' && attempts < 60) {
      await new Promise(r => setTimeout(r, 3000));
      file = await ai.files.get({ name: uploadedFile.name! });
      attempts++;
    }

    if (file.state !== 'ACTIVE') {
      throw new Error(`Video processing failed. State: ${file.state}`);
    }

    // Analyze the full video with Gemini
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: createUserContent([
        createPartFromUri(file.uri!, file.mimeType!),
        `${systemPrompt}

Players in this match:
${playerContext}

Watch this ENTIRE pickleball game video carefully. Analyze every rally, every shot, every point. Assess each player's skill level, shot quality, positioning, strategy, and consistency throughout the full match.

Pay close attention to:
- Serve technique, depth, and consistency across all service games
- Third shot selection (drop vs drive) and execution quality
- Dink rallies — patience, height over net, consistency, cross-court patterns
- Transition zone play — do they get stuck or move through efficiently?
- Speed-up timing — are they attacking the right balls?
- Resets and blocks — soft hands under pressure
- Court positioning — kitchen line discipline, spacing with partner
- Unforced errors vs winners ratio
- Movement, footwork, and recovery between shots

Provide ratings on the USA Pickleball 2.0-5.5+ scale.

Return ONLY valid JSON matching the specified structure. No markdown, no code fences, no explanation outside the JSON.`,
      ]),
    });

    const text = response.text || '';

    // Parse JSON from response (strip any accidental markdown fences)
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const analysis = JSON.parse(cleaned);

    // Clean up the uploaded file
    try {
      await ai.files.delete({ name: uploadedFile.name! });
    } catch {
      // ignore cleanup errors
    }

    return res.status(200).json(analysis);
  } catch (error: any) {
    console.error('Analysis error:', error);
    return res.status(500).json({
      error: error.message || 'Analysis failed',
    });
  }
}
