export function timeToMinutes(hhmm: string): number | null {
  // "09:00" -> 540
  if (!/^\d{2}:\d{2}$/.test(hhmm)) return null;
  const [hhStr, mmStr] = hhmm.split(":");
  const hh = Number(hhStr);
  const mm = Number(mmStr);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

export function nowMinutes(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

export function formatHHMM(d: Date): string {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}