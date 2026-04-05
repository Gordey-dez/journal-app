import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { ActionSheet } from "./ActionSheet";
import { getCurrentSemester, Semester } from "../utils/semesters";
import { colors } from "../theme/colors";

type Props = {
  semesters: Semester[];
  activeId: "current" | "all" | string;
  onSelect: (id: "current" | "all" | string) => void;
  compact?: boolean;
};

export function SemesterSelector({
  semesters,
  activeId,
  onSelect,
  compact,
}: Props) {
  const [open, setOpen] = React.useState(false);

  const label = React.useMemo(() => {
    if (activeId === "all") return "Все семестры";
    if (activeId === "current") {
      const cur = getCurrentSemester(semesters);
      return cur ? cur.name : "Текущий";
    }
    const s = semesters.find((x) => x.id === activeId);
    return s?.name ?? "Семестр";
  }, [activeId, semesters]);

  const actions = [
    { label: "Текущий", onPress: () => onSelect("current") },
    { label: "Все семестры", onPress: () => onSelect("all") },
    ...semesters
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((s) => ({
        label: s.isArchived ? `📦 ${s.name}` : s.name,
        onPress: () => onSelect(s.id),
      })),
  ];

  return (
    <>
      <Pressable
        style={[styles.chip, compact && styles.chipCompact]}
        onPress={() => setOpen(true)}
      >
        <Ionicons name="school-outline" size={14} color={colors.muted} />
        <Text style={styles.chipText} numberOfLines={1}>
          {label}
        </Text>
        <Ionicons name="chevron-down" size={14} color={colors.muted} />
      </Pressable>
      <ActionSheet
        visible={open}
        onClose={() => setOpen(false)}
        title="Семестр"
        actions={actions}
      />
    </>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#111",
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#222",
  },
  chipCompact: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  chipText: {
    color: colors.text,
    fontWeight: "800",
    fontSize: 12,
    maxWidth: 140,
  },
});
