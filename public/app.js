
// app.js - نسخة محسنة مع معالجة الأخطاء وسجلات console للمساعدة

// عناصر DOM
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

// متغيرات عامة
let ws = null;
let localStream = null;
let pc = null;
let dataChannel = null;
let partnerId = null;
let isConnected = false;

const configuration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

// ---------- دوال تحديث الواجهة ----------
function setStatus(text) {
  statusDiv.textContent = text;
  console.log('Status:', text);
}

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
  console.log('Buttons updated - Find:', findBtn.disabled, 'Next:', nextBtn.disabled, 'Disconnect:', disconnectBtn.disabled);
}

function toggleChat(show) {
  chatContainer.style.display = show ? 'flex' : 'none';
}

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

function sendChatMessage(text) {
  if (dataChannel && dataChannel.readyState === 'open') {
    dataChannel.send(text);
    addMessage(text, 'you');
  }
}

// ---------- تنظيف اتصال WebRTC ----------
function closePeerConnection() {
  if (pc) {
    pc.close();
    pc = null;
  }
  dataChannel = null;
  if (remoteVideo.srcObject) {
    remoteVideo.srcObject.getTracks().forEach(track => track.stop());
    remoteVideo.srcObject = null;
  }
  isConnected = false;
  toggleChat(false);
  messagesDiv.innerHTML = '';
}

// ---------- بدء WebRTC ----------
async function startPeerConnection(role) {
  closePeerConnection();

  pc = new RTCPeerConnection(configuration);
  console.log('RTCPeerConnection created');

  // إضافة المسارات المحلية
  if (localStream) {
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
  }

  pc.ontrack = (event) => {
    console.log('Remote track received');
    if (event.streams && event.streams[0]) {
      remoteVideo.srcObject = event.streams[0];
    }
  };

  pc.onicecandidate = (event) => {
    if (event.candidate && partnerId && ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'ice-candidate', payload: event.candidate }));
    }
  };

  // DataChannel للدردشة
  if (role === 'initiator') {
    dataChannel = pc.createDataChannel('chat');
    setupDataChannel();
  } else {
    pc.ondatachannel = (event) => {
      dataChannel = event.channel;
      setupDataChannel();
    };
  }

  if (role === 'initiator') {
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'offer', payload: offer }));
      }
    } catch (err) {
      console.error('Error creating offer:', err);
      setStatus('فشل إنشاء الاتصال');
    }
  }
}

function setupDataChannel() {
  dataChannel.onmessage = (event) => {
    addMessage(event.data, 'partner');
  };
  dataChannel.onopen = () => {
    console.log('DataChannel open');
    toggleChat(true);
  };
  dataChannel.onclose = () => {
    console.log('DataChannel closed');
  };
}

// ---------- تشغيل الكاميرا والميكروفون ----------
async function startMedia() {
  if (localStream) return true; // تم التشغيل مسبقاً

  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;
    console.log('Media acquired');
    return true;
  } catch (err) {
    console.error('getUserMedia error:', err);
    setStatus('⚠️ تعذر الوصول للكاميرا/الميكروفون. تأكد من السماح بالوصول واستخدام HTTPS أو localhost.');
    return false;
  }
}

// إيقاف الكاميرا
function stopLocalStream() {
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
    localVideo.srcObject = null;
  }
}

// ---------- WebSocket ----------
function connectWebSocket() {
  if (ws && ws.readyState === WebSocket.OPEN) return;

  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${protocol}://${window.location.host}`);
  console.log('WebSocket connecting...');

  ws.onopen = () => {
    console.log('WebSocket open');
    // في حالة كان هناك طلب pending (find) بعد الفتح مباشرة
  };

  ws.onmessage = async (event) => {
    const data = JSON.parse(event.data);
    console.log('Received:', data.type);

    switch (data.type) {
      case 'searching':
        setStatus('🔎 جاري البحث عن شخص...');
        updateButtons();
        break;

      case 'matched':
        partnerId = data.partnerId;
        setStatus('🎉 تم العثور على شخص! جاري إنشاء الاتصال...');
        isConnected = true;
        await startPeerConnection(data.role);
        setStatus('✅ متصل - يمكنك الدردشة');
        updateButtons();
        break;

      case 'partnerDisconnected':
        setStatus('❌ انقطع الاتصال بالشريك.');
        closePeerConnection();
        updateButtons();
        partnerId = null;
        break;

      case 'disconnected':
        setStatus('تم قطع الاتصال.');
        closePeerConnection();
        stopLocalStream();
        updateButtons();
        partnerId = null;
        break;

      case 'offer':
        if (pc && data.payload) {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(data.payload));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'answer', payload: answer }));
            }
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
        setStatus(`⚠️ ${data.message}`);
        updateButtons();
        break;
    }
  };

  ws.onerror = (err) => {
    console.error('WebSocket error:', err);
    setStatus('⚠️ خطأ في الاتصال بالخادم');
  };

  ws.onclose = () => {
    console.log('WebSocket closed');
    setStatus('انقطع الاتصال بالخادم.');
    closePeerConnection();
    updateButtons();
  };
}

// ---------- ربط الأحداث ----------
findBtn.addEventListener('click', async () => {
  console.log('Find button clicked');
  // بدء الوسائط إذا لم تكن موجودة
  const mediaOk = await startMedia();
  if (!mediaOk) return;

  connectWebSocket();

  // انتظر حتى يكون WebSocket مفتوحاً ثم أرسل find
  const sendFind = () => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'find' }));
      console.log('Sent find request');
    } else {
      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'find' }));
        console.log('Sent find request (after open)');
      };
    }
  };

  if (ws.readyState === WebSocket.OPEN) {
    sendFind();
  } else {
    ws.onopen = sendFind;
  }
});

nextBtn.addEventListener('click', () => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'next' }));
    closePeerConnection();
    setStatus('🔎 جاري البحث عن شخص جديد...');
    updateButtons();
  }
});

disconnectBtn.addEventListener('click', () => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'disconnect' }));
    closePeerConnection();
    stopLocalStream();
    setStatus('تم قطع الاتصال.');
    updateButtons();
  }
});

sendBtn.addEventListener('click', () => {
  const text = messageInput.value.trim();
  if (text) {
    sendChatMessage(text);
    messageInput.value = '';
  }
});

messageInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendBtn.click();
});

// عند التحميل
window.addEventListener('load', () => {
  console.log('Page loaded');
  // تأكد من وجود العناصر
  if (!findBtn || !statusDiv) {
    console.error('Critical DOM elements missing');
    return;
  }
  setStatus('اضغط "البحث عن شريك" للبدء');
  updateButtons();
});
