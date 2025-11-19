const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 5000;

// Initialize Socket.io with CORS support
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? ['https://aimindmap.netlify.app', 'https://www.aimindmap.netlify.app']
      : ['http://localhost:3000', 'http://localhost:8888'],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB connection (commented out until we have the connection string)
// mongoose.connect(process.env.MONGODB_URI)
//   .then(() => console.log('Connected to MongoDB'))
//   .catch((error) => console.error('MongoDB connection error:', error));

// Basic route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the MindMap API' });
});

// API routes will be added here
// app.use('/api/mindmaps', require('./routes/mindmap.routes'));

// Socket.io connection handling for real-time cursor tracking
const boardUsers = new Map(); // boardId -> Set of socketIds
const userSessions = new Map(); // socketId -> { boardId, userId, userData }

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Join a board room for cursor tracking
  socket.on('join-board', ({ boardId, userId, userData }) => {
    try {
      // Leave previous board if any
      const previousSession = userSessions.get(socket.id);
      if (previousSession && previousSession.boardId !== boardId) {
        socket.leave(`board:${previousSession.boardId}`);
        const previousBoardUsers = boardUsers.get(previousSession.boardId);
        if (previousBoardUsers) {
          previousBoardUsers.delete(socket.id);
          if (previousBoardUsers.size === 0) {
            boardUsers.delete(previousSession.boardId);
          }
        }
      }

      // Join new board
      socket.join(`board:${boardId}`);
      
      // Track user session
      userSessions.set(socket.id, {
        boardId,
        userId,
        userData: {
          userName: userData.userName || userData.displayName || userData.email,
          userEmail: userData.email,
          userPhotoURL: userData.photoURL || null,
          cursorColor: userData.cursorColor || null
        }
      });

      // Track board users
      if (!boardUsers.has(boardId)) {
        boardUsers.set(boardId, new Set());
      }
      boardUsers.get(boardId).add(socket.id);

      // Notify others in the board about the new user
      socket.to(`board:${boardId}`).emit('user-joined', {
        userId,
        userData: userSessions.get(socket.id).userData
      });

      // Send current users in the board to the new user
      const currentUsers = Array.from(boardUsers.get(boardId))
        .filter(socketId => socketId !== socket.id && userSessions.has(socketId))
        .map(socketId => {
          const session = userSessions.get(socketId);
          return {
            userId: session.userId,
            userData: session.userData
          };
        });
      
      socket.emit('board-users', currentUsers);

      console.log(`User ${userId} joined board ${boardId}`);
    } catch (error) {
      console.error('Error joining board:', error);
      socket.emit('error', { message: 'Failed to join board' });
    }
  });

  // Handle cursor position updates
  socket.on('cursor-move', ({ boardId, position }) => {
    try {
      const session = userSessions.get(socket.id);
      if (session && session.boardId === boardId) {
        // Broadcast cursor position to all other users in the board
        socket.to(`board:${boardId}`).emit('cursor-update', {
          userId: session.userId,
          position,
          userData: session.userData
        });
      }
    } catch (error) {
      console.error('Error handling cursor move:', error);
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    try {
      const session = userSessions.get(socket.id);
      if (session) {
        const { boardId, userId } = session;
        
        // Remove from board users
        const boardUsersSet = boardUsers.get(boardId);
        if (boardUsersSet) {
          boardUsersSet.delete(socket.id);
          if (boardUsersSet.size === 0) {
            boardUsers.delete(boardId);
          }
        }

        // Notify others that user left
        socket.to(`board:${boardId}`).emit('user-left', { userId });
        
        // Remove session
        userSessions.delete(socket.id);

        console.log(`User ${userId} left board ${boardId}`);
      }
    } catch (error) {
      console.error('Error handling disconnect:', error);
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

const startServer = () => {
  server.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log(`WebSocket server ready for real-time cursor tracking`);
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${port} is busy, trying ${port + 1}`);
      setTimeout(() => {
        server.listen(port + 1);
      }, 1000);
    }
  });
};

startServer();
