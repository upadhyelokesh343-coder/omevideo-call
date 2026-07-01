import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User as FirebaseUser, 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut as firebaseSignOut
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  serverTimestamp, 
  onSnapshot,
  Timestamp 
} from 'firebase/firestore';
import { auth, db } from '../firebase';

interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  gender: 'male' | 'female' | null;
  isVip: boolean;
  vipExpiry: Timestamp | null;
  isGirlsVip?: boolean;
  girlsVipExpiry?: Timestamp | null;
  isEveryoneVip?: boolean;
  everyoneVipExpiry?: Timestamp | null;
  createdAt: any;
  updatedAt: any;
  bannedUntil?: Timestamp | null;
  location?: {
    country: string;
    countryCode: string;
    city: string;
    flag: string;
  };
}

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  isBanned: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  banUser: (days: number) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
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
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const isBanned = !!(profile?.bannedUntil && profile.bannedUntil.toMillis() > Date.now());

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        // Check local storage for fallback profile
        const localProfile = localStorage.getItem(`profile_${firebaseUser.uid}`);
        if (localProfile) {
          try {
            setProfile(JSON.parse(localProfile));
          } catch (e) {
            console.error('Error parsing local profile:', e);
          }
        }

        // Subscribe to user profile in Firestore
        const userRef = doc(db, 'users', firebaseUser.uid);
        
        const unsubscribeProfile = onSnapshot(userRef, (doc) => {
          if (doc.exists()) {
            const firestoreData = doc.data() as UserProfile;
            setProfile(firestoreData);
            // Sync to local storage
            localStorage.setItem(`profile_${firebaseUser.uid}`, JSON.stringify(firestoreData));
          } else {
            // Document doesn't exist in Firestore yet
            // Keep local profile if it exists, otherwise set to null
            if (!localStorage.getItem(`profile_${firebaseUser.uid}`)) {
              setProfile(null);
            }
          }
          setLoading(false);
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
          setLoading(false);
        });

        return () => unsubscribeProfile();
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    // Add custom parameters to force popup behavior if possible
    provider.setCustomParameters({
      prompt: 'select_account'
    });
    
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error('Google Sign-In Error details:', error);
      throw error;
    }
  };

  const signOut = async () => {
    if (user) {
      localStorage.removeItem(`profile_${user.uid}`);
    }
    await firebaseSignOut(auth);
  };

  const updateProfile = async (data: Partial<UserProfile>) => {
    if (!user) return;
    const userRef = doc(db, 'users', user.uid);
    
    let currentProfile = profile;

    // Local fallback update immediately
    const updatedProfile = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      gender: null,
      isVip: false,
      vipExpiry: null,
      isGirlsVip: false,
      girlsVipExpiry: null,
      isEveryoneVip: false,
      everyoneVipExpiry: null,
      createdAt: new Date(), // Local approximation
      updatedAt: new Date(),
      ...profile,
      ...data
    } as UserProfile;

    setProfile(updatedProfile);
    localStorage.setItem(`profile_${user.uid}`, JSON.stringify(updatedProfile));

    try {
      const userDoc = await getDoc(userRef);
      if (!userDoc.exists()) {
        await setDoc(userRef, {
          ...updatedProfile,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          vipExpiry: data.vipExpiry || null
        });
      } else {
        await setDoc(userRef, {
          ...data,
          updatedAt: serverTimestamp()
        }, { merge: true });
      }
    } catch (error: any) {
      if (error.code === 'permission-denied') {
        handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
      } else {
        throw error;
      }
    }
  };

  const banUser = async (days: number) => {
    if (!user) return;
    const banDate = new Date();
    banDate.setDate(banDate.getDate() + days);
    
    await updateProfile({
      bannedUntil: Timestamp.fromDate(banDate)
    });
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile, 
      loading, 
      isBanned,
      signInWithGoogle, 
      signOut,
      updateProfile,
      banUser
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
  }
