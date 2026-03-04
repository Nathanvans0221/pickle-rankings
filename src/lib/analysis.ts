import type { MatchAnalysis, MatchPlayer } from '../types';
import { getPlayer, getPlayers, savePlayers } from './storage';

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

/**
 * Convert a File to base64 string
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the data URL prefix to get raw base64
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function analyzeVideo(
  videoFile: File,
  players: MatchPlayer[],
  onProgress?: (msg: string) => void,
): Promise<MatchAnalysis> {
  onProgress?.('Preparing video for upload...');

  const playerContext = players.map(p => {
    const stored = getPlayer(p.player_id);
    return `- ${p.player_name} (ID: ${p.player_id}, Team ${p.team}, Current Rating: ${stored?.current_rating ?? 2.5})`;
  }).join('\n');

  onProgress?.('Uploading video to AI... (this may take a minute for large files)');

  const videoBase64 = await fileToBase64(videoFile);
  const mimeType = videoFile.type || 'video/mp4';

  onProgress?.('AI is watching and analyzing the full game...');

  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemPrompt: ANALYSIS_SYSTEM_PROMPT,
      videoBase64,
      mimeType,
      playerContext,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Analysis failed: ${err}`);
  }

  const result = await response.json();
  onProgress?.('Analysis complete!');
  return result as MatchAnalysis;
}

export function applyRatingUpdates(analysis: MatchAnalysis) {
  const players = getPlayers();

  for (const pa of analysis.player_analyses) {
    const idx = players.findIndex(p => p.id === pa.player_id);
    if (idx < 0) continue;

    const player = players[idx];
    const oldRating = player.current_rating;
    // Blend: 70% new analysis, 30% existing rating for smoothing
    const blendedRating = player.matches_played > 0
      ? Math.round((pa.rating_after * 0.7 + oldRating * 0.3) * 10) / 10
      : pa.rating_after;

    player.current_rating = Math.max(2.0, Math.min(5.5, blendedRating));
    player.matches_played += 1;
    player.rating_history.push({
      date: new Date().toISOString(),
      rating: player.current_rating,
      match_id: '',
    });
  }

  savePlayers(players);
}

export { ANALYSIS_SYSTEM_PROMPT };
