import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { Link, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useUpdateChecker } from "../src/components/UpdateChecker";
import { colors } from "../src/theme/colors";

export default function AboutScreen() {
  const router = useRouter();
  const { checkAndUpdate, isChecking, canUpdate } = useUpdateChecker();
  const version = Constants.expoConfig?.version ?? "—";

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
            style={styles.backBtn}
            hitSlop={10}
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
            <Text style={styles.backText}>Назад</Text>
          </Pressable>
          <Text style={styles.title}>О приложении</Text>
          <View style={{ width: 70 }} />
        </View>

        <View style={styles.card}>
          <Text style={styles.appName}>Учёт посещаемости</Text>
          <Text style={styles.version}>Версия {version}</Text>
          <Text style={styles.cardText}>
            Журнал посещаемости студентов с бэкапами и обновлениями без переустановки.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Обновления</Text>
          <Text style={styles.cardText}>
            {canUpdate
              ? "Новые версии устанавливаются автоматически при запуске или по кнопке ниже."
              : "Доступны только в установленной сборке (не в браузере и не в Expo Go)."}
          </Text>
          <Pressable
            style={[styles.primaryBtn, (!canUpdate || isChecking) && { opacity: 0.6 }]}
            onPress={() => {
              if (canUpdate && !isChecking) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              checkAndUpdate();
            }}
            disabled={!canUpdate || isChecking}
          >
            <Ionicons name="cloud-download-outline" size={20} color={colors.text} />
            <Text style={styles.primaryBtnText}>
              {isChecking ? "Проверка…" : "Проверить обновления"}
            </Text>
          </Pressable>
        </View>

        <Link href="/backup" asChild>
          <Pressable
            style={styles.linkCard}
            onPressIn={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
          >
            <Ionicons name="save-outline" size={22} color={colors.text} />
            <Text style={styles.linkCardText}>Резервная копия и данные</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          </Pressable>
        </Link>
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
    marginBottom: 20,
  },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 4, width: 70 },
  backText: { color: colors.text, fontWeight: "800" },
  title: { color: colors.text, fontSize: 18, fontWeight: "900" },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#222",
    marginBottom: 12,
  },
  appName: { color: colors.text, fontSize: 18, fontWeight: "900", marginBottom: 4 },
  version: { color: colors.muted, fontSize: 14, marginBottom: 8 },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: "900", marginBottom: 8 },
  cardText: { color: colors.muted, lineHeight: 20 },
  primaryBtn: {
    marginTop: 14,
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryBtnText: { color: colors.text, fontWeight: "900" },
  linkCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#222",
  },
  linkCardText: { color: colors.text, fontSize: 16, fontWeight: "800", flex: 1 },
});
