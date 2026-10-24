/**
 * Room Controller - Connects UI components with SyncEngine, WebRTCCall, and ChatEngine.
 * Supports Web Series & Multi-Episode navigation, Cinema View (Floating PIP),
 * and Local Video File Synchronization.
 */
document.addEventListener("DOMContentLoaded", () => {
  const roomId = window.ROOM_CONFIG.roomId;
  let userName = window.ROOM_CONFIG.userName;

  if (!userName || userName.trim() === "") {
    userName = localStorage.getItem("wt_username") || "Guest " + Math.floor(Math.random() * 900 + 100);
  }
  localStorage.setItem("wt_username", userName);

  // Initialize Socket.IO connection
  const socket = io();

  // State
  let currentPlaylist = [];
  let currentEpisodeIndex = 0;
  let allSeries = [];
  let activeSeriesId = "scifi-series";

  // DOM Elements
  const statusBadge = document.getElementById("syncStatusBadge");
  const statusText = document.getElementById("syncStatusText");
  const userCountVal = document.getElementById("userCountVal");
  const currentEpisodePill = document.getElementById("currentEpisodePill");
  const btnPlayPause = document.getElementById("btnPlayPause");
  const playOverlayBtn = document.getElementById("playOverlayBtn");
  const timelineProgress = document.getElementById("timelineProgress");
  const timelineCurrent = document.getElementById("timelineCurrent");
  const timeCurrentEl = document.getElementById("timeCurrent");
  const timeDurationEl = document.getElementById("timeDuration");
  const volumeSlider = document.getElementById("volumeSlider");
  const btnMute = document.getElementById("btnMute");
  const speedSelect = document.getElementById("speedSelect");
  const btnResync = document.getElementById("btnResync");
  const btnChangeVideo = document.getElementById("btnChangeVideo");
  const btnOpenSeries = document.getElementById("btnOpenSeries");
  const btnPrevEp = document.getElementById("btnPrevEp");
  const btnNextEp = document.getElementById("btnNextEp");
  const btnFullscreen = document.getElementById("btnFullscreen");
  const btnCinemaView = document.getElementById("btnCinemaView");
  const theaterLayout = document.getElementById("theaterLayout");
  const stageSection = document.getElementById("stageSection");

  // Modals & Inputs
  const videoModal = document.getElementById("videoModal");
  const btnCloseModal = document.getElementById("btnCloseModal");
  const episodesModal = document.getElementById("episodesModal");
  const btnCloseEpModal = document.getElementById("btnCloseEpModal");
  const formLoadVideo = document.getElementById("formLoadVideo");
  const inputVideoUrl = document.getElementById("inputVideoUrl");
  const inputLocalFile = document.getElementById("inputLocalFile");
  const btnCopyLink = document.getElementById("btnCopyLink");
  const toastNotice = document.getElementById("toastNotice");

  // Status Change Callback
  const handleSyncStatus = ({ status, text }) => {
    if (!statusBadge || !statusText) return;
    statusBadge.className = `sync-status-badge ${status}`;
    statusText.textContent = text;
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

    if (userCountVal && data.users) {
      userCountVal.textContent = `${data.users.length}/2`;
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
      if (data.video.currentTime > 0) {
        setTimeout(() => {
          syncEngine.seekTo(data.video.currentTime);
          if (data.video.state === "playing") {
            syncEngine.playLocal();
          }
        }, 800);
      }
    }

    // Load chat history
    if (data.messages && data.messages.length > 0) {
      data.messages.forEach((msg) => chatEngine.appendMessage(msg));
    }
  });

  // Episode Change Broadcast
  socket.on("episode-change", (data) => {
    currentEpisodeIndex = data.index;
    updateEpisodePillUI();
    renderEpisodesList();
    showToast(`🎬 Playing ${data.video.title}`);
  });

  // Series Change Broadcast
  socket.on("series-changed", (data) => {
    activeSeriesId = data.series.id;
    currentPlaylist = data.playlist;
    currentEpisodeIndex = 0;
    updateEpisodePillUI();
    renderEpisodesList();
    showToast(`🍿 Switched series to "${data.series.title}"`);
  });

  // Local File Sync Request from peer
  socket.on("local-file-request", (data) => {
    showToast(`📁 ${data.sender} selected "${data.fileName}". Click 'Series' -> 'Sync Local File'!`);
  });

  // User Joined / Left counters
  socket.on("user-joined", (data) => {
    if (userCountVal) userCountVal.textContent = `${data.userCount}/2`;
    showToast(`👋 ${data.user.name} joined the room!`);
  });

  socket.on("user-left", (data) => {
    if (userCountVal) userCountVal.textContent = `${data.userCount}/2`;
    showToast(`🚪 ${data.userName} left the room`);
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

  // Next / Previous Episode buttons
  if (btnNextEp) {
    btnNextEp.addEventListener("click", () => {
      socket.emit("episode-next");
    });
  }
  if (btnPrevEp) {
    btnPrevEp.addEventListener("click", () => {
      socket.emit("episode-prev");
    });
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

  // Volume
  if (volumeSlider) {
    volumeSlider.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value);
      syncEngine.setVolume(val);
      if (btnMute) {
        btnMute.innerHTML = val === 0
          ? '<i class="fa-solid fa-volume-xmark"></i>'
          : '<i class="fa-solid fa-volume-high"></i>';
      }
    });
  }

  if (btnMute) {
    let lastVol = 1.0;
    btnMute.addEventListener("click", () => {
      if (volumeSlider.value > 0) {
        lastVol = volumeSlider.value;
        volumeSlider.value = 0;
        syncEngine.setVolume(0);
        btnMute.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
      } else {
        volumeSlider.value = lastVol;
        syncEngine.setVolume(lastVol);
        btnMute.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
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
      showToast("⚡ Synchronizing with host...");
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

  // Fullscreen
  if (btnFullscreen && stageSection) {
    btnFullscreen.addEventListener("click", () => {
      if (!document.fullscreenElement) {
        stageSection.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });
  }

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

  // -----------------------------------------------
  // Web Series & Episodes Drawer Logic
  // -----------------------------------------------

  if (btnOpenSeries && episodesModal) {
    btnOpenSeries.addEventListener("click", () => {
      renderEpisodesList();
      episodesModal.classList.add("open");
    });
  }
  if (btnCloseEpModal && episodesModal) {
    btnCloseEpModal.addEventListener("click", () => {
      episodesModal.classList.remove("open");
    });
  }

  // Series Tab switching
  const seriesTabs = document.querySelectorAll(".tab-series-btn");
  seriesTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const sid = tab.getAttribute("data-series-id");
      if (sid) {
        activeSeriesId = sid;
        seriesTabs.forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        socket.emit("series-select", { seriesId: sid });
      }
    });
  });

  function renderEpisodesList() {
    const listEl = document.getElementById("episodesListContainer");
    if (!listEl) return;

    listEl.innerHTML = "";

    currentPlaylist.forEach((ep, index) => {
      const isCurrent = index === currentEpisodeIndex;
      const item = document.createElement("div");
      item.className = `episode-item ${isCurrent ? "active" : ""}`;
      item.innerHTML = `
        <div class="ep-left">
          <div class="ep-num-badge">${isCurrent ? '<i class="fa-solid fa-play" style="font-size:0.6rem"></i>' : index + 1}</div>
          <div>
            <div class="ep-title">${ep.title}</div>
            <div class="ep-duration">${ep.duration || "Full"}</div>
          </div>
        </div>
        <div>
          ${isCurrent ? '<span style="font-size:0.75rem; color:var(--primary); font-weight:700;">PLAYING</span>' : '<span style="font-size:0.75rem; color:var(--text-dim);"><i class="fa-solid fa-play"></i></span>'}
        </div>
      `;

      item.addEventListener("click", () => {
        socket.emit("episode-select", { index });
        if (episodesModal) episodesModal.classList.remove("open");
      });

      listEl.appendChild(item);
    });
  }

  function updateEpisodePillUI() {
    if (currentEpisodePill) {
      currentEpisodePill.textContent = `Ep ${currentEpisodeIndex + 1}/${currentPlaylist.length || 1}`;
    }
  }

  // Local File Selector
  if (inputLocalFile) {
    inputLocalFile.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) {
        syncEngine.loadLocalFile(file);
        if (episodesModal) episodesModal.classList.remove("open");
        showToast(`📁 Loaded "${file.name}" locally! Both users will stay in sync!`);
      }
    });
  }

  // -----------------------------------------------
  // Modals & Link Copying
  // -----------------------------------------------

  if (btnChangeVideo && videoModal) {
    btnChangeVideo.addEventListener("click", () => videoModal.classList.add("open"));
  }
  if (btnCloseModal && videoModal) {
    btnCloseModal.addEventListener("click", () => videoModal.classList.remove("open"));
  }

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

  // Copy Invite Link
  if (btnCopyLink) {
    btnCopyLink.addEventListener("click", () => {
      const shareUrl = `${window.location.origin}/room/${encodeURIComponent(roomId)}`;
      navigator.clipboard.writeText(shareUrl).then(() => {
        showToast("📋 Invite link copied to clipboard!");
      }).catch(() => {
        showToast("Room code: " + roomId);
      });
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
