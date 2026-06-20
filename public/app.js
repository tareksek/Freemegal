
// ========== إدارة الشاشات ==========
const screens = {
  age: document.getElementById('ageScreen'),
  gender: document.getElementById('genderScreen'),
  pref: document.getElementById('prefScreen'),
  chat: document.getElementById('chatScreen')
};

let userData = {
  ageConfirmed: false,
  gender: null,
  email: null,
  emailVerified: false,
  preferredGender: null // null حتى يتم التفعيل
};

function showScreen(screenId) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[screenId].classList.add('active');
}

// ========== شاشة العمر ==========
document.getElementById('ageYes').addEventListener('click', () => {
  userData.ageConfirmed = true;
  showScreen('gender');
});
document.getElementById('ageNo').addEventListener('click', () => {
  alert('يجب أن يكون عمرك 18 سنة أو أكثر لاستخدام هذه الخدمة.');
  window.location.reload();
});

// ========== شاشة اختيار الجنس ==========
document.querySelectorAll('.gender-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.gender-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    userData.gender = btn.dataset.gender;
    showScreen('pref');
  });
});

// ========== شاشة التفضيلات والبريد ==========
const toggleEmailBtn = document.getElementById('toggleEmailBtn');
const emailSection = document.getElementById('emailSection');
const sendCodeBtn = document.getElementById('sendCodeBtn');
const codeSection = document.getElementById('codeSection');
const verifyCodeBtn = document.getElementById('verifyCodeBtn');
const emailInput = document.getElementById('emailInput');
const codeInput = document.getElementById('codeInput');
const emailMsg = document.getElementById('emailMsg');
const prefOptions = document.getElementById('prefOptions');
const prefStatus = document.getElementById('prefStatus');
const goToChatBtn = document.getElementById('goToChatBtn');

// إظهار/إخفاء قسم البريد
toggleEmailBtn.addEventListener('click', () => {
  emailSection.style.display = emailSection.style.display === 'none' ? 'block' : 'none';
});

// إرسال رمز التأكيد
sendCodeBtn.addEventListener('click', async () => {
  const email = emailInput.value.trim();
  if (!email) {
    emailMsg.textContent = 'يرجى إدخال بريد إلكتروني صحيح.';
    return;
  }
  try {
    const res = await fetch('/api/send-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (res.ok) {
      emailMsg.textContent = data.message;
      // إظهار حقل الرمز
      codeSection.style.display = 'block';
      // في بيئة التطوير: نعرض الرمز في رسالة للمستخدم
      alert(`رمز التأكيد (للتطوير): ${data.code}`);
    } else {
      emailMsg.textContent = data.error;
    }
  } catch (err) {
    emailMsg.textContent = 'فشل الاتصال بالخادم.';
  }
});

// التحقق من الرمز
verifyCodeBtn.addEventListener('click', async () => {
  const email = emailInput.value.trim();
  const code = codeInput.value.trim();
  if (!email || !code) {
    emailMsg.textContent = 'يرجى إدخال البريد والرمز.';
    return;
  }
  try {
    const res = await fetch('/api/verify-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code })
    });
    const data = await res.json();
    if (res.ok) {
      userData.emailVerified = true;
      userData.email = email;
      emailMsg.textContent = '✅ تم تأكيد البريد بنجاح!';
      emailSection.style.display = 'none';
      toggleEmailBtn.style.display = 'none';
      prefStatus.textContent = 'يمكنك الآن اختيار الجنس المفضل للتحدث معه.';
      prefOptions.style.display = 'block';
      // تفعيل أزرار التفضيل
    } else {
      emailMsg.textContent = data.error;
    }
  } catch (err) {
    emailMsg.textContent = 'فشل الاتصال بالخادم.';
  }
});

// اختيار الجنس المفضل
document.querySelectorAll('.pref-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!userData.emailVerified) {
      alert('يجب تأكيد البريد الإلكتروني أولاً.');
      return;
    }
    document.querySelectorAll('.pref-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    userData.preferredGender = btn.dataset.pref;
  });
});

// زر الدخول للدردشة
goToChatBtn.addEventListener('click', () => {
  if (!userData.gender) {
    alert('يرجى اختيار جنسك أولاً.');
    return;
  }
  showScreen('chat');
  initializeChat();
});

// ========== شاشة الدردشة ==========
let ws, localStream, pc, dataChannel, partnerId, currentState = 'idle';

const statusBar = document.getElementById('statusBar');
const findBtn = document.getElementById('findBtn');
const nextBtn = document.getElementById('nextBtn');
const disconnectBtn = document.getElementById('disconnectBtn');
const sendBtn = document.getElementById('sendBtn');
const messageInput = document.getElementById('messageInput');
const chatMessages = document.getElementById('chatMessages');
const remoteVideo = document.getElementById('remoteVideo');
const localVideo = document.getElementById('localVideo');
const partnerLabel = document.getElementById('partnerLabel');
const chatBox = document.getElementById('chatBox');

function setStatus(text) {
  statusBar.textContent = text;
}
function setState(state) {
  currentState = state;
  findBtn.disabled = state !== 'idle';
  nextBtn.disabled = state !== 'connected';
  disconnectBtn.disabled = state !== 'connected';
}

