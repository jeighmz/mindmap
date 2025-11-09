import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile
} from 'firebase/auth';
import { doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase-config';
import { USER_TIERS } from '../config/userTiers';

const AuthContext = createContext();

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userTier, setUserTier] = useState(USER_TIERS.FREE);
  const [loading, setLoading] = useState(true);
  const auth = getAuth();

  const fetchUserData = async (firebaseUser) => {
    if (!firebaseUser) {
      setUserTier(USER_TIERS.FREE);
      return null;
    }

    try {
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        // Create new user document with default FREE tier
        const userData = {
          email: firebaseUser.email,
          displayName: firebaseUser.displayName || null,
          photoURL: firebaseUser.photoURL || null,
          tier: USER_TIERS.FREE,
          createdAt: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
          provider: firebaseUser.providerData[0]?.providerId || 'email'
        };
        
        try {
          await setDoc(userDocRef, userData);
          return { ...firebaseUser, ...userData };
        } catch (error) {
          console.error('Error creating user document:', error);
          return firebaseUser;
        }
      }

      // Get user data and preserve tier
      const userData = userDoc.data();
      const currentTier = userData.tier || USER_TIERS.FREE;
      
      // Update last login time but preserve tier - use merge to ensure we don't overwrite tier
      try {
        // Only update lastLogin and profile fields, explicitly preserve tier
        await setDoc(userDocRef, {
          lastLogin: new Date().toISOString(),
          displayName: firebaseUser.displayName || userData.displayName,
          photoURL: firebaseUser.photoURL || userData.photoURL,
          tier: currentTier, // Explicitly preserve the tier from Firestore
        }, { merge: true });
        
        // DON'T update userTier state here - let the Firestore listener handle it
        // This prevents overwriting tiers that were just updated by webhooks
        // Just return the data with the tier from Firestore
        
        return { ...firebaseUser, ...userData, tier: currentTier };
      } catch (error) {
        console.error('Error updating user document:', error);
        // Don't update tier state on error either
        return { ...firebaseUser, ...userData, tier: currentTier };
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      setUserTier(USER_TIERS.FREE);
      return firebaseUser;
    }
  };

  // Set up auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      const userData = await fetchUserData(firebaseUser);
      setUser(userData);
      
      // Set initial tier from fetched data (only on auth state change, not on every fetch)
      if (userData?.tier) {
        setUserTier(userData.tier);
      } else {
        setUserTier(USER_TIERS.FREE);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, [auth]);

  // Set up real-time Firestore listener for tier changes
  // Use a ref to track the user ID to avoid recreating listener unnecessarily
  const userIdRef = useRef(null);
  
  useEffect(() => {
    const currentUserId = user?.uid;
    
    // Only set up listener if user ID changed
    if (!currentUserId || currentUserId === userIdRef.current) {
      return;
    }
    
    userIdRef.current = currentUserId;
    const userDocRef = doc(db, 'users', currentUserId);
    
    const unsubscribeTier = onSnapshot(userDocRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const data = docSnapshot.data();
        const newTier = data.tier || USER_TIERS.FREE;
        
        // Only update tier, don't update user object (prevents loops)
        setUserTier(prevTier => {
          if (prevTier !== newTier) {
            // Update user object only when tier actually changes
            setUser(prevUser => {
              if (prevUser) {
                return { ...prevUser, tier: newTier };
              }
              return prevUser;
            });
          }
          return newTier;
        });
      }
    }, (error) => {
      console.error('Error listening to tier changes:', error);
    });
    
    return () => {
      unsubscribeTier();
      userIdRef.current = null;
    };
  }, [user?.uid]);

  const signInWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      return fetchUserData(result.user);
    } catch (error) {
      console.error('Google sign-in error:', error);
      throw error;
    }
  };

  const signup = async (email, password, displayName) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;
    
    // Update the user's profile with display name
    if (displayName) {
      await updateProfile(firebaseUser, {
        displayName: displayName
      });
    }
    
    // Create user document in Firestore
    await setDoc(doc(db, 'users', firebaseUser.uid), {
      email: firebaseUser.email,
      displayName: displayName || null,
      tier: USER_TIERS.FREE,
      createdAt: new Date().toISOString()
    });
    
    return fetchUserData(firebaseUser);
  };

  const login = async (email, password) => {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return fetchUserData(userCredential.user);
  };

  const logout = () => {
    setUserTier(USER_TIERS.FREE);
    return signOut(auth);
  };

  const resetPassword = (email) => {
    return sendPasswordResetEmail(auth, email);
  };

  const refreshUserData = useCallback(async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return null;
    
    // Throttle refresh calls - only allow one per 2 seconds
    const now = Date.now();
    if (refreshUserData.lastCall && (now - refreshUserData.lastCall) < 2000) {
      return user; // Return current user to avoid unnecessary updates
    }
    refreshUserData.lastCall = now;
    
    // Reload Firebase Auth user to get latest photoURL and displayName
    try {
      await currentUser.reload();
    } catch (error) {
      console.error('Error reloading Firebase Auth user:', error);
    }
    
    // Force a fresh read from Firestore without updating lastLogin
    // This ensures we get the latest tier from the webhook
    try {
      const userDocRef = doc(db, 'users', currentUser.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const currentTier = userData.tier || USER_TIERS.FREE;
        
        // Get latest Firebase Auth data (photoURL, displayName)
        const updatedUser = {
          ...currentUser,
          photoURL: currentUser.photoURL,
          displayName: currentUser.displayName,
          ...userData,
          tier: currentTier
        };
        
        // Update tier if changed
        setUserTier(prevTier => {
          if (prevTier !== currentTier) {
            return currentTier;
          }
          return prevTier;
        });
        
        // Always update user object to get latest photoURL and displayName from Firebase Auth
        setUser(prevUser => {
          // Check if photoURL or displayName changed
          const photoURLChanged = prevUser?.photoURL !== currentUser.photoURL;
          const displayNameChanged = prevUser?.displayName !== currentUser.displayName;
          const tierChanged = prevUser?.tier !== currentTier;
          
          if (photoURLChanged || displayNameChanged || tierChanged) {
            return updatedUser;
          }
          return prevUser;
        });
        
        return updatedUser;
      } else {
        // User doc doesn't exist, use fetchUserData to create it
        return await fetchUserData(currentUser);
      }
    } catch (error) {
      console.error('Error refreshing user data:', error);
      // Fallback to fetchUserData
      return await fetchUserData(currentUser);
    }
  }, [auth, user]); // Include user to return it when throttled

  const value = {
    user,
    userTier,
    signup,
    login,
    logout,
    resetPassword,
    signInWithGoogle,
    refreshUserData
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}; 