const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------- إعداد البريد ----------
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || ''
  }
});

if (process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter.verify((err, ok) => {
    if (err) console.log('⚠️ فشل الاتصال بالبريد:', err.message);
    else console.log('✅ البريد جاهز');
  });
} else {
  console.log('ℹ️ وضع المحاكاة للبريد – الرموز في الطرفية');
}

const emailCodes = new Map();
function generateCode() { return crypto.randomInt(100000, 999999).toString(); }

app.post('/api/send-code', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'البريد مطلوب' });
  const code = generateCode();
  emailCodes.set(email, { code, expiresAt: Date.now() + 10 * 60 * 1000 });

  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      await transporter.sendMail({
        from: `"دردشة عشوائية" <${process.env.SMTP_USER}>`,
        to: email,
        subject: 'رمز تأكيد البريد',
        html: `<div dir="rtl" style="font-family:Arial; background:#f4f4f4; padding:20px;"><h2>مرحباً</h2><p>رمزك:</p><h1 style="color:#4caf50;">${code}</h1><p>صالح 10 دقائق</p></div>`
      });
      console.log(`📧 رمز إلى ${email}: ${code}`);
      return res.json({ message: 'تم إرسال الرمز إلى بريدك.' });
    } catch (err) {
      console.error('فشل الإرسال:', err);
      return res.status(500).json({ error: 'فشل إرسال البريد' });
    }
  } else {
    console.log(`📟 (محاكاة) رمز ${email}: ${code}`);
    return res.json({ message: 'تم إرسال الرمز (تحقق من طرفية الخادم).', code });
  }
});

app.post('/api/verify-code', (req, res) => {
  const { email, code } = req.body;
  const record = emailCodes.get(email);
  if (!record) return res.status(400).json({ error: 'لم يتم إرسال رمز لهذا البريد' });
  if (Date.now() > record.expiresAt) {
    emailCodes.delete(email);
    return res.status(400).json({ error: 'انتهت صلاحية الرمز' });
  }
  if (record.code !== code) return res.status(400).json({ error: 'الرمز غير صحيح' });
  emailCodes.delete(email);
  res.json({ verified: true, message: 'تم التأكيد!' });
});

// ---------- حالة الغرف والمطابقة ----------
const rooms = new Map();
const waitingUsers = [];
const clients = new Map();

