
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// استخدام مسار مطلق لمجلد public
app.use(express.static(path.join(__dirname, 'public')));

// ---------- حالة السيرفر ----------
const waitingUsers = [];
const clients = new Map();

function generateId() {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

function tryMatch() {
  if (waitingUsers.length < 2) return;
  const user1 = waitingUsers.shift();
  const user2 = waitingUsers.shift();

  const role1 = Math.random() < 0.5 ? 'initiator' : 'receiver';
  const role2 = role1 === 'initiator' ? 'receiver' : 'initiator';

  user1.socket.partnerId = user2.id;
  user2.socket.partnerId = user1.id;

  user1.socket.send(JSON.stringify({ type: 'matched', role: role1, partnerId: user2.id }));
  user2.socket.send(JSON.stringify({ type: 'matched', role: role2, partnerId: user1.id }));
}

function removeFromWaiting(socketId) {
  const index = waitingUsers.findIndex(u => u.id === socketId);
  if (index !== -1) waitingUsers.splice(index, 1);
}

function sendToPartner(socket, data) {
  if (socket.partnerId && clients.has(socket.partnerId)) {
    clients.get(socket.partnerId).send(JSON.stringify(data));
  }
}

function handleDisconnect(socket) {
  const id = socket.id;
  if (socket.partnerId) {
    sendToPartner(socket, { type: 'partnerDisconnected' });
    const partner = clients.get(socket.partnerId);
    if (partner) partner.partnerId = null;
  }
  removeFromWaiting(id);
  clients.delete(id);
}

wss.on('connection', (socket) => {
  socket.id = generateId();
  clients.set(socket.id, socket);
  console.log(`Client connected: ${socket.id}`);

  socket.on('message', (message) => {
    let data;
    try { data = JSON.parse(message); } catch (e) { return; }

    switch (data.type) {
      case 'find':
        if (waitingUsers.some(u => u.id === socket.id)) return;
        if (socket.partnerId) {
          socket.send(JSON.stringify({ type: 'error', message: 'You are already connected.' }));
          return;
        }
        waitingUsers.push({ socket, id: socket.id });
        socket.send(JSON.stringify({ type: 'searching' }));
        tryMatch();
        break;

      case 'next':
        if (socket.partnerId) {
          sendToPartner(socket, { type: 'partnerDisconnected' });
          const partner = clients.get(socket.partnerId);
          if (partner) partner.partnerId = null;
          socket.partnerId = null;
        }
        removeFromWaiting(socket.id);
        waitingUsers.push({ socket, id: socket.id });
        socket.send(JSON.stringify({ type: 'searching' }));
        tryMatch();
        break;

      case 'disconnect':
        if (socket.partnerId) {
          sendToPartner(socket, { type: 'partnerDisconnected' });
          const partner = clients.get(socket.partnerId);
          if (partner) partner.partnerId = null;
          socket.partnerId = null;
        }
        removeFromWaiting(socket.id);
        socket.send(JSON.stringify({ type: 'disconnected' }));
        break;

      case 'offer':
      case 'answer':
      case 'ice-candidate':
        if (socket.partnerId && clients.has(socket.partnerId)) {
          sendToPartner(socket, { type: data.type, payload: data.payload });
        }
        break;
    }
  });

  socket.on('close', () => {
    console.log(`Client disconnected: ${socket.id}`);
    handleDisconnect(socket);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
