import { STORAGE_KEYS } from "@/src/storage/keys";
import { loadJSON, saveJSON } from "@/src/storage/storage";
import { maybeAutoBackup } from "@/src/utils/autoBackup";
import { makeId } from "@/src/utils/id";
import { normalizeSubject } from "@/src/utils/normalize";
import {
  buildSemestersForDateRange,
  dateInSemester,
  getCurrentSemester,
  Semester,
} from "@/src/utils/semesters";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type { Semester };

export type Student = {
  id: string;
  name: string;
};

export type AttendanceStatus = "present" | "absent";

export type ClassRecord = {
  id: string;
  subject: string;
  subjectNormalized: string;
  date: string; // "YYYY-MM-DD"
  pairNumber: number;

  studentsSnapshot: Student[];
  attendance: Record<string, AttendanceStatus>;

  createdAt: string; // ISO
};

export type PairSetting = {
  id: string;
  start: string; // "09:00"
  end: string;   // "10:30"
};

type SaveClassInput = {
  subject: string;
  date: string;
  pairNumber: number;
  attendance: Record<string, AttendanceStatus>;
};

type SaveClassResult =
  | { ok: true; id: string; replaced: boolean }
  | { ok: false; reason: "duplicate"; existingId: string };

export type UpdateClassMetaInput = {
  subject?: string;
  date?: string;
  pairNumber?: number;
};

export type UpdateClassMetaResult =
  | { ok: true }
  | { ok: false; reason: "duplicate"; existingId: string }
  | { ok: false; reason: "not_found" };

type AppDataContextValue = {
  isReady: boolean;

  students: Student[];
  classes: ClassRecord[];
  pairSettings: PairSetting[];
  semesters: Semester[];

  /** "current" | "all" | semesterId — какой семестр показывать по умолчанию */
  activeSemesterId: "current" | "all" | string;
  setActiveSemesterId: (id: "current" | "all" | string) => Promise<void>;

  /** Занятия, отфильтрованные по активному семестру */
  classesInActiveSemester: ClassRecord[];

  addStudent: (name: string) => Promise<void>;
  updateStudentName: (studentId: string, name: string) => Promise<void>;
  deleteStudent: (studentId: string) => Promise<void>;

  saveClass: (input: SaveClassInput, opts?: { replaceIfExists?: boolean }) => Promise<SaveClassResult>;
  updateClassMeta: (
    classId: string,
    input: UpdateClassMetaInput,
    opts?: { replaceIfDuplicate?: boolean }
  ) => Promise<UpdateClassMetaResult>;
  updateClassAttendance: (classId: string, attendance: Record<string, AttendanceStatus>) => Promise<void>;
  deleteClass: (classId: string) => Promise<void>;

  savePairSettings: (next: PairSetting[]) => Promise<void>;
  saveSemesters: (next: Semester[]) => Promise<void>;

  /** keepUi: не сбрасывать isReady — нужно для pull-to-refresh без мигания экрана */
  reloadAll: (opts?: { keepUi?: boolean }) => Promise<void>;
  resetAllData: () => Promise<void>;
};

const AppDataContext = createContext<AppDataContextValue | null>(null);

function defaultPairs(): PairSetting[] {
  return [
    { id: makeId("pair"), start: "09:00", end: "10:30" },
    { id: makeId("pair"), start: "10:40", end: "12:10" },
    { id: makeId("pair"), start: "12:20", end: "13:50" },
    { id: makeId("pair"), start: "14:30", end: "16:00" },
    { id: makeId("pair"), start: "16:10", end: "17:40" },
    { id: makeId("pair"), start: "17:50", end: "19:20" },
  ];
}

// Шаг 2: Функция автопочинки ID
function ensureUniqueClassIds(list: ClassRecord[]) {
  const seen = new Map<string, number>();
  let changed = false;

  const fixed = list.map((c) => {
    let id = c.id?.trim();

    // если id отсутствует/пустой — создаём новый
    if (!id) {
      changed = true;
      id = makeId("class");
      return { ...c, id };
    }

    const count = seen.get(id) ?? 0;
    seen.set(id, count + 1);

    // первый раз встречаем id — ок
    if (count === 0) return c;

    // дубль — делаем новый уникальный id
    changed = true;
    const newId = `${id}__dup${count + 1}`;
    return { ...c, id: newId };
  });

  return { fixed, changed };
}

