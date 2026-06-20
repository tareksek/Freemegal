
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

// ---------- تكوين البريد (استخدم بيانات SMTP حقيقية) ----------
// إذا لم تعيّن بيانات حقيقية، سيعمل السيرفر في وضع المحاكاة (console only)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || ''
  }
});

// تأكد من صحة الاتصال مرة واحدة عند التشغيل (اختياري)
if (process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter.verify((error, success) => {
    if (error) {
      console.log('⚠️ فشل الاتصال بخادم البريد، سيتم استخدام المحاكاة فقط:', error.message);
    } else {
      console.log('✅ خادم البريد جاهز لإرسال الرسائل.');
    }
  });
} else {
  console.log('ℹ️ لم يتم تعيين بيانات SMTP. الرموز ستظهر في الطرفية فقط.');
}

// ---------- تخزين الرموز ----------
const emailCodes = new Map();

function generateCode() {
  return crypto.randomInt(100000, 999999).toString();
}

// ---------- REST API للبريد ----------
app.post('/api/send-code', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'البريد مطلوب' });

  const code = generateCode();
  emailCodes.set(email, { code, expiresAt: Date.now() + 10 * 60 * 1000 });

  // محاولة الإرسال الحقيقي
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      await transporter.sendMail({
        from: `"دردشة عشوائية" <${process.env.SMTP_USER}>`,
        to: email,
        subject: 'رمز تأكيد البريد الإلكتروني',
        html: `
          <div dir="rtl" style="font-family: Arial; background:#f4f4f4; padding:20px;">
            <h2>مرحباً بك!</h2>
            <p>رمز التأكيد الخاص بك هو:</p>
            <h1 style="color:#4caf50;">${code}</h1>
            <p>هذا الرمز صالح لمدة 10 دقائق.</p>
          </div>
        `
      });
      console.log(`📧 تم إرسال الرمز إلى ${email}: ${code}`);
      return res.json({ message: 'تم إرسال رمز التأكيد إلى بريدك الإلكتروني.' });
    } catch (err) {
      console.error('فشل إرسال البريد:', err);
      // في حالة الفشل: نعرض الرمز في الطرفية ولكن لا نرسله للمستخدم (لأمان)
      return res.status(500).json({ error: 'فشل في إرسال البريد الإلكتروني. حاول لاحقاً.' });
    }
  } else {
    // وضع المحاكاة: إرجاع الرمز للمطور فقط (غير آمن للإنتاج)
    console.log(`\n📟 (محاكاة) رمز ${email}: ${code}\n`);
    return res.json({
      message: 'تم إرسال الرمز (تحقق من سجل الخادم).',
      code // فقط للتطوير! احذف هذا السطر في الإنتاج
    });
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
  res.json({ verified: true, message: 'تم تأكيد البريد بنجاح!' });
});

// ---------- WebSocket (نفس المنطق السابق) ----------
const waitingUsers = [];
const clients = new Map();

function generateId() {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

function findCompatiblePartner(user) {
  if (!user.preferredGender || user.preferredGender === 'all') {
    return waitingUsers.find(u => u.id !== user.id);
  }
  return waitingUsers.find(u => u.id !== user.id && u.gender === user.preferredGender);
}

function tryMatch() {
  if (waitingUsers.length < 2) return;
  for (let i = 0; i < waitingUsers.length; i++) {
    const user = waitingUsers[i];
    const partner = findCompatiblePartner(user);
    if (partner) {
      waitingUsers.splice(waitingUsers.indexOf(user), 1);
      waitingUsers.splice(waitingUsers.indexOf(partner), 1);
      const role1 = Math.random() < 0.5 ? 'initiator' : 'receiver';
      const role2 = role1 === 'initiator' ? 'receiver' : 'initiator';
      user.socket.partnerId = partner.id;
      partner.socket.partnerId = user.id;
      user.socket.send(JSON.stringify({
        type: 'matched', role: role1, partnerId: partner.id,
        partnerInfo: { gender: partner.gender, preferredGender: partner.preferredGender || 'all' }
      }));
      partner.socket.send(JSON.stringify({
        type: 'matched', role: role2, partnerId: user.id,
        partnerInfo: { gender: user.gender, preferredGender: user.preferredGender || 'all' }
      }));
      return;
    }
  }
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
  if (socket.partnerId) {
    sendToPartner(socket, { type: 'partnerDisconnected' });
    const partner = clients.get(socket.partnerId);
    if (partner) partner.partnerId = null;
  }
  removeFromWaiting(socket.id);
  clients.delete(socket.id);
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
        if (waitingUsers.some(u => u.id === socket.id)) return;
        if (socket.partnerId) {
          socket.send(JSON.stringify({ type: 'error', message: 'أنت متصل بالفعل' }));
          return;
        }
        waitingUsers.push({
          socket, id: socket.id,
          gender: data.gender || 'unknown',
          preferredGender: data.preferredGender || null,
          emailVerified: data.emailVerified || false
        });
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
        waitingUsers.push({
          socket, id: socket.id,
          gender: data.gender || 'unknown',
          preferredGender: data.preferredGender || null
        });
        socket.send(JSON.stringify({ type: 'searching' }));
        tryMatch();
        break;
      case 'disconnect':
        if (socket.partnerId) {
          sendToPartner(socket, { type: 'partnerDisconnected' });
          clients.get(socket.partnerId).partnerId = null;
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
    console.log(`فصل: ${socket.id}`);
    handleDisconnect(socket);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🚀 الخادم يعمل على https://freemegal.vercel.app/:${PORT}\n`);
});
