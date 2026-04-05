import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { View } from "react-native";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Toast, ToastVariant } from "../components/Toast";
import { UpdateOverlay, UpdateOverlayPhase } from "../components/UpdateOverlay";
import { colors } from "../theme/colors";

type ConfirmOptions = {
  title: string;
  message?: string;
  cancelText?: string;
  confirmText?: string;
  variant?: "primary" | "danger";
};

type ToastOptions = {
  variant?: ToastVariant;
  durationMs?: number;
};

type OverlayContextValue = {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  toast: (message: string, opts?: ToastOptions) => void;
  showUpdateOverlay: (message: string, phase: UpdateOverlayPhase) => void;
  hideUpdateOverlay: () => void;
};

const OverlayContext = createContext<OverlayContextValue | null>(null);

export function OverlayProvider({ children }: { children: React.ReactNode }) {
  // confirm state
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmOpts, setConfirmOpts] = useState<ConfirmOptions>({ title: "" });
  const confirmResolveRef = useRef<((v: boolean) => void) | null>(null);

  // toast state
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastVariant, setToastVariant] = useState<ToastVariant>("default");
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // update overlay (OTA)
  const [updateOverlayVisible, setUpdateOverlayVisible] = useState(false);
  const [updateOverlayMessage, setUpdateOverlayMessage] = useState("");
  const [updateOverlayPhase, setUpdateOverlayPhase] = useState<UpdateOverlayPhase>("downloading");

  const showUpdateOverlay = useCallback((message: string, phase: UpdateOverlayPhase) => {
    setUpdateOverlayMessage(message);
    setUpdateOverlayPhase(phase);
    setUpdateOverlayVisible(true);
  }, []);

  const hideUpdateOverlay = useCallback(() => {
    setUpdateOverlayVisible(false);
  }, []);

  const confirm = useCallback((opts: ConfirmOptions) => {
    setConfirmOpts(opts);
    setConfirmVisible(true);

    return new Promise<boolean>((resolve) => {
      confirmResolveRef.current = resolve;
    });
  }, []);

  const toast = useCallback((message: string, opts?: ToastOptions) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);

    setToastMessage(message);
    setToastVariant(opts?.variant ?? "default");
    setToastVisible(true);

    const duration = opts?.durationMs ?? 1800;
    toastTimerRef.current = setTimeout(() => setToastVisible(false), duration);
  }, []);

  const value = useMemo(
    () => ({ confirm, toast, showUpdateOverlay, hideUpdateOverlay }),
    [confirm, toast, showUpdateOverlay, hideUpdateOverlay]
  );

  return (
    <OverlayContext.Provider value={value}>
      {/* 
           backgroundColor: colors.bg здесь критически важен. 
           Это самая верхняя подложка всего приложения.
      */}
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        {children}

        <ConfirmDialog
          visible={confirmVisible}
          title={confirmOpts.title}
          message={confirmOpts.message}
          cancelText={confirmOpts.cancelText ?? "Отмена"}
          confirmText={confirmOpts.confirmText ?? "ОК"}
          confirmVariant={confirmOpts.variant ?? "primary"}
          onCancel={() => {
            setConfirmVisible(false);
            confirmResolveRef.current?.(false);
            confirmResolveRef.current = null;
          }}
          onConfirm={() => {
            setConfirmVisible(false);
            confirmResolveRef.current?.(true);
            confirmResolveRef.current = null;
          }}
        />

        <Toast visible={toastVisible} message={toastMessage} variant={toastVariant} />

        <UpdateOverlay
          visible={updateOverlayVisible}
          message={updateOverlayMessage}
          phase={updateOverlayPhase}
        />
      </View>
    </OverlayContext.Provider>
  );
}

export function useOverlay(): OverlayContextValue {
  const ctx = useContext(OverlayContext);
  if (!ctx) throw new Error("useOverlay must be used inside OverlayProvider");
  return ctx;
}