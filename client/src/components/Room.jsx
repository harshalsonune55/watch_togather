import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:stun.services.mozilla.com' },
    { urls: 'stun:stun.relay.metered.ca:80' },
    {
      urls: [
        'turn:openrelay.metered.ca:80',
        'turn:openrelay.metered.ca:443',
        'turn:openrelay.metered.ca:443?transport=tcp',
        'turns:openrelay.metered.ca:443?transport=tcp'
      ],
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
  ],
  iceCandidatePoolSize: 10
};

export default function Room({ roomId, initialName, onNavigate }) {
  const [userName, setUserName] = useState(() => {
    return initialName || localStorage.getItem('wt_username') || 'Alex';
  });

  // Video State
  const [video, setVideo] = useState({
    type: null,
    source: null,
    title: 'Waiting for video link or screen share',
    state: 'paused',
    currentTime: 0,
    playbackRate: 1.0
  });

  // Playback Progress
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1.0);

  // Chat State
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [typingText, setTypingText] = useState('');
  const [floatingEmojis, setFloatingEmojis] = useState([]);

  // Call & Peer State
  const [isCamOn, setIsCamOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [remotePeerName, setRemotePeerName] = useState('Waiting for friend...');
  const [remotePeerConnected, setRemotePeerConnected] = useState(false);
  const [remoteMicActive, setRemoteMicActive] = useState(true);
  const [remoteCamActive, setRemoteCamActive] = useState(false);
  const [isLocalSpeaking, setIsLocalSpeaking] = useState(false);
  const [isRemoteSpeaking, setIsRemoteSpeaking] = useState(false);

  // Screen Share Stage
  const [stageScreenShare, setStageScreenShare] = useState({
    active: false,
    owner: '',
    isSelf: false
  });
  const [screenAudioMuted, setScreenAudioMuted] = useState(false);
  const [screenVolume, setScreenVolume] = useState(1.0);

  // AI Assistant State
  const [aiLatecomerVisible, setAiLatecomerVisible] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiRecapModal, setAiRecapModal] = useState(null);

  // Modals & UI Toggles
  const [isCinemaMode, setIsCinemaMode] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [modalVideoUrl, setModalVideoUrl] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  // Refs
  const socketRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const screenSendersRef = useRef([]);
  const targetPeerIdRef = useRef(null);
  const pendingCandidatesRef = useRef([]);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const screenShareVideoRef = useRef(null);
  const html5PlayerRef = useRef(null);
  const ytPlayerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Toast Helper
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 2800);
  };

  const formatTime = (secs) => {
    secs = Math.max(0, Math.floor(secs || 0));
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    const pad = (n) => String(n).padStart(2, '0');
    if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
    return `${pad(m)}:${pad(s)}`;
  };

  // --------------------------------------------------------------------------
  // Socket.IO & WebRTC Initialization
  // --------------------------------------------------------------------------
  useEffect(() => {
    const socket = io();
    socketRef.current = socket;

    // Check if user came from lobby with a pending video link
    const pendingVid = sessionStorage.getItem('wt_pending_video_' + roomId);
    if (pendingVid) {
      sessionStorage.removeItem('wt_pending_video_' + roomId);
    }

    // 1. Join Room
    socket.emit('join-room', { roomId, userName });

    // 2. Room State Init
    socket.on('room-init', (data) => {
      if (data.users && data.users.length > 1) {
        const partner = data.users.find((u) => u.id !== data.yourId);
        if (partner) {
          setRemotePeerName(partner.name);
          targetPeerIdRef.current = partner.id;
        }
      }

      if (data.messages) {
        setMessages(data.messages);
      }

      if (data.video) {
        setVideo(data.video);
        if (data.video.currentTime > 0) {
          setCurrentTime(data.video.currentTime);
        }
        setIsPlaying(data.video.state === 'playing');

        // Check if user joined late (video is running or > 25 seconds in, or prior chat messages)
        if (data.video.currentTime > 25 || (data.messages && data.messages.length > 3)) {
          setAiLatecomerVisible(true);
        }
      }

      // If pending video was passed from lobby form submission
      if (pendingVid) {
        socket.emit('video-change', { source: pendingVid });
      }
    });

    // 3. User Joined
    socket.on('user-joined', (data) => {
      if (data.user) {
        setRemotePeerName(data.user.name);
        targetPeerIdRef.current = data.user.id;
        showToast(`👋 ${data.user.name} joined the room!`);
      }
    });

    // 4. User Left
    socket.on('user-left', (data) => {
      setRemotePeerName('Waiting for friend...');
      setRemotePeerConnected(false);
      setRemoteCamActive(false);
      targetPeerIdRef.current = null;
      closePeerConnection();
      showToast(`🚪 ${data.userName || 'Friend'} left the room`);
    });

    // 5. Chat & Reactions
    socket.on('chat-message', (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    socket.on('chat-typing', ({ sender, isTyping }) => {
      setTypingText(isTyping ? `${sender} is typing...` : '');
    });

    socket.on('reaction-burst', ({ emoji }) => {
      spawnEmoji(emoji);
    });

    // 6. Video Sync Broadcasts
    socket.on('video-change', (data) => {
      if (data.video) {
        setVideo(data.video);
        setCurrentTime(0);
        setIsPlaying(false);
        showToast(`🎬 Loaded: ${data.video.title}`);
      }
    });

    socket.on('video-play', (data) => {
      setIsPlaying(true);
      if (typeof data.time === 'number') {
        setCurrentTime(data.time);
        seekLocalPlayer(data.time);
      }
      playLocalPlayer();
    });

    socket.on('video-pause', (data) => {
      setIsPlaying(false);
      if (typeof data.time === 'number') {
        setCurrentTime(data.time);
        seekLocalPlayer(data.time);
      }
      pauseLocalPlayer();
    });

    socket.on('video-seek', (data) => {
      if (typeof data.time === 'number') {
        setCurrentTime(data.time);
        seekLocalPlayer(data.time);
      }
    });

    socket.on('video-rate', (data) => {
      if (typeof data.rate === 'number') {
        setPlaybackRate(data.rate);
        setPlayerRate(data.rate);
      }
    });

    socket.on('sync-heartbeat', (data) => {
      if (data.state === 'playing') {
        const localT = getLocalPlayerTime();
        if (Math.abs(localT - data.currentTime) > 1.8) {
          seekLocalPlayer(data.currentTime);
        }
      }
    });

    // 7. WebRTC Call Signaling
    socket.on('initiate-call', async ({ peerId }) => {
      targetPeerIdRef.current = peerId;
      await initLocalMedia();
      await callPeer(peerId);
    });

    socket.on('peer-ready-to-call', async ({ peerId, peerName }) => {
      targetPeerIdRef.current = peerId;
      if (peerName) setRemotePeerName(peerName);
      await initLocalMedia();
    });

    socket.on('signal-offer', async (payload) => {
      const { senderId, senderName, offer, isScreenShare, screenStreamId } = payload || {};
      if (!offer) return;
      targetPeerIdRef.current = senderId;
      if (senderName) setRemotePeerName(senderName);
      await initLocalMedia();
      await handleOffer(senderId, offer);
    });

    socket.on('signal-answer', async ({ answer }) => {
      if (!answer || !peerConnectionRef.current) return;
      try {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        await flushIceCandidates();
      } catch (e) {
        console.warn('Error setting remote answer:', e);
      }
    });

    socket.on('signal-ice', async ({ candidate }) => {
      if (!candidate) return;
      try {
        if (
          peerConnectionRef.current &&
          peerConnectionRef.current.remoteDescription &&
          peerConnectionRef.current.remoteDescription.type
        ) {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } else {
          pendingCandidatesRef.current.push(candidate);
        }
      } catch (e) {
        console.warn('Error adding ICE candidate:', e);
      }
    });

    socket.on('peer-media-toggle', ({ type, enabled }) => {
      if (type === 'cam') setRemoteCamActive(enabled);
      if (type === 'mic') setRemoteMicActive(enabled);
    });

    socket.on('peer-speaking', ({ speaking }) => {
      setIsRemoteSpeaking(!!speaking);
    });

    socket.on('screen-share-status', ({ isSharing, sharerName, streamId }) => {
      if (isSharing) {
        setStageScreenShare({ active: true, owner: sharerName || 'Friend', isSelf: false });
        pauseLocalPlayer();
      } else {
        setStageScreenShare({ active: false, owner: '', isSelf: false });
      }
    });

    // Auto-initialize local camera & mic
    initLocalMedia();

    return () => {
      closePeerConnection();
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      socket.disconnect();
    };
  }, [roomId]);

  // Scroll chat to bottom on new message
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // --------------------------------------------------------------------------
  // WebRTC Implementation
  // --------------------------------------------------------------------------
  const initLocalMedia = async () => {
    if (localStreamRef.current) return localStreamRef.current;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.warn('getUserMedia not supported on this origin.');
      return null;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { max: 30 } },
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(() => {});
      }
      setupAudioMeter(stream, true);
      return stream;
    } catch (e) {
      console.warn('Audio+Video acquisition failed, trying video only:', e);
      try {
        const vStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        localStreamRef.current = vStream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = vStream;
          localVideoRef.current.play().catch(() => {});
        }
        return vStream;
      } catch (e2) {
        console.warn('Camera completely denied or unavailable:', e2);
        return null;
      }
    }
  };

  const getOrCreatePeerConnection = (targetId) => {
    if (peerConnectionRef.current && peerConnectionRef.current.connectionState !== 'closed') {
      return peerConnectionRef.current;
    }

    const pc = new RTCPeerConnection(RTC_CONFIG);
    peerConnectionRef.current = pc;

    // Add local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        try {
          pc.addTrack(track, localStreamRef.current);
        } catch (e) {}
      });
    }

    // Ensure audio & video transceivers exist
    try {
      const transceivers = pc.getTransceivers();
      const hasA = transceivers.some((t) => t.receiver?.track?.kind === 'audio');
      const hasV = transceivers.some((t) => t.receiver?.track?.kind === 'video');
      if (!hasA) pc.addTransceiver('audio', { direction: 'sendrecv' });
      if (!hasV) pc.addTransceiver('video', { direction: 'sendrecv' });
    } catch (e) {}

    // ICE Candidate emission
    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('signal-ice', {
          targetId: targetId || targetPeerIdRef.current,
          candidate: event.candidate.toJSON ? event.candidate.toJSON() : event.candidate
        });
      }
    };

    // Remote Track Handler
    pc.ontrack = (event) => {
      console.log('WebRTC ontrack received:', event.track.kind);
      let stream = event.streams && event.streams[0] ? event.streams[0] : null;
      if (!stream) stream = new MediaStream([event.track]);

      // Check if this track belongs to screen share
      if (stageScreenShare.active && stageScreenShare.owner !== 'You') {
        if (screenShareVideoRef.current) {
          screenShareVideoRef.current.srcObject = stream;
          screenShareVideoRef.current.play().catch(() => {});
        }
        return;
      }

      // Remote Camera & Audio
      if (event.track.kind === 'video') {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream;
          remoteVideoRef.current.muted = true; // Guarantees 100% autoplay compliance across all browsers
          remoteVideoRef.current.play().catch(() => {});
        }
        setRemoteCamActive(true);
        setRemotePeerConnected(true);

        event.track.onunmute = () => {
          setRemoteCamActive(true);
          if (remoteVideoRef.current) remoteVideoRef.current.play().catch(() => {});
        };
      } else if (event.track.kind === 'audio') {
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = stream;
          remoteAudioRef.current.play().catch(() => {
            const unlock = () => {
              if (remoteAudioRef.current) remoteAudioRef.current.play().catch(() => {});
              document.removeEventListener('click', unlock);
              document.removeEventListener('touchstart', unlock);
            };
            document.addEventListener('click', unlock, { once: true });
            document.addEventListener('touchstart', unlock, { once: true });
          });
        }
        setupAudioMeter(stream, false);
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === 'connected') {
        setRemotePeerConnected(true);
        setRemoteCamActive(true);
        if (remoteVideoRef.current?.paused) remoteVideoRef.current.play().catch(() => {});
        if (remoteAudioRef.current?.paused) remoteAudioRef.current.play().catch(() => {});
      } else if (state === 'disconnected' || state === 'failed') {
        setRemotePeerConnected(false);
      }
    };

    return pc;
  };

  const callPeer = async (targetId) => {
    targetPeerIdRef.current = targetId;
    const pc = getOrCreatePeerConnection(targetId);

    try {
      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
      if (pc.signalingState !== 'stable') return;
      await pc.setLocalDescription(offer);

      socketRef.current.emit('signal-offer', {
        targetId,
        offer: { type: pc.localDescription.type, sdp: pc.localDescription.sdp }
      });
    } catch (e) {
      console.warn('Error creating offer:', e);
    }
  };

  const handleOffer = async (senderId, offer) => {
    targetPeerIdRef.current = senderId;
    const pc = getOrCreatePeerConnection(senderId);

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      await flushIceCandidates();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socketRef.current.emit('signal-answer', {
        targetId: senderId,
        answer: { type: pc.localDescription.type, sdp: pc.localDescription.sdp }
      });
    } catch (e) {
      console.warn('Error handling offer:', e);
    }
  };

  const flushIceCandidates = async () => {
    if (!peerConnectionRef.current || !peerConnectionRef.current.remoteDescription) return;
    const queued = [...pendingCandidatesRef.current];
    pendingCandidatesRef.current = [];
    for (const c of queued) {
      try {
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(c));
      } catch (e) {}
    }
  };

  const closePeerConnection = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    pendingCandidatesRef.current = [];
  };

  const setupAudioMeter = (stream, isSelf) => {
    if (!stream || stream.getAudioTracks().length === 0) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const audioCtx = new AudioCtx();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      let isBroadcastingSpeaking = false;

      const checkVolume = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
        const average = sum / bufferLength;
        const speaking = average > 14;

        if (isSelf) {
          setIsLocalSpeaking(speaking);
          if (speaking && !isBroadcastingSpeaking && socketRef.current) {
            isBroadcastingSpeaking = true;
            socketRef.current.emit('peer-speaking', { speaking: true });
          } else if (!speaking && isBroadcastingSpeaking && socketRef.current) {
            isBroadcastingSpeaking = false;
            socketRef.current.emit('peer-speaking', { speaking: false });
          }
        } else {
          setIsRemoteSpeaking(speaking);
        }

        requestAnimationFrame(checkVolume);
      };
      checkVolume();
    } catch (e) {}
  };

  // --------------------------------------------------------------------------
  // Camera, Microphone & Screen Share Controls
  // --------------------------------------------------------------------------
  const toggleCamera = async () => {
    const tracks = localStreamRef.current ? localStreamRef.current.getVideoTracks() : [];
    if (tracks.length === 0) {
      await initLocalMedia();
      setIsCamOn(true);
      socketRef.current?.emit('media-toggle', { type: 'cam', enabled: true });
      return;
    }
    const nextState = !isCamOn;
    tracks.forEach((t) => (t.enabled = nextState));
    setIsCamOn(nextState);
    socketRef.current?.emit('media-toggle', { type: 'cam', enabled: nextState });
  };

  const toggleMicrophone = async () => {
    const tracks = localStreamRef.current ? localStreamRef.current.getAudioTracks() : [];
    if (tracks.length === 0) {
      await initLocalMedia();
      setIsMicOn(true);
      socketRef.current?.emit('media-toggle', { type: 'mic', enabled: true });
      return;
    }
    const nextState = !isMicOn;
    tracks.forEach((t) => (t.enabled = nextState));
    setIsMicOn(nextState);
    socketRef.current?.emit('media-toggle', { type: 'mic', enabled: nextState });
  };

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      stopScreenShare();
    } else {
      startScreenShare();
    }
  };

  const startScreenShare = async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      alert('Screen sharing is not supported by your browser or requires HTTPS.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always', frameRate: { max: 30 } },
        audio: true
      });
      screenStreamRef.current = stream;
      setIsScreenSharing(true);

      // Pause regular video
      pauseLocalPlayer();

      // Show locally in stage
      setStageScreenShare({ active: true, owner: 'You', isSelf: true });
      if (screenShareVideoRef.current) {
        screenShareVideoRef.current.srcObject = stream;
        screenShareVideoRef.current.muted = true; // Mute self to prevent audio echo
        screenShareVideoRef.current.play().catch(() => {});
      }

      // Add to PeerConnection
      if (peerConnectionRef.current && targetPeerIdRef.current) {
        screenSendersRef.current = [];
        stream.getTracks().forEach((track) => {
          const sender = peerConnectionRef.current.addTrack(track, stream);
          screenSendersRef.current.push(sender);
        });

        // Renegotiate
        const offer = await peerConnectionRef.current.createOffer();
        await peerConnectionRef.current.setLocalDescription(offer);
        socketRef.current?.emit('signal-offer', {
          targetId: targetPeerIdRef.current,
          offer: { type: peerConnectionRef.current.localDescription.type, sdp: peerConnectionRef.current.localDescription.sdp },
          isScreenShare: true,
          screenStreamId: stream.id
        });
      }

      socketRef.current?.emit('screen-share-status', { isSharing: true, streamId: stream.id });

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => stopScreenShare();
      }
    } catch (e) {
      console.warn('Screen share cancelled or denied:', e);
      setIsScreenSharing(false);
    }
  };

  const stopScreenShare = () => {
    setIsScreenSharing(false);
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
    if (peerConnectionRef.current && screenSendersRef.current.length > 0) {
      screenSendersRef.current.forEach((sender) => {
        try {
          peerConnectionRef.current.removeTrack(sender);
        } catch (e) {}
      });
      screenSendersRef.current = [];
    }

    setStageScreenShare({ active: false, owner: '', isSelf: false });
    if (screenShareVideoRef.current) screenShareVideoRef.current.srcObject = null;
    socketRef.current?.emit('screen-share-status', { isSharing: false });
  };

  // --------------------------------------------------------------------------
  // Synchronized Player Helpers
  // --------------------------------------------------------------------------
  const playLocalPlayer = () => {
    if (video.type === 'html5' && html5PlayerRef.current) {
      html5PlayerRef.current.play().catch(() => {});
    }
  };

  const pauseLocalPlayer = () => {
    if (video.type === 'html5' && html5PlayerRef.current) {
      html5PlayerRef.current.pause();
    }
  };

  const seekLocalPlayer = (time) => {
    if (video.type === 'html5' && html5PlayerRef.current) {
      html5PlayerRef.current.currentTime = time;
    }
  };

  const setPlayerRate = (rate) => {
    if (video.type === 'html5' && html5PlayerRef.current) {
      html5PlayerRef.current.playbackRate = rate;
    }
  };

  const getLocalPlayerTime = () => {
    if (video.type === 'html5' && html5PlayerRef.current) {
      return html5PlayerRef.current.currentTime;
    }
    return currentTime;
  };

  const handleTogglePlay = () => {
    const nextPlay = !isPlaying;
    setIsPlaying(nextPlay);
    const t = getLocalPlayerTime();

    if (nextPlay) {
      playLocalPlayer();
      socketRef.current?.emit('video-play', { time: t });
    } else {
      pauseLocalPlayer();
      socketRef.current?.emit('video-pause', { time: t });
    }
  };

  const handleSeek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    if (duration > 0) {
      const targetTime = Math.max(0, pos * duration);
      setCurrentTime(targetTime);
      seekLocalPlayer(targetTime);
      socketRef.current?.emit('video-seek', { time: targetTime });
    }
  };

  const handleRateChange = (rate) => {
    setPlaybackRate(rate);
    setPlayerRate(rate);
    socketRef.current?.emit('video-rate', { rate });
  };

  const handleForceResync = () => {
    socketRef.current?.emit('request-resync');
    if (targetPeerIdRef.current) {
      callPeer(targetPeerIdRef.current);
    }
    showToast('⚡ Synchronizing with partner...');
  };

  const handleToggleMute = () => {
    if (html5PlayerRef.current) {
      html5PlayerRef.current.muted = !isMuted;
    }
    setIsMuted(!isMuted);
  };

  const handleToggleFullscreen = () => {
    const stageEl = document.getElementById('theaterGrid') || document.querySelector('.huddle-stage-card');
    if (!stageEl) return;
    if (!document.fullscreenElement) {
      stageEl.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const handleLoadSample = (url, title) => {
    socketRef.current?.emit('video-change', { source: url, title });
    setVideo({
      type: 'html5',
      source: url,
      title: title,
      state: 'paused',
      currentTime: 0,
      playbackRate: 1.0
    });
    showToast(`🎬 Loaded: ${title}`);
  };

  const handleLoadVideoSubmit = (e) => {
    e.preventDefault();
    if (!modalVideoUrl.trim()) return;
    socketRef.current?.emit('video-change', { source: modalVideoUrl.trim() });
    setModalVideoUrl('');
    setShowVideoModal(false);
  };

  const handleLocalFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setVideo({
        type: 'html5',
        source: url,
        title: `📁 Local Video: ${file.name}`,
        state: 'paused',
        currentTime: 0,
        playbackRate: 1.0
      });
      socketRef.current?.emit('local-file-announce', { fileName: file.name, fileSize: file.size });
      showToast(`📁 Loaded "${file.name}" locally!`);
    }
  };

  // --------------------------------------------------------------------------
  // Chat & AI Assistant Helpers
  // --------------------------------------------------------------------------
  const formatAiMessage = (text) => {
    if (!text) return '';
    const lines = text.split('\n');
    return lines.map((line, lIdx) => {
      const parts = line.split(/(\*\*.*?\*\*)/g);
      const renderedParts = parts.map((part, pIdx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={pIdx} style={{ color: 'var(--mint)', fontWeight: 700 }}>
              {part.slice(2, -2)}
            </strong>
          );
        }
        return part;
      });

      return (
        <div key={lIdx} style={{ marginBottom: line.trim() ? '4px' : '6px' }}>
          {renderedParts}
        </div>
      );
    });
  };

  const handleSendMessage = () => {
    if (!chatInput.trim()) return;
    const text = chatInput.trim();
    setChatInput('');

    // Check if user is asking the AI directly via @ai
    if (text.toLowerCase().startsWith('@ai')) {
      const query = text.replace(/^@ai\s*/i, '');
      socketRef.current?.emit('chat-message', { text });
      triggerAiCatchUp(query || 'What did I miss so far?');
    } else {
      socketRef.current?.emit('chat-message', { text });
    }

    // Stop typing indicator
    socketRef.current?.emit('chat-typing', { isTyping: false });
  };

  const handleChatKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSendMessage();
    } else {
      socketRef.current?.emit('chat-typing', { isTyping: true });
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socketRef.current?.emit('chat-typing', { isTyping: false });
      }, 1500);
    }
  };

  const spawnEmoji = (emoji) => {
    const id = Date.now() + Math.random();
    const offset = Math.random() * 80 - 40;
    setFloatingEmojis((prev) => [...prev, { id, emoji, offset }]);
    setTimeout(() => {
      setFloatingEmojis((prev) => prev.filter((item) => item.id !== id));
    }, 2800);
  };

  const triggerAiCatchUp = async (userPrompt = '') => {
    setAiLoading(true);
    setAiLatecomerVisible(false);

    try {
      const res = await fetch('/api/ai/catch-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          currentTime: formatTime(currentTime),
          videoTitle: video.title,
          recentMessages: messages.slice(-15),
          prompt: userPrompt
        })
      });

      const data = await res.json();
      const summaryText = data.summary || 'Enjoy the stream together!';

      // Append AI message into chat stream
      const aiMsg = {
        id: 'ai-' + Date.now(),
        sender: '✨ Watchooo AI',
        text: summaryText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isAI: true
      };
      setMessages((prev) => [...prev, aiMsg]);
      setAiRecapModal(summaryText);
    } catch (e) {
      console.warn('AI catch up request error:', e);
      const fallbackMsg = {
        id: 'ai-' + Date.now(),
        sender: '✨ Watchooo AI',
        text: `🍿 You're watching **${video.title}** at **${formatTime(currentTime)}**! Jump right in with your friend!`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isAI: true
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setAiLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      showToast('📋 Copied to clipboard!');
    }
  };

  const shareUrl = `${window.location.origin}/room/${encodeURIComponent(roomId)}`;
  const wifiShareUrl = `http://10.81.104.163:8080/room/${encodeURIComponent(roomId)}`;

  // --------------------------------------------------------------------------
  // Render JSX
  // --------------------------------------------------------------------------
  return (
    <div className="huddle-app-layout">
      {/* Toast Notice */}
      {toastMessage && <div className="toast-notice show">{toastMessage}</div>}

      {/* Floating Emojis */}
      {floatingEmojis.map((item) => (
        <div key={item.id} className="floating-emoji" style={{ right: `${60 + item.offset}px` }}>
          {item.emoji}
        </div>
      ))}

      {/* Hidden Audio Element for Remote WebRTC Voice */}
      <audio ref={remoteAudioRef} autoPlay playsInline />

      {/* Left Navigation Sidebar */}
      <aside className="huddle-sidebar">
        <a href="/" className="sidebar-header" style={{ textDecoration: 'none' }} onClick={(e) => { e.preventDefault(); onNavigate('/'); }}>
          <img src="/images/logo.png" alt="Watchooo Logo" className="sidebar-logo-img" />
          <div>
            <div className="sidebar-brand-name">Watchooo</div>
            <div className="sidebar-brand-sub">Watch Together</div>
          </div>
        </a>

        {/* Sidebar Navigation */}
        <div className="sidebar-nav-section">
          <ul className="sidebar-menu-list">
            <li className="sidebar-menu-item active">
              <div className="menu-item-left">
                <i className="fa-solid fa-table-cells-large"></i>
                <span>Theater Mode</span>
              </div>
            </li>

            <li className="sidebar-menu-item" onClick={() => copyToClipboard(shareUrl)}>
              <div className="menu-item-left">
                <i className="fa-regular fa-paper-plane"></i>
                <span>Copy Invite</span>
              </div>
            </li>

            <li className="sidebar-menu-item" onClick={() => setShowVideoModal(true)}>
              <div className="menu-item-left">
                <i className="fa-solid fa-link"></i>
                <span>Load Direct Link</span>
              </div>
            </li>

            <li className="sidebar-menu-item" onClick={toggleScreenShare}>
              <div className="menu-item-left">
                <i className="fa-solid fa-display"></i>
                <span>Screen Share</span>
              </div>
            </li>

            <li className="sidebar-menu-item" onClick={() => fileInputRef.current?.click()}>
              <div className="menu-item-left">
                <i className="fa-regular fa-folder-open"></i>
                <span>Local MP4 File</span>
              </div>
            </li>

            <li className="sidebar-menu-item" onClick={() => triggerAiCatchUp('Give me a full recap of current video and room conversation')}>
              <div className="menu-item-left" style={{ color: 'var(--mint)' }}>
                <i className="fa-solid fa-wand-magic-sparkles"></i>
                <span>AI Catch Up</span>
              </div>
            </li>
          </ul>
        </div>

        {/* Sidebar Room Info */}
        <div style={{ marginTop: 'auto', padding: '16px 8px', borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Room Code
          </div>
          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '4px' }}>
            {roomId}
          </div>
          <button type="button" onClick={() => setShowShareModal(true)} className="btn-glass-pill" style={{ width: '100%', marginTop: '10px', fontSize: '0.78rem', padding: '6px 12px' }}>
            <i className="fa-solid fa-share-nodes" style={{ marginRight: '6px' }}></i> Share Invite
          </button>
        </div>
      </aside>

      {/* Main Grid Viewport */}
      <main className="huddle-viewport">
        {/* Top Header Bar */}
        <header className="huddle-top-header">
          <div className="header-left-meta">
            <div className="header-theater-badge">
              <i className="fa-solid fa-clapperboard"></i>
            </div>
            <div className="header-titles-box">
              <h1 className="huddle-room-title" title={stageScreenShare.active ? `${stageScreenShare.owner}'s Screen Share` : video.title || 'Ready for Video'}>
                {stageScreenShare.active
                  ? `🖥️ ${stageScreenShare.owner}'s Screen Share`
                  : video.title || 'Watchooo Theater Stage'}
              </h1>
              <div className="header-sub-badges">
                <div className={`huddle-status-pill ${isPlaying ? 'live' : 'paused'}`}>
                  <span className="status-dot"></span>
                  <span>{isPlaying ? 'Live In-Sync' : 'Paused'}</span>
                </div>
                <button
                  type="button"
                  className="room-code-tag-pill"
                  onClick={() => copyToClipboard(roomId)}
                  title="Click to copy Room Code"
                >
                  <i className="fa-solid fa-key"></i> {roomId}
                </button>
              </div>
            </div>
          </div>

          <div className="header-right-actions">
            <button
              type="button"
              className="btn-glass-pill btn-ai-sparkle-pill"
              onClick={() => triggerAiCatchUp('Catch me up on what is happening right now')}
              title="Watchooo AI Co-Pilot Catch Up"
            >
              <i className="fa-solid fa-wand-magic-sparkles"></i>
              <span>{aiLoading ? 'Thinking...' : 'AI Catch Up'}</span>
            </button>

            <button
              type="button"
              className="btn-glass-pill"
              onClick={() => setShowVideoModal(true)}
              title="Load YouTube URL or MP4 direct link"
            >
              <i className="fa-solid fa-link"></i>
              <span>Load Link</span>
            </button>

            <button
              type="button"
              className={`btn-glass-pill ${isScreenSharing ? 'active-accent' : ''}`}
              onClick={toggleScreenShare}
              title="Share your screen to the theater stage"
            >
              <i className="fa-solid fa-desktop"></i>
              <span>{isScreenSharing ? 'Sharing' : 'Share Screen'}</span>
            </button>

            <button
              type="button"
              className="btn-glass-pill"
              onClick={handleForceResync}
              title="Force resync video and audio connection"
            >
              <i className="fa-solid fa-rotate"></i>
              <span>Resync</span>
            </button>

            <button type="button" className="btn-mint-pill" onClick={() => setShowShareModal(true)}>
              <i className="fa-solid fa-user-plus"></i>
              <span>Invite</span>
            </button>
          </div>
        </header>

        {/* 2-Column Main Layout: Big Video Theater + Small User Profiles & Chat */}
        <div className={`huddle-grid-container ${isCinemaMode ? 'cinema-active' : ''}`} id="theaterGrid">
          
          {/* BIG WINDOW: Main Video Stage */}
          <div className="huddle-stage-card">
            
            {/* Screen Share Stage Player */}
            {stageScreenShare.active ? (
              <div className="screen-share-stage-wrapper">
                <video ref={screenShareVideoRef} className="screen-share-video-player" autoPlay playsInline />
                <div className="screen-share-banner">
                  <span>🖥️ {stageScreenShare.owner}'s Screen Share Active</span>
                  {stageScreenShare.isSelf && (
                    <button type="button" onClick={stopScreenShare} className="btn-danger-pill" style={{ marginLeft: '12px', padding: '4px 10px', fontSize: '0.75rem' }}>
                      Stop Sharing
                    </button>
                  )}
                </div>
              </div>
            ) : video.source ? (
              <div className="video-player-wrapper" style={{ width: '100%', height: '100%', position: 'relative' }}>
                {video.type === 'youtube' ? (
                  <iframe
                    className="youtube-embed-player"
                    src={`https://www.youtube.com/embed/${video.source}?enablejsapi=1&autoplay=1&playsinline=1`}
                    title="YouTube video player"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    style={{ width: '100%', height: '100%', border: 'none' }}
                  ></iframe>
                ) : (
                  <video
                    ref={html5PlayerRef}
                    src={video.source}
                    className="html5-video-player"
                    playsInline
                    onTimeUpdate={(e) => setCurrentTime(e.target.currentTime)}
                    onDurationChange={(e) => setDuration(e.target.duration)}
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                )}
              </div>
            ) : (
              <div className="stage-empty-state">
                <div className="empty-state-visual-ring">
                  <div className="empty-state-icon">
                    <i className="fa-solid fa-clapperboard"></i>
                  </div>
                </div>
                <h3 className="empty-state-title">Welcome to Watchooo Theater</h3>
                <p className="empty-state-desc">
                  Enjoy synchronized movie streaming, crystal clear WebRTC video calling, and an AI assistant to catch you up anytime!
                </p>
                <div className="empty-state-actions">
                  <button type="button" onClick={() => setShowVideoModal(true)} className="btn-mint-pill empty-btn">
                    <i className="fa-solid fa-link"></i> Load Video Link
                  </button>
                  <button type="button" onClick={toggleScreenShare} className="btn-glass-pill empty-btn">
                    <i className="fa-solid fa-desktop"></i> Share Screen
                  </button>
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="btn-glass-pill empty-btn">
                    <i className="fa-solid fa-folder-open"></i> Local MP4
                  </button>
                </div>
                <div className="empty-state-samples">
                  <span className="samples-label">Quick Test Streams:</span>
                  <button
                    type="button"
                    className="sample-chip"
                    onClick={() => handleLoadSample('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', 'Big Buck Bunny (4K Animation)')}
                  >
                    🐰 Big Buck Bunny
                  </button>
                  <button
                    type="button"
                    className="sample-chip"
                    onClick={() => handleLoadSample('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4', 'Tears of Steel (Sci-Fi Short)')}
                  >
                    🚀 Tears of Steel
                  </button>
                </div>
              </div>
            )}

            {/* Stage Floating Action Dock - ONLY shown when media is active */}
            {(video.source || stageScreenShare.active || duration > 0) && (
              <div className="stage-overlay-bottom">
                <div className="stage-overlay-header-row">
                  <div className="stage-badge-pill" title={video.title}>
                    <i className="fa-solid fa-circle-play" style={{ color: 'var(--mint)' }}></i>
                    <span>{video.title || 'Synchronized Stage'}</span>
                  </div>
                  <div className="stage-overlay-quick-tools">
                    <button
                      type="button"
                      className="stage-tool-btn"
                      onClick={handleToggleMute}
                      title={isMuted ? 'Unmute Player' : 'Mute Player'}
                    >
                      <i className={`fa-solid ${isMuted ? 'fa-volume-xmark' : 'fa-volume-high'}`}></i>
                    </button>
                    <button
                      type="button"
                      className="stage-tool-btn"
                      onClick={handleToggleFullscreen}
                      title="Fullscreen Theater"
                    >
                      <i className="fa-solid fa-expand"></i>
                    </button>
                    <button
                      type="button"
                      className={`stage-tool-btn ${isCinemaMode ? 'active' : ''}`}
                      onClick={() => setIsCinemaMode((prev) => !prev)}
                      title="Cinema Mode (Toggle Side Panel)"
                    >
                      <i className="fa-solid fa-arrows-to-eye"></i>
                    </button>
                  </div>
                </div>

                {/* Scrubber Timeline Bar */}
                <div className="custom-scrubber-row">
                  <button type="button" onClick={handleTogglePlay} className="btn-scrub-play" title={isPlaying ? 'Pause' : 'Play'}>
                    <i className={`fa-solid ${isPlaying ? 'fa-pause' : 'fa-play'}`}></i>
                  </button>
                  <div className="scrubber-track" onClick={handleSeek}>
                    <div
                      className="scrubber-fill"
                      style={{ width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%' }}
                    ></div>
                  </div>
                  <div className="scrubber-time-badge">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </div>
                  <select
                    value={playbackRate}
                    onChange={(e) => handleRateChange(parseFloat(e.target.value))}
                    className="speed-dropdown-clean"
                    title="Playback Speed"
                  >
                    <option value="0.5">0.5x</option>
                    <option value="0.75">0.75x</option>
                    <option value="1">1.0x</option>
                    <option value="1.25">1.25x</option>
                    <option value="1.5">1.5x</option>
                    <option value="2">2.0x</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* DEDICATED SIDE COLUMN: 2 Webcams + Controls + Live Chat */}
          <div className="huddle-side-column">
            
            {/* 2-Cam Video Grid: Side-by-Side Webcam Tiles */}
            <div className="huddle-webcams-grid">
              {/* Small Window 1: Remote Friend Webcam */}
              <div className={`huddle-video-card huddle-profile-small-card ${isRemoteSpeaking ? 'speaking' : ''}`}>
                <div className="card-dots-badge" title="Speaking Activity">
                  <span className="speaking-dot d1"></span>
                  <span className="speaking-dot d2"></span>
                  <span className="speaking-dot d3"></span>
                </div>

                {/* Video Element for Remote Peer Face */}
                <video
                  ref={remoteVideoRef}
                  className="huddle-stream-video"
                  autoPlay
                  muted
                  playsInline
                />

                {/* Illustrated Center Avatar Placeholder */}
                <div className={`tile-avatar-placeholder ${!remoteCamActive || !remotePeerConnected ? 'show' : ''}`}>
                  <div className="huddle-center-avatar lavender">
                    <i className="fa-solid fa-user-astronaut"></i>
                  </div>
                  <div className="tile-placeholder-text">
                    {!remotePeerConnected ? 'Waiting...' : 'Camera Off'}
                  </div>
                </div>

                {/* Friend Profile Badge */}
                <div className="pastel-name-pill peach small-badge">
                  <i className={`fa-solid ${remoteMicActive ? 'fa-microphone' : 'fa-microphone-slash muted'}`}></i>
                  <span>{remotePeerName}</span>
                </div>
              </div>

              {/* Small Window 2: Local User Webcam (You) */}
              <div className={`huddle-video-card huddle-profile-small-card ${isLocalSpeaking ? 'speaking' : ''}`}>
                <div className="card-dots-badge" title="Speaking Activity">
                  <span className="speaking-dot d1"></span>
                  <span className="speaking-dot d2"></span>
                  <span className="speaking-dot d3"></span>
                </div>

                {/* Video Element for Local Face Selfie */}
                <video
                  ref={localVideoRef}
                  className="huddle-stream-video local-selfie-cam"
                  autoPlay
                  muted
                  playsInline
                />

                {/* Local Avatar Placeholder when Cam is Off */}
                <div className={`tile-avatar-placeholder ${!isCamOn ? 'show' : ''}`}>
                  <div className="huddle-center-avatar mint">
                    <i className="fa-solid fa-user"></i>
                  </div>
                  <div className="tile-placeholder-text">Camera Off</div>
                </div>

                {/* Local User Badge */}
                <div className="pastel-name-pill coral small-badge">
                  <i className={`fa-solid ${isMicOn ? 'fa-microphone' : 'fa-microphone-slash muted'}`}></i>
                  <span>{userName} (You)</span>
                </div>
              </div>
            </div>

            {/* Call Controls Dock */}
            <div className="small-call-controls-bar">
              <button
                type="button"
                onClick={toggleMicrophone}
                className={`control-circle-btn ${!isMicOn ? 'active-danger' : 'active-mic'}`}
                title={isMicOn ? 'Mute Microphone' : 'Unmute Microphone'}
              >
                <i className={`fa-solid ${isMicOn ? 'fa-microphone' : 'fa-microphone-slash'}`}></i>
              </button>

              <button
                type="button"
                onClick={toggleCamera}
                className={`control-circle-btn ${!isCamOn ? 'active-danger' : 'active-cam'}`}
                title={isCamOn ? 'Turn Camera Off' : 'Turn Camera On'}
              >
                <i className={`fa-solid ${isCamOn ? 'fa-video' : 'fa-video-slash'}`}></i>
              </button>

              <button
                type="button"
                onClick={toggleScreenShare}
                className={`control-circle-btn ${isScreenSharing ? 'active-accent' : ''}`}
                title="Share Screen to Stage"
              >
                <i className="fa-solid fa-desktop"></i>
              </button>

              <button
                type="button"
                onClick={handleForceResync}
                className="control-circle-btn"
                title="Force Resync"
              >
                <i className="fa-solid fa-rotate"></i>
              </button>

              <button
                type="button"
                onClick={() => setIsCinemaMode((prev) => !prev)}
                className={`control-circle-btn ${isCinemaMode ? 'active-mint' : ''}`}
                title="Toggle Cinema Mode"
              >
                <i className={`fa-solid ${isCinemaMode ? 'fa-compress' : 'fa-expand'}`}></i>
              </button>
            </div>

            {/* Live In-Room Chat & AI Co-Pilot */}
            <div className="huddle-chat-inline-card">
              {/* Chat Header */}
              <div className="chat-inline-header">
                <div className="chat-header-left">
                  <div className="chat-header-badge-icon">
                    <i className="fa-solid fa-comments"></i>
                  </div>
                  <span className="chat-title-text">ROOM CHAT</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => triggerAiCatchUp('Catch me up on what is happening right now')}
                    className="btn-ai-catchup-pill"
                    title="Watchooo AI Co-Pilot: Instant Scene & Chat Recap"
                  >
                    <i className="fa-solid fa-wand-magic-sparkles"></i> Catch Up
                  </button>
                  <div className="chat-live-badge">
                    <span className="chat-live-dot"></span>
                    <span>Live</span>
                  </div>
                </div>
              </div>

              {/* Latecomer AI Banner */}
              {aiLatecomerVisible && (
                <div className="ai-latecomer-banner">
                  <div className="ai-banner-content">
                    <div className="ai-banner-title">
                      <i className="fa-solid fa-sparkles"></i> <strong>Joined late?</strong> Let AI catch you up!
                    </div>
                    <div className="ai-banner-sub">Recap of scene timestamp ({formatTime(currentTime)}) &amp; party chat.</div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      className="btn-ai-recap-now"
                      onClick={() => triggerAiCatchUp('Joined late, give me a full recap')}
                    >
                      ✨ Catch Me Up
                    </button>
                    <button
                      type="button"
                      className="btn-ai-banner-close"
                      onClick={() => setAiLatecomerVisible(false)}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}

              {/* Messages Stream */}
              <div className="chat-inline-messages">
                {messages.length === 0 ? (
                  <div className="chat-empty-state">
                    <div className="chat-empty-icon">
                      <i className="fa-regular fa-comments"></i>
                    </div>
                    <p className="chat-empty-title">Start the conversation</p>
                    <p className="chat-empty-sub">
                      Say hello or type <span className="ai-highlight-pill">@ai</span> to ask the co-pilot!
                    </p>
                  </div>
                ) : (
                  messages.map((m, idx) => {
                    const isSelf = m.sender === userName;
                    if (m.isSystem) {
                      return (
                        <div key={idx} className="message-item system">
                          <div className="msg-bubble">{m.text}</div>
                        </div>
                      );
                    }
                    if (m.isAI) {
                      return (
                        <div key={idx} className="message-item ai-message-bubble">
                          <div className="ai-msg-badge">
                            <i className="fa-solid fa-wand-magic-sparkles"></i> Watchooo AI Co-Pilot
                          </div>
                          <div className="msg-bubble ai-bubble">{formatAiMessage(m.text)}</div>
                        </div>
                      );
                    }
                    return (
                      <div key={idx} className={`message-item ${isSelf ? 'sent' : 'received'}`}>
                        <div className="msg-meta">
                          <span className="msg-sender-name">
                            {!isSelf && <i className="fa-solid fa-circle-user" style={{ marginRight: '3px' }}></i>}
                            {isSelf ? 'You' : m.sender}
                          </span>
                          <span className="msg-time">{m.time}</span>
                        </div>
                        <div className="msg-bubble">{m.text}</div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Typing indicator */}
              {typingText && (
                <div className="typing-indicator">
                  <i className="fa-solid fa-pen-nib"></i> {typingText}
                </div>
              )}

              {/* Emoji reactions bar */}
              <div className="chat-inline-emoji-bar">
                {['❤️', '🔥', '😂', '🍿', '👏', '🚀'].map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="btn-emoji"
                    onClick={() => {
                      socketRef.current?.emit('reaction-burst', { emoji });
                      spawnEmoji(emoji);
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              {/* Chat Input */}
              <div className="chat-inline-input-wrapper">
                <input
                  type="text"
                  className="clean-input-box chat-inline-input"
                  placeholder="Type a message or @ai to ask assistant..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={handleChatKeyDown}
                  autoComplete="off"
                />
                <button type="button" onClick={handleSendMessage} className="btn-mint-pill chat-inline-send-btn" title="Send message">
                  <i className="fa-solid fa-paper-plane"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Hidden local file input */}
      <input
        type="file"
        ref={fileInputRef}
        accept="video/mp4,video/webm,video/ogg,video/mkv"
        style={{ display: 'none' }}
        onChange={handleLocalFileSelect}
      />

      {/* Direct Video URL Modal */}
      {showVideoModal && (
        <div className="modal-backdrop open">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3 className="modal-title">Load Direct Video</h3>
              <button type="button" className="btn-close-drawer" onClick={() => setShowVideoModal(false)}>
                ✕
              </button>
            </div>
            <form onSubmit={handleLoadVideoSubmit}>
              <label className="input-label-clean" htmlFor="modalUrlInput">Video URL (YouTube or Direct MP4 / Web Stream)</label>
              <input
                type="text"
                id="modalUrlInput"
                className="clean-input-box"
                placeholder="https://www.youtube.com/watch?v=... or direct MP4 URL"
                value={modalVideoUrl}
                onChange={(e) => setModalVideoUrl(e.target.value)}
                required
              />
              <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', margin: '6px 0 16px' }}>
                Both participants will instantly switch to this video in lockstep synchronization.
              </p>
              <button type="submit" className="btn-mint-pill" style={{ width: '100%', padding: '12px' }}>
                <span>↗ Load &amp; Sync with Partner</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Share / Invite Modal */}
      {showShareModal && (
        <div className="modal-backdrop open">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3 className="modal-title">Invite a Friend</h3>
              <button type="button" className="btn-close-drawer" onClick={() => setShowShareModal(false)}>
                ✕
              </button>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
              Send this link to your partner so they can join this room instantly.
            </p>

            <label className="input-label-clean">Direct Invite Link</label>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <input type="text" readOnly value={shareUrl} className="clean-input-box" />
              <button type="button" onClick={() => copyToClipboard(shareUrl)} className="btn-mint-pill" style={{ padding: '0 16px' }}>
                Copy
              </button>
            </div>

            <label className="input-label-clean">Wi-Fi / LAN Link (For Phones on Same Wi-Fi)</label>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <input type="text" readOnly value={wifiShareUrl} className="clean-input-box" />
              <button type="button" onClick={() => copyToClipboard(wifiShareUrl)} className="btn-glass-pill" style={{ padding: '0 16px' }}>
                Copy
              </button>
            </div>

            <div style={{ textAlign: 'center', marginTop: '10px' }}>
              <button type="button" onClick={() => copyToClipboard(roomId)} className="btn-text-action">
                📋 Copy Room Code Only ({roomId})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Recap Popup Modal */}
      {aiRecapModal && (
        <div className="modal-backdrop open">
          <div className="modal-dialog" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--mint)' }}>
                <i className="fa-solid fa-wand-magic-sparkles"></i> Watchooo AI Catch-Up
              </h3>
              <button type="button" className="btn-close-drawer" onClick={() => setAiRecapModal(null)}>
                ✕
              </button>
            </div>
            <div style={{ fontSize: '0.92rem', color: 'var(--text-main)', lineHeight: '1.6', margin: '14px 0', whiteSpace: 'pre-wrap' }}>
              {aiRecapModal}
            </div>
            <button type="button" onClick={() => setAiRecapModal(null)} className="btn-mint-pill" style={{ width: '100%', padding: '10px' }}>
              Got It, Enjoy Watching!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
