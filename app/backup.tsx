import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import Constants from "expo-constants";
import * as DocumentPicker from "expo-document-picker";
// Используем только Legacy для корректной работы с SAF на Android
import * as FileSystemLegacy from "expo-file-system/legacy";
import { Link, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import * as Sharing from "expo-sharing";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAppData } from "../src/context/AppDataContext";
import { useUpdateChecker } from "../src/components/UpdateChecker";
import { useOverlay } from "../src/context/OverlayContext";
import { STORAGE_KEYS } from "../src/storage/keys";
import { loadJSON, saveJSON } from "../src/storage/storage";
import { colors } from "../src/theme/colors";
import { normalizeSubject } from "../src/utils/normalize";

type Meta = {
  lastBackupAt?: string;
  backupDirUri?: string | null;
  autoBackupEnabled?: boolean;
  autoBackupLastDay?: string;
  autoBackupLastStatus?: "ok" | "error";
  autoBackupLastError?: string;
};

type BackupFile = {
  schemaVersion: 1;
  exportedAt: string;
  students: any[];
  classes: any[];
  pairSettings: any[];
  semesters?: any[];
};

type SAFType = {
  requestDirectoryPermissionsAsync: (uri?: string) => Promise<{ granted: boolean; directoryUri?: string }>;
  createFileAsync: (dirUri: string, fileName: string, mimeType: string) => Promise<string>;
};

function getSAF(): SAFType | null {
  const SAF = FileSystemLegacy.StorageAccessFramework;
  return SAF || null;
}

function makeFileName() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `backup_${stamp}.json`;
}

