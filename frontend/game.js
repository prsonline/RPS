// Xác định backend URL
const getBackendURL = () => {
    if (window.location.hostname === 'localhost') {
        return 'http://localhost:3001';
    }
    return 'https://rps-backend-pm3s.onrender.com/'; // Sẽ update sau
};

// Initialize
let socket;
const statusDiv = document.getElementById('status');
const testBtn = document.getElementById('testBtn');
const messagesDiv = document.getElementById('messages');

function connectToServer() {
    const backendURL = getBackendURL();
    console.log('Connecting to:', backendURL);
    
    socket = io(backendURL);
    
    socket.on('connect', () => {
        statusDiv.textContent = '✅ Đã kết nối!';
        statusDiv.style.color = '#4CAF50';
        testBtn.disabled = false;
        addMessage('Kết nối thành công với server!');
    });
    
    socket.on('disconnect', () => {
        statusDiv.textContent = '❌ Mất kết nối!';
        statusDiv.style.color = '#f44336';
        testBtn.disabled = true;
        addMessage('Mất kết nối với server!');
    });
    
    socket.on('test-response', (data) => {
        addMessage('Server phản hồi: ' + data.message);
    });
}

function addMessage(message) {
    const msgElement = document.createElement('div');
    msgElement.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    msgElement.style.marginBottom = '5px';
    messagesDiv.appendChild(msgElement);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

testBtn.addEventListener('click', () => {
    socket.emit('test', { message: 'Hello from client!' });
    addMessage('Đã gửi test message đến server');
});

// Connect when page loads
document.addEventListener('DOMContentLoaded', connectToServer);
