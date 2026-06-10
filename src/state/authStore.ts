import { create } from 'zustand';
import { backend, type SignUpInput } from '@/services/backend';
import { firebaseAuth } from '@/services/firebaseInit';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { firestore } from '@/services/firebaseInit';
import type { UserProfile } from '@/types';

interface AuthState {
  user: UserProfile | null;
  status: 'idle' | 'ready';
  signIn: (email: string, password: string) => Promise<UserProfile>;
  signUp: (input: SignUpInput) => Promise<UserProfile>;
  signOut: () => Promise<void>;
  refresh: () => void;
  rotateCode: () => Promise<void>;
  updateNickname: (nickname: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => {
  // Hook Firebase Auth's persistent session into the store. This fires on
  // initial load (after IndexedDB restore), on signIn, and on signOut.
  if (firebaseAuth) {
    onAuthStateChanged(firebaseAuth, async (u) => {
      if (!u || !firestore) {
        set({ user: null, status: 'ready' });
        return;
      }
      try {
        const snap = await getDoc(doc(firestore, 'users', u.uid));
        if (snap.exists()) {
          const data = snap.data();
          set({
            user: {
              id: u.uid,
              email: data.email ?? u.email ?? '',
              nickname: data.nickname ?? '익명',
              avatarUrl: data.avatarUrl,
              friendCode: data.friendCode ?? '',
              friendCodeRotatedAt:
                data.friendCodeRotatedAt?.toDate?.()?.toISOString?.() ??
                new Date().toISOString(),
              createdAt:
                data.createdAt?.toDate?.()?.toISOString?.() ?? new Date().toISOString(),
            },
            status: 'ready',
          });
        } else {
          set({ user: null, status: 'ready' });
        }
      } catch {
        set({ user: null, status: 'ready' });
      }
    });
  } else {
    // Firebase not configured: still mark as "ready" so the UI shows the
    // login screen with the proper error rather than spinning forever.
    setTimeout(() => set({ status: 'ready' }), 0);
  }

  return {
    user: null,
    status: 'idle',

    refresh() {
      // No-op: onAuthStateChanged is the source of truth.
    },

    async signIn(email, password) {
      const u = await backend.signIn(email, password);
      // onAuthStateChanged will populate the store; return for the caller.
      return u;
    },

    async signUp(input) {
      const u = await backend.signUp(input);
      return u;
    },

    async signOut() {
      await backend.signOut();
      set({ user: null });
    },

    async rotateCode() {
      const u = get().user;
      if (!u) return;
      const next = await backend.rotateFriendCode(u.id);
      set({ user: next });
    },

    async updateNickname(nickname) {
      const u = get().user;
      if (!u) return;
      const next = await backend.updateProfile(u.id, { nickname });
      set({ user: next });
    },
  };
});
