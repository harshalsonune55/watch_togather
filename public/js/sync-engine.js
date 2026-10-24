/**
 * SyncEngine - Zero-Drift Video Synchronization System
 * Handles YouTube Iframe API, HTML5 <video> elements, Local File Sync,
 * and Web Series multi-episode playback.
 */
class SyncEngine {
  constructor(socket, roomId, onStatusChange) {
    this.socket = socket;
    this.roomId = roomId;
    this.onStatusChange = onStatusChange || (() => {});

    this.playerType = null; // 'youtube' | 'html5'
    this.ytPlayer = null;
    this.html5Player = document.getElementById("html5Player");
    this.ytWrapper = document.getElementById("ytPlayerWrapper");

    this.isRemoteUpdate = false;
    this.remoteUpdateTimeout = null;
    this.clockOffset = 0; // local time minus server time
    this.playbackRate = 1.0;
    this.isPlaying = false;
    this.isReady = false;

    this.initSocketEvents();
  }

  setClockOffset(serverTime) {
    if (serverTime) {
      this.clockOffset = Date.now() - serverTime;
    }
  }

  // Set the re-entrancy lock to ignore local player events triggered remotely
  lockRemoteAction(durationMs = 400) {
    this.isRemoteUpdate = true;
    if (this.remoteUpdateTimeout) clearTimeout(this.remoteUpdateTimeout);
    this.remoteUpdateTimeout = setTimeout(() => {
      this.isRemoteUpdate = false;
    }, durationMs);
  }

  initSocketEvents() {
    // 1. Play event received from peer
    this.socket.on("video-play", (data) => {
      this.lockRemoteAction();
      this.setClockOffset(data.serverTime);

      const targetTime = data.time || 0;
      this.seekTo(targetTime);
      this.playLocal();

      this.onStatusChange({
        status: "synced",
        text: `Playing (${data.sender})`,
        time: targetTime
      });
    });

    // 2. Pause event received from peer
    this.socket.on("video-pause", (data) => {
      this.lockRemoteAction();
      const targetTime = data.time || 0;
      this.pauseLocal();
      this.seekTo(targetTime);

      this.onStatusChange({
        status: "paused",
        text: `Paused (${data.sender})`,
        time: targetTime
      });
    });

    // 3. Seek event received from peer
    this.socket.on("video-seek", (data) => {
      this.lockRemoteAction();
      this.setClockOffset(data.serverTime);

      const targetTime = data.time || 0;
      this.seekTo(targetTime);

      if (data.state === "playing") {
        this.playLocal();
      } else {
        this.pauseLocal();
      }

      this.onStatusChange({
        status: "synced",
        text: `Seeked (${data.sender})`,
        time: targetTime
      });
    });

    // 4. Playback rate change from peer
    this.socket.on("video-rate", (data) => {
      this.lockRemoteAction();
      this.playbackRate = data.rate;
      this.setPlaybackRate(data.rate);
      if (data.time) this.seekTo(data.time);
    });

    // 5. Change video from peer
    this.socket.on("video-change", (data) => {
      this.lockRemoteAction(800);
      this.loadVideo(data.video.type, data.video.source, data.video.title);
      this.seekTo(0);
      this.pauseLocal();

      this.onStatusChange({
        status: "paused",
        text: `Loaded: ${data.video.title}`,
        time: 0
      });
    });

    // 6. Episode change from peer (Web Series)
    this.socket.on("episode-change", (data) => {
      this.lockRemoteAction(800);
      this.loadVideo(data.video.type, data.video.source, data.video.title);
      this.seekTo(0);
      if (data.video.state === "playing") {
        this.playLocal();
      } else {
        this.pauseLocal();
      }

      // Update episode badge in UI
      const epBadge = document.getElementById("currentEpisodePill");
      if (epBadge) epBadge.textContent = `Episode ${data.index + 1}`;

      this.onStatusChange({
        status: data.video.state === "playing" ? "synced" : "paused",
        text: `🎬 ${data.video.title}`,
        time: 0
      });
    });

    // 7. Series change from peer
    this.socket.on("series-changed", (data) => {
      this.lockRemoteAction(800);
      this.loadVideo(data.video.type, data.video.source, data.video.title);
      this.seekTo(0);
      this.pauseLocal();

      const epBadge = document.getElementById("currentEpisodePill");
      if (epBadge) epBadge.textContent = `Episode 1`;

      this.onStatusChange({
        status: "paused",
        text: `Series: ${data.series.title}`,
        time: 0
      });
    });

    // 8. Periodic heartbeat from server to prevent drift
    this.socket.on("sync-heartbeat", (data) => {
      if (!this.isPlaying || data.state !== "playing") return;
      this.checkAndCorrectDrift(data.currentTime, data.serverTime);
    });

    // 9. Resync response
    this.socket.on("resync-data", (data) => {
      this.lockRemoteAction(600);
      this.setClockOffset(data.serverTime);
      this.seekTo(data.currentTime);
      if (data.state === "playing") {
        this.playLocal();
      } else {
        this.pauseLocal();
      }
      this.onStatusChange({
        status: "synced",
        text: "⚡ Locked in Sync",
        time: data.currentTime
      });
    });
  }

