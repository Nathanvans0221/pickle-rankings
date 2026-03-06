import { GoogleGenAI, createUserContent, createPartFromUri } from '@google/genai';
import Anthropic from '@anthropic-ai/sdk';

export const config = { maxDuration: 300 };

/**
 * Full pipeline diagnostic — tests every step of the analysis flow.
 * GET /api/test-pipeline  → basic API checks
 * POST /api/test-pipeline { blobUrl } → full pipeline test with a real video
 */
export default async function handler(req: any, res: any) {
  const startTime = Date.now();
  const elapsed = () => ((Date.now() - startTime) / 1000).toFixed(1) + 's';

  // GET = quick API health check
  if (req.method === 'GET') {
    const results: Record<string, any> = { timestamp: new Date().toISOString(), steps: {} };

    results.steps.env_vars = {
      GEMINI_API_KEY: !!process.env.GEMINI_API_KEY,
      ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
      BLOB_READ_WRITE_TOKEN: !!process.env.BLOB_READ_WRITE_TOKEN,
    };

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const r = await ai.models.generateContent({ model: 'gemini-2.5-pro', contents: 'Say "ok"' });
      results.steps.gemini = { ok: true, response: r.text?.substring(0, 50) };
    } catch (e: any) {
      results.steps.gemini = { ok: false, error: e.message };
    }

    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        const r = await claude.messages.create({
          model: 'claude-sonnet-4-5-20250929', max_tokens: 10,
          messages: [{ role: 'user', content: 'Say "ok"' }],
        });
        const text = r.content[0].type === 'text' ? r.content[0].text : '';
        results.steps.claude = { ok: true, response: text.substring(0, 50) };
      } catch (e: any) {
        results.steps.claude = { ok: false, error: e.message };
      }
    }

    results.steps.config = {
      maxDuration: config.maxDuration,
      node: process.version,
      memoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
    };

    results.overall = (results.steps.gemini?.ok && results.steps.claude?.ok) ? 'ALL OK' : 'ISSUES';
    return res.status(200).json(results);
  }

  // POST = full pipeline test with a blob URL
  if (req.method === 'POST') {
    const { blobUrl } = req.body;
    if (!blobUrl) return res.status(400).json({ error: 'POST { blobUrl } to test full pipeline' });

    const log: string[] = [];
    const step = (msg: string) => {
      const entry = `[${elapsed()}] ${msg}`;
      log.push(entry);
      console.log(`[test-pipeline] ${entry}`);
    };

    try {
      step('Starting full pipeline test');
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

      // Download from blob
      step('Downloading from blob...');
      const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
      let videoRes = await fetch(blobUrl, blobToken ? { headers: { Authorization: `Bearer ${blobToken}` } } : {});
      if (!videoRes.ok && blobToken) videoRes = await fetch(blobUrl);
      if (!videoRes.ok) throw new Error(`Blob download failed: HTTP ${videoRes.status}`);
      const buf = Buffer.from(await videoRes.arrayBuffer());
      step(`Downloaded ${(buf.length / 1024 / 1024).toFixed(1)}MB`);

      // Upload to Gemini
      step('Uploading to Gemini File API...');
      const uploaded = await ai.files.upload({
        file: new Blob([buf], { type: 'video/mp4' }),
        config: { mimeType: 'video/mp4' },
      });
      step(`Uploaded as ${uploaded.name}`);

      // Poll until ACTIVE
      step('Waiting for Gemini to process...');
      let file = await ai.files.get({ name: uploaded.name! });
      let attempts = 0;
      while (file.state === 'PROCESSING' && attempts < 60) {
        await new Promise(r => setTimeout(r, 3000));
        file = await ai.files.get({ name: uploaded.name! });
        attempts++;
      }
      step(`File state: ${file.state} (${attempts} polls)`);
      if (file.state !== 'ACTIVE') throw new Error(`File stuck in ${file.state}`);

      // Quick Gemini video test
      step('Running Gemini on video (short prompt)...');
      const gemResult = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: createUserContent([
          createPartFromUri(file.uri!, 'video/mp4'),
          'Describe what you see in this video in 2-3 sentences.',
        ]),
      });
      step(`Gemini response: ${gemResult.text?.substring(0, 200)}`);

      // Test Claude
      if (process.env.ANTHROPIC_API_KEY) {
        step('Testing Claude analysis...');
        const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        const claudeResult = await claude.messages.create({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 200,
          messages: [{ role: 'user', content: `Based on this description: "${gemResult.text?.substring(0, 500)}" — what sport is being played?` }],
        });
        const claudeText = claudeResult.content[0].type === 'text' ? claudeResult.content[0].text : '';
        step(`Claude response: ${claudeText.substring(0, 200)}`);
      }

      // Cleanup
      try { await ai.files.delete({ name: uploaded.name! }); } catch {}
      step('PIPELINE TEST COMPLETE');

      return res.status(200).json({ success: true, totalTime: elapsed(), log });
    } catch (err: any) {
      step(`FAILED: ${err.message}`);
      return res.status(500).json({ success: false, totalTime: elapsed(), log, error: err.message });
    }
  }

  return res.status(405).json({ error: 'GET or POST only' });
}
