
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// لتحليل JSON القادم من REST API
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------- تخزين مؤقت للرموز (في الذاكرة) ----------
// مفتاح: البريد الإلكتروني, قيمة: { code, expiresAt }
const emailCodes = new Map();

// توليد رمز عشوائي مكون من 6 أرقام
function generateCode() {
  return crypto.randomInt(100000, 999999).toString();
}

// ---------- REST API لتأكيد البريد ----------

// إرسال رمز تأكيد إلى البريد (محاكاة - يظهر في console)
app.post('/api/send-code', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const code = generateCode();
  emailCodes.set(email, {
    code,
    expiresAt: Date.now() + 10 * 60 * 1000 // صالح 10 دقائق
  });

  // في الإنتاج: نرسل الرمز عبر البريد الإلكتروني الحقيقي
  console.log(`\n✅ رمز تأكيد البريد ${email}: ${code}\n`);
  console.log('(في التطبيق الحقيقي، سيتم إرسال هذا الرمز إلى بريدك الإلكتروني)');

  // لأغراض التطوير، نُعيد الرمز في الاستجابة (حذف في الإنتاج)
  res.json({ message: 'تم إرسال رمز التأكيد. تحقق من وحدة التحكم (Console) أو بريدك الإلكتروني.', code });
});

// التحقق من الرمز
app.post('/api/verify-code', (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ error: 'Email and code are required' });

  const record = emailCodes.get(email);
  if (!record) return res.status(400).json({ error: 'لم يتم إرسال رمز لهذا البريد' });
  if (Date.now() > record.expiresAt) {
    emailCodes.delete(email);
    return res.status(400).json({ error: 'انتهت صلاحية الرمز. اطلب رمزًا جديدًا.' });
  }
  if (record.code !== code) return res.status(400).json({ error: 'الرمز غير صحيح' });

  emailCodes.delete(email); // حذف الرمز بعد الاستخدام
  res.json({ verified: true, message: 'تم تأكيد البريد الإلكتروني بنجاح!' });
});

// ---------- حالة WebSocket ----------
const waitingUsers = [];
const clients = new Map();

function generateId() {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

// البحث عن شريك مع تفضيل الجنس (إذا كان موجودًا)
function findCompatiblePartner(user) {
  if (!user.preferredGender || user.preferredGender === 'all') {
    // لا تفضيل أو يفضل الكل: أي شخص آخر
    return waitingUsers.find(u => u.id !== user.id);
  }
  // يفضل جنسًا محددًا
  return waitingUsers.find(u =>
    u.id !== user.id &&
    u.gender === user.preferredGender
  );
}

function tryMatch() {
  if (waitingUsers.length < 2) return;

  // حاول إيجاد مطابقة متوافقة للمستخدم الأول
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

      // إعلام كل طرف مع معلومات الشريك
      user.socket.send(JSON.stringify({
        type: 'matched',
        role: role1,
        partnerId: partner.id,
        partnerInfo: { gender: partner.gender, preferredGender: partner.preferredGender || 'all' }
      }));
      partner.socket.send(JSON.stringify({
        type: 'matched',
        role: role2,
        partnerId: user.id,
        partnerInfo: { gender: user.gender, preferredGender: user.preferredGender || 'all' }
      }));
      return; // تم تزويج زوج واحد، نخرج
    }
  }
  // لا يوجد تطابق متوافق حاليًا، سننتظر مستخدمين جدد
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
        // تخزين معلومات المستخدم الإضافية
        const userInfo = {
          socket,
          id: socket.id,
          gender: data.gender || 'unknown',
          preferredGender: data.preferredGender || null,
          emailVerified: data.emailVerified || false
        };
        waitingUsers.push(userInfo);
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
        // إعادة البحث بمعلومات جديدة (يمكن إرسالها مع find)
        waitingUsers.push({
          socket,
          id: socket.id,
          gender: data.gender || socket.gender || 'unknown',
          preferredGender: data.preferredGender || socket.preferredGender || null,
          emailVerified: data.emailVerified || socket.emailVerified || false
        });
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
  console.log(`\n🚀 Server running on https://freemegal.vercel.app/:${PORT}\n`);
});
