/**
 * Room Controller - Connects UI components with SyncEngine, WebRTCCall, and ChatEngine.
 * Inspired by Virtual Huddle (Video Conference) & FinSage Design System.
 */
document.addEventListener("DOMContentLoaded", () => {
  const roomId = window.ROOM_CONFIG.roomId;
  let userName = window.ROOM_CONFIG.userName;

  if (!userName || userName.trim() === "") {
    userName = localStorage.getItem("wt_username") || "Guest " + Math.floor(100 + Math.random() * 900);
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

  // Join Room Event
  socket.emit("join-room", { roomId, userName });

  // Handle Room Initialization from Server
  socket.on("room-init", (data) => {
    syncEngine.setClockOffset(data.video.serverTime);

    if (data.users && data.users.length > 1) {
      const partner = data.users.find(u => u.id !== data.yourId);
      if (partner) {
        if (remoteUserName) remoteUserName.textContent = partner.name;
        if (sidebarFriendName) sidebarFriendName.textContent = partner.name;
        if (sidebarFriendStatusDot) sidebarFriendStatusDot.style.color = "var(--mint)";
        webrtcCall.setRemotePeer(partner.id, partner.name);
      }
    }

    // Load initial video if available
    if (data.video && data.video.source) {
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
    if (remoteUserName) remoteUserName.textContent = data.user.name;
    if (sidebarFriendName) sidebarFriendName.textContent = data.user.name;
    if (sidebarFriendStatusDot) sidebarFriendStatusDot.style.color = "var(--mint)";
    showToast(`👋 ${data.user.name} joined the room!`);
    webrtcCall.onUserJoined(data.user);
  });

  socket.on("user-left", (data) => {
    if (remoteUserName) remoteUserName.textContent = "Waiting for friend...";
    if (sidebarFriendName) sidebarFriendName.textContent = "Friend";
    if (sidebarFriendStatusDot) sidebarFriendStatusDot.style.color = "var(--text-dim)";
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
  const handleResync = () => {
    syncEngine.requestForceResync();
    if (webrtcCall && webrtcCall.targetPeerId) {
      webrtcCall.callPeer(webrtcCall.targetPeerId, true);
    }
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
