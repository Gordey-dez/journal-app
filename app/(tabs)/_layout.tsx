import { Ionicons } from "@expo/vector-icons";
import { Link, Tabs, useRouter } from "expo-router";
import { Pressable } from "react-native";

import { useOverlay } from "../../src/context/OverlayContext";
import { useUI } from "../../src/context/UIContext";
import { colors } from "../../src/theme/colors";

export default function TabsLayout() {
  const router = useRouter();
  const { attendanceDirty, setAttendanceDirty } = useUI();
  const { confirm } = useOverlay();

  async function confirmLeave(): Promise<boolean> {
    if (!attendanceDirty) return true;

    const ok = await confirm({
      title: "Есть несохранённые данные",
      message: "Выйти без сохранения?",
      cancelText: "Отмена",
      confirmText: "Выйти",
      variant: "danger",
    });

    if (ok) setAttendanceDirty(false);
    return ok;
  }

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,

        tabBarStyle: { backgroundColor: colors.bg, borderTopColor: "#111" },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        sceneContainerStyle: { backgroundColor: colors.bg },
      } as any}
    >
      <Tabs.Screen
        name="attendance"
        options={{
          title: "Учёт",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="create-outline" color={color} size={size} />
          ),
          headerRight: () => (
            <Pressable
              style={{ paddingHorizontal: 12, paddingVertical: 6 }}
              onPress={async () => {
                const ok = await confirmLeave();
                if (ok) router.push("/pair-settings");
              }}
            >
              <Ionicons name="settings-outline" size={22} color={colors.text} />
            </Pressable>
          ),
        }}
      />

      <Tabs.Screen
        name="students"
        options={{
          title: "Студенты",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" color={color} size={size} />
          ),
          headerRight: () => (
            <Link href="/backup" asChild>
              <Pressable style={{ paddingHorizontal: 12, paddingVertical: 6 }}>
                <Ionicons name="save-outline" size={22} color={colors.text} />
              </Pressable>
            </Link>
          ),
        }}
        listeners={({ navigation, route }) => ({
          tabPress: (e) => {
            const state = navigation.getState();
            const current = state.routes[state.index]?.name;

            if (current === "attendance" && attendanceDirty) {
              e.preventDefault();
              (async () => {
                const ok = await confirmLeave();
                if (ok) navigation.navigate(route.name);
              })();
            }
          },
        })}
      />

      <Tabs.Screen
        name="journal"
        options={{
          title: "Журнал",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="book-outline" color={color} size={size} />
          ),
        }}
        listeners={({ navigation, route }) => ({
          tabPress: (e) => {
            const state = navigation.getState();
            const current = state.routes[state.index]?.name;

            if (current === "attendance" && attendanceDirty) {
              e.preventDefault();
              (async () => {
                const ok = await confirmLeave();
                if (ok) navigation.navigate(route.name);
              })();
            }
          },
        })}
      />

      <Tabs.Screen
        name="stats"
        options={{
          title: "Статистика",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="stats-chart-outline" color={color} size={size} />
          ),
        }}
        listeners={({ navigation, route }) => ({
          tabPress: (e) => {
            const state = navigation.getState();
            const current = state.routes[state.index]?.name;

            if (current === "attendance" && attendanceDirty) {
              e.preventDefault();
              (async () => {
                const ok = await confirmLeave();
                if (ok) navigation.navigate(route.name);
              })();
            }
          },
        })}
      />
    </Tabs>
  );
}