"use client";

import { Toaster } from "sonner";

export function ToastProvider() {
  return (
    <Toaster
      richColors
      closeButton
      position="top-right"
      toastOptions={{
        style: {
          borderRadius: "8px",
          borderColor: "#ded4c8",
        },
      }}
    />
  );
}
