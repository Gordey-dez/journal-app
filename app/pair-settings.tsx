import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BackHandler,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  Platform,
  useWindowDimensions,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";
import { PairSetting, useAppData } from "../src/context/AppDataContext";
import { useOverlay } from "../src/context/OverlayContext"; // Импорт оверлея
import { colors } from "../src/theme/colors";
import { makeId } from "../src/utils/id";

function isValidTime(value: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(value)) return false;
  const [hhStr, mmStr] = value.split(":");
  const hh = Number(hhStr);
  const mm = Number(mmStr);
  return hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59;
}

function addMinutes(time: string, minutesToAdd: number): string {
  if (!isValidTime(time)) return "00:00";
  const [hhStr, mmStr] = time.split(":");
  let total = Number(hhStr) * 60 + Number(mmStr) + minutesToAdd;
  total = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export default function PairSettingsScreen() {
  const router = useRouter();
  const { isReady, pairSettings, savePairSettings } = useAppData();
  const { confirm, toast } = useOverlay(); // Подключаем оверлеи
  const { width } = useWindowDimensions();
  const isCompactWeb = Platform.OS === "web" && width < 420;

  const [draft, setDraft] = useState<PairSetting[]>(pairSettings);

  useEffect(() => {
    setDraft(pairSettings);
  }, [pairSettings]);

  const isDirty = useMemo(() => {
    return JSON.stringify(draft) !== JSON.stringify(pairSettings);
  }, [draft, pairSettings]);

  // --- ЛОГИКА ВЫХОДА ---
  const onBack = useCallback(async () => {
    if (!isDirty) {
      router.back();
      return;
    }

    const ok = await confirm({
      title: "Несохранённые изменения",
      message: "Выйти без сохранения настроек времени?",
      confirmText: "Выйти",
      cancelText: "Отмена",
      variant: "danger",
    });

    if (ok) router.back();
  }, [isDirty, confirm, router]);

  // --- ПЕРЕХВАТ СИСТЕМНОЙ КНОПКИ НАЗАД ---
  const backBusyRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        if (backBusyRef.current) return true;
        backBusyRef.current = true;
        (async () => {
          try {
            await onBack();
          } finally {
            backBusyRef.current = false;
          }
        })();
        return true;
      });
      return () => sub.remove();
    }, [onBack])
  );

  function updatePair(index: number, field: "start" | "end", value: string) {
    const next = draft.map((p, i) => (i === index ? { ...p, [field]: value } : p));
    setDraft(next);
  }

  async function confirmDelete(index: number) {
    if (draft.length <= 1) {
      toast("Минимум 1 пара должна остаться", { variant: "danger" });
      return;
    }

    const ok = await confirm({
      title: "Удалить пару?",
      message: `Удалить пару №${index + 1}?`,
      confirmText: "Удалить",
      variant: "danger",
    });

    if (ok) {
      const next = draft.filter((_, i) => i !== index);
      setDraft(next);
    }
  }

  function onAddPair() {
    if (draft.length >= 8) {
      toast("Максимум 8 пар", { variant: "danger" });
      return;
    }

    const last = draft[draft.length - 1];
    const start = last ? last.end : "09:00";
    const end = addMinutes(start, 90);

    const next: PairSetting[] = [...draft, { id: makeId("pair"), start, end }];
    setDraft(next);
  }

  async function onSave() {
    for (let i = 0; i < draft.length; i++) {
      const p = draft[i];
      if (!isValidTime(p.start) || !isValidTime(p.end)) {
        toast(`Пара ${i + 1}: неверный формат времени`, { variant: "danger" });
        return;
      }
    }

    await savePairSettings(draft);
    toast("Настройки сохранены ✓", { variant: "success" });
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
        <View style={styles.header}>
          <Pressable onPress={onBack} style={styles.backBtn} hitSlop={10}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
            <Text style={styles.backText}>Назад</Text>
          </Pressable>
          <Text style={styles.title}>Настройки</Text>
          <Pressable
            style={styles.headerRight}
            onPress={async () => {
              if (isDirty) {
                const ok = await confirm({
                  title: "Несохранённые изменения",
                  message: "Перейти к семестрам без сохранения?",
                  confirmText: "Выйти",
                  cancelText: "Отмена",
                  variant: "danger",
                });
                if (!ok) return;
              }
              router.push("/semester-settings");
            }}
          >
            <Ionicons name="school-outline" size={22} color={colors.text} />
            <Text style={styles.headerRightText}>Семестры</Text>
          </Pressable>
        </View>

        <FlatList
          data={draft}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 16 }}
          renderItem={({ item, index }) => (
            <View style={[styles.card, isCompactWeb && styles.cardCompact]}>
              <Text style={[styles.pairLabel, isCompactWeb && styles.pairLabelCompact]}>
                Пара {index + 1}
              </Text>
              <View style={styles.row}>
                <TextInput
                  value={item.start}
                  onChangeText={(v) => updatePair(index, "start", v)}
                  style={[styles.timeInput, isCompactWeb && styles.timeInputCompact]}
                  placeholder="09:00"
                  placeholderTextColor={colors.muted}
                  keyboardType="numeric"
                />
                <Text style={[styles.dash, isCompactWeb && styles.dashCompact]}>—</Text>
                <TextInput
                  value={item.end}
                  onChangeText={(v) => updatePair(index, "end", v)}
                  style={[styles.timeInput, isCompactWeb && styles.timeInputCompact]}
                  placeholder="10:30"
                  placeholderTextColor={colors.muted}
                  keyboardType="numeric"
                />
                <Pressable onPress={() => confirmDelete(index)} style={styles.trashBtn} hitSlop={10}>
                  <Ionicons name="trash-outline" size={22} color={colors.danger} />
                </Pressable>
              </View>
            </View>
          )}
        />

        <View style={styles.bottomRow}>
          <Pressable style={styles.secondaryBtn} onPress={onAddPair}>
            <Ionicons name="add" size={20} color={colors.text} />
            <Text style={styles.secondaryText}>Добавить пару</Text>
          </Pressable>
          <Pressable style={styles.primaryBtn} onPress={onSave}>
            <Ionicons name="save-outline" size={20} color={colors.text} />
            <Text style={styles.primaryText}>Сохранить</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, backgroundColor: colors.bg, padding: 16 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  title: { color: colors.text, fontSize: 18, fontWeight: "800" },
  muted: { color: colors.muted },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 4, width: 70 },
  backText: { color: colors.text, fontWeight: "600" },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  headerRightText: { color: colors.text, fontWeight: "800", fontSize: 13 },
  card: { backgroundColor: colors.card, borderRadius: 14, padding: 14, marginBottom: 10 },
  cardCompact: { padding: 10, borderRadius: 12, marginBottom: 8 },
  pairLabel: { color: colors.text, fontSize: 16, fontWeight: "700", marginBottom: 10 },
  pairLabelCompact: { fontSize: 14, marginBottom: 8 },
  row: { flexDirection: "row", alignItems: "center" },
  timeInput: { flex: 1, backgroundColor: "#0f0f0f", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: colors.text, borderWidth: 1, borderColor: "#222", textAlign: "center", fontSize: 16 },
  timeInputCompact: { paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, borderRadius: 10 },
  dash: { color: colors.muted, marginHorizontal: 8, fontSize: 18 },
  dashCompact: { marginHorizontal: 6, fontSize: 16 },
  trashBtn: { marginLeft: 10, padding: 6 },
  bottomRow: { flexDirection: "row", gap: 10 },
  secondaryBtn: { flex: 1, backgroundColor: "#111", borderRadius: 14, paddingVertical: 14, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, borderWidth: 1, borderColor: "#222" },
  secondaryText: { color: colors.text, fontWeight: "700" },
  primaryBtn: { flex: 1, backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 14, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  primaryText: { color: colors.text, fontWeight: "800" },
});