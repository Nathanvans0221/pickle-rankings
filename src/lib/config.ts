/**
 * Returns the API base URL.
 * - Web (Vercel): empty string (relative URLs like /api/analyze)
 * - Native (Capacitor): absolute URL to the Vercel deployment
 */
export function apiUrl(path: string): string {
  const isNative =
    typeof window !== 'undefined' &&
    (window as any).Capacitor?.isNativePlatform?.();

  if (isNative) {
    return `https://pickle-rankings.vercel.app${path}`;
  }
  return path;
}
