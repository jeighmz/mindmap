/**
 * Server-side tier limit enforcement for Netlify Functions
 * 
 * IMPORTANT: This module must be kept in sync with client-side config/userTiers.js
 * Any changes to tier limits must be updated in both places.
 */

const { initFirebase } = require('./firebase');

// Mirror of client-side USER_TIERS enum
const USER_TIERS = {
  FREE: 'FREE',
  STARTER: 'STARTER',
  PRO: 'PRO',
  CREATOR_AI: 'CREATOR_AI'
};

// Mirror of client-side TIER_FEATURES config
// This is the source of truth for tier limits on the server
const TIER_FEATURES = {
  [USER_TIERS.FREE]: {
    maxMindMaps: 3,
    maxNodesPerMap: -1,
    maxCollaborators: 0,
    dailyAIGeneratedMaps: 4,
    dailyAIAnalysisMessages: 0,
    dailyExpandTool: 4,
    multiBoardAIChatMemory: 0,
    allowedExportFormats: ['png'],
    features: {
      visionModelSupport: false,
      fullAIEditingTools: false,
      noWatermark: false,
      realTimeCollaboration: false,
      fastestComputePriority: false,
      experimentalFeatures: false
    }
  },
  [USER_TIERS.STARTER]: {
    maxMindMaps: 20,
    maxNodesPerMap: -1,
    maxCollaborators: 0,
    dailyAIGeneratedMaps: -1, // Unlimited
    dailyAIAnalysisMessages: 4,
    dailyExpandTool: 4,
    multiBoardAIChatMemory: 0,
    allowedExportFormats: ['png', 'pdf', 'markdown'],
    features: {
      visionModelSupport: true,
      fullAIEditingTools: false,
      noWatermark: false,
      realTimeCollaboration: false,
      fastestComputePriority: false,
      experimentalFeatures: false
    }
  },
  [USER_TIERS.PRO]: {
    maxMindMaps: 100,
    maxNodesPerMap: -1,
    maxCollaborators: 0,
    dailyAIGeneratedMaps: -1, // Unlimited
    dailyAIAnalysisMessages: -1, // Unlimited
    dailyExpandTool: -1, // Unlimited
    multiBoardAIChatMemory: 3,
    allowedExportFormats: ['png', 'pdf', 'markdown', 'json', 'mm'],
    features: {
      visionModelSupport: true,
      fullAIEditingTools: true,
      noWatermark: true,
      realTimeCollaboration: false,
      fastestComputePriority: false,
      experimentalFeatures: false
    }
  },
  [USER_TIERS.CREATOR_AI]: {
    maxMindMaps: -1, // Unlimited
    maxNodesPerMap: -1,
    maxCollaborators: -1, // Unlimited
    dailyAIGeneratedMaps: -1, // Unlimited
    dailyAIAnalysisMessages: -1, // Unlimited
    dailyExpandTool: -1, // Unlimited
    multiBoardAIChatMemory: -1, // Unlimited
    allowedExportFormats: ['png', 'pdf', 'markdown', 'json', 'mm'],
    features: {
      visionModelSupport: true,
      fullAIEditingTools: true,
      noWatermark: true,
      realTimeCollaboration: true,
      fastestComputePriority: true,
      experimentalFeatures: true
    }
  }
};

/**
 * Check if it's a new day (for daily limit resets)
 */
const isNewDay = (lastReset) => {
  if (!lastReset) return true;
  
  const lastResetDate = lastReset.toDate ? lastReset.toDate() : new Date(lastReset);
  const now = new Date();
  
  return lastResetDate.getDate() !== now.getDate() ||
         lastResetDate.getMonth() !== now.getMonth() ||
         lastResetDate.getFullYear() !== now.getFullYear();
};

/**
 * Fetch user tier from Firestore
 * @param {string} userId - Firebase user ID
 * @returns {Promise<string>} - User tier (defaults to FREE if not found)
 */
const getUserTier = async (userId) => {
  if (!userId) {
    return USER_TIERS.FREE;
  }

  try {
    const db = initFirebase();
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      console.warn(`User ${userId} not found in Firestore, defaulting to FREE tier`);
      return USER_TIERS.FREE;
    }

    const userData = userDoc.data();
    const tier = userData.tier || USER_TIERS.FREE;
    
    // Validate tier is one of our known tiers
    if (!Object.values(USER_TIERS).includes(tier)) {
      console.warn(`Invalid tier ${tier} for user ${userId}, defaulting to FREE`);
      return USER_TIERS.FREE;
    }

    return tier;
  } catch (error) {
    console.error('Error fetching user tier:', error);
    return USER_TIERS.FREE; // Safe fallback
  }
};

/**
 * Get or initialize user usage data from Firestore
 * @param {string} userId - Firebase user ID
 * @returns {Promise<Object>} - Usage data
 */
