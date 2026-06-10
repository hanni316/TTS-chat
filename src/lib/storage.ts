// Thin wrapper around localStorage/sessionStorage with JSON encoding.
export const LS = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key);
      if (raw == null) return fallback;
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  },
  set<T>(key: string, val: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch {
      /* quota or private-mode */
    }
  },
  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

export const SS = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = sessionStorage.getItem(key);
      if (raw == null) return fallback;
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  },
  set<T>(key: string, val: T): void {
    try {
      sessionStorage.setItem(key, JSON.stringify(val));
    } catch {
      /* ignore */
    }
  },
  remove(key: string): void {
    try {
      sessionStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};
