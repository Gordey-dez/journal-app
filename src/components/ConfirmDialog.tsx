import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme/colors";

type Props = {
  visible: boolean;
  title: string;
  message?: string;

  cancelText?: string;
  confirmText?: string;

  confirmVariant?: "primary" | "danger";

  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmDialog({
  visible,
  title,
  message,
  cancelText = "Отмена",
  confirmText = "ОК",
  confirmVariant = "primary",
  onCancel,
  onConfirm,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          {!!message && <Text style={styles.message}>{message}</Text>}

          <View style={styles.row}>
            <Pressable style={styles.btnSecondary} onPress={onCancel}>
              <Text style={styles.btnSecondaryText}>{cancelText}</Text>
            </Pressable>

            <Pressable
              style={[
                styles.btnPrimary,
                confirmVariant === "danger" && { backgroundColor: colors.danger },
              ]}
              onPress={onConfirm}
            >
              <Text style={styles.btnPrimaryText}>{confirmText}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  card: {
    width: "100%",
    maxWidth: 520,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#222",
  },
  title: { color: colors.text, fontSize: 18, fontWeight: "900" },
  message: { color: colors.muted, marginTop: 10, lineHeight: 20 },

  row: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 14 },

  btnSecondary: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#111",
    borderWidth: 1,
    borderColor: "#222",
  },
  btnSecondaryText: { color: colors.text, fontWeight: "700" },

  btnPrimary: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: colors.accent,
  },
  btnPrimaryText: { color: colors.text, fontWeight: "900" },
});