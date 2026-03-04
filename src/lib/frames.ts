/**
 * Extract frames from a video file at regular intervals.
 * Uses canvas + video element (no ffmpeg.wasm dependency — simpler & lighter).
 */
export async function extractFrames(
  file: File,
  maxFrames: number = 12,
  onProgress?: (pct: number, msg: string) => void,
): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return reject(new Error('Canvas not supported'));

    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';

    const url = URL.createObjectURL(file);
    video.src = url;

    video.onloadedmetadata = () => {
      const duration = video.duration;
      if (duration < 1) {
        URL.revokeObjectURL(url);
        return reject(new Error('Video too short'));
      }

      // Set canvas to 720p max for reasonable file size
      const scale = Math.min(1, 720 / video.videoHeight);
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);

      const interval = duration / (maxFrames + 1);
      const timestamps = Array.from({ length: maxFrames }, (_, i) => interval * (i + 1));
      const frames: string[] = [];
      let idx = 0;

      const captureNext = () => {
        if (idx >= timestamps.length) {
          URL.revokeObjectURL(url);
          video.remove();
          canvas.remove();
          resolve(frames);
          return;
        }

        const pct = Math.round((idx / timestamps.length) * 100);
        onProgress?.(pct, `Extracting frame ${idx + 1}/${timestamps.length}`);

        video.currentTime = timestamps[idx];
      };

      video.onseeked = () => {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        frames.push(dataUrl);
        idx++;
        captureNext();
      };

      video.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to process video'));
      };

      captureNext();
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load video'));
    };
  });
}
