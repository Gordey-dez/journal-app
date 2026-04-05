import * as FileSystemLegacy from "expo-file-system/legacy";
import { Platform } from "react-native";
import { STORAGE_KEYS } from "../storage/keys";
import { loadJSON, saveJSON } from "../storage/storage";

type Meta = {
  backupDirUri?: string | null;
  autoBackupEnabled?: boolean;
  autoBackupLastDay?: string;
  autoBackupLastStatus?: "ok" | "error";
  autoBackupLastError?: string;
  lastBackupAt?: string;
};

function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Автоматический бэкап при сохранении данных (один раз в день на Android)
 * Результат логируется в мета для отслеживания статуса
 */
export async function maybeAutoBackup(data: {
  students: any[];
  classes: any[];
  pairSettings: any[];
  semesters?: any[];
}): Promise<{ ok: boolean; reason?: string }> {
  // Автобэкап делаем только на Android в папку через SAF
  if (Platform.OS !== "android") return { ok: false, reason: "not_android" };

  const meta = await loadJSON<Meta>(STORAGE_KEYS.meta, {});
  const enabled = meta.autoBackupEnabled ?? false;
  if (!enabled) return { ok: false, reason: "disabled" };

  const dirUri = meta.backupDirUri ?? null;
  if (!dirUri) return { ok: false, reason: "no_folder" };

  const day = todayISO();
  // Если уже делали бэкап сегодня, пропускаем (не тратим время)
  if (meta.autoBackupLastDay === day) return { ok: false, reason: "already_done_today" };

  const backup = {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    students: data.students,
    classes: data.classes,
    pairSettings: data.pairSettings,
    semesters: data.semesters ?? [],
  };

  const json = JSON.stringify(backup, null, 2);
  const fileName = `backup_auto_${day}.json`;

  // ИСПОЛЬЗУЕМ ТОЛЬКО LEGACY ДЛЯ SAF
  const SAF = FileSystemLegacy.StorageAccessFramework;
  
  if (!SAF) return { ok: false, reason: "saf_unavailable" };

  try {
    const fileUri = await SAF.createFileAsync(dirUri, fileName, "application/json");
    
    // ВАЖНО: Используем writeAsStringAsync из LEGACY пакета
    await FileSystemLegacy.writeAsStringAsync(fileUri, json, { 
      encoding: FileSystemLegacy.EncodingType.UTF8 
    });

    // Сохраняем успех в мета
    await saveJSON(STORAGE_KEYS.meta, {
      ...meta,
      autoBackupLastDay: day,
      autoBackupLastStatus: "ok",
      autoBackupLastError: undefined,
      lastBackupAt: new Date().toISOString(),
    });

    console.log("[AutoBackup] Успешный бэкап:", fileName);
    return { ok: true };
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    console.warn("[AutoBackup] Ошибка при создании бэкапа:", errorMsg);
    
    // Сохраняем статус ошибки (но НЕ стираем dirUri - может быть временная ошибка)
    try {
      await saveJSON(STORAGE_KEYS.meta, { 
        ...meta, 
        autoBackupLastStatus: "error",
        autoBackupLastError: errorMsg,
      });
    } catch (e2) {
      console.warn("[AutoBackup] Не удалось записать статус ошибки:", e2);
    }
    
    return { ok: false, reason: "write_failed" };
  }
}