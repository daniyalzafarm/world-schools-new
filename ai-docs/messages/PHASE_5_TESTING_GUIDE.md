# Phase 5: Real-time Features - Testing Guide

This guide provides step-by-step instructions for testing all Phase 5 real-time features.

---

## 🔧 Prerequisites

1. **Start Infrastructure**:
   ```bash
   # Start Redis and PostgreSQL
   docker-compose up -d redis postgres
   ```

2. **Start NestJS Server**:
   ```bash
   nx serve wc-nest-api
   ```

3. **Install Socket.io Client** (for testing):
   ```bash
   npm install socket.io-client
   ```

---

## 🧪 Test 1: Real-time Message Delivery

### Objective
Verify messages are delivered to all participants in real-time with <100ms latency.

### Steps

1. **Create Test Script** (`test-message-delivery.js`):
   ```javascript
   const io = require('socket.io-client');
   
   const socket1 = io('http://localhost:3000', {
     auth: { token: 'USER_1_JWT_TOKEN' }
   });
   
   const socket2 = io('http://localhost:3000', {
     auth: { token: 'USER_2_JWT_TOKEN' }
   });
   
   socket1.on('connect', () => {
     console.log('User 1 connected');
     socket1.emit('conversation:join', { conversationId: 'CONVERSATION_ID' });
   });
   
   socket2.on('connect', () => {
     console.log('User 2 connected');
     socket2.emit('conversation:join', { conversationId: 'CONVERSATION_ID' });
   });
   
   socket2.on('message:new', (data) => {
     const latency = Date.now() - new Date(data.publishedAt).getTime();
     console.log(`Message received! Latency: ${latency}ms`);
     console.log('Message:', data.message);
   });
   ```

2. **Send Message via REST API**:
   ```bash
   curl -X POST http://localhost:3000/api/messages \
     -H "Authorization: Bearer USER_1_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "conversationId": "CONVERSATION_ID",
       "senderId": "USER_1_ID",
       "senderType": "USER",
       "content": "Hello, World!",
       "contentType": "TEXT",
       "idempotencyKey": "unique-key-123"
     }'
   ```

3. **Verify**:
   - ✅ User 2 receives message via WebSocket
   - ✅ Latency is <100ms
   - ✅ Message contains all expected fields

---

## 🧪 Test 2: Delivery Receipts

### Objective
Verify delivery receipts are created and broadcast when client receives message.

### Steps

1. **Listen for Delivery Receipts**:
   ```javascript
   socket1.on('receipt:delivered', (data) => {
     console.log('Delivery receipt received:', data);
     console.log('Delivered to:', data.userId);
     console.log('Delivery latency:', data.deliveryLatencyMs, 'ms');
   });
   ```

2. **Send Delivery Receipt from Client**:
   ```javascript
   socket2.on('message:new', (data) => {
     const deliveryLatency = Date.now() - new Date(data.message.sentAt).getTime();
     
     socket2.emit('message:delivered', {
       messageId: data.message.id,
       conversationId: data.conversationId,
       deliveryLatencyMs: deliveryLatency
     });
   });
   ```

3. **Verify**:
   - ✅ Delivery receipt created in database
   - ✅ Sender receives `receipt:delivered` event
   - ✅ Delivery latency tracked correctly
   - ✅ Message status updated to DELIVERED

---

## 🧪 Test 3: Read Receipts & Unread Count

### Objective
Verify read receipts update unread count and lastReadAt timestamp.

### Steps

1. **Check Initial Unread Count**:
   ```bash
   curl http://localhost:3000/api/conversations/CONVERSATION_ID \
     -H "Authorization: Bearer USER_2_JWT_TOKEN"
   ```
   Note the `unreadCount` for User 2.

2. **Mark Message as Read**:
   ```javascript
   socket2.emit('message:read', {
     messageId: 'MESSAGE_ID',
     conversationId: 'CONVERSATION_ID'
   });
   ```

3. **Listen for Read Receipt**:
   ```javascript
   socket1.on('receipt:read', (data) => {
     console.log('Read receipt received:', data);
     console.log('Read by:', data.userId);
     console.log('Read at:', data.readAt);
   });
   ```

