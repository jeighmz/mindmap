import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase-config';
import { useAuth } from '../contexts/AuthContext';
import { USER_TIERS, TIER_FEATURES } from '../config/userTiers';

export const useUserTier = () => {
  const { user } = useAuth();
  const [userTier, setUserTier] = useState(USER_TIERS.FREE);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchUserTier = async () => {
      if (!user) {
        setUserTier(USER_TIERS.FREE);
        setIsLoading(false);
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setUserTier(userData.tier || USER_TIERS.FREE);
        } else {
          setUserTier(USER_TIERS.FREE);
        }
      } catch (err) {
        console.error('Error fetching user tier:', err);
        setError(err.message);
        setUserTier(USER_TIERS.FREE);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserTier();
  }, [user]);

  const canUseFeature = (feature) => {
    if (isLoading) return false;
    const tierFeatures = TIER_FEATURES[userTier];
    return tierFeatures ? tierFeatures[feature] : false;
  };

  const getFeatureLimit = (feature) => {
    if (isLoading) return 0;
    const tierFeatures = TIER_FEATURES[userTier];
    return tierFeatures ? tierFeatures[feature] : 0;
  };

  const checkExportFormat = (format) => {
    if (isLoading) return false;
    const tierFeatures = TIER_FEATURES[userTier];
    return tierFeatures ? tierFeatures.canExport.includes(format) : false;
  };

  return {
    userTier,
    isLoading,
    error,
    canUseFeature,
    getFeatureLimit,
    checkExportFormat,
    features: TIER_FEATURES[userTier] || TIER_FEATURES[USER_TIERS.FREE]
  };
}; 