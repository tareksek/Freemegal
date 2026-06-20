
// app.js

// ---------- عناصر الواجهة ----------
const statusDiv = document.getElementById('status');
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const chatContainer = document.getElementById('chatContainer');
const messagesDiv = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const findBtn = document.getElementById('findBtn');
const nextBtn = document.getElementById('nextBtn');
const disconnectBtn = document.getElementById('disconnectBtn');

// ---------- متغيرات عامة ----------
let ws;
let localStream;
let pc;                     // RTCPeerConnection
let dataChannel;            // DataChannel للدردشة النصية
let partnerId = null;       // معرف الشريك الحالي من السيرفر
let isConnected = false;    // هل هناك اتصال نشط مع شريك؟

// تكوين ICE (نستخدم Google STUN كمثال)
const configuration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

// ---------- تحديث حالة الأزرار ----------
function updateButtons() {
  const searching = statusDiv.textContent.includes('البحث');
  if (isConnected) {
    findBtn.disabled = true;
    nextBtn.disabled = false;
    disconnectBtn.disabled = false;
  } else if (searching) {
    findBtn.disabled = true;
    nextBtn.disabled = true;
    disconnectBtn.disabled = true;
  } else {
    findBtn.disabled = false;
    nextBtn.disabled = true;
    disconnectBtn.disabled = true;
  }
}

// ---------- إظهار / إخفاء الدردشة ----------
function toggleChat(show) {
  chatContainer.style.display = show ? 'flex' : 'none';
}

// ---------- إضافة رسالة إلى صندوق الدردشة ----------
function addMessage(text, sender) {
  const msgDiv = document.createElement('div');
  msgDiv.classList.add('message');
  if (sender === 'you') {
    msgDiv.classList.add('you');
    msgDiv.textContent = `أنت: ${text}`;
  } else {
    msgDiv.classList.add('partner');
    msgDiv.textContent = `الشريك: ${text}`;
  }
  messagesDiv.appendChild(msgDiv);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// ---------- إرسال رسالة عبر DataChannel ----------
function sendChatMessage(text) {
  if (dataChannel && dataChannel.readyState === 'open') {
    dataChannel.send(text);
    addMessage(text, 'you');
  }
}

// ---------- إغلاق اتصال WebRTC وتنظيف الموارد ----------
function closePeerConnection() {
  if (pc) {
    pc.close();
    pc = null;
  }
  dataChannel = null;
  // إيقاف عرض الفيديو البعيد
  if (remoteVideo.srcObject) {
    remoteVideo.srcObject.getTracks().forEach(track => track.stop());
    remoteVideo.srcObject = null;
  }
  isConnected = false;
  toggleChat(false);
  messagesDiv.innerHTML = '';
}

// ---------- بدء WebRTC (يتم استدعاؤها عند المطابقة) ----------
async function startPeerConnection(role) {
  closePeerConnection(); // تنظيف أي اتصال سابق

  pc = new RTCPeerConnection(configuration);

  // إضافة المسارات المحلية إلى الاتصال
  if (localStream) {
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
  }

  // استقبال المسارات البعيدة وعرضها
  pc.ontrack = (event) => {
    if (event.streams && event.streams[0]) {
      remoteVideo.srcObject = event.streams[0];
    }
  };

  // التعامل مع مرشحي ICE
  pc.onicecandidate = (event) => {
    if (event.candidate && partnerId) {
      ws.send(JSON.stringify({
        type: 'ice-candidate',
        payload: event.candidate
      }));
    }
  };

  // إنشاء DataChannel للدردشة (من قبل الطرف البادئ)
  if (role === 'initiator') {
    dataChannel = pc.createDataChannel('chat');
    setupDataChannel();
  } else {
    // الطرف المستقبل ينتظر DataChannel
    pc.ondatachannel = (event) => {
      dataChannel = event.channel;
      setupDataChannel();
    };
  }

  // منطق البادئ: إنشاء عرض وإرساله
  if (role === 'initiator') {
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      ws.send(JSON.stringify({
        type: 'offer',
        payload: offer
      }));
    } catch (err) {
      console.error('Error creating offer:', err);
    }
  }
  // الطرف المستقبل لا يفعل شيئًا حتى يصل العرض
}

// إعداد DataChannel لاستقبال وإرسال الرسائل
function setupDataChannel() {
  dataChannel.onmessage = (event) => {
    addMessage(event.data, 'partner');
  };
  dataChannel.onopen = () => {
    console.log('DataChannel opened');
    toggleChat(true);
  };
  dataChannel.onclose = () => {
    console.log('DataChannel closed');
  };
}