  // Drift Correction Algorithm
  checkAndCorrectDrift(serverCalculatedTime, serverTime) {
    if (this.isRemoteUpdate) return;

    const localTime = this.getCurrentTime();
    const elapsedSinceBroadcast = (Date.now() - serverTime - this.clockOffset) / 1000;
    const expectedTime = serverCalculatedTime + Math.max(0, elapsedSinceBroadcast) * this.playbackRate;
    const drift = localTime - expectedTime;

    const absDrift = Math.abs(drift);

    if (absDrift < 0.25) {
      // Sub-250ms: Perfect sync, completely imperceptible
      this.onStatusChange({
        status: "synced",
        text: `In Sync (±${(absDrift * 1000).toFixed(0)}ms)`,
        time: localTime
      });
      this.setPlaybackRate(this.playbackRate);
    } else if (absDrift >= 0.25 && absDrift < 1.4) {
      // Micro-adjustment: 5% speed difference to gracefully close the gap without audio cuts
      if (drift < 0) {
        this.setPlaybackRate(this.playbackRate * 1.05);
      } else {
        this.setPlaybackRate(this.playbackRate * 0.95);
      }
      this.onStatusChange({
        status: "syncing",
        text: `Micro-syncing (${(absDrift * 1000).toFixed(0)}ms)`,
        time: localTime
      });
    } else {
      // Large drift (>1.4s): Snap directly
      this.lockRemoteAction(500);
      this.seekTo(expectedTime);
      this.setPlaybackRate(this.playbackRate);
      this.onStatusChange({
        status: "syncing",
        text: "⚡ Snapped to sync",
        time: expectedTime
      });
    }
  }

  // -----------------------------------------------
  // Unified Player Management
  // -----------------------------------------------

  loadVideo(type, source, title) {
    this.playerType = type;
    const titleEl = document.getElementById("stageVideoTitle");
    if (titleEl && title) titleEl.textContent = title;

    if (type === "youtube") {
      this.html5Player.pause();
      this.html5Player.style.display = "none";
      this.ytWrapper.style.display = "block";

      if (this.ytPlayer && typeof this.ytPlayer.loadVideoById === "function") {
        this.ytPlayer.loadVideoById(source, 0);
        this.ytPlayer.pauseVideo();
      } else {
        this.initYouTubePlayer(source);
      }
    } else {
      // HTML5 video or direct stream
      if (this.ytPlayer && typeof this.ytPlayer.pauseVideo === "function") {
        this.ytPlayer.pauseVideo();
      }
      this.ytWrapper.style.display = "none";
      this.html5Player.style.display = "block";
      this.html5Player.src = source;
      this.html5Player.load();
      this.bindHtml5Events();
    }
  }

  loadLocalFile(file) {
    if (!file) return;
    this.playerType = "html5";
    const objectUrl = URL.createObjectURL(file);
    const titleEl = document.getElementById("stageVideoTitle");
    if (titleEl) titleEl.textContent = "📁 " + file.name;

    if (this.ytPlayer && typeof this.ytPlayer.pauseVideo === "function") {
      this.ytPlayer.pauseVideo();
    }
    this.ytWrapper.style.display = "none";
    this.html5Player.style.display = "block";
    this.html5Player.src = objectUrl;
    this.html5Player.load();
    this.bindHtml5Events();

    this.socket.emit("local-file-announce", {
      fileName: file.name,
      fileSize: file.size
    });
  }

  initYouTubePlayer(videoId) {
    const onYTReady = () => {
      this.ytPlayer = new YT.Player("ytPlayer", {
        height: "100%",
        width: "100%",
        videoId: videoId,
        playerVars: {
          autoplay: 0,
          controls: 0, // custom UI controls
          disablekb: 0,
          modestbranding: 1,
          rel: 0,
          playsinline: 1
        },
        events: {
          onReady: () => {
            this.isReady = true;
          },
          onStateChange: (event) => {
            this.handleYTStateChange(event);
          }
        }
      });
    };

    if (window.YT && window.YT.Player) {
      onYTReady();
    } else {
      window.onYouTubeIframeAPIReady = onYTReady;
    }
  }

  handleYTStateChange(event) {
    if (this.isRemoteUpdate) return;

    if (event.data === YT.PlayerState.PLAYING) {
      this.isPlaying = true;
      const time = this.getCurrentTime();
      this.socket.emit("video-play", { time });
      this.onStatusChange({ status: "synced", text: "You are playing", time });
    } else if (event.data === YT.PlayerState.PAUSED) {
      this.isPlaying = false;
      const time = this.getCurrentTime();
      this.socket.emit("video-pause", { time });
      this.onStatusChange({ status: "paused", text: "You paused", time });
    } else if (event.data === YT.PlayerState.ENDED) {
      this.handleVideoEnded();
    }
  }

