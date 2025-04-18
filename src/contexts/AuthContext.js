import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
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
          tier: USER_TIERS.FREE,
          createdAt: new Date().toISOString()
        };
        await setDoc(userDocRef, userData);
        return { ...firebaseUser, ...userData };
      }

      const userData = userDoc.data();
      setUserTier(userData.tier || USER_TIERS.FREE);
      return { ...firebaseUser, ...userData };
    } catch (error) {
      console.error('Error fetching user data:', error);
      setUserTier(USER_TIERS.FREE);
      return firebaseUser;
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      const userData = await fetchUserData(firebaseUser);
      setUser(userData);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signup = async (email, password) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;
    
    // Create user document in Firestore
    await setDoc(doc(db, 'users', firebaseUser.uid), {
      email: firebaseUser.email,
      tier: USER_TIERS.FREE,
      createdAt: new Date().toISOString()
    });
    
    return firebaseUser;
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

  const value = {
    user,
    userTier,
    signup,
    login,
    logout,
    resetPassword
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}; 