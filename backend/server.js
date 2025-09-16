require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
const socketio = require('socket.io');
const authRouter = require('./routes/auth');
const User = require('./models/User');

const app = express();
app.use(cors({ origin: '*', }));
app.use(express.json());
app.use('/api/auth', authRouter);
app.get('/api/leaderboard', async (req, res)=>{
  let users = await User.find({}).sort({point:-1}).select('username point isOnline avatar').limit(50);
  users = users.map((u,i) => ({rank:i+1, username:u.username, point:u.point, online:u.isOnline, avatar: u.avatar}));
  res.json(users);
});

// DB connect
mongoose.connect(process.env.MONGO_URL, { useNewUrlParser:true, useUnifiedTopology:true })
  .then(()=>console.log('DB connected'));

// ROOM/match/player state in ram
let onlineUsers = {}; // { userId: socket.id }
let rooms = {}; // roomid -> {players=[id1,id2], state...}
let searchQueue = []; // [{userId, socketId}]

const server = http.createServer(app);
const io = socketio(server, { cors:{ origin:'*' }});
io.on('connection', socket=>{
  // Login thông báo online
  socket.on('user-online', async ({ userId })=>{
    onlineUsers[userId] = socket.id;
    await User.findByIdAndUpdate(userId, { isOnline:true });
    io.emit('user-online-list', Object.keys(onlineUsers));
  });
  socket.on('user-offline', async ({ userId })=>{
    delete onlineUsers[userId];
    await User.findByIdAndUpdate(userId, { isOnline:false });
    io.emit('user-online-list', Object.keys(onlineUsers));
  });
  // Tìm trận ngẫu nhiên
  socket.on('find-match', ({ userId })=>{
    // Nếu đã có ai trong queue -> pop ghép luôn
    if(searchQueue.length) {
      const partner = searchQueue.shift();
      // Tạo roomId
      const roomId = Math.random().toString(36).substring(2,10);
      rooms[roomId] = {players:[userId, partner.userId]};
      io.to(socket.id).emit('match-found', {roomId, rival: partner.userId });
      io.to(partner.socketId).emit('match-found', {roomId, rival: userId });
    } else {
      searchQueue.push({userId, socketId: socket.id});
      socket.emit('finding');
    }
  });
  // Tạo phòng thách đấu (challenge)
  socket.on('create-challenge-room', ({userId})=>{
    const roomId = Math.random().toString(36).substr(2,7).toUpperCase();
    rooms[roomId] = {players:[userId], isChallenge:true};
    socket.emit('challenge-room-created', {roomId, link: `/play?challenge_to=${roomId}`});
  });
  // Vào room thách đấu
  socket.on('join-challenge-room', ({roomId, userId})=>{
    if(!rooms[roomId]) return socket.emit('challenge-room-error', 'Room not found');
    if(rooms[roomId].players.length>=2) return socket.emit('challenge-room-error','Room full');
    rooms[roomId].players.push(userId);
    io.in(roomId).emit('both-ready',{roomId, players: rooms[roomId].players });
    socket.emit('joined-challenge-room', {roomId});
  });
  socket.on('disconnect', ()=>{
    // cleanup
    for(let userId in onlineUsers) if(onlineUsers[userId]===socket.id) delete onlineUsers[userId];
    // cleanup in searchQueue...
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, ()=>console.log('Listening on ' + PORT));
