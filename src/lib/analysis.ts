import { upload } from '@vercel/blob/client';
import type { MatchAnalysis, MatchPlayer } from '../types';
import { getPlayer, getPlayers, savePlayers, addCorrection, getPlayerCorrectionSummary, updatePlayer } from './storage';
import { v4 as uuidv4 } from 'uuid';
import { apiUrl } from './config';

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

async function callEndpoint(url: string, body: any, timeoutMs = 300000): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export interface IdentifiedPlayer {
  label: string;
  description: string;
  court_position: string;
}

/**
 * Upload video to blob and ask Gemini to identify players by appearance.
 */
export async function uploadAndIdentifyPlayers(
  videoFile: File,
  onProgress?: (msg: string, pct?: number) => void,
): Promise<{ players: IdentifiedPlayer[]; blobUrl: string; geminiFileUri: string }> {
  const sizeMB = (videoFile.size / (1024 * 1024)).toFixed(0);

  onProgress?.(`Uploading video (${sizeMB}MB)...`, 5);

  let lastPct = 0;
  const uniqueName = `${Date.now()}-${videoFile.name}`;
  const blob = await upload(uniqueName, videoFile, {
    access: 'public',
    handleUploadUrl: apiUrl('/api/upload-video'),
    onUploadProgress: (e) => {
      const pct = Math.round(e.percentage);
      if (pct > lastPct) {
        lastPct = pct;
        const uploadedMB = Math.round((pct / 100) * videoFile.size / (1024 * 1024));
        onProgress?.(`Uploading video (${pct}% — ${uploadedMB}/${sizeMB}MB)...`, 5 + Math.round(pct * 0.35));
      }
    },
  });

  onProgress?.('Video uploaded! AI is scanning for players...', 45);

  const res = await fetch(apiUrl('/api/identify-players'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ blobUrl: blob.url, mimeType: videoFile.type || 'video/mp4' }),
  });

  if (!res.ok) {
    let errDetail: string;
    try {
      const errJson = await res.json();
      errDetail = errJson.error || JSON.stringify(errJson);
    } catch {
      errDetail = await res.text();
    }
    throw new Error(`Player identification failed (HTTP ${res.status}): ${errDetail}`);
  }

  const data = await res.json();
  onProgress?.(`Found ${data.players.length} players!`, 80);
  return { players: data.players, blobUrl: blob.url, geminiFileUri: data.geminiFileUri };
}

/**
 * Multi-pass video analysis pipeline (5 phases).
 * Requires geminiFileUri from the identify-players step.
 */
