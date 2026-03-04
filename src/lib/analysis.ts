import { upload } from '@vercel/blob/client';
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
 * Full video analysis pipeline:
 * 1. Upload video to Vercel Blob (handles large files, CORS, progress natively)
 * 2. Send blob URL to our analyze endpoint (which downloads → uploads to Gemini → runs AI)
 */
export async function analyzeVideo(
  videoFile: File,
  players: MatchPlayer[],
  onProgress?: (msg: string, pct?: number) => void,
): Promise<MatchAnalysis> {

  const playerContext = players.map(p => {
    const stored = getPlayer(p.player_id);
    return `- ${p.player_name} (ID: ${p.player_id}, Team ${p.team}, Current Rating: ${stored?.current_rating ?? 2.5})`;
  }).join('\n');

  const sizeMB = (videoFile.size / (1024 * 1024)).toFixed(0);

  // Step 1: Upload video to Vercel Blob with progress tracking
  onProgress?.(`Uploading video (${sizeMB}MB)...`, 5);

  let lastPct = 0;
  const uniqueName = `${Date.now()}-${videoFile.name}`;
  const blob = await upload(uniqueName, videoFile, {
    access: 'public',
    handleUploadUrl: '/api/upload-video',
    onUploadProgress: (e) => {
      const pct = Math.round(e.percentage);
      if (pct > lastPct) {
        lastPct = pct;
        const uploadedMB = Math.round((pct / 100) * videoFile.size / (1024 * 1024));
        onProgress?.(`Uploading video (${pct}% — ${uploadedMB}/${sizeMB}MB)...`, 5 + Math.round(pct * 0.45));
      }
    },
  });

  onProgress?.('Video uploaded. AI is analyzing the full game...', 55);

  // Step 2: Send blob URL to our analyze endpoint
  // Server downloads from blob → uploads to Gemini → runs Gemini + Claude analysis
  const analyzeRes = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemPrompt: ANALYSIS_SYSTEM_PROMPT,
      playerContext,
      blobUrl: blob.url,
      mimeType: videoFile.type || 'video/mp4',
    }),
  });

  if (!analyzeRes.ok) {
    const err = await analyzeRes.text();
    throw new Error(`Analysis failed: ${err}`);
  }

  const result = await analyzeRes.json();
  onProgress?.('Analysis complete!', 100);
  return result as MatchAnalysis;
}

export function applyRatingUpdates(analysis: MatchAnalysis, matchId?: string) {
  const players = getPlayers();

  for (const pa of analysis.player_analyses) {
    const idx = players.findIndex(p => p.id === pa.player_id);
    if (idx < 0) continue;

    const player = players[idx];
    const oldRating = player.current_rating;
    const blendedRating = player.matches_played > 0
      ? Math.round((pa.rating_after * 0.7 + oldRating * 0.3) * 10) / 10
      : pa.rating_after;

    player.current_rating = Math.max(2.0, Math.min(5.5, blendedRating));
    player.matches_played += 1;
    player.rating_history.push({
      date: new Date().toISOString(),
      rating: player.current_rating,
      match_id: matchId || '',
    });
  }

  savePlayers(players);
}

export function reverseRatingUpdates(analysis: MatchAnalysis, matchId: string) {
  const players = getPlayers();

  for (const pa of analysis.player_analyses) {
    const idx = players.findIndex(p => p.id === pa.player_id);
    if (idx < 0) continue;

    const player = players[idx];
    // Remove the rating history entry for this match
    player.rating_history = player.rating_history.filter(e => e.match_id !== matchId);
    player.matches_played = Math.max(0, player.matches_played - 1);
    // Restore rating from last history entry, or default
    if (player.rating_history.length > 0) {
      player.current_rating = player.rating_history[player.rating_history.length - 1].rating;
    } else {
      player.current_rating = 2.5;
    }
  }

  savePlayers(players);
}

export { ANALYSIS_SYSTEM_PROMPT };
