import { GoogleGenAI, createUserContent, createPartFromUri, MediaResolution } from '@google/genai';
import { geminiWithRetry } from './_gemini-retry.js';

export const config = { maxDuration: 300 };

const PLAYER_FOCUS_PROMPT = `You are a professional pickleball video analyst. Your job is to watch this ENTIRE video and focus EXCLUSIVELY on the following players. Track them throughout every rally.

For EACH of the specified players, provide:

1. **Serve Analysis**: Count their total serves. Note placement patterns (deep/short, center/wide), spin usage, consistency.
2. **Return Analysis**: Count their returns. Do they get to the kitchen line after returning? Return depth and quality.
3. **Third Shot**: What do they prefer — drops or drives? Success rate on each. Do they move forward after their third shot?
4. **Dink Game**: Patience level, height control, cross-court vs straight patterns, pop-up frequency.
5. **Speed-ups**: How often do they initiate? Target selection (body, feet, backhand). Success rate.
6. **Errors**: Count unforced errors. What type (into net, out wide, pop-ups)?
7. **Court Positioning**: Kitchen line discipline, transition zone behavior, partner spacing.
8. **Footwork**: Split step, ready position, lateral movement quality.
9. **Patterns & Tendencies**: Any recurring habits (always drives third shot, always dinks cross-court, etc.).
10. **Strengths**: What they do well consistently.
11. **Weaknesses**: What opponents could exploit.

Be SPECIFIC with counts and timestamps where possible. This is a detailed scouting report.

Return ONLY valid JSON, no markdown, no code fences:
{
  "focusReport": "Your detailed multi-section scouting report text covering both players"
}`;

interface TeamPlayer {
  player_id: string;
  player_name: string;
  appearance?: string;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { geminiFileUri, mimeType, playerContext, teamPlayers } = req.body;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (!geminiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
  }
  if (!geminiFileUri) {
    return res.status(400).json({ error: 'No geminiFileUri provided' });
  }
  if (!teamPlayers || !Array.isArray(teamPlayers) || teamPlayers.length === 0) {
    return res.status(400).json({ error: 'No teamPlayers provided' });
  }

  const startTime = Date.now();
  const step = (name: string) => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[analyze-player-focus] [${elapsed}s] ${name}`);
  };

  try {
    const playerNames = (teamPlayers as TeamPlayer[]).map(p => p.player_name).join(' & ');
    step(`Starting player-focused analysis (Phase 3) for: ${playerNames}`);
    const ai = new GoogleGenAI({ apiKey: geminiKey });

    const focusPlayerDesc = (teamPlayers as TeamPlayer[]).map(p => {
      const appearance = p.appearance ? ` — Appearance: ${p.appearance}` : '';
      return `- ${p.player_name} (ID: ${p.player_id}${appearance})`;
    }).join('\n');

    const fullPlayerContext = playerContext ? `\n\nAll players in this match:\n${playerContext}` : '';

    step('Gemini analyzing full video at MEDIUM resolution (player focus)...');
    const response = await geminiWithRetry(
      () => ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: createUserContent([
          createPartFromUri(geminiFileUri, mimeType || 'video/mp4'),
          `${PLAYER_FOCUS_PROMPT}\n\n## FOCUS ON THESE PLAYERS ONLY:\n${focusPlayerDesc}${fullPlayerContext}\n\nWatch the ENTIRE video. Track these players through every single rally. Produce a comprehensive scouting report.`,
        ]),
        config: {
          mediaResolution: MediaResolution.MEDIA_RESOLUTION_MEDIUM,
        },
      }),
      step,
    );

    const text = response.text || '';
    step(`Got response (${text.length} chars)`);

    let focusReport: string;
    try {
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);
      focusReport = parsed.focusReport || text;
    } catch {
      focusReport = text;
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    step(`SUCCESS — player focus report complete in ${totalTime}s`);

    return res.status(200).json({ focusReport });
  } catch (error: any) {
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`[analyze-player-focus] FAILED after ${totalTime}s:`, error);
    return res.status(500).json({
      error: error.message || 'Player focus analysis failed',
      failedAfterSeconds: parseFloat(totalTime),
    });
  }
}
