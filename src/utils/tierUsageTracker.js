// Tier-based usage tracking for signed-in users
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase-config';
import { TIER_FEATURES, USER_TIERS } from '../config/userTiers';

const USAGE_COLLECTION = 'userUsage';

// Check if it's a new day (for daily limits)
const isNewDay = (lastReset) => {
  if (!lastReset) return true;
  const lastResetDate = lastReset.toDate ? lastReset.toDate() : new Date(lastReset);
  const today = new Date();
  return lastResetDate.getDate() !== today.getDate() ||
         lastResetDate.getMonth() !== today.getMonth() ||
         lastResetDate.getFullYear() !== today.getFullYear();
};

// Get user's daily usage data from Firestore
export const getUserUsageData = async (userId) => {
  try {
    const usageDoc = await getDoc(doc(db, USAGE_COLLECTION, userId));
    
    if (usageDoc.exists()) {
      const data = usageDoc.data();
      const lastReset = data.lastReset;
      
      // Reset if it's a new day
      if (isNewDay(lastReset)) {
        const resetData = {
          aiGeneratedMaps: 0,
          aiAnalysisMessages: 0,
          expandToolUses: 0,
          lastReset: serverTimestamp()
        };
        await setDoc(doc(db, USAGE_COLLECTION, userId), resetData, { merge: true });
        return resetData;
      }
      
      return {
        aiGeneratedMaps: data.aiGeneratedMaps || 0,
        aiAnalysisMessages: data.aiAnalysisMessages || 0,
        expandToolUses: data.expandToolUses || 0,
        lastReset: data.lastReset
      };
    }
    
    // Create new usage document
    const newData = {
      aiGeneratedMaps: 0,
      aiAnalysisMessages: 0,
      expandToolUses: 0,
      lastReset: serverTimestamp()
    };
    await setDoc(doc(db, USAGE_COLLECTION, userId), newData);
    return newData;
  } catch (error) {
    console.error('Error getting user usage data:', error);
    return {
      aiGeneratedMaps: 0,
      aiAnalysisMessages: 0,
      expandToolUses: 0,
      lastReset: null
    };
  }
};

// Increment usage count
export const incrementUsage = async (userId, usageType) => {
  try {
    console.log('Incrementing usage:', { userId, usageType });
    const usageDoc = doc(db, USAGE_COLLECTION, userId);
    const currentData = await getUserUsageData(userId);
    console.log('Current usage data:', currentData);
    
    const updates = {
      [usageType]: (currentData[usageType] || 0) + 1
    };
    
    // Only update lastReset if it doesn't exist (for new documents)
    if (!currentData.lastReset) {
      updates.lastReset = serverTimestamp();
    }
    
    console.log('Updating with:', updates);
    await setDoc(usageDoc, updates, { merge: true });
    console.log('Successfully incremented usage');
    return updates[usageType];
  } catch (error) {
    console.error('Error incrementing usage:', error);
    console.error('Error details:', {
      code: error?.code,
      message: error?.message,
      stack: error?.stack,
      userId,
      usageType
    });
    throw error;
  }
};

// Check if user can use a feature based on tier
export const canUseFeatureByTier = async (userId, userTier, featureType) => {
  const tierFeatures = TIER_FEATURES[userTier] || TIER_FEATURES[USER_TIERS.FREE];
  
  // Check feature availability
  if (featureType === 'expandTool') {
    if (tierFeatures.dailyExpandTool === 0) return { allowed: false, reason: 'not_available' };
    if (tierFeatures.dailyExpandTool === -1) return { allowed: true };
  }
  
  if (featureType === 'aiAnalysis') {
    if (tierFeatures.dailyAIAnalysisMessages === 0) return { allowed: false, reason: 'not_available' };
    if (tierFeatures.dailyAIAnalysisMessages === -1) return { allowed: true };
  }
  
  if (featureType === 'aiGeneratedMaps') {
    if (tierFeatures.dailyAIGeneratedMaps === 0) return { allowed: false, reason: 'not_available' };
    if (tierFeatures.dailyAIGeneratedMaps === -1) return { allowed: true };
  }
  
  // Check daily limits
  const usageData = await getUserUsageData(userId);
  const limitMap = {
    'expandTool': tierFeatures.dailyExpandTool,
    'aiAnalysis': tierFeatures.dailyAIAnalysisMessages,
    'aiGeneratedMaps': tierFeatures.dailyAIGeneratedMaps
  };
  
  const limit = limitMap[featureType];
  const used = usageData[featureType === 'expandTool' ? 'expandToolUses' : 
                         featureType === 'aiAnalysis' ? 'aiAnalysisMessages' : 
                         'aiGeneratedMaps'] || 0;
  
  if (limit === -1) {
    return { allowed: true };
  }
  
  if (used >= limit) {
    return { 
      allowed: false, 
      reason: 'limit_reached',
      used,
      limit
    };
  }
  
  return { allowed: true, used, limit, remaining: limit - used };
};

// Get remaining usage
export const getRemainingUsage = async (userId, userTier, featureType) => {
  const tierFeatures = TIER_FEATURES[userTier] || TIER_FEATURES[USER_TIERS.FREE];
  const usageData = await getUserUsageData(userId);
  
  const limitMap = {
    'expandTool': tierFeatures.dailyExpandTool,
    'aiAnalysis': tierFeatures.dailyAIAnalysisMessages,
    'aiGeneratedMaps': tierFeatures.dailyAIGeneratedMaps
  };
  
  const limit = limitMap[featureType];
  const used = usageData[featureType === 'expandTool' ? 'expandToolUses' : 
                         featureType === 'aiAnalysis' ? 'aiAnalysisMessages' : 
                         'aiGeneratedMaps'] || 0;
  
  if (limit === -1) return -1; // Unlimited
  if (limit === 0) return 0; // Not available
  
  return Math.max(0, limit - used);
};

