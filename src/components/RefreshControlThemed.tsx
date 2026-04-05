import React from "react";
import { RefreshControl, RefreshControlProps } from "react-native";

import { colors } from "../theme/colors";

type Props = Omit<RefreshControlProps, "tintColor" | "colors" | "progressBackgroundColor">;

/**
 * Единый тёмный фон индикатора при pull-to-refresh (Android + iOS).
 */
export function RefreshControlThemed(props: Props) {
  return (
    <RefreshControl
      {...props}
      tintColor={colors.muted}
      colors={[colors.muted]}
      progressBackgroundColor={colors.bg}
    />
  );
}
