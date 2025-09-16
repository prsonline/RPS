require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const http = require('http');
const socketio = require('socket.io');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const gameRoutes = require('./routes/game');
const leaderboardRoutes = require('./routes/leaderboard');

const app = express();
app.use(express.json());
app.use(cors({origin: '*'}));

// Tích hợp các routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/game', gameRoutes);
app.use('/api/leaderboard', leaderboardRoutes);

mongoose.connect(process.env.MONGO_URL, { useNewUrlParser:true, useUnifiedTopology:true })
  .then(()=>console.log('MongoDB connected!'));

const server = http.createServer(app);
const io = socketio(server, { cors:{ origin:'*'} });

// In-memory state cho demo (phòng đấu, trạng thái online, queue tìm trận, ...)
let onlineUsers = {}, searchQueue = [], rooms = {};

io.on('connection', socket => {
  socket.on('user-online', async ({ userId }) => {
    onlineUsers[userId] = socket.id;
    io.emit('user-online-list', Object.keys(onlineUsers));
  });
  socket.on('user-offline', ({userId}) => {
    delete onlineUsers[userId];
    io.emit('user-online-list', Object.keys(onlineUsers));
  });

  socket.on('find-match', ({ userId }) => {
    if (searchQueue.length) {
      const peer = searchQueue.shift();
      const roomId = Math.random().toString(36).substring(2,10);
      rooms[roomId] = {players: [userId, peer.userId]};
      io.to(socket.id).emit('match-found', { roomId, rival: peer.userId });
      io.to(peer.socketId).emit('match-found', { roomId, rival: userId });
    } else {
      searchQueue.push({ userId, socketId: socket.id });
      socket.emit('finding');
    }
  });

  // Challenge room
  socket.on('create-challenge-room', ({userId})=>{
    const roomId = Math.random().toString(36).substr(2,7).toUpperCase();
    rooms[roomId] = {players:[userId], isChallenge:true};
    socket.emit('challenge-room-created', {roomId, link: `/play?challenge_to=${roomId}`});
  });
  socket.on('join-challenge-room', ({roomId, userId})=>{
    if(!rooms[roomId]) return socket.emit('challenge-room-error', 'Room not found');
    if(rooms[roomId].players.length >= 2) return socket.emit('challenge-room-error', 'Room full');
    rooms[roomId].players.push(userId);
    io.in(roomId).emit('both-ready', {roomId, players: rooms[roomId].players });
    socket.emit('joined-challenge-room', {roomId});
  });

  socket.on('disconnect', () => {
    for(let userId in onlineUsers)
      if(onlineUsers[userId] === socket.id) delete onlineUsers[userId];
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log('Server running on ' + PORT));
