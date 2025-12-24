const { io } = require('socket.io-client');

console.log('Testing Socket.IO connection with custom path...');

const socket = io('http://localhost:8001', {
  path: '/api/socket.io',
  transports: ['polling', 'websocket'],
  timeout: 5000
});

socket.on('connect', () => {
  console.log('✅ Successfully connected to Socket.IO server!');
  console.log('Socket ID:', socket.id);
  
  // Test a simple room creation
  socket.emit('create_room', {
    room_code: 'TEST123',
    username: 'TestUser'
  });
});

socket.on('room_created', (data) => {
  console.log('✅ Room created successfully:', data);
  socket.disconnect();
  process.exit(0);
});

socket.on('connect_error', (error) => {
  console.log('❌ Connection failed:', error.message);
  process.exit(1);
});

socket.on('error', (error) => {
  console.log('❌ Socket error:', error);
  process.exit(1);
});

// Timeout after 10 seconds
setTimeout(() => {
  console.log('❌ Test timed out');
  socket.disconnect();
  process.exit(1);
}, 10000);