// ---------- إعادة تعيين الواجهة إلى الحالة الأولية ----------
function resetUI() {
  closePeerConnection();
  // إيقاف جميع مسارات الفيديو المحلية إذا أردنا، لكن نحن نبقي localStream حيًا لإعادة الاستخدام
  // لكن عند disconnect نوقفه
}

// ---------- بدء تشغيل الوسائط (مرة واحدة) ----------
async function startMedia() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;
    return true;
  } catch (err) {
    console.error('Media access denied:', err);
    statusDiv.textContent = '⚠️ لم يتم السماح بالوصول للكاميرا والميكروفون.';
    return false;
  }
}

// ---------- الاتصال بـ WebSocket ----------
function connectWebSocket() {
  if (ws && ws.readyState === WebSocket.OPEN) return;

  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${protocol}://${window.location.host}`);

  ws.onmessage = async (event) => {
    const data = JSON.parse(event.data);

    switch (data.type) {
      case 'searching':
        statusDiv.textContent = '🔎 جاري البحث عن شخص...';
        updateButtons();
        break;

      case 'matched':
        // تم العثور على شريك
        partnerId = data.partnerId;
        statusDiv.textContent = '🎉 تم العثور على شخص! جاري إنشاء الاتصال...';
        isConnected = true;
        await startPeerConnection(data.role);
        statusDiv.textContent = '✅ متصل - يمكنك الدردشة';
        updateButtons();
        break;

      case 'partnerDisconnected':
        // الشريك قطع الاتصال
        statusDiv.textContent = '❌ انقطع الاتصال بالشريك.';
        closePeerConnection();
        updateButtons();
        // العودة إلى حالة الخمول
        partnerId = null;
        break;

      case 'disconnected':
        // تأكيد قطع الاتصال من السيرفر
        statusDiv.textContent = 'تم قطع الاتصال.';
        closePeerConnection();
        stopLocalStream(); // نوقف الكاميرا محليًا
        updateButtons();
        partnerId = null;
        break;

      // رسائل الإشارة
      case 'offer':
        if (pc && data.payload) {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(data.payload));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            ws.send(JSON.stringify({
              type: 'answer',
              payload: answer
            }));
          } catch (err) {
            console.error('Error handling offer:', err);
          }
        }
        break;

      case 'answer':
        if (pc && data.payload) {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(data.payload));
          } catch (err) {
            console.error('Error handling answer:', err);
          }
        }
        break;

      case 'ice-candidate':
        if (pc && data.payload) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(data.payload));
          } catch (err) {
            console.error('Error adding ICE candidate:', err);
          }
        }
        break;

      case 'error':
        statusDiv.textContent = `⚠️ ${data.message}`;
        updateButtons();
        break;
    }
  };

  ws.onclose = () => {
    statusDiv.textContent = 'انقطع الاتصال بالخادم.';
    closePeerConnection();
    updateButtons();
  };
}

// إيقاف جميع مسارات الفيديو المحلية (عند قطع الاتصال تمامًا)
function stopLocalStream() {
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
    localVideo.srcObject = null;
  }
}

// ---------- ربط الأحداث ----------
findBtn.addEventListener('click', async () => {
  // إذا لم نبدأ الوسائط بعد، نبدأ الآن
  if (!localStream) {
    const success = await startMedia();
    if (!success) return;
  }
  connectWebSocket();
  // تأكد من أن WebSocket مفتوح قبل الإرسال
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'find' }));
  } else {
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'find' }));
    };
  }
});

nextBtn.addEventListener('click', () => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'next' }));
    closePeerConnection();
    statusDiv.textContent = '🔎 جاري البحث عن شخص جديد...';
    updateButtons();
  }
});

disconnectBtn.addEventListener('click', () => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'disconnect' }));
    closePeerConnection();
    stopLocalStream();
    statusDiv.textContent = 'تم قطع الاتصال.';
    updateButtons();
    // لا نغلق WebSocket، قد يرغب المستخدم بالبحث مجددًا
  }
});

// إرسال رسالة الدردشة عند الضغط على زر الإرسال أو Enter
sendBtn.addEventListener('click', () => {
  const text = messageInput.value.trim();
  if (text) {
    sendChatMessage(text);
    messageInput.value = '';
  }
});

messageInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    sendBtn.click();
  }
});

// عند تحميل الصفحة، لا نفعل شيء تلقائيًا
window.addEventListener('load', () => {
  // كل شيء جاهز، المستخدم يبدأ بالضغط على "البحث عن شريك"
  updateButtons();
});