function addChatMessage(text, sender) {
  const div = document.createElement('div');
  div.classList.add('msg-line');
  div.classList.add(sender === 'you' ? 'msg-you' : 'msg-partner');
  div.textContent = (sender === 'you' ? 'أنت: ' : 'الشريك: ') + text;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function sendChatMessage(text) {
  if (dataChannel && dataChannel.readyState === 'open') {
    dataChannel.send(text);
    addChatMessage(text, 'you');
  }
}

async function startMedia() {
  if (localStream) return true;
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;
    return true;
  } catch (e) {
    alert('لم نتمكن من الوصول إلى الكاميرا والميكروفون.');
    return false;
  }
}

function stopMedia() {
  if (localStream) {
    localStream.getTracks().forEach(t => t.stop());
    localStream = null;
    localVideo.srcObject = null;
  }
}

function closePeerConnection() {
  if (pc) { pc.close(); pc = null; }
  dataChannel = null;
  if (remoteVideo.srcObject) {
    remoteVideo.srcObject.getTracks().forEach(t => t.stop());
    remoteVideo.srcObject = null;
  }
  partnerId = null;
  chatMessages.innerHTML = '';
  chatBox.style.display = 'none';
}

async function startPeerConnection(role, partnerInfo) {
  closePeerConnection();
  pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
  if (localStream) localStream.getTracks().forEach(t => pc.addTrack(t, localStream));

  pc.ontrack = e => {
    if (e.streams[0]) remoteVideo.srcObject = e.streams[0];
  };
  pc.onicecandidate = e => {
    if (e.candidate && partnerId && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'ice-candidate', payload: e.candidate }));
    }
  };

  if (role === 'initiator') {
    dataChannel = pc.createDataChannel('chat');
    setupDataChannel();
  } else {
    pc.ondatachannel = e => { dataChannel = e.channel; setupDataChannel(); };
  }

  if (role === 'initiator') {
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      ws.send(JSON.stringify({ type: 'offer', payload: offer }));
    } catch (err) { console.error(err); }
  }
}

function setupDataChannel() {
  dataChannel.onmessage = e => addChatMessage(e.data, 'partner');
  dataChannel.onopen = () => { chatBox.style.display = 'flex'; };
}

function connectWebSocket() {
  if (ws && ws.readyState === WebSocket.OPEN) return;
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${protocol}://${location.host}`);

  ws.onopen = () => console.log('WS open');
  ws.onmessage = async (e) => {
    const data = JSON.parse(e.data);
    switch (data.type) {
      case 'searching':
        setStatus('🔎 جاري البحث عن شريك...');
        setState('searching');
        break;
      case 'matched':
        partnerId = data.partnerId;
        partnerLabel.textContent = `الشريك (${data.partnerInfo.gender === 'male' ? 'ذكر' : 'أنثى'})`;
        setStatus('🎉 تم العثور على شريك!');
        await startPeerConnection(data.role, data.partnerInfo);
        setStatus('✅ متصل');
        setState('connected');
        break;
      case 'partnerDisconnected':
        setStatus('❌ انقطع الاتصال بالشريك.');
        closePeerConnection();
        setState('idle');
        break;
      case 'disconnected':
        setStatus('تم قطع الاتصال.');
        closePeerConnection();
        stopMedia();
        setState('idle');
        break;
      case 'offer':
        if (pc) await pc.setRemoteDescription(new RTCSessionDescription(data.payload));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        ws.send(JSON.stringify({ type: 'answer', payload: answer }));
        break;
      case 'answer':
        if (pc) await pc.setRemoteDescription(new RTCSessionDescription(data.payload));
        break;
      case 'ice-candidate':
        if (pc) await pc.addIceCandidate(new RTCIceCandidate(data.payload));
        break;
    }
  };
  ws.onclose = () => { setStatus('انقطع الاتصال بالخادم.'); closePeerConnection(); setState('idle'); };
}

function initializeChat() {
  // لا شيء حتى الآن، المستخدم يضغط البحث
  setStatus('جاهز للبحث');
  setState('idle');
}

findBtn.addEventListener('click', async () => {
  if (!await startMedia()) return;
  connectWebSocket();
  const sendFind = () => {
    ws.send(JSON.stringify({
      type: 'find',
      gender: userData.gender,
      preferredGender: userData.emailVerified ? userData.preferredGender : null,
      emailVerified: userData.emailVerified
    }));
  };
  if (ws.readyState === WebSocket.OPEN) sendFind();
  else ws.onopen = sendFind;
});

nextBtn.addEventListener('click', () => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'next',
      gender: userData.gender,
      preferredGender: userData.emailVerified ? userData.preferredGender : null
    }));
    closePeerConnection();
    setStatus('🔎 جاري البحث عن شخص جديد...');
    setState('searching');
  }
});

disconnectBtn.addEventListener('click', () => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'disconnect' }));
    closePeerConnection();
    stopMedia();
    setStatus('تم قطع الاتصال.');
    setState('idle');
  }
});

sendBtn.addEventListener('click', () => {
  const text = messageInput.value.trim();
  if (text) { sendChatMessage(text); messageInput.value = ''; }
});
messageInput.addEventListener('keypress', e => { if (e.key === 'Enter') sendBtn.click(); });

// البدء بعرض شاشة العمر
showScreen('age');
