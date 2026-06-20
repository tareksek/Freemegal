
// server.js
const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const path = require('path');
// تقديم الملفات الثابتة من مجلد public
app.use(express.static(path.join(__dirname, 'public')));
// ---------- حالة السيرفر ----------
// قائمة انتظار المستخدمين المنتظرين (بدون شريك)
const waitingUsers = [];
// خريطة لجميع العملاء النشطين (id -> socket)
const clients = new Map();

// توليد معرف عشوائي بسيط
function generateId() {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

// دالة لمحاولة تزويج مستخدمين من قائمة الانتظار
function tryMatch() {
  if (waitingUsers.length < 2) return;

  // اختر أول اثنين (يمكن جعله عشوائيًا بتبديل العناصر)
  const user1 = waitingUsers.shift();
  const user2 = waitingUsers.shift();

  // تعيين الأدوار بشكل عشوائي
  const role1 = Math.random() < 0.5 ? 'initiator' : 'receiver';
  const role2 = role1 === 'initiator' ? 'receiver' : 'initiator';

  // ربط الشريكين ببعضهما
  user1.socket.partnerId = user2.id;
  user2.socket.partnerId = user1.id;

  // إعلام الطرف الأول
  user1.socket.send(JSON.stringify({
    type: 'matched',
    role: role1,
    partnerId: user2.id
  }));

  // إعلام الطرف الثاني
  user2.socket.send(JSON.stringify({
    type: 'matched',
    role: role2,
    partnerId: user1.id
  }));
}

// إزالة مستخدم من قائمة الانتظار إذا كان موجودًا
function removeFromWaiting(socketId) {
  const index = waitingUsers.findIndex(u => u.id === socketId);
  if (index !== -1) {
    waitingUsers.splice(index, 1);
  }
}

// إرسال رسالة إلى الشريك إذا كان متصلاً
function sendToPartner(socket, data) {
  if (socket.partnerId && clients.has(socket.partnerId)) {
    const partner = clients.get(socket.partnerId);
    partner.send(JSON.stringify(data));
  }
}

// معالجة انقطاع اتصال عميل
function handleDisconnect(socket) {
  const id = socket.id;
  // إعلام الشريك إن وجد
  if (socket.partnerId) {
    sendToPartner(socket, { type: 'partnerDisconnected' });
    // حذف إشارة الشريك من الطرف الآخر
    const partner = clients.get(socket.partnerId);
    if (partner) {
      partner.partnerId = null;
    }
  }
  // إزالة من قائمة الانتظار إن كان فيها
  removeFromWaiting(id);
  // إزالة من قائمة العملاء
  clients.delete(id);
}

// ---------- WebSocket ----------
wss.on('connection', (socket) => {
  // تعيين معرف فريد للاتصال
  socket.id = generateId();
  clients.set(socket.id, socket);

  console.log(`Client connected: ${socket.id}`);

  // استقبال الرسائل من العميل
  socket.on('message', (message) => {
    let data;
    try {
      data = JSON.parse(message);
    } catch (e) {
      return;
    }

    switch (data.type) {
      case 'find':
        // إذا كان المستخدم موجودًا مسبقًا في الانتظار نتجاهل
        if (waitingUsers.some(u => u.id === socket.id)) return;
        // إذا كان لديه شريك حالي نبلغه بأنه لا يمكن البحث أثناء الاتصال
        if (socket.partnerId) {
          socket.send(JSON.stringify({ type: 'error', message: 'You are already connected.' }));
          return;
        }
        // أضف إلى الانتظار
        waitingUsers.push({ socket, id: socket.id });
        // أبلغ المستخدم بأنه قيد البحث
        socket.send(JSON.stringify({ type: 'searching' }));
        // حاول التطابق
        tryMatch();
        break;

      case 'next':
        // قطع الاتصال الحالي والعودة للبحث
        if (socket.partnerId) {
          // إعلام الشريك
          sendToPartner(socket, { type: 'partnerDisconnected' });
          // حذف إشارة الشريك من الطرف الآخر
          const partner = clients.get(socket.partnerId);
          if (partner) {
            partner.partnerId = null;
          }
          socket.partnerId = null;
        }
        // إزالة من الانتظار إذا كان هناك (يجب ألا يكون، لكن للاحتياط)
        removeFromWaiting(socket.id);
        // إعادة إدخال العميل إلى قائمة الانتظار
        waitingUsers.push({ socket, id: socket.id });
        socket.send(JSON.stringify({ type: 'searching' }));
        tryMatch();
        break;

      case 'disconnect':
        // قطع الاتصال تمامًا وإنهاء الجلسة
        if (socket.partnerId) {
          sendToPartner(socket, { type: 'partnerDisconnected' });
          const partner = clients.get(socket.partnerId);
          if (partner) {
            partner.partnerId = null;
          }
          socket.partnerId = null;
        }
        removeFromWaiting(socket.id);
        // نترك العميل يغلق من جانبه، فقط نرسل تأكيد
        socket.send(JSON.stringify({ type: 'disconnected' }));
        break;

      // رسائل الإشارة (WebRTC signaling)
      case 'offer':
      case 'answer':
      case 'ice-candidate':
        // تمرير الرسالة إلى الشريك مباشرة
        if (socket.partnerId && clients.has(socket.partnerId)) {
          sendToPartner(socket, {
            type: data.type,
            payload: data.payload
          });
        }
        break;
    }
  });

  // عند قطع اتصال WebSocket
  socket.on('close', () => {
    console.log(`Client disconnected: ${socket.id}`);
    handleDisconnect(socket);
  });
});

// بدء الخادم
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
