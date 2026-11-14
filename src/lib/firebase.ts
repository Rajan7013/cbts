import { initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  browserSessionPersistence,
  getAuth,
  GoogleAuthProvider,
  setPersistence,
} from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
// Support Vite client-side environment variables with safe defaults
const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};

const firebaseConfig = {
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'amazing-centaur-462112-n5',
  appId: env.VITE_FIREBASE_APP_ID || '1:468903270383:web:76ae2f5f6e85fe9796c81a',
  apiKey: env.VITE_FIREBASE_API_KEY || 'AIzaSyBW5PVdidbuD-fWmQtXZmo6YXsEfp-7ku4',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'amazing-centaur-462112-n5.firebaseapp.com',
  firestoreDatabaseId: env.VITE_FIREBASE_DATABASE_ID || 'ai-studio-821afd27-84e2-43ab-b5af-651da3cbc0da',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || 'amazing-centaur-462112-n5.firebasestorage.app',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '468903270383',
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
let storageInstance: FirebaseStorage | null = null;
try {
  storageInstance = getStorage(app);
} catch (e) {
  console.warn('Firebase storage could not be initialized:', e);
}
export const storage = storageInstance;
export const auth = getAuth(app);
auth.useDeviceLanguage();

// Ensure reliable session persistence across mobile/desktop reloads
setPersistence(auth, browserLocalPersistence).catch(() => {
  setPersistence(auth, browserSessionPersistence).catch(() => {});
});

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

export function createGoogleAuthProvider(loginHint?: string): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  provider.addScope('email');
  provider.addScope('profile');
  provider.setCustomParameters(
    loginHint
      ? {
          prompt: 'select_account',
          login_hint: loginHint,
        }
      : {
          prompt: 'select_account',
        }
  );
  return provider;
}

export interface RecentGoogleAccount {
  email: string;
  name: string;
  photoUrl?: string;
  lastUsedAt: string;
}

const RECENT_ACCOUNTS_KEY = 'exampulse_recent_google_accounts_v1';

export function getRecentGoogleAccounts(): RecentGoogleAccount[] {
  try {
    const raw = localStorage.getItem(RECENT_ACCOUNTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is RecentGoogleAccount =>
          Boolean(item && typeof item.email === 'string' && item.email.includes('@'))
      )
      .slice(0, 5);
  } catch {
    return [];
  }
}

export function rememberGoogleAccount(account: {
  email: string;
  name: string;
  photoUrl?: string;
}): RecentGoogleAccount[] {
  const cleanEmail = account.email.trim();
  if (!cleanEmail || !cleanEmail.includes('@') || cleanEmail.endsWith('.demo')) {
    return getRecentGoogleAccounts();
  }
  const existing = getRecentGoogleAccounts().filter(
    (a) => a.email.toLowerCase() !== cleanEmail.toLowerCase()
  );
  const next: RecentGoogleAccount[] = [
    {
      email: cleanEmail,
      name: account.name.trim() || cleanEmail.split('@')[0],
      ...(account.photoUrl ? { photoUrl: account.photoUrl } : {}),
      lastUsedAt: new Date().toISOString(),
    },
    ...existing,
  ].slice(0, 5);
  try {
    localStorage.setItem(RECENT_ACCOUNTS_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage errors in private mobile browsing
  }
  return next;
}

export function forgetRecentGoogleAccount(email: string): RecentGoogleAccount[] {
  const next = getRecentGoogleAccounts().filter(
    (a) => a.email.toLowerCase() !== email.trim().toLowerCase()
  );
  try {
    localStorage.setItem(RECENT_ACCOUNTS_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage errors
  }
  return next;
}

export function formatFirebaseAuthError(err: unknown): string {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code || '')
      : '';
  const msg = err instanceof Error ? err.message : String(err || '');

  if (code === 'auth/popup-blocked') {
    return 'Your browser blocked the Google account chooser popup. Please allow popups for this site in your browser settings (or open in Chrome/Safari directly) and tap Sign in again.';
  }
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return 'Google sign-in window was closed before selecting an account. Tap below to choose your Gmail account again.';
  }
  if (code === 'auth/network-request-failed') {
    return 'Network error while reaching Google Sign-In. Check your mobile/Wi-Fi connection and retry.';
  }
  if (code === 'auth/account-exists-with-different-credential') {
    return 'This Gmail address is linked with a different sign-in method. Please choose another Gmail account.';
  }
  if (code === 'auth/user-disabled') {
    return 'This Google account has been disabled in Firebase Authentication.';
  }
  if (code === 'auth/unauthorized-domain') {
    return 'This app domain is not authorized for Google Sign-In yet. Contact the admin to add it in Firebase Auth settings.';
  }
  return msg || 'Google sign-in failed. Please try again.';
}

// Optional main admin email override from environment, fallback to hardcoded default
export const BOOTSTRAPPED_ADMIN_EMAIL =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_MAIN_ADMIN_EMAIL) ||
  'rajanprasaila@gmail.com';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const rawMsg = error instanceof Error ? error.message : String(error);

  // Safe developer-only console logging with full context for debugging
  console.error(`[Firestore Error - ${operationType}] at ${path || 'unknown'}:`, rawMsg, {
    uid: auth.currentUser?.uid,
    operationType,
    path,
  });

  // Clean, human-friendly user message that NEVER leaks auth tokens, user IDs, emails, or internal database paths
  let cleanMsg = 'A database operation could not be completed. Please try again.';

  if (rawMsg.includes('permission-denied') || rawMsg.includes('Missing or insufficient permissions')) {
    cleanMsg = 'Permission denied. You do not have permission to perform this operation.';
  } else if (rawMsg.includes('unauthenticated')) {
    cleanMsg = 'Your session has expired. Please sign in again.';
  } else if (rawMsg.includes('unavailable') || rawMsg.includes('network') || rawMsg.includes('offline')) {
    cleanMsg = 'Network connection issue. Please check your internet connection and try again.';
  } else if (rawMsg.includes('not-found')) {
    cleanMsg = 'The requested test or question was not found.';
  } else if (rawMsg.includes('already-exists')) {
    cleanMsg = 'This record already exists.';
  } else if (rawMsg.startsWith('{') && rawMsg.includes('"error"')) {
    try {
      const parsed = JSON.parse(rawMsg);
      cleanMsg = parsed.error || cleanMsg;
    } catch {
      // fallback to cleanMsg
    }
  } else if (rawMsg && !rawMsg.includes('authInfo') && !rawMsg.includes('providerInfo') && !rawMsg.includes('{')) {
    cleanMsg = rawMsg;
  }

  throw new Error(cleanMsg);
}

export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
      return false;
    }
    return true;
  }
}
