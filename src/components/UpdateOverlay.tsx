import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme/colors";

export type UpdateOverlayPhase = "downloading" | "restarting";

type Props = {
  visible: boolean;
  message: string;
  phase: UpdateOverlayPhase;
};

export function UpdateOverlay({ visible, message, phase }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;
  const spinValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: visible ? 1 : 0,
        duration: 280,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: visible ? 1 : 0.9,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, opacity, scale]);

  useEffect(() => {
    if (!visible || phase !== "downloading") return;
    const loop = Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [visible, phase, spinValue]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  if (!visible) return null;

  return (
    <Animated.View style={[styles.backdrop, { opacity }]} pointerEvents="auto">
      <Animated.View style={[styles.card, { opacity, transform: [{ scale }] }]}>
        <View style={styles.iconWrap}>
          {phase === "downloading" ? (
            <Animated.View style={{ transform: [{ rotate: spin }] }}>
              <Ionicons name="sync" size={40} color={colors.accent} />
            </Animated.View>
          ) : (
            <Ionicons name="checkmark-circle" size={40} color={colors.success} />
          )}
        </View>
        <Text style={styles.message}>{message}</Text>
        <Text style={styles.hint}>
          {phase === "downloading"
            ? "Подождите несколько секунд"
            : "Приложение перезапустится"}
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },
  card: {
    width: "85%",
    maxWidth: 320,
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#222",
    padding: 28,
    alignItems: "center",
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  message: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "800",
    textAlign: "center",
  },
  hint: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 8,
  },
});
