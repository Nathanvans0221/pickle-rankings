export interface Player {
  id: string;
  name: string;
  avatar_url: string | null;
  current_rating: number;
  rating_history: RatingEntry[];
  matches_played: number;
  wins: number;
  losses: number;
  created_at: string;
}

export interface RatingEntry {
  date: string;
  rating: number;
  match_id: string;
}

export interface Match {
  id: string;
  date: string;
  players: MatchPlayer[];
  team1_score: number | null;
  team2_score: number | null;
  analysis: MatchAnalysis | null;
  video_name: string;
  status: 'uploading' | 'extracting' | 'analyzing' | 'complete' | 'error';
  created_at: string;
}

export interface MatchPlayer {
  player_id: string;
  player_name: string;
  team: 1 | 2;
}

export interface MatchAnalysis {
  summary: string;
  duration_estimate: string;
  rally_count: number;
  highlights: string[];
  player_analyses: PlayerAnalysis[];
  gemini_observations?: string;
  analysis_mode?: string;
}

export interface PlayerAnalysis {
  player_id: string;
  player_name: string;
  rating_before: number;
  rating_after: number;
  rating_change: number;
  skill_assessment: SkillAssessment;
  shot_breakdown: ShotBreakdown;
  strengths: string[];
  improvements: string[];
}

export interface SkillAssessment {
  overall: number;
  serve: number;
  return_of_serve: number;
  third_shot: number;
  dinks: number;
  volleys: number;
  court_positioning: number;
  strategy: number;
  consistency: number;
}

export interface ShotBreakdown {
  serves: ShotStat;
  returns: ShotStat;
  third_shot_drops: ShotStat;
  third_shot_drives: ShotStat;
  dinks: ShotStat;
  volleys: ShotStat;
  speed_ups: ShotStat;
  resets: ShotStat;
  lobs: ShotStat;
  put_aways: ShotStat;
}

export interface ShotStat {
  count: number;
  quality: number; // 1-10
  notes: string;
}

export type SkillLevel = {
  min: number;
  max: number;
  label: string;
  description: string;
  color: string;
};

export const SKILL_LEVELS: SkillLevel[] = [
  { min: 2.0, max: 2.49, label: '2.0 - True Beginner', description: 'Minimal experience, inconsistent contact, learning basic rules', color: '#ef4444' },
  { min: 2.5, max: 2.99, label: '2.5 - Beginner', description: 'Basic swing mechanics, can sustain short rallies, developing fundamentals', color: '#f97316' },
  { min: 3.0, max: 3.49, label: '3.0 - Advanced Beginner', description: 'Variety of strokes, developing third-shot, reducing unforced errors', color: '#eab308' },
  { min: 3.5, max: 3.99, label: '3.5 - Intermediate', description: 'Moderate dink consistency, purposeful kitchen movement, basic stacking', color: '#84cc16' },
  { min: 4.0, max: 4.49, label: '4.0 - Advanced Intermediate', description: 'Deeper returns, transition zone resets, running patterns not just hitting', color: '#22c55e' },
  { min: 4.5, max: 4.99, label: '4.5 - Advanced', description: 'Pace management, tactical adaptation, disciplined speed-ups, minimal free points', color: '#06b6d4' },
  { min: 5.0, max: 5.49, label: '5.0 - Expert', description: 'Complete shot selection, forced advantages, low leakage, professional-level decisions', color: '#8b5cf6' },
  { min: 5.5, max: 6.0, label: '5.5+ - Pro', description: 'Dominance-level execution, tournament-caliber consistency', color: '#ec4899' },
];

export function getSkillLevel(rating: number): SkillLevel {
  return SKILL_LEVELS.find(l => rating >= l.min && rating <= l.max) ?? SKILL_LEVELS[0];
}
