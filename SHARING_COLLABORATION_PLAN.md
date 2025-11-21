# Sharing & Collaboration Feature Plan

## Overview
This document outlines the plan for implementing board sharing and real-time collaboration features.

## 1. Database Schema Changes

### 1.1 Board Sharing Permissions
**Collection: `boardShares`**
```javascript
{
  id: string (auto-generated),
  boardId: string,
  boardOwnerId: string,
  sharedWithUserId: string,
  sharedWithEmail: string, // For pending shares
  permission: 'viewer' | 'editor', // Default: 'viewer'
  sharedAt: Timestamp,
  status: 'pending' | 'accepted' | 'declined',
  invitedBy: string (userId)
}
```

**Update `boards` collection:**
- Add `sharedWith: array<string>` (userIds who have access)
- Add `isShared: boolean`
- Add `shareSettings: { allowViewers: boolean, allowEditors: boolean }`

### 1.2 Notifications
**Collection: `notifications`**
```javascript
{
  id: string (auto-generated),
  userId: string, // Recipient
  type: 'board_shared' | 'board_invite' | 'collaborator_joined' | 'board_updated',
  title: string,
  message: string,
  boardId: string (optional),
  boardName: string (optional),
  fromUserId: string (optional),
  fromUserName: string (optional),
  read: boolean,
  createdAt: Timestamp,
  actionUrl: string (optional) // e.g., '/whiteboard/{boardId}'
}
```

### 1.3 Active Collaborators (Presence)
**Collection: `boardPresence`**
```javascript
{
  id: string (auto-generated),
  boardId: string,
  userId: string,
  userName: string,
  userEmail: string,
  userPhotoURL: string,
  lastSeen: Timestamp,
  isActive: boolean,
  cursorPosition: { x: number, y: number } (optional)
}
```

## 2. Backend Services

### 2.1 Sharing Service (`src/services/sharingService.js`)
Functions:
- `shareBoard(boardId, email, permission)` - Share board with user by email
- `unshareBoard(boardId, userId)` - Remove user's access
- `getSharedBoards(userId)` - Get boards shared with user
- `getBoardCollaborators(boardId)` - Get list of users with access
- `updateSharePermission(boardId, userId, permission)` - Change permission level
- `acceptBoardShare(shareId)` - Accept a board share invitation

### 2.2 Notifications Service (`src/services/notificationsService.js`)
Functions:
- `createNotification(notificationData)` - Create a notification
- `getUserNotifications(userId)` - Get user's notifications
- `markNotificationRead(notificationId)` - Mark as read
- `markAllNotificationsRead(userId)` - Mark all as read
- `deleteNotification(notificationId)` - Delete notification
- `getUnreadCount(userId)` - Get count of unread notifications

### 2.3 Collaboration Service (`src/services/collaborationService.js`)
Functions:
- `joinBoard(boardId, userId)` - User joins board (presence)
- `leaveBoard(boardId, userId)` - User leaves board
- `updatePresence(boardId, userId, data)` - Update user presence
- `getActiveCollaborators(boardId)` - Get active users on board
- `subscribeToCollaborators(boardId, callback)` - Real-time listener for collaborators

## 3. Frontend Components

### 3.1 Sharing Modal (`src/components/whiteboard/ShareBoardModal.js`)
Features:
- Input to enter email addresses
- Permission selector (Viewer/Editor)
- List of current collaborators with permissions
- Remove collaborator button
- Copy shareable link (future feature)

### 3.2 Notifications Component (`src/components/Notifications.js`)
Features:
- Badge with unread count in UserMenu
- Dropdown panel showing notifications
- Mark as read on click
- Navigate to board on click
- Delete notification option
- "Mark all as read" button

### 3.3 Collaborators Bar (`src/components/whiteboard/CollaboratorsBar.js`)
Features:
- Display active collaborators' avatars at top of board
- Show user name on hover
- Color-coded cursors (future)
- Real-time updates when users join/leave

### 3.4 Share Button
- Add to SavedWhiteboardsMenu (in board actions)
- Add to WhiteboardToolbar
- Opens ShareBoardModal

## 4. Real-time Updates

### 4.1 Board Content Synchronization
- Use Firestore `onSnapshot` on board document
- Listen for changes to `content` field
- Merge changes intelligently (avoid conflicts)
- Show "Saving..." indicator when others are editing

