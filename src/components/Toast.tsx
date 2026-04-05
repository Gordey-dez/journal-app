import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme/colors";

export type ToastVariant = "default" | "success" | "danger";

type Props = {
  visible: boolean;
  message: string;
  variant: ToastVariant;
};

export function Toast({ visible, message, variant }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: visible ? 1 : 0,
        duration: 160,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: visible ? 0 : 12,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, opacity, translateY]);

  const bg =
    variant === "success" ? "#0b2a16" : variant === "danger" ? "#2a0b0b" : "#111";
  const border =
    variant === "success" ? "#14532d" : variant === "danger" ? "#7f1d1d" : "#222";
  const accent =
    variant === "success" ? colors.success : variant === "danger" ? colors.danger : colors.text;

  return (
    <View style={[styles.wrap, { pointerEvents: "none" }]}>
      <Animated.View
        style={[
          styles.card,
          { backgroundColor: bg, borderColor: border },
          { opacity, transform: [{ translateY }] },
        ]}
      >
        <View style={[styles.dot, { backgroundColor: accent }]} />
        <Text style={styles.text} numberOfLines={2}>
          {message}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 18,
    alignItems: "center",
    paddingHorizontal: 16,
  },
  card: {
    width: "100%",
    maxWidth: 520,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  text: { color: colors.text, fontWeight: "800", flex: 1 },
});