function generateId() {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

// تحسين: البحث عن شريك متوافق مع تفضيل الجنس
function findCompatiblePartner(user) {
  // إذا لم يحدد تفضيل أو اختار "all"، نقبل أي شخص آخر
  if (!user.preferredGender || user.preferredGender === 'all') {
    return waitingUsers.find(u => u.id !== user.id);
  }
  // يفضل جنسًا محددًا: ابحث عن شخص جنسه مطابق للتفضيل
  return waitingUsers.find(u => u.id !== user.id && u.gender === user.preferredGender);
}

function tryMatchRandom() {
  if (waitingUsers.length < 2) return;

  // نمسح على المستخدمين لإيجاد زوج متوافق
  for (let i = 0; i < waitingUsers.length; i++) {
    const user = waitingUsers[i];
    const partner = findCompatiblePartner(user);
    if (partner) {
      // إزالة الاثنين من قائمة الانتظار
      waitingUsers.splice(waitingUsers.indexOf(user), 1);
      waitingUsers.splice(waitingUsers.indexOf(partner), 1);

      const role1 = Math.random() < 0.5 ? 'initiator' : 'receiver';
      const role2 = role1 === 'initiator' ? 'receiver' : 'initiator';
      user.socket.partnerId = partner.id;
      partner.socket.partnerId = user.id;
      user.socket.send(JSON.stringify({
        type: 'matched', role: role1, partnerId: partner.id,
        partnerInfo: { gender: partner.gender }
      }));
      partner.socket.send(JSON.stringify({
        type: 'matched', role: role2, partnerId: user.id,
        partnerInfo: { gender: user.gender }
      }));
      return;
    }
  }
  // لا يوجد تطابق متوافق حاليًا، ننتظر مستخدمين جدد
}

function removeFromWaiting(socketId) {
  const idx = waitingUsers.findIndex(u => u.id === socketId);
  if (idx !== -1) waitingUsers.splice(idx, 1);
}

function sendTo(socketId, data) {
  const client = clients.get(socketId);
  if (client) client.send(JSON.stringify(data));
}

wss.on('connection', (socket) => {
  socket.id = generateId();
  clients.set(socket.id, socket);
  console.log(`اتصال: ${socket.id}`);

  socket.on('message', (msg) => {
    let data;
    try { data = JSON.parse(msg); } catch (e) { return; }

    switch (data.type) {
      case 'find':
        if (socket.partnerId) return;
        removeFromWaiting(socket.id);
        waitingUsers.push({
          socket,
          id: socket.id,
          gender: data.gender || 'unknown',
          preferredGender: data.preferredGender || null
        });
        socket.send(JSON.stringify({ type: 'searching' }));
        tryMatchRandom();
        break;

      case 'next':
        if (socket.partnerId) {
          sendTo(socket.partnerId, { type: 'partnerDisconnected' });
          const partner = clients.get(socket.partnerId);
          if (partner) partner.partnerId = null;
          socket.partnerId = null;
        }
        removeFromWaiting(socket.id);
        waitingUsers.push({
          socket,
          id: socket.id,
          gender: data.gender || 'unknown',
          preferredGender: data.preferredGender || null
        });
        socket.send(JSON.stringify({ type: 'searching' }));
        tryMatchRandom();
        break;

      case 'disconnect-random':
        if (socket.partnerId) {
          sendTo(socket.partnerId, { type: 'partnerDisconnected' });
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
        if (socket.partnerId) sendTo(socket.partnerId, { type: data.type, payload: data.payload });
        break;

      case 'create-room':
        {
          const roomId = data.roomId || generateId();
          if (!rooms.has(roomId)) rooms.set(roomId, new Set());
          rooms.get(roomId).add(socket.id);
          socket.currentRoom = roomId;
          socket.send(JSON.stringify({ type: 'room-created', roomId }));
        }
        break;

      case 'join-room':
        {
          const { roomId } = data;
          if (!rooms.has(roomId)) {
            socket.send(JSON.stringify({ type: 'error', message: 'الغرفة غير موجودة' }));
            return;
          }
          const room = rooms.get(roomId);
          // إرسال قائمة الأعضاء الحاليين للعضو الجديد
          const members = Array.from(room);
          socket.send(JSON.stringify({ type: 'room-users', members }));
          // إعلام باقي الأعضاء
          room.forEach(memberId => {
            if (memberId !== socket.id) sendTo(memberId, { type: 'room-user-joined', userId: socket.id });
          });
          room.add(socket.id);
          socket.currentRoom = roomId;
        }
        break;

      case 'leave-room':
        {
          const roomId = socket.currentRoom;
          if (!roomId || !rooms.has(roomId)) break;
          const room = rooms.get(roomId);
          room.delete(socket.id);
          if (room.size === 0) rooms.delete(roomId);
          else {
            room.forEach(memberId => sendTo(memberId, { type: 'room-user-left', userId: socket.id }));
          }
          socket.currentRoom = null;
        }
        break;

      case 'group-offer':
        sendTo(data.to, { type: 'group-offer', from: socket.id, payload: data.payload });
        break;
      case 'group-answer':
        sendTo(data.to, { type: 'group-answer', from: socket.id, payload: data.payload });
        break;
      case 'group-ice-candidate':
        sendTo(data.to, { type: 'group-ice-candidate', from: socket.id, payload: data.payload });
        break;

      default: break;
    }
  });

  socket.on('close', () => {
    console.log(`فصل: ${socket.id}`);
    if (socket.partnerId) {
      sendTo(socket.partnerId, { type: 'partnerDisconnected' });
      const partner = clients.get(socket.partnerId);
      if (partner) partner.partnerId = null;
    }
    removeFromWaiting(socket.id);
    if (socket.currentRoom) {
      const room = rooms.get(socket.currentRoom);
      if (room) {
        room.delete(socket.id);
        if (room.size === 0) rooms.delete(socket.currentRoom);
        else room.forEach(memberId => sendTo(memberId, { type: 'room-user-left', userId: socket.id }));
      }
    }
    clients.delete(socket.id);
  });
});

server.listen(process.env.PORT || 3000, () => {
  console.log(`🚀 http://localhost:${process.env.PORT || 3000}`);
});