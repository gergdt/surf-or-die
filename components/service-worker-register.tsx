"use client";

import { useEffect, useState } from "react";

export function ServiceWorkerRegister() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    let hadController = !!navigator.serviceWorker.controller;

    const onControllerChange = () => {
      if (hadController) {
        setUpdateAvailable(true);
      }
      hadController = true;
    };
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      onControllerChange,
    );

    const onLoad = () => {
      navigator.serviceWorker
        .register("/sw.js")
        .catch((err) => console.error("SW registration failed", err));
    };
    window.addEventListener("load", onLoad);
    return () => {
      window.removeEventListener("load", onLoad);
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange,
      );
    };
  }, []);

  if (!updateAvailable) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-50 mx-auto max-w-2xl px-4">
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="pointer-events-auto w-full rounded-xl bg-foreground px-4 py-3 text-sm font-semibold text-background shadow-lg"
      >
        Update available, tap to reload
      </button>
    </div>
  );
}
