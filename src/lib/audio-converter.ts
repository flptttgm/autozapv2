/**
 * Get the best supported MIME type for recording
 */
export function getBestRecordingMimeType(): string {
  // Prefer OGG Opus (Firefox supports this natively, best for WhatsApp)
  if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
    return 'audio/ogg;codecs=opus';
  }
  // Fall back to WebM Opus (Chrome, Edge) - Z-API can handle this
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
    return 'audio/webm;codecs=opus';
  }
  if (MediaRecorder.isTypeSupported('audio/mp4')) {
    return 'audio/mp4';
  }
  return 'audio/webm';
}

/**
 * Check if the browser supports native OGG recording
 */
export function supportsNativeOgg(): boolean {
  return MediaRecorder.isTypeSupported('audio/ogg;codecs=opus');
}
