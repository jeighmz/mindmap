# Testing Tier Enforcement

This document describes how to test the server-side tier enforcement changes.

## What Was Fixed

### Server-Side Tier Enforcement in `groq-chat.js`

The Netlify function `groq-chat.js` now:
1. **Requires authentication** - No more guest AI requests
2. **Fetches user tier** from Firestore before processing
3. **Checks daily usage limits** against tier allowances
4. **Returns proper HTTP error codes**:
   - `401` - Not authenticated
   - `403` - Feature not available on current tier
   - `429` - Daily limit reached
5. **Increments usage** after successful AI calls
6. **Enforces feature-specific limits** via `featureType` parameter

### New Utility Module: `tierLimits.js`

Created `netlify/functions/utils/tierLimits.js` with:
- `getUserTier(userId)` - Fetch user's subscription tier
- `canUseFeature(userId, featureType)` - Check if user can use a feature
- `incrementUsage(userId, featureType)` - Track usage after successful calls
- Server-side copy of TIER_FEATURES config

### Client Updates

Updated all `callGroqChat()` calls to pass `featureType`:
- `'aiGeneratedMaps'` - Mind map and chart generation
- `'aiAnalysis'` - AI analysis panel and agent chat
- `'expandTool'` - Expand node feature

## Manual Testing Guide

### Prerequisites

1. **Test User Accounts**: Create users with different tiers in Firebase:
   ```
   FREE user: tier = "FREE"
   PRO user: tier = "PRO"
   CREATOR_AI user: tier = "CREATOR_AI"
   ```

2. **Firestore Collections**:
   - `users/{userId}` - Must have `tier` field
   - `userUsage/{userId}` - Auto-created on first AI call

3. **Environment**: Test on `netlify dev` or deployed preview

### Test Cases

#### Test 1: FREE Tier - AI Map Generation Limit (4/day)

1. **Login as FREE user**
2. **Generate 4 mind maps** (should succeed)
3. **Try 5th map** - Should get error:
   ```
   Status: 429
   Message: "You've reached your daily limit of 4 for this feature..."
   ```
4. **Wait until next day** (or manually reset `userUsage` doc in Firestore)
5. **Try again** - Should succeed

**Check Firestore:**
```javascript
userUsage/{userId}:
{
  aiGeneratedMaps: 4,
  lastReset: <today's date>
}
```

#### Test 2: FREE Tier - AI Analysis Blocked

1. **Login as FREE user**
2. **Open AI Analysis panel**
3. **Send a query**
4. **Expected**: Error message
   ```
   Status: 403
   Message: "This feature is not available on the FREE plan. Please upgrade..."
   ```

#### Test 3: PRO Tier - Unlimited AI Features

1. **Login as PRO user**
2. **Generate 10+ mind maps** - All should succeed
3. **Send 10+ AI analysis queries** - All should succeed
4. **Use expand tool 10+ times** - All should succeed

**Check Firestore:**
```javascript
userUsage/{userId}:
{
  aiGeneratedMaps: 10+,
  aiAnalysisMessages: 10+,
  expandToolUses: 10+,
  lastReset: <today's date>
}
```

#### Test 4: Direct API Call (Bypass Attempt)

**Test server-side enforcement:**

```bash
# Get Firebase auth token
TOKEN="<user_firebase_token>"

# Try to call groq-chat directly
curl -X POST https://aimindmap.netlify.app/.netlify/functions/groq-chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "messages": [{"role": "user", "content": "test"}],
    "featureType": "aiGeneratedMaps"
  }'
```

**Expected for FREE user (after 4 maps):**
```json
{
  "error": {
    "message": "You've reached your daily limit of 4 for this feature...",
    "type": "rate_limit_error",
    "code": "limit_reached",
    "tier": "FREE",
    "limit": 4,
    "used": 4,
    "remaining": 0
  }
}
```

#### Test 5: Unauthenticated Request

```bash
# Try without auth token
curl -X POST https://aimindmap.netlify.app/.netlify/functions/groq-chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "test"}],
    "featureType": "aiGeneratedMaps"
  }'
```

**Expected:**
```json
{
  "error": {
    "message": "Missing or invalid authorization token",
    "type": "authentication_error",
    "code": "authentication_required"
  }
}
```

#### Test 6: Daily Reset

1. **Create a test user**
2. **Use feature up to limit**
3. **Manually update Firestore**:
   ```javascript
   userUsage/{userId}:
   {
     aiGeneratedMaps: 4,
     lastReset: <yesterday's date>
   }
   ```
4. **Make another request** - Should succeed and reset counter

