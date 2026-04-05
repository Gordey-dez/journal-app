import React, { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  type TextStyle,
  View,
  type ViewStyle,
  useWindowDimensions,
} from "react-native";

import { colors } from "../theme/colors";

type Props = {
  value: Date;
  mode: "date";
  onChange: (event: unknown, date?: Date) => void;
  maximumDate?: Date;
  minimumDate?: Date;
};

function toInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fromInputValue(s: string): Date | undefined {
  const [y, m, d] = s.split("-").map((x) => parseInt(x, 10));
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

/**
 * На web пакет @react-native-community/datetimepicker рендерит null.
 * Используем нативный <input type="date"> в модальном окне.
 */
export default function PlatformDatePicker({
  value,
  mode: _mode,
  onChange,
  maximumDate,
  minimumDate,
}: Props) {
  const { width: winW, height: winH } = useWindowDimensions();
  const [draft, setDraft] = useState(() => toInputValue(value));

  useEffect(() => {
    setDraft(toInputValue(value));
  }, [value]);

  const cancel = () => onChange({}, undefined);

  const confirm = () => {
    const d = fromInputValue(draft);
    if (!d) {
      cancel();
      return;
    }
    if (minimumDate && d < stripTime(minimumDate)) {
      cancel();
      return;
    }
    if (maximumDate && d > stripTime(maximumDate)) {
      cancel();
      return;
    }
    onChange({}, d);
  };

  const input = React.createElement("input", {
    type: "date",
    value: draft,
    min: minimumDate ? toInputValue(minimumDate) : undefined,
    max: maximumDate ? toInputValue(maximumDate) : undefined,
    onChange: (e: { target: { value: string } }) => setDraft(e.target.value),
    style: {
      width: "100%",
      maxWidth: Math.min(320, winW - 48),
      padding: "12px 14px",
      fontSize: 16,
      borderRadius: 10,
      border: "1px solid #333",
      backgroundColor: "#0f0f0f",
      color: colors.text,
      boxSizing: "border-box" as const,
    },
  });

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={cancel}
      statusBarTranslucent
    >
      <View
        style={[viewStyles.wrap, { minHeight: winH, minWidth: winW }]}
      >
        <Pressable style={viewStyles.backdrop} onPress={cancel} />
        <View style={[viewStyles.card, { maxWidth: Math.min(360, winW - 24) }]}>
          <Text style={textStyles.title}>Выберите дату</Text>
          <View style={viewStyles.inputWrap}>{input}</View>
          <View style={viewStyles.actions}>
            <Pressable style={viewStyles.btnGhost} onPress={cancel}>
              <Text style={textStyles.btnGhostText}>Отмена</Text>
            </Pressable>
            <Pressable style={viewStyles.btnPrimary} onPress={confirm}>
              <Text style={textStyles.btnPrimaryText}>Готово</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function stripTime(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

const viewStyles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  } satisfies ViewStyle,
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  } satisfies ViewStyle,
  card: {
    zIndex: 2,
    width: "88%",
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#2a2a2a",
  } satisfies ViewStyle,
  inputWrap: {
    alignItems: "center",
    marginBottom: 18,
  } satisfies ViewStyle,
  actions: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  } satisfies ViewStyle,
  btnGhost: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "#1a1a1a",
    borderWidth: 1,
    borderColor: "#333",
  } satisfies ViewStyle,
  btnPrimary: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: colors.accent,
  } satisfies ViewStyle,
});

const textStyles = StyleSheet.create({
  title: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 14,
    textAlign: "center",
  } satisfies TextStyle,
  btnGhostText: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 15,
  } satisfies TextStyle,
  btnPrimaryText: {
    color: colors.text,
    fontWeight: "800",
    fontSize: 15,
  } satisfies TextStyle,
});
