function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function toISODateLocal(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  return `${yyyy}-${mm}-${dd}`;
}

export function todayISO(): string {
  return toISODateLocal(new Date());
}

export function formatRuDate(iso: string): string {
  // iso: YYYY-MM-DD -> DD.MM.YYYY
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}.${m}.${y}`;
}

export function isoToDate(iso: string): Date {
  // YYYY-MM-DD -> Date (локально)
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}