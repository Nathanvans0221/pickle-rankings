import Anthropic from '@anthropic-ai/sdk';
import { handleCors } from './_cors.js';

export const config = { maxDuration: 300 };

const ANALYSIS_SYSTEM_PROMPT = `You are an elite pickleball analyst and certified coach. You are watching a FULL pickleball game video — not screenshots, the actual gameplay footage.

Your job is to evaluate each player's skill level using the official USA Pickleball skill rating scale (2.0 - 5.5+). Watch every rally carefully. Count shots. Track patterns. This must be a legitimate competitive analysis.

## Rating Scale Reference

- **2.0 (True Beginner)**: Minimal experience, inconsistent contact, learning basic rules. Lots of mishits, can't sustain rallies.
- **2.5 (Beginner)**: Basic swing mechanics developing, can sustain short rallies, learning all rules. Pop-ups on dinks/blocks, standing in transition zone too long, overhitting.
- **3.0 (Advanced Beginner)**: Hit variety of strokes, developing dinks and third-shot intentions, reducing unforced errors. Game starts to look like pickleball, not paddle-ball.
- **3.5 (Intermediate)**: Dink with moderate consistency (pop-ups persist), third-shot drops/drives with a plan to get to kitchen, purposeful NVZ movement. Speed-ups sometimes on non-attackable balls.
- **4.0 (Advanced Intermediate)**: Deeper and more intentional returns, transition zone resets working, run patterns not just hit shots, identify attackable balls accurately. Soft game holds against speed.
- **4.5 (Advanced)**: Absorb pace with blocks and resets that land low, initiate speed-ups at right time to correct targets, disciplined dinks. Defined by how few free points given away. Pace management and tactical adaptation.
- **5.0 (Expert)**: Third-shot drop/drive/hybrid all available with correct selection, reset under stress, dink patterns set up offense. Points end from forced advantage not errors. Low leakage and professional shot selection.
- **5.5+ (Pro)**: Dominance-level execution, tournament-caliber consistency. Mastered every skill and improved upon it.

## What to Watch For (IN THE VIDEO)
- **Serve**: Depth (does it land deep?), placement variety, consistency across service games, spin
- **Return of Serve**: Depth, does the returner get to the kitchen line after?
- **Third Shot**: Drop vs drive selection, drop quality (soft arc into kitchen vs popping up), drive accuracy and purpose
- **Dinks**: Cross-court patterns, height control (low over net = good), patience in dink rallies, ability to move opponent with dinks
- **Volleys**: Punch volleys vs swing volleys, reaction time, placement
- **Speed-ups/Put-aways**: Are they attacking the RIGHT balls? Target selection (body, feet, backhand), effectiveness
- **Blocks/Resets**: Soft hands under pressure, can they absorb hard drives and drop into NVZ?
- **Lobs**: Tactical timing, depth, do they recover position after?
- **Erné**: If attempted — anticipation and execution
- **Transition Zone**: Do they get stuck mid-court or move through efficiently to the kitchen line?
- **Unforced Errors**: Count them. This is the #1 indicator of skill level.
- **Court Positioning**: Kitchen line discipline, proper spacing with partner (not both on same side)
- **Footwork**: Split step, ready position, lateral movement

## Scoring Context
- If score is provided, factor win/loss into rating confidence
- Watch for clutch play in close games vs choking under pressure
- Note any significant momentum shifts

## Important Rating Guidelines
- Rate conservatively. Most recreational players are 2.5-4.0.
- A group of friends playing casually is typically 2.5-3.5.
- Don't inflate ratings — a true 4.0 is quite good recreationally.
- The gap between 3.5 and 4.0 is the biggest skill jump in recreational play.
- Consistency is MORE important than occasional great shots.

## Correction History Context
Some players may include "Correction History" data showing how the user has corrected your ratings in previous analyses. This correction history is GROUND TRUTH — it reflects the human's direct assessment after watching the same footage. If a player has a correction history showing the AI consistently underrates or overrates them, you MUST weight your assessment accordingly. For example, if correction history shows "avg +0.7 UPWARD", your initial rating instinct for that player is likely ~0.7 too low — adjust upward proactively.

Respond with a JSON object matching this structure exactly:
{
  "summary": "Brief 2-3 sentence overview of the match including style of play and competitiveness",
  "duration_estimate": "Estimated match duration based on video",
  "rally_count": <number of rallies you counted>,
  "highlights": ["Specific notable moment with timestamp estimate", "Another highlight"],
  "player_analyses": [
    {
      "player_id": "player_id_here",
      "player_name": "Player Name",
      "rating_before": <current_rating>,
      "rating_after": <new_rating based on this performance>,
      "rating_change": <difference>,
      "skill_assessment": {
        "overall": <2.0-5.5>,
        "serve": <2.0-5.5>,
        "return_of_serve": <2.0-5.5>,
        "third_shot": <2.0-5.5>,
        "dinks": <2.0-5.5>,
        "volleys": <2.0-5.5>,
        "court_positioning": <2.0-5.5>,
        "strategy": <2.0-5.5>,
        "consistency": <2.0-5.5>
      },
      "shot_breakdown": {
        "serves": { "count": <actual count from video>, "quality": <1-10>, "notes": "specific observation" },
        "returns": { "count": <count>, "quality": <1-10>, "notes": "" },
        "third_shot_drops": { "count": <count>, "quality": <1-10>, "notes": "" },
        "third_shot_drives": { "count": <count>, "quality": <1-10>, "notes": "" },
        "dinks": { "count": <count>, "quality": <1-10>, "notes": "" },
        "volleys": { "count": <count>, "quality": <1-10>, "notes": "" },
        "speed_ups": { "count": <count>, "quality": <1-10>, "notes": "" },
        "resets": { "count": <count>, "quality": <1-10>, "notes": "" },
        "lobs": { "count": <count>, "quality": <1-10>, "notes": "" },
        "put_aways": { "count": <count>, "quality": <1-10>, "notes": "" }
      },
      "strengths": ["Specific strength observed in video", "Another strength"],
      "improvements": ["Specific area to work on based on observed play", "Another area"]
    }
  ]
}`;

