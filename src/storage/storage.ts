import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Читаем JSON из AsyncStorage.
 * Если ключа нет или произошла ошибка — возвращаем запасное значение (fallback).
 */
export async function loadJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch (e) {
    console.warn("loadJSON error:", key, e);
    return fallback;
  }
}

/**
 * Сохраняем значение как JSON в AsyncStorage.
 */
export async function saveJSON(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn("saveJSON error:", key, e);
    throw e;
  }
}

export async function removeKey(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch (e) {
    console.warn("removeKey error:", key, e);
    throw e;
  }
}