import { GoogleGenAI, createUserContent, createPartFromUri, MediaResolution } from '@google/genai';
import Anthropic from '@anthropic-ai/sdk';
import { del } from '@vercel/blob';
import { geminiWithRetry } from './_gemini-retry.js';

export const config = { maxDuration: 300 };

const GEMINI_OBSERVATION_PROMPT = `You are a professional pickleball video analyst. Your ONLY job is to watch this video and produce a detailed play-by-play observation report. Do NOT rate or judge the players — just describe what you see with precision.

## CRITICAL: Player Identification
Each player has been described by their appearance (clothing, hat, build, etc.). Use these descriptions to identify WHO is making each shot. This is the most important part — every observation must be attributed to the correct player by name. If a player's appearance matches the description, use their name. If you are unsure, note the uncertainty but still make your best guess based on the description.

For EVERY rally you can identify, document:
1. Who served (by NAME), serve placement and depth
2. Return quality and returner's NAME and movement after
3. Third shot choice (drop/drive) — who hit it (by NAME) and result
4. Dink exchanges — count them, note height, cross-court vs straight, who is involved
5. Any speed-ups: who initiated (by NAME), target, result
6. Any resets/blocks and quality — who made the play
7. How the point ended (winner, unforced error, forced error) — WHO made the final shot/error
8. Court positioning throughout the rally for each player

Also note for each player (by NAME) across the WHOLE match:
- Total serves observed and general serve quality
- How often they get to the kitchen line after their third shot
- Dink consistency (pop-ups? patience?)
- Transition zone behavior (get stuck or move through?)
- Footwork observations (split step? ready position?)
- Unforced errors you counted
- Best shots / worst moments

Be SPECIFIC. Use timestamps when possible. Count actual numbers. Always refer to players by their NAME, not generic descriptions.

Format your response as a structured text report with clear sections per player.`;

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { systemPrompt, playerContext, blobUrl, mimeType } = req.body;
  const geminiKey = process.env.GEMINI_API_KEY;
  const claudeKey = process.env.ANTHROPIC_API_KEY;

  if (!geminiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
  }
  if (!blobUrl) {
    return res.status(400).json({ error: 'No blobUrl provided' });
  }

  const startTime = Date.now();
  const step = (name: string) => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[analyze] [${elapsed}s] ${name}`);
  };

  try {
    step('Starting analysis pipeline');
    const ai = new GoogleGenAI({ apiKey: geminiKey });

    // Step 1: Download video from Vercel Blob
    step('Downloading video from Vercel Blob...');
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;

    let videoResponse = await fetch(blobUrl,
      blobToken ? { headers: { 'Authorization': `Bearer ${blobToken}` } } : {}
    );
    if (!videoResponse.ok && blobToken) {
      videoResponse = await fetch(blobUrl);
    }
    if (!videoResponse.ok) {
      throw new Error(`Failed to download video from blob (HTTP ${videoResponse.status})`);
    }

    const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
    const sizeMB = (videoBuffer.length / (1024 * 1024)).toFixed(1);
    step(`Downloaded ${sizeMB}MB from blob (using low mediaResolution for full video coverage)`);

    // Step 2: Upload to Gemini File API
    step('Uploading video to Gemini File API...');
    const uploadedFile = await ai.files.upload({
      file: new Blob([videoBuffer], { type: mimeType || 'video/mp4' }),
      config: { mimeType: mimeType || 'video/mp4' },
    });
    step(`Uploaded to Gemini as ${uploadedFile.name}`);

    // Step 3: Poll until file is ACTIVE
    step('Waiting for Gemini to process video...');
    let file = await ai.files.get({ name: uploadedFile.name! });
    let attempts = 0;
    while (file.state === 'PROCESSING' && attempts < 120) {
      await new Promise(r => setTimeout(r, 3000));
      file = await ai.files.get({ name: uploadedFile.name! });
      attempts++;
      if (attempts % 10 === 0) {
        step(`Still processing... (attempt ${attempts}, state: ${file.state})`);
      }
    }

    if (file.state !== 'ACTIVE') {
      throw new Error(`Gemini video processing failed after ${attempts} attempts. State: ${file.state}`);
    }
    step(`Gemini file ACTIVE after ${attempts} polls`);

    // Clean up the Vercel Blob
    try {
      await del(blobUrl);
      step('Cleaned up blob storage');
    } catch {
      // non-critical
    }

    // Step 4: Gemini watches the video and produces observations (with retry)
    step('Phase 1: Gemini analyzing video (this is the slow part)...');
    const geminiResponse = await geminiWithRetry(
      () => ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: createUserContent([
          createPartFromUri(file.uri!, mimeType || 'video/mp4'),
          `${GEMINI_OBSERVATION_PROMPT}