export async function analyzeVideoMultiPass(
  players: MatchPlayer[],
  geminiFileUri: string,
  mimeType: string,
  onProgress?: (msg: string, pct?: number) => void,
): Promise<MatchAnalysis> {
  const playerContext = players.map(p => {
    const stored = getPlayer(p.player_id);
    const desc = p.appearance ? `, Appearance: ${p.appearance}` : '';
    let line = `- ${p.player_name} (ID: ${p.player_id}, Team ${p.team}, Current Rating: ${stored?.current_rating ?? 2.5}${desc})`;
    const summary = getPlayerCorrectionSummary(p.player_id);
    if (summary) {
      line += ` | Correction History: In ${summary.correction_count} prior analyses, user corrected by avg ${summary.avg_adjustment > 0 ? '+' : ''}${summary.avg_adjustment}. AI avg: ${summary.avg_ai_rating}, corrected avg: ${summary.avg_corrected_rating}. Bias: ${summary.direction === 'up' ? 'UPWARD' : summary.direction === 'down' ? 'DOWNWARD' : 'NEUTRAL'}. Weight accordingly.`;
    }
    return line;
  }).join('\n');

  // Phase 1: Structure Scan
  onProgress?.('Phase 1/5: Scanning video structure...', 5);
  const structure = await callEndpoint(apiUrl('/api/analyze-structure'), {
    geminiFileUri, mimeType, playerContext,
  });
  onProgress?.(`Phase 1/5: Found ${structure.segments.length} game segments`, 15);

  // Phase 2: Segment Deep Analysis
  const segmentObservations: any[] = [];
  for (let i = 0; i < structure.segments.length; i++) {
    const seg = structure.segments[i];
    const startMin = Math.floor(seg.start / 60);
    const startSec = seg.start % 60;
    const endMin = Math.floor(seg.end / 60);
    const endSec = seg.end % 60;
    onProgress?.(
      `Phase 2/5: Analyzing segment ${i + 1} of ${structure.segments.length} (Game ${seg.game_number}, ${startMin}:${String(startSec).padStart(2, '0')}-${endMin}:${String(endSec).padStart(2, '0')})...`,
      15 + Math.round((i / structure.segments.length) * 30),
    );
    try {
      const segResult = await callEndpoint(apiUrl('/api/analyze-segments'), {
        geminiFileUri, mimeType,
        segments: [seg],
        playerContext,
      });
      segmentObservations.push(...segResult.segmentObservations);
    } catch (err: any) {
      console.warn(`Segment ${i + 1} failed, skipping:`, err.message);
    }
  }
  onProgress?.(`Phase 2/5: Analyzed ${segmentObservations.length} segments`, 45);

  // Phase 3: Player-Focused Passes (one per team)
  const playerFocusReports: string[] = [];
  const team1Players = players.filter(p => p.team === 1);
  const team2Players = players.filter(p => p.team === 2);
  const teams = [team1Players, team2Players].filter(t => t.length > 0);

  for (let i = 0; i < teams.length; i++) {
    const teamPlayers = teams[i];
    const teamNum = teamPlayers[0]?.team || (i + 1);
    onProgress?.(
      `Phase 3/5: Deep analysis of Team ${teamNum} (${teamPlayers.map(p => p.player_name).join(' & ')})...`,
      45 + Math.round((i / teams.length) * 15),
    );
    try {
      const focusResult = await callEndpoint(apiUrl('/api/analyze-player-focus'), {
        geminiFileUri, mimeType, playerContext,
        teamPlayers: teamPlayers.map(p => ({
          player_id: p.player_id,
          player_name: p.player_name,
          appearance: p.appearance || '',
        })),
      });
      playerFocusReports.push(focusResult.focusReport);
    } catch (err: any) {
      console.warn(`Team ${teamNum} focus failed:`, err.message);
    }
  }
  onProgress?.('Phase 3/5: Player analysis complete', 60);

  // Phase 4: Comparative Rating (Claude)
  onProgress?.('Phase 4/5: Claude is synthesizing all data and rating players...', 65);
  const allSegmentText = segmentObservations.map(s =>
    `[${s.segment_start}s - ${s.segment_end}s]\n${s.rally_log}`,
  ).join('\n\n---\n\n');

  const draftAnalysis = await callEndpoint(apiUrl('/api/analyze-rate'), {
    playerContext,
    segmentObservations: allSegmentText,
    playerFocusReports,
    structureSummary: JSON.stringify(structure),
    players: players.map(p => ({ player_id: p.player_id, player_name: p.player_name, team: p.team })),
  });
  onProgress?.('Phase 4/5: Draft ratings complete', 80);

  // Phase 5: Calibration Challenge (Claude)
  onProgress?.('Phase 5/5: Calibrating and validating ratings...', 85);
  let finalAnalysis: MatchAnalysis;
  try {
    finalAnalysis = await callEndpoint(apiUrl('/api/analyze-calibrate'), {
      draftAnalysis,
      segmentObservations: allSegmentText,
      playerFocusReports,
    });
  } catch (err: any) {
    console.warn('Calibration failed, using draft:', err.message);
    finalAnalysis = draftAnalysis;
  }

  // Attach extra data for transparency
  finalAnalysis.segment_observations = allSegmentText;
  finalAnalysis.player_focus_reports = playerFocusReports;
  finalAnalysis.structure_summary = structure;
  finalAnalysis.analysis_mode = 'multi-pass (5-phase pipeline)';

  onProgress?.('Analysis complete!', 100);
  return finalAnalysis;
}

/**
 * Full video analysis pipeline (single-pass fallback):
 * 1. Upload video to Vercel Blob (or reuse existing blobUrl)
 * 2. Send blob URL to our analyze endpoint (which downloads → uploads to Gemini → runs AI)
 */