const getUserUsageData = async (userId) => {
  if (!userId) {
    return {
      aiGeneratedMaps: 0,
      aiAnalysisMessages: 0,
      expandToolUses: 0,
      lastReset: null
    };
  }

  try {
    const db = initFirebase();
    const usageDoc = await db.collection('userUsage').doc(userId).get();
    
    if (!usageDoc.exists) {
      // Initialize new usage document
      const newData = {
        aiGeneratedMaps: 0,
        aiAnalysisMessages: 0,
        expandToolUses: 0,
        lastReset: new Date()
      };
      
      await db.collection('userUsage').doc(userId).set(newData);
      return newData;
    }

    const data = usageDoc.data();
    const lastReset = data.lastReset;
    
    // Reset if it's a new day
    if (isNewDay(lastReset)) {
      const resetData = {
        aiGeneratedMaps: 0,
        aiAnalysisMessages: 0,
        expandToolUses: 0,
        lastReset: new Date()
      };
      
      await db.collection('userUsage').doc(userId).set(resetData, { merge: true });
      return resetData;
    }

    return {
      aiGeneratedMaps: data.aiGeneratedMaps || 0,
      aiAnalysisMessages: data.aiAnalysisMessages || 0,
      expandToolUses: data.expandToolUses || 0,
      lastReset: data.lastReset
    };
  } catch (error) {
    console.error('Error fetching user usage data:', error);
    return {
      aiGeneratedMaps: 0,
      aiAnalysisMessages: 0,
      expandToolUses: 0,
      lastReset: null
    };
  }
};

/**
 * Check if user can use a feature based on their tier and current usage
 * @param {string} userId - Firebase user ID
 * @param {string} featureType - 'aiGeneratedMaps', 'aiAnalysis', or 'expandTool'
 * @returns {Promise<Object>} - { allowed: boolean, reason?: string, limit?: number, used?: number, remaining?: number }
 */
const canUseFeature = async (userId, featureType) => {
  if (!userId) {
    // Guest users are not supported for paid features
    return {
      allowed: false,
      reason: 'authentication_required',
      message: 'Please sign in to use this feature'
    };
  }

  try {
    const tier = await getUserTier(userId);
    const tierFeatures = TIER_FEATURES[tier] || TIER_FEATURES[USER_TIERS.FREE];
    
    // Map feature type to tier config
    const limitMap = {
      'aiGeneratedMaps': 'dailyAIGeneratedMaps',
      'aiAnalysis': 'dailyAIAnalysisMessages',
      'expandTool': 'dailyExpandTool'
    };
    
    const usageMap = {
      'aiGeneratedMaps': 'aiGeneratedMaps',
      'aiAnalysis': 'aiAnalysisMessages',
      'expandTool': 'expandToolUses'
    };
    
    const limitKey = limitMap[featureType];
    const usageKey = usageMap[featureType];
    
    if (!limitKey || !usageKey) {
      return {
        allowed: false,
        reason: 'invalid_feature_type',
        message: 'Invalid feature type'
      };
    }
    
    const limit = tierFeatures[limitKey];
    
    // Check if feature is available for this tier
    if (limit === 0) {
      return {
        allowed: false,
        reason: 'feature_not_available',
        message: `This feature is not available on the ${tier} plan. Please upgrade to use it.`,
        tier,
        limit: 0
      };
    }
    
    // Unlimited usage
    if (limit === -1) {
      return {
        allowed: true,
        tier,
        limit: -1,
        unlimited: true
      };
    }
    
    // Check current usage
    const usageData = await getUserUsageData(userId);
    const used = usageData[usageKey] || 0;
    
    if (used >= limit) {
      return {
        allowed: false,
        reason: 'limit_reached',
        message: `You've reached your daily limit of ${limit} for this feature. Upgrade your plan or try again tomorrow.`,
        tier,
        limit,
        used,
        remaining: 0
      };
    }
    
    return {
      allowed: true,
      tier,
      limit,
      used,
      remaining: limit - used
    };
  } catch (error) {
    console.error('Error checking feature usage:', error);
    // Fail closed - deny access on error
    return {
      allowed: false,
      reason: 'error',
      message: 'Error checking feature limits. Please try again.'
    };
  }
};

/**
 * Increment usage count for a feature
 * @param {string} userId - Firebase user ID
 * @param {string} featureType - 'aiGeneratedMaps', 'aiAnalysis', or 'expandTool'
 * @returns {Promise<number>} - New usage count
 */
const incrementUsage = async (userId, featureType) => {
  if (!userId) {
    throw new Error('User ID is required to increment usage');
  }

  try {
    const usageMap = {
      'aiGeneratedMaps': 'aiGeneratedMaps',
      'aiAnalysis': 'aiAnalysisMessages',
      'expandTool': 'expandToolUses'
    };
    
    const usageKey = usageMap[featureType];
    
    if (!usageKey) {
      throw new Error(`Invalid feature type: ${featureType}`);
    }

    const db = initFirebase();
    const usageRef = db.collection('userUsage').doc(userId);
    
    // Get current data to ensure we're not resetting on a new day
    const currentData = await getUserUsageData(userId);
    
    // Increment the specific usage counter
    const updates = {
      [usageKey]: (currentData[usageKey] || 0) + 1
    };
    
    // Only set lastReset if it doesn't exist (for new documents)
    if (!currentData.lastReset) {
      updates.lastReset = new Date();
    }
    
    await usageRef.set(updates, { merge: true });
    
    return updates[usageKey];
  } catch (error) {
    console.error('Error incrementing usage:', error);
    throw error;
  }
};

/**
 * Get tier display name for error messages
 */
const getTierDisplayName = (tier) => {
  const displayNames = {
    'FREE': 'Free',
    'STARTER': 'Starter',
    'PRO': 'Pro',
    'CREATOR_AI': 'Creator AI'
  };
  return displayNames[tier] || tier;
};

module.exports = {
  USER_TIERS,
  TIER_FEATURES,
  getUserTier,
  getUserUsageData,
  canUseFeature,
  incrementUsage,
  getTierDisplayName
};