  bindHtml5Events() {
    this.html5Player.onplay = () => {
      if (this.isRemoteUpdate) return;
      this.isPlaying = true;
      const time = this.html5Player.currentTime;
      this.socket.emit("video-play", { time });
      this.onStatusChange({ status: "synced", text: "You are playing", time });
    };

    this.html5Player.onpause = () => {
      if (this.isRemoteUpdate) return;
      this.isPlaying = false;
      const time = this.html5Player.currentTime;
      this.socket.emit("video-pause", { time });
      this.onStatusChange({ status: "paused", text: "You paused", time });
    };

    this.html5Player.onseeked = () => {
      if (this.isRemoteUpdate) return;
      const time = this.html5Player.currentTime;
      this.socket.emit("video-seek", { time });
    };

    this.html5Player.onended = () => {
      this.handleVideoEnded();
    };
  }

  handleVideoEnded() {
    const banner = document.getElementById("autoplayBanner");
    if (!banner) return;

    banner.classList.add("show");
    let count = 4;
    banner.innerHTML = `<span>⏭️ Next episode starts in <strong>${count}s</strong>...</span>`;

    const timer = setInterval(() => {
      count--;
      if (count > 0) {
        banner.innerHTML = `<span>⏭️ Next episode starts in <strong>${count}s</strong>...</span>`;
      } else {
        clearInterval(timer);
        banner.classList.remove("show");
        this.socket.emit("episode-next");
      }
    }, 1000);
  }

  // -----------------------------------------------
  // Local Player Commands
  // -----------------------------------------------

  playLocal() {
    this.isPlaying = true;
    if (this.playerType === "youtube" && this.ytPlayer && this.ytPlayer.playVideo) {
      this.ytPlayer.playVideo();
    } else if (this.html5Player) {
      this.html5Player.play().catch(() => {});
    }
    this.updatePlayBtnUI(true);
  }

  pauseLocal() {
    this.isPlaying = false;
    if (this.playerType === "youtube" && this.ytPlayer && this.ytPlayer.pauseVideo) {
      this.ytPlayer.pauseVideo();
    } else if (this.html5Player) {
      this.html5Player.pause();
    }
    this.updatePlayBtnUI(false);
  }

  togglePlay() {
    if (this.isPlaying) {
      this.pauseLocal();
      this.socket.emit("video-pause", { time: this.getCurrentTime() });
    } else {
      this.playLocal();
      this.socket.emit("video-play", { time: this.getCurrentTime() });
    }
  }

  seekTo(seconds) {
    seconds = Math.max(0, seconds);
    if (this.playerType === "youtube" && this.ytPlayer && this.ytPlayer.seekTo) {
      this.ytPlayer.seekTo(seconds, true);
    } else if (this.html5Player) {
      this.html5Player.currentTime = seconds;
    }
  }

  manualSeek(seconds) {
    this.seekTo(seconds);
    this.socket.emit("video-seek", { time: seconds });
  }

  getCurrentTime() {
    if (this.playerType === "youtube" && this.ytPlayer && this.ytPlayer.getCurrentTime) {
      return this.ytPlayer.getCurrentTime() || 0;
    }
    return this.html5Player ? this.html5Player.currentTime || 0 : 0;
  }

  getDuration() {
    if (this.playerType === "youtube" && this.ytPlayer && this.ytPlayer.getDuration) {
      return this.ytPlayer.getDuration() || 0;
    }
    return this.html5Player ? this.html5Player.duration || 0 : 0;
  }

  setPlaybackRate(rate) {
    if (this.playerType === "youtube" && this.ytPlayer && this.ytPlayer.setPlaybackRate) {
      try {
        this.ytPlayer.setPlaybackRate(rate);
      } catch (e) {}
    } else if (this.html5Player) {
      this.html5Player.playbackRate = rate;
    }
  }

  setVolume(fraction) {
    if (this.playerType === "youtube" && this.ytPlayer && this.ytPlayer.setVolume) {
      this.ytPlayer.setVolume(fraction * 100);
    }
    if (this.html5Player) {
      this.html5Player.volume = fraction;
    }
  }

  requestForceResync() {
    this.socket.emit("request-resync");
  }

  updatePlayBtnUI(isPlaying) {
    const icon = document.getElementById("playIcon");
    const playOverlay = document.getElementById("playOverlayBtn");
    if (icon) {
      icon.className = isPlaying ? "fa-solid fa-pause" : "fa-solid fa-play";
    }
    if (playOverlay) {
      if (isPlaying) {
        playOverlay.classList.remove("show");
      } else {
        playOverlay.classList.add("show");
      }
    }
  }
}

window.SyncEngine = SyncEngine;
