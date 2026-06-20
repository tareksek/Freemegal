// ---------- إدارة الشاشات والبيانات ----------
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
  preferredGender: null
};

function showScreen(screenId) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[screenId].classList.add('active');
}

// ---------- أحداث التهيئة ----------
document.getElementById('ageYes').addEventListener('click', () => {
  userData.ageConfirmed = true;
  showScreen('gender');
});
document.getElementById('ageNo').addEventListener('click', () => location.reload());

document.querySelectorAll('.gender-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.gender-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    userData.gender = btn.dataset.gender;
    showScreen('pref');
  });
});

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

toggleEmailBtn.addEventListener('click', () => {
  emailSection.style.display = emailSection.style.display === 'none' ? 'block' : 'none';
});

sendCodeBtn.addEventListener('click', async () => {
  const email = emailInput.value.trim();
  if (!email) { emailMsg.textContent = 'أدخل بريداً صحيحاً'; return; }
  const res = await fetch('/api/send-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });
  const data = await res.json();
  if (res.ok) {
    emailMsg.textContent = data.message;
    codeSection.style.display = 'block';
    if (data.code) alert(`رمز التطوير: ${data.code}`); // احذف للإنتاج
  } else {
    emailMsg.textContent = data.error;
  }
});

verifyCodeBtn.addEventListener('click', async () => {
  const email = emailInput.value.trim();
  const code = codeInput.value.trim();
  if (!email || !code) { emailMsg.textContent = 'أدخل البريد والرمز'; return; }
  const res = await fetch('/api/verify-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code })
  });
  const data = await res.json();
  if (res.ok) {
    userData.emailVerified = true;
    userData.email = email;
    emailMsg.textContent = '✅ تم التأكيد!';
    emailSection.style.display = 'none';
    toggleEmailBtn.style.display = 'none';
    prefStatus.textContent = 'يمكنك الآن اختيار الجنس المفضل.';
    prefOptions.style.display = 'block';
  } else {
    emailMsg.textContent = data.error;
  }
});

document.querySelectorAll('.pref-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!userData.emailVerified) { alert('أكد بريدك أولاً'); return; }
    document.querySelectorAll('.pref-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    userData.preferredGender = btn.dataset.pref;
  });
});

document.getElementById('goToChatBtn').addEventListener('click', () => {
  if (!userData.gender) { alert('اختر جنسك'); return; }
  showScreen('chat');
  initWebSocket();
  // فتح التبويب العشوائي افتراضياً
  switchTab('random');
});

// ---------- WebSocket ----------
let ws;
function initWebSocket() {
  if (ws && ws.readyState === WebSocket.OPEN) return;
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${protocol}://${location.host}`);
  ws.onmessage = handleWSMessage;
}

// ---------- إدارة التبويبات ----------
let activeTab = 'random';
document.getElementById('tabRandom').addEventListener('click', () => switchTab('random'));
document.getElementById('tabGroup').addEventListener('click', () => switchTab('group'));

function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById(tab === 'random' ? 'tabRandom' : 'tabGroup').classList.add('active');
  document.getElementById('randomPanel').classList.toggle('active', tab === 'random');
  document.getElementById('groupPanel').classList.toggle('active', tab === 'group');
  updateStatusBadge();
}

function setStatusBadge(text) {
  document.getElementById('statusBadge').textContent = text;
}
function updateStatusBadge() {
  if (activeTab === 'random') setStatusBadge(randomState === 'idle' ? 'جاهز' : randomState);
  else setStatusBadge(groupRoomId ? 'في غرفة' : 'خارج غرفة');
}

// ---------- الدردشة العشوائية ----------
let randomLocalStream, randomPC, randomDC, randomPartnerId, randomState = 'idle';
const randomRemote = document.getElementById('randomRemote');
const randomLocal = document.getElementById('randomLocal');
const randomPartnerLabel = document.getElementById('randomPartnerLabel');
const randomChatBox = document.getElementById('randomChatBox');
const randomMessages = document.getElementById('randomMessages');
const randomMsgInput = document.getElementById('randomMessageInput');
const randomSendBtn = document.getElementById('randomSendBtn');
const randomFindBtn = document.getElementById('randomFindBtn');
const randomNextBtn = document.getElementById('randomNextBtn');
const randomDisconnectBtn = document.getElementById('randomDisconnectBtn');

