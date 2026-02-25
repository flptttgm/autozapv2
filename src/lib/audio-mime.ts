export function normalizeAudioMimeType(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  return trimmed.split(";")[0] || null;
}
