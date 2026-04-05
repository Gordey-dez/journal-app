import React, { createContext, useContext, useMemo, useState } from "react";

type UIContextValue = {
  attendanceDirty: boolean;
  setAttendanceDirty: (v: boolean) => void;
};

const UIContext = createContext<UIContextValue | null>(null);

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [attendanceDirty, setAttendanceDirty] = useState(false);

  const value = useMemo(
    () => ({ attendanceDirty, setAttendanceDirty }),
    [attendanceDirty]
  );

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

export function useUI(): UIContextValue {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error("useUI must be used inside UIProvider");
  return ctx;
}