// Firebase app + Auth + Firestore initialization. Config is read from Vite env
// vars (VITE_FIREBASE_*) at build time. See `.env.local` for the local values.
//
// `hasFirebaseConfig` is false when the env vars aren't set (e.g. on a fresh
// clone). In that case the login screen still renders, but backend methods
// throw a clear error instead of silently failing.

import { initializeApp, type FirebaseOptions } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

const config: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const hasFirebaseConfig = Boolean(config.apiKey && config.projectId);

let _auth: Auth | null = null;
let _db: Firestore | null = null;

if (hasFirebaseConfig) {
  const app = initializeApp(config);
  _auth = getAuth(app);
  _db = getFirestore(app);
}

export const firebaseAuth = _auth;
export const firestore = _db;
