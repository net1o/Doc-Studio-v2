import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  auth,
  firebaseProjectId,
  firestoreDatabaseId,
  hasFirebaseConfig,
  isFirestoreQuotaError,
  signInWithGoogleBasic,
  signOutFirebaseUser,
  testConnection,
} from '../lib/firebase/firebaseApp';
import {
  createEmptySnapshotMaps,
  ensureUserWorkspaceRoot,
  subscribeUserWorkspace,
  syncStateDiffToFirestore,
} from '../lib/firebase/firestoreSync';
import type { JournalMonitorState } from '../lib/journal/store';

export type CloudSyncStatus =
  | 'local'
  | 'connecting'
  | 'synced'
  | 'syncing'
  | 'quota_exceeded'
  | 'error';

interface FirebaseContextValue {
  hasConfig: boolean;
  projectId: string;
  databaseId: string;
  authReady: boolean;
  user: User | null;
  cloudStatus: CloudSyncStatus;
  cloudError: string | null;
  quotaUpgradeUrl: string | null;
  lastSyncedAt: string | null;
  signIn: () => Promise<void>;
  signOutUser: () => Promise<void>;
  notifyLocalStateChanged: (state: JournalMonitorState) => void;
  pushLocalWorkspaceToCloud: (state: JournalMonitorState) => Promise<void>;
}

const FirebaseContext = createContext<FirebaseContextValue | null>(null);

interface FirebaseProviderProps {
  children: ReactNode;
  getLatestState: () => JournalMonitorState;
  onApplyRemoteState: (remote: JournalMonitorState) => void;
  onToast: (message: string, kind?: 'info' | 'error') => void;
}

