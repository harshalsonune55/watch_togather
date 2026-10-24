/**
 * Room Controller - Connects UI components with SyncEngine, WebRTCCall, and ChatEngine.
 * Inspired by Virtual Huddle (Video Conference) & FinSage Design System.
 */
document.addEventListener("DOMContentLoaded", () => {
  const roomId = window.ROOM_CONFIG.roomId;
  let userName = window.ROOM_CONFIG.userName;

  if (!userName || userName.trim() === "") {
    userName = localStorage.getItem("wt_username") || "Alex";
  }
  localStorage.setItem("wt_username", userName);

  // Initialize Socket.IO connection
  const socket = io();

  // DOM Elements
  const statusBadge = document.getElementById("syncStatusBadge");
  const statusText = document.getElementById("syncStatusText");
  const btnPlayPause = document.getElementById("btnPlayPause");
  const playOverlayBtn = document.getElementById("playOverlayBtn");
  const timelineProgress = document.getElementById("timelineProgress");
  const timelineCurrent = document.getElementById("timelineCurrent");
  const timeCurrentEl = document.getElementById("timeCurrent");
  const timeDurationEl = document.getElementById("timeDuration");
  const speedSelect = document.getElementById("speedSelect");
  const btnResync = document.getElementById("btnResync");
  const btnResyncSidebar = document.getElementById("btnResyncSidebar");
  const btnOpenVideoModal = document.getElementById("btnOpenVideoModal");
  const stageBadgeText = document.getElementById("stageBadgeText");
  const localUserName = document.getElementById("localUserName");
  const sidebarUserName = document.getElementById("sidebarUserName");
  const remoteUserName = document.getElementById("remoteUserName");
  const sidebarFriendName = document.getElementById("sidebarFriendName");
  const sidebarFriendStatusDot = document.getElementById("sidebarFriendStatusDot");

  // Modals & Inputs
  const videoModal = document.getElementById("videoModal");
  const btnCloseModal = document.getElementById("btnCloseModal");
  const formLoadVideo = document.getElementById("formLoadVideo");
  const inputVideoUrl = document.getElementById("inputVideoUrl");
  const inputLocalFile = document.getElementById("inputLocalFile");
  const toastNotice = document.getElementById("toastNotice");

  // Display user name on badges
  if (localUserName) localUserName.textContent = `${userName} (You)`;
  if (sidebarUserName) sidebarUserName.textContent = `${userName} (You)`;

  // Status Change Callback
  const handleSyncStatus = ({ status, text }) => {
    if (!statusBadge || !statusText) return;
    if (status === "synced") {
      statusText.textContent = "Live In-Sync";
    } else {
      statusText.textContent = text || "Paused";
    }
  };

  // Initialize Core Engines
  const syncEngine = new SyncEngine(socket, roomId, handleSyncStatus);
  const webrtcCall = new WebRTCCall(socket, roomId, userName);
  const chatEngine = new ChatEngine(socket, roomId, userName);
  window.syncEngine = syncEngine;
  window.webrtcCall = webrtcCall;

  // Join Room Session Function
  function startRoomSession(name) {
    userName = name;
    localStorage.setItem("wt_username", name);
    const localTag = document.getElementById("localUserNameTag");
    if (localTag) localTag.textContent = `${name} (You)`;

    socket.emit("join-room", { roomId, userName: name });
  }

  // Check if User Entered via Direct Link without a Name
  const joinNameModal = document.getElementById("joinNameModal");
  const formJoinName = document.getElementById("formJoinName");
  const inputJoinName = document.getElementById("inputJoinName");
  const hasUrlName = !!(window.ROOM_CONFIG.userName && window.ROOM_CONFIG.userName.trim());
  const storedName = localStorage.getItem("wt_username");

  if (!hasUrlName && !storedName && joinNameModal) {
    joinNameModal.classList.add("open");
    if (inputJoinName) {
      inputJoinName.value = "Guest " + Math.floor(Math.random() * 900 + 100);
      inputJoinName.select();
    }
  } else {
    startRoomSession(userName);
  }

  if (formJoinName) {
    formJoinName.addEventListener("submit", (e) => {
      e.preventDefault();
      const enteredName = (inputJoinName.value || "").trim() || ("Guest " + Math.floor(Math.random() * 900 + 100));
      if (joinNameModal) joinNameModal.classList.remove("open");
      startRoomSession(enteredName);
    });
  }

  // Handle Room Initialization from Server
  socket.on("room-init", (data) => {
    syncEngine.setClockOffset(data.video.serverTime);

    if (data.users && data.users.length > 1) {
      const partner = data.users.find(u => u.id !== data.yourId);
      if (partner) {
        if (remoteUserName) remoteUserName.textContent = partner.name;
        if (sidebarFriendName) sidebarFriendName.textContent = partner.name;
        if (sidebarFriendStatusDot) sidebarFriendStatusDot.style.color = "var(--mint)";
      }
    }

    if (data.users && data.users.length > 1) {
      const partner = data.users.find(u => u.id !== data.yourId);
      if (partner) {
        const remoteUserName = document.getElementById("remoteUserName");
        if (remoteUserName) remoteUserName.textContent = partner.name;
        webrtcCall.setRemotePeer(partner.id, partner.name);
      }
    }

    if (data.playlist) currentPlaylist = data.playlist;
    if (typeof data.currentEpisodeIndex === "number") currentEpisodeIndex = data.currentEpisodeIndex;
    if (data.webSeries) allSeries = data.webSeries;
    if (data.currentSeries) activeSeriesId = data.currentSeries.id;

    updateEpisodePillUI();
    renderEpisodesList();

    // Load initial video
    if (data.video) {
      syncEngine.loadVideo(data.video.type, data.video.source, data.video.title);
      if (stageBadgeText) stageBadgeText.textContent = data.video.title.substring(0, 28);
      if (data.video.currentTime > 0) {
        setTimeout(() => {
          syncEngine.seekTo(data.video.currentTime);
          if (data.video.state === "playing") {
            syncEngine.playLocal();
          }
        }, 800);
      }
    } else {
      syncEngine.loadVideo(null, null, "Waiting for video link or screen share");
    }

    // Load chat history
    if (data.messages && data.messages.length > 0) {
      data.messages.forEach((msg) => chatEngine.appendMessage(msg));
    }
  });

  // Video Change Broadcast
  socket.on("video-change", (data) => {
    if (stageBadgeText && data.video.title) {
      stageBadgeText.textContent = data.video.title.substring(0, 28);
    }
    showToast(`🎬 Loaded: ${data.video.title}`);
  });

  // Local File Sync Request from peer
  socket.on("local-file-request", (data) => {
    showToast(`📁 ${data.sender} selected "${data.fileName}". Choose your matching file!`);
  });

  // User Joined / Left
  socket.on("user-joined", (data) => {
    if (userCountVal) userCountVal.textContent = `${data.userCount}/2`;
    const remoteUserName = document.getElementById("remoteUserName");
    if (remoteUserName && data.user) remoteUserName.textContent = data.user.name;
    showToast(`👋 ${data.user.name} joined the room!`);
    webrtcCall.onUserJoined(data.user);
  });

  socket.on("user-left", (data) => {
    if (userCountVal) userCountVal.textContent = `${data.userCount}/2`;
    const remoteUserName = document.getElementById("remoteUserName");
    if (remoteUserName) remoteUserName.textContent = "Friend";
    showToast(`🚪 ${data.userName} left the room`);
    webrtcCall.onUserLeft(data.userId);
  });

  // -----------------------------------------------
  // Media Controls UI Binding
  // -----------------------------------------------

  if (btnPlayPause) {
    btnPlayPause.addEventListener("click", () => syncEngine.togglePlay());
  }
  if (playOverlayBtn) {
    playOverlayBtn.addEventListener("click", () => syncEngine.playLocal());
  }

  // Scrubber Progress Bar updates
  setInterval(() => {
    const curTime = syncEngine.getCurrentTime();
    const duration = syncEngine.getDuration();

    if (duration > 0) {
      const pct = (curTime / duration) * 100;
      if (timelineCurrent) timelineCurrent.style.width = `${pct}%`;
      if (timeCurrentEl) timeCurrentEl.textContent = formatTime(curTime);
      if (timeDurationEl) timeDurationEl.textContent = formatTime(duration);
    } else {
      if (timeCurrentEl) timeCurrentEl.textContent = formatTime(curTime);
    }
  }, 250);

  // Scrubber Seeking
  if (timelineProgress) {
    timelineProgress.addEventListener("click", (e) => {
      const rect = timelineProgress.getBoundingClientRect();
      const pos = (e.clientX - rect.left) / rect.width;
      const duration = syncEngine.getDuration();
      if (duration > 0) {
        const targetTime = Math.max(0, pos * duration);
        syncEngine.manualSeek(targetTime);
      }
    });
  }

  // Playback Rate
  if (speedSelect) {
    speedSelect.addEventListener("change", (e) => {
      const rate = parseFloat(e.target.value);
      syncEngine.setPlaybackRate(rate);
      socket.emit("video-rate", { rate });
    });
  }

  // Resync Button
  if (btnResync) {
    btnResync.addEventListener("click", () => {
      syncEngine.requestForceResync();
      if (webrtcCall && webrtcCall.targetPeerId) {
        webrtcCall.callPeer(webrtcCall.targetPeerId, true);
      }
      showToast("⚡ Synchronizing with partner...");
    });
  }

  // Cinema View (Floating PIP Mode)
  if (btnCinemaView && theaterLayout) {
    btnCinemaView.addEventListener("click", () => {
      const isCinema = theaterLayout.classList.toggle("cinema-view");
      btnCinemaView.classList.toggle("active", isCinema);
      showToast(isCinema ? "🎭 Cinema Mode Enabled (Facecam Floating)" : "🖥️ Theater Sidebar View");
    });
  }

  // Resync Button
  const handleResync = () => {
    syncEngine.requestForceResync();
    showToast("⚡ Synchronizing with partner...");
  };
  if (btnResync) btnResync.addEventListener("click", handleResync);
  if (btnResyncSidebar) btnResyncSidebar.addEventListener("click", handleResync);

  // -----------------------------------------------
  // Call Controls UI Binding
  // -----------------------------------------------
  const btnToggleMic = document.getElementById("btnToggleMic");
  const btnToggleCam = document.getElementById("btnToggleCam");
  const btnShareScreen = document.getElementById("btnShareScreen");

  if (btnToggleMic) {
    btnToggleMic.addEventListener("click", () => webrtcCall.toggleMicrophone());
  }
  if (btnToggleCam) {
    btnToggleCam.addEventListener("click", () => webrtcCall.toggleCamera());
  }
  if (btnShareScreen) {
    btnShareScreen.addEventListener("click", () => webrtcCall.toggleScreenShare());
  }

  // Empty Stage Action Buttons
  const btnEmptyLoadLink = document.getElementById("btnEmptyLoadLink");
  if (btnEmptyLoadLink && videoModal) {
    btnEmptyLoadLink.addEventListener("click", () => videoModal.classList.add("open"));
  }
  const btnEmptyShareScreen = document.getElementById("btnEmptyShareScreen");
  if (btnEmptyShareScreen) {
    btnEmptyShareScreen.addEventListener("click", () => webrtcCall.toggleScreenShare());
  }

  // Local File Selector
  if (inputLocalFile) {
    inputLocalFile.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) {
        syncEngine.loadLocalFile(file);
        if (stageBadgeText) stageBadgeText.textContent = ("📁 " + file.name).substring(0, 28);
        showToast(`📁 Loaded "${file.name}" locally!`);
      }
    });
  }

  // -----------------------------------------------
  // Modals & Menu Bindings
  // -----------------------------------------------

  if (btnOpenVideoModal && videoModal) {
    btnOpenVideoModal.addEventListener("click", () => videoModal.classList.add("open"));
  }
  const btnCardMenu1 = document.getElementById("btnCardMenu1");
  if (btnCardMenu1 && videoModal) {
    btnCardMenu1.addEventListener("click", () => videoModal.classList.add("open"));
  }
  if (btnCloseModal && videoModal) {
    btnCloseModal.addEventListener("click", () => videoModal.classList.remove("open"));
  }

  // -----------------------------------------------
  // Theater / Cinema Mode Toggle
  // -----------------------------------------------
  const theaterGrid = document.getElementById("theaterGrid");
  const btnToggleCinema = document.getElementById("btnToggleCinema");
  const btnStageExpand = document.getElementById("btnStageExpand");
  const btnDockCinemaToggle = document.getElementById("btnDockCinemaToggle");
  const cinemaToggleIcon = document.getElementById("cinemaToggleIcon");
  const cinemaToggleText = document.getElementById("cinemaToggleText");
  const stageExpandIcon = document.getElementById("stageExpandIcon");
  const stageExpandText = document.getElementById("stageExpandText");

  function toggleCinemaMode() {
    if (!theaterGrid) return;
    const isCinema = theaterGrid.classList.toggle("cinema-active");

    if (btnToggleCinema) btnToggleCinema.classList.toggle("active", isCinema);
    if (btnDockCinemaToggle) btnDockCinemaToggle.classList.toggle("active-mint", isCinema);

    if (cinemaToggleIcon) cinemaToggleIcon.className = isCinema ? "fa-solid fa-compress" : "fa-solid fa-expand";
    if (cinemaToggleText) cinemaToggleText.textContent = isCinema ? "Side Dock" : "Cinema View";

    if (stageExpandIcon) stageExpandIcon.className = isCinema ? "fa-solid fa-compress" : "fa-solid fa-expand";
    if (stageExpandText) stageExpandText.textContent = isCinema ? "Exit Cinema" : "Cinema Mode";

    showToast(isCinema ? "🎬 Fullstage Cinema Mode Active" : "📺 Standard Theater Mode Active");
  }

  if (btnToggleCinema) btnToggleCinema.addEventListener("click", toggleCinemaMode);
  if (btnStageExpand) btnStageExpand.addEventListener("click", toggleCinemaMode);
  if (btnDockCinemaToggle) btnDockCinemaToggle.addEventListener("click", toggleCinemaMode);

  if (formLoadVideo) {
    formLoadVideo.addEventListener("submit", (e) => {
      e.preventDefault();
      const url = inputVideoUrl.value.trim();
      if (url) {
        socket.emit("video-change", { source: url });
        inputVideoUrl.value = "";
        videoModal.classList.remove("open");
      }
    });
  }

  // Sample Video Cards in Modal
  const sampleCards = document.querySelectorAll(".modal-sample-card");
  sampleCards.forEach((card) => {
    card.addEventListener("click", () => {
      const source = card.getAttribute("data-source");
      const title = card.getAttribute("data-title");
      const type = card.getAttribute("data-type");
      socket.emit("video-change", { source, title, type });
      videoModal.classList.remove("open");
    });
  });

  // Bulletproof Clipboard Copy Helper (works on HTTPS, localhost, LAN IPs, and mobile)
  function copyTextToClipboard(text) {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      return navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
    }
    return fallbackCopy(text);
  }

  function fallbackCopy(text) {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      ta.style.top = "-9999px";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const res = document.execCommand("copy");
      document.body.removeChild(ta);
      return res ? Promise.resolve() : Promise.reject(new Error("Copy failed"));
    } catch (e) {
      return Promise.reject(e);
    }
  }

  // Share Modal & Invite Links
  const cleanShareUrl = `${window.location.origin}/room/${encodeURIComponent(roomId)}`;
  const isLocalHost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  const netIp = window.ROOM_CONFIG.networkIp || "localhost";
  const netPort = window.ROOM_CONFIG.serverPort || window.location.port || "8080";
  const wifiShareUrl = (netIp && netIp !== "localhost")
    ? `http://${netIp}:${netPort}/room/${encodeURIComponent(roomId)}`
    : cleanShareUrl;

  const shareModal = document.getElementById("shareModal");
  const btnOpenShareModal = document.getElementById("btnOpenShareModal");
  const btnCloseShareModal = document.getElementById("btnCloseShareModal");
  const inputShareLink = document.getElementById("inputShareLink");
  const btnCopyShareModalLink = document.getElementById("btnCopyShareModalLink");
  const wifiShareSection = document.getElementById("wifiShareSection");
  const inputWifiShareLink = document.getElementById("inputWifiShareLink");
  const btnCopyWifiLink = document.getElementById("btnCopyWifiLink");
  const btnCopyCodeOnly = document.getElementById("btnCopyCodeOnly");
  const btnNativeShare = document.getElementById("btnNativeShare");

  if (inputShareLink) inputShareLink.value = cleanShareUrl;
  if (inputWifiShareLink) inputWifiShareLink.value = wifiShareUrl;
  if (wifiShareSection && isLocalHost && netIp !== "localhost") {
    wifiShareSection.style.display = "block";
  }

  // Header 1-Click Copy Button
  if (btnCopyLink) {
    btnCopyLink.addEventListener("click", () => {
      // If user is on localhost, open the Share Modal so they can easily see WiFi option for other devices
      if (isLocalHost && shareModal) {
        shareModal.classList.add("open");
      }
      copyTextToClipboard(cleanShareUrl).then(() => {
        showToast("📋 Room invite link copied to clipboard!");
      }).catch(() => {
        showToast("Room code: " + roomId);
      });
    });
  }

  if (btnOpenShareModal && shareModal) {
    btnOpenShareModal.addEventListener("click", () => {
      shareModal.classList.add("open");
    });
  }

  if (btnCloseShareModal && shareModal) {
    btnCloseShareModal.addEventListener("click", () => {
      shareModal.classList.remove("open");
    });
  }

  if (btnCopyShareModalLink) {
    btnCopyShareModalLink.addEventListener("click", () => {
      copyTextToClipboard(cleanShareUrl).then(() => {
        showToast("📋 Link copied to clipboard!");
      });
    });
  }

  if (btnCopyWifiLink) {
    btnCopyWifiLink.addEventListener("click", () => {
      copyTextToClipboard(wifiShareUrl).then(() => {
        showToast("📋 WiFi link copied for friends on same network!");
      });
    });
  }

  if (btnCopyCodeOnly) {
    btnCopyCodeOnly.addEventListener("click", () => {
      copyTextToClipboard(roomId).then(() => {
        showToast("📋 Room code copied: " + roomId);
      });
    });
  }

  // Native Web Share API (mobile/desktop browsers)
  if (btnNativeShare && navigator.share) {
    btnNativeShare.style.display = "block";
    btnNativeShare.addEventListener("click", async () => {
      try {
        await navigator.share({
          title: "Watch Together Room",
          text: `Join my Watch Together room: ${roomId}!`,
          url: cleanShareUrl
        });
      } catch (e) {}
    });
  }

  function showToast(message) {
    if (!toastNotice) return;
    toastNotice.textContent = message;
    toastNotice.classList.add("show");
    setTimeout(() => {
      toastNotice.classList.remove("show");
    }, 2800);
  }

  function formatTime(seconds) {
    seconds = Math.max(0, Math.floor(seconds || 0));
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const pad = (n) => String(n).padStart(2, "0");

    if (h > 0) {
      return `${h}:${pad(m)}:${pad(s)}`;
    }
    return `${pad(m)}:${pad(s)}`;
  }
});