export async function analyzeVideo(
  videoFile: File,
  players: MatchPlayer[],
  onProgress?: (msg: string, pct?: number) => void,
  existingBlobUrl?: string,
): Promise<MatchAnalysis> {

  const playerContext = players.map(p => {
    const stored = getPlayer(p.player_id);
    const desc = p.appearance ? `, Appearance: ${p.appearance}` : '';
    let line = `- ${p.player_name} (ID: ${p.player_id}, Team ${p.team}, Current Rating: ${stored?.current_rating ?? 2.5}${desc})`;
    const summary = getPlayerCorrectionSummary(p.player_id);
    if (summary) {
      line += ` | Correction History: In ${summary.correction_count} prior analyses, user corrected by avg ${summary.avg_adjustment > 0 ? '+' : ''}${summary.avg_adjustment}. AI avg: ${summary.avg_ai_rating}, corrected avg: ${summary.avg_corrected_rating}. Bias: ${summary.direction === 'up' ? 'UPWARD' : summary.direction === 'down' ? 'DOWNWARD' : 'NEUTRAL'}. Weight accordingly.`;
    }
    return line;
  }).join('\n');

  let blobUrl: string;

  if (existingBlobUrl) {
    blobUrl = existingBlobUrl;
    onProgress?.('Sending video to AI for analysis...', 55);
  } else {
    const sizeMB = (videoFile.size / (1024 * 1024)).toFixed(0);

    onProgress?.(`Uploading video (${sizeMB}MB)...`, 5);

    let lastPct = 0;
    const uniqueName = `${Date.now()}-${videoFile.name}`;
    const blob = await upload(uniqueName, videoFile, {
      access: 'public',
      handleUploadUrl: apiUrl('/api/upload-video'),
      onUploadProgress: (e) => {
        const pct = Math.round(e.percentage);
        if (pct > lastPct) {
          lastPct = pct;
          const uploadedMB = Math.round((pct / 100) * videoFile.size / (1024 * 1024));
          onProgress?.(`Uploading video (${pct}% — ${uploadedMB}/${sizeMB}MB)...`, 5 + Math.round(pct * 0.45));
        }
      },
    });
    blobUrl = blob.url;
    onProgress?.('Video uploaded! Sending to AI for analysis...', 55);
  }

  onProgress?.('AI is downloading and processing the video (this takes 2-5 min)...', 60);

  let analyzeRes: Response;
  try {
    analyzeRes = await fetch(apiUrl('/api/analyze'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemPrompt: ANALYSIS_SYSTEM_PROMPT,
        playerContext,
        blobUrl,
        mimeType: videoFile.type || 'video/mp4',
      }),
    });
  } catch (fetchError: any) {
    // Network-level failure (timeout, connection reset, etc.)
    throw new Error(
      `Server connection lost during analysis. This usually means the analysis timed out. ` +
      `Try a shorter video clip (under 5 minutes). Error: ${fetchError.message}`
    );
  }

  if (!analyzeRes.ok) {
    let errDetail: string;
    try {
      const errJson = await analyzeRes.json();
      errDetail = errJson.error || JSON.stringify(errJson);
      if (errJson.failedAfterSeconds) {
        errDetail += ` (failed after ${errJson.failedAfterSeconds}s)`;
      }
    } catch {
      errDetail = await analyzeRes.text();
    }
    throw new Error(`Analysis failed (HTTP ${analyzeRes.status}): ${errDetail}`);
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

export function applyRatingCorrection(
  matchId: string,
  playerId: string,
  playerName: string,
  aiRating: number,
  correctedRating: number,
  note?: string,
) {
  const clamped = Math.max(2.0, Math.min(5.5, correctedRating));

  addCorrection({
    id: uuidv4(),
    match_id: matchId,
    player_id: playerId,
    player_name: playerName,
    ai_rating: aiRating,
    corrected_rating: clamped,
    note,
    created_at: new Date().toISOString(),
  });

  // Update player's current rating
  updatePlayer(playerId, { current_rating: clamped });

  // Patch the matching rating_history entry for this match
  const player = getPlayer(playerId);
  if (player) {
    const history = [...player.rating_history];
    const histIdx = history.findIndex(e => e.match_id === matchId);
    if (histIdx >= 0) {
      history[histIdx] = { ...history[histIdx], rating: clamped };
      updatePlayer(playerId, { rating_history: history });
    }
  }
}

export { ANALYSIS_SYSTEM_PROMPT };
