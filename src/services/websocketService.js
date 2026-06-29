import { io } from 'socket.io-client';

class WebSocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.currentBoardId = null;
    this.listeners = new Map();
  }

  // Get WebSocket server URL.
  // Set REACT_APP_WS_URL to enable real-time collaboration. If unset, collaboration features are disabled.
  getServerUrl() {
    if (process.env.NODE_ENV === 'development') {
      return 'http://localhost:5000';
    }
    return process.env.REACT_APP_WS_URL || null;
  }

  // Connect to WebSocket server
  connect() {
    if (this.socket?.connected) {
      return;
    }

    const serverUrl = this.getServerUrl();
    if (!serverUrl) {
      return;
    }

    this.socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
    });

    this.socket.on('connect', () => {
      console.log('WebSocket connected:', this.socket.id);
      this.isConnected = true;
      this.emit('connection-status', { connected: true });
      
      // Set up listeners for all registered events
      this.listeners.forEach((callbacks, eventName) => {
        if (eventName !== 'connection-status') {
          this.socket.on(eventName, (...args) => {
            this.emit(eventName, ...args);
          });
        }
      });
    });

    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      this.isConnected = false;
      this.emit('connection-status', { connected: false });
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      this.isConnected = false;
      this.emit('connection-status', { connected: false, error });
    });
  }

  // Disconnect from WebSocket server
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.currentBoardId = null;
    }
  }

  // Join a board room
  joinBoard(boardId, userId, userData) {
    if (!this.socket || !this.socket.connected) {
      this.connect();
      if (!this.socket) return;
      this.socket.once('connect', () => {
        this._joinBoard(boardId, userId, userData);
      });
    } else {
      this._joinBoard(boardId, userId, userData);
    }
  }

  _joinBoard(boardId, userId, userData) {
    if (this.currentBoardId === boardId) {
      return; // Already in this board
    }

    this.currentBoardId = boardId;
    this.socket.emit('join-board', {
      boardId,
      userId,
      userData: {
        userName: userData.userName || userData.displayName || userData.email,
        userEmail: userData.email,
        userPhotoURL: userData.photoURL || null,
        cursorColor: userData.cursorColor || null
      }
    });
  }

  // Leave current board
  leaveBoard() {
    if (this.socket && this.currentBoardId) {
      // The server will handle leaving when we disconnect or join a new board
      this.currentBoardId = null;
    }
  }

  // Send cursor position update
  updateCursorPosition(boardId, position) {
    if (this.socket && this.socket.connected && this.currentBoardId === boardId) {
      this.socket.emit('cursor-move', {
        boardId,
        position
      });
    }
  }

  // Subscribe to events
  on(eventName, callback) {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, []);
    }
    this.listeners.get(eventName).push(callback);

    // Set up socket listener if connected and not already listening
    if (this.socket && this.socket.connected && eventName !== 'connection-status') {
      // Check if we already have a listener for this event
      const hasListener = this.socket.hasListeners(eventName);
      if (!hasListener) {
        this.socket.on(eventName, (...args) => {
          this.emit(eventName, ...args);
        });
      }
    }
  }

  // Unsubscribe from events
  off(eventName, callback) {
    const listeners = this.listeners.get(eventName);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
      
      // If no more listeners, remove socket listener
      if (listeners.length === 0 && this.socket && eventName !== 'connection-status') {
        this.socket.off(eventName);
      }
    }
  }

  // Emit event to all listeners
  emit(eventName, ...args) {
    const listeners = this.listeners.get(eventName);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(...args);
        } catch (error) {
          console.error(`Error in listener for ${eventName}:`, error);
        }
      });
    }
  }
}

// Export singleton instance
export const websocketService = new WebSocketService();
export default websocketService;

