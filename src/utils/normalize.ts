export function normalizeSubject(input: string): string {
  return input
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}