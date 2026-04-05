import { Ionicons } from "@expo/vector-icons";
import PlatformDatePicker from "../../src/components/PlatformDatePicker";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { Link } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";
import { RefreshControlThemed } from "../../src/components/RefreshControlThemed";
import { SemesterSelector } from "../../src/components/SemesterSelector";
import { useAppData } from "../../src/context/AppDataContext";
import { useOverlay } from "../../src/context/OverlayContext";
import { colors } from "../../src/theme/colors";
import { formatRuDate, isoToDate, todayISO, toISODateLocal } from "../../src/utils/dates";
import { normalizeSubject } from "../../src/utils/normalize";

type Status = "present" | "absent";

function getCounts(attendance: Record<string, Status>) {
  let present = 0;
  let absent = 0;
  for (const k in attendance) {
    if (attendance[k] === "present") present++;
    if (attendance[k] === "absent") absent++;
  }
  return { present, absent };
}

export default function JournalTab() {
  const { toast } = useOverlay();
  const {
    isReady,
    classesInActiveSemester,
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

  // поиск по предмету
  const [q, setQ] = useState("");

  // фильтр даты: одна дата или период
  type DateMode = "single" | "period";
  const [dateMode, setDateMode] = useState<DateMode>("single");
  const [dateISO, setDateISO] = useState<string | null>(null);
  const [fromISO, setFromISO] = useState<string | null>(null);
  const [toISO, setToISO] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<"single" | "from" | "to" | null>(null);

  const filtered = useMemo(() => {
    const qq = normalizeSubject(q);

    const list = [...classesInActiveSemester].sort((a, b) => {
      const byDate = b.date.localeCompare(a.date);
      if (byDate !== 0) return byDate;
      return b.pairNumber - a.pairNumber;
    });

    return list.filter((c) => {
      if (qq && !normalizeSubject(c.subject).includes(qq)) return false;
      if (dateMode === "single" && dateISO && c.date !== dateISO) return false;
      if (dateMode === "period") {
        if (fromISO && c.date < fromISO) return false;
        if (toISO && c.date > toISO) return false;
      }
      return true;
    });
  }, [classesInActiveSemester, q, dateMode, dateISO, fromISO, toISO]);

  function resetFilters() {
    setDateISO(null);
    setFromISO(null);
    setToISO(null);
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

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.semesterRow}>
          <SemesterSelector
            semesters={semesters}
            activeId={activeSemesterId}
            onSelect={setActiveSemesterId}
          />
        </View>

        {/* Поиск */}
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Поиск по предмету"
          placeholderTextColor={colors.muted}
          style={styles.search}
        />

        {/* Фильтр даты: одна дата или период */}
        <View style={styles.filtersRow}>
          <Pressable
            style={[styles.chip, dateMode === "single" && styles.chipSelected]}
            onPress={() => setDateMode("single")}
          >
            <Text style={styles.chipText}>Дата</Text>
          </Pressable>
          <Pressable
            style={[styles.chip, dateMode === "period" && styles.chipSelected]}
            onPress={() => setDateMode("period")}
          >
            <Text style={styles.chipText}>Период</Text>
          </Pressable>
        </View>

        {dateMode === "single" ? (
          <View style={styles.filtersRow}>
            <Pressable
              style={[styles.chip, dateISO === todayISO() && styles.chipSelected]}
              onPress={() => setDateISO(todayISO())}
            >
              <Text style={styles.chipText}>Сегодня</Text>
            </Pressable>
            <Pressable style={styles.chip} onPress={() => { setPickerTarget("single"); setShowDatePicker(true); }}>
              <Ionicons name="calendar-outline" size={16} color={colors.muted} />
              <Text style={styles.chipText} numberOfLines={1}>
                {dateISO ? formatRuDate(dateISO) : "Выбрать дату"}
              </Text>
              {!!dateISO && (
                <Pressable onPress={() => setDateISO(null)} hitSlop={10} style={styles.chipIcon}>
                  <Ionicons name="close" size={16} color={colors.muted} />
                </Pressable>
              )}
            </Pressable>
          </View>
        ) : (
          <View style={styles.filtersRow}>
            <Pressable style={styles.chip} onPress={() => { setPickerTarget("from"); setShowDatePicker(true); }}>
              <Ionicons name="calendar-outline" size={16} color={colors.muted} />
              <Text style={styles.chipText} numberOfLines={1}>
                {fromISO ? formatRuDate(fromISO) : "С"}
              </Text>
              {!!fromISO && (
                <Pressable onPress={() => setFromISO(null)} hitSlop={10} style={styles.chipIcon}>
                  <Ionicons name="close" size={16} color={colors.muted} />
                </Pressable>
              )}
            </Pressable>
            <Pressable style={styles.chip} onPress={() => { setPickerTarget("to"); setShowDatePicker(true); }}>
              <Ionicons name="calendar-outline" size={16} color={colors.muted} />
              <Text style={styles.chipText} numberOfLines={1}>
                {toISO ? formatRuDate(toISO) : "По"}
              </Text>
              {!!toISO && (
                <Pressable onPress={() => setToISO(null)} hitSlop={10} style={styles.chipIcon}>
                  <Ionicons name="close" size={16} color={colors.muted} />
                </Pressable>
              )}
            </Pressable>
          </View>
        )}

        <View style={styles.filtersRow}>
          <Pressable style={styles.resetChip} onPress={resetFilters}>
            <Text style={styles.resetChipText}>Сброс</Text>
          </Pressable>
        </View>

        {/* Date picker */}
        {showDatePicker && pickerTarget && (
          <PlatformDatePicker
            value={isoToDate(
              (pickerTarget === "single" ? dateISO : pickerTarget === "from" ? fromISO : toISO) ??
                toISODateLocal(new Date())
            )}
            mode="date"
            maximumDate={new Date()}
            onChange={(_, selected) => {
              setShowDatePicker(false);
              setPickerTarget(null);
              if (!selected) return;
              const nextISO = toISODateLocal(selected);
              if (pickerTarget === "single") setDateISO(nextISO);
              else if (pickerTarget === "from") {
                setFromISO(nextISO);
                if (toISO && nextISO > toISO) setToISO(nextISO);
              } else {
                setToISO(nextISO);
                if (fromISO && nextISO < fromISO) setFromISO(nextISO);
              }
            }}
          />
        )}

        {/* Список */}
        {filtered.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>
              Ничего не найдено по текущим фильтрам.
            </Text>
          </View>
        ) : (
          <FlatList
            style={{ flex: 1, backgroundColor: colors.bg }}
            data={filtered}
            keyExtractor={(item) => `${item.id}_${item.date}_${item.pairNumber}`}
            contentContainerStyle={{ paddingBottom: 16, backgroundColor: colors.bg }}
            refreshControl={
              <RefreshControlThemed refreshing={refreshing} onRefresh={onRefresh} />
            }
            renderItem={({ item }) => {
              const { present, absent } = getCounts(item.attendance);

              return (
                <Link href={`/class/${item.id}`} asChild>
                  <Pressable
                    style={styles.card}
                    onLongPress={async () => {
                      const line = `${item.subject} — ${formatRuDate(item.date)}, пара ${item.pairNumber}`;
                      try {
                        await Clipboard.setStringAsync(line);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        toast("Строка скопирована", { variant: "success" });
                      } catch {
                        toast("Не удалось скопировать", { variant: "danger" });
                      }
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>{item.subject}</Text>

                      <Text style={styles.cardSub}>
                        {formatRuDate(item.date)} • Пара {item.pairNumber}
                      </Text>

                      <Text style={styles.cardStats}>
                        ✅ {present}   ❌ {absent}
                      </Text>
                    </View>

                    <Ionicons name="chevron-forward" size={22} color={colors.muted} />
                  </Pressable>
                </Link>
              );
            }}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, backgroundColor: colors.bg, padding: 16 },

  semesterRow: { marginBottom: 12 },
  muted: { color: colors.muted },

  search: {
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: colors.text,
    borderWidth: 1,
    borderColor: "#222",
    marginBottom: 10,
  },

  filtersRow: { flexDirection: "row", gap: 8, alignItems: "center", marginBottom: 12 },

  chip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#111",
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#222",
  },
  chipText: { color: colors.text, fontWeight: "800", flex: 1, fontSize: 12 },
  chipIcon: { padding: 2 },
  chipSelected: { borderColor: colors.accent },

  resetChip: {
    backgroundColor: "#111",
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#222",
  },
  resetChipText: { color: colors.text, fontWeight: "900", fontSize: 12 },

  emptyBox: { backgroundColor: colors.card, borderRadius: 14, padding: 14 },
  emptyText: { color: colors.muted, lineHeight: 20 },

  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#222",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: "900" },
  cardSub: { color: colors.muted, marginTop: 6 },
  cardStats: { color: colors.text, marginTop: 8, fontWeight: "800" },
});