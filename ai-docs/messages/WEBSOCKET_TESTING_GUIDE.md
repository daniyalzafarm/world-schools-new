# WebSocket Testing Guide

This guide provides instructions for testing the WebSocket Gateway implementation.

---

## 🔧 Prerequisites

1. **Backend server running**: `nx serve wc-nest-api`
2. **Redis running**: `docker-compose up -d redis`
3. **PostgreSQL running**: `docker-compose up -d postgres`
4. **Valid JWT token**: Obtain from login endpoint

---

## 🧪 Testing Tools

### Option 1: Socket.io Client (Node.js)

Install Socket.io client:
```bash
npm install socket.io-client
```

Create test script `test-websocket.js`:
```javascript
const { io } = require('socket.io-client')

// Replace with your JWT token
const JWT_TOKEN = 'your-jwt-token-here'

const socket = io('http://localhost:3000/messages', {
  auth: {
    token: JWT_TOKEN
  },
  transports: ['websocket', 'polling']
})

socket.on('connect', () => {
  console.log('✅ Connected:', socket.id)
})

socket.on('disconnect', () => {
  console.log('❌ Disconnected')
})

socket.on('message:new', (data) => {
  console.log('📨 New message:', data)
})

socket.on('typing:start', (data) => {
  console.log('⌨️  Typing started:', data)
})

socket.on('typing:stop', (data) => {
  console.log('⌨️  Typing stopped:', data)
})

socket.on('presence:update', (data) => {
  console.log('👤 Presence update:', data)
})

// Test joining a conversation
socket.emit('conversation:join', { conversationId: 'your-conversation-id' }, (response) => {
  console.log('Join response:', response)
})

// Test typing indicator
socket.emit('typing:start', { conversationId: 'your-conversation-id' }, (response) => {
  console.log('Typing start response:', response)
})

setTimeout(() => {
  socket.emit('typing:stop', { conversationId: 'your-conversation-id' }, (response) => {
    console.log('Typing stop response:', response)
  })
}, 3000)
```

Run the test:
```bash
node test-websocket.js
```

---

### Option 2: Browser Console

Open browser console and paste:
```javascript
// Load Socket.io client from CDN
const script = document.createElement('script')
script.src = 'https://cdn.socket.io/4.5.4/socket.io.min.js'
document.head.appendChild(script)

script.onload = () => {
  const JWT_TOKEN = 'your-jwt-token-here'
  
  const socket = io('http://localhost:3000/messages', {
    auth: { token: JWT_TOKEN },
    transports: ['websocket', 'polling']
  })
  
  socket.on('connect', () => console.log('✅ Connected:', socket.id))
  socket.on('disconnect', () => console.log('❌ Disconnected'))
  socket.on('message:new', (data) => console.log('📨 New message:', data))
  socket.on('typing:start', (data) => console.log('⌨️  Typing:', data))
  socket.on('presence:update', (data) => console.log('👤 Presence:', data))
  
  // Make socket available globally
  window.testSocket = socket
}

// After socket connects, test events:
testSocket.emit('conversation:join', { conversationId: 'conv-id' }, console.log)
testSocket.emit('typing:start', { conversationId: 'conv-id' }, console.log)
testSocket.emit('presence:update', { status: 'online' }, console.log)
```

---

### Option 3: Postman (WebSocket Support)

1. Open Postman
2. Create new WebSocket request
3. URL: `ws://localhost:3000/messages`
4. Add query parameter: `token=your-jwt-token`
5. Connect
6. Send events:
```json
{
  "event": "conversation:join",
  "data": { "conversationId": "your-conversation-id" }
}
```

---

## 📝 Test Scenarios

### 1. Authentication Test

**Test**: Connect with valid token
```javascript
socket.emit('authenticate', { token: 'valid-jwt-token' }, (response) => {
  console.log(response) // Should be: { success: true, userId: '...' }
})
```

**Test**: Connect with invalid token
```javascript
socket.emit('authenticate', { token: 'invalid-token' }, (response) => {
  console.log(response) // Should be: { success: false, error: '...' }
})
```

---

### 2. Conversation Room Test

**Test**: Join conversation
```javascript
socket.emit('conversation:join', { conversationId: 'conv-123' }, (response) => {
  console.log(response) // Should be: { success: true, conversationId: 'conv-123' }
})
```

**Test**: Leave conversation
```javascript
socket.emit('conversation:leave', { conversationId: 'conv-123' }, (response) => {
  console.log(response) // Should be: { success: true }
})
```

---

### 3. Typing Indicator Test

**Test**: Start typing
```javascript
socket.emit('typing:start', { conversationId: 'conv-123' }, (response) => {
  console.log(response) // Should be: { success: true }
})
```

**Test**: Stop typing
```javascript
socket.emit('typing:stop', { conversationId: 'conv-123' }, (response) => {
  console.log(response) // Should be: { success: true }
})
```

**Test**: Auto-expiration (wait 5 seconds, typing should stop automatically)

---

### 4. Presence Test

**Test**: Update presence to online
```javascript
socket.emit('presence:update', { status: 'online' }, (response) => {
  console.log(response) // Should be: { success: true, status: 'online' }
})
```

**Test**: Update presence to away
```javascript
socket.emit('presence:update', { status: 'away' }, (response) => {
  console.log(response) // Should be: { success: true, status: 'away' }
})
```

---

### 5. Read Receipt Test

**Test**: Mark message as read
```javascript
socket.emit('message:read', { 
  messageId: 'msg-123', 
  conversationId: 'conv-123' 
}, (response) => {
  console.log(response) // Should be: { success: true }
})
```

---

## 🔍 Debugging

### Check WebSocket Server Logs
```bash
# Watch NestJS logs
nx serve wc-nest-api | grep "WebSocket"
```

### Check Redis Pub/Sub
```bash
# Monitor Redis channels
docker exec -it redis redis-cli
> SUBSCRIBE messages:new typing:events presence:updates
```

### Check Connected Clients
```bash
# In Redis CLI
> KEYS presence:*
> GET presence:user-id
```

---

## ✅ Expected Results

### Successful Connection
```
✅ Connected: socket-id-here
✅ User user-id authenticated successfully
```

### Successful Event
```
{ success: true, ... }
```

### Failed Event
```
{ success: false, error: 'Error message' }
```

---

## 🐛 Common Issues

### Issue: Connection refused
**Solution**: Ensure backend server is running on port 3000

### Issue: CORS error
**Solution**: Add your origin to `CORS_ORIGINS` environment variable

### Issue: Authentication failed
**Solution**: Verify JWT token is valid and not expired

### Issue: Cannot join conversation
**Solution**: Verify user is a participant in the conversation

---

## 📊 Performance Testing

### Load Test with Artillery
```yaml
# artillery-websocket.yml
config:
  target: "http://localhost:3000"
  phases:
    - duration: 60
      arrivalRate: 10
  socketio:
    transports: ["websocket"]

scenarios:
  - name: "WebSocket Connection Test"
    engine: socketio
    flow:
      - emit:
          channel: "authenticate"
          data:
            token: "your-jwt-token"
      - think: 1
      - emit:
          channel: "conversation:join"
          data:
            conversationId: "test-conv"
```

Run test:
```bash
artillery run artillery-websocket.yml
```

---

## 🎯 Success Criteria

- ✅ Connection establishes within 1 second
- ✅ Authentication completes within 500ms
- ✅ Events broadcast within 100ms
- ✅ Typing indicators auto-expire after 5 seconds
- ✅ Presence updates within 50ms
- ✅ No memory leaks after 1000+ connections