### 4.2 Presence Tracking
- Update `boardPresence` document when user is on board
- Clean up presence when user leaves (onUnmount, beforeUnload)
- Use Firestore `onSnapshot` to listen for active collaborators
- Heartbeat mechanism (update `lastSeen` every 30 seconds)

## 5. Firestore Security Rules Updates

Update `firestore.rules`:
```javascript
// Board shares
match /boardShares/{shareId} {
  allow read: if request.auth != null && 
    (resource.data.sharedWithUserId == request.auth.uid || 
     resource.data.boardOwnerId == request.auth.uid);
  allow create: if request.auth != null && 
    request.resource.data.boardOwnerId == request.auth.uid;
  allow update, delete: if request.auth != null && 
    (resource.data.boardOwnerId == request.auth.uid || 
     resource.data.sharedWithUserId == request.auth.uid);
}

// Notifications
match /notifications/{notificationId} {
  allow read, update, delete: if request.auth != null && 
    resource.data.userId == request.auth.uid;
  allow create: if request.auth != null;
}

// Board presence
match /boardPresence/{presenceId} {
  allow read: if request.auth != null;
  allow create, update: if request.auth != null && 
    request.resource.data.userId == request.auth.uid;
  allow delete: if request.auth != null && 
    resource.data.userId == request.auth.uid;
}

// Update boards rules to allow shared users
match /boards/{boardId} {
  function isSharedWith() {
    return request.auth != null && 
      request.auth.uid in resource.data.sharedWith;
  }
  
  allow read: if 
    isDemoBoard() || 
    isOwner(resource.data.userId) || 
    isSharedWith();
  
  allow update: if 
    isOwner(resource.data.userId) || 
    (isSharedWith() && hasEditorPermission());
}
```

## 6. User Interface Updates

### 6.1 UserMenu Updates
- Add notifications icon with badge
- Show notifications dropdown
- Add "Shared Boards" section (optional, future)

### 6.2 WhiteboardPage Updates
- Add CollaboratorsBar at top
- Show "Shared with" indicator
- Disable editing if user is viewer (not editor)

### 6.3 SavedWhiteboardsMenu Updates
- Add "Share" button to board actions
- Show shared indicator on shared boards
- Filter option: "My Boards" vs "Shared with Me"

## 7. Implementation Phases

### Phase 1: Basic Sharing (MVP)
1. Create sharing service and database schema
2. Build ShareBoardModal component
3. Add share button to UI
4. Update Firestore rules
5. Test sharing flow

### Phase 2: Notifications
1. Create notifications service
2. Build Notifications component
3. Integrate into UserMenu
4. Create notifications on share events
5. Test notification flow

### Phase 3: Presence & Collaboration UI
1. Create collaboration service
2. Build CollaboratorsBar component
3. Implement presence tracking
4. Add to WhiteboardPage
5. Test real-time presence

### Phase 4: Real-time Board Sync (Advanced)
1. Implement Firestore listeners for board content
2. Add conflict resolution
3. Show "others editing" indicators
4. Optimize for performance
5. Test multi-user editing

## 8. Technical Considerations

### 8.1 Performance
- Limit presence updates (throttle to 30s)
- Use Firestore queries with limits
- Paginate notifications
- Debounce board content updates

### 8.2 Security
- Verify user email before sharing
- Validate permissions on every operation
- Sanitize user input
- Rate limit sharing operations

### 8.3 Error Handling
- Handle offline scenarios gracefully
- Show clear error messages
- Retry failed operations
- Log errors for debugging

### 8.4 User Experience
- Show loading states
- Provide feedback for all actions
- Handle edge cases (user not found, already shared, etc.)
- Smooth animations for presence updates

## 9. Testing Checklist

- [ ] Share board with existing user
- [ ] Share board with non-existent user (pending invite)
- [ ] Accept board share
- [ ] Remove collaborator
- [ ] Change permission level
- [ ] View shared board as viewer
- [ ] Edit shared board as editor
- [ ] Receive notification on share
- [ ] Mark notification as read
- [ ] See active collaborators
- [ ] Presence updates in real-time
- [ ] Clean up presence on leave
- [ ] Handle multiple simultaneous users
- [ ] Test Firestore security rules

## 10. Future Enhancements

- Shareable links (public/private)
- Comments on boards
- Version history
- Cursor tracking (show where others are)
- Live cursors with names
- Activity feed
- Email notifications
- Board templates sharing
- Team workspaces


