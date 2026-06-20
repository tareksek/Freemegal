// app.js - النسخة النهائية المستقرة
(function() {
  'use strict';

  // ---------- البيانات العامة ----------
  const userData = {
    ageConfirmed: false,
    gender: null,
    email: null,
    emailVerified: false,
    preferredGender: null
  };

  // ---------- عناصر DOM الأساسية ----------
  const screens = {
    age: document.getElementById('ageScreen'),
    gender: document.getElementById('genderScreen'),
    pref: document.getElementById('prefScreen'),
    chat: document.getElementById('chatScreen')
  };

  // ---------- دوال مساعدة ----------
  function showScreen(screenId) {
    Object.keys(screens).forEach(id => {
      screens[id].classList.toggle('active', id === screenId);
    });
    console.log('عرض شاشة:', screenId);
  }

  // ========== المرحلة 1: شاشات البداية ==========
  function initStartupScreens() {
    document.getElementById('ageYes').addEventListener('click', () => {
      userData.ageConfirmed = true;
      showScreen('gender');
    });

    document.getElementById('ageNo').addEventListener('click', () => {
      location.reload();
    });

    document.querySelectorAll('.gender-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        document.querySelectorAll('.gender-btn').forEach(b => b.classList.remove('selected'));
        this.classList.add('selected');
        userData.gender = this.dataset.gender;
        showScreen('pref');
        initPrefScreen(); // تهيئة أحداث شاشة التفضيلات الآن
      });
    });
  }

  // ========== المرحلة 2: شاشة التفضيلات ==========
  function initPrefScreen() {
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

    toggleEmailBtn.addEventListener('click', () => {
      emailSection.style.display = emailSection.style.display === 'none' ? 'block' : 'none';
    });

    sendCodeBtn.addEventListener('click', async () => {
      const email = emailInput.value.trim();
      if (!email) {
        emailMsg.textContent = 'أدخل بريداً صحيحاً';
        return;
      }
      emailMsg.textContent = 'جاري الإرسال...';
      try {
        const res = await fetch('/api/send-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        const data = await res.json();
        if (res.ok) {
          emailMsg.textContent = data.message;
          codeSection.style.display = 'block';
          if (data.code) alert('رمز التأكيد (للتطوير): ' + data.code);
        } else {
          emailMsg.textContent = data.error || 'فشل';
        }
      } catch (e) {
        emailMsg.textContent = 'فشل الاتصال بالخادم.';
      }
    });

    verifyCodeBtn.addEventListener('click', async () => {
      const email = emailInput.value.trim();
      const code = codeInput.value.trim();
      if (!email || !code) {
        emailMsg.textContent = 'أدخل البريد والرمز';
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
          emailMsg.textContent = '✅ تم التأكيد!';
          emailSection.style.display = 'none';
          toggleEmailBtn.style.display = 'none';
          prefStatus.textContent = 'يمكنك الآن اختيار الجنس المفضل.';
          prefOptions.style.display = 'block';
        } else {
          emailMsg.textContent = data.error || 'فشل';
        }
      } catch (e) {
        emailMsg.textContent = 'فشل الاتصال بالخادم.';
      }
    });

    document.querySelectorAll('.pref-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        if (!userData.emailVerified) {
          alert('يجب تأكيد بريدك الإلكتروني أولاً.');
          return;
        }
        document.querySelectorAll('.pref-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        userData.preferredGender = this.dataset.pref;
      });
    });

    goToChatBtn.addEventListener('click', () => {
      if (!userData.gender) {
        alert('يرجى اختيار جنسك أولاً.');
        return;
      }
      showScreen('chat');
      initChatApp(); // تهيئة تطبيق الدردشة
    });
  }

  // ========== المرحلة 3: تطبيق الدردشة ==========
  let ws = null;
  let randomState = 'idle'; // idle, searching, connected
  let randomLocalStream = null, randomPC = null, randomDC = null, randomPartnerId = null;
  let groupLocalStream = null, groupRoomId = null;
  const groupPeers = new Map();
  let activeTab = 'random';

  // عناصر DOM الخاصة بالدردشة (سنملؤها لاحقاً)
  const dom = {};

  function cacheChatDom() {
    dom.statusBadge = document.getElementById('statusBadge');
    dom.tabRandom = document.getElementById('tabRandom');
    dom.tabGroup = document.getElementById('tabGroup');
    dom.randomPanel = document.getElementById('randomPanel');
    dom.groupPanel = document.getElementById('groupPanel');
    dom.randomRemote = document.getElementById('randomRemote');
    dom.randomLocal = document.getElementById('randomLocal');
    dom.randomPartnerLabel = document.getElementById('randomPartnerLabel');
    dom.noPartnerMessage = document.getElementById('noPartnerMessage');
    dom.randomChatBox = document.getElementById('randomChatBox');
    dom.randomMessages = document.getElementById('randomMessages');
    dom.randomMsgInput = document.getElementById('randomMessageInput');
    dom.randomSendBtn = document.getElementById('randomSendBtn');
    dom.randomFindBtn = document.getElementById('randomFindBtn');
    dom.randomNextBtn = document.getElementById('randomNextBtn');
    dom.randomDisconnectBtn = document.getElementById('randomDisconnectBtn');
    dom.roomIdInput = document.getElementById('roomIdInput');
    dom.joinRoomBtn = document.getElementById('joinRoomBtn');
    dom.createRoomBtn = document.getElementById('createRoomBtn');
    dom.leaveRoomBtn = document.getElementById('leaveRoomBtn');
    dom.roomLabel = document.getElementById('roomLabel');
    dom.groupVideos = document.getElementById('groupVideos');
    dom.groupChatBox = document.getElementById('groupChatBox');
    dom.groupMessages = document.getElementById('groupMessages');
    dom.groupMsgInput = document.getElementById('groupMessageInput');
    dom.groupSendBtn = document.getElementById('groupSendBtn');
  }

  function updateRandomButtons() {
    if (!dom.randomFindBtn) return;
    dom.randomFindBtn.disabled = randomState !== 'idle';
    dom.randomNextBtn.disabled = randomState !== 'connected';
    dom.randomDisconnectBtn.disabled = randomState !== 'connected';
    console.log(`أزرار عشوائي: حالة=${randomState}`);
  }

  function setStatus(text) {
    if (dom.statusBadge) dom.statusBadge.textContent = text;
  }

  // ---------- WebSocket ----------
  function connectWebSocket() {
    if (ws && ws.readyState === WebSocket.OPEN) return;
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${protocol}://${location.host}`);
    ws.onopen = () => console.log('WebSocket مفتوح');
    ws.onmessage = handleWSMessage;
    ws.onclose = () => {
      console.log('WebSocket مغلق');
      setStatus('انقطع الاتصال بالخادم');
      closeRandomPeer();
      randomState = 'idle';
      updateRandomButtons();
    };
    ws.onerror = (err) => console.error('WebSocket خطأ:', err);
  }

  function handleWSMessage(e) {
    const data = JSON.parse(e.data);
    console.log('رسالة:', data.type);

    switch (data.type) {
      case 'searching':
        randomState = 'searching';
        updateRandomButtons();
        setStatus('جاري البحث...');
        break;
      case 'matched':
        randomPartnerId = data.partnerId;
        if (dom.randomPartnerLabel) {
          dom.randomPartnerLabel.textContent = `الشريك (${data.partnerInfo.gender})`;
          dom.randomPartnerLabel.style.display = 'block';
        }
        if (dom.noPartnerMessage) dom.noPartnerMessage.style.display = 'none';
        startRandomPeer(data.role);
        randomState = 'connected';
        updateRandomButtons();
        setStatus('متصل');
        break;
      case 'partnerDisconnected':
        closeRandomPeer();
        randomState = 'idle';
        updateRandomButtons();
        setStatus('انقطع');
        break;
      case 'disconnected':
        closeRandomPeer();
        stopRandomMedia();
        randomState = 'idle';
        updateRandomButtons();
        setStatus('جاهز');
        break;
      case 'offer':
        if (randomPC) {
          randomPC.setRemoteDescription(new RTCSessionDescription(data.payload))
            .then(() => randomPC.createAnswer())
            .then(answer => {
              randomPC.setLocalDescription(answer);
              ws.send(JSON.stringify({ type: 'answer', payload: answer }));
            }).catch(err => console.error('offer error:', err));
        }
        break;
      case 'answer':
        if (randomPC) {
          randomPC.setRemoteDescription(new RTCSessionDescription(data.payload)).catch(err => console.error('answer error:', err));
        }
        break;
      case 'ice-candidate':
        if (randomPC && data.payload) {
          randomPC.addIceCandidate(new RTCIceCandidate(data.payload)).catch(err => console.error('ice error:', err));
        }
        break;

      // إشارات الغرفة
      case 'room-created':
        groupRoomId = data.roomId;
        dom.roomLabel.innerHTML = `<i class="fa-solid fa-users"></i> الغرفة: ${groupRoomId}`;
        dom.leaveRoomBtn.disabled = false;
        dom.groupChatBox.style.display = 'flex';
        setStatus('في غرفة');
        break;
      case 'room-users':
        data.members.forEach(async memberId => {
          if (memberId !== ws.id) await setupGroupPeer(memberId, true);
        });
        break;
      case 'room-user-joined':
        setupGroupPeer(data.userId, true);
        break;
      case 'room-user-left':
        closeGroupPeer(data.userId);
        break;
      case 'group-offer':
        setupGroupPeer(data.from, false).then(async pc => {
          await pc.setRemoteDescription(new RTCSessionDescription(data.payload));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          ws.send(JSON.stringify({ type: 'group-answer', to: data.from, payload: answer }));
        });
        break;
      case 'group-answer':
        if (groupPeers.has(data.from)) {
          const peer = groupPeers.get(data.from);
          if (peer.pc) peer.pc.setRemoteDescription(new RTCSessionDescription(data.payload));
        }
        break;
      case 'group-ice-candidate':
        if (groupPeers.has(data.from) && data.payload) {
          const peer = groupPeers.get(data.from);
          if (peer.pc) peer.pc.addIceCandidate(new RTCIceCandidate(data.payload)).catch(err => console.error('group ice error:', err));
        }
        break;
      case 'error':
        alert(data.message);
        break;
    }
  }

  // ---------- وسائط عشوائي ----------
  async function startRandomMedia() {
    if (randomLocalStream) return true;
    try {
      randomLocalStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (dom.randomLocal) dom.randomLocal.srcObject = randomLocalStream;
      return true;
    } catch (e) {
      alert('تعذر الوصول إلى الكاميرا والميكروفون');
      return false;
    }
  }

  function stopRandomMedia() {
    if (randomLocalStream) {
      randomLocalStream.getTracks().forEach(t => t.stop());
      randomLocalStream = null;
      if (dom.randomLocal) dom.randomLocal.srcObject = null;
    }
  }

  function closeRandomPeer() {
    if (randomPC) {
      randomPC.close();
      randomPC = null;
    }
    randomDC = null;
    if (dom.randomRemote) dom.randomRemote.srcObject = null;
    randomPartnerId = null;
    if (dom.randomMessages) dom.randomMessages.innerHTML = '';
    if (dom.randomChatBox) dom.randomChatBox.style.display = 'none';
    if (dom.randomPartnerLabel) dom.randomPartnerLabel.style.display = 'none';
    if (dom.noPartnerMessage) dom.noPartnerMessage.style.display = 'flex';
  }

  async function startRandomPeer(role) {
    closeRandomPeer();
    randomPC = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    if (randomLocalStream) {
      randomLocalStream.getTracks().forEach(track => randomPC.addTrack(track, randomLocalStream));
    }

    randomPC.ontrack = (event) => {
      if (event.streams[0] && dom.randomRemote) {
        dom.randomRemote.srcObject = event.streams[0];
        if (dom.noPartnerMessage) dom.noPartnerMessage.style.display = 'none';
      }
    };

    randomPC.onicecandidate = (event) => {
      if (event.candidate && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ice-candidate', payload: event.candidate }));
      }
    };

    if (role === 'initiator') {
      randomDC = randomPC.createDataChannel('chat');
      setupRandomDC();
    } else {
      randomPC.ondatachannel = (event) => {
        randomDC = event.channel;
        setupRandomDC();
      };
    }

    if (role === 'initiator') {
      try {
        const offer = await randomPC.createOffer();
        await randomPC.setLocalDescription(offer);
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'offer', payload: offer }));
        }
      } catch (err) {
        console.error('خطأ في إنشاء العرض:', err);
      }
    }
  }

  function setupRandomDC() {
    if (!randomDC) return;
    randomDC.onmessage = (event) => addRandomMsg(event.data, 'partner');
    randomDC.onopen = () => {
      if (dom.randomChatBox) dom.randomChatBox.style.display = 'flex';
    };
    randomDC.onclose = () => console.log('Random DC closed');
  }

  function addRandomMsg(text, sender) {
    if (!dom.randomMessages) return;
    const div = document.createElement('div');
    div.className = `msg-line ${sender === 'you' ? 'msg-you' : 'msg-partner'}`;
    div.textContent = (sender === 'you' ? 'أنت: ' : 'الشريك: ') + text;
    dom.randomMessages.appendChild(div);
    dom.randomMessages.scrollTop = dom.randomMessages.scrollHeight;
  }

  // ---------- وسائط جماعي ----------
  async function startGroupMedia() {
    if (groupLocalStream) return true;
    try {
      groupLocalStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      addGroupVideo('local', groupLocalStream, 'أنت');
      return true;
    } catch (e) {
      alert('الكاميرا مطلوبة للغرفة الجماعية');
      return false;
    }
  }

  function addGroupVideo(id, stream, label) {
    if (!dom.groupVideos) return;
    // إزالة فيديو سابق بنفس id
    const existing = document.getElementById(`video-${id}`);
    if (existing) existing.remove();

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
    dom.groupVideos.appendChild(wrapper);
  }

  function removeGroupVideo(id) {
    const el = document.getElementById(`video-${id}`);
    if (el) el.remove();
  }

  async function setupGroupPeer(userId, initiator) {
    closeGroupPeer(userId);
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    if (groupLocalStream) {
      groupLocalStream.getTracks().forEach(track => pc.addTrack(track, groupLocalStream));
    }

    pc.ontrack = (event) => {
      if (event.streams[0]) addGroupVideo(userId, event.streams[0], `مستخدم ${userId}`);
    };
    pc.onicecandidate = (event) => {
      if (event.candidate && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'group-ice-candidate', to: userId, payload: event.candidate }));
      }
    };

    if (initiator) {
      const dc = pc.createDataChannel('chat');
      setupGroupDC(userId, dc);
    } else {
      pc.ondatachannel = (event) => setupGroupDC(userId, event.channel);
    }

    groupPeers.set(userId, { pc });
    if (initiator) {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'group-offer', to: userId, payload: offer }));
        }
      } catch (err) {
        console.error('خطأ group offer:', err);
      }
    }
    return pc;
  }

  function setupGroupDC(userId, dc) {
    const peer = groupPeers.get(userId) || {};
    peer.dc = dc;
    groupPeers.set(userId, peer);
    dc.onmessage = (event) => addGroupMsg(`مستخدم ${userId}`, event.data);
  }

  function closeGroupPeer(userId) {
    const peer = groupPeers.get(userId);
    if (peer) {
      if (peer.pc) peer.pc.close();
      groupPeers.delete(userId);
    }
    removeGroupVideo(userId);
  }

  function closeAllGroupPeers() {
    groupPeers.forEach((peer, id) => closeGroupPeer(id));
    groupPeers.clear();
  }

  function leaveGroupRoom() {
    if (!groupRoomId) return;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'leave-room' }));
    }
    closeAllGroupPeers();
    if (dom.groupVideos) {
      Array.from(dom.groupVideos.children).forEach(el => {
        if (el.id !== 'video-local') el.remove();
      });
    }
    groupRoomId = null;
    if (dom.roomLabel) dom.roomLabel.innerHTML = '<i class="fa-solid fa-door-open"></i> لست في غرفة';
    if (dom.leaveRoomBtn) dom.leaveRoomBtn.disabled = true;
    if (dom.groupChatBox) dom.groupChatBox.style.display = 'none';
    setStatus('خارج غرفة');
  }

  function addGroupMsg(sender, text) {
    if (!dom.groupMessages) return;
    const div = document.createElement('div');
    div.className = 'msg-line';
    div.textContent = `${sender}: ${text}`;
    dom.groupMessages.appendChild(div);
    dom.groupMessages.scrollTop = dom.groupMessages.scrollHeight;
  }

  // ---------- تبديل التبويب ----------
  function switchTab(tab) {
    activeTab = tab;
    if (dom.tabRandom) dom.tabRandom.classList.toggle('active', tab === 'random');
    if (dom.tabGroup) dom.tabGroup.classList.toggle('active', tab === 'group');
    if (dom.randomPanel) dom.randomPanel.classList.toggle('active', tab === 'random');
    if (dom.groupPanel) dom.groupPanel.classList.toggle('active', tab === 'group');
    if (tab === 'random') {
      setStatus(randomState === 'idle' ? 'جاهز' : randomState === 'searching' ? 'جاري البحث...' : 'متصل');
    } else {
      setStatus(groupRoomId ? 'في غرفة' : 'خارج غرفة');
    }
  }

  // ---------- ربط أحداث الدردشة ----------
  function bindChatEvents() {
    dom.tabRandom.addEventListener('click', () => switchTab('random'));
    dom.tabGroup.addEventListener('click', () => switchTab('group'));

    dom.randomFindBtn.addEventListener('click', async () => {
      if (!await startRandomMedia()) return;
      connectWebSocket();
      const sendFind = () => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'find',
            gender: userData.gender,
            preferredGender: userData.emailVerified ? userData.preferredGender : null
          }));
        }
      };
      if (ws.readyState === WebSocket.OPEN) {
        sendFind();
      } else {
        ws.addEventListener('open', sendFind, { once: true });
      }
      randomState = 'searching';
      updateRandomButtons();
      setStatus('جاري البحث...');
    });

    dom.randomNextBtn.addEventListener('click', () => {
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify({
        type: 'next',
        gender: userData.gender,
        preferredGender: userData.emailVerified ? userData.preferredGender : null
      }));
      closeRandomPeer();
      randomState = 'searching';
      updateRandomButtons();
      setStatus('جاري البحث...');
    });

    dom.randomDisconnectBtn.addEventListener('click', () => {
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify({ type: 'disconnect-random' }));
      closeRandomPeer();
      stopRandomMedia();
      randomState = 'idle';
      updateRandomButtons();
      setStatus('جاهز');
    });

    dom.randomSendBtn.addEventListener('click', () => {
      const text = dom.randomMsgInput.value.trim();
      if (text && randomDC && randomDC.readyState === 'open') {
        randomDC.send(text);
        addRandomMsg(text, 'you');
        dom.randomMsgInput.value = '';
      }
    });

    dom.joinRoomBtn.addEventListener('click', async () => {
      if (!await startGroupMedia()) return;
      const roomId = dom.roomIdInput.value.trim();
      if (!roomId) return;
      connectWebSocket();
      ws.send(JSON.stringify({ type: 'join-room', roomId }));
      groupRoomId = roomId;
      dom.roomLabel.innerHTML = `<i class="fa-solid fa-users"></i> الغرفة: ${roomId}`;
      dom.leaveRoomBtn.disabled = false;
      dom.groupChatBox.style.display = 'flex';
      setStatus('في غرفة');
    });

    dom.createRoomBtn.addEventListener('click', async () => {
      if (!await startGroupMedia()) return;
      connectWebSocket();
      ws.send(JSON.stringify({ type: 'create-room' }));
    });

    dom.leaveRoomBtn.addEventListener('click', leaveGroupRoom);

    dom.groupSendBtn.addEventListener('click', () => {
      const text = dom.groupMsgInput.value.trim();
      if (!text) return;
      groupPeers.forEach(peer => {
        if (peer.dc && peer.dc.readyState === 'open') {
          peer.dc.send(text);
        }
      });
      addGroupMsg('أنت', text);
      dom.groupMsgInput.value = '';
    });
  }

  function initChatApp() {
    cacheChatDom();
    bindChatEvents();
    connectWebSocket();
    switchTab('random');
    randomState = 'idle';
    updateRandomButtons();
    setStatus('جاهز');
    console.log('تطبيق الدردشة جاهز');
  }

  // ---------- بدء التطبيق ----------
  document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM جاهز');
    initStartupScreens();
    // نعرض شاشة العمر بشكل افتراضي (الـ HTML يجعلها active افتراضياً)
  });

})();