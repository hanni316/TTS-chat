import { create } from 'zustand';
import { DEFAULT_SETTINGS, type AppSettings } from '@/types';
import { LS } from '@/lib/storage';

const KEY = 'tts-chat:settings:v1';

interface SettingsState {
  settings: AppSettings;
  set: <K extends keyof AppSettings>(k: K, v: AppSettings[K]) => void;
  patch: (p: Partial<AppSettings>) => void;
  reset: () => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: { ...DEFAULT_SETTINGS, ...LS.get<Partial<AppSettings>>(KEY, {}) },
  set(k, v) {
    const next = { ...get().settings, [k]: v };
    LS.set(KEY, next);
    set({ settings: next });
  },
  patch(p) {
    const next = { ...get().settings, ...p };
    LS.set(KEY, next);
    set({ settings: next });
  },
  reset() {
    LS.set(KEY, DEFAULT_SETTINGS);
    set({ settings: DEFAULT_SETTINGS });
  },
}));
