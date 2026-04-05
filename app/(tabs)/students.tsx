import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useMemo, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { RefreshControlThemed } from "../../src/components/RefreshControlThemed";
import { useAppData } from "../../src/context/AppDataContext";
import { useOverlay } from "../../src/context/OverlayContext"; // Импорт оверлея
import { colors } from "../../src/theme/colors";

export default function StudentsTab() {
  const { isReady, students, addStudent, deleteStudent, updateStudentName, reloadAll } = useAppData();
  const { confirm, toast } = useOverlay();
  const [refreshing, setRefreshing] = useState(false);

  const total = students.length;
  const router = useRouter();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await reloadAll({ keepUi: true });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } finally {
      setRefreshing(false);
    }
  }, [reloadAll]);

  // Модалка (добавление/редактирование)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mode, setMode] = useState<"add" | "edit">("add");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");

  const sortedStudents = useMemo(() => {
    return [...students].sort((a, b) => a.name.localeCompare(b.name, "ru"));
  }, [students]);

  function openAddModal() {
    setMode("add");
    setEditingId(null);
    setName("");
    setIsModalOpen(true);
  }

  function openEditModal(studentId: string, currentName: string) {
    setMode("edit");
    setEditingId(studentId);
    setName(currentName);
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setName("");
    setEditingId(null);
    setMode("add");
  }

  async function onSubmit() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast("Введите имя", { variant: "danger" }); // Замена Alert на toast
      return;
    }

    if (mode === "add") {
      await addStudent(trimmed);
      closeModal();
      return;
    }

    if (mode === "edit" && editingId) {
      await updateStudentName(editingId, trimmed);
      closeModal();
      return;
    }
    closeModal();
  }

  // ОБНОВЛЕННАЯ ФУНКЦИЯ УДАЛЕНИЯ
  async function confirmDelete(studentId: string, studentName: string) {
    const ok = await confirm({
      title: "Удалить студента?",
      message: `Удалить студента ${studentName}? Это действие удалит все его отметки в журнале.`,
      cancelText: "Отмена",
      confirmText: "Удалить",
      variant: "danger",
    });

    if (ok) {
      await deleteStudent(studentId);
    }
  }

  if (!isReady) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <Text style={styles.title}>Студенты</Text>
          <Text style={styles.muted}>Загрузка...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Студенты</Text>
          <Text style={styles.counter}>Всего: {total}</Text>
        </View>

        <Pressable style={styles.primaryButton} onPress={openAddModal}>
          <Ionicons name="add" size={22} color={colors.text} />
          <Text style={styles.primaryButtonText}>Добавить студента</Text>
        </Pressable>

        {total === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>Добавьте студентов кнопкой “Добавить студента”</Text>
          </View>
        ) : (
          <FlatList
            style={{ backgroundColor: colors.bg }}
            data={sortedStudents}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControlThemed refreshing={refreshing} onRefresh={onRefresh} />
            }
            renderItem={({ item }) => (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <View style={styles.cardActions}>
                  <Pressable onPress={() => openEditModal(item.id, item.name)} style={styles.iconButton}>
                    <Ionicons name="pencil-outline" size={22} color={colors.text} />
                  </Pressable>
                  <Pressable onPress={() => confirmDelete(item.id, item.name)} style={styles.iconButton}>
                    <Ionicons name="trash-outline" size={22} color={colors.danger} />
                  </Pressable>
                  <Pressable onPress={() => router.push(`/student/${item.id}`)} style={styles.iconButton} hitSlop={10}>
                    <Ionicons name="stats-chart-outline" size={22} color={colors.text} />
                  </Pressable>
                </View>
              </View>
            )}
          />
        )}

        <Modal visible={isModalOpen} transparent animationType="fade">
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>
                {mode === "add" ? "ФИО студента" : "Редактировать студента"}
              </Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Имя студента"
                placeholderTextColor={colors.muted}
                style={styles.input}
                autoFocus
              />
              <View style={styles.modalButtonsRow}>
                <Pressable style={styles.secondaryButton} onPress={closeModal}>
                  <Text style={styles.secondaryButtonText}>Отмена</Text>
                </Pressable>
                <Pressable style={styles.primarySmallButton} onPress={onSubmit}>
                  <Text style={styles.primarySmallButtonText}>
                    {mode === "add" ? "Добавить" : "Сохранить"}
                  </Text>
                </Pressable>
              </View>
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
  headerRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 },
  title: { color: colors.text, fontSize: 22, fontWeight: "700" },
  counter: { color: colors.muted, fontSize: 14 },
  primaryButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.accent, paddingVertical: 14, borderRadius: 14, marginBottom: 14 },
  primaryButtonText: { color: colors.text, fontSize: 16, fontWeight: "700" },
  emptyBox: { backgroundColor: colors.card, borderRadius: 14, padding: 16 },
  emptyText: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  listContent: { paddingBottom: 24 },
  card: { backgroundColor: colors.card, borderRadius: 14, padding: 14, marginBottom: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardTitle: { color: colors.text, fontSize: 16, flex: 1, paddingRight: 12 },
  cardActions: { flexDirection: "row", gap: 10, alignItems: "center" },
  iconButton: { padding: 6 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.65)", alignItems: "center", justifyContent: "center", padding: 16 },
  modalCard: { width: "100%", maxWidth: 520, backgroundColor: colors.card, borderRadius: 16, padding: 16 },
  modalTitle: { color: colors.text, fontSize: 18, fontWeight: "700", marginBottom: 12 },
  input: { backgroundColor: "#0f0f0f", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, color: colors.text, borderWidth: 1, borderColor: "#222" },
  modalButtonsRow: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 14 },
  secondaryButton: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, backgroundColor: "#111", borderWidth: 1, borderColor: "#222" },
  secondaryButtonText: { color: colors.text, fontWeight: "600" },
  primarySmallButton: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, backgroundColor: colors.accent },
  primarySmallButtonText: { color: colors.text, fontWeight: "800" },
  muted: { color: colors.muted },
});