function updateRandomButtons() {
  randomFindBtn.disabled = randomState !== 'idle';
  randomNextBtn.disabled = randomState !== 'connected';
  randomDisconnectBtn.disabled = randomState !== 'connected';
}

async function startRandomMedia() {
  if (randomLocalStream) return true;
  try {
    randomLocalStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    randomLocal.srcObject = randomLocalStream;
    return true;
  } catch (e) { alert('الكاميرا مطلوبة'); return false; }
}

function stopRandomMedia() {
  if (randomLocalStream) {
    randomLocalStream.getTracks().forEach(t => t.stop());
    randomLocalStream = null;
    randomLocal.srcObject = null;
  }
}

function closeRandomPeer() {
  if (randomPC) { randomPC.close(); randomPC = null; }
  randomDC = null;
  randomRemote.srcObject = null;
  randomPartnerId = null;
  randomMessages.innerHTML = '';
  randomChatBox.style.display = 'none';
  randomPartnerLabel.textContent = '';
  document.querySelector('.no-partner').style.display = 'flex';
}

async function startRandomPeer(role) {
  closeRandomPeer();
  randomPC = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
  randomLocalStream.getTracks().forEach(t => randomPC.addTrack(t, randomLocalStream));
  randomPC.ontrack = e => {
    if (e.streams[0]) randomRemote.srcObject = e.streams[0];
    document.querySelector('.no-partner').style.display = 'none';
  };
  randomPC.onicecandidate = e => {
    if (e.candidate) ws.send(JSON.stringify({ type: 'ice-candidate', payload: e.candidate }));
  };
  if (role === 'initiator') {
    randomDC = randomPC.createDataChannel('chat');
    setupRandomDC();
  } else {
    randomPC.ondatachannel = e => { randomDC = e.channel; setupRandomDC(); };
  }
  if (role === 'initiator') {
    const offer = await randomPC.createOffer();
    await randomPC.setLocalDescription(offer);
    ws.send(JSON.stringify({ type: 'offer', payload: offer }));
  }
}

function setupRandomDC() {
  randomDC.onmessage = e => addRandomMessage(e.data, 'partner');
  randomDC.onopen = () => { randomChatBox.style.display = 'flex'; };
}

function addRandomMessage(text, sender) {
  const div = document.createElement('div');
  div.className = `msg-line ${sender === 'you' ? 'msg-you' : 'msg-partner'}`;
  div.textContent = (sender === 'you' ? 'أنت: ' : 'الشريك: ') + text;
  randomMessages.appendChild(div);
  randomMessages.scrollTop = randomMessages.scrollHeight;
}

randomFindBtn.addEventListener('click', async () => {
  if (!await startRandomMedia()) return;
  initWebSocket();
  const sendFind = () => ws.send(JSON.stringify({ type: 'find', gender: userData.gender }));
  if (ws.readyState === WebSocket.OPEN) sendFind();
  else ws.onopen = sendFind;
  randomState = 'searching';
  updateRandomButtons();
  setStatusBadge('جاري البحث...');
});

randomNextBtn.addEventListener('click', () => {
  ws.send(JSON.stringify({ type: 'next' }));
  closeRandomPeer();
  randomState = 'searching';
  updateRandomButtons();
  setStatusBadge('جاري البحث...');
});

randomDisconnectBtn.addEventListener('click', () => {
  ws.send(JSON.stringify({ type: 'disconnect-random' }));
  closeRandomPeer();
  stopRandomMedia();
  randomState = 'idle';
  updateRandomButtons();
  setStatusBadge('جاهز');
});

randomSendBtn.addEventListener('click', () => {
  const text = randomMsgInput.value.trim();
  if (text && randomDC && randomDC.readyState === 'open') {
    randomDC.send(text);
    addRandomMessage(text, 'you');
    randomMsgInput.value = '';
  }
});

