import * as Updates from "expo-updates";
import { useCallback, useEffect, useRef, useState } from "react";
import { useOverlay } from "../context/OverlayContext";

/**
 * Компонент для проверки и применения OTA обновлений
 * 
 * Работает только в production builds (не в Expo Go и не в development)
 */
export function UpdateChecker() {
  const { confirm, showUpdateOverlay } = useOverlay();
  const checkingRef = useRef(false);

  const checkForUpdates = useCallback(async () => {
    if (__DEV__ || !Updates.isEnabled) return;
    if (checkingRef.current) return;
    try {
      checkingRef.current = true;
      const update = await Updates.checkForUpdateAsync();

      if (update.isAvailable) {
        const shouldUpdate = await confirm({
          title: "Доступно обновление",
          message: "Найдена новая версия приложения. Обновить сейчас?",
          cancelText: "Позже",
          confirmText: "Обновить",
          variant: "primary",
        });

        if (shouldUpdate) {
          showUpdateOverlay("Загрузка обновления...", "downloading");
          await Updates.fetchUpdateAsync();
          showUpdateOverlay("Готово! Перезапуск приложения.", "restarting");
          await new Promise((r) => setTimeout(r, 1200));
          await Updates.reloadAsync();
        }
      }
    } catch (error) {
      console.warn("Update check failed:", error);
    } finally {
      checkingRef.current = false;
    }
  }, [confirm, showUpdateOverlay]);

  useEffect(() => {
    void checkForUpdates();
  }, [checkForUpdates]);

  return null;
}

/**
 * Хук для ручной проверки обновлений
 * Можно использовать в настройках приложения
 */
export function useUpdateChecker() {
  const { toast, confirm, showUpdateOverlay, hideUpdateOverlay } = useOverlay();
  const [isChecking, setIsChecking] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const checkAndUpdate = async () => {
    if (__DEV__) {
      toast("Обновления недоступны в режиме разработки", { variant: "default" });
      return;
    }

    if (!Updates.isEnabled) {
      toast("OTA обновления отключены", { variant: "default" });
      return;
    }

    try {
      setIsChecking(true);
      toast("Проверка обновлений...", { variant: "default" });

      const update = await Updates.checkForUpdateAsync();

      if (!update.isAvailable) {
        toast("У вас установлена последняя версия", { variant: "success" });
        return;
      }

      const shouldUpdate = await confirm({
        title: "Найдено обновление",
        message: "Доступна новая версия приложения. Загрузить и установить?",
        cancelText: "Отмена",
        confirmText: "Обновить",
        variant: "primary",
      });

      if (!shouldUpdate) return;

      setIsUpdating(true);
      showUpdateOverlay("Загрузка обновления...", "downloading");

      await Updates.fetchUpdateAsync();

      showUpdateOverlay("Готово! Перезапуск приложения.", "restarting");
      await new Promise((r) => setTimeout(r, 1200));
      await Updates.reloadAsync();
    } catch (error) {
      hideUpdateOverlay();
      const message = error instanceof Error ? error.message : "Ошибка обновления";
      toast(`Не удалось обновить: ${message}`, { variant: "danger" });
    } finally {
      setIsChecking(false);
      setIsUpdating(false);
    }
  };

  return {
    checkAndUpdate,
    isChecking,
    isUpdating,
    canUpdate: !__DEV__ && Updates.isEnabled,
  };
}

