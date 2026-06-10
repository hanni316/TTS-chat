import { create } from 'zustand';

export interface Toast {
  id: number;
  text: string;
  kind?: 'info' | 'success' | 'error';
}

interface State {
  toasts: Toast[];
  push: (text: string, kind?: Toast['kind']) => void;
  dismiss: (id: number) => void;
}

let seq = 1;

export const useToastStore = create<State>((set) => ({
  toasts: [],
  push(text, kind = 'info') {
    const t: Toast = { id: seq++, text, kind };
    set((s) => ({ toasts: [...s.toasts, t] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((x) => x.id !== t.id) }));
    }, 3200);
  },
  dismiss(id) {
    set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }));
  },
}));
