# Краткая сводка по OTA обновлениям

## ✅ Что уже настроено

- Expo Updates установлен и подключен
- Runtime version: привязан к версии приложения (1.0.2)
- Каналы: development, preview, production
- Автоматическая проверка при запуске
- Компонент UpdateChecker для уведомлений пользователя

## 📦 Что можно обновлять БЕЗ пересборки

### ✅ JavaScript/TypeScript код
- Все файлы в `app/`, `src/`, `components/`
- React компоненты и логика
- Стили и UI
- Тексты и строки
- Бизнес-логика

### ⚠️ Частично
- Изображения (если уже включены в билд)
- Шрифты (если уже включены в билд)

## ❌ Что НЕЛЬЗЯ обновлять через OTA

- Новые нативные зависимости
- Обновление Expo SDK
- Изменения в `app.json` (частично)
- Иконки и splash screen
- Новые permissions
- Изменения bundle identifier

## 🚀 Как опубликовать обновление

```bash
# Production
eas update --branch production --message "Описание изменений"

# Preview
eas update --branch preview --message "Описание изменений"
```

## 📱 Как это работает

1. Вы публикуете обновление через `eas update`
2. При следующем запуске приложение проверяет обновления
3. Если найдено - показывается диалог пользователю
4. После подтверждения приложение обновляется

## ⚙️ Настройки

- **checkAutomatically**: `ON_LOAD` - проверка при каждом запуске
- **fallbackToCacheTimeout**: `0` - мгновенный fallback на кеш при ошибке сети

## 🔍 Проверка обновлений вручную

Используйте хук `useUpdateChecker()` в любом компоненте:

```tsx
import { useUpdateChecker } from "@/src/components/UpdateChecker";

const { checkAndUpdate, isChecking } = useUpdateChecker();
```

## 📚 Подробная документация

См. [OTA_UPDATES.md](./OTA_UPDATES.md) для полной информации.

