/**
 * Analysis progress persistence — survives app backgrounding/crashes.
 * Saves checkpoint after each phase so analysis can resume.
 */

const ANALYSIS_STATE_KEY = 'pickle_rankings_analysis_state';

export interface AnalysisCheckpoint {
  matchId: string;
  geminiFileUri: string;
  mimeType: string;
  playerContext: string;
  completedPhases: number[];
  structureData?: any;
  segmentObservations?: any[];
  playerFocusReports?: string[];
  draftAnalysis?: any;
  startedAt: string;
  lastUpdated: string;
}

export function saveAnalysisCheckpoint(checkpoint: AnalysisCheckpoint) {
  checkpoint.lastUpdated = new Date().toISOString();
  localStorage.setItem(ANALYSIS_STATE_KEY, JSON.stringify(checkpoint));
}

export function getAnalysisCheckpoint(): AnalysisCheckpoint | null {
  try {
    const data = localStorage.getItem(ANALYSIS_STATE_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export function clearAnalysisCheckpoint() {
  localStorage.removeItem(ANALYSIS_STATE_KEY);
}

export function hasInterruptedAnalysis(): boolean {
  const cp = getAnalysisCheckpoint();
  if (!cp) return false;
  // Consider interrupted if started less than 24h ago and not all 5 phases done
  const age = Date.now() - new Date(cp.startedAt).getTime();
  return age < 24 * 60 * 60 * 1000 && cp.completedPhases.length < 5;
}

/**
 * Wake Lock management — keeps screen on during analysis
 */
let wakeLock: WakeLockSentinel | null = null;

export async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    }
  } catch {
    // Wake Lock not supported or denied — non-critical
  }
}

export function releaseWakeLock() {
  wakeLock?.release();
  wakeLock = null;
}
