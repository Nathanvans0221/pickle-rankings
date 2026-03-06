import Anthropic from '@anthropic-ai/sdk';

export const config = { maxDuration: 300 };

const CALIBRATION_PROMPT = `You are a calibration reviewer for pickleball player ratings. You have been given a DRAFT analysis produced by another analyst. Your job is to act as a devil's advocate and stress-test each rating.

For EACH player's rating in the draft:
1. Find at least 2 pieces of evidence from the observation data that SUPPORT the assigned rating
2. Find at least 2 pieces of evidence that CONTRADICT or challenge the assigned rating (suggest it might be too high or too low)
3. Based on your review, you MAY adjust any rating by up to +/-0.5, but you MUST preserve the relative ranking order (the player ranked #1 must still have the highest rating, etc.)
4. If the evidence clearly supports a bigger adjustment, explain why but still cap at +/-0.5

After your review, output the FINAL analysis JSON (same structure as the draft, with any adjusted ratings) AND a separate calibration_notes field explaining your reasoning.

## Important
- Do NOT inflate ratings. Most recreational players are 2.5-4.0.
- Preserve the existing JSON structure exactly.
- The final JSON must be valid and parseable.
- Your adjustments should make ratings MORE accurate, not just different.

Return ONLY valid JSON, no markdown, no code fences:
{
  "summary": "...",
  "duration_estimate": "...",
  "rally_count": <number>,
  "highlights": [...],
  "player_analyses": [...same structure as input...],
  "calibration_notes": "Your detailed reasoning for any adjustments made, or confirmation that the original ratings are well-supported"
}`;

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { draftAnalysis, segmentObservations, playerFocusReports } = req.body;
  const claudeKey = process.env.ANTHROPIC_API_KEY;

  if (!claudeKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }
  if (!draftAnalysis) {
    return res.status(400).json({ error: 'No draftAnalysis provided' });
  }

  const startTime = Date.now();
  const step = (name: string) => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[analyze-calibrate] [${elapsed}s] ${name}`);
  };

  try {
    step('Starting calibration challenge (Phase 5)');
    const claude = new Anthropic({ apiKey: claudeKey });

    // Build observation context (may arrive as pre-joined string or array)
    let observationText = '';
    if (segmentObservations) {
      if (typeof segmentObservations === 'string') {
        observationText = segmentObservations;
      } else if (Array.isArray(segmentObservations)) {
        observationText = segmentObservations.map((obs: any, i: number) =>
          `### Segment ${i + 1} (${obs.segment_start}s - ${obs.segment_end}s)\n${obs.rally_log}`
        ).join('\n\n');
      }
    }

    let focusText = '';
    if (playerFocusReports && Array.isArray(playerFocusReports)) {
      focusText = playerFocusReports.map((report: string, i: number) =>
        `### Player Focus Report ${i + 1}\n${report}`
      ).join('\n\n');
    }

    const userPrompt = `## Draft Analysis to Review
${JSON.stringify(draftAnalysis, null, 2)}

${observationText ? `## Raw Observation Data (for evidence cross-referencing)\n${observationText}` : ''}

${focusText ? `## Player Focus Reports (for evidence cross-referencing)\n${focusText}` : ''}

Review the draft analysis above. For each player's rating, find evidence that SUPPORTS it AND evidence that CONTRADICTS it. Adjust ratings if warranted (max +/-0.5, preserve ranking order). Return the final calibrated analysis JSON.`;

    step('Claude running calibration challenge...');
    const claudeResponse = await claude.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 8000,
      system: CALIBRATION_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const analysisText = claudeResponse.content[0].type === 'text' ? claudeResponse.content[0].text : '';
    step(`Claude calibration response (${analysisText.length} chars)`);

    // Parse JSON
    step('Parsing calibrated analysis JSON...');
    const cleaned = analysisText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const calibrated = JSON.parse(cleaned);

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    step(`SUCCESS — calibrated analysis complete in ${totalTime}s`);

    return res.status(200).json(calibrated);
  } catch (error: any) {
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`[analyze-calibrate] FAILED after ${totalTime}s:`, error);
    return res.status(500).json({
      error: error.message || 'Calibration failed',
      failedAfterSeconds: parseFloat(totalTime),
    });
  }
}