// ---------- الغرفة الجماعية ----------
let groupLocalStream, groupPeers = new Map(); // userId -> { pc, dc }
let groupRoomId = null;
const groupVideos = document.getElementById('groupVideos');
const groupMessages = document.getElementById('groupMessages');
const groupMsgInput = document.getElementById('groupMessageInput');
const groupSendBtn = document.getElementById('groupSendBtn');
const roomIdInput = document.getElementById('roomIdInput');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const createRoomBtn = document.getElementById('createRoomBtn');
const leaveRoomBtn = document.getElementById('leaveRoomBtn');
const roomLabel = document.getElementById('roomLabel');
const groupChatBox = document.getElementById('groupChatBox');

async function startGroupMedia() {
  if (groupLocalStream) return true;
  try {
    groupLocalStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    // إضافة فيديو محلي للوحة الجماعية
    addGroupVideo('local', groupLocalStream, 'أنت');
    return true;
  } catch (e) { alert('الكاميرا مطلوبة'); return false; }
}

function addGroupVideo(id, stream, label) {
  const wrapper = document.createElement('div');
  wrapper.className = 'group-video-item';
  wrapper.id = `video-${id}`;
  const video = document.createElement('video');
  video.autoplay = true;
  video.playsInline = true;
  video.srcObject = stream;
  if (id === 'local') video.muted = true;
  wrapper.appendChild(video);
  const span = document.createElement('span');
  span.className = 'pip-tag';
  span.textContent = label;
  wrapper.appendChild(span);
  groupVideos.appendChild(wrapper);
}

function removeGroupVideo(id) {
  const el = document.getElementById(`video-${id}`);
  if (el) el.remove();
}

function closeGroupPeer(userId) {
  const peer = groupPeers.get(userId);
  if (peer) {
    if (peer.pc) peer.pc.close();
    if (peer.dc) peer.dc.close();
    groupPeers.delete(userId);
  }
  removeGroupVideo(userId);
}

function closeAllGroupPeers() {
  groupPeers.forEach((_, userId) => closeGroupPeer(userId));
  groupPeers.clear();
}

function leaveGroupRoom() {
  if (!groupRoomId) return;
  ws.send(JSON.stringify({ type: 'leave-room' }));
  closeAllGroupPeers();
  // إزالة الفيديوهات (ما عدا المحلي)
  Array.from(groupVideos.children).forEach(el => {
    if (el.id !== 'video-local') el.remove();
  });
  groupRoomId = null;
  roomLabel.innerHTML = '<i class="fa-solid fa-door-open"></i> لست في غرفة';
  leaveRoomBtn.disabled = true;
  groupChatBox.style.display = 'none';
  updateStatusBadge();
}

joinRoomBtn.addEventListener('click', async () => {
  if (!await startGroupMedia()) return;
  const roomId = roomIdInput.value.trim();
  if (!roomId) return;
  initWebSocket();
  ws.send(JSON.stringify({ type: 'join-room', roomId }));
  groupRoomId = roomId;
  roomLabel.innerHTML = `<i class="fa-solid fa-users"></i> الغرفة: ${roomId}`;
  leaveRoomBtn.disabled = false;
  groupChatBox.style.display = 'flex';
  updateStatusBadge();
});

createRoomBtn.addEventListener('click', async () => {
  if (!await startGroupMedia()) return;
  initWebSocket();
  ws.send(JSON.stringify({ type: 'create-room' }));
  // سيتم استلام room-created
});

leaveRoomBtn.addEventListener('click', leaveGroupRoom);

// إرسال رسالة جماعية
groupSendBtn.addEventListener('click', () => {
  const text = groupMsgInput.value.trim();
  if (!text) return;
  // إرسال عبر كل قناة بيانات
  groupPeers.forEach(peer => {
    if (peer.dc && peer.dc.readyState === 'open') peer.dc.send(text);
  });
  addGroupMessage('أنت', text);
  groupMsgInput.value = '';
});

function addGroupMessage(sender, text) {
  const div = document.createElement('div');
  div.className = 'msg-line';
  div.textContent = `${sender}: ${text}`;
  groupMessages.appendChild(div);
  groupMessages.scrollTop = groupMessages.scrollHeight;
}

