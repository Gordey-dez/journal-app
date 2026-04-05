// JS: getDay() -> 0=Вс, 1=Пн ... 6=Сб
export const WEEKDAY_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: "Пн" },
  { value: 2, label: "Вт" },
  { value: 3, label: "Ср" },
  { value: 4, label: "Чт" },
  { value: 5, label: "Пт" },
  { value: 6, label: "Сб" },
  { value: 0, label: "Вс" },
];

export function weekdayFromISO(isoDate: string): number {
  // isoDate: "YYYY-MM-DD"
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1); // локальная дата без UTC-сдвигов
  return dt.getDay();
}

export function weekdayLabel(value: number): string {
  return WEEKDAY_OPTIONS.find((x) => x.value === value)?.label ?? "?";
}