function safeParseJSON(text: string): any | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export default function BackupScreen() {
  const router = useRouter();
  const { confirm, toast } = useOverlay();
  const { checkAndUpdate, isChecking, canUpdate } = useUpdateChecker();
  const { isReady, students, classes, pairSettings, semesters, reloadAll, resetAllData } = useAppData();

  const [meta, setMeta] = useState<Meta>({});
  const [pasteJSON, setPasteJSON] = useState("");

  // Загрузить мета при монтировании
  useEffect(() => {
    (async () => {
      const m = await loadJSON<Meta>(STORAGE_KEYS.meta, {});
      setMeta(m);
    })();
  }, []);

  // Обновить мета при фокусе экрана (чтобы видеть свежий статус автобэкапа)
  useFocusEffect(
    useCallback(() => {
      (async () => {
        const m = await loadJSON<Meta>(STORAGE_KEYS.meta, {});
        setMeta(m);
      })();
    }, [])
  );

  const backupObject: BackupFile = useMemo(
    () => ({
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      students,
      classes,
      pairSettings,
      semesters,
    }),
    [students, classes, pairSettings, semesters]
  );

  async function updateMeta(patch: Partial<Meta>) {
    const next = { ...meta, ...patch };
    setMeta(next);
    await saveJSON(STORAGE_KEYS.meta, next);
  }

  function lastBackupText() {
    if (!meta.lastBackupAt) return "никогда";
    return meta.lastBackupAt.replace("T", " ").slice(0, 19);
  }

  function backupAgeDays(): number | null {
    if (!meta.lastBackupAt) return null;
    const then = new Date(meta.lastBackupAt).getTime();
    const now = Date.now();
    return Math.floor((now - then) / (24 * 60 * 60 * 1000));
  }

  const backupDays = backupAgeDays();
  const showBackupReminder = backupDays === null || backupDays > 7;

  async function applyBackupObject(obj: any) {
    if (!obj || typeof obj !== "object") {
      Alert.alert("Ошибка", "Некорректный JSON");
      return;
    }

    const studentsArr = Array.isArray(obj.students) ? obj.students : null;
    const classesArr = Array.isArray(obj.classes) ? obj.classes : null;
    const pairsArr = Array.isArray(obj.pairSettings) ? obj.pairSettings : null;
    const semestersArr = Array.isArray(obj.semesters) ? obj.semesters : null;

    if (!studentsArr || !classesArr || !pairsArr) {
      Alert.alert("Ошибка", "Некорректный файл (нет students/classes/pairSettings)");
      return;
    }

    const fixedClasses = classesArr.map((c: any) => {
      if (c && typeof c === "object") {
        if (!c.subjectNormalized && typeof c.subject === "string") {
          return { ...c, subjectNormalized: normalizeSubject(c.subject) };
        }
      }
      return c;
    });

    const ok = await confirm({
      title: "Восстановление",
      message: "Текущие данные будут заменены. Продолжить?",
      cancelText: "Отмена",
      confirmText: "Восстановить",
      variant: "danger",
    });
    if (!ok) return;

    try {
      await saveJSON(STORAGE_KEYS.students, studentsArr);
      await saveJSON(STORAGE_KEYS.classes, fixedClasses);
      await saveJSON(STORAGE_KEYS.pairSettings, pairsArr);
      if (semestersArr && semestersArr.length > 0) {
        await saveJSON(STORAGE_KEYS.semesters, semestersArr);
      }
      await reloadAll({ keepUi: true });
      toast("Данные восстановлены ✓", { variant: "success" });
      router.back();
    } catch (e: any) {
      Alert.alert("Ошибка", String(e?.message ?? e));
    }
  }

  async function sendBackup() {
    try {
      const json = JSON.stringify(backupObject, null, 2);
      const fileName = makeFileName();

      if (Platform.OS === "web") {
        const blob = new Blob([json], { type: "application/json;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
        await updateMeta({ lastBackupAt: new Date().toISOString() });
        return;
      }

      const baseDir = FileSystemLegacy.cacheDirectory ?? FileSystemLegacy.documentDirectory;
      if (!baseDir) throw new Error("Нет доступной папки");

      const uri = baseDir + fileName;
      await FileSystemLegacy.writeAsStringAsync(uri, json, { 
        encoding: FileSystemLegacy.EncodingType.UTF8 
      });

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert("Готово", `Файл создан: ${fileName}`);
        await updateMeta({ lastBackupAt: new Date().toISOString() });
        return;
      }

      await Sharing.shareAsync(uri);
      await updateMeta({ lastBackupAt: new Date().toISOString() });
    } catch (e: any) {
      Alert.alert("Ошибка", String(e?.message ?? e));
    }
  }

  async function saveBackupToDevice() {
    try {
      const json = JSON.stringify(backupObject, null, 2);
      const fileName = makeFileName();

      if (Platform.OS === "web" || Platform.OS === "ios") {
        await sendBackup();
        return;
      }

      const SAF = getSAF();
      if (!SAF) {
        Alert.alert("Ошибка", "SAF недоступен. Используйте 'Отправить файл'.");
        await sendBackup();
        return;
      }

      let dirUri = meta.backupDirUri ?? null;

      if (!dirUri) {
        const perm = await SAF.requestDirectoryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert("Отмена", "Папка не выбрана");
          return;
        }
        dirUri = perm.directoryUri ?? null;
        await updateMeta({ backupDirUri: dirUri });
      }

      if (!dirUri) {
        Alert.alert("Ошибка", "Папка не выбрана.");
        return;
      }

      const fileUri = await SAF.createFileAsync(dirUri, fileName, "application/json");
      
      // ИСПОЛЬЗУЕМ LEGACY API ДЛЯ ЗАПИСИ
      await FileSystemLegacy.writeAsStringAsync(fileUri, json, { 
        encoding: FileSystemLegacy.EncodingType.UTF8 
      });

      await updateMeta({ lastBackupAt: new Date().toISOString() });
      Alert.alert("Готово", "Файл сохранён в выбранную папку ✓");
    } catch (e: any) {
      const errMsg = String(e?.message ?? e);
      console.log("saveBackupToDevice error:", e);
      await updateMeta({ backupDirUri: null });
      Alert.alert(
        "Ошибка доступа к папке",
        `${errMsg}\n\nПопробуйте выбрать другую папку (например, «Документы»).`,
        [
          { text: "Понятно", style: "cancel" },
          { text: "Выбрать заново", onPress: () => chooseBackupFolderAgain() },
        ]
      );
    }
  }

  async function chooseBackupFolderAgain() {
    if (Platform.OS !== "android") return;
    const SAF = getSAF();
    if (!SAF) return;

    const perm = await SAF.requestDirectoryPermissionsAsync();
    if (!perm.granted) return;

    await updateMeta({ backupDirUri: perm.directoryUri });
    Alert.alert("Готово", "Папка обновлена ✓");
  }

  async function restoreFromFile() {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: "application/json",
        copyToCacheDirectory: Platform.OS !== "web",
        multiple: false,
      });
      if (res.canceled) return;

      const asset = res.assets?.[0];
      if (!asset) return;

      let text: string;
      if (Platform.OS === "web" && asset.file) {
        text = await asset.file.text();
      } else if (asset.uri) {
        text = await FileSystemLegacy.readAsStringAsync(asset.uri, {
          encoding: FileSystemLegacy.EncodingType.UTF8,
        });
      } else {
        throw new Error("Не удалось прочитать файл");
      }

      const obj = safeParseJSON(text);
      if (!obj) {
        Alert.alert("Ошибка", "Файл не является корректным JSON");
        return;
      }

      await applyBackupObject(obj);
    } catch (e: any) {
      Alert.alert("Ошибка", String(e?.message ?? e));
    }
  }

  async function restoreFromPaste() {
    const obj = safeParseJSON(pasteJSON);
    if (!obj) {
      Alert.alert("Ошибка", "Вставленный текст не является корректным JSON");
      return;
    }
    await applyBackupObject(obj);
  }

  async function handleResetAllData() {
    const ok1 = await confirm({
      title: "⚠️ Сброс всех данных",
      message: "Все данные будут удалены. Продолжить?",
      cancelText: "Отмена",
      confirmText: "Да, сбросить",
      variant: "danger",
    });
    if (!ok1) return;

    try {
      await resetAllData();
      await reloadAll({ keepUi: true });
      Alert.alert("Готово", "Все данные сброшены");
      router.back();
    } catch (e: any) {
      Alert.alert("Ошибка", String(e?.message ?? e));
    }
  }

  if (!isReady) return null;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
            <Text style={styles.backText}>Назад</Text>
          </Pressable>
          <Text style={styles.title}>Резервная копия</Text>
          <View style={{ width: 70 }} />
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Экспорт JSON</Text>
            <Text style={styles.cardText}>
              Последняя копия: <Text style={{ color: colors.text }}>{lastBackupText()}</Text>
            </Text>
            {showBackupReminder && (
              <Text style={styles.backupReminder}>
                {backupDays === null
                  ? "Рекомендуем сделать бэкап"
                  : `Последний бэкап был ${backupDays} дн. назад`}
              </Text>
            )}
            
            {/* Информация об автобэкапе */}
            <View style={styles.autoBackupInfo}>
              <Text style={styles.cardText}>Автобэкап: {meta.autoBackupEnabled ? "✅ Включён" : "⏸ Выключен"}</Text>
              {meta.autoBackupLastDay && (
                <Text style={styles.cardText}>
                  Последний автобэкап: {meta.autoBackupLastDay}
                </Text>
              )}
              {meta.autoBackupLastStatus === "ok" && (
                <Text style={{ ...styles.cardText, color: colors.success ?? "#4CAF50" }}>✓ Успешен</Text>
              )}
              {meta.autoBackupLastStatus === "error" && (
                <Text style={{ ...styles.cardText, color: colors.danger ?? "#FF5252" }}>
                  ✗ Ошибка {meta.autoBackupLastError ? `(${meta.autoBackupLastError})` : ""}
                </Text>
              )}
            </View>

            <Pressable
              style={styles.primaryBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                saveBackupToDevice();
              }}
            >
              <Ionicons name="download-outline" size={20} color={colors.text} />
              <Text style={styles.primaryText}>Сохранить на устройство</Text>
            </Pressable>

            <Pressable style={styles.secondaryBtn} onPress={sendBackup}>
              <Ionicons name="share-outline" size={20} color={colors.text} />
              <Text style={styles.secondaryText}>Отправить файл</Text>
            </Pressable>
            
            {/* Остальные кнопки без изменений */}
            <Pressable
              style={styles.secondaryBtn}
              onPress={async () => {
                const next = !(meta.autoBackupEnabled ?? false);
                await updateMeta({ autoBackupEnabled: next });
                Alert.alert("Готово", next ? "Автобэкап включён" : "Автобэкап выключен");
              }}
            >
              <Ionicons name="sync-outline" size={20} color={colors.text} />
              <Text style={styles.secondaryText}>
                Автобэкап: {(meta.autoBackupEnabled ?? false) ? "Включён" : "Выключен"}
              </Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Импорт</Text>
            <TextInput
              value={pasteJSON}
              onChangeText={setPasteJSON}
              placeholder="Вставь JSON текст сюда..."
              placeholderTextColor={colors.muted}
              style={styles.textArea}
              multiline
            />
            <Pressable style={styles.dangerBtn} onPress={restoreFromPaste}>
              <Ionicons name="refresh-outline" size={20} color={colors.text} />
              <Text style={styles.dangerText}>Восстановить из текста</Text>
            </Pressable>
            <Pressable style={styles.secondaryBtn} onPress={restoreFromFile}>
              <Ionicons name="folder-open-outline" size={20} color={colors.text} />
              <Text style={styles.secondaryText}>Выбрать JSON файл</Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Обновление приложения</Text>
            <Text style={styles.versionText}>
              Версия {Constants.expoConfig?.version ?? "—"}
            </Text>
            <Text style={styles.cardText}>
              {canUpdate
                ? "Обновления загружаются с сервера. Нажмите кнопку, чтобы проверить и установить новую версию (без переустановки из магазина)."
                : "Доступно только в установленной сборке приложения (не в браузере и не в Expo Go)."}
            </Text>
            <Pressable
              style={[styles.secondaryBtn, (!canUpdate || isChecking) && { opacity: 0.6 }]}
              onPress={() => {
                if (canUpdate && !isChecking) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                checkAndUpdate();
              }}
              disabled={!canUpdate || isChecking}
            >
              <Ionicons name="cloud-download-outline" size={20} color={colors.text} />
              <Text style={styles.secondaryText}>
                {isChecking ? "Проверка…" : "Проверить обновления"}
              </Text>
            </Pressable>
            <Link href="/about" asChild>
              <Pressable
                style={styles.aboutLink}
                onPressIn={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
              >
                <Ionicons name="information-circle-outline" size={18} color={colors.muted} />
                <Text style={styles.aboutLinkText}>О приложении</Text>
              </Pressable>
            </Link>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Сброс данных</Text>
            <Pressable style={styles.resetAllBtn} onPress={handleResetAllData}>
              <Ionicons name="trash-outline" size={20} color="#fff" />
              <Text style={styles.resetAllText}>Сбросить всё</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, backgroundColor: colors.bg, padding: 16 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 4, width: 70 },
  backText: { color: colors.text, fontWeight: "800" },
  title: { color: colors.text, fontSize: 18, fontWeight: "900" },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#222", marginBottom: 12 },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: "900" },
  versionText: { color: colors.muted, fontSize: 13, marginTop: 4 },
  cardText: { color: colors.muted, marginTop: 8, lineHeight: 20 },
  backupReminder: { color: colors.accent, fontSize: 12, marginTop: 6 },
  autoBackupInfo: { marginTop: 12, padding: 10, backgroundColor: "#111", borderRadius: 12, borderWidth: 1, borderColor: "#222" },
  aboutLink: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12 },
  aboutLinkText: { color: colors.muted, fontSize: 14 },
  primaryBtn: { marginTop: 12, backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 14, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  primaryText: { color: colors.text, fontWeight: "900" },
  secondaryBtn: { marginTop: 10, backgroundColor: "#111", borderRadius: 14, paddingVertical: 12, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, borderWidth: 1, borderColor: "#222" },
  secondaryText: { color: colors.text, fontWeight: "900" },
  dangerBtn: { marginTop: 10, backgroundColor: "#111", borderRadius: 14, paddingVertical: 12, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, borderWidth: 1, borderColor: "#222" },
  dangerText: { color: colors.text, fontWeight: "900" },
  textArea: { marginTop: 10, backgroundColor: "#0f0f0f", borderRadius: 14, padding: 12, color: colors.text, borderWidth: 1, borderColor: "#222", minHeight: 120, textAlignVertical: "top" },
  resetAllBtn: { marginTop: 12, backgroundColor: colors.danger, borderRadius: 14, paddingVertical: 14, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, borderWidth: 1, borderColor: "#7f1d1d" },
  resetAllText: { color: "#fff", fontWeight: "900" },
});