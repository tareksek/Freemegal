(function() {
  'use strict';

  // ---------- خوادم ICE محسّنة (STUN + TURN مجاني) ----------
  const iceConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      }
    ]
  };

  // إعدادات الوسائط المثلى
  const mediaConstraints = {
    video: {
      width: { ideal: 640 },
      height: { ideal: 480 },
      frameRate: { ideal: 20 }
    },
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    }
  };

  // ---------- قاموس الترجمة ----------
  const translations = {
    ar: {
      pageTitle: 'دردشة عشوائية متطورة',
      ageTitle: 'تأكيد العمر',
      ageQuestion: 'هل عمرك 18 سنة أو أكثر؟',
      yes: 'نعم',
      no: 'لا',
      genderTitle: 'اختر جنسك',
      male: 'ذكر',
      female: 'أنثى',
      prefTitle: 'التفضيلات',
      prefStatusDefault: 'تأكيد بريدك الإلكتروني يفتح تفضيل الجنس.',
      toggleEmail: 'تفعيل التفضيل بالبريد',
      sendCode: 'إرسال رمز',
      verifyCode: 'تأكيد',
      prefLabel: 'الجنس المفضل للتحدث معه:',
      all: 'الجميع',
      goToChat: 'دخول الدردشة',
      tabRandom: 'عشوائي',
      tabGroup: 'جماعي',
      statusReady: 'جاهز',
      statusSearching: 'جاري البحث...',
      statusConnected: 'متصل',
      statusDisconnected: 'انقطع',
      statusInRoom: 'في غرفة',
      statusNotInRoom: 'خارج غرفة',
      noPartner: 'لا يوجد شريك',
      you: 'أنت',
      partner: 'الشريك',
      find: 'بحث',
      next: 'التالي',
      disconnect: 'قطع',
      joinRoom: 'انضمام',
      createRoom: 'إنشاء',
      leaveRoom: 'مغادرة',
      notInRoom: 'لست في غرفة',
      emailPlaceholder: 'بريدك الإلكتروني',
      codePlaceholder: 'الرمز السري',
      randomMsgPlaceholder: 'رسالتك...',
      groupMsgPlaceholder: 'رسالة للجميع...',
      roomIdPlaceholder: 'معرف الغرفة',
      emailSent: 'تم إرسال الرمز إلى بريدك.',
      emailSentDev: 'تم إرسال الرمز (تحقق من الطرفية).',
      codeVerified: '✅ تم التأكيد!',
      genderRequired: 'اختر جنسك أولاً.',
      emailRequired: 'أكد بريدك أولاً',
      mediaError: 'تعذر الوصول للكاميرا والميكروفون',
      wsClosed: 'انقطع الاتصال بالخادم',
      youLabel: 'أنت',
      partnerLabel: 'الشريك',
      user: 'مستخدم',
      langBtn: 'English',
      langCode: 'en',
      error: 'حدث خطأ',
      codeSentDev: 'رمز التأكيد (للتطوير): ',
      headphoneTip: '🎧 نصيحة: استخدم سماعة رأس لتجنب الصدى.'
    },
    en: {
      pageTitle: 'Advanced Random Chat',
      ageTitle: 'Age Verification',
      ageQuestion: 'Are you 18 years or older?',
      yes: 'Yes',
      no: 'No',
      genderTitle: 'Choose Your Gender',
      male: 'Male',
      female: 'Female',
      prefTitle: 'Preferences',
      prefStatusDefault: 'Verify your email to unlock gender preference.',
      toggleEmail: 'Activate Preference via Email',
      sendCode: 'Send Code',
      verifyCode: 'Verify',
      prefLabel: 'Preferred gender to talk to:',
      all: 'Everyone',
      goToChat: 'Enter Chat',
      tabRandom: 'Random',
      tabGroup: 'Group',
      statusReady: 'Ready',
      statusSearching: 'Searching...',
      statusConnected: 'Connected',
      statusDisconnected: 'Disconnected',
      statusInRoom: 'In Room',
      statusNotInRoom: 'Not in Room',
      noPartner: 'No Partner',
      you: 'You',
      partner: 'Partner',
      find: 'Find',
      next: 'Next',
      disconnect: 'Disconnect',
      joinRoom: 'Join',
      createRoom: 'Create',
      leaveRoom: 'Leave',
      notInRoom: 'Not in a room',
      emailPlaceholder: 'Your Email',
      codePlaceholder: 'Secret Code',
      randomMsgPlaceholder: 'Your message...',
      groupMsgPlaceholder: 'Message to everyone...',
      roomIdPlaceholder: 'Room ID',
      emailSent: 'Code sent to your email.',
      emailSentDev: 'Code sent (check terminal).',
      codeVerified: '✅ Verified!',
      genderRequired: 'Please choose your gender first.',
      emailRequired: 'Please verify your email first.',
      mediaError: 'Could not access camera/microphone',
      wsClosed: 'Server disconnected',
      youLabel: 'You',
      partnerLabel: 'Partner',
      user: 'User',
      langBtn: 'العربية',
      langCode: 'ar',
      error: 'An error occurred',
      codeSentDev: 'Verification code (dev): ',
      headphoneTip: '🎧 Tip: Use headphones to avoid echo.'
    }
  };

  let currentLang = localStorage.getItem('lang') || 'ar';

  function t(key) {
    return translations[currentLang]?.[key] || translations.ar[key] || key;
  }

  function applyStaticTranslations() {
    document.title = t('pageTitle');

    const textIds = {
      'ageTitle': 'ageTitle',
      'ageQuestion': 'ageQuestion',
      'ageYesText': 'yes',
      'ageNoText': 'no',
      'genderTitle': 'genderTitle',
      'maleText': 'male',
      'femaleText': 'female',
      'prefTitle': 'prefTitle',
      'toggleEmailText': 'toggleEmail',
      'sendCodeText': 'sendCode',
      'verifyCodeText': 'verifyCode',
      'prefLabel': 'prefLabel',
      'prefMaleText': 'male',
      'prefFemaleText': 'female',
      'prefAllText': 'all',
      'goToChatText': 'goToChat',
      'tabRandomText': 'tabRandom',
      'tabGroupText': 'tabGroup',
      'langText': 'langBtn',
      'noPartnerText': 'noPartner',
      'youTag': 'you',
      'findBtnText': 'find',
      'nextBtnText': 'next',
      'disconnectBtnText': 'disconnect',
      'joinRoomText': 'joinRoom',
      'createRoomText': 'createRoom',
      'leaveRoomText': 'leaveRoom',
      'notInRoomText': 'notInRoom'
    };

    for (const [elId, key] of Object.entries(textIds)) {
      const el = document.getElementById(elId);
      if (el) el.textContent = t(key);
    }

    const prefStatusEl = document.getElementById('prefStatus');
    if (prefStatusEl && !prefStatusEl.dataset.dynamic) {
      prefStatusEl.textContent = t('prefStatusDefault');
    }

    document.getElementById('emailInput').placeholder = t('emailPlaceholder');
    document.getElementById('codeInput').placeholder = t('codePlaceholder');
    document.getElementById('randomMessageInput').placeholder = t('randomMsgPlaceholder');
    document.getElementById('groupMessageInput').placeholder = t('groupMsgPlaceholder');
    document.getElementById('roomIdInput').placeholder = t('roomIdPlaceholder');

    document.documentElement.lang = currentLang;
    document.documentElement.dir = currentLang === 'ar' ? 'rtl' : 'ltr';
  }

  function switchLanguage() {
    currentLang = currentLang === 'ar' ? 'en' : 'ar';
    localStorage.setItem('lang', currentLang);
    applyStaticTranslations();
    updateDynamicTexts();
  }

  function updateDynamicTexts() {
    if (currentScreen === 'chat') {
      setStatus(getStatusText());
      document.getElementById('tabRandomText').textContent = t('tabRandom');
      document.getElementById('tabGroupText').textContent = t('tabGroup');
      document.getElementById('findBtnText').textContent = t('find');
      document.getElementById('nextBtnText').textContent = t('next');
      document.getElementById('disconnectBtnText').textContent = t('disconnect');
      document.getElementById('joinRoomText').textContent = t('joinRoom');
      document.getElementById('createRoomText').textContent = t('createRoom');
      document.getElementById('leaveRoomText').textContent = t('leaveRoom');
      document.getElementById('notInRoomText').textContent = t('notInRoom');
      document.getElementById('noPartnerText').textContent = t('noPartner');
      document.getElementById('youTag').textContent = t('you');

      const roomLabel = document.getElementById('roomLabel');
      if (roomLabel) {
        if (groupRoomId) {
          roomLabel.innerHTML = `<i class="fa-solid fa-users"></i> ${t('statusInRoom')} : ${groupRoomId}`;
        } else {
          roomLabel.innerHTML = `<i class="fa-solid fa-door-open"></i> ${t('notInRoom')}`;
        }
      }
      if (randomPartnerId && dom.randomPartnerLabel) {
        dom.randomPartnerLabel.textContent = `${t('partner')} (${randomPartnerGender || 'unknown'})`;
      }
    }
  }

  function getStatusText() {
    if (activeTab === 'random') {
      if (randomState === 'idle') return t('statusReady');
      if (randomState === 'searching') return t('statusSearching');
      if (randomState === 'connected') return t('statusConnected');
      return t('statusDisconnected');
    } else {
      return groupRoomId ? t('statusInRoom') : t('statusNotInRoom');
    }
  }

  // ---------- بيانات المستخدم ----------
  const userData = {
    ageConfirmed: false,
    gender: null,
    email: null,
    emailVerified: false,
    preferredGender: null
  };

  let currentScreen = 'age';
  const screens = {
    age: document.getElementById('ageScreen'),
    gender: document.getElementById('genderScreen'),
    pref: document.getElementById('prefScreen'),
    chat: document.getElementById('chatScreen')
  };

  function showScreen(screenId) {
    Object.keys(screens).forEach(id => {
      screens[id].classList.toggle('active', id === screenId);
    });
    currentScreen = screenId;
    if (screenId === 'chat') updateDynamicTexts();
  }

  // ========== المرحلة 1: شاشات البداية ==========
  function initStartupScreens() {
    document.getElementById('ageYes').addEventListener('click', () => {
      userData.ageConfirmed = true;
      showScreen('gender');
    });
    document.getElementById('ageNo').addEventListener('click', () => location.reload());

    document.querySelectorAll('.gender-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        document.querySelectorAll('.gender-btn').forEach(b => b.classList.remove('selected'));
        this.classList.add('selected');
        userData.gender = this.dataset.gender;
        showScreen('pref');
        initPrefScreen();
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
      if (!email) { emailMsg.textContent = t('emailRequired'); return; }
      emailMsg.textContent = '...';
      try {
        const res = await fetch('/api/send-code', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({email}) });
        const data = await res.json();
        if (res.ok) {
          emailMsg.textContent = data.code ? t('emailSentDev') : t('emailSent');
          codeSection.style.display = 'block';
          if (data.code) alert(t('codeSentDev') + data.code);
        } else {
          emailMsg.textContent = data.error || t('error');
        }
      } catch(e) { emailMsg.textContent = t('error'); }
    });

    verifyCodeBtn.addEventListener('click', async () => {
      const email = emailInput.value.trim();
      const code = codeInput.value.trim();
      if (!email || !code) { emailMsg.textContent = t('emailRequired'); return; }
      try {
        const res = await fetch('/api/verify-code', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({email, code}) });
        const data = await res.json();
        if (res.ok) {
          userData.emailVerified = true;
          userData.email = email;
          emailMsg.textContent = t('codeVerified');
          emailSection.style.display = 'none';
          toggleEmailBtn.style.display = 'none';
          prefStatus.textContent = t('prefStatusDefault');
          prefStatus.dataset.dynamic = 'true';
          prefOptions.style.display = 'block';
        } else {
          emailMsg.textContent = data.error || t('error');
        }
      } catch(e) { emailMsg.textContent = t('error'); }
    });

    document.querySelectorAll('.pref-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        if (!userData.emailVerified) { alert(t('emailRequired')); return; }
        document.querySelectorAll('.pref-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        userData.preferredGender = this.dataset.pref;
      });
    });

    goToChatBtn.addEventListener('click', () => {
      if (!userData.gender) { alert(t('genderRequired')); return; }
      // تنبيه السماعة
      alert(t('headphoneTip'));
      showScreen('chat');
      initChatApp();
    });
  }

  // ========== المرحلة 3: تطبيق الدردشة ==========
  let ws = null;
  let randomState = 'idle';
  let randomLocalStream = null, randomPC = null, randomDC = null, randomPartnerId = null;
  let randomPartnerGender = null;
  let groupLocalStream = null, groupRoomId = null;
  const groupPeers = new Map();
  let activeTab = 'random';

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
  }

  function setStatus(text) {
    if (dom.statusBadge) dom.statusBadge.textContent = text;
  }

  // ---------- WebSocket ----------
  function connectWebSocket() {
    if (ws && ws.readyState === WebSocket.OPEN) return;
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${protocol}://${location.host}`);
    ws.onopen = () => console.log('WS مفتوح');
    ws.onmessage = handleWSMessage;
    ws.onclose = () => {
      setStatus(t('wsClosed'));
      closeRandomPeer();
      randomState = 'idle';
      updateRandomButtons();
    };
    ws.onerror = () => {};
  }

  function handleWSMessage(e) {
    const data = JSON.parse(e.data);
    switch (data.type) {
      case 'searching':
        randomState = 'searching';
        updateRandomButtons();
        setStatus(t('statusSearching'));
        break;
      case 'matched':
        randomPartnerId = data.partnerId;
        randomPartnerGender = data.partnerInfo.gender;
        if (dom.randomPartnerLabel) {
          dom.randomPartnerLabel.textContent = `${t('partner')} (${randomPartnerGender})`;
          dom.randomPartnerLabel.style.display = 'block';
        }
        if (dom.noPartnerMessage) dom.noPartnerMessage.style.display = 'none';
        startRandomPeer(data.role);
        randomState = 'connected';
        updateRandomButtons();
        setStatus(t('statusConnected'));
        break;
      case 'partnerDisconnected':
        closeRandomPeer();
        randomState = 'idle';
        updateRandomButtons();
        setStatus(t('statusDisconnected'));
        break;
      case 'disconnected':
        closeRandomPeer();
        stopRandomMedia();
        randomState = 'idle';
        updateRandomButtons();
        setStatus(t('statusReady'));
        break;
      case 'offer':
        if (randomPC) {
          randomPC.setRemoteDescription(new RTCSessionDescription(data.payload))
            .then(() => randomPC.createAnswer())
            .then(answer => {
              randomPC.setLocalDescription(answer);
              ws.send(JSON.stringify({ type: 'answer', payload: answer }));
            }).catch(err => console.error(err));
        }
        break;
      case 'answer':
        if (randomPC) randomPC.setRemoteDescription(new RTCSessionDescription(data.payload)).catch(err => console.error(err));
        break;
      case 'ice-candidate':
        if (randomPC && data.payload) randomPC.addIceCandidate(new RTCIceCandidate(data.payload)).catch(err => console.error(err));
        break;
      case 'room-created':
        groupRoomId = data.roomId;
        dom.roomLabel.innerHTML = `<i class="fa-solid fa-users"></i> ${t('statusInRoom')} : ${groupRoomId}`;
        dom.leaveRoomBtn.disabled = false;
        dom.groupChatBox.style.display = 'flex';
        setStatus(t('statusInRoom'));
        break;
      case 'room-users':
        if (!groupRoomId) groupRoomId = 'joined';
        data.members.forEach(async memberId => {
          if (memberId !== ws.id) await setupGroupPeer(memberId, true);
        });
        if (dom.roomLabel) dom.roomLabel.innerHTML = `<i class="fa-solid fa-users"></i> ${t('statusInRoom')}`;
        dom.leaveRoomBtn.disabled = false;
        dom.groupChatBox.style.display = 'flex';
        setStatus(t('statusInRoom'));
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
          if (peer.pc) peer.pc.addIceCandidate(new RTCIceCandidate(data.payload)).catch(err => console.error(err));
        }
        break;
      case 'error':
        alert(data.message);
        break;
    }
  }

  // ---------- وسائط عشوائي (مُحسَّنة) ----------
  async function startRandomMedia() {
    if (randomLocalStream) return true;
    try {
      randomLocalStream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
      dom.randomLocal.srcObject = randomLocalStream;
      return true;
    } catch(e) {
      alert(t('mediaError'));
      return false;
    }
  }

  function stopRandomMedia() {
    if (randomLocalStream) {
      randomLocalStream.getTracks().forEach(t => t.stop());
      randomLocalStream = null;
      dom.randomLocal.srcObject = null;
    }
  }

  function closeRandomPeer() {
    if (randomPC) { randomPC.close(); randomPC = null; }
    randomDC = null;
    if (dom.randomRemote) dom.randomRemote.srcObject = null;
    randomPartnerId = null;
    randomPartnerGender = null;
    if (dom.randomMessages) dom.randomMessages.innerHTML = '';
    if (dom.randomChatBox) dom.randomChatBox.style.display = 'none';
    if (dom.randomPartnerLabel) dom.randomPartnerLabel.style.display = 'none';
    if (dom.noPartnerMessage) dom.noPartnerMessage.style.display = 'flex';
  }

  async function startRandomPeer(role) {
    closeRandomPeer();
    randomPC = new RTCPeerConnection(iceConfig);   // <-- TURN + STUN
    randomLocalStream.getTracks().forEach(t => randomPC.addTrack(t, randomLocalStream));

    randomPC.ontrack = e => {
      if (e.streams[0]) {
        dom.randomRemote.srcObject = e.streams[0];
        dom.noPartnerMessage.style.display = 'none';
      }
    };
    randomPC.onicecandidate = e => {
      if (e.candidate && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ice-candidate', payload: e.candidate }));
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
    randomDC.onmessage = e => addRandomMsg(e.data, 'partner');
    randomDC.onopen = () => { dom.randomChatBox.style.display = 'flex'; };
  }

  function addRandomMsg(text, sender) {
    const div = document.createElement('div');
    div.className = `msg-line ${sender === 'you' ? 'msg-you' : 'msg-partner'}`;
    div.textContent = `${sender === 'you' ? t('youLabel') : t('partnerLabel')}: ${text}`;
    dom.randomMessages.appendChild(div);
    dom.randomMessages.scrollTop = dom.randomMessages.scrollHeight;
  }

  // ---------- وسائط جماعي (مُحسَّنة) ----------
  async function startGroupMedia() {
    if (groupLocalStream) return true;
    try {
      groupLocalStream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
      addGroupVideo('local', groupLocalStream, t('youLabel'));
      return true;
    } catch(e) { alert(t('mediaError')); return false; }
  }

  function addGroupVideo(id, stream, label) {
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
    const pc = new RTCPeerConnection(iceConfig);   // <-- TURN + STUN
    groupLocalStream.getTracks().forEach(t => pc.addTrack(t, groupLocalStream));

    pc.ontrack = e => {
      if (e.streams[0]) addGroupVideo(userId, e.streams[0], `${t('user')} ${userId}`);
    };
    pc.onicecandidate = e => {
      if (e.candidate && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'group-ice-candidate', to: userId, payload: e.candidate }));
    };

    if (initiator) {
      const dc = pc.createDataChannel('chat');
      setupGroupDC(userId, dc);
    } else {
      pc.ondatachannel = e => setupGroupDC(userId, e.channel);
    }

    groupPeers.set(userId, { pc });
    if (initiator) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      ws.send(JSON.stringify({ type: 'group-offer', to: userId, payload: offer }));
    }
    return pc;
  }

  function setupGroupDC(userId, dc) {
    const peer = groupPeers.get(userId) || {};
    peer.dc = dc;
    groupPeers.set(userId, peer);
    dc.onmessage = e => addGroupMsg(`${t('user')} ${userId}`, e.data);
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
    groupPeers.forEach((_, id) => closeGroupPeer(id));
    groupPeers.clear();
  }

  function leaveGroupRoom() {
    if (!groupRoomId) return;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'leave-room' }));
    closeAllGroupPeers();
    Array.from(dom.groupVideos.children).forEach(el => {
      if (el.id !== 'video-local') el.remove();
    });
    groupRoomId = null;
    dom.roomLabel.innerHTML = `<i class="fa-solid fa-door-open"></i> ${t('notInRoom')}`;
    dom.leaveRoomBtn.disabled = true;
    dom.groupChatBox.style.display = 'none';
    setStatus(t('statusNotInRoom'));
  }

  function addGroupMsg(sender, text) {
    const div = document.createElement('div');
    div.className = 'msg-line';
    div.textContent = `${sender}: ${text}`;
    dom.groupMessages.appendChild(div);
    dom.groupMessages.scrollTop = dom.groupMessages.scrollHeight;
  }

  function switchTab(tab) {
    activeTab = tab;
    dom.tabRandom.classList.toggle('active', tab === 'random');
    dom.tabGroup.classList.toggle('active', tab === 'group');
    dom.randomPanel.classList.toggle('active', tab === 'random');
    dom.groupPanel.classList.toggle('active', tab === 'group');
    setStatus(getStatusText());
  }

  function bindChatEvents() {
    document.getElementById('langToggle').addEventListener('click', switchLanguage);

    dom.tabRandom.addEventListener('click', () => switchTab('random'));
    dom.tabGroup.addEventListener('click', () => switchTab('group'));

    dom.randomFindBtn.addEventListener('click', async () => {
      if (!await startRandomMedia()) return;
      connectWebSocket();
      const send = () => ws.send(JSON.stringify({ type: 'find', gender: userData.gender, preferredGender: userData.emailVerified ? userData.preferredGender : null }));
      if (ws.readyState === WebSocket.OPEN) send();
      else ws.addEventListener('open', send, { once: true });
      randomState = 'searching';
      updateRandomButtons();
      setStatus(t('statusSearching'));
    });

    dom.randomNextBtn.addEventListener('click', () => {
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify({ type: 'next', gender: userData.gender, preferredGender: userData.emailVerified ? userData.preferredGender : null }));
      closeRandomPeer();
      randomState = 'searching';
      updateRandomButtons();
      setStatus(t('statusSearching'));
    });

    dom.randomDisconnectBtn.addEventListener('click', () => {
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify({ type: 'disconnect-random' }));
      closeRandomPeer();
      stopRandomMedia();
      randomState = 'idle';
      updateRandomButtons();
      setStatus(t('statusReady'));
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
        if (peer.dc && peer.dc.readyState === 'open') peer.dc.send(text);
      });
      addGroupMsg(t('youLabel'), text);
      dom.groupMsgInput.value = '';
    });
  }

  window.addEventListener('beforeunload', () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      if (randomState === 'connected') ws.send(JSON.stringify({ type: 'disconnect-random' }));
      if (groupRoomId) ws.send(JSON.stringify({ type: 'leave-room' }));
    }
  });

  function initChatApp() {
    cacheChatDom();
    bindChatEvents();
    connectWebSocket();
    applyStaticTranslations();
    switchTab('random');
    randomState = 'idle';
    updateRandomButtons();
    setStatus(t('statusReady'));
  }

  document.addEventListener('DOMContentLoaded', () => {
    applyStaticTranslations();
    initStartupScreens();
  });

})();