// إنشاء اتصال مع عضو جديد
async function setupGroupPeer(userId, initiator) {
  const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
  groupLocalStream.getTracks().forEach(track => pc.addTrack(track, groupLocalStream));

  pc.ontrack = e => {
    if (e.streams[0]) addGroupVideo(userId, e.streams[0], `مستخدم ${userId}`);
  };
  pc.onicecandidate = e => {
    if (e.candidate) ws.send(JSON.stringify({ type: 'group-ice-candidate', to: userId, payload: e.candidate }));
  };

  if (initiator) {
    const dc = pc.createDataChannel('chat');
    setupGroupDC(userId, dc);
  } else {
    pc.ondatachannel = e => setupGroupDC(userId, e.channel);
  }

  groupPeers.set(userId, { pc });
  return pc;
}

function setupGroupDC(userId, dc) {
  const peer = groupPeers.get(userId);
  if (peer) peer.dc = dc;
  else groupPeers.set(userId, { pc: null, dc });
  dc.onmessage = e => addGroupMessage(`مستخدم ${userId}`, e.data);
}

// ---------- معالجة رسائل الخادم ----------
function handleWSMessage(event) {
  const data = JSON.parse(event.data);
  switch (data.type) {
    // عشوائي
    case 'searching':
      randomState = 'searching';
      updateRandomButtons();
      setStatusBadge('جاري البحث...');
      break;
    case 'matched':
      randomPartnerId = data.partnerId;
      randomPartnerLabel.textContent = `الشريك (${data.partnerInfo.gender})`;
      startRandomPeer(data.role);
      randomState = 'connected';
      updateRandomButtons();
      setStatusBadge('متصل');
      break;
    case 'partnerDisconnected':
      closeRandomPeer();
      randomState = 'idle';
      updateRandomButtons();
      setStatusBadge('انقطع');
      break;
    case 'disconnected':
      closeRandomPeer();
      stopRandomMedia();
      randomState = 'idle';
      updateRandomButtons();
      setStatusBadge('جاهز');
      break;
    case 'offer':
      if (randomPC) randomPC.setRemoteDescription(new RTCSessionDescription(data.payload)).then(() =>
        randomPC.createAnswer().then(answer => {
          randomPC.setLocalDescription(answer);
          ws.send(JSON.stringify({ type: 'answer', payload: answer }));
        })
      );
      break;
    case 'answer':
      if (randomPC) randomPC.setRemoteDescription(new RTCSessionDescription(data.payload));
      break;
    case 'ice-candidate':
      if (randomPC && data.payload) randomPC.addIceCandidate(new RTCIceCandidate(data.payload));
      break;

    // غرف جماعية
    case 'room-created':
      groupRoomId = data.roomId;
      roomLabel.innerHTML = `<i class="fa-solid fa-users"></i> الغرفة: ${groupRoomId}`;
      leaveRoomBtn.disabled = false;
      groupChatBox.style.display = 'flex';
      updateStatusBadge();
      break;
    case 'room-users':
      data.members.forEach(async memberId => {
        if (memberId === ws.id) return;
        const pc = await setupGroupPeer(memberId, true); // initiator
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        ws.send(JSON.stringify({ type: 'group-offer', to: memberId, payload: offer }));
      });
      break;
    case 'room-user-joined':
      // العضو الجديد هو data.userId، نحن الطرف البادئ (لأننا موجودون سابقاً)
      setupGroupPeer(data.userId, true).then(async pc => {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        ws.send(JSON.stringify({ type: 'group-offer', to: data.userId, payload: offer }));
      });
      break;
    case 'room-user-left':
      closeGroupPeer(data.userId);
      break;

    case 'group-offer':
      {
        const from = data.from;
        setupGroupPeer(from, false).then(async pc => {
          await pc.setRemoteDescription(new RTCSessionDescription(data.payload));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          ws.send(JSON.stringify({ type: 'group-answer', to: from, payload: answer }));
        });
      }
      break;
    case 'group-answer':
      if (groupPeers.has(data.from)) {
        groupPeers.get(data.from).pc.setRemoteDescription(new RTCSessionDescription(data.payload));
      }
      break;
    case 'group-ice-candidate':
      if (groupPeers.has(data.from) && data.payload) {
        groupPeers.get(data.from).pc.addIceCandidate(new RTCIceCandidate(data.payload));
      }
      break;

    case 'error':
      alert(data.message);
      break;
  }
}

// بدء التطبيق
showScreen('age');