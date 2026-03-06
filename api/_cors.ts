/**
 * Shared CORS helper for Capacitor native app support.
 * Capacitor makes requests from capacitor://localhost which needs CORS headers.
 */
export function setCorsHeaders(res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

/**
 * Handle CORS preflight (OPTIONS) requests.
 * Usage: if (handleCors(req, res)) return;
 */
export function handleCors(req: any, res: any): boolean {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }
  return false;
}
