import { Ionicons } from "@expo/vector-icons";
import PlatformDatePicker from "../../src/components/PlatformDatePicker";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ActionSheet } from "../../src/components/ActionSheet";
import { RefreshControlThemed } from "../../src/components/RefreshControlThemed";
import { SemesterSelector } from "../../src/components/SemesterSelector";
import { useAppData } from "../../src/context/AppDataContext";
import { useOverlay } from "../../src/context/OverlayContext";
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

type StatsRowData = {
  id: string;
  name: string;
  present: number;
  absent: number;
  pct: number;
};

const StatsTableRow = React.memo(function StatsTableRow({
  item,
  onPress,
}: {
  item: StatsRowData;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.tr} onPress={onPress}>
      <Text style={[styles.td, { flex: 2 }]} numberOfLines={1}>
        {item.name}
      </Text>
      <Text style={[styles.td, { flex: 0.7, textAlign: "right" }]}>{item.present}</Text>
      <Text style={[styles.td, { flex: 0.7, textAlign: "right" }]}>{item.absent}</Text>
      <Text style={[styles.td, { flex: 0.7, textAlign: "right" }]}>{item.pct.toFixed(0)}</Text>
    </Pressable>
  );
});

export default function StatsTab() {
  const router = useRouter();
  const { toast } = useOverlay();
  const {
    isReady,
    students,
    classesInActiveSemester,
    pairSettings,
    semesters,
    activeSemesterId,
    setActiveSemesterId,
    reloadAll,
  } = useAppData();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await reloadAll({ keepUi: true });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } finally {
      setRefreshing(false);
    }
  }, [reloadAll]);

  // фильтр даты
  const [fromISO, setFromISO] = useState<string | null>(null);
  const [toISO, setToISO] = useState<string | null>(null);
  const [pickerMode, setPickerMode] = useState<"from" | "to" | null>(null);

  // фильтр предмета
  const [subjectFilter, setSubjectFilter] = useState<string>("ALL"); // subjectNormalized или ALL
  const [subjectSheetOpen, setSubjectSheetOpen] = useState(false);

  // фильтр пары
  const [pairFilter, setPairFilter] = useState<PairFilter>("ALL");
  const [pairSheetOpen, setPairSheetOpen] = useState(false);

  // фильтр дня недели
  const [weekdayFilter, setWeekdayFilter] = useState<WeekdayFilter>("ALL");
  const [weekdaySheetOpen, setWeekdaySheetOpen] = useState(false);

  // сворачиваемые фильтры
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  const subjects = useMemo(() => {
    const map = new Map<string, string>(); // normalized -> pretty
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

  const baseFilteredClasses = useMemo(() => {
    return classesInActiveSemester.filter((c) => {
      if (fromISO && c.date < fromISO) return false;
      if (toISO && c.date > toISO) return false;

      if (pairFilter !== "ALL" && c.pairNumber !== pairFilter) return false;

      if (weekdayFilter !== "ALL" && weekdayFromISO(c.date) !== weekdayFilter) return false;

      return true;
    });
  }, [classesInActiveSemester, fromISO, toISO, pairFilter, weekdayFilter]);

  // фильтры с предметом
  const filteredClasses = useMemo(() => {
    return baseFilteredClasses.filter((c) => {
      if (subjectFilter !== "ALL" && c.subjectNormalized !== subjectFilter) return false;
      return true;
    });
  }, [baseFilteredClasses, subjectFilter]);

  // таблица студентов по текущим фильтрам
  const rows = useMemo(() => {
    const result = students.map((s) => {
      let present = 0;
      let absent = 0;

      for (const c of filteredClasses) {
        const st = (c.attendance as Record<string, Status | undefined>)[s.id];
        if (st === "present") present++;
        else if (st === "absent") absent++;
      }

      const pct = percent(present, absent);
      return { id: s.id, name: s.name, present, absent, pct };
    });

    result.sort((a, b) => {
      if (b.pct !== a.pct) return b.pct - a.pct;
      if (b.present !== a.present) return b.present - a.present;
      return a.name.localeCompare(b.name, "ru");
    });

    return result;
  }, [students, filteredClasses]);

  // итоги по текущим фильтрам (по студентам)
  const totals = useMemo(() => {
    let present = 0;
    let absent = 0;
    for (const r of rows) {
      present += r.present;
      absent += r.absent;
    }
    return {
      lessons: filteredClasses.length,
      present,
      absent,
      pct: percent(present, absent),
    };
  }, [rows, filteredClasses.length]);

  function resetFilters() {
    setFromISO(null);
    setToISO(null);
    setSubjectFilter("ALL");
    setPairFilter("ALL");
    setWeekdayFilter("ALL");
  }

  if (!isReady) return null;

  const refreshControl = (
    <RefreshControlThemed refreshing={refreshing} onRefresh={onRefresh} />
  );

  async function copyTotalsSummary() {
    const text = `Занятий: ${totals.lessons} • ✅ ${totals.present} • ❌ ${totals.absent} • ${totals.pct.toFixed(0)}%`;
    try {
      await Clipboard.setStringAsync(text);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      toast("Сводка скопирована", { variant: "success" });
    } catch {
      toast("Не удалось скопировать", { variant: "danger" });
    }
  }

  const listHeader = (
    <View>
      <View style={styles.topRow}>
        <Text style={styles.title}>Статистика</Text>
        <View style={styles.headerButtons}>
          <Pressable
            style={styles.iconBtn}
            onPress={() => router.push("/backup")}
            hitSlop={10}
          >
            <Ionicons name="save-outline" size={22} color={colors.text} />
          </Pressable>
        </View>
      </View>

      <View style={styles.semesterRow}>
        <SemesterSelector
          semesters={semesters}
          activeId={activeSemesterId}
          onSelect={setActiveSemesterId}
        />
      </View>

      <Pressable
        style={styles.filtersHeader}
        onPress={() => setFiltersExpanded((v) => !v)}
      >
        <Text style={styles.sectionTitle}>Фильтры</Text>
        <Ionicons
          name={filtersExpanded ? "chevron-up" : "chevron-down"}
          size={18}
          color={colors.muted}
        />
      </Pressable>

      {filtersExpanded && (
        <>
          <View style={styles.row}>
            <Pressable style={styles.filterBtn} onPress={() => setPickerMode("from")}>
              <Text style={styles.filterBtnText} numberOfLines={1}>
                {fromISO ? `С: ${formatRuDate(fromISO)}` : "С даты"}
              </Text>
            </Pressable>

            <Pressable style={styles.filterBtn} onPress={() => setPickerMode("to")}>
              <Text style={styles.filterBtnText} numberOfLines={1}>
                {toISO ? `По: ${formatRuDate(toISO)}` : "По дату"}
              </Text>
            </Pressable>
          </View>

          <View style={styles.row}>
            <Pressable style={styles.smallChip} onPress={() => setSubjectSheetOpen(true)}>
              <Ionicons name="chevron-down" size={16} color={colors.muted} />
              <Text style={styles.smallChipText} numberOfLines={1}>
                {chosenSubjectLabel}
              </Text>
            </Pressable>

            <Pressable style={styles.smallChip} onPress={() => setPairSheetOpen(true)}>
              <Ionicons name="chevron-down" size={16} color={colors.muted} />
              <Text style={styles.smallChipText}>{chosenPairLabel}</Text>
            </Pressable>

            <Pressable style={styles.smallChip} onPress={() => setWeekdaySheetOpen(true)}>
              <Ionicons name="chevron-down" size={16} color={colors.muted} />
              <Text style={styles.smallChipText}>{chosenWeekdayLabel}</Text>
            </Pressable>
          </View>

          <Pressable style={styles.resetBtn} onPress={resetFilters}>
            <Text style={styles.resetText}>Сбросить фильтры</Text>
          </Pressable>
        </>
      )}

      <Pressable style={styles.totalCard} onLongPress={() => void copyTotalsSummary()}>
        <Text style={styles.totalText}>
          Занятий: {totals.lessons} • ✅ {totals.present} • ❌ {totals.absent} • {totals.pct.toFixed(0)}%
        </Text>
      </Pressable>

      <View style={styles.tableHeader}>
        <Text style={[styles.th, { flex: 2 }]}>Имя</Text>
        <Text style={[styles.th, { flex: 0.7, textAlign: "right" }]}>✅</Text>
        <Text style={[styles.th, { flex: 0.7, textAlign: "right" }]}>❌</Text>
        <Text style={[styles.th, { flex: 0.7, textAlign: "right" }]}>%</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        style={styles.listFlex}
        data={rows}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={listHeader}
        contentContainerStyle={styles.listContent}
        refreshControl={refreshControl}
        renderItem={({ item }) => (
          <StatsTableRow item={item} onPress={() => router.push(`/student/${item.id}`)} />
        )}
        ListEmptyComponent={
          students.length === 0 ? (
            <Text style={styles.emptyHint}>Добавьте студентов на вкладке «Студенты».</Text>
          ) : undefined
        }
      />

        {/* Date picker */}
        {pickerMode && (
          <PlatformDatePicker
            value={isoToDate((pickerMode === "from" ? fromISO : toISO) ?? toISODateLocal(new Date()))}
            mode="date"
            maximumDate={new Date()}
            onChange={(_, selected) => {
              const mode = pickerMode;
              setPickerMode(null);
              if (!selected) return;

              const nextISO = toISODateLocal(selected);

              if (mode === "from") {
                setFromISO(nextISO);
                if (toISO && nextISO > toISO) setToISO(nextISO);
              } else {
                setToISO(nextISO);
                if (fromISO && nextISO < fromISO) setFromISO(nextISO);
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
            ...subjects.map((s) => ({
              label: s.label,
              onPress: () => setSubjectFilter(s.value),
            })),
          ]}
        />

        <ActionSheet
          visible={pairSheetOpen}
          onClose={() => setPairSheetOpen(false)}
          title="Номер пары"
          actions={[
            { label: "Все пары", onPress: () => setPairFilter("ALL") },
            ...pairOptions.map((n) => ({
              label: `Пара ${n}`,
              onPress: () => setPairFilter(n),
            })),
          ]}
        />

        <ActionSheet
          visible={weekdaySheetOpen}
          onClose={() => setWeekdaySheetOpen(false)}
          title="День недели"
          actions={[
            { label: "Все дни", onPress: () => setWeekdayFilter("ALL") },
            ...WEEKDAY_OPTIONS.map((w) => ({
              label: w.label,
              onPress: () => setWeekdayFilter(w.value),
            })),
          ]}
        />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  listFlex: { flex: 1, backgroundColor: colors.bg },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
    flexGrow: 1,
    backgroundColor: colors.bg,
  },

  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  semesterRow: { marginBottom: 12 },
  title: { color: colors.text, fontSize: 18, fontWeight: "900" },
  headerButtons: { flexDirection: "row", gap: 8 },
  iconBtn: { padding: 6, borderRadius: 12, backgroundColor: "#111", borderWidth: 1, borderColor: "#222" },

  filtersHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    paddingVertical: 4,
  },
  sectionTitle: { color: colors.muted, fontSize: 12, fontWeight: "900", marginBottom: 0 },


  row: { flexDirection: "row", gap: 10, marginBottom: 10 },
  filterBtn: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#222",
    alignItems: "center",
    justifyContent: "center",
  },
  filterBtnText: { color: colors.text, fontWeight: "800", fontSize: 13 },

  smallChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#111",
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#222",
  },
  smallChipText: { color: colors.text, fontWeight: "900", fontSize: 11, flex: 1 },

  resetBtn: {
    alignSelf: "flex-start",
    backgroundColor: "#111",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#222",
    marginBottom: 12,
  },
  resetText: { color: colors.text, fontWeight: "900" },

  totalCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#222",
    marginBottom: 12,
  },
  totalText: { color: colors.text, fontWeight: "900" },

  tableHeader: {
    flexDirection: "row",
    padding: 10,
    borderRadius: 12,
    backgroundColor: "#111",
    borderWidth: 1,
    borderColor: "#222",
    marginBottom: 8,
  },
  th: { color: colors.muted, fontWeight: "900", fontSize: 12 },

  tr: {
    flexDirection: "row",
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: "#222",
    marginBottom: 8,
  },
  td: { color: colors.text, fontSize: 14 },
  emptyHint: { color: colors.muted, paddingVertical: 16, textAlign: "center" },
});