const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// CORS setup
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());

// Health check cho Render
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'RPS Backend is running!',
        timestamp: new Date().toISOString()
    });
});

// Game state
const activeRooms = new Map();
const activeUsers = new Map();

// Socket.io events
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    socket.on('test', (data) => {
        console.log('Test received:', data);
        socket.emit('test-response', { message: 'Server received: ' + data.message });
    });
    
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
