import { Stack } from "expo-router";
import { UpdateChecker } from "../src/components/UpdateChecker";
import { AppDataProvider } from "../src/context/AppDataContext";
import { OverlayProvider } from "../src/context/OverlayContext";
import { UIProvider } from "../src/context/UIContext";
import { colors } from "../src/theme/colors";

export default function RootLayout() {
  return (
    <AppDataProvider>
      <UIProvider>
        <OverlayProvider>
          <UpdateChecker />
          <Stack
            screenOptions={{
              headerShown: false,
              animation: "fade",
              // Устанавливает фон для всех экранов в стеке на уровне навигатора
              // Это убирает белые вспышки при переходе между страницами
              contentStyle: { backgroundColor: colors.bg },
            }}
          />
        </OverlayProvider>
      </UIProvider>
    </AppDataProvider>
  );
}