import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  type Auth,
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  doc,
  type Firestore,
  getDocFromServer,
  getFirestore,
} from 'firebase/firestore';
import firebaseConfig from 'virtual:firebase-config';

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

export const hasFirebaseConfig = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId
);

export const firebaseProjectId = firebaseConfig.projectId || '';
export const firestoreDatabaseId = firebaseConfig.firestoreDatabaseId || '(default)';

export const firebaseApp: FirebaseApp | null = hasFirebaseConfig
  ? getApps().length > 0
    ? getApps()[0]
    : initializeApp(firebaseConfig)
  : null;

export const db: Firestore | null = firebaseApp
  ? getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId)
  : null;

export const auth: Auth | null = firebaseApp ? getAuth(firebaseApp) : null;

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo:
        auth?.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function isFirestoreQuotaError(error: unknown): {
  isQuota: boolean;
  isFreeDailyLimit: boolean;
  upgradeUrl: string;
} {
  const msg = error instanceof Error ? error.message : String(error || '');
  const isFreeDailyLimit = msg.includes(
    "Quota exceeded for quota metric 'Free daily read units per project (free tier database)'"
  );
  const isQuota = isFreeDailyLimit || msg.includes('Quota exceeded.');
  const upgradeUrl = `https://console.firebase.google.com/project/${encodeURIComponent(
    firebaseProjectId
  )}/firestore/databases/${encodeURIComponent(
    firestoreDatabaseId
  )}/data?openUpgradeDialog=true`;
  return { isQuota, isFreeDailyLimit, upgradeUrl };
}

let connectionTested = false;

export async function testConnection(): Promise<void> {
  if (!db || connectionTested) return;
  connectionTested = true;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

export async function signInWithGoogleBasic() {
  if (!auth) {
    throw new Error(
      'Firebase configuration is missing. Set VITE_FIREBASE_* or firebase-applet-config.json.'
    );
  }
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return signInWithPopup(auth, provider);
}

export async function signOutFirebaseUser(): Promise<void> {
  if (auth) {
    await signOut(auth);
  }
}
