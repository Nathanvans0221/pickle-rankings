import type { MatchAnalysis, MatchPlayer } from '../types';
import { getPlayer, getPlayers, savePlayers } from './storage';

const ANALYSIS_SYSTEM_PROMPT = `You are an expert pickleball analyst and coach. You are analyzing frames extracted from a pickleball game video.

Your job is to evaluate each player's skill level using the official USA Pickleball skill rating scale (2.0 - 5.5+).

## Rating Scale Reference

- **2.0 (True Beginner)**: Minimal experience, inconsistent contact, learning basic rules
- **2.5 (Beginner)**: Basic swing mechanics developing, can sustain short rallies, learning all rules
- **3.0 (Advanced Beginner)**: Hit variety of strokes, developing dinks and third-shot intentions, reducing unforced errors
- **3.5 (Intermediate)**: Dink with moderate consistency, third-shot drops/drives with a plan, purposeful NVZ movement, understand basic stacking
- **4.0 (Advanced Intermediate)**: Deeper and more intentional returns, transition zone resets, run patterns not just hit shots, identify attackable balls accurately
- **4.5 (Advanced)**: Absorb pace with blocks and resets that land low, initiate speed-ups at right time to correct targets, disciplined dinks, pace management and tactical adaptation
- **5.0 (Expert)**: Third-shot drop/drive/hybrid all available with correct selection, reset under stress, dink patterns set up offense, points end from forced advantage not errors
- **5.5+ (Pro)**: Dominance-level execution, tournament-caliber consistency

## Shot Types to Evaluate
- **Serve**: Depth, placement, consistency, spin
- **Return of Serve**: Depth, positioning after return
- **Third Shot Drop**: Softness, arc, landing in kitchen
- **Third Shot Drive**: Power, accuracy, purpose
- **Dinks**: Cross-court consistency, height over net, patience
- **Volleys**: Punch volleys, reaction time, placement
- **Speed-ups/Put-aways**: Timing, target selection, effectiveness
- **Blocks/Resets**: Ability to neutralize, soft hands, landing in NVZ
- **Lobs**: Tactical use, depth, recovery
- **Erné**: Anticipation, execution (advanced)

## Assessment Categories
1. **Shot Quality**: Form, paddle angle, contact point
2. **Court Positioning**: Kitchen line discipline, transition zone management, spacing
3. **Strategy**: Shot selection, pattern play, adapting to opponent
4. **Consistency**: Unforced errors vs winners ratio, reliability under pressure
5. **Soft Game**: Dink quality, reset ability, patience
6. **Power Game**: Drive quality, speed-up timing, put-away success

## Important Notes
- Rate conservatively. Most recreational players are 2.5-4.0.
- A group of friends playing casually is typically 2.5-3.5.
- Look for specific shot quality indicators, not just rally length.
- Consider positioning: are they at the kitchen line? Do they transition properly?
- Unforced errors are the #1 indicator of skill level.

Respond with a JSON object matching this structure exactly:
{
  "summary": "Brief 2-3 sentence overview of the match",
  "duration_estimate": "Estimated match duration",
  "rally_count": <estimated number of rallies>,
  "highlights": ["Notable moment 1", "Notable moment 2"],
  "player_analyses": [
    {
      "player_id": "player_id_here",
      "player_name": "Player Name",
      "rating_before": <current_rating>,
      "rating_after": <new_rating>,
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
        "serves": { "count": 0, "quality": 5, "notes": "" },
        "returns": { "count": 0, "quality": 5, "notes": "" },
        "third_shot_drops": { "count": 0, "quality": 5, "notes": "" },
        "third_shot_drives": { "count": 0, "quality": 5, "notes": "" },
        "dinks": { "count": 0, "quality": 5, "notes": "" },
        "volleys": { "count": 0, "quality": 5, "notes": "" },
        "speed_ups": { "count": 0, "quality": 5, "notes": "" },
        "resets": { "count": 0, "quality": 5, "notes": "" },
        "lobs": { "count": 0, "quality": 5, "notes": "" },
        "put_aways": { "count": 0, "quality": 5, "notes": "" }
      },
      "strengths": ["Strength 1", "Strength 2"],
      "improvements": ["Area to improve 1", "Area to improve 2"]
    }
  ]
}`;

export async function analyzeFrames(
  frames: string[],
  players: MatchPlayer[],
  apiKey: string,
  onProgress?: (msg: string) => void,
): Promise<MatchAnalysis> {
  onProgress?.('Sending frames to AI for analysis...');

  const playerContext = players.map(p => {
    const stored = getPlayer(p.player_id);
    return `- ${p.player_name} (ID: ${p.player_id}, Team ${p.team}, Current Rating: ${stored?.current_rating ?? 2.5})`;
  }).join('\n');

  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiKey,
      systemPrompt: ANALYSIS_SYSTEM_PROMPT,
      images: frames.map(f => f.replace(/^data:image\/\w+;base64,/, '')),
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
