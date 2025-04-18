import { useAuth } from '../contexts/AuthContext';
import { getFeatureLimit, canUseFeature, isExportFormatAllowed } from '../config/userTiers';

export const useTierPermissions = () => {
  const { userTier } = useAuth();

  return {
    // Get numerical limits
    getLimit: (feature) => getFeatureLimit(userTier, feature),
    
    // Check if a feature is available
    canUse: (feature) => canUseFeature(userTier, feature),
    
    // Check if export format is allowed
    canExport: (format) => isExportFormatAllowed(userTier, format),
    
    // Get current user tier
    getCurrentTier: () => userTier,
    
    // Check if user has reached a numerical limit
    hasReachedLimit: (feature, currentCount) => {
      const limit = getFeatureLimit(userTier, feature);
      return limit !== -1 && currentCount >= limit;
    }
  };
}; 