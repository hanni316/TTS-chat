// Backend facade. Picks Firebase if env vars are configured (the production
// path), otherwise throws on use. The existing screens import `backend` from
// this module and call its methods directly — the interface mirrors the
// FirebaseBackend class below.

import { FirebaseBackend, type SignUpInput } from './firebaseBackend';
import { hasFirebaseConfig } from './firebaseInit';

if (!hasFirebaseConfig) {
  // We surface this loudly in the console rather than crashing the module
  // load — the LoginPage will still render and FirebaseBackend methods will
  // throw with a clear message when called.
  console.warn(
    '[tts-chat] Firebase 환경변수가 비어 있습니다. `.env.local` (또는 Vercel 환경변수)에 VITE_FIREBASE_* 값을 채워주세요.'
  );
}

export type { SignUpInput };
export const backend = new FirebaseBackend();
