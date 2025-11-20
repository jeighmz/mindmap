const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Initialize Firebase Admin if not already initialized
if (!getApps().length) {
  // Check if running locally or in production
  if (process.env.FIREBASE_PRIVATE_KEY) {
    // Local development - use environment variables
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // The private key comes as a string with "\n" characters
        // We need to replace them with actual newlines
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
  } else {
    // Production - Netlify will handle the credentials
    initializeApp();
  }
}

const db = getFirestore();

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  const sig = event.headers['stripe-signature'];
  let stripeEvent;

  try {
    // Verify webhook signature
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return {
      statusCode: 400,
      body: JSON.stringify({ error: err.message }),
    };
  }

  try {
    console.log('Webhook received:', {
      type: stripeEvent.type,
      id: stripeEvent.id,
      livemode: stripeEvent.livemode
    });

    // Handle different event types
    switch (stripeEvent.type) {
      case 'checkout.session.completed': {
        const session = stripeEvent.data.object;
        let { firebaseUserId, newTier, currentTier, hasExistingSubscription, existingSubscriptionId } = session.metadata || {};
        
        // Log metadata for debugging
        console.log('Checkout session completed - RAW DATA:', {
          firebaseUserId,
          newTier,
          currentTier,
          hasExistingSubscription,
          existingSubscriptionId,
          allMetadata: session.metadata,
          metadataKeys: session.metadata ? Object.keys(session.metadata) : [],
          hasSubscription: !!session.subscription,
          subscriptionId: session.subscription,
          sessionId: session.id,
          customerId: session.customer
        });
        
        // If user had existing subscription, cancel the old one and keep the new one
        if (hasExistingSubscription === 'true' && existingSubscriptionId && session.subscription) {
          try {
            console.log(`Cancelling old subscription ${existingSubscriptionId} and keeping new ${session.subscription}`);
            await stripe.subscriptions.cancel(existingSubscriptionId);
            console.log(`Old subscription ${existingSubscriptionId} cancelled successfully`);
          } catch (err) {
            console.error('Error cancelling old subscription:', err);
            // Continue anyway - we'll update to new tier
          }
        }
        
        // If newTier is missing from session metadata, try to get it from subscription
        if (!newTier && session.subscription) {
          try {
            const subscription = await stripe.subscriptions.retrieve(session.subscription);
            const subscriptionTier = subscription.metadata?.tier;
            console.log('Subscription metadata:', {
              allMetadata: subscription.metadata,
              tier: subscriptionTier
            });
            if (subscriptionTier) {
              newTier = subscriptionTier;
              console.log('Got tier from subscription metadata:', newTier);
            }
          } catch (err) {
            console.error('Error retrieving subscription:', err);
          }
        }
        
        // Validate we have the required data
        if (!firebaseUserId) {
          console.error('Missing firebaseUserId in session metadata');
          break;
        }
        
        if (!newTier) {
          console.error('Missing newTier in session metadata. Available metadata:', JSON.stringify(session.metadata, null, 2));
          break;
        }
        
        // Validate newTier is not FREE (shouldn't happen for paid subscriptions)
        if (newTier === 'FREE') {
          console.error('ERROR: newTier is FREE for a paid subscription! This should not happen.');
          console.error('Session metadata:', JSON.stringify(session.metadata, null, 2));
          // Don't update to FREE - this is an error
          break;
        }
        
        // Validate newTier is a valid tier
        const validTiers = ['STARTER', 'PRO', 'CREATOR_AI'];
        if (!validTiers.includes(newTier)) {
          console.error(`ERROR: Invalid tier value: ${newTier}. Must be one of: ${validTiers.join(', ')}`);
          break;
        }
        
        console.log(`Updating user ${firebaseUserId} tier from ${currentTier || 'unknown'} to ${newTier}`);
        
        // Check if user exists first
        const userDocBefore = await db.collection('users').doc(firebaseUserId).get();
        if (!userDocBefore.exists) {
          console.error(`ERROR: User ${firebaseUserId} does not exist in Firestore!`);
          return {
            statusCode: 404,
            body: JSON.stringify({ error: `User ${firebaseUserId} not found in Firestore` })
          };
        }
        
        console.log(`User exists. Current tier in DB: ${userDocBefore.data()?.tier}`);
        
        // Update user's subscription status in Firestore
        // Use set with merge to ensure it persists
        try {
          await db.collection('users').doc(firebaseUserId).set({
            tier: newTier,
            stripeCustomerId: session.customer,
            stripeSubscriptionId: session.subscription,
            updatedAt: new Date().toISOString(),
          }, { merge: true });
          console.log(`Firestore set() call completed for user ${firebaseUserId}`);
        } catch (updateError) {
          console.error(`ERROR updating Firestore:`, updateError);
          throw updateError;
        }
        
        // Verify the update - wait a moment for Firestore to propagate
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Verify multiple times to ensure it persisted
        let verifiedTier = null;
        for (let i = 0; i < 3; i++) {
          const userDoc = await db.collection('users').doc(firebaseUserId).get();
          verifiedTier = userDoc.data()?.tier;
          console.log(`Verification attempt ${i + 1}: user ${firebaseUserId} tier is ${verifiedTier} (expected ${newTier})`);
          
          if (verifiedTier === newTier) {
            break;
          }
          
          // If mismatch, try updating again
          if (i < 2) {
            console.log(`Tier mismatch detected, retrying update...`);
            await db.collection('users').doc(firebaseUserId).set({
              tier: newTier,
              updatedAt: new Date().toISOString(),
            }, { merge: true });
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
        
        if (verifiedTier !== newTier) {
          console.error(`TIER MISMATCH after multiple attempts! Expected ${newTier} but got ${verifiedTier}`);
          // Try one more time with force overwrite
          await db.collection('users').doc(firebaseUserId).set({
            tier: newTier,
            stripeCustomerId: session.customer,
            stripeSubscriptionId: session.subscription,
            updatedAt: new Date().toISOString(),
          }, { merge: false });
          
          // Final verification
          const finalDoc = await db.collection('users').doc(firebaseUserId).get();
          const finalTier = finalDoc.data()?.tier;
          console.log(`Final tier after force update: ${finalTier}`);
        } else {
          console.log(`✅ Tier update confirmed: ${newTier}`);
        }
        
        // Create upgrade notification
        try {
          const userDoc = await db.collection('users').doc(firebaseUserId).get();
          const userData = userDoc.data();
          const userEmail = userData?.email;
          
          // Format tier name for display
          const tierDisplayNames = {
            'STARTER': 'Starter',
            'PRO': 'Pro',
            'CREATOR_AI': 'Creator AI'
          };
          const tierDisplayName = tierDisplayNames[newTier] || newTier;
          
          // Create notification
          await db.collection('notifications').add({
            userId: firebaseUserId,
            userEmail: userEmail ? userEmail.toLowerCase() : null,
            title: 'Account Upgraded',
            message: `You have upgraded your account tier to ${tierDisplayName}`,
            read: false,
            createdAt: new Date(),
            type: 'upgrade'
          });
          
          console.log(`✅ Upgrade notification created for user ${firebaseUserId}`);
        } catch (notificationError) {
          console.error('Error creating upgrade notification:', notificationError);
          // Don't fail the webhook if notification creation fails
        }
        
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = stripeEvent.data.object;
        const { firebaseUserId, tier } = subscription.metadata || {};
        
        console.log('Subscription updated event:', {
          subscriptionId: subscription.id,
          firebaseUserId,
          tier,
          status: subscription.status,
          allMetadata: subscription.metadata
        });
        
        if (firebaseUserId && tier) {
          // Get current tier before update
          const userDocBefore = await db.collection('users').doc(firebaseUserId).get();
          const currentTier = userDocBefore.data()?.tier;
          
          console.log(`Updating user ${firebaseUserId} tier from ${currentTier} to ${tier} via subscription.updated webhook`);
          
          await db.collection('users').doc(firebaseUserId).update({
            tier,
            stripeSubscriptionStatus: subscription.status,
            updatedAt: new Date().toISOString(),
          });
          
          // Verify the update
          const userDocAfter = await db.collection('users').doc(firebaseUserId).get();
          const updatedTier = userDocAfter.data()?.tier;
          console.log(`Subscription updated webhook: user ${firebaseUserId} tier is now ${updatedTier} (expected ${tier})`);
          
          if (updatedTier !== tier) {
            console.error(`TIER MISMATCH in webhook! Expected ${tier} but got ${updatedTier}`);
          }
        } else {
          console.warn('Subscription updated event missing firebaseUserId or tier:', {
            firebaseUserId,
            tier,
            metadata: subscription.metadata
          });
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = stripeEvent.data.object;
        const { firebaseUserId } = subscription.metadata || {};
        
        if (firebaseUserId) {
          // Check if user has another active subscription before setting to FREE
          // This prevents setting to FREE when upgrading (old subscription cancelled, new one active)
          try {
            const userDoc = await db.collection('users').doc(firebaseUserId).get();
            if (userDoc.exists) {
              const userData = userDoc.data();
              const currentSubscriptionId = userData?.stripeSubscriptionId;
              
              // If the deleted subscription matches the current one, check for other active subscriptions
              if (currentSubscriptionId === subscription.id) {
                // Check if customer has any other active subscriptions
                const customerId = subscription.customer;
                const activeSubscriptions = await stripe.subscriptions.list({
                  customer: customerId,
                  status: 'active',
                  limit: 10
                });
                
                if (activeSubscriptions.data.length > 0) {
                  // User has another active subscription, don't set to FREE
                  console.log(`Subscription ${subscription.id} deleted, but user has ${activeSubscriptions.data.length} other active subscription(s). Not setting to FREE.`);
                  // Update to use the first active subscription
                  const newSubscription = activeSubscriptions.data[0];
                  const newTier = newSubscription.metadata?.tier || userData.tier;
                  await db.collection('users').doc(firebaseUserId).update({
                    stripeSubscriptionId: newSubscription.id,
                    stripeSubscriptionStatus: 'active',
                    tier: newTier, // Keep current tier or use subscription metadata
                    updatedAt: new Date().toISOString(),
                  });
                  console.log(`Updated to use subscription ${newSubscription.id} with tier ${newTier}`);
                } else {
                  // No active subscriptions, set to FREE
                  console.log(`No active subscriptions found for user ${firebaseUserId}, setting to FREE`);
                  await db.collection('users').doc(firebaseUserId).update({
                    tier: 'FREE',
                    stripeSubscriptionId: null,
                    stripeSubscriptionStatus: 'canceled',
                    updatedAt: new Date().toISOString(),
                  });
                }
              } else {
                // This is an old subscription being cleaned up, don't change tier
                console.log(`Deleted subscription ${subscription.id} doesn't match current ${currentSubscriptionId}. Ignoring.`);
              }
            }
          } catch (err) {
            console.error('Error handling subscription deleted event:', err);
            // Fallback: only set to FREE if we can't check for other subscriptions
            await db.collection('users').doc(firebaseUserId).update({
              tier: 'FREE',
              stripeSubscriptionId: null,
              stripeSubscriptionStatus: 'canceled',
              updatedAt: new Date().toISOString(),
            });
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = stripeEvent.data.object;
        const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
        const { firebaseUserId } = subscription.metadata;
        
        if (firebaseUserId) {
          await db.collection('users').doc(firebaseUserId).update({
            stripeSubscriptionStatus: 'past_due',
            updatedAt: new Date().toISOString(),
          });
        }
        break;
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ received: true }),
    };
  } catch (error) {
    console.error('Error processing webhook:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
}; 