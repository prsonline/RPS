// server.js - Main entry for RPS Backend (Node.js/Express/MongoDB/Socket.io)
// Yêu cầu cài đủ package (xem package.json mẫu)
// Đảm bảo có file .env local khi chạy máy mình hoặc cấu hình Env Variables khi deploy lên Render

require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const mongoose   = require('mongoose');
const http       = require('http');
const socketio   = require('socket.io');

// --- Import routes ---
const authRoutes        = require('./routes/auth');
const userRoutes        = require('./routes/user');
const gameRoutes        = require('./routes/game');
const leaderboardRoutes = require('./routes/leaderboard');

const app    = express();
const server = http.createServer(app);
const io     = socketio(server, { cors: { origin: '*' } });

// ==== Middlewares ====
app.use(cors({ origin: '*' }));
app.use(express.json());

// ==== Use routes ====
app.use('/api/auth',        authRoutes);
app.use('/api/user',        userRoutes);
app.use('/api/game',        gameRoutes);
app.use('/api/leaderboard', leaderboardRoutes);

// ==== Connect MongoDB Atlas ====
mongoose.connect(process.env.MONGO_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(()=>console.log('✅ MongoDB connected'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// ==== Socket.io state ====
let onlineUsers = {}; // { userId: socket.id }
let searchQueue = []; // [{ userId, socketId }]
let rooms = {};       // { [roomId]: {players: [userId,...], ...} }

// ==== SOCKET.IO: Trao đổi trạng thái online, tìm trận, phòng đấu ====
io.on('connection', socket => {
  // Khi user vừa login/gia nhập
  socket.on('user-online', ({ userId }) => {
    onlineUsers[userId] = socket.id;
    io.emit('user-online-list', Object.keys(onlineUsers));
  });

  // Khi user rời đi/logout
  socket.on('user-offline', ({ userId }) => {
    delete onlineUsers[userId];
    io.emit('user-online-list', Object.keys(onlineUsers));
  });

  // Tìm trận ngẫu nhiên
  socket.on('find-match', ({ userId }) => {
    if (searchQueue.length) {
      const peer = searchQueue.shift();
      const roomId = Math.random().toString(36).substr(2, 8);
      rooms[roomId] = { players: [userId, peer.userId] };
      io.to(socket.id).emit('match-found', { roomId, rival: peer.userId });
      io.to(peer.socketId).emit('match-found', { roomId, rival: userId });
    } else {
      searchQueue.push({ userId, socketId: socket.id });
      socket.emit('finding');
    }
  });

  // Tạo phòng thách đấu (link)
  socket.on('create-challenge-room', ({ userId }) => {
    const roomId = Math.random().toString(36).substr(2, 8).toUpperCase();
    rooms[roomId] = { players: [userId], isChallenge: true };
    socket.emit('challenge-room-created', { roomId, link: `/play?challenge_to=${roomId}` });
  });

  // Tham gia phòng thách đấu qua link/mã phòng
  socket.on('join-challenge-room', ({ roomId, userId }) => {
    if (!rooms[roomId]) return socket.emit('challenge-room-error', 'Room not found');
    if (rooms[roomId].players.length >= 2) return socket.emit('challenge-room-error', 'Room full');
    rooms[roomId].players.push(userId);
    io.in(roomId).emit('both-ready', { roomId, players: rooms[roomId].players });
    socket.emit('joined-challenge-room', { roomId });
  });

  // Khi socket disconnect/bị mất kết nối
  socket.on('disconnect', () => {
    for (let [userId, sid] of Object.entries(onlineUsers)) {
      if (sid === socket.id) delete onlineUsers[userId];
    }
    // Clean trong searchQueue nếu có
    searchQueue = searchQueue.filter(item => item.socketId !== socket.id);
    // Không chủ động emit lại danh sách user online ở đây (user khác sẽ cập nhật khi có event mới)
  });
});

// ==== Start server ====
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Server running on PORT ${PORT}`);
});
