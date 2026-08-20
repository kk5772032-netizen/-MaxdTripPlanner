import { create } from 'zustand';

import type { IconName } from '../components/ui';

/**
 * One toast at a time.
 *
 * A new toast replaces the current one rather than stacking — stacked toasts
 * cover the screen they're reporting on. An undo toast is how destructive
 * actions are confirmed: the work happens immediately and is reversible for a
 * few seconds, which is faster than a dialog and safer than nothing.
 */
export interface Toast {
  id: number;
  message: string;
  icon: IconName;
  tone: 'neutral' | 'danger';
  /** Present when the action is reversible. */
  undo?: () => void | Promise<void>;
  durationMs: number;
}

interface ToastState {
  toast: Toast | null;
  show: (t: Omit<Toast, 'id' | 'durationMs' | 'icon' | 'tone'> &
    Partial<Pick<Toast, 'icon' | 'tone' | 'durationMs'>>) => void;
  dismiss: (id?: number) => void;
}

let nextId = 1;

export const useToastStore = create<ToastState>((set, get) => ({
  toast: null,

  show: ({ message, undo, icon, tone, durationMs }) => {
    set({
      toast: {
        id: nextId++,
        message,
        undo,
        icon: icon ?? (undo ? 'trash-outline' : 'checkmark-circle'),
        tone: tone ?? 'neutral',
        // Longer when there's something to act on — 4s isn't enough to read a
        // message, decide, and reach the button.
        durationMs: durationMs ?? (undo ? 6000 : 4000),
      },
    });
  },

  dismiss: (id) => {
    const current = get().toast;
    if (!current) return;
    if (id !== undefined && current.id !== id) return;  // a newer toast won
    set({ toast: null });
  },
}));

/** Convenience for the common "deleted, with undo" case. */
export function showUndoToast(message: string, undo: () => void | Promise<void>) {
  useToastStore.getState().show({ message, undo });
}