Players in this match:
${playerContext}

Watch the ENTIRE video and produce your detailed observation report.`,
        ]),
        config: {
          mediaResolution: MediaResolution.MEDIA_RESOLUTION_LOW,
        },
      }),
      step,
    );

    const observations = geminiResponse.text || '';
    step(`Gemini observations complete (${observations.length} chars)`);

    // Step 5: Claude analyzes the observations
    let analysisText: string;

    if (claudeKey) {
      step('Phase 2: Claude analyzing observations...');
      const claude = new Anthropic({ apiKey: claudeKey });

      const claudeResponse = await claude.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 8000,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: `You are receiving a detailed play-by-play observation report from a video analyst who watched a complete pickleball game. Use these observations to produce your expert competitive analysis.

## Video Analyst's Observation Report:

${observations}

## Players:
${playerContext}

Based on these detailed observations, produce your expert analysis. Rate each player on the USA Pickleball 2.0-5.5+ scale. Your ratings must be justified by specific observations from the report above.

Remember:
- Most recreational players are 2.5-4.0
- Casual friend groups are typically 2.5-3.5
- Consistency matters more than occasional highlights
- Unforced errors are the #1 skill level indicator
- The 3.5→4.0 gap is the biggest jump in recreational play

Return ONLY valid JSON matching the specified structure. No markdown, no code fences.`,
          },
        ],
      });

      analysisText = claudeResponse.content[0].type === 'text' ? claudeResponse.content[0].text : '';
      step(`Claude analysis complete (${analysisText.length} chars)`);
    } else {
      step('Phase 2: Gemini analyzing (no Claude key)...');
      const geminiAnalysis = await geminiWithRetry(
        () => ai.models.generateContent({
          model: 'gemini-2.5-pro',
          contents: createUserContent([
            createPartFromUri(file.uri!, mimeType || 'video/mp4'),
            `${systemPrompt}

Players in this match:
${playerContext}

Here are your own detailed observations from watching this video:
${observations}

Now produce the final competitive analysis JSON based on everything you observed. Rate each player on the USA Pickleball 2.0-5.5+ scale.

Return ONLY valid JSON matching the specified structure. No markdown, no code fences.`,
          ]),
          config: {
            mediaResolution: MediaResolution.MEDIA_RESOLUTION_LOW,
          },
        }),
        step,
      );

      analysisText = geminiAnalysis.text || '';
      step(`Gemini analysis complete (${analysisText.length} chars)`);
    }

    // Step 6: Parse JSON
    step('Parsing analysis JSON...');
    const cleaned = analysisText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const analysis = JSON.parse(cleaned);

    analysis.gemini_observations = observations;
    analysis.analysis_mode = claudeKey ? 'dual-model (Gemini + Claude)' : 'gemini-only';

    // Clean up Gemini file
    try {
      await ai.files.delete({ name: uploadedFile.name! });
    } catch {
      // ignore
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    step(`SUCCESS — total time: ${totalTime}s`);

    return res.status(200).json(analysis);
  } catch (error: any) {
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`[analyze] FAILED after ${totalTime}s:`, error);
    return res.status(500).json({
      error: error.message || 'Analysis failed',
      failedAfterSeconds: parseFloat(totalTime),
    });
  }
}
