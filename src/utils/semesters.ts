/**
 * Логика семестров: определение периода по дате, миграция, дефолты.
 * Осень: сентябрь–декабрь, Весна: январь–июнь (учебный год).
 */

export type Semester = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isArchived: boolean;
  sortOrder: number;
};

/** Дату попадает ли в диапазон семестра (включительно) */
export function dateInSemester(dateISO: string, s: Semester): boolean {
  return dateISO >= s.startDate && dateISO <= s.endDate;
}

/** Найти семестр, которому принадлежит дата (первый подходящий) */
export function findSemesterForDate(
  dateISO: string,
  semesters: Semester[]
): Semester | null {
  const sorted = [...semesters].sort((a, b) => a.sortOrder - b.sortOrder);
  return sorted.find((s) => dateInSemester(dateISO, s)) ?? null;
}

/** Текущая дата в формате YYYY-MM-DD */
function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * "Текущий" семестр: неархивный, содержащий сегодня,
 * или ближайший будущий, или последний прошедший.
 */
export function getCurrentSemester(semesters: Semester[]): Semester | null {
  const today = todayISO();
  const notArchived = semesters.filter((s) => !s.isArchived);
  if (notArchived.length === 0) return null;

  const sorted = [...notArchived].sort((a, b) => a.sortOrder - b.sortOrder);

  const containing = sorted.find((s) => dateInSemester(today, s));
  if (containing) return containing;

  const future = sorted.filter((s) => s.startDate > today);
  if (future.length > 0) return future[0];

  const past = sorted.filter((s) => s.endDate < today);
  return past[past.length - 1] ?? sorted[0];
}

/** Сгенерировать семестры для покрытия дат (миграция) */
export function buildSemestersForDateRange(
  minDate: string,
  maxDate: string,
  makeId: () => string
): Semester[] {
  const [minY] = minDate.split("-").map(Number);
  const [maxY] = maxDate.split("-").map(Number);

  const result: Semester[] = [];
  let sortOrder = 0;

  for (let year = minY; year <= maxY; year++) {
    const springStart = `${year}-01-01`;
    const springEnd = `${year}-06-30`;
    if (springStart <= maxDate && springEnd >= minDate) {
      result.push({
        id: makeId(),
        name: `Весна ${year - 1}-${String(year).slice(-2)}`,
        startDate: springStart,
        endDate: springEnd,
        isArchived: springEnd < todayISO(),
        sortOrder: sortOrder++,
      });
    }

    const autumnStart = `${year}-09-01`;
    const autumnEnd = `${year}-12-31`;
    if (autumnStart <= maxDate && autumnEnd >= minDate) {
      result.push({
        id: makeId(),
        name: `Осень ${year}-${String(year + 1).slice(-2)}`,
        startDate: autumnStart,
        endDate: autumnEnd,
        isArchived: autumnEnd < todayISO(),
        sortOrder: sortOrder++,
      });
    }
  }

  result.sort((a, b) => a.startDate.localeCompare(b.startDate));
  result.forEach((s, i) => {
    s.sortOrder = i;
  });
  return result;
}
