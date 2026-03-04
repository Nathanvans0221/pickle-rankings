import Anthropic from '@anthropic-ai/sdk';

export const config = { maxDuration: 120 };

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { apiKey, systemPrompt, images, playerContext } = req.body;
  const key = apiKey || process.env.ANTHROPIC_API_KEY;

  if (!key) {
    return res.status(400).json({ error: 'No API key configured. Set ANTHROPIC_API_KEY env var on Vercel.' });
  }
  if (!images?.length) {
    return res.status(400).json({ error: 'No images provided' });
  }

  try {
    const client = new Anthropic({ apiKey: key });

    const imageBlocks = images.map((base64: string) => ({
      type: 'image' as const,
      source: {
        type: 'base64' as const,
        media_type: 'image/jpeg' as const,
        data: base64,
      },
    }));

    const response = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 8000,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: [
            ...imageBlocks,
            {
              type: 'text',
              text: `These are ${images.length} frames extracted at regular intervals from a pickleball game video.

Players in this match:
${playerContext}

Analyze the gameplay visible in these frames. Assess each player's skill level, shot quality, positioning, and strategy. Provide ratings on the USA Pickleball 2.0-5.5+ scale.

Return ONLY valid JSON matching the specified structure. No markdown, no code fences.`,
            },
          ],
        },
      ],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';

    // Parse JSON from response (strip any accidental markdown fences)
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const analysis = JSON.parse(cleaned);

    return res.status(200).json(analysis);
  } catch (error: any) {
    console.error('Analysis error:', error);
    return res.status(500).json({
      error: error.message || 'Analysis failed',
    });
  }
}