**Check Firestore after:**
```javascript
userUsage/{userId}:
{
  aiGeneratedMaps: 1,  // Reset to 1 (not 5)
  lastReset: <today's date>
}
```

#### Test 7: Subscription Upgrade Flow

1. **Start as FREE user** (4 map limit)
2. **Generate 4 maps** (hit limit)
3. **Try 5th map** - Blocked with 429
4. **Upgrade to PRO** via Stripe checkout
5. **Wait for webhook** (check Firebase Console for tier update)
6. **Try again** - Should succeed (unlimited)

**Verify webhook updated tier:**
```javascript
users/{userId}:
{
  tier: "PRO",  // Changed from "FREE"
  stripeSubscriptionId: "sub_...",
  updatedAt: <timestamp>
}
```

### Testing Checklist

- [ ] FREE user - 4 map generation limit enforced
- [ ] FREE user - AI analysis blocked (0 allowed)
- [ ] FREE user - Expand tool 4/day limit enforced
- [ ] STARTER user - Unlimited maps
- [ ] STARTER user - 4 AI analysis messages/day
- [ ] PRO user - All features unlimited
- [ ] CREATOR_AI user - All features unlimited
- [ ] Direct API call respects limits
- [ ] Unauthenticated requests rejected
- [ ] Daily reset works correctly
- [ ] Error messages are user-friendly
- [ ] Usage tracking is accurate in Firestore

### Common Issues

**Issue**: User gets 401 even when logged in
- **Cause**: Firebase token expired
- **Fix**: Refresh the page to get new token

**Issue**: Limit not enforced
- **Cause**: `tierLimits.js` not deployed
- **Fix**: Redeploy Netlify functions

**Issue**: Usage not incrementing
- **Cause**: Firestore permissions
- **Fix**: Check firestore.rules allows writes to userUsage collection

**Issue**: Daily reset not working
- **Cause**: Timezone mismatch
- **Fix**: `isNewDay()` compares date components, should work in any timezone

## Automated Testing (Future Work)

Consider adding these automated tests:

```javascript
// Example test structure
describe('Tier Enforcement', () => {
  it('should enforce FREE tier daily limit', async () => {
    const user = createTestUser({ tier: 'FREE' });
    
    // Make 4 successful requests
    for (let i = 0; i < 4; i++) {
      const response = await callGroqChat(user, { featureType: 'aiGeneratedMaps' });
      expect(response.status).toBe(200);
    }
    
    // 5th request should fail
    const response = await callGroqChat(user, { featureType: 'aiGeneratedMaps' });
    expect(response.status).toBe(429);
    expect(response.data.error.code).toBe('limit_reached');
  });
  
  it('should allow unlimited for PRO tier', async () => {
    const user = createTestUser({ tier: 'PRO' });
    
    // Make 10 requests, all should succeed
    for (let i = 0; i < 10; i++) {
      const response = await callGroqChat(user, { featureType: 'aiGeneratedMaps' });
      expect(response.status).toBe(200);
    }
  });
});
```

## Monitoring in Production

### Metrics to Track

1. **Rate limit hits by tier**:
   - How many FREE users hit the 4-map limit?
   - Are limits too restrictive?

2. **Feature usage by tier**:
   - Which features drive upgrades?
   - Are PRO users using unlimited features?

3. **API errors**:
   - 429 errors (rate limits)
   - 403 errors (feature not available)

### Suggested Logging

Add to production monitoring:

```javascript
// In groq-chat.js
if (!usageCheck.allowed) {
  console.log('Rate limit hit', {
    userId,
    tier: usageCheck.tier,
    featureType,
    reason: usageCheck.reason,
    limit: usageCheck.limit,
    used: usageCheck.used
  });
}
```

## Rollback Plan

If issues arise in production:

1. **Quick fix**: Set all tier limits to -1 (unlimited) in `tierLimits.js`
2. **Redeploy** Netlify functions
3. **Monitor** for errors
4. **Investigate** root cause
5. **Fix and redeploy** proper enforcement

## Summary

Server-side enforcement is now the source of truth for AI feature limits. Client-side checks remain for UX (showing limits before hitting server), but can no longer be bypassed.

**Key Files Changed:**
- `netlify/functions/groq-chat.js` - Enforces tier limits
- `netlify/functions/utils/tierLimits.js` - NEW - Tier checking logic
- `src/utils/api.js` - Passes featureType, requires auth
- `src/components/whiteboard/WhiteboardCanvas.js` - Passes featureType
- `src/components/whiteboard/SearchPanel.js` - Passes featureType
- `src/components/whiteboard/agent/AgentChat.js` - Passes featureType
