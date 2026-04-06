import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAppData } from "../src/context/AppDataContext";
import { useOverlay } from "../src/context/OverlayContext";
import { colors } from "../src/theme/colors";
import { makeId } from "../src/utils/id";
import {
  dateInSemester,
  getCurrentSemester,
  Semester,
} from "../src/utils/semesters";
import { formatRuDate, isoToDate, toISODateLocal } from "../src/utils/dates";

export default function SemesterSettingsScreen() {
  const router = useRouter();
  const { confirm, toast } = useOverlay();
  const {
    isReady,
    semesters,
    classes,
    saveSemesters,
    activeSemesterId,
    setActiveSemesterId,
  } = useAppData();

  const [draft, setDraft] = useState<Semester[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pickerFor, setPickerFor] = useState<
    { id: string; field: "start" | "end" } | null
  >(null);

  useEffect(() => {
    setDraft([...semesters].sort((a, b) => a.sortOrder - b.sortOrder));
  }, [semesters]);

  const isDirty = useMemo(() => {
    return JSON.stringify(draft) !== JSON.stringify(semesters);
  }, [draft, semesters]);

  const onBack = useCallback(async () => {
    if (!isDirty) {
      router.back();
      return;
    }
    const ok = await confirm({
      title: "Несохранённые изменения",
      message: "Выйти без сохранения?",
      confirmText: "Выйти",
      cancelText: "Отмена",
      variant: "danger",
    });
    if (ok) router.back();
  }, [isDirty, confirm, router]);

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

  function updateSemester(
    id: string,
    patch: Partial<Pick<Semester, "name" | "startDate" | "endDate" | "isArchived">>
  ) {
    setDraft((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s))
    );
  }

  async function onArchive(id: string) {
    const s = draft.find((x) => x.id === id);
    if (!s) return;
    const cur = getCurrentSemester(draft);
    const isCurrent = cur?.id === id;

    const ok = await confirm({
      title: "Архивировать семестр?",
      message: isCurrent
        ? `"${s.name}" — текущий семестр. После архивации фокус перейдёт на следующий. Архивные семестры не показываются в "Текущий", но доступны при выборе вручную.`
        : `Семестр "${s.name}" будет скрыт из выбора "Текущий".`,
      confirmText: "Архивировать",
      cancelText: "Отмена",
      variant: "primary",
    });
    if (!ok) return;

    updateSemester(id, { isArchived: true });
    if (activeSemesterId === id) {
      await setActiveSemesterId("current");
    }
    toast("Семестр архивирован");
  }

  async function onUnarchive(id: string) {
    updateSemester(id, { isArchived: false });
    toast("Семестр восстановлен");
  }

  function onAdd() {
    const year = new Date().getFullYear();
    const nextSortOrder = Math.max(0, ...draft.map((s) => s.sortOrder)) + 1;
    const newSemester: Semester = {
      id: makeId("semester"),
      name: `Новый ${year}`,
      startDate: `${year}-09-01`,
      endDate: `${year}-12-31`,
      isArchived: false,
      sortOrder: nextSortOrder,
    };
    setDraft([...draft, newSemester].sort((a, b) => a.sortOrder - b.sortOrder));
    setEditingId(newSemester.id);
  }

  async function onSave() {
    const sorted = [...draft].sort((a, b) => a.sortOrder - b.sortOrder);
    sorted.forEach((s, i) => {
      s.sortOrder = i;
    });
    await saveSemesters(sorted);
    toast("Семестры сохранены ✓");
    setEditingId(null);
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
          <Text style={styles.title}>Семестры</Text>
          <View style={{ width: 70 }} />
        </View>

        <View style={styles.hint}>
          <Text style={styles.hintText}>
            Занятия автоматически относятся к семестру по дате. Архивируйте
            завершённые семестры, чтобы они не мешали работе с текущим.
          </Text>
        </View>

        <FlatList
          data={draft}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 100 }}
          renderItem={({ item }) => {
            const count = classes.filter((c) => dateInSemester(c.date, item))
              .length;
            const isEditing = editingId === item.id;

            return (
              <View
                style={[
                  styles.card,
                  item.isArchived && styles.cardArchived,
                ]}
              >
                <View style={styles.cardHeader}>
                  {isEditing ? (
                    <TextInput
                      value={item.name}
                      onChangeText={(v) => updateSemester(item.id, { name: v })}
                      style={styles.nameInput}
                      placeholder="Название"
                      placeholderTextColor={colors.muted}
                      autoFocus
                    />
                  ) : (
                    <Text style={styles.cardTitle}>
                      {item.name}
                      {item.isArchived && " (архив)"}
                    </Text>
                  )}
                  <Text style={styles.cardCount}>{count} занятий</Text>
                </View>

                <View style={styles.dateRow}>
                  <Pressable
                    style={styles.dateChip}
                    onPress={() => {
                      if (Platform.OS === "web") {
                        const current =
                          draft.find((s) => s.id === item.id)?.startDate ?? "";
                        const input = window.prompt(
                          "Дата начала семестра (ГГГГ-ММ-ДД)",
                          current
                        );
                        if (!input) return;
                        const trimmed = input.trim();
                        const isoPattern = /^\d{4}-\d{2}-\d{2}$/;
                        if (!isoPattern.test(trimmed)) {
                          alert("Неверный формат даты. Ожидается ГГГГ-ММ-ДД.");
                          return;
                        }
                        updateSemester(item.id, { startDate: trimmed });
                        return;
                      }
                      setPickerFor({ id: item.id, field: "start" });
                    }}
                  >
                    <Text style={styles.dateText}>
                      {formatRuDate(item.startDate)}
                    </Text>
                  </Pressable>
                  <Text style={styles.dash}>—</Text>
                  <Pressable
                    style={styles.dateChip}
                    onPress={() => {
                      if (Platform.OS === "web") {
                        const current =
                          draft.find((s) => s.id === item.id)?.endDate ?? "";
                        const input = window.prompt(
                          "Дата конца семестра (ГГГГ-ММ-ДД)",
                          current
                        );
                        if (!input) return;
                        const trimmed = input.trim();
                        const isoPattern = /^\d{4}-\d{2}-\d{2}$/;
                        if (!isoPattern.test(trimmed)) {
                          alert("Неверный формат даты. Ожидается ГГГГ-ММ-ДД.");
                          return;
                        }
                        updateSemester(item.id, { endDate: trimmed });
                        return;
                      }
                      setPickerFor({ id: item.id, field: "end" });
                    }}
                  >
                    <Text style={styles.dateText}>
                      {formatRuDate(item.endDate)}
                    </Text>
                  </Pressable>
                </View>

                <View style={styles.cardActions}>
                  <Pressable
                    style={styles.smallBtn}
                    onPress={() =>
                      setEditingId(isEditing ? null : item.id)
                    }
                  >
                    <Ionicons
                      name={isEditing ? "checkmark" : "pencil"}
                      size={18}
                      color={colors.text}
                    />
                    <Text style={styles.smallBtnText}>
                      {isEditing ? "Готово" : "Изменить"}
                    </Text>
                  </Pressable>
                  {item.isArchived ? (
                    <Pressable
                      style={styles.smallBtn}
                      onPress={() => onUnarchive(item.id)}
                    >
                      <Ionicons
                        name="archive"
                        size={18}
                        color={colors.text}
                      />
                      <Text style={styles.smallBtnText}>Восстановить</Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      style={[styles.smallBtn, styles.archiveBtn]}
                      onPress={() => onArchive(item.id)}
                    >
                      <Ionicons
                        name="archive-outline"
                        size={18}
                        color={colors.muted}
                      />
                      <Text style={styles.archiveBtnText}>Архивировать</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            );
          }}
        />

        {Platform.OS !== "web" && pickerFor && (
          <DateTimePicker
            value={isoToDate(
              pickerFor.field === "start"
                ? draft.find((s) => s.id === pickerFor.id)?.startDate ?? ""
                : draft.find((s) => s.id === pickerFor.id)?.endDate ?? ""
            )}
            mode="date"
            onChange={(_, selected) => {
              setPickerFor(null);
              if (!selected) return;
              const iso = toISODateLocal(selected);
              updateSemester(pickerFor.id, {
                [pickerFor.field]: iso,
              });
            }}
          />
        )}

        <View style={styles.bottomRow}>
          <Pressable style={styles.secondaryBtn} onPress={onAdd}>
            <Ionicons name="add" size={20} color={colors.text} />
            <Text style={styles.secondaryText}>Добавить семестр</Text>
          </Pressable>
          <Pressable
            style={[styles.primaryBtn, !isDirty && styles.primaryBtnDisabled]}
            onPress={onSave}
            disabled={!isDirty}
          >
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  title: { color: colors.text, fontSize: 18, fontWeight: "900" },
  muted: { color: colors.muted },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 4, width: 70 },
  backText: { color: colors.text, fontWeight: "600" },
  hint: {
    backgroundColor: "#111",
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#222",
  },
  hintText: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#222",
  },
  cardArchived: { opacity: 0.85 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: "900" },
  cardCount: { color: colors.muted, fontSize: 12 },
  nameInput: {
    flex: 1,
    backgroundColor: "#0f0f0f",
    borderRadius: 10,
    padding: 10,
    color: colors.text,
    borderWidth: 1,
    borderColor: "#222",
  },
  dateRow: { flexDirection: "row", alignItems: "center", marginTop: 10, gap: 8 },
  dateChip: {
    backgroundColor: "#0f0f0f",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#222",
  },
  dateText: { color: colors.text, fontWeight: "800", fontSize: 13 },
  dash: { color: colors.muted },
  cardActions: { flexDirection: "row", gap: 10, marginTop: 12 },
  smallBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#111",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#222",
  },
  smallBtnText: { color: colors.text, fontWeight: "800", fontSize: 12 },
  archiveBtn: { borderColor: "#333" },
  archiveBtnText: { color: colors.muted, fontWeight: "800", fontSize: 12 },
  bottomRow: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 16,
    flexDirection: "row",
    gap: 10,
  },
  secondaryBtn: {
    flex: 1,
    backgroundColor: "#111",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    borderWidth: 1,
    borderColor: "#222",
  },
  secondaryText: { color: colors.text, fontWeight: "700" },
  primaryBtn: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryText: { color: colors.text, fontWeight: "800" },
});
