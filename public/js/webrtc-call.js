/**
 * WebRTCCall - Two-Person Real-Time Video & Audio Calling Engine
 * Inspired by Virtual Huddle (Video Conference)
 *
 * Features:
 * - Robust STUN candidate exchange with Perfect Negotiation (W3C pattern)
 * - Safe candidate queueing (zero ICE race conditions)
 * - Resilient user media with graceful audio/video fallbacks
 * - Uncompromised webcam display in Person View Tiles
 * - Screen sharing displayed in MAIN STAGE with single-audio echo prevention
 * - Auto-recovery on connection drops or ICE failures
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
    this.remotePeerName = null;

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
    this.makingOffer = false;
    this.ignoreOffer = false;
    this.reconnectTimer = null;
    this.localAudioMeterActive = false;
    this.remoteAudioMeterActive = false;

    // Multi-Region High-Availability STUN Servers
    this.rtcConfig = {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
        { urls: "stun:stun3.l.google.com:19302" },
        { urls: "stun:stun4.l.google.com:19302" },
        { urls: "stun:stun.cloudflare.com:3478" },
        { urls: "stun:stun.services.mozilla.com" }
      ],
      iceCandidatePoolSize: 10
    };

    // Ensure user media is initialized before signaling
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
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.warn("navigator.mediaDevices.getUserMedia is not supported on this origin (requires HTTPS or localhost).");
      this.showLocalAvatarPlaceholder(true);
      this.localStream = new MediaStream();
      return this.localStream;
    }

    try {
      // 1. Attempt Video + Audio with ideal resolutions
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { max: 30 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
    } catch (err) {
      console.warn("Could not acquire video and audio together:", err.message);
      // Fallback 1: Video only
      try {
        this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      } catch (err2) {
        // Fallback 2: Audio only
        try {
          this.localStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        } catch (err3) {
          console.warn("Camera and microphone completely denied or unavailable:", err3.message);
          this.localStream = new MediaStream();
        }
      }
    }

    const hasVideo = this.localStream && this.localStream.getVideoTracks().length > 0;
    const hasAudio = this.localStream && this.localStream.getAudioTracks().length > 0;

    if (this.localVideo && hasVideo) {
      this.localVideo.srcObject = this.localStream;
      this.localVideo.play().catch(() => {});
      this.showLocalAvatarPlaceholder(false);
    } else {
      this.showLocalAvatarPlaceholder(true);
    }

    if (hasAudio) {
      this.setupAudioMeter(this.localStream, this.localTile);
    }

    return this.localStream;
  }

  initSocketSignaling() {
    // 1. Ready to initiate call as caller
    this.socket.on("initiate-call", async ({ peerId }) => {
      console.log("WebRTC initiate-call received for peer:", peerId);
      this.targetPeerId = peerId;
      await this.mediaReadyPromise;
      await this.callPeer(peerId);
    });

    // 2. Peer is ready in room (callee or mutual awareness)
    this.socket.on("peer-ready-to-call", async ({ peerId, peerName }) => {
      console.log("WebRTC peer-ready-to-call received:", peerId, peerName);
      this.targetPeerId = peerId;
      if (peerName) {
        this.remotePeerName = peerName;
        this.updateRemoteUserNameUI(peerName);
      }
      await this.mediaReadyPromise;

      // If call is not connected after 2.5s, auto-initiate
      setTimeout(async () => {
        if (!this.peerConnection || this.peerConnection.connectionState !== "connected") {
          console.log("Peer ready fallback: calling peer", peerId);
          await this.callPeer(peerId);
        }
      }, 2500);
    });

    // 3. Incoming Offer
    this.socket.on("signal-offer", async (payload) => {
      const { senderId, senderName, offer, isScreenShare, screenStreamId } = payload || {};
      if (!offer) return;

      this.targetPeerId = senderId;
      if (senderName) {
        this.remotePeerName = senderName;
        this.updateRemoteUserNameUI(senderName);
      }
      if (isScreenShare && screenStreamId) {
        this.remoteScreenStreamId = screenStreamId;
        this.remoteScreenSharerName = senderName;
      }

      await this.mediaReadyPromise;
      await this.handleOffer(senderId, offer);
    });

    // 4. Incoming Answer
    this.socket.on("signal-answer", async ({ answer }) => {
      if (!answer) return;
      await this.handleAnswer(answer);
    });

    // 5. Incoming ICE candidate
    this.socket.on("signal-ice", async ({ candidate }) => {
      if (!candidate) return;
      await this.handleIceCandidate(candidate);
    });

    // 6. Signal Reconnect Request
    this.socket.on("signal-reconnect", async ({ senderId }) => {
      console.log("WebRTC signal-reconnect requested by peer:", senderId);
      this.targetPeerId = senderId;
      await this.callPeer(senderId, true);
    });

    // 7. Peer Media State Toggle (Cam / Mic)
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

    // 8. Peer Speaking Status (Animated Three-Dots Badge)
    this.socket.on("peer-speaking", ({ speaking }) => {
      if (this.remoteTile) {
        this.remoteTile.classList.toggle("speaking", !!speaking);
      }
    });

    // 9. Remote Screen Share Status Announcement
    this.socket.on("screen-share-status", ({ isSharing, sharerName, streamId }) => {
      if (isSharing) {
        this.remoteScreenStreamId = streamId;
        this.remoteScreenSharerName = sharerName;
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

    // 10. User Left
    this.socket.on("user-left", () => {
      this.closePeerConnection();
      this.showRemoteAvatarPlaceholder(true);
      this.showScreenShareStage(false);
      this.updateRemoteUserNameUI("Waiting for friend...");
    });
  }

  getOrCreatePeerConnection(targetId) {
    if (this.peerConnection && this.peerConnection.connectionState !== "closed") {
      return this.peerConnection;
    }

    if (this.peerConnection) {
      this.closePeerConnection();
    }

    this.peerConnection = new RTCPeerConnection(this.rtcConfig);

    // 1. Add local camera & mic tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        try {
          this.peerConnection.addTrack(track, this.localStream);
        } catch (e) {
          console.warn("Could not add local track:", e);
        }
      });
    }

    // 2. Add local screen share tracks if active
    if (this.isScreenSharing && this.screenStream) {
      this.screenSenders = [];
      this.screenStream.getTracks().forEach((track) => {
        try {
          const sender = this.peerConnection.addTrack(track, this.screenStream);
          this.screenSenders.push(sender);
        } catch (e) {
          console.warn("Could not add screen track:", e);
        }
      });
    }

    // 3. ICE Candidate Handler
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit("signal-ice", {
          targetId: targetId || this.targetPeerId,
          candidate: event.candidate
        });
      }
    };

    // 4. Remote Track Handler
    this.peerConnection.ontrack = (event) => {
      console.log("WebRTC ontrack received:", event.track.kind, event.track.id);

      let stream = (event.streams && event.streams[0]) ? event.streams[0] : null;
      if (!stream) {
        stream = new MediaStream([event.track]);
      }

      // Explicit check: is this track screen share?
      const isScreen = (this.remoteScreenStreamId && stream.id === this.remoteScreenStreamId) ||
                       (this.remoteScreenStreamId && event.track.id === this.remoteScreenStreamId);

      if (isScreen) {
        // Screen Share Track -> MAIN VIDEO THEATER STAGE
        this.remoteScreenStream = stream;
        if (this.screenSharePlayer) {
          this.screenSharePlayer.muted = false;
          this.screenSharePlayer.volume = 1.0;
          this.screenSharePlayer.srcObject = stream;
          this.screenSharePlayer.play().catch(() => {});
        }
        this.showScreenShareStage(true, this.remoteScreenSharerName || "Friend", false);
      } else {
        // Webcam / Mic Track -> PERSON VIEW TILE
        if (event.track.kind === "video") {
          this.remoteCamStream = stream;
          if (this.remoteVideo) {
            this.remoteVideo.srcObject = stream;
            const playPromise = this.remoteVideo.play();
            if (playPromise !== undefined) {
              playPromise.catch((err) => {
                console.warn("remoteVideo.play() prevented by browser autoplay policy:", err);
                const unlock = () => {
                  if (this.remoteVideo) this.remoteVideo.play().catch(() => {});
                };
                document.addEventListener("click", unlock, { once: true });
              });
            }
          }
          this.showRemoteAvatarPlaceholder(false);
        } else if (event.track.kind === "audio") {
          if (this.remoteVideo && !this.remoteVideo.srcObject) {
            this.remoteVideo.srcObject = stream;
            this.remoteVideo.play().catch(() => {});
          }
          this.setupAudioMeter(stream, this.remoteTile);
        } else {
          if (this.remoteVideo && !this.remoteVideo.srcObject) {
            this.remoteVideo.srcObject = stream;
          }
          this.showRemoteAvatarPlaceholder(false);
        }
      }
    };

    // 5. Connection State Monitoring
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection.connectionState;
      console.log("WebRTC connectionState:", state);
      if (state === "connected") {
        this.showRemoteAvatarPlaceholder(false);
        if (this.remoteVideo && this.remoteVideo.paused) {
          this.remoteVideo.play().catch(() => {});
        }
      } else if (state === "disconnected" || state === "failed") {
        console.warn("WebRTC disconnected or failed. Attempting auto-reconnect...");
        this.attemptAutoReconnect();
      }
    };

    // 6. ICE Connection State Monitoring
    this.peerConnection.oniceconnectionstatechange = () => {
      const iceState = this.peerConnection.iceConnectionState;
      console.log("WebRTC iceConnectionState:", iceState);
      if (iceState === "failed") {
        if (typeof this.peerConnection.restartIce === "function") {
          try {
            this.peerConnection.restartIce();
          } catch (e) {
            this.attemptAutoReconnect();
          }
        } else {
          this.attemptAutoReconnect();
        }
      }
    };

    return this.peerConnection;
  }

  async callPeer(targetId, forceNew = false) {
    if (forceNew) {
      this.closePeerConnection();
    }
    this.targetPeerId = targetId;
    const pc = this.getOrCreatePeerConnection(targetId);

    try {
      this.makingOffer = true;
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });

      if (pc.signalingState !== "stable") return;

      await pc.setLocalDescription(offer);

      this.socket.emit("signal-offer", {
        targetId,
        offer: pc.localDescription
      });
    } catch (err) {
      console.warn("Error creating offer:", err);
    } finally {
      this.makingOffer = false;
    }
  }

  async handleOffer(senderId, offer) {
    this.targetPeerId = senderId;
    const isPolite = this.socket.id < senderId;
    const pc = this.getOrCreatePeerConnection(senderId);

    try {
      const isOffer = offer.type === "offer" || !offer.type;
      const offerCollision = isOffer && (this.makingOffer || pc.signalingState !== "stable");
      this.ignoreOffer = !isPolite && offerCollision;

      if (this.ignoreOffer) {
        console.warn("WebRTC Glare: Impolite peer ignoring colliding offer");
        return;
      }

      if (offerCollision) {
        console.warn("WebRTC Glare: Polite peer rolling back to handle colliding offer");
        await Promise.all([
          pc.setLocalDescription({ type: "rollback" }),
          pc.setRemoteDescription(new RTCSessionDescription(offer))
        ]);
      } else {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
      }

      await this.flushPendingCandidates();

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      this.socket.emit("signal-answer", {
        targetId: senderId,
        answer: pc.localDescription
      });
    } catch (err) {
      console.warn("Error handling offer:", err);
    }
  }

  async handleAnswer(answer) {
    if (!this.peerConnection) return;
    try {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      await this.flushPendingCandidates();
    } catch (err) {
      console.warn("Error setting remote answer description:", err);
    }
  }

  async handleIceCandidate(candidate) {
    if (!candidate) return;
    try {
      if (
        this.peerConnection &&
        this.peerConnection.remoteDescription &&
        this.peerConnection.remoteDescription.type
      ) {
        await this.peerConnection.addIceCandidate(candidate);
      } else {
        this.pendingCandidates.push(candidate);
      }
    } catch (err) {
      console.warn("Error adding ICE candidate:", err);
    }
  }

  async flushPendingCandidates() {
    if (!this.peerConnection || !this.peerConnection.remoteDescription) return;
    const candidates = [...this.pendingCandidates];
    this.pendingCandidates = [];
    for (const cand of candidates) {
      try {
        await this.peerConnection.addIceCandidate(cand);
      } catch (err) {
        console.warn("Error flushing queued ICE candidate:", err);
      }
    }
  }

  attemptAutoReconnect() {
    if (this.reconnectTimer || !this.targetPeerId) return;
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      console.log("Attempting automatic WebRTC reconnect with peer:", this.targetPeerId);
      this.socket.emit("signal-reconnect", { targetId: this.targetPeerId });
      await this.callPeer(this.targetPeerId, true);
    }, 1800);
  }

  onUserJoined(user) {
    if (!user || !user.id) return;
    this.targetPeerId = user.id;
    this.remotePeerName = user.name;
    this.updateRemoteUserNameUI(user.name);
  }

  onUserLeft(userId) {
    if (this.targetPeerId === userId) {
      this.closePeerConnection();
      this.showRemoteAvatarPlaceholder(true);
      this.showScreenShareStage(false);
      this.updateRemoteUserNameUI("Waiting for friend...");
    }
  }

  setRemotePeer(id, name) {
    this.targetPeerId = id;
    if (name) {
      this.remotePeerName = name;
      this.updateRemoteUserNameUI(name);
    }
  }

  updateRemoteUserNameUI(name) {
    const peerNameTag = document.getElementById("remoteUserName");
    const sidebarFriendName = document.getElementById("sidebarFriendName");
    const sidebarDot = document.getElementById("sidebarFriendStatusDot");

    if (peerNameTag && name) {
      peerNameTag.textContent = name;
    }
    if (sidebarFriendName && name) {
      sidebarFriendName.textContent = name;
    }
    if (sidebarDot) {
      sidebarDot.style.color = (name && name !== "Waiting for friend...") ? "var(--mint)" : "var(--text-dim)";
    }
  }

  closePeerConnection() {
    if (this.peerConnection) {
      this.peerConnection.onicecandidate = null;
      this.peerConnection.ontrack = null;
      this.peerConnection.onconnectionstatechange = null;
      this.peerConnection.oniceconnectionstatechange = null;
      this.peerConnection.close();
      this.peerConnection = null;
    }
    if (this.remoteVideo) {
      this.remoteVideo.srcObject = null;
    }
    this.remoteCamStream = null;
    this.remoteScreenStream = null;
    this.remoteScreenStreamId = null;
    this.remoteScreenSharerName = null;
    this.pendingCandidates = [];
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
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      alert("Screen sharing is not supported by your browser or requires HTTPS.");
      return;
    }

    try {
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: "always",
          frameRate: { max: 30 }
        },
        audio: true
      });

      this.isScreenSharing = true;

      // Automatically pause any running room video
      if (window.syncEngine && window.syncEngine.isPlaying) {
        window.syncEngine.pauseLocal();
      }

      // Display in main theater stage for local user
      // Local user is MUTED on website player to guarantee single audio source
      if (this.screenSharePlayer) {
        this.screenSharePlayer.muted = true;
        this.screenSharePlayer.volume = 0;
        this.screenSharePlayer.srcObject = this.screenStream;
        this.screenSharePlayer.play().catch(() => {});
      }
      this.showScreenShareStage(true, "You", true);

      // Ensure local camera video remains in local person tile
      if (this.localVideo && this.localStream && this.localStream.getVideoTracks().length > 0) {
        this.localVideo.srcObject = this.localStream;
      }

      // Add screen tracks to existing PeerConnection without breaking webcam
      this.screenSenders = [];
      if (this.peerConnection && this.targetPeerId) {
        this.screenStream.getTracks().forEach((track) => {
          const sender = this.peerConnection.addTrack(track, this.screenStream);
          this.screenSenders.push(sender);
        });

        // Renegotiate with peer
        const offer = await this.peerConnection.createOffer();
        await this.peerConnection.setLocalDescription(offer);
        this.socket.emit("signal-offer", {
          targetId: this.targetPeerId,
          offer: this.peerConnection.localDescription,
          isScreenShare: true,
          screenStreamId: this.screenStream.id
        });
      }

      // Broadcast screen share status
      this.socket.emit("screen-share-status", {
        isSharing: true,
        streamId: this.screenStream.id
      });

      const btn = document.getElementById("btnShareScreen");
      if (btn) btn.classList.add("active-accent");

      // Handle native browser "Stop sharing" bar
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

    // 2. Remove screen senders from PeerConnection without breaking webcam
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
          offer: this.peerConnection.localDescription,
          screenShareEnded: true
        });
      } catch (e) {}
    }

    // 3. Clear main stage screen share display
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
    const emptyState = document.getElementById("stageEmptyState");
    const titleEl = document.getElementById("stageVideoTitle");
    const ownerEl = document.getElementById("screenShareOwner");
    const btnStop = document.getElementById("btnStopStageScreen");

    if (show) {
      if (wrapper) wrapper.style.display = "flex";
      if (ytWrapper) ytWrapper.style.display = "none";
      if (html5Player) html5Player.style.display = "none";
      if (emptyState) emptyState.style.display = "none";

      if (ownerEl) {
        ownerEl.textContent = isSelf ? "Your Screen Share" : `${sharerName}'s Screen Share`;
      }
      if (btnStop) {
        btnStop.style.display = isSelf ? "inline-flex" : "none";
      }
      if (titleEl) {
        if (!this.savedTitle) this.savedTitle = titleEl.textContent;
        titleEl.innerHTML = `<i class="fa-solid fa-desktop" style="color:var(--mint); margin-right:6px;"></i> ${isSelf ? 'Your Screen Share' : sharerName + "'s Screen Share"}`;
      }
      const stageBadgeText = document.getElementById("stageBadgeText");
      if (stageBadgeText) stageBadgeText.textContent = "🖥️ Screen Share Active";

      this.updateScreenAudioUI(isSelf);
    } else {
      if (wrapper) wrapper.style.display = "none";
      if (btnStop) btnStop.style.display = "none";

      if (titleEl && this.savedTitle) {
        titleEl.textContent = this.savedTitle;
      }
      const stageBadgeText = document.getElementById("stageBadgeText");
      if (stageBadgeText && this.savedTitle) {
        stageBadgeText.textContent = this.savedTitle.substring(0, 28);
      }

      // Restore active video player in stage or show empty state
      if (window.syncEngine && window.syncEngine.playerType === "youtube") {
        if (ytWrapper) ytWrapper.style.display = "block";
      } else if (window.syncEngine && window.syncEngine.playerType === "html5") {
        if (html5Player) html5Player.style.display = "block";
      } else {
        if (emptyState) emptyState.style.display = "flex";
      }
    }
  }

  // -----------------------------------------------
  // Camera & Microphone Controls
  // -----------------------------------------------

  async toggleCamera() {
    let videoTracks = this.localStream ? this.localStream.getVideoTracks() : [];

    // If no video track exists yet, request camera permission on demand
    if (videoTracks.length === 0) {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert("Camera access requires HTTPS or localhost.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { max: 30 } }
        });
        const newTrack = stream.getVideoTracks()[0];
        if (newTrack) {
          if (!this.localStream) this.localStream = new MediaStream();
          this.localStream.addTrack(newTrack);
          if (this.localVideo) {
            this.localVideo.srcObject = this.localStream;
            this.localVideo.play().catch(() => {});
          }
          this.isCamOn = true;
          this.showLocalAvatarPlaceholder(false);

          if (this.peerConnection) {
            const sender = this.peerConnection.getSenders().find(s => s.track && s.track.kind === "video");
            if (sender) {
              await sender.replaceTrack(newTrack);
            } else {
              this.peerConnection.addTrack(newTrack, this.localStream);
              if (this.targetPeerId) {
                await this.callPeer(this.targetPeerId);
              }
            }
          }
        }
      } catch (err) {
        console.warn("Could not activate camera:", err);
        return;
      }
    } else {
      this.isCamOn = !this.isCamOn;
      videoTracks.forEach((track) => (track.enabled = this.isCamOn));
      this.showLocalAvatarPlaceholder(!this.isCamOn);
    }

    const btn = document.getElementById("btnToggleCam");
    if (btn) {
      btn.classList.toggle("active-danger", !this.isCamOn);
      btn.innerHTML = this.isCamOn
        ? '<i class="fa-solid fa-video"></i>'
        : '<i class="fa-solid fa-video-slash"></i>';
    }

    this.socket.emit("media-toggle", { type: "cam", enabled: this.isCamOn });
  }

  async toggleMicrophone() {
    let audioTracks = this.localStream ? this.localStream.getAudioTracks() : [];

    // If no audio track exists yet, request microphone permission on demand
    if (audioTracks.length === 0) {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert("Microphone access requires HTTPS or localhost.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const newTrack = stream.getAudioTracks()[0];
        if (newTrack) {
          if (!this.localStream) this.localStream = new MediaStream();
          this.localStream.addTrack(newTrack);
          this.isMicOn = true;
          this.setupAudioMeter(this.localStream, this.localTile);

          if (this.peerConnection) {
            const sender = this.peerConnection.getSenders().find(s => s.track && s.track.kind === "audio");
            if (sender) {
              await sender.replaceTrack(newTrack);
            } else {
              this.peerConnection.addTrack(newTrack, this.localStream);
              if (this.targetPeerId) {
                await this.callPeer(this.targetPeerId);
              }
            }
          }
        }
      } catch (err) {
        console.warn("Could not activate microphone:", err);
        return;
      }
    } else {
      this.isMicOn = !this.isMicOn;
      audioTracks.forEach((track) => (track.enabled = this.isMicOn));
    }

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
  // Speech & Audio Level Detector (Visual Aura)
  // -----------------------------------------------

  setupAudioMeter(stream, targetTile) {
    if (!stream || stream.getAudioTracks().length === 0 || !targetTile) return;

    if (targetTile === this.localTile && this.localAudioMeterActive) return;
    if (targetTile === this.remoteTile && this.remoteAudioMeterActive) return;

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const audioCtx = new AudioCtx();

      if (audioCtx.state === "suspended") {
        const resumeAudio = () => {
          if (audioCtx.state === "suspended") {
            audioCtx.resume();
          }
        };
        document.addEventListener("click", resumeAudio, { once: true });
      }

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      let isSpeakingBroadcast = false;

      if (targetTile === this.localTile) this.localAudioMeterActive = true;
      if (targetTile === this.remoteTile) this.remoteAudioMeterActive = true;

      const checkVolume = () => {
        if (!this.peerConnection && targetTile === this.remoteTile) {
          this.remoteAudioMeterActive = false;
          return;
        }

        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;

        const isSpeaking = average > 14;
        if (isSpeaking) {
          targetTile.classList.add("speaking");
        } else {
          targetTile.classList.remove("speaking");
        }

        if (targetTile === this.localTile) {
          if (isSpeaking && !isSpeakingBroadcast) {
            isSpeakingBroadcast = true;
            this.socket.emit("peer-speaking", { speaking: true });
          } else if (!isSpeaking && isSpeakingBroadcast) {
            isSpeakingBroadcast = false;
            this.socket.emit("peer-speaking", { speaking: false });
          }
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
