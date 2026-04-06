import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Haptics from "expo-haptics";
import * as Updates from "expo-updates";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Platform,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";
import { ActionSheet } from "../../src/components/ActionSheet";
import { useAppData } from "../../src/context/AppDataContext";
import { findSemesterForDate } from "../../src/utils/semesters";
import { useOverlay } from "../../src/context/OverlayContext";
import { useUI } from "../../src/context/UIContext";
import { colors } from "../../src/theme/colors";
// Импорт maybeAutoBackup здесь больше не нужен, так как он в контексте
import {
  formatRuDate,
  isoToDate,
  todayISO,
  toISODateLocal,
} from "../../src/utils/dates";
import { normalizeSubject } from "../../src/utils/normalize";

import { weekdayFromISO, weekdayLabel } from "../../src/utils/weekdays";

type Status = "present" | "absent";

export default function AttendanceTab() {
  const { isReady, students, pairSettings, classes, semesters, saveClass } = useAppData();
  const { setAttendanceDirty } = useUI();
  const { confirm, toast } = useOverlay();

  const [dateISO, setDateISO] = useState<string>(todayISO());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [subject, setSubject] = useState("");
  const [subjectFocused, setSubjectFocused] = useState(false);
  const [pairNumber, setPairNumber] = useState<number | null>(null);
  const [attendance, setAttendance] = useState<Record<string, Status>>({});
  const [sessionOpen, setSessionOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);

  const listRef = useRef<FlatList>(null);

  const dismissSuggestions = () => setSubjectFocused(false);

  const suggestionsPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, { dy }) => Math.abs(dy) > 10,
        onPanResponderRelease: (_, { dy }) => {
          if (dy > 25) dismissSuggestions();
        },
      }),
    []
  );

  const markedCount = Object.keys(attendance).length;
  const dirty = markedCount > 0 || subject.trim().length > 0 || pairNumber !== null;

  useEffect(() => {
    setAttendanceDirty(dirty);
  }, [dirty, setAttendanceDirty]);

  const subjectOk = subject.trim().length > 0;
  const pairOk = pairNumber !== null;
  const marksOk = markedCount > 0;
  const canSave = subjectOk && pairOk && marksOk;

  const saveHint = !subjectOk
    ? "Введите предмет"
    : !pairOk
    ? "Выберите номер пары"
    : !marksOk
    ? "Отметьте хотя бы одного студента"
    : "";

  const subjectSuggestions = useMemo(() => {
    const uniq = new Map<string, string>();
    for (const c of classes) {
      const norm = normalizeSubject(c.subject);
      if (!uniq.has(norm)) uniq.set(norm, c.subject);
    }
    return Array.from(uniq.values()).sort((a, b) => a.localeCompare(b, "ru"));
  }, [classes]);

  const filteredSuggestions = useMemo(() => {
    const q = normalizeSubject(subject);
    if (!q) return subjectSuggestions.slice(0, 6);
    return subjectSuggestions.filter((s) => normalizeSubject(s).includes(q)).slice(0, 6);
  }, [subject, subjectSuggestions]);

  /** История: тот же день недели, что у выбранной даты, только прошлые записи до этой даты. */
  const tapPairFromSubject = useMemo(() => {
    if (pairNumber !== null) return null;
    const q = normalizeSubject(subject);
    if (!q) return null;
    const wd = weekdayFromISO(dateISO);
    const freq = new Map<number, number>();
    for (const c of classes) {
      if (c.date >= dateISO) continue;
      if (weekdayFromISO(c.date) !== wd) continue;
      if (normalizeSubject(c.subject) !== q) continue;
      freq.set(c.pairNumber, (freq.get(c.pairNumber) ?? 0) + 1);
    }
    const sorted = Array.from(freq.entries()).sort((a, b) => b[1] - a[1] || a[0] - b[0]);
    if (sorted.length === 0) return null;
    const num = sorted[0][0];
    const p = pairSettings[num - 1];
    if (!p) return null;
    return { pairNumber: num, start: p.start, end: p.end };
  }, [classes, dateISO, subject, pairSettings, pairNumber]);

  const tapSubjectFromPair = useMemo(() => {
    if (pairNumber === null) return null;
    if (subject.trim().length > 0) return null;
    const wd = weekdayFromISO(dateISO);
    const freq = new Map<string, { label: string; n: number }>();
    for (const c of classes) {
      if (c.date >= dateISO) continue;
      if (weekdayFromISO(c.date) !== wd) continue;
      if (c.pairNumber !== pairNumber) continue;
      const k = c.subjectNormalized || normalizeSubject(c.subject);
      const prev = freq.get(k);
      if (!prev) freq.set(k, { label: c.subject, n: 1 });
      else freq.set(k, { label: prev.label, n: prev.n + 1 });
    }
    const sorted = Array.from(freq.entries()).sort((a, b) => b[1].n - a[1].n);
    if (sorted.length === 0) return null;
    return sorted[0][1].label;
  }, [classes, dateISO, pairNumber, subject]);

  function setStatus(studentId: string, next: Status | "unmarked") {
    setAttendance((prev) => {
      const copy = { ...prev };
      if (next === "unmarked") {
        delete copy[studentId];
        return copy;
      }
      copy[studentId] = next;
      return copy;
    });
  }

  function setOthersAbsent() {
    setAttendance((prev) => {
      const next: Record<string, Status> = { ...prev };
      for (const s of students) {
        if (!next[s.id]) next[s.id] = "absent";
      }
      return next;
    });
  }

  function setOthersPresent() {
    setAttendance((prev) => {
      const next: Record<string, Status> = { ...prev };
      for (const s of students) {
        if (!next[s.id]) next[s.id] = "present";
      }
      return next;
    });
  }

  function resetMarks() {
    setAttendance({});
  }

  function resetSessionSelection() {
    setDateISO(todayISO());
    setSubject("");
    setPairNumber(null);
    setSubjectFocused(false);
    setShowDatePicker(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  async function onSave() {
    const subj = subject.trim();
    if (!subj || !pairNumber || markedCount === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      // saveClass внутри себя уже вызывает maybeAutoBackup
      const result = await saveClass(
        { subject: subj, date: dateISO, pairNumber, attendance },
        { replaceIfExists: false }
      );

      if (!result.ok && result.reason === "duplicate") {
        const ok = await confirm({
          title: "Занятие уже существует",
          message: "Заменить существующее занятие?",
          cancelText: "Отмена",
          confirmText: "Заменить",
          variant: "primary",
        });

        if (!ok) return;

        const replaced = await saveClass(
          { subject: subj, date: dateISO, pairNumber, attendance },
          { replaceIfExists: true }
        );

        if (replaced.ok) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          toast("Сохранено ✓", { variant: "success" });
          setSubject("");
          setPairNumber(null);
          resetMarks();
          listRef.current?.scrollToOffset({ offset: 0, animated: true });
        }
        return;
      }

      if (result.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        toast("Сохранено ✓", { variant: "success" });
        setSubject("");
        setPairNumber(null);
        resetMarks();
        listRef.current?.scrollToOffset({ offset: 0, animated: true });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast(`Ошибка сохранения: ${msg}`, { variant: "danger" });
    }
  }

  const semesterForDate = useMemo(
    () => findSemesterForDate(dateISO, semesters),
    [dateISO, semesters]
  );

  const pairLabel = useMemo(() => {
    if (!pairNumber) return "Пара не выбрана";
    const p = pairSettings[pairNumber - 1];
    return p ? `Пара ${pairNumber} (${p.start}-${p.end})` : `Пара ${pairNumber}`;
  }, [pairNumber, pairSettings]);

  const subjectLabel = subject.trim().length ? subject.trim() : "Предмет не введён";

  if (!isReady) return null;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Pressable style={styles.sessionBar} onPress={() => setSessionOpen(true)}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sessionTitle} numberOfLines={1}>{subjectLabel}</Text>
            <Text style={styles.sessionSub} numberOfLines={1}>
              {formatRuDate(dateISO)} • {pairLabel}
              {semesterForDate && ` • ${semesterForDate.name}`}
            </Text>
          </View>
          <View style={styles.sessionIcon}>
            <Ionicons name="pencil-outline" size={20} color={colors.text} />
          </View>
        </Pressable>

        {students.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>Студентов нет. Добавьте их на вкладке “Студенты”.</Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={students}
            keyExtractor={(item) => item.id}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 160 }}
            renderItem={({ item, index }) => {
              const st = attendance[item.id];
              return (
                <View style={styles.studentCard}>
                  <View style={styles.studentHeader}>
                    <Text style={styles.studentNumber}>{index + 1}.</Text>
                    <Text style={styles.studentName}>{item.name}</Text>
                  </View>
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
        )}

        <View style={styles.bottomBar}>
          <Text style={styles.bottomInfo}>Отмечено: {markedCount}</Text>
          <View style={styles.bottomRow}>
            <Pressable
              style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
              onPress={onSave}
              disabled={!canSave}
            >
              <Ionicons name="save-outline" size={20} color={canSave ? colors.text : colors.muted} />
              <Text style={[styles.saveText, !canSave && styles.saveTextDisabled]}>Сохранить</Text>
            </Pressable>
            <Pressable style={styles.actionsBtn} onPress={() => setActionsOpen(true)}>
              <Ionicons name="menu-outline" size={20} color={colors.text} />
              <Text style={styles.actionsText}>Действия</Text>
            </Pressable>
          </View>
          {!!saveHint && <Text style={styles.saveHint}>{saveHint}</Text>}
          {!__DEV__ && Updates.isEnabled && (
            <Text style={styles.otaMicro}>Обновления OTA включены</Text>
          )}
        </View>

        <ActionSheet
          visible={actionsOpen}
          onClose={() => setActionsOpen(false)}
          title="Действия"
          actions={[
            { label: "✅ Остальные присутствуют", onPress: () => setOthersPresent() },
            { label: "❌ Остальные отсутствуют", onPress: () => setOthersAbsent() },
            { label: "🔄 Сбросить", variant: "danger", onPress: () => resetMarks() },
          ]}
        />

        <Modal visible={sessionOpen} transparent animationType="fade">
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Настройка занятия</Text>
                <Pressable onPress={() => setSessionOpen(false)} hitSlop={10}>
                  <Ionicons name="close" size={22} color={colors.text} />
                </Pressable>
              </View>

              <ScrollView contentContainerStyle={{ paddingBottom: 16 }} keyboardShouldPersistTaps="handled">
                <Text style={styles.sectionTitle}>Дата</Text>
                <View style={styles.row}>
                  <Pressable
                    style={styles.inputLike}
                    onPress={() => {
                      if (Platform.OS === "web") {
                        const current = dateISO;
                        const input = window.prompt(
                          "Введите дату в формате ГГГГ-ММ-ДД",
                          current || todayISO()
                        );
                        if (!input) return;
                        const trimmed = input.trim();
                        const isoPattern = /^\d{4}-\d{2}-\d{2}$/;
                        if (!isoPattern.test(trimmed)) {
                          alert("Неверный формат даты. Ожидается ГГГГ-ММ-ДД.");
                          return;
                        }
                        setDateISO(trimmed);
                        return;
                      }
                      setShowDatePicker(true);
                    }}
                    onPressIn={dismissSuggestions}
                  >
                    <Ionicons name="calendar-outline" size={18} color={colors.muted} />
                    <Text style={styles.inputLikeText}>{formatRuDate(dateISO)}</Text>
                  </Pressable>
                  <Pressable style={styles.smallBtn} onPress={() => setDateISO(todayISO())} onPressIn={dismissSuggestions}>
                    <Text style={styles.smallBtnText}>Сегодня</Text>
                  </Pressable>
                </View>
                <Text style={styles.weekdayHint}>{weekdayLabel(weekdayFromISO(dateISO))}</Text>

                {Platform.OS !== "web" && showDatePicker && (
                  <DateTimePicker
                    value={isoToDate(dateISO)}
                    mode="date"
                    maximumDate={new Date()}
                    onChange={(_, selected) => {
                      setShowDatePicker(false);
                      if (selected) setDateISO(toISODateLocal(selected));
                    }}
                  />
                )}

                <Text style={styles.sectionTitle}>Предмет</Text>
                <TextInput
                  value={subject}
                  onChangeText={setSubject}
                  onFocus={() => setSubjectFocused(true)}
                  onBlur={() => setTimeout(dismissSuggestions, 200)}
                  placeholder="Например: Математика"
                  placeholderTextColor={colors.muted}
                  style={styles.textInput}
                />
                {subjectFocused && filteredSuggestions.length > 0 && (
                  <View style={styles.suggestionsBox} {...suggestionsPanResponder.panHandlers}>
                    {filteredSuggestions.map((s) => (
                      <Pressable key={s} style={styles.suggestionItem} onPress={() => { setSubject(s); dismissSuggestions(); }}>
                        <Text style={styles.suggestionText}>{s}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
                {tapPairFromSubject && (
                  <Pressable
                    style={styles.tapHintRow}
                    onPress={() => {
                      setPairNumber(tapPairFromSubject.pairNumber);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                  >
                    <Ionicons name="time-outline" size={16} color={colors.accent} />
                    <Text style={styles.tapHintText}>
                      Пара {tapPairFromSubject.pairNumber} · {tapPairFromSubject.start}–{tapPairFromSubject.end}
                    </Text>
                  </Pressable>
                )}

                <Text style={styles.sectionTitle}>Пара</Text>
                <View style={styles.pairsWrap}>
                  {pairSettings.map((p, idx) => {
                    const num = idx + 1;
                    const selected = pairNumber === num;
                    return (
                      <Pressable
                        key={p.id}
                        style={[styles.pairChip, selected && styles.pairChipSelected]}
                        onPress={() => setPairNumber(num)}
                        onPressIn={dismissSuggestions}
                      >
                        <Text style={[styles.pairChipText, selected && styles.pairChipTextSelected]}>
                          {num} ({p.start}-{p.end})
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {tapSubjectFromPair && (
                  <Pressable
                    style={styles.tapHintRow}
                    onPress={() => {
                      setSubject(tapSubjectFromPair);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                  >
                    <Ionicons name="book-outline" size={16} color={colors.accent} />
                    <Text style={styles.tapHintText}>{tapSubjectFromPair}</Text>
                  </Pressable>
                )}

                <Pressable style={styles.sessionResetLink} onPress={resetSessionSelection}>
                  <Text style={styles.sessionResetLinkText}>Сбросить выбор</Text>
                </Pressable>

                <Pressable style={styles.modalDoneBtn} onPress={() => setSessionOpen(false)}>
                  <Text style={styles.modalDoneText}>Готово</Text>
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
  sessionBar: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#222",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  sessionTitle: { color: colors.text, fontSize: 15, fontWeight: "900" },
  sessionSub: { color: colors.muted, marginTop: 4 },
  otaMicro: { color: colors.muted, fontSize: 10, marginTop: 6, textAlign: "center", opacity: 0.45 },
  sessionIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#111",
    borderWidth: 1,
    borderColor: "#222",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyBox: { backgroundColor: colors.card, borderRadius: 14, padding: 14 },
  emptyText: { color: colors.muted, lineHeight: 20 },
  studentCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#222",
  },
  studentHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  studentNumber: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "600",
    minWidth: 24,
  },
  studentName: { color: colors.text, fontSize: 16, flex: 1 },
  statusRow: { flexDirection: "row", gap: 10 },
  statusBtn: {
    flex: 1,
    backgroundColor: "#111",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#222",
  },
  statusBtnText: { fontSize: 18 },
  bottomBar: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 16,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#222",
    padding: 12,
    gap: 10,
  },
  bottomInfo: { color: colors.muted, fontWeight: "800" },
  bottomRow: { flexDirection: "row", gap: 10 },
  saveBtn: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  saveText: { color: colors.text, fontWeight: "900" },
  saveBtnDisabled: { backgroundColor: "#111", borderWidth: 1, borderColor: "#222" },
  saveTextDisabled: { color: colors.muted },
  actionsBtn: {
    width: 120,
    backgroundColor: "#111",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    borderWidth: 1,
    borderColor: "#222",
  },
  actionsText: { color: colors.text, fontWeight: "900" },
  saveHint: { color: colors.muted, fontSize: 11, textAlign: "center" },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center", padding: 16 },
  modalCard: { width: "100%", maxWidth: 500, maxHeight: "85%", backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: "#222", padding: 16 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  modalTitle: { color: colors.text, fontSize: 16, fontWeight: "900" },
  sectionTitle: { color: colors.text, fontSize: 14, fontWeight: "800", marginTop: 12, marginBottom: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  inputLike: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#0f0f0f", borderRadius: 14, padding: 12, borderWidth: 1, borderColor: "#222" },
  inputLikeText: { color: colors.text, fontSize: 16 },
  smallBtn: { backgroundColor: "#111", borderRadius: 14, padding: 12, borderWidth: 1, borderColor: "#222" },
  smallBtnText: { color: colors.text, fontWeight: "800" },
  textInput: { backgroundColor: "#0f0f0f", borderRadius: 14, padding: 12, color: colors.text, borderWidth: 1, borderColor: "#222" },
  suggestionsBox: { marginTop: 8, backgroundColor: "#0b0b0b", borderRadius: 14, borderWidth: 1, borderColor: "#222" },
  suggestionItem: { padding: 12 },
  suggestionText: { color: colors.text },
  pairsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pairChip: { backgroundColor: "#111", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: "#222" },
  pairChipSelected: { borderColor: colors.accent },
  pairChipText: { color: colors.text, fontSize: 12 },
  pairChipTextSelected: { color: colors.accent, fontWeight: "900" },
  weekdayHint: { color: colors.muted, fontSize: 12, marginTop: 6, marginBottom: 4 },
  tapHintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#0b0b0b",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  tapHintText: { color: colors.text, fontSize: 14, fontWeight: "700", flex: 1 },
  sessionResetLink: { marginTop: 16, paddingVertical: 8, alignItems: "center" },
  sessionResetLinkText: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  modalDoneBtn: { marginTop: 10, backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  modalDoneText: { color: colors.text, fontWeight: "900" },
});