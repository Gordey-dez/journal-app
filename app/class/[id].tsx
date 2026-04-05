import { Ionicons } from "@expo/vector-icons";
import PlatformDatePicker from "../../src/components/PlatformDatePicker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BackHandler,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
// в) Добавлен useFocusEffect
import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppData } from "../../src/context/AppDataContext";
import { useOverlay } from "../../src/context/OverlayContext";
import { colors } from "../../src/theme/colors";
import { formatRuDate, isoToDate, todayISO, toISODateLocal } from "../../src/utils/dates";

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

export default function ClassEditScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const id = String(params.id || "");

  const { isReady, classes, pairSettings, updateClassMeta, updateClassAttendance, deleteClass } =
    useAppData();
  const { confirm, toast } = useOverlay();

  const cls = useMemo(() => classes.find((c) => c.id === id), [classes, id]);
  const [draft, setDraft] = useState<Record<string, Status>>(cls?.attendance ?? {});

  const [metaOpen, setMetaOpen] = useState(false);
  const [metaSubject, setMetaSubject] = useState("");
  const [metaDateISO, setMetaDateISO] = useState("");
  const [metaPair, setMetaPair] = useState<number | null>(null);
  const [metaDatePicker, setMetaDatePicker] = useState(false);

  useEffect(() => {
    if (cls) setDraft(cls.attendance);
  }, [cls]);

  useEffect(() => {
    if (cls && metaOpen) {
      setMetaSubject(cls.subject);
      setMetaDateISO(cls.date);
      setMetaPair(cls.pairNumber);
    }
  }, [cls, metaOpen]);

  const isDirty = useMemo(() => {
    if (!cls) return false;
    return JSON.stringify(draft) !== JSON.stringify(cls.attendance);
  }, [draft, cls]);

  // --- ЛОГИКА ВЫХОДА (Обернута в useCallback) ---
  const onBack = useCallback(async () => {
    if (!isDirty) {
      router.back();
      return;
    }

    const ok = await confirm({
      title: "Несохранённые изменения",
      message: "Выйти без сохранения изменений?",
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

        return true; // Блокируем стандартный переход
      });

      return () => sub.remove();
    }, [onBack])
  );

  async function onSave() {
    if (!cls) return;
    await updateClassAttendance(cls.id, draft);
    toast("Сохранено ✓", { variant: "success" });
  }

  async function applyMeta(replaceIfDuplicate?: boolean) {
    if (!cls || metaPair === null) return;
    const sub = metaSubject.trim();
    if (!sub) {
      toast("Введите предмет", { variant: "danger" });
      return;
    }
    const result = await updateClassMeta(
      cls.id,
      { subject: sub, date: metaDateISO, pairNumber: metaPair },
      replaceIfDuplicate ? { replaceIfDuplicate: true } : undefined
    );
    if (result.ok) {
      toast("Параметры обновлены ✓", { variant: "success" });
      setMetaOpen(false);
      return;
    }
    if (result.reason === "duplicate") {
      const ok = await confirm({
        title: "Найдено совпадение",
        message: "Уже есть занятие с такой датой, парой и предметом. Заменить его?",
        cancelText: "Отмена",
        confirmText: "Заменить",
        variant: "primary",
      });
      if (ok) await applyMeta(true);
      return;
    }
    toast("Не удалось сохранить параметры", { variant: "danger" });
  }

  async function onDelete() {
    if (!cls) return;
    const ok = await confirm({
      title: "Удалить занятие?",
      message: "Вы уверены, что хотите полностью удалить это занятие из истории?",
      confirmText: "Удалить",
      cancelText: "Отмена",
      variant: "danger",
    });

    if (ok) {
      await deleteClass(cls.id);
      router.back();
    }
  }

  function setStatus(studentId: string, next: Status | "unmarked") {
    setDraft((prev) => {
      const copy = { ...prev };
      if (next === "unmarked") {
        delete copy[studentId];
        return copy;
      }
      copy[studentId] = next;
      return copy;
    });
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

  if (!cls) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <Text style={styles.title}>Занятие не найдено</Text>
          <Pressable style={styles.secondaryBtn} onPress={() => router.back()}>
            <Text style={styles.secondaryText}>Назад</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const { present, absent } = getCounts(draft);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={onBack} style={styles.headerBtn} hitSlop={10}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
            <Text style={styles.headerBtnText}>Назад</Text>
          </Pressable>

          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>{cls.subject}</Text>
            <Text style={styles.muted}>
              {formatRuDate(cls.date)} • Пара {cls.pairNumber} • ✅ {present} ❌ {absent}
            </Text>
          </View>

          <Pressable onPress={() => setMetaOpen(true)} style={styles.iconBtn} hitSlop={10}>
            <Ionicons name="create-outline" size={22} color={colors.text} />
          </Pressable>
          <Pressable onPress={onDelete} style={styles.iconBtn} hitSlop={10}>
            <Ionicons name="trash-outline" size={22} color={colors.danger} />
          </Pressable>
        </View>

        <FlatList
          data={cls.studentsSnapshot}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const st = draft[item.id];
            return (
              <View style={styles.studentCard}>
                <Text style={styles.studentName}>{item.name}</Text>
                <View style={styles.statusRow}>
                  <Pressable
                    style={[styles.statusBtn, st === "present" && { backgroundColor: colors.success }]}
                    onPress={() => setStatus(item.id, st === "present" ? "unmarked" : "present")}
                  >
                    <Text style={styles.statusBtnText}>✅</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.statusBtn, st === "absent" && { backgroundColor: colors.danger }]}
                    onPress={() => setStatus(item.id, st === "absent" ? "unmarked" : "absent")}
                  >
                    <Text style={styles.statusBtnText}>❌</Text>
                  </Pressable>
                </View>
              </View>
            );
          }}
        />

        <Pressable style={styles.primaryBtn} onPress={onSave}>
          <Ionicons name="save-outline" size={20} color={colors.text} />
          <Text style={styles.primaryText}>Сохранить изменения</Text>
        </Pressable>

        <Modal visible={metaOpen} transparent animationType="fade">
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Параметры занятия</Text>
                <Pressable onPress={() => setMetaOpen(false)} hitSlop={10}>
                  <Ionicons name="close" size={22} color={colors.text} />
                </Pressable>
              </View>
              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 20 }}>
                <Text style={styles.fieldLabel}>Предмет</Text>
                <TextInput
                  value={metaSubject}
                  onChangeText={setMetaSubject}
                  placeholder="Название"
                  placeholderTextColor={colors.muted}
                  style={styles.input}
                />

                <Text style={styles.fieldLabel}>Дата</Text>
                <Pressable style={styles.inputLike} onPress={() => setMetaDatePicker(true)}>
                  <Ionicons name="calendar-outline" size={18} color={colors.muted} />
                  <Text style={styles.inputLikeText}>{formatRuDate(metaDateISO)}</Text>
                </Pressable>
                <Pressable style={styles.todayBtn} onPress={() => setMetaDateISO(todayISO())}>
                  <Text style={styles.todayBtnText}>Сегодня</Text>
                </Pressable>

                {metaDatePicker && (
                  <PlatformDatePicker
                    value={isoToDate(metaDateISO || cls.date)}
                    mode="date"
                    maximumDate={new Date()}
                    onChange={(_, selected) => {
                      setMetaDatePicker(false);
                      if (selected) setMetaDateISO(toISODateLocal(selected));
                    }}
                  />
                )}

                <Text style={styles.fieldLabel}>Пара</Text>
                <View style={styles.pairsWrap}>
                  {pairSettings.map((p, idx) => {
                    const num = idx + 1;
                    const selected = metaPair === num;
                    return (
                      <Pressable
                        key={p.id}
                        style={[styles.pairChip, selected && styles.pairChipSelected]}
                        onPress={() => setMetaPair(num)}
                      >
                        <Text style={[styles.pairChipText, selected && styles.pairChipTextSel]}>
                          {num} ({p.start}-{p.end})
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Pressable style={styles.modalSaveBtn} onPress={() => void applyMeta()}>
                  <Text style={styles.modalSaveText}>Сохранить параметры</Text>
                </Pressable>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, backgroundColor: colors.bg, padding: 16 },
  header: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  headerBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  headerBtnText: { color: colors.text, fontWeight: "700" },
  iconBtn: { padding: 6 },
  title: { color: colors.text, fontSize: 18, fontWeight: "900" },
  muted: { color: colors.muted, marginTop: 4 },
  studentCard: { backgroundColor: colors.card, borderRadius: 14, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: "#222" },
  studentName: { color: colors.text, fontSize: 16, marginBottom: 10 },
  statusRow: { flexDirection: "row", gap: 10 },
  statusBtn: { flex: 1, backgroundColor: "#111", borderRadius: 12, paddingVertical: 12, alignItems: "center", borderWidth: 1, borderColor: "#222" },
  statusBtnText: { fontSize: 18 },
  primaryBtn: { backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 14, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  primaryText: { color: colors.text, fontWeight: "900", fontSize: 16 },
  secondaryBtn: { marginTop: 12, backgroundColor: "#111", borderRadius: 14, paddingVertical: 12, alignItems: "center", borderWidth: 1, borderColor: "#222" },
  secondaryText: { color: colors.text, fontWeight: "800" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 500,
    maxHeight: "90%",
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#222",
    padding: 16,
  },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  modalTitle: { color: colors.text, fontSize: 16, fontWeight: "900" },
  fieldLabel: { color: colors.text, fontSize: 13, fontWeight: "800", marginTop: 12, marginBottom: 8 },
  input: {
    backgroundColor: "#0f0f0f",
    borderRadius: 12,
    padding: 12,
    color: colors.text,
    borderWidth: 1,
    borderColor: "#222",
  },
  inputLike: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#0f0f0f",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#222",
  },
  inputLikeText: { color: colors.text, fontSize: 16 },
  todayBtn: {
    alignSelf: "flex-start",
    marginTop: 8,
    backgroundColor: "#111",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#222",
  },
  todayBtnText: { color: colors.text, fontWeight: "800", fontSize: 13 },
  pairsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pairChip: {
    backgroundColor: "#111",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#222",
  },
  pairChipSelected: { borderColor: colors.accent },
  pairChipText: { color: colors.text, fontSize: 12 },
  pairChipTextSel: { color: colors.accent, fontWeight: "900" },
  modalSaveBtn: {
    marginTop: 20,
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  modalSaveText: { color: colors.text, fontWeight: "900" },
});