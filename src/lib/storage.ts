import type { Player, Match, RatingCorrection, PlayerCorrectionSummary } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { supabase, isSupabaseConfigured } from './supabase';

const PLAYERS_KEY = 'pickle_rankings_players';
const MATCHES_KEY = 'pickle_rankings_matches';
const CLAIMED_PLAYER_KEY = 'pickle_rankings_claimed_player';
const CORRECTIONS_KEY = 'pickle_rankings_corrections';

// --- Cloud Sync (Supabase) ---

function pushToCloud(key: string, data: any) {
  if (!isSupabaseConfigured()) return;
  supabase
    .from('synced_data')
    .upsert(
      { id: `pickle_${key}`, source: 'pickle-rankings', data, synced_at: new Date().toISOString() },
      { onConflict: 'id' },
    )
    .then(({ error }) => {
      if (error) console.warn(`[sync] push ${key} failed:`, error.message);
    });
}

export async function syncFromCloud(): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const { data: rows, error } = await supabase
      .from('synced_data')
      .select('id, data')
      .eq('source', 'pickle-rankings');

    if (error) {
      console.warn('[sync] pull failed:', error.message);
      return false;
    }
    if (!rows || rows.length === 0) return false;

    for (const row of rows) {
      const key = row.id.replace('pickle_', '');
      const lsKey = key === 'claimed_player' ? CLAIMED_PLAYER_KEY :
                    key === 'players' ? PLAYERS_KEY :
                    key === 'matches' ? MATCHES_KEY :
                    key === 'corrections' ? CORRECTIONS_KEY : null;
      if (!lsKey) continue;

      if (key === 'claimed_player') {
        if (row.data) localStorage.setItem(lsKey, String(row.data));
      } else {
        localStorage.setItem(lsKey, JSON.stringify(row.data));
      }
    }
    return true;
  } catch (err) {
    console.warn('[sync] pull error:', err);
    return false;
  }
}

/** Push all current localStorage data to cloud (initial seed) */
export function pushAllToCloud() {
  pushToCloud('players', getPlayers());
  pushToCloud('matches', getMatches());
  pushToCloud('corrections', getCorrections());
  const claimed = getClaimedPlayerId();
  if (claimed) pushToCloud('claimed_player', claimed);
}

// --- Claimed Player ---

export function getClaimedPlayerId(): string | null {
  return localStorage.getItem(CLAIMED_PLAYER_KEY);
}

export function setClaimedPlayerId(id: string | null) {
  if (id) {
    localStorage.setItem(CLAIMED_PLAYER_KEY, id);
    pushToCloud('claimed_player', id);
  } else {
    localStorage.removeItem(CLAIMED_PLAYER_KEY);
    pushToCloud('claimed_player', null);
  }
}

// --- Players ---

export function getPlayers(): Player[] {
  const data = localStorage.getItem(PLAYERS_KEY);
  return data ? JSON.parse(data) : [];
}

export function savePlayers(players: Player[]) {
  localStorage.setItem(PLAYERS_KEY, JSON.stringify(players));
  pushToCloud('players', players);
}

export function getPlayer(id: string): Player | undefined {
  return getPlayers().find(p => p.id === id);
}

export function addPlayer(name: string): Player {
  const players = getPlayers();
  const player: Player = {
    id: uuidv4(),
    name,
    avatar_url: null,
    current_rating: 2.5,
    rating_history: [],
    matches_played: 0,
    wins: 0,
    losses: 0,
    created_at: new Date().toISOString(),
  };
  players.push(player);
  savePlayers(players);
  return player;
}

export function updatePlayer(id: string, updates: Partial<Player>) {
  const players = getPlayers();
  const idx = players.findIndex(p => p.id === id);
  if (idx >= 0) {
    players[idx] = { ...players[idx], ...updates };
    savePlayers(players);
    return players[idx];
  }
  return null;
}

export function deletePlayer(id: string) {
  const players = getPlayers().filter(p => p.id !== id);
  savePlayers(players);
}

// --- Matches ---

export function getMatches(): Match[] {
  const data = localStorage.getItem(MATCHES_KEY);
  return data ? JSON.parse(data) : [];
}

export function saveMatches(matches: Match[]) {
  localStorage.setItem(MATCHES_KEY, JSON.stringify(matches));
  pushToCloud('matches', matches);
}

export function addMatch(match: Match) {
  const matches = getMatches();
  matches.unshift(match);
  saveMatches(matches);
}

export function updateMatch(id: string, updates: Partial<Match>) {
  const matches = getMatches();
  const idx = matches.findIndex(m => m.id === id);
  if (idx >= 0) {
    matches[idx] = { ...matches[idx], ...updates };
    saveMatches(matches);
    return matches[idx];
  }
  return null;
}

export function getMatch(id: string): Match | undefined {
  return getMatches().find(m => m.id === id);
}

export function deleteMatch(id: string) {
  const matches = getMatches().filter(m => m.id !== id);
  saveMatches(matches);
}

// --- Corrections ---

export function getCorrections(): RatingCorrection[] {
  const data = localStorage.getItem(CORRECTIONS_KEY);
  return data ? JSON.parse(data) : [];
}

export function saveCorrections(corrections: RatingCorrection[]) {
  localStorage.setItem(CORRECTIONS_KEY, JSON.stringify(corrections));
  pushToCloud('corrections', corrections);
}

export function addCorrection(correction: RatingCorrection) {
  const corrections = getCorrections();
  const existingIdx = corrections.findIndex(
    c => c.match_id === correction.match_id && c.player_id === correction.player_id
  );
  if (existingIdx >= 0) {
    corrections[existingIdx] = correction;
  } else {
    corrections.push(correction);
  }
  saveCorrections(corrections);
}

export function getPlayerCorrections(playerId: string): RatingCorrection[] {
  return getCorrections().filter(c => c.player_id === playerId);
}

export function getMatchCorrections(matchId: string): RatingCorrection[] {
  return getCorrections().filter(c => c.match_id === matchId);
}

export function getPlayerCorrectionSummary(playerId: string): PlayerCorrectionSummary | null {
  const corrections = getPlayerCorrections(playerId);
  if (corrections.length === 0) return null;

  const avgAi = corrections.reduce((sum, c) => sum + c.ai_rating, 0) / corrections.length;
  const avgCorrected = corrections.reduce((sum, c) => sum + c.corrected_rating, 0) / corrections.length;
  const avgAdj = avgCorrected - avgAi;

  return {
    correction_count: corrections.length,
    avg_ai_rating: Math.round(avgAi * 10) / 10,
    avg_corrected_rating: Math.round(avgCorrected * 10) / 10,
    avg_adjustment: Math.round(avgAdj * 10) / 10,
    direction: avgAdj > 0.05 ? 'up' : avgAdj < -0.05 ? 'down' : 'neutral',
  };
}