4. **Verify**:
   - ✅ Read receipt created in database
   - ✅ Unread count decremented by 1
   - ✅ `lastReadAt` timestamp updated
   - ✅ Sender receives `receipt:read` event
   - ✅ Duplicate read receipts handled (upsert)

---

## 🧪 Test 4: Typing Indicators

### Objective
Verify typing indicators broadcast and auto-clear after 5 seconds.

### Steps

1. **Start Typing**:
   ```javascript
   socket1.emit('typing:start', {
     conversationId: 'CONVERSATION_ID'
   });
   ```

2. **Listen for Typing Events**:
   ```javascript
   socket2.on('typing:start', (data) => {
     console.log('User started typing:', data.userId, data.userName);
   });
   
   socket2.on('typing:stop', (data) => {
     console.log('User stopped typing:', data.userId);
   });
   ```

3. **Wait 5 Seconds**:
   - Verify typing indicator auto-clears

4. **Stop Typing Manually**:
   ```javascript
   socket1.emit('typing:stop', {
     conversationId: 'CONVERSATION_ID'
   });
   ```

5. **Verify**:
   - ✅ Typing indicator broadcasts to all participants
   - ✅ Auto-clears after 5 seconds
   - ✅ Manual stop works correctly

---

## 🧪 Test 5: Presence Status

### Objective
Verify presence status updates on connect/disconnect.

### Steps

1. **Listen for Presence Updates**:
   ```javascript
   socket2.on('presence:update', (data) => {
     console.log('Presence update:', data.userId, data.status);
   });
   ```

2. **Update Presence**:
   ```javascript
   socket1.emit('presence:update', {
     status: 'away'
   });
   ```

3. **Disconnect**:
   ```javascript
   socket1.disconnect();
   ```

4. **Verify**:
   - ✅ Presence updates broadcast to all clients
   - ✅ Status changes to 'offline' on disconnect
   - ✅ `lastSeenAt` timestamp updated

---

## 🧪 Test 6: Horizontal Scaling

### Objective
Verify Redis pub/sub works across multiple server replicas.

### Steps

1. **Start Multiple Server Instances**:
   ```bash
   # Terminal 1
   PORT=3000 nx serve wc-nest-api
   
   # Terminal 2
   PORT=3001 nx serve wc-nest-api
   ```

2. **Connect Clients to Different Replicas**:
   ```javascript
   const socket1 = io('http://localhost:3000', { auth: { token: 'USER_1_JWT' } });
   const socket2 = io('http://localhost:3001', { auth: { token: 'USER_2_JWT' } });
   ```

3. **Send Message from Replica 1**:
   - Verify User 2 (connected to Replica 2) receives message

4. **Verify**:
   - ✅ Messages broadcast across replicas
   - ✅ Receipts broadcast across replicas
   - ✅ Typing indicators work across replicas
   - ✅ Presence updates work across replicas

---

## 📊 Performance Testing

### Load Test Script
```javascript
const io = require('socket.io-client');

const NUM_CLIENTS = 100;
const clients = [];

for (let i = 0; i < NUM_CLIENTS; i++) {
  const socket = io('http://localhost:3000', {
    auth: { token: `USER_${i}_JWT` }
  });
  
  socket.on('message:new', (data) => {
    const latency = Date.now() - new Date(data.publishedAt).getTime();
    console.log(`Client ${i} received message in ${latency}ms`);
  });
  
  clients.push(socket);
}
```

### Metrics to Track
- Average delivery latency
- 95th percentile latency
- 99th percentile latency
- Messages per second
- Concurrent connections

---

## ✅ Success Criteria

- [ ] Messages delivered in <100ms
- [ ] Delivery receipts created correctly
- [ ] Read receipts update unread count
- [ ] Typing indicators auto-clear after 5 seconds
- [ ] Presence status accurate
- [ ] System handles 100+ concurrent connections
- [ ] Redis pub/sub works across replicas
- [ ] No memory leaks or connection issues

