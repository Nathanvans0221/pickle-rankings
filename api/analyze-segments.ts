import { GoogleGenAI, createUserContent, MediaResolution } from '@google/genai';
import { geminiWithRetry } from './_gemini-retry.js';

export const config = { maxDuration: 300 };

const MAX_SEGMENT_DURATION = 480; // 8 minutes in seconds

const SEGMENT_PROMPT = `You are a professional pickleball video analyst. You are watching a SPECIFIC SEGMENT of a pickleball match. Your job is to produce a detailed play-by-play observation report for this segment ONLY.

For EVERY rally you can identify in this segment, document:
1. Who served (by NAME if known), serve placement and depth
2. Return quality and returner's movement after
3. Third shot choice (drop/drive) — who hit it and result
4. Dink exchanges — count them, note height, cross-court vs straight, who is involved
5. Any speed-ups: who initiated, target, result
6. Any resets/blocks and quality — who made the play
7. How the point ended (winner, unforced error, forced error) — WHO made the final shot/error
8. Court positioning throughout the rally

Be SPECIFIC. Use timestamps when possible. Count actual numbers. Always refer to players by their NAME when identified.

Return ONLY valid JSON, no markdown, no code fences:
{
  "rally_log": "Your detailed play-by-play text report for this segment"
}`;

interface Segment {
  start: number;
  end: number;
  game_number: number;
}

function splitSegment(seg: Segment): Segment[] {
  const duration = seg.end - seg.start;
  if (duration <= MAX_SEGMENT_DURATION) return [seg];

  const chunks: Segment[] = [];
  let current = seg.start;
  while (current < seg.end) {
    const chunkEnd = Math.min(current + MAX_SEGMENT_DURATION, seg.end);
    chunks.push({ start: current, end: chunkEnd, game_number: seg.game_number });
    current = chunkEnd;
  }
  return chunks;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { geminiFileUri, mimeType, segments, playerContext } = req.body;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (!geminiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
  }
  if (!geminiFileUri) {
    return res.status(400).json({ error: 'No geminiFileUri provided' });
  }
  if (!segments || !Array.isArray(segments) || segments.length === 0) {
    return res.status(400).json({ error: 'No segments provided' });
  }

  const startTime = Date.now();
  const step = (name: string) => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[analyze-segments] [${elapsed}s] ${name}`);
  };

  try {
    step(`Starting segment deep analysis (Phase 2) — ${segments.length} segments`);
    const ai = new GoogleGenAI({ apiKey: geminiKey });

    const playerInfo = playerContext ? `\n\nPlayers in this match:\n${playerContext}` : '';

    // Split any segments longer than 8 minutes
    const allChunks: Segment[] = [];
    for (const seg of segments) {
      allChunks.push(...splitSegment(seg));
    }
    step(`Split into ${allChunks.length} chunks (max ${MAX_SEGMENT_DURATION}s each)`);

    const segmentObservations: { segment_start: number; segment_end: number; rally_log: string }[] = [];

    // Process segments sequentially to avoid rate limits
    for (let i = 0; i < allChunks.length; i++) {
      const chunk = allChunks[i];
      step(`Analyzing chunk ${i + 1}/${allChunks.length} (${chunk.start}s - ${chunk.end}s, game ${chunk.game_number})`);

      // Construct clipped part manually — createPartFromUri does NOT support videoMetadata
      const clippedPart = {
        fileData: { fileUri: geminiFileUri, mimeType: mimeType || 'video/mp4' },
        videoMetadata: { startOffset: `${chunk.start}s`, endOffset: `${chunk.end}s` },
      };

      const response = await geminiWithRetry(
        () => ai.models.generateContent({
          model: 'gemini-2.5-pro',
          contents: createUserContent([
            clippedPart as any,
            `${SEGMENT_PROMPT}${playerInfo}\n\nThis is game ${chunk.game_number}, from ${chunk.start}s to ${chunk.end}s in the video.`,
          ]),
          config: {
            mediaResolution: MediaResolution.MEDIA_RESOLUTION_MEDIUM,
          },
        }),
        step,
      );

      const text = response.text || '';
      step(`Chunk ${i + 1} response (${text.length} chars)`);

      let rallyLog: string;
      try {
        const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(cleaned);
        rallyLog = parsed.rally_log || text;
      } catch {
        // If JSON parsing fails, use the raw text as the rally log
        rallyLog = text;
      }

      segmentObservations.push({
        segment_start: chunk.start,
        segment_end: chunk.end,
        rally_log: rallyLog,
      });
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    step(`SUCCESS — ${segmentObservations.length} segment observations in ${totalTime}s`);

    return res.status(200).json({ segmentObservations });
  } catch (error: any) {
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`[analyze-segments] FAILED after ${totalTime}s:`, error);
    return res.status(500).json({
      error: error.message || 'Segment analysis failed',
      failedAfterSeconds: parseFloat(totalTime),
    });
  }
}
