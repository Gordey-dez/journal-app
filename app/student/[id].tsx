import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ActionSheet } from "../../src/components/ActionSheet";
import { SemesterSelector } from "../../src/components/SemesterSelector";
import { useAppData } from "../../src/context/AppDataContext";
import { colors } from "../../src/theme/colors";
import { formatRuDate, isoToDate, toISODateLocal } from "../../src/utils/dates";
import { normalizeSubject } from "../../src/utils/normalize";
import { WEEKDAY_OPTIONS, weekdayFromISO, weekdayLabel } from "../../src/utils/weekdays";

type Status = "present" | "absent";
type PairFilter = "ALL" | number;
type WeekdayFilter = "ALL" | number;

function percent(present: number, absent: number): number {
  const total = present + absent;
  if (total <= 0) return 0;
  return (present / total) * 100;
}

/** Цвет от красного (0%) до зелёного (100%) */
function colorByPercent(pct: number): string {
  const t = Math.max(0, Math.min(100, pct)) / 100;
  const r = Math.round(239 - (239 - 34) * t);
  const g = Math.round(68 + (197 - 68) * t);
  const b = Math.round(68 + (94 - 68) * t);
  return `rgb(${r},${g},${b})`;
}

export default function StudentStatsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const studentId = String(params.id || "");

  const {
    isReady,
    students,
    classesInActiveSemester,
    pairSettings,
    semesters,
    activeSemesterId,
    setActiveSemesterId,
  } = useAppData();

  const student = useMemo(
    () => students.find((s) => s.id === studentId) ?? null,
    [students, studentId]
  );

  // фильтры
  const [fromISO, setFromISO] = useState<string | null>(null);
  const [toISO, setToISO] = useState<string | null>(null);
  const [pickerMode, setPickerMode] = useState<"from" | "to" | null>(null);

  const [subjectFilter, setSubjectFilter] = useState<string>("ALL"); // normalized subject или ALL
  const [subjectSheetOpen, setSubjectSheetOpen] = useState(false);

  const [pairFilter, setPairFilter] = useState<PairFilter>("ALL");
  const [pairSheetOpen, setPairSheetOpen] = useState(false);

  const [weekdayFilter, setWeekdayFilter] = useState<WeekdayFilter>("ALL");
  const [weekdaySheetOpen, setWeekdaySheetOpen] = useState(false);

  const [historyExpanded, setHistoryExpanded] = useState(false);

  const subjects = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of classesInActiveSemester) {
      const norm = c.subjectNormalized || normalizeSubject(c.subject);
      if (!map.has(norm)) map.set(norm, c.subject);
    }
    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "ru"));
  }, [classesInActiveSemester]);

  const chosenSubjectLabel = useMemo(() => {
    if (subjectFilter === "ALL") return "Все предметы";
    return subjects.find((s) => s.value === subjectFilter)?.label ?? "Все предметы";
  }, [subjectFilter, subjects]);

  const pairOptions = useMemo(() => {
    const count = Math.max(1, pairSettings.length);
    return Array.from({ length: count }, (_, i) => i + 1);
  }, [pairSettings.length]);

  const chosenPairLabel = useMemo(() => {
    if (pairFilter === "ALL") return "Все пары";
    return `Пара ${pairFilter}`;
  }, [pairFilter]);

  const chosenWeekdayLabel = useMemo(() => {
    if (weekdayFilter === "ALL") return "Все дни";
    return weekdayLabel(weekdayFilter);
  }, [weekdayFilter]);

  const filteredClasses = useMemo(() => {
    return classesInActiveSemester.filter((c) => {
      // дата
      if (fromISO && c.date < fromISO) return false;
      if (toISO && c.date > toISO) return false;

      // пара
      if (pairFilter !== "ALL" && c.pairNumber !== pairFilter) return false;

      // день недели
      if (weekdayFilter !== "ALL") {
        if (weekdayFromISO(c.date) !== weekdayFilter) return false;
      }

      // предмет
      if (subjectFilter !== "ALL" && c.subjectNormalized !== subjectFilter) return false;

      return true;
    });
  }, [classesInActiveSemester, fromISO, toISO, pairFilter, weekdayFilter, subjectFilter]);

  const history = useMemo(() => {
    if (!student) return [];

    const list = filteredClasses
      .slice()
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.pairNumber - a.pairNumber))
      .map((c) => {
        const st = (c.attendance as Record<string, Status | undefined>)[student.id];
        const status: "present" | "absent" | "unmarked" = st ?? "unmarked";
        const p = pairSettings[c.pairNumber - 1];
        const time = p ? `${p.start}-${p.end}` : "";
        return {
          id: c.id,
          subject: c.subject,
          date: c.date,
          pairNumber: c.pairNumber,
          time,
          status,
        };
      });

    return list;
  }, [filteredClasses, student, pairSettings]);

  const totals = useMemo(() => {
    let present = 0;
    let absent = 0;
    let unmarked = 0;

    for (const x of history) {
      if (x.status === "present") present++;
      else if (x.status === "absent") absent++;
      else unmarked++;
    }

    return {
      lessons: history.length,
      present,
      absent,
      unmarked,
      pct: percent(present, absent),
    };
  }, [history]);

  function resetFilters() {
    setFromISO(null);
    setToISO(null);
    setSubjectFilter("ALL");
    setPairFilter("ALL");
    setWeekdayFilter("ALL");
  }

  if (!isReady) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <Text style={styles.muted}>Загрузка...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!student) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <Text style={styles.title}>Студент не найден</Text>
          <Pressable style={styles.btn} onPress={() => router.back()}>
            <Text style={styles.btnText}>Назад</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Шапка */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
            <Text style={styles.backText}>Назад</Text>
          </Pressable>

          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>
              {student.name}
            </Text>
            <Text style={styles.muted} numberOfLines={1}>
              Статистика студента
            </Text>
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
        {/* Фильтры (чипы) */}
        <View style={styles.filters}>
          <View style={styles.semesterRow}>
            <SemesterSelector
              semesters={semesters}
              activeId={activeSemesterId}
              onSelect={setActiveSemesterId}
            />
          </View>
          <View style={styles.row}>
            <Pressable style={styles.chip} onPress={() => setPickerMode("from")}>
              <Ionicons name="calendar-outline" size={16} color={colors.muted} />
              <Text style={styles.chipText}>{fromISO ? `С: ${formatRuDate(fromISO)}` : "С даты"}</Text>
            </Pressable>

            <Pressable style={styles.chip} onPress={() => setPickerMode("to")}>
              <Ionicons name="calendar-outline" size={16} color={colors.muted} />
              <Text style={styles.chipText}>{toISO ? `По: ${formatRuDate(toISO)}` : "По дату"}</Text>
            </Pressable>
          </View>

          <View style={styles.row}>
            <Pressable style={styles.chipSmall} onPress={() => setSubjectSheetOpen(true)}>
              <Ionicons name="chevron-down" size={16} color={colors.muted} />
              <Text style={styles.chipSmallText} numberOfLines={1}>{chosenSubjectLabel}</Text>
            </Pressable>

            <Pressable style={styles.chipSmall} onPress={() => setPairSheetOpen(true)}>
              <Ionicons name="chevron-down" size={16} color={colors.muted} />
              <Text style={styles.chipSmallText}>{chosenPairLabel}</Text>
            </Pressable>

            <Pressable style={styles.chipSmall} onPress={() => setWeekdaySheetOpen(true)}>
              <Ionicons name="chevron-down" size={16} color={colors.muted} />
              <Text style={styles.chipSmallText}>{chosenWeekdayLabel}</Text>
            </Pressable>
          </View>

          <Pressable style={styles.resetBtn} onPress={resetFilters}>
            <Text style={styles.resetText}>Сбросить</Text>
          </Pressable>
        </View>

        {/* Визуальная сводка */}
        <View style={styles.statsCard}>
          <View style={styles.statsRow}>
            <View
              style={[
                styles.percentRing,
                { borderColor: colorByPercent(totals.pct) },
              ]}
            >
              <Text style={styles.percentText}>{totals.pct.toFixed(0)}%</Text>
            </View>
            <View style={styles.statsRight}>
              <Text style={styles.statsLabel}>Посещаемость</Text>
              <Text style={styles.statsCounts}>
                ✅ {totals.present}  •  ❌ {totals.absent}  •  ⚪ {totals.unmarked}
              </Text>
              <Text style={styles.statsLessons}>Занятий: {totals.lessons}</Text>
            </View>
          </View>
          {/* Полоска соотношения */}
          {totals.lessons > 0 && (
            <View style={styles.barWrap}>
              <View
                style={[
                  styles.barSegment,
                  styles.barPresent,
                  { flex: totals.present || 0.01 },
                ]}
              />
              <View
                style={[
                  styles.barSegment,
                  styles.barAbsent,
                  { flex: totals.absent || 0.01 },
                ]}
              />
              <View
                style={[
                  styles.barSegment,
                  styles.barUnmarked,
                  { flex: totals.unmarked || 0.01 },
                ]}
              />
            </View>
          )}
        </View>

        {/* Кнопка истории */}
        <Pressable
          style={styles.historyToggle}
          onPress={() => setHistoryExpanded((v) => !v)}
        >
          <Ionicons
            name={historyExpanded ? "chevron-up" : "chevron-down"}
            size={20}
            color={colors.muted}
          />
          <Text style={styles.historyToggleText}>
            История посещений ({history.length})
          </Text>
        </Pressable>

        {/* История (сворачиваемая) */}
        {historyExpanded
          ? history.map((item) => (
            <View key={item.id} style={styles.lessonRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.lessonTitle} numberOfLines={1}>{item.subject}</Text>
                <Text style={styles.lessonSub}>
                  {formatRuDate(item.date)} • Пара {item.pairNumber} {item.time ? `(${item.time})` : ""}
                </Text>
              </View>

              <Text style={styles.lessonStatus}>
                {item.status === "present" ? "✅" : item.status === "absent" ? "❌" : "⚪"}
              </Text>
            </View>
          ))
          : null}
        </ScrollView>

        {/* Date picker */}
        {pickerMode && (
          <DateTimePicker
            value={isoToDate((pickerMode === "from" ? fromISO : toISO) ?? toISODateLocal(new Date()))}
            mode="date"
            maximumDate={new Date()}
            onChange={(_, selected) => {
              const mode = pickerMode;
              setPickerMode(null);
              if (!selected) return;
              const next = toISODateLocal(selected);

              if (mode === "from") {
                setFromISO(next);
                if (toISO && next > toISO) setToISO(next);
              } else {
                setToISO(next);
                if (fromISO && next < fromISO) setFromISO(next);
              }
            }}
          />
        )}

        {/* ActionSheets */}
        <ActionSheet
          visible={subjectSheetOpen}
          onClose={() => setSubjectSheetOpen(false)}
          title="Предмет"
          actions={[
            { label: "Все предметы", onPress: () => setSubjectFilter("ALL") },
            ...subjects.map((s) => ({ label: s.label, onPress: () => setSubjectFilter(s.value) })),
          ]}
        />

        <ActionSheet
          visible={pairSheetOpen}
          onClose={() => setPairSheetOpen(false)}
          title="Номер пары"
          actions={[
            { label: "Все пары", onPress: () => setPairFilter("ALL") },
            ...pairOptions.map((n) => ({ label: `Пара ${n}`, onPress: () => setPairFilter(n) })),
          ]}
        />

        <ActionSheet
          visible={weekdaySheetOpen}
          onClose={() => setWeekdaySheetOpen(false)}
          title="День недели"
          actions={[
            { label: "Все дни", onPress: () => setWeekdayFilter("ALL") },
            ...WEEKDAY_OPTIONS.map((w) => ({ label: w.label, onPress: () => setWeekdayFilter(w.value) })),
          ]}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, backgroundColor: colors.bg, padding: 16 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 24 },

  header: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  backText: { color: colors.text, fontWeight: "800" },

  title: { color: colors.text, fontSize: 18, fontWeight: "900" },
  muted: { color: colors.muted, marginTop: 2 },

  filters: { marginTop: 6, marginBottom: 10 },
  semesterRow: { marginBottom: 10 },
  row: { flexDirection: "row", gap: 10, marginBottom: 10 },

  chip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#222",
  },
  chipText: { color: colors.text, fontWeight: "800", fontSize: 13 },

  chipSmall: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#111",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#222",
  },
  chipSmallText: { color: colors.text, fontWeight: "900", fontSize: 12, flex: 1 },

  resetBtn: {
    alignSelf: "flex-start",
    backgroundColor: "#111",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#222",
  },
  resetText: { color: colors.text, fontWeight: "900" },

  totalsCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#222",
    marginBottom: 12,
  },
  totalsText: { color: colors.text, fontWeight: "900" },

  statsCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#222",
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  percentRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 6,
    backgroundColor: "#0a0a0a",
    alignItems: "center",
    justifyContent: "center",
  },
  percentText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
  },
  statsRight: { flex: 1 },
  statsLabel: { color: colors.muted, fontSize: 12, fontWeight: "800" },
  statsCounts: { color: colors.text, fontSize: 15, fontWeight: "900", marginTop: 4 },
  statsLessons: { color: colors.muted, fontSize: 13, marginTop: 2 },
  barWrap: {
    flexDirection: "row",
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    marginTop: 14,
    backgroundColor: "#0a0a0a",
  },
  barSegment: { minWidth: 2 },
  barPresent: { backgroundColor: colors.success },
  barAbsent: { backgroundColor: colors.danger },
  barUnmarked: { backgroundColor: "#333" },
  historyToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: "#111",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#222",
    marginBottom: 12,
  },
  historyToggleText: { color: colors.text, fontWeight: "900", fontSize: 14 },

  lessonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#222",
    marginBottom: 8,
  },
  lessonTitle: { color: colors.text, fontWeight: "900" },
  lessonSub: { color: colors.muted, marginTop: 4 },
  lessonStatus: { fontSize: 18 },

  btn: {
    marginTop: 12,
    backgroundColor: "#111",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#222",
  },
  btnText: { color: colors.text, fontWeight: "900" },
});