import React from "react";
import { Modal, Pressable, StyleSheet, Text } from "react-native";
import { colors } from "../theme/colors";

export type ActionItem = {
  label: string;
  variant?: "default" | "danger";
  onPress: () => void;
};

type Props = {
  visible: boolean;
  title?: string;
  onClose: () => void;
  actions: ActionItem[];
};

export function ActionSheet({ visible, title = "Действия", onClose, actions }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.title}>{title}</Text>

          {actions.map((a, idx) => (
            <Pressable
              key={idx}
              style={styles.item}
              onPress={() => {
                onClose();
                a.onPress();
              }}
            >
              <Text style={[styles.itemText, a.variant === "danger" && { color: colors.danger }]}>
                {a.label}
              </Text>
            </Pressable>
          ))}

          <Pressable style={[styles.item, styles.cancel]} onPress={onClose}>
            <Text style={styles.cancelText}>Отмена</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "flex-end",
    padding: 12,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#222",
  },
  title: { color: colors.text, fontWeight: "900", fontSize: 16, marginBottom: 8 },

  item: {
    backgroundColor: "#111",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#222",
    marginTop: 8,
  },
  itemText: { color: colors.text, fontWeight: "800" },

  cancel: { backgroundColor: "#0b0b0b" },
  cancelText: { color: colors.text, fontWeight: "900", textAlign: "center" },
});