type Meta = {
  activeSemesterId?: "current" | "all" | string;
  [key: string]: unknown;
};

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);

  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [pairSettings, setPairSettings] = useState<PairSetting[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [activeSemesterId, setActiveSemesterIdState] = useState<
    "current" | "all" | string
  >("current");

  async function reloadAll(opts?: { keepUi?: boolean }) {
    if (!opts?.keepUi) {
      setIsReady(false);
    }

    const loadedStudents = await loadJSON<Student[]>(STORAGE_KEYS.students, []);
    const loadedClasses = await loadJSON<ClassRecord[]>(STORAGE_KEYS.classes, []);
    let loadedPairs = await loadJSON<PairSetting[]>(STORAGE_KEYS.pairSettings, []);
    let loadedSemesters = await loadJSON<Semester[]>(STORAGE_KEYS.semesters, []);
    const meta = await loadJSON<Meta>(STORAGE_KEYS.meta, {});

    const defaults = defaultPairs();

    // 1. Починка пар
    if (!loadedPairs || loadedPairs.length === 0) {
      loadedPairs = defaults;
      await saveJSON(STORAGE_KEYS.pairSettings, loadedPairs);
    } else if (loadedPairs.length < defaults.length) {
      const missing = defaults.slice(loadedPairs.length);
      loadedPairs = [...loadedPairs, ...missing];
      await saveJSON(STORAGE_KEYS.pairSettings, loadedPairs);
    }

    // 2. Автопочинка занятий
    const { fixed: fixedClasses, changed: classesChanged } =
      ensureUniqueClassIds(loadedClasses);
    if (classesChanged) {
      await saveJSON(STORAGE_KEYS.classes, fixedClasses);
    }

    // 3. Миграция семестров: обернуть существующие данные в осень/весну
    if (!loadedSemesters || loadedSemesters.length === 0) {
      if (fixedClasses.length > 0) {
        const dates = fixedClasses.map((c) => c.date);
        const minDate = dates.reduce((a, b) => (a < b ? a : b));
        const maxDate = dates.reduce((a, b) => (a > b ? a : b));
        loadedSemesters = buildSemestersForDateRange(
          minDate,
          maxDate,
          () => makeId("semester")
        );
        await saveJSON(STORAGE_KEYS.semesters, loadedSemesters);
      } else {
        const year = new Date().getFullYear();
        loadedSemesters = buildSemestersForDateRange(
          `${year - 1}-09-01`,
          `${year}-12-31`,
          () => makeId("semester")
        );
        await saveJSON(STORAGE_KEYS.semesters, loadedSemesters);
      }
    }

    setStudents(loadedStudents);
    setClasses(fixedClasses);
    setPairSettings(loadedPairs);
    setSemesters(loadedSemesters);
    setActiveSemesterIdState(
      (meta.activeSemesterId as "current" | "all" | string) ?? "current"
    );

    setIsReady(true);
  }

  useEffect(() => {
    void reloadAll();
  }, []);

  async function addStudent(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;

    const next: Student[] = [...students, { id: makeId("student"), name: trimmed }];
    next.sort((a, b) => a.name.localeCompare(b.name, "ru"));

    setStudents(next);
    await saveJSON(STORAGE_KEYS.students, next);
    
    // Триггерим автобэкап при добавлении студента
    try {
      await maybeAutoBackup({ students: next, classes, pairSettings, semesters });
    } catch (e) {
      console.warn("[addStudent] Ошибка автобэкапа:", e);
    }
  }

  async function deleteStudent(studentId: string) {
    const next = students.filter((s) => s.id !== studentId);
    setStudents(next);
    await saveJSON(STORAGE_KEYS.students, next);
    
    // Триггерим автобэкап при удалении студента
    try {
      await maybeAutoBackup({ students: next, classes, pairSettings, semesters });
    } catch (e) {
      console.warn("[deleteStudent] Ошибка автобэкапа:", e);
    }
  }

  async function updateStudentName(studentId: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;

    const nextStudents = students
      .map((s) => (s.id === studentId ? { ...s, name: trimmed } : s))
      .sort((a, b) => a.name.localeCompare(b.name, "ru"));

    setStudents(nextStudents);
    await saveJSON(STORAGE_KEYS.students, nextStudents);

    let changed = false;
    const nextClasses = classes.map((c) => {
      const snapshot = c.studentsSnapshot?.map((ss) => {
        if (ss.id === studentId && ss.name !== trimmed) {
          changed = true;
          return { ...ss, name: trimmed };
        }
        return ss;
      });
      return snapshot ? { ...c, studentsSnapshot: snapshot } : c;
    });

    if (changed) {
      setClasses(nextClasses);
      await saveJSON(STORAGE_KEYS.classes, nextClasses);
    }
    
    // Триггерим автобэкап при изменении имени студента
    try {
      await maybeAutoBackup({ students: nextStudents, classes: changed ? nextClasses : classes, pairSettings, semesters });
    } catch (e) {
      console.warn("[updateStudentName] Ошибка автобэкапа:", e);
    }
  }

  async function saveClass(input: SaveClassInput, opts?: { replaceIfExists?: boolean }): Promise<SaveClassResult> {
    const subject = input.subject.trim();
    const subjectNormalized = normalizeSubject(subject);

    const existing = classes.find(
      (c) =>
        c.date === input.date &&
        c.pairNumber === input.pairNumber &&
        c.subjectNormalized === subjectNormalized
    );

    if (existing && !opts?.replaceIfExists) {
      return { ok: false, reason: "duplicate", existingId: existing.id };
    }

    const nowIso = new Date().toISOString();
    const studentsSnapshot: Student[] = students.map((s) => ({ id: s.id, name: s.name }));

    if (existing && opts?.replaceIfExists) {
      const replaced: ClassRecord = {
        ...existing,
        subject,
        subjectNormalized,
        date: input.date,
        pairNumber: input.pairNumber,
        attendance: input.attendance,
        studentsSnapshot,
      };

      const next = classes.map((c) => (c.id === existing.id ? replaced : c));
      next.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

      setClasses(next);
      await saveJSON(STORAGE_KEYS.classes, next);

      try {
        await maybeAutoBackup({ students, classes: next, pairSettings, semesters });
      } catch (e) {
        console.warn("[saveClass] Ошибка автобэкапа:", e);
      }

      return { ok: true, id: existing.id, replaced: true };
    }

    const record: ClassRecord = {
      id: makeId("class"),
      subject,
      subjectNormalized,
      date: input.date,
      pairNumber: input.pairNumber,
      studentsSnapshot,
      attendance: input.attendance,
      createdAt: nowIso,
    };

    const next = [record, ...classes].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    setClasses(next);
    await saveJSON(STORAGE_KEYS.classes, next);

    try {
      await maybeAutoBackup({ students, classes: next, pairSettings, semesters });
    } catch (e) {
      console.warn("[saveClass] Ошибка автобэкапа:", e);
    }

    return { ok: true, id: record.id, replaced: false };
  }

  async function updateClassMeta(
    classId: string,
    input: UpdateClassMetaInput,
    opts?: { replaceIfDuplicate?: boolean }
  ): Promise<UpdateClassMetaResult> {
    const cls = classes.find((c) => c.id === classId);
    if (!cls) return { ok: false, reason: "not_found" };

    const subject = (input.subject ?? cls.subject).trim();
    if (!subject) return { ok: false, reason: "not_found" };
    const subjectNormalized = normalizeSubject(subject);
    const date = input.date ?? cls.date;
    const pairNumber = input.pairNumber ?? cls.pairNumber;
    if (pairNumber < 1) return { ok: false, reason: "not_found" };

    const duplicate = classes.find(
      (c) =>
        c.id !== classId &&
        c.date === date &&
        c.pairNumber === pairNumber &&
        c.subjectNormalized === subjectNormalized
    );

    if (duplicate && !opts?.replaceIfDuplicate) {
      return { ok: false, reason: "duplicate", existingId: duplicate.id };
    }

    let base = cls;
    let list = classes;
    if (duplicate && opts?.replaceIfDuplicate) {
      list = classes.filter((c) => c.id !== duplicate.id);
      const again = list.find((c) => c.id === classId);
      if (!again) return { ok: false, reason: "not_found" };
      base = again;
    }

    const studentsSnapshot: Student[] = students.map((s) => ({ id: s.id, name: s.name }));
    const nextAttendance: Record<string, AttendanceStatus> = {};
    for (const s of students) {
      nextAttendance[s.id] = base.attendance[s.id] ?? "absent";
    }

    const updated: ClassRecord = {
      ...base,
      subject,
      subjectNormalized,
      date,
      pairNumber,
      studentsSnapshot,
      attendance: nextAttendance,
    };

    const next = list.map((c) => (c.id === classId ? updated : c));
    next.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

    setClasses(next);
    await saveJSON(STORAGE_KEYS.classes, next);

    try {
      await maybeAutoBackup({ students, classes: next, pairSettings, semesters });
    } catch (e) {
      console.warn("[updateClassMeta] Ошибка автобэкапа:", e);
    }

    return { ok: true };
  }

  async function updateClassAttendance(classId: string, attendance: Record<string, AttendanceStatus>) {
    const next = classes.map((c) => (c.id === classId ? { ...c, attendance } : c));
    setClasses(next);
    await saveJSON(STORAGE_KEYS.classes, next);
    
    // Триггерим автобэкап при изменении посещаемости (важные данные)
    try {
      await maybeAutoBackup({ students, classes: next, pairSettings, semesters });
    } catch (e) {
      console.warn("[updateClassAttendance] Ошибка автобэкапа:", e);
    }
  }

  async function deleteClass(classId: string) {
    const next = classes.filter((c) => c.id !== classId);
    setClasses(next);
    await saveJSON(STORAGE_KEYS.classes, next);
    
    // Триггерим автобэкап при удалении класса (важная операция)
    try {
      await maybeAutoBackup({ students, classes: next, pairSettings, semesters });
    } catch (e) {
      console.warn("[deleteClass] Ошибка автобэкапа:", e);
    }
  }

  async function savePairSettings(next: PairSetting[]) {
    if (next.length < 1) return;
    if (next.length > 8) return;

    setPairSettings(next);
    await saveJSON(STORAGE_KEYS.pairSettings, next);
    
    // Триггерим автобэкап при изменении расписания пар
    try {
      await maybeAutoBackup({ students, classes, pairSettings: next, semesters });
    } catch (e) {
      console.warn("[savePairSettings] Ошибка автобэкапа:", e);
    }
  }

  async function resetAllData() {
    const defaults = defaultPairs();
    const year = new Date().getFullYear();
    const defaultSemesters = buildSemestersForDateRange(
      `${year - 1}-09-01`,
      `${year}-12-31`,
      () => makeId("semester")
    );
    await saveJSON(STORAGE_KEYS.students, []);
    await saveJSON(STORAGE_KEYS.classes, []);
    await saveJSON(STORAGE_KEYS.pairSettings, defaults);
    await saveJSON(STORAGE_KEYS.semesters, defaultSemesters);
    await saveJSON(STORAGE_KEYS.meta, {});
    setActiveSemesterIdState("current");
    setStudents([]);
    setClasses([]);
    setPairSettings(defaults);
    setSemesters(defaultSemesters);
  }

  async function saveSemesters(next: Semester[]) {
    setSemesters(next);
    await saveJSON(STORAGE_KEYS.semesters, next);
    
    // Триггерим автобэкап при изменении семестров
    try {
      await maybeAutoBackup({ students, classes, pairSettings, semesters: next });
    } catch (e) {
      console.warn("[saveSemesters] Ошибка автобэкапа:", e);
    }
  }

  async function setActiveSemesterId(id: "current" | "all" | string) {
    setActiveSemesterIdState(id);
    const m = await loadJSON<Meta>(STORAGE_KEYS.meta, {});
    await saveJSON(STORAGE_KEYS.meta, { ...m, activeSemesterId: id });
  }

  const classesInActiveSemester = useMemo(() => {
    if (activeSemesterId === "all") return classes;
    if (activeSemesterId === "current") {
      const cur = getCurrentSemester(semesters);
      if (!cur) return classes;
      return classes.filter((c) => dateInSemester(c.date, cur));
    }
    const s = semesters.find((x) => x.id === activeSemesterId);
    if (!s) return classes;
    return classes.filter((c) => dateInSemester(c.date, s));
  }, [classes, semesters, activeSemesterId]);

  const value = useMemo<AppDataContextValue>(
    () => ({
      isReady,
      students,
      classes,
      pairSettings,
      semesters,
      activeSemesterId,
      setActiveSemesterId,
      classesInActiveSemester,
      addStudent,
      deleteStudent,
      updateStudentName,
      saveClass,
      updateClassMeta,
      updateClassAttendance,
      deleteClass,
      savePairSettings,
      saveSemesters,
      reloadAll,
      resetAllData,
    }),
    /* Handlers close over latest state; listing them would change identity every render without useCallback. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      isReady,
      students,
      classes,
      pairSettings,
      semesters,
      activeSemesterId,
      classesInActiveSemester,
    ]
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData(): AppDataContextValue {
  const ctx = useContext(AppDataContext);
  if (!ctx) {
    throw new Error("useAppData must be used inside AppDataProvider");
  }
  return ctx;
}