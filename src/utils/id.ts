export function makeId(prefix: string = "id"): string {
  // Достаточно для оффлайн-приложения: время + случайное
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}