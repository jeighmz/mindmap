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
 * Atomically increment usage count for a feature using a transaction
 * This prevents race conditions where concurrent requests could exceed limits
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
    
    // Use a transaction to atomically check and increment
    const newCount = await db.runTransaction(async (transaction) => {
      const usageDoc = await transaction.get(usageRef);
      
      let currentData;
      if (!usageDoc.exists) {
        // Initialize new document
        currentData = {
          aiGeneratedMaps: 0,
          aiAnalysisMessages: 0,
          expandToolUses: 0,
          lastReset: new Date()
        };
      } else {
        currentData = usageDoc.data();
        
        // Check if we need to reset (new day)
        if (isNewDay(currentData.lastReset)) {
          currentData = {
            aiGeneratedMaps: 0,
            aiAnalysisMessages: 0,
            expandToolUses: 0,
            lastReset: new Date()
          };
        }
      }
      
      // Increment the counter
      const newValue = (currentData[usageKey] || 0) + 1;
      currentData[usageKey] = newValue;
      
      // Write back
      transaction.set(usageRef, currentData);
      
      return newValue;
    });
    
    return newCount;
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

/**
 * Check if a guest (unauthenticated) user can use a feature based on IP
 * Guests get 4 AI-generated maps per day, no other AI features
 * @param {string} clientIp - Client IP address from request headers
 * @param {string} featureType - Feature type being requested
 * @returns {Promise<Object>} - { allowed: boolean, reason?: string, ... }
 */
const canUseFeatureAsGuest = async (clientIp, featureType) => {
  // Guests can only use AI map generation (4/day limit)
  if (featureType !== 'aiGeneratedMaps') {
    return {
      allowed: false,
      reason: 'authentication_required',
      message: 'Please sign in to use this feature. Create a free account to get started.',
      guestMode: true
    };
  }

  if (!clientIp) {
    // If we can't determine IP, allow but log warning
    console.warn('Guest request without IP address - allowing but cannot enforce server-side limit');
    return {
      allowed: true,
      guestMode: true,
      clientSideOnly: true
    };
  }

  try {
    const db = initFirebase();
    // Use a safe IP key (replace dots and colons)
    const ipKey = clientIp.replace(/[.:]/g, '_');
    const guestRef = db.collection('guestUsage').doc(ipKey);
    
    const guestDoc = await guestRef.get();
    
    let guestData;
    if (!guestDoc.exists) {
      guestData = {
        aiGeneratedMaps: 0,
        lastReset: new Date(),
        lastIp: clientIp
      };
    } else {
      guestData = guestDoc.data();
      
      // Reset if new day
      if (isNewDay(guestData.lastReset)) {
        guestData = {
          aiGeneratedMaps: 0,
          lastReset: new Date(),
          lastIp: clientIp
        };
      }
    }
    
    const used = guestData.aiGeneratedMaps || 0;
    const limit = 4; // Guest limit is always 4 maps/day
    
    if (used >= limit) {
      return {
        allowed: false,
        reason: 'limit_reached',
        message: `You've reached the guest limit of ${limit} AI-generated maps per day. Sign in for more features, or try again tomorrow.`,
        guestMode: true,
        limit,
        used,
        remaining: 0
      };
    }
    
    return {
      allowed: true,
      guestMode: true,
      limit,
      used,
      remaining: limit - used
    };
  } catch (error) {
    console.error('Error checking guest usage:', error);
    // Fail open for guests - let client-side handle it
    return {
      allowed: true,
      guestMode: true,
      clientSideOnly: true,
      fallbackReason: 'server_error'
    };
  }
};

/**
 * Atomically increment guest usage
 * @param {string} clientIp - Client IP address
 * @returns {Promise<number>} - New usage count
 */
const incrementGuestUsage = async (clientIp) => {
  if (!clientIp) {
    console.warn('Cannot increment guest usage without IP');
    return 0;
  }

  try {
    const db = initFirebase();
    const ipKey = clientIp.replace(/[.:]/g, '_');
    const guestRef = db.collection('guestUsage').doc(ipKey);
    
    const newCount = await db.runTransaction(async (transaction) => {
      const guestDoc = await transaction.get(guestRef);
      
      let guestData;
      if (!guestDoc.exists) {
        guestData = {
          aiGeneratedMaps: 0,
          lastReset: new Date(),
          lastIp: clientIp
        };
      } else {
        guestData = guestDoc.data();
        
        // Reset if new day
        if (isNewDay(guestData.lastReset)) {
          guestData = {
            aiGeneratedMaps: 0,
            lastReset: new Date(),
            lastIp: clientIp
          };
        }
      }
      
      guestData.aiGeneratedMaps = (guestData.aiGeneratedMaps || 0) + 1;
      guestData.lastIp = clientIp; // Update IP on each use
      
      transaction.set(guestRef, guestData);
      
      return guestData.aiGeneratedMaps;
    });
    
    return newCount;
  } catch (error) {
    console.error('Error incrementing guest usage:', error);
    // Don't throw - guest tracking is best-effort
    return 0;
  }
};

module.exports = {
  USER_TIERS,
  TIER_FEATURES,
  getUserTier,
  getUserUsageData,
  canUseFeature,
  incrementUsage,
  getTierDisplayName,
  canUseFeatureAsGuest,
  incrementGuestUsage
};
