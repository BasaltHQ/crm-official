"use client";

import { Toaster } from "react-hot-toast";

export const ToastProvider = () => {
  return (
    <Toaster
      toastOptions={{
        style: {
          background: "#1f2937", // Dark gray/slate similar to --card in dark mode
          color: "#fff",
          border: "1px solid #06b6d4", // --basalt-cyan
        },
        success: {
          iconTheme: {
            primary: "#06b6d4",
            secondary: "#fff",
          },
        },
        error: {
          iconTheme: {
            primary: "#ef4444",
            secondary: "#fff",
          },
        },
      }}
    />
  );
};