export default async function handler(req: any, res: any) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { playerContext, segmentObservations, playerFocusReports, structureSummary, players } = req.body;
  const claudeKey = process.env.ANTHROPIC_API_KEY;

  if (!claudeKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }
  if (!segmentObservations) {
    return res.status(400).json({ error: 'No segmentObservations provided' });
  }

  const startTime = Date.now();
  const step = (name: string) => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[analyze-rate] [${elapsed}s] ${name}`);
  };

  try {
    step('Starting comparative rating (Phase 4)');
    const claude = new Anthropic({ apiKey: claudeKey });

    // Build the segment observations text (may arrive as pre-joined string or array)
    const segmentText = typeof segmentObservations === 'string'
      ? segmentObservations
      : segmentObservations.map((obs: any, i: number) =>
          `### Segment ${i + 1} (${obs.segment_start}s - ${obs.segment_end}s)\n${obs.rally_log}`
        ).join('\n\n');

    // Build player focus reports text
    let focusText = '';
    if (playerFocusReports && Array.isArray(playerFocusReports)) {
      focusText = playerFocusReports.map((report: string, i: number) =>
        `### Player Focus Report ${i + 1}\n${report}`
      ).join('\n\n');
    }

    // Build structure summary text
    let structureText = '';
    if (structureSummary) {
      structureText = `## Match Structure\n${JSON.stringify(structureSummary, null, 2)}`;
    }

    const userPrompt = `You are synthesizing detailed observations from a multi-phase pickleball video analysis. Use ALL of the data below to produce your expert competitive analysis.

## Players
${playerContext || (players ? players.map((p: any) => `- ${p.player_name} (ID: ${p.player_id}, Team ${p.team}, Current Rating: ${p.current_rating ?? 2.5})`).join('\n') : 'No player info available.')}

${structureText}

## Detailed Play-by-Play Observations (from video segments)
${segmentText}

${focusText ? `## Player-Focused Scouting Reports\n${focusText}` : ''}

## CRITICAL INSTRUCTIONS
1. FIRST, rank ALL players from best to worst based on the evidence above. Write out your ranking with brief justification.
2. THEN assign numerical ratings that are CONSISTENT with that ranking. The best player must have the highest rating, the worst must have the lowest.
3. For EACH player's rating, you MUST cite at least 3 SPECIFIC observations from the data above. Reference actual plays, counts, or patterns — not generic statements.
4. Rate conservatively. Most recreational players are 2.5-4.0. Casual friend groups are typically 2.5-3.5.
5. Consistency matters more than occasional highlights. Unforced errors are the #1 skill level indicator.

Return ONLY valid JSON matching the specified structure. No markdown, no code fences.`;

    step('Claude synthesizing all observations...');
    const claudeResponse = await claude.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 8000,
      system: ANALYSIS_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const analysisText = claudeResponse.content[0].type === 'text' ? claudeResponse.content[0].text : '';
    step(`Claude response (${analysisText.length} chars)`);

    // Parse JSON
    step('Parsing analysis JSON...');
    const cleaned = analysisText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const analysis = JSON.parse(cleaned);

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    step(`SUCCESS — draft analysis with ${analysis.player_analyses?.length ?? 0} player ratings in ${totalTime}s`);

    return res.status(200).json(analysis);
  } catch (error: any) {
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`[analyze-rate] FAILED after ${totalTime}s:`, error);
    return res.status(500).json({
      error: error.message || 'Rating analysis failed',
      failedAfterSeconds: parseFloat(totalTime),
    });
  }
}
