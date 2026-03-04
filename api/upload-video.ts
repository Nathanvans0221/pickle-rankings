import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';

export const config = { maxDuration: 30 };

/**
 * Handles client-side Vercel Blob uploads.
 * The client uploads directly to Vercel Blob (no body size limit).
 * Returns a blob URL that can be passed to the analyze endpoint.
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body as HandleUploadBody;

    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/x-matroska', 'video/MP2T'],
        maximumSizeInBytes: 2 * 1024 * 1024 * 1024, // 2GB
      }),
      onUploadCompleted: async () => {
        // Could do post-processing here if needed
      },
    });

    return res.status(200).json(jsonResponse);
  } catch (error: any) {
    console.error('Upload error:', error);
    return res.status(500).json({ error: error.message });
  }
}
