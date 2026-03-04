import type { Player, Match } from '../types';
import { v4 as uuidv4 } from 'uuid';

const PLAYERS_KEY = 'pickle_rankings_players';
const MATCHES_KEY = 'pickle_rankings_matches';

export function getPlayers(): Player[] {
  const data = localStorage.getItem(PLAYERS_KEY);
  return data ? JSON.parse(data) : [];
}

export function savePlayers(players: Player[]) {
  localStorage.setItem(PLAYERS_KEY, JSON.stringify(players));
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

export function getMatches(): Match[] {
  const data = localStorage.getItem(MATCHES_KEY);
  return data ? JSON.parse(data) : [];
}

export function saveMatches(matches: Match[]) {
  localStorage.setItem(MATCHES_KEY, JSON.stringify(matches));
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
