"use client";

/**
 * Tiny toast system for transient feedback (errors, confirmations).
 * Module-level store so any component can push a toast.
 */

import { useSyncExternalStore } from "react";

export type ToastKind = "info" | "success" | "error";

export interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  body?: string;
}

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function pushToast(t: Omit<Toast, "id">) {
  const id = nextId++;
  toasts = [...toasts, { ...t, id }];
  emit();
  window.setTimeout(() => dismissToast(id), 5000);
}

export function dismissToast(id: number) {
  if (!toasts.some((t) => t.id === id)) return;
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function useToasts(): Toast[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => toasts,
    () => toasts,
  );
}
