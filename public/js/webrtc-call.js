/**
 * WebRTCCall - Two-Person Real-Time Video & Audio Calling Engine
 * Screen Sharing is displayed in the MAIN VIDEO SECTION (stage),
 * while both users' webcams remain live in the person view windows!
 *
 * Single Audio Stream Guarantee:
 * - When sharing your own screen: The website player is automatically MUTED so you only
 *   hear the original source tab/app (zero echo / zero dual audio!).
 * - The remote peer receives and plays the screen audio through the website.
 * - Background room video (YouTube/web series) is automatically paused during screen share.
 */
class WebRTCCall {
  constructor(socket, roomId, userName) {
    this.socket = socket;
    this.roomId = roomId;
    this.userName = userName;

    this.peerConnection = null;
    this.localStream = null;
    this.screenStream = null;
    this.screenSenders = [];
    this.isScreenSharing = false;

    this.remoteCamStream = null;
    this.remoteScreenStream = null;
    this.remoteScreenStreamId = null;
    this.remoteScreenSharerName = null;
    this.targetPeerId = null;

    // DOM Elements
    this.localVideo = document.getElementById("localVideo");
    this.remoteVideo = document.getElementById("remoteVideo");
    this.localTile = document.getElementById("localTile");
    this.remoteTile = document.getElementById("remoteTile");

    // Stage Screen Share Elements (Main Video Section)
    this.screenShareWrapper = document.getElementById("screenShareWrapper");
    this.screenSharePlayer = document.getElementById("screenSharePlayer");
    this.screenShareOwner = document.getElementById("screenShareOwner");
    this.btnStopStageScreen = document.getElementById("btnStopStageScreen");

    // Screen Audio Controls
    this.screenAudioPill = document.getElementById("screenAudioPill");
    this.btnToggleScreenAudio = document.getElementById("btnToggleScreenAudio");
    this.screenAudioIcon = document.getElementById("screenAudioIcon");
    this.screenAudioLabel = document.getElementById("screenAudioLabel");
    this.screenAudioSlider = document.getElementById("screenAudioSlider");

    this.isCamOn = true;
    this.isMicOn = true;
    this.pendingCandidates = [];

    this.rtcConfig = {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" }
      ],
      iceCandidatePoolSize: 10
    };

