export async function geminiWithRetry<T>(
  fn: () => Promise<T>,
  step: (msg: string) => void,
  maxRetries = 2,
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const status = err?.status ?? err?.httpStatusCode ?? err?.code;
      const msg = err?.message ?? '';
      const isRetryable = status === 503 || status === 429 || msg.includes('UNAVAILABLE') || msg.includes('high demand') || msg.includes('overloaded');

      if (isRetryable && attempt < maxRetries) {
        const wait = (attempt + 1) * 15;
        step(`Gemini returned ${status || 'transient error'}, retrying in ${wait}s (attempt ${attempt + 1}/${maxRetries})...`);
        await new Promise(r => setTimeout(r, wait * 1000));
      } else {
        throw err;
      }
    }
  }
  throw new Error('Unreachable');
}
