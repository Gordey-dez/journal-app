import React from "react";
import { Platform, View, useWindowDimensions } from "react-native";

const LAYOUT_BASE_W = 430;

/**
 * На мобильном web интерфейс RN часто выглядит «крупнее» визуально.
 * Лёгкое уменьшение масштаба на узких экранах помещает формы и списки.
 */
export function WebRootScale({ children }: { children: React.ReactNode }) {
  const { width, height } = useWindowDimensions();

  if (Platform.OS !== "web") {
    return <>{children}</>;
  }

  const scale =
    width < LAYOUT_BASE_W ? Math.max(0.78, Math.min(1, (width - 12) / LAYOUT_BASE_W)) : 1;

  if (scale >= 0.995) {
    return <>{children}</>;
  }

  const inv = 1 / scale;
  return (
    <View
      style={{
        flex: 1,
        width: width * inv,
        height: height * inv,
        transformOrigin: "top left",
        transform: [{ scale }],
      }}
    >
      {children}
    </View>
  );
}
