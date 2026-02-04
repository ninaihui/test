export function normalizeEditorUserIds(input: string[]): string[] {
  const arr = Array.isArray(input) ? input : [];
  const cleaned = arr
    .map((s) => String(s || '').trim())
    .filter(Boolean);
  // unique
  return Array.from(new Set(cleaned));
}
