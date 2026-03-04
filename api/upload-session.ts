export const config = { maxDuration: 10 };

/**
 * Step 1: Create a resumable upload session on Gemini's File API.
 * Returns the upload URL that the client can PUT the video bytes to directly.
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
  }

  const { fileName, fileSize, mimeType } = req.body;

  if (!fileSize || !mimeType) {
    return res.status(400).json({ error: 'Missing fileSize or mimeType' });
  }

  try {
    // Initiate resumable upload session
    const response = await fetch(
      `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${key}`,
      {
        method: 'POST',
        headers: {
          'X-Goog-Upload-Protocol': 'resumable',
          'X-Goog-Upload-Command': 'start',
          'X-Goog-Upload-Header-Content-Length': String(fileSize),
          'X-Goog-Upload-Header-Content-Type': mimeType,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          file: { display_name: fileName || 'pickleball_game.mp4' },
        }),
      },
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Failed to create upload session: ${response.status} ${errText}`);
    }

    // The upload URL is in the response header
    const uploadUrl = response.headers.get('x-goog-upload-url');
    if (!uploadUrl) {
      throw new Error('No upload URL returned from Gemini');
    }

    return res.status(200).json({ uploadUrl });
  } catch (error: any) {
    console.error('Upload session error:', error);
    return res.status(500).json({ error: error.message });
  }
}
