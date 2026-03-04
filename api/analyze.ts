import { GoogleGenAI, createUserContent, createPartFromUri } from '@google/genai';
import Anthropic from '@anthropic-ai/sdk';

export const config = { maxDuration: 300 };

const GEMINI_OBSERVATION_PROMPT = `You are a professional pickleball video analyst. Your ONLY job is to watch this video and produce a detailed play-by-play observation report. Do NOT rate or judge the players — just describe what you see with precision.

For EVERY rally you can identify, document:
1. Who served, serve placement and depth
2. Return quality and returner's movement after
3. Third shot choice (drop/drive) and result
4. Dink exchanges — count them, note height, cross-court vs straight
5. Any speed-ups: who initiated, target, result
6. Any resets/blocks and quality
7. How the point ended (winner, unforced error, forced error)
8. Court positioning throughout the rally

Also note for each player across the WHOLE match:
- Total serves observed and general serve quality
- How often they get to the kitchen line after their third shot
- Dink consistency (pop-ups? patience?)
- Transition zone behavior (get stuck or move through?)
- Footwork observations (split step? ready position?)
- Unforced errors you counted
- Best shots / worst moments

Be SPECIFIC. Use timestamps when possible. Count actual numbers.

Format your response as a structured text report with clear sections per player.`;

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { systemPrompt, playerContext, fileName, mimeType } = req.body;
  const geminiKey = process.env.GEMINI_API_KEY;
  const claudeKey = process.env.ANTHROPIC_API_KEY;

  if (!geminiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
  }
  if (!fileName) {
    return res.status(400).json({ error: 'No fileName provided' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey: geminiKey });

    // Poll until file is ACTIVE
    let file = await ai.files.get({ name: fileName });
    let attempts = 0;
    while (file.state === 'PROCESSING' && attempts < 120) {
      await new Promise(r => setTimeout(r, 3000));
      file = await ai.files.get({ name: fileName });
      attempts++;
    }

    if (file.state !== 'ACTIVE') {
      throw new Error(`Video processing failed. State: ${file.state}`);
    }

    // ===== PHASE 1: Gemini watches the video and produces observations =====
    const geminiResponse = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: createUserContent([
        createPartFromUri(file.uri!, mimeType || 'video/mp4'),
        `${GEMINI_OBSERVATION_PROMPT}

Players in this match:
${playerContext}

Watch the ENTIRE video and produce your detailed observation report.`,
      ]),
    });

    const observations = geminiResponse.text || '';

    // ===== PHASE 2: Claude analyzes the observations =====
    let analysisText: string;

    if (claudeKey) {
      // Dual-model: Claude does the expert analysis based on Gemini's observations
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
    } else {
      // Fallback: Gemini-only mode if no Claude key
      const geminiAnalysis = await ai.models.generateContent({
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
      });

      analysisText = geminiAnalysis.text || '';
    }

    // Parse JSON
    const cleaned = analysisText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const analysis = JSON.parse(cleaned);

    // Attach the raw observations for transparency
    analysis.gemini_observations = observations;
    analysis.analysis_mode = claudeKey ? 'dual-model (Gemini + Claude)' : 'gemini-only';

    // Clean up
    try {
      await ai.files.delete({ name: fileName });
    } catch {
      // ignore
    }

    return res.status(200).json(analysis);
  } catch (error: any) {
    console.error('Analysis error:', error);
    return res.status(500).json({
      error: error.message || 'Analysis failed',
    });
  }
}