export function FirebaseProvider({
  children,
  getLatestState,
  onApplyRemoteState,
  onToast,
}: FirebaseProviderProps) {
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [cloudStatus, setCloudStatus] = useState<CloudSyncStatus>('local');
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [quotaUpgradeUrl, setQuotaUpgradeUrl] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  const snapshotMapsRef = useRef(createEmptySnapshotMaps());
  const applyingRemoteRef = useRef(false);
  const cloudReadyRef = useRef(false);
  const syncTimerRef = useRef<number | null>(null);
  const getLatestStateRef = useRef(getLatestState);
  const onApplyRemoteStateRef = useRef(onApplyRemoteState);
  const onToastRef = useRef(onToast);

  getLatestStateRef.current = getLatestState;
  onApplyRemoteStateRef.current = onApplyRemoteState;
  onToastRef.current = onToast;

  const handleSyncFailure = useCallback((error: unknown) => {
    const quota = isFirestoreQuotaError(error);
    if (quota.isQuota) {
      setCloudStatus('quota_exceeded');
      setQuotaUpgradeUrl(quota.upgradeUrl);
      const msg = quota.isFreeDailyLimit
        ? 'Firestore free daily read quota exceeded. Resets tomorrow or upgrade project tier.'
        : 'Firestore quota exceeded. Resets tomorrow under the Spark plan.';
      setCloudError(msg);
      onToastRef.current(msg, 'error');
      return;
    }
    const msg = error instanceof Error ? error.message : String(error);
    setCloudStatus('error');
    setCloudError(msg);
  }, []);

  // Mandatory startup connection check
  useEffect(() => {
    void testConnection();
  }, []);

  // Auth listener & Firestore subscription (only active when authReady && user)
  useEffect(() => {
    if (!auth) {
      setAuthReady(true);
      setCloudStatus('local');
      return;
    }

    let unsubFirestore: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, (nextUser) => {
      if (unsubFirestore) {
        unsubFirestore();
        unsubFirestore = null;
      }
      if (syncTimerRef.current) {
        window.clearTimeout(syncTimerRef.current);
        syncTimerRef.current = null;
      }
      snapshotMapsRef.current = createEmptySnapshotMaps();
      cloudReadyRef.current = false;
      setAuthReady(true);
      setUser(nextUser);
      setCloudError(null);
      setQuotaUpgradeUrl(null);

      if (!nextUser) {
        setCloudStatus('local');
        return;
      }

      setCloudStatus('connecting');
      void (async () => {
        try {
          await ensureUserWorkspaceRoot(nextUser);
          unsubFirestore = subscribeUserWorkspace(
            nextUser.uid,
            snapshotMapsRef.current,
            () => getLatestStateRef.current(),
            {
              onWorkspaceReady: (existsOnCloud, remoteState) => {
                if (!existsOnCloud) {
                  // Seed cloud workspace with the user's current local state
                  void (async () => {
                    try {
                      setCloudStatus('syncing');
                      await syncStateDiffToFirestore(
                        nextUser.uid,
                        getLatestStateRef.current(),
                        snapshotMapsRef.current
                      );
                      cloudReadyRef.current = true;
                      setCloudStatus('synced');
                      setLastSyncedAt(new Date().toLocaleTimeString());
                    } catch (err) {
                      handleSyncFailure(err);
                    }
                  })();
                } else if (remoteState) {
                  applyingRemoteRef.current = true;
                  onApplyRemoteStateRef.current(remoteState);
                  cloudReadyRef.current = true;
                  setCloudStatus('synced');
                  setLastSyncedAt(new Date().toLocaleTimeString());
                  window.setTimeout(() => {
                    applyingRemoteRef.current = false;
                  }, 150);
                }
              },
              onRemoteUpdate: (remoteState) => {
                applyingRemoteRef.current = true;
                onApplyRemoteStateRef.current(remoteState);
                setCloudStatus('synced');
                setLastSyncedAt(new Date().toLocaleTimeString());
                window.setTimeout(() => {
                  applyingRemoteRef.current = false;
                }, 150);
              },
              onSyncError: (err) => {
                handleSyncFailure(err);
              },
            }
          );
        } catch (err) {
          handleSyncFailure(err);
        }
      })();
    });

    return () => {
      unsubAuth();
      if (unsubFirestore) unsubFirestore();
      if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current);
    };
  }, [handleSyncFailure]);

  const notifyLocalStateChanged = useCallback(
    (nextState: JournalMonitorState) => {
      if (!authReady || !user || !cloudReadyRef.current || applyingRemoteRef.current) {
        return;
      }
      if (syncTimerRef.current) {
        window.clearTimeout(syncTimerRef.current);
      }
      syncTimerRef.current = window.setTimeout(() => {
        void (async () => {
          try {
            setCloudStatus('syncing');
            const changed = await syncStateDiffToFirestore(
              user.uid,
              nextState,
              snapshotMapsRef.current
            );
            setCloudStatus('synced');
            setCloudError(null);
            if (changed > 0) {
              setLastSyncedAt(new Date().toLocaleTimeString());
            }
          } catch (err) {
            handleSyncFailure(err);
          }
        })();
      }, 450);
    },
    [authReady, user, handleSyncFailure]
  );

  const pushLocalWorkspaceToCloud = useCallback(
    async (localState: JournalMonitorState) => {
      if (!user) {
        onToastRef.current('Sign in with Google first to sync to Firebase.', 'error');
        return;
      }
      try {
        setCloudStatus('syncing');
        await ensureUserWorkspaceRoot(user);
        const ops = await syncStateDiffToFirestore(
          user.uid,
          localState,
          snapshotMapsRef.current
        );
        cloudReadyRef.current = true;
        setCloudStatus('synced');
        setCloudError(null);
        setLastSyncedAt(new Date().toLocaleTimeString());
        onToastRef.current(
          ops > 0
            ? `Synced ${ops} workspace change(s) to Firebase Firestore.`
            : 'Firebase Firestore workspace is already up to date.'
        );
      } catch (err) {
        handleSyncFailure(err);
      }
    },
    [user, handleSyncFailure]
  );

  const signIn = useCallback(async () => {
    try {
      await signInWithGoogleBasic();
      onToastRef.current('Signed in to Firebase Cloud Sync.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google Sign-In failed.';
      onToastRef.current(msg, 'error');
    }
  }, []);

  const signOutUser = useCallback(async () => {
    try {
      await signOutFirebaseUser();
      onToastRef.current('Signed out of Firebase. Continuing in local mode.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign out failed.';
      onToastRef.current(msg, 'error');
    }
  }, []);

  return (
    <FirebaseContext.Provider
      value={{
        hasConfig: hasFirebaseConfig,
        projectId: firebaseProjectId,
        databaseId: firestoreDatabaseId,
        authReady,
        user,
        cloudStatus,
        cloudError,
        quotaUpgradeUrl,
        lastSyncedAt,
        signIn,
        signOutUser,
        notifyLocalStateChanged,
        pushLocalWorkspaceToCloud,
      }}
    >
      {children}
    </FirebaseContext.Provider>
  );
}

export function useFirebase(): FirebaseContextValue {
  const ctx = useContext(FirebaseContext);
  if (!ctx) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
  return ctx;
}