    // Ensure user media is ready before signaling begins
    this.mediaReadyPromise = this.initUserMedia();
    this.initSocketSignaling();
    this.bindStageControls();
  }

  bindStageControls() {
    if (this.btnStopStageScreen) {
      this.btnStopStageScreen.addEventListener("click", () => {
        this.stopScreenShare();
      });
    }

    if (this.btnToggleScreenAudio && this.screenSharePlayer) {
      this.btnToggleScreenAudio.addEventListener("click", () => {
        this.screenSharePlayer.muted = !this.screenSharePlayer.muted;
        this.updateScreenAudioUI(this.isScreenSharing);
      });
    }

    if (this.screenAudioSlider && this.screenSharePlayer) {
      this.screenAudioSlider.addEventListener("input", (e) => {
        const val = parseFloat(e.target.value);
        this.screenSharePlayer.volume = val;
        if (val === 0) {
          this.screenSharePlayer.muted = true;
        } else {
          this.screenSharePlayer.muted = false;
        }
        this.updateScreenAudioUI(this.isScreenSharing);
      });
    }
  }

  updateScreenAudioUI(isSelf) {
    if (!this.screenSharePlayer) return;

    if (isSelf) {
      // Local Sharer: By default muted on the website to avoid duplicate audio
      if (this.screenSharePlayer.muted) {
        if (this.screenAudioIcon) this.screenAudioIcon.className = "fa-solid fa-volume-xmark";
        if (this.screenAudioLabel) this.screenAudioLabel.textContent = "Local Muted (Single Audio: Source Tab)";
        if (this.screenAudioSlider) this.screenAudioSlider.style.display = "none";
      } else {
        if (this.screenAudioIcon) this.screenAudioIcon.className = "fa-solid fa-volume-high";
        if (this.screenAudioLabel) this.screenAudioLabel.textContent = "Website Audio Active";
        if (this.screenAudioSlider) this.screenAudioSlider.style.display = "inline-block";
      }
    } else {
      // Remote Viewer: Listening from website
      if (this.screenSharePlayer.muted) {
        if (this.screenAudioIcon) this.screenAudioIcon.className = "fa-solid fa-volume-xmark";
        if (this.screenAudioLabel) this.screenAudioLabel.textContent = "Muted";
      } else {
        if (this.screenAudioIcon) this.screenAudioIcon.className = "fa-solid fa-volume-high";
        const pct = Math.round(this.screenSharePlayer.volume * 100);
        if (this.screenAudioLabel) this.screenAudioLabel.textContent = `Screen Audio (${pct}%)`;
      }
      if (this.screenAudioSlider) {
        this.screenAudioSlider.style.display = "inline-block";
        this.screenAudioSlider.value = this.screenSharePlayer.volume;
      }
    }
  }

  async initUserMedia() {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { max: 30 }
        },
        audio: true
      });

      if (this.localVideo) {
        this.localVideo.srcObject = this.localStream;
      }

      this.showLocalAvatarPlaceholder(false);
      this.setupAudioMeter(this.localStream, this.localTile);
    } catch (err) {
      console.warn("Camera/Mic not accessible or denied:", err);
      this.showLocalAvatarPlaceholder(true);
      this.localStream = new MediaStream();
    }
  }

  initSocketSignaling() {
    // 1. Ready to initiate call
    this.socket.on("initiate-call", async ({ peerId }) => {
      this.targetPeerId = peerId;
      await this.mediaReadyPromise;
      await this.createOffer(peerId);
    });

    // 2. Incoming offer
    this.socket.on("signal-offer", async (payload) => {
      const { senderId, senderName, offer, isScreenShare, screenStreamId } = payload;
      this.targetPeerId = senderId;
      if (isScreenShare && screenStreamId) {
        this.remoteScreenStreamId = screenStreamId;
        this.remoteScreenSharerName = senderName;
      }

      await this.mediaReadyPromise;
      await this.handleOffer(senderId, offer);

      const peerNameTag = document.getElementById("remoteUserName");
      if (peerNameTag && senderName) peerNameTag.textContent = senderName;
    });

    // 3. Incoming answer
    this.socket.on("signal-answer", async ({ answer }) => {
      if (this.peerConnection) {
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        this.flushPendingCandidates();
      }
    });

    // 4. Incoming ICE candidate
    this.socket.on("signal-ice", async ({ candidate }) => {
      try {
        if (this.peerConnection && this.peerConnection.remoteDescription) {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } else {
          this.pendingCandidates.push(candidate);
        }
      } catch (e) {
        console.warn("Error adding ICE candidate:", e);
      }
    });

    // 5. Peer media state toggle (mic / cam)
    this.socket.on("peer-media-toggle", ({ type, enabled }) => {
      if (type === "cam") {
        this.showRemoteAvatarPlaceholder(!enabled);
      } else if (type === "mic") {
        const micIcon = document.getElementById("remoteMicIcon");
        if (micIcon) {
          micIcon.className = enabled
            ? "fa-solid fa-microphone mic-status-icon"
            : "fa-solid fa-microphone-slash mic-status-icon muted";
        }
      }
    });

    // 6. Remote screen share status announcement
    this.socket.on("screen-share-status", ({ isSharing, sharerName, streamId }) => {
      if (isSharing) {
        this.remoteScreenStreamId = streamId;
        this.remoteScreenSharerName = sharerName;
        // Pause any running background video so it doesn't conflict
        if (window.syncEngine && window.syncEngine.isPlaying) {
          window.syncEngine.pauseLocal();
        }
        this.showScreenShareStage(true, sharerName, false);
      } else {
        this.remoteScreenStreamId = null;
        this.remoteScreenSharerName = null;
        this.showScreenShareStage(false);
      }
    });

    // 7. User left
    this.socket.on("user-left", () => {
      this.closePeerConnection();
      this.showRemoteAvatarPlaceholder(true);
      this.showScreenShareStage(false);
      const peerNameTag = document.getElementById("remoteUserName");
      if (peerNameTag) peerNameTag.textContent = "Waiting for friend...";
    });
  }

  createPeerConnection(targetId) {
    if (this.peerConnection) {
      this.closePeerConnection();
    }

    this.pendingCandidates = [];
    this.peerConnection = new RTCPeerConnection(this.rtcConfig);

    // Add local camera and mic tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        this.peerConnection.addTrack(track, this.localStream);
      });
    }

    // If currently sharing screen, add screen tracks as well
    if (this.isScreenSharing && this.screenStream) {
      this.screenSenders = [];
      this.screenStream.getTracks().forEach((track) => {
        const sender = this.peerConnection.addTrack(track, this.screenStream);
        this.screenSenders.push(sender);
      });
    }

    // Handle remote tracks
    this.peerConnection.ontrack = (event) => {
      if (!event.streams || !event.streams[0]) return;
      const stream = event.streams[0];

      // Check if this incoming track/stream belongs to a screen share
      const isScreen = (this.remoteScreenStreamId && stream.id === this.remoteScreenStreamId) ||
                       (this.remoteCamStream && stream.id !== this.remoteCamStream.id);

      if (isScreen) {
        // Screen share track -> Route to MAIN STAGE VIDEO SECTION!
        this.remoteScreenStream = stream;
        if (this.screenSharePlayer) {
          // REMOTE VIEWER: Unmuted so friend can hear the screen's audio cleanly!
          this.screenSharePlayer.muted = false;
          this.screenSharePlayer.volume = 1.0;
          this.screenSharePlayer.srcObject = stream;
        }
        this.showScreenShareStage(true, this.remoteScreenSharerName || "Friend", false);
      } else {
        // Webcam track -> Route to PERSON VIEW WINDOW!
        this.remoteCamStream = stream;
        if (this.remoteVideo) {
          this.remoteVideo.srcObject = stream;
          this.showRemoteAvatarPlaceholder(false);
          this.setupAudioMeter(stream, this.remoteTile);
        }
      }
    };

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit("signal-ice", {
          targetId: targetId || this.targetPeerId,
          candidate: event.candidate
        });
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      if (
        this.peerConnection.connectionState === "disconnected" ||
        this.peerConnection.connectionState === "failed"
      ) {
        this.showRemoteAvatarPlaceholder(true);
      }
    };

    return this.peerConnection;
  }

  async flushPendingCandidates() {
    if (!this.peerConnection) return;
    while (this.pendingCandidates.length > 0) {
      const candidate = this.pendingCandidates.shift();
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn("Failed to flush ICE candidate:", e);
      }
    }
  }

  async createOffer(targetId) {
    const pc = this.createPeerConnection(targetId);
    const offer = await pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true
    });
    await pc.setLocalDescription(offer);

    this.socket.emit("signal-offer", {
      targetId,
      offer
    });
  }

  async handleOffer(senderId, offer) {
    const pc = this.createPeerConnection(senderId);
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    this.flushPendingCandidates();

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    this.socket.emit("signal-answer", {
      targetId: senderId,
      answer
    });
  }

  closePeerConnection() {
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    if (this.remoteVideo) {
      this.remoteVideo.srcObject = null;
    }
  }

  // -----------------------------------------------
  // Screen Sharing (Routes to MAIN VIDEO STAGE)
  // -----------------------------------------------

  async toggleScreenShare() {
    if (this.isScreenSharing) {
      await this.stopScreenShare();
    } else {
      await this.startScreenShare();
    }
  }

  async startScreenShare() {
    try {
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: "always",
          frameRate: { max: 30 }
        },
        audio: true
      });

      this.isScreenSharing = true;

      // Automatically pause any running room video so background audio doesn't conflict!
      if (window.syncEngine && window.syncEngine.isPlaying) {
        window.syncEngine.pauseLocal();
      }

      // 1. Show the screen share in the MAIN VIDEO SECTION for the local user!
      // CRITICAL FIX FOR DUAL AUDIO:
      // The local user is MUTED on the website player because they already hear audio
      // directly from their source tab/window. This guarantees a SINGLE audio stream!
      if (this.screenSharePlayer) {
        this.screenSharePlayer.muted = true;
        this.screenSharePlayer.volume = 0;
        this.screenSharePlayer.srcObject = this.screenStream;
      }
      this.showScreenShareStage(true, "You", true);

      // 2. Ensure camera video REMAINS in the local person tile!
      if (this.localVideo && this.localStream) {
        this.localVideo.srcObject = this.localStream;
      }

      // 3. Add the screen share tracks to the active PeerConnection
      this.screenSenders = [];
      if (this.peerConnection) {
        this.screenStream.getTracks().forEach((track) => {
          const sender = this.peerConnection.addTrack(track, this.screenStream);
          this.screenSenders.push(sender);
        });

        // Trigger renegotiation so peer receives the additional screen share stream
        const offer = await this.peerConnection.createOffer();
        await this.peerConnection.setLocalDescription(offer);
        this.socket.emit("signal-offer", {
          targetId: this.targetPeerId,
          offer,
          isScreenShare: true,
          screenStreamId: this.screenStream.id
        });
      }

      // 4. Notify peers via socket
      this.socket.emit("screen-share-status", {
        isSharing: true,
        streamId: this.screenStream.id
      });

      // Update control button
      const btn = document.getElementById("btnShareScreen");
      if (btn) btn.classList.add("active-accent");

      // Handle user stopping screen share via browser's native banner ("Stop sharing")
      const screenVideoTrack = this.screenStream.getVideoTracks()[0];
      if (screenVideoTrack) {
        screenVideoTrack.onended = () => {
          if (this.isScreenSharing) {
            this.stopScreenShare();
          }
        };
      }
    } catch (err) {
      console.warn("Screen share cancelled or denied:", err);
      this.isScreenSharing = false;
    }
  }

  async stopScreenShare() {
    if (!this.isScreenSharing) return;
    this.isScreenSharing = false;

    // 1. Stop all screen media tracks
    if (this.screenStream) {
      this.screenStream.getTracks().forEach((track) => track.stop());
      this.screenStream = null;
    }

    // 2. Remove screen senders from PeerConnection
    if (this.peerConnection && this.screenSenders && this.screenSenders.length > 0) {
      this.screenSenders.forEach((sender) => {
        try {
          this.peerConnection.removeTrack(sender);
        } catch (e) {}
      });
      this.screenSenders = [];

      // Renegotiate with peer
      try {
        const offer = await this.peerConnection.createOffer();
        await this.peerConnection.setLocalDescription(offer);
        this.socket.emit("signal-offer", {
          targetId: this.targetPeerId,
          offer,
          screenShareEnded: true
        });
      } catch (e) {}
    }

    // 3. Clear main stage screen share display and revert to synchronized video
    if (this.screenSharePlayer) {
      this.screenSharePlayer.srcObject = null;
    }
    this.showScreenShareStage(false);

    // 4. Update UI & emit status
    const btn = document.getElementById("btnShareScreen");
    if (btn) btn.classList.remove("active-accent");

    this.socket.emit("screen-share-status", {
      isSharing: false
    });
  }

  showScreenShareStage(show, sharerName = "Friend", isSelf = false) {
    const wrapper = document.getElementById("screenShareWrapper");
    const ytWrapper = document.getElementById("ytPlayerWrapper");
    const html5Player = document.getElementById("html5Player");
    const titleEl = document.getElementById("stageVideoTitle");
    const ownerEl = document.getElementById("screenShareOwner");
    const btnStop = document.getElementById("btnStopStageScreen");

    if (show) {
      if (wrapper) wrapper.style.display = "flex";
      if (ytWrapper) ytWrapper.style.display = "none";
      if (html5Player) html5Player.style.display = "none";

      if (ownerEl) {
        ownerEl.textContent = isSelf ? "Your Screen Share" : `${sharerName}'s Screen Share`;
      }
      if (btnStop) {
        btnStop.style.display = isSelf ? "inline-flex" : "none";
      }
      if (titleEl) {
        if (!this.savedTitle) this.savedTitle = titleEl.textContent;
        titleEl.innerHTML = `<i class="fa-solid fa-desktop" style="color:var(--accent); margin-right:6px;"></i> ${isSelf ? 'Your Screen Share' : sharerName + "'s Screen Share"}`;
      }

      this.updateScreenAudioUI(isSelf);
    } else {
      if (wrapper) wrapper.style.display = "none";
      if (btnStop) btnStop.style.display = "none";

      if (titleEl && this.savedTitle) {
        titleEl.textContent = this.savedTitle;
      }

      // Restore active video player in stage
      if (window.syncEngine) {
        if (window.syncEngine.playerType === "youtube") {
          if (ytWrapper) ytWrapper.style.display = "block";
        } else {
          if (html5Player) html5Player.style.display = "block";
        }
      }
    }
  }

  // -----------------------------------------------
  // Camera & Microphone Controls (Person View Window)
  // -----------------------------------------------

  toggleCamera() {
    if (!this.localStream) return;
    const videoTracks = this.localStream.getVideoTracks();
    if (videoTracks.length === 0) return;

    this.isCamOn = !this.isCamOn;
    videoTracks.forEach((track) => (track.enabled = this.isCamOn));

    this.showLocalAvatarPlaceholder(!this.isCamOn);

    const btn = document.getElementById("btnToggleCam");
    if (btn) {
      btn.classList.toggle("active-danger", !this.isCamOn);
      btn.innerHTML = this.isCamOn
        ? '<i class="fa-solid fa-video"></i>'
        : '<i class="fa-solid fa-video-slash"></i>';
    }

    this.socket.emit("media-toggle", { type: "cam", enabled: this.isCamOn });
  }

  toggleMicrophone() {
    if (!this.localStream) return;
    const audioTracks = this.localStream.getAudioTracks();
    if (audioTracks.length === 0) return;

    this.isMicOn = !this.isMicOn;
    audioTracks.forEach((track) => (track.enabled = this.isMicOn));

    const btn = document.getElementById("btnToggleMic");
    const micIcon = document.getElementById("localMicIcon");
    if (btn) {
      btn.classList.toggle("active-danger", !this.isMicOn);
      btn.innerHTML = this.isMicOn
        ? '<i class="fa-solid fa-microphone"></i>'
        : '<i class="fa-solid fa-microphone-slash"></i>';
    }
    if (micIcon) {
      micIcon.className = this.isMicOn
        ? "fa-solid fa-microphone mic-status-icon"
        : "fa-solid fa-microphone-slash mic-status-icon muted";
    }

    this.socket.emit("media-toggle", { type: "mic", enabled: this.isMicOn });
  }

  // -----------------------------------------------
  // Speech & Audio Level Detector (Visual Speaking Aura)
  // -----------------------------------------------

  setupAudioMeter(stream, targetTile) {
    if (!stream || stream.getAudioTracks().length === 0 || !targetTile) return;

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioCtx();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const checkVolume = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;

        if (average > 18) {
          targetTile.classList.add("speaking");
        } else {
          targetTile.classList.remove("speaking");
        }

        requestAnimationFrame(checkVolume);
      };

      checkVolume();
    } catch (e) {
      console.warn("Audio meter setup warning:", e);
    }
  }

  showLocalAvatarPlaceholder(show) {
    const el = document.getElementById("localPlaceholder");
    if (el) el.classList.toggle("show", show);
  }

  showRemoteAvatarPlaceholder(show) {
    const el = document.getElementById("remotePlaceholder");
    if (el) el.classList.toggle("show", show);
  }
}

window.WebRTCCall = WebRTCCall;
