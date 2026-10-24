require("dotenv").config();

const express = require("express");
const http = require("http");
const path = require("path");
const os = require("os");
const { Server } = require("socket.io");
const methodOverride = require("method-override");
const engine = require("ejs-mate");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const port = process.env.PORT || 8080;

function getLocalIpAddress() {
  try {
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        if (net.family === "IPv4" && !net.internal) {
          return net.address;
        }
      }
    }
  } catch (e) {}
  return "localhost";
}

// Curated Web Series with multiple episodes ready to watch together!
const WEB_SERIES = [
  {
    id: "scifi-series",
    title: "Cyberpunk 2099: The Sci-Fi Web Series",
    banner: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&q=80",
    badge: "3 Episodes • Sci-Fi",
    description: "Futuristic visual effects, cyborg thrillers, and cinematic action.",
    episodes: [
      {
        ep: 1,
        title: "Ep 1: Tears of Steel (The Awakening)",
        type: "html5",
        source: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
        duration: "12:14"
      },
      {
        ep: 2,
        title: "Ep 2: The Spark (Action Chase)",
        type: "html5",
        source: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
        duration: "00:15"
      },
      {
        ep: 3,
        title: "Ep 3: Elephants Dream (Machine Core)",
        type: "html5",
        source: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
        duration: "10:54"
      }
    ]
  },
  {
    id: "animated-series",
    title: "Big Buck Universe: Animated Series",
    banner: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600&q=80",
    badge: "2 Episodes • Animation",
    description: "Hilarious adventures of giant bunnies and woodland creatures.",
    episodes: [
      {
        ep: 1,
        title: "Ep 1: The Forest Rebellion",
        type: "html5",
        source: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
        duration: "09:56"
      },
      {
        ep: 2,
        title: "Ep 2: Escape to the Valley",
        type: "html5",
        source: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
        duration: "00:15"
      }
    ]
  },
  {
    id: "nature-series",
    title: "Our Planet: 4K Nature Series (YouTube)",
    banner: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=600&q=80",
    badge: "2 Episodes • 4K HDR",
    description: "Breathtaking landscapes, deep mountain forests, and wild rivers.",
    episodes: [
      {
        ep: 1,
        title: "Ep 1: Untamed Wilderness 4K",
        type: "youtube",
        source: "1ZYbU888YX8",
        duration: "15:00"
      },
      {
        ep: 2,
        title: "Ep 2: Oceans & Coral Reefs 4K",
        type: "youtube",
        source: "7mP_336rO_k",
        duration: "12:00"
      }
    ]
  },
  {
    id: "lofi-series",
    title: "Late Night Lo-Fi Sessions (YouTube)",
    banner: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&q=80",
    badge: "2 Episodes • Music & Chill",
    description: "Soothing beats to relax, study, talk, and vibe together.",
    episodes: [
      {
        ep: 1,
        title: "Ep 1: Cozy Rain & Midnight Coffee",
        type: "youtube",
        source: "jfKfPfyJRdk",
        duration: "Live"
      },
      {
        ep: 2,
        title: "Ep 2: Synthwave Cyber Lounge",
        type: "youtube",
        source: "4xDzrJKXOOY",
        duration: "Live"
      }
    ]
  }
];

// Single Sample Videos list
const SAMPLE_VIDEOS = [
  {
    title: "Big Buck Bunny (HD Animation)",
    type: "html5",
    source: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    badge: "MP4 • 1080p",
    thumbnail: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=400&q=80"
  },
  {
    title: "Tears of Steel (Sci-Fi Demo)",
    type: "html5",
    source: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
    badge: "MP4 • Sci-Fi",
    thumbnail: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&q=80"
  },
  {
    title: "For Bigger Blazes (Action 4K)",
    type: "html5",
    source: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    badge: "MP4 • Action",
    thumbnail: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=400&q=80"
  },
  {
    title: "Lofi Hip Hop - Chill Beats",
    type: "youtube",
    source: "jfKfPfyJRdk",
    badge: "YouTube • Music",
    thumbnail: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&q=80"
  },
  {
    title: "Nature 4K Relaxation",
    type: "youtube",
    source: "1ZYbU888YX8",
    badge: "YouTube • 4K HDR",
    thumbnail: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=400&q=80"
  }
];

function parseVideoSource(input) {
  if (!input || typeof input !== "string") {
    return SAMPLE_VIDEOS[0];
  }
  input = input.trim();

  // YouTube URL or ID match
  const ytMatch = input.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|v\/|shorts\/))([a-zA-Z0-9_-]{11})/i
  );
  if (ytMatch && ytMatch[1]) {
    return {
      type: "youtube",
      source: ytMatch[1],
      title: "YouTube Video (" + ytMatch[1] + ")"
    };
  }

  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) {
    return {
      type: "youtube",
      source: input,
      title: "YouTube Video (" + input + ")"
    };
  }

  // Check if direct video file or arbitrary web video
  if (
    input.match(/\.(mp4|webm|ogv|mov|m4v)(\?.*)?$/i) ||
    input.startsWith("http://") ||
    input.startsWith("https://")
  ) {
    const filename = input.split("/").pop().split("?")[0] || "Custom Stream";
    return {
      type: "html5",
      source: input,
      title: filename
    };
  }

  // Default fallback
  return SAMPLE_VIDEOS[0];
}

// In-Memory Room State Store
const rooms = new Map();

function getOrCreateRoom(roomId) {
  roomId = (roomId || "default-room").toLowerCase().trim();
  if (!rooms.has(roomId)) {
    const initialSeries = WEB_SERIES[0];
    const initialEp = initialSeries.episodes[0];

    const room = {
      id: roomId,
      users: new Map(), // socketId -> { id, name, isHost, cam: true, mic: true }
      currentSeries: initialSeries,
      playlist: [...initialSeries.episodes],
      currentEpisodeIndex: 0,
      video: {
        type: initialEp.type,
        source: initialEp.source,
        title: initialEp.title,
        state: "paused", // 'playing' | 'paused'
        currentTime: 0,
        lastUpdated: Date.now(),
        playbackRate: 1.0
      },
      messages: [],
      heartbeatTimer: null
    };

    // Periodic synchronization heartbeat to eliminate drift
    room.heartbeatTimer = setInterval(() => {
      if (room.users.size > 0 && room.video.state === "playing") {
        const calculatedTime = getRoomCurrentTime(room);
        io.to(roomId).emit("sync-heartbeat", {
          currentTime: calculatedTime,
          state: room.video.state,
          playbackRate: room.video.playbackRate,
          serverTime: Date.now()
        });
      }
    }, 3500);

    rooms.set(roomId, room);
  }
  return rooms.get(roomId);
}

function getRoomCurrentTime(room) {
  if (room.video.state === "playing") {
    const elapsed = (Date.now() - room.video.lastUpdated) / 1000;
    return Math.max(0, room.video.currentTime + elapsed * room.video.playbackRate);
  }
  return room.video.currentTime;
}

// Express Configuration
app.engine("ejs", engine);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride("_method"));

// Routes
// 1. Landing / Lobby page
app.get("/", (req, res) => {
  res.render("lobby.ejs", { sampleVideos: SAMPLE_VIDEOS, webSeries: WEB_SERIES });
});

// Backward compatibility for /video & /home
app.get("/video", (req, res) => {
  res.redirect("/");
});

app.get("/home", (req, res) => {
  res.redirect("/");
});

// Form submission from lobby or quick start
app.post("/video", (req, res) => {
  const link = req.body.videoLink;
  const name = (req.body.displayName || "User").trim();
  let roomId = (req.body.roomId || "").trim().toLowerCase();

  // If user pasted a full URL or room path into roomId input, extract clean room code:
  if (roomId.includes("/room/")) {
    const parts = roomId.split("/room/");
    roomId = parts[1].split("?")[0].split("#")[0].trim();
  }
  roomId = roomId.replace(/^[/]+/, "").split("?")[0].split("#")[0].trim();

  if (!roomId) {
    roomId = "watch-" + Math.random().toString(36).substring(2, 8);
  }

  const room = getOrCreateRoom(roomId);

  if (link && link.trim().length > 0) {
    const parsed = parseVideoSource(link);
    room.video.type = parsed.type;
    room.video.source = parsed.source;
    room.video.title = parsed.title;
    room.video.currentTime = 0;
    room.video.state = "paused";
    room.video.lastUpdated = Date.now();
  }

  res.redirect(`/room/${encodeURIComponent(roomId)}?name=${encodeURIComponent(name)}`);
});

// 2. Direct Watch Together Room page
app.get("/room/:roomId", (req, res) => {
  let roomId = (req.params.roomId || "default-room").toLowerCase().trim();
  if (roomId.includes("/room/")) {
    roomId = roomId.split("/room/")[1].split("?")[0].trim();
  }
  roomId = roomId.split("?")[0].split("#")[0].trim();

  const userName = (req.query.name || "").trim();
  const room = getOrCreateRoom(roomId);

  res.render("room.ejs", {
    roomId,
    initialUserName: userName,
    video: room.video,
    sampleVideos: SAMPLE_VIDEOS,
    webSeries: WEB_SERIES,
    playlist: room.playlist,
    currentEpisodeIndex: room.currentEpisodeIndex,
    networkIp: getLocalIpAddress(),
    serverPort: port
  });
});

// API endpoints
app.get("/api/samples", (req, res) => {
  res.json(SAMPLE_VIDEOS);
});

app.get("/api/series", (req, res) => {
  res.json(WEB_SERIES);
});

// Socket.IO Real-time Synchronization & WebRTC Signaling
io.on("connection", (socket) => {
  let currentRoomId = null;
  let currentUserName = "Anonymous";

  // Join Room
  socket.on("join-room", ({ roomId, userName }) => {
    roomId = (roomId || "default-room").toLowerCase().trim();
    userName = (userName || "User").trim();

    socket.join(roomId);
    currentRoomId = roomId;
    currentUserName = userName;

    const room = getOrCreateRoom(roomId);
    const isHost = room.users.size === 0;

    const userObj = {
      id: socket.id,
      name: userName,
      isHost,
      cam: true,
      mic: true
    };
    room.users.set(socket.id, userObj);

    // Prepare list of existing participants in room
    const userList = Array.from(room.users.values());

    // Send full current room state to joining client
    socket.emit("room-init", {
      roomId,
      yourId: socket.id,
      isHost,
      users: userList,
      playlist: room.playlist,
      currentEpisodeIndex: room.currentEpisodeIndex,
      currentSeries: room.currentSeries,
      webSeries: WEB_SERIES,
      video: {
        type: room.video.type,
        source: room.video.source,
        title: room.video.title,
        state: room.video.state,
        currentTime: getRoomCurrentTime(room),
        playbackRate: room.video.playbackRate,
        serverTime: Date.now()
      },
      messages: room.messages.slice(-50)
    });

    // Notify other peers in the room
    socket.to(roomId).emit("user-joined", {
      user: userObj,
      userCount: room.users.size
    });

    // If 2 or more users are present, trigger WebRTC call initiation
    if (room.users.size >= 2) {
      const otherPeers = Array.from(room.users.keys()).filter((id) => id !== socket.id);
      if (otherPeers.length > 0) {
        socket.emit("initiate-call", { peerId: otherPeers[0] });
        io.to(otherPeers[0]).emit("peer-ready-to-call", { peerId: socket.id, peerName: userName });
      }
    }

    // System announcement message in chat
    const joinMsg = {
      id: "sys-" + Date.now(),
      sender: "System",
      text: `${userName} joined the room`,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      isSystem: true
    };
    room.messages.push(joinMsg);
    io.to(roomId).emit("chat-message", joinMsg);
  });

  // ==========================================
  // Video Synchronization Handlers (Zero-Drift)
  // ==========================================

  socket.on("video-play", ({ time }) => {
    if (!currentRoomId) return;
    const room = getOrCreateRoom(currentRoomId);

    room.video.state = "playing";
    room.video.currentTime = Math.max(0, Number(time) || 0);
    room.video.lastUpdated = Date.now();

    socket.to(currentRoomId).emit("video-play", {
      time: room.video.currentTime,
      playbackRate: room.video.playbackRate,
      serverTime: Date.now(),
      sender: currentUserName,
      senderId: socket.id
    });
  });

  socket.on("video-pause", ({ time }) => {
    if (!currentRoomId) return;
    const room = getOrCreateRoom(currentRoomId);

    room.video.state = "paused";
    room.video.currentTime = Math.max(0, Number(time) || 0);
    room.video.lastUpdated = Date.now();

    socket.to(currentRoomId).emit("video-pause", {
      time: room.video.currentTime,
      sender: currentUserName,
      senderId: socket.id
    });
  });

  socket.on("video-seek", ({ time }) => {
    if (!currentRoomId) return;
    const room = getOrCreateRoom(currentRoomId);

    room.video.currentTime = Math.max(0, Number(time) || 0);
    room.video.lastUpdated = Date.now();

    socket.to(currentRoomId).emit("video-seek", {
      time: room.video.currentTime,
      state: room.video.state,
      serverTime: Date.now(),
      sender: currentUserName,
      senderId: socket.id
    });
  });

  socket.on("video-rate", ({ rate }) => {
    if (!currentRoomId) return;
    const room = getOrCreateRoom(currentRoomId);

    const safeRate = Math.min(2.0, Math.max(0.25, Number(rate) || 1.0));
    room.video.currentTime = getRoomCurrentTime(room);
    room.video.lastUpdated = Date.now();
    room.video.playbackRate = safeRate;

    socket.to(currentRoomId).emit("video-rate", {
      rate: safeRate,
      time: room.video.currentTime,
      serverTime: Date.now(),
      sender: currentUserName
    });
  });

  socket.on("video-change", (payload) => {
    if (!currentRoomId) return;
    const room = getOrCreateRoom(currentRoomId);

    const parsed = parseVideoSource(payload.source || payload.url || payload.videoId);
    room.video.type = parsed.type;
    room.video.source = parsed.source;
    room.video.title = payload.title || parsed.title;
    room.video.currentTime = 0;
    room.video.state = "paused";
    room.video.lastUpdated = Date.now();

    io.to(currentRoomId).emit("video-change", {
      video: {
        type: room.video.type,
        source: room.video.source,
        title: room.video.title,
        state: room.video.state,
        currentTime: 0,
        playbackRate: room.video.playbackRate,
        serverTime: Date.now()
      },
      sender: currentUserName
    });

    const changeMsg = {
      id: "sys-" + Date.now(),
      sender: "System",
      text: `${currentUserName} loaded "${room.video.title}"`,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      isSystem: true
    };
    room.messages.push(changeMsg);
    io.to(currentRoomId).emit("chat-message", changeMsg);
  });

  // ==========================================
  // Web Series & Episodes Handlers
  // ==========================================

  // Select an episode in the active series
  socket.on("episode-select", ({ index }) => {
    if (!currentRoomId) return;
    const room = getOrCreateRoom(currentRoomId);

    if (room.playlist && room.playlist[index]) {
      room.currentEpisodeIndex = index;
      const ep = room.playlist[index];

      room.video.type = ep.type;
      room.video.source = ep.source;
      room.video.title = ep.title;
      room.video.currentTime = 0;
      room.video.state = "paused";
      room.video.lastUpdated = Date.now();

      io.to(currentRoomId).emit("episode-change", {
        index,
        video: {
          type: room.video.type,
          source: room.video.source,
          title: room.video.title,
          state: room.video.state,
          currentTime: 0,
          playbackRate: room.video.playbackRate,
          serverTime: Date.now()
        },
        sender: currentUserName
      });

      const epMsg = {
        id: "sys-" + Date.now(),
        sender: "System",
        text: `🎬 ${currentUserName} selected "${ep.title}"`,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        isSystem: true
      };
      room.messages.push(epMsg);
      io.to(currentRoomId).emit("chat-message", epMsg);
    }
  });

  // Next Episode
  socket.on("episode-next", () => {
    if (!currentRoomId) return;
    const room = getOrCreateRoom(currentRoomId);
    const nextIdx = (room.currentEpisodeIndex || 0) + 1;

    if (room.playlist && nextIdx < room.playlist.length) {
      room.currentEpisodeIndex = nextIdx;
      const ep = room.playlist[nextIdx];

      room.video.type = ep.type;
      room.video.source = ep.source;
      room.video.title = ep.title;
      room.video.currentTime = 0;
      room.video.state = "playing"; // Auto-play next episode
      room.video.lastUpdated = Date.now();

      io.to(currentRoomId).emit("episode-change", {
        index: nextIdx,
        video: {
          type: room.video.type,
          source: room.video.source,
          title: room.video.title,
          state: room.video.state,
          currentTime: 0,
          playbackRate: room.video.playbackRate,
          serverTime: Date.now()
        },
        sender: currentUserName
      });
    }
  });

  // Previous Episode
  socket.on("episode-prev", () => {
    if (!currentRoomId) return;
    const room = getOrCreateRoom(currentRoomId);
    const prevIdx = (room.currentEpisodeIndex || 0) - 1;

    if (room.playlist && prevIdx >= 0) {
      room.currentEpisodeIndex = prevIdx;
      const ep = room.playlist[prevIdx];

      room.video.type = ep.type;
      room.video.source = ep.source;
      room.video.title = ep.title;
      room.video.currentTime = 0;
      room.video.state = "paused";
      room.video.lastUpdated = Date.now();

      io.to(currentRoomId).emit("episode-change", {
        index: prevIdx,
        video: {
          type: room.video.type,
          source: room.video.source,
          title: room.video.title,
          state: room.video.state,
          currentTime: 0,
          playbackRate: room.video.playbackRate,
          serverTime: Date.now()
        },
        sender: currentUserName
      });
    }
  });

  // Switch Web Series
  socket.on("series-select", ({ seriesId }) => {
    if (!currentRoomId) return;
    const room = getOrCreateRoom(currentRoomId);
    const targetSeries = WEB_SERIES.find((s) => s.id === seriesId);

    if (targetSeries) {
      room.currentSeries = targetSeries;
      room.playlist = [...targetSeries.episodes];
      room.currentEpisodeIndex = 0;
      const firstEp = targetSeries.episodes[0];

      room.video.type = firstEp.type;
      room.video.source = firstEp.source;
      room.video.title = firstEp.title;
      room.video.currentTime = 0;
      room.video.state = "paused";
      room.video.lastUpdated = Date.now();

      io.to(currentRoomId).emit("series-changed", {
        series: targetSeries,
        playlist: room.playlist,
        currentEpisodeIndex: 0,
        video: {
          type: room.video.type,
          source: room.video.source,
          title: room.video.title,
          state: room.video.state,
          currentTime: 0,
          playbackRate: room.video.playbackRate,
          serverTime: Date.now()
        },
        sender: currentUserName
      });
    }
  });

  // Local File Synchronized Announce (when watching downloaded series file)
  socket.on("local-file-announce", ({ fileName, fileSize }) => {
    if (!currentRoomId) return;
    const room = getOrCreateRoom(currentRoomId);
    room.video.title = "📁 Local Video: " + fileName;
    room.video.type = "local";
    room.video.currentTime = 0;
    room.video.state = "paused";
    room.video.lastUpdated = Date.now();

    socket.to(currentRoomId).emit("local-file-request", {
      fileName,
      fileSize,
      sender: currentUserName
    });

    const fileMsg = {
      id: "sys-" + Date.now(),
      sender: "System",
      text: `📁 ${currentUserName} selected local file "${fileName}". Please select your matching file to sync!`,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      isSystem: true
    };
    room.messages.push(fileMsg);
    io.to(currentRoomId).emit("chat-message", fileMsg);
  });

  // Immediate Resync Request
  socket.on("request-resync", () => {
    if (!currentRoomId) return;
    const room = getOrCreateRoom(currentRoomId);

    socket.emit("resync-data", {
      currentTime: getRoomCurrentTime(room),
      state: room.video.state,
      playbackRate: room.video.playbackRate,
      serverTime: Date.now()
    });
  });

  // ==========================================
  // WebRTC Video Call Signaling Handlers
  // ==========================================

  socket.on("signal-offer", (payload) => {
    const { targetId, offer, isScreenShare, screenStreamId, screenShareEnded } = payload || {};
    const data = {
      senderId: socket.id,
      senderName: currentUserName,
      offer,
      isScreenShare,
      screenStreamId,
      screenShareEnded
    };
    if (targetId) {
      io.to(targetId).emit("signal-offer", data);
    } else if (currentRoomId) {
      socket.to(currentRoomId).emit("signal-offer", data);
    }
  });

  socket.on("signal-answer", (payload) => {
    const { targetId, answer } = payload || {};
    const data = {
      senderId: socket.id,
      senderName: currentUserName,
      answer
    };
    if (targetId) {
      io.to(targetId).emit("signal-answer", data);
    } else if (currentRoomId) {
      socket.to(currentRoomId).emit("signal-answer", data);
    }
  });

  socket.on("signal-ice", ({ targetId, candidate }) => {
    if (targetId) {
      io.to(targetId).emit("signal-ice", {
        senderId: socket.id,
        candidate
      });
    } else if (currentRoomId) {
      socket.to(currentRoomId).emit("signal-ice", {
        senderId: socket.id,
        candidate
      });
    }
  });

  socket.on("signal-reconnect", ({ targetId }) => {
    if (targetId) {
      io.to(targetId).emit("signal-reconnect", { senderId: socket.id });
    } else if (currentRoomId) {
      socket.to(currentRoomId).emit("signal-reconnect", { senderId: socket.id });
    }
  });

  socket.on("peer-speaking", ({ speaking }) => {
    if (!currentRoomId) return;
    socket.to(currentRoomId).emit("peer-speaking", {
      speaking: !!speaking,
      userId: socket.id,
      userName: currentUserName
    });
  });

  socket.on("screen-share-status", ({ isSharing, streamId }) => {
    if (!currentRoomId) return;
    socket.to(currentRoomId).emit("screen-share-status", {
      isSharing: !!isSharing,
      sharerName: currentUserName,
      streamId
    });

    const msgText = isSharing
      ? `🖥️ ${currentUserName} started sharing their screen in the main theater!`
      : `🖥️ ${currentUserName} stopped sharing screen`;

    const screenMsg = {
      id: "sys-" + Date.now(),
      sender: "System",
      text: msgText,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      isSystem: true
    };
    const room = getOrCreateRoom(currentRoomId);
    room.messages.push(screenMsg);
    io.to(currentRoomId).emit("chat-message", screenMsg);
  });

  socket.on("media-toggle", ({ type, enabled }) => {
    if (!currentRoomId) return;
    const room = getOrCreateRoom(currentRoomId);
    const user = room.users.get(socket.id);
    if (user) {
      if (type === "cam") user.cam = enabled;
      if (type === "mic") user.mic = enabled;
    }
    socket.to(currentRoomId).emit("peer-media-toggle", {
      userId: socket.id,
      type,
      enabled
    });
  });

  // ==========================================
  // Real-time Chat & Social Handlers
  // ==========================================

  socket.on("chat-message", ({ text }) => {
    if (!currentRoomId || !text || !text.trim()) return;
    const room = getOrCreateRoom(currentRoomId);

    const message = {
      id: "msg-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
      sender: currentUserName,
      senderId: socket.id,
      text: text.trim().substring(0, 1000),
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      isSystem: false
    };

    room.messages.push(message);
    if (room.messages.length > 100) room.messages.shift();

    io.to(currentRoomId).emit("chat-message", message);
  });

  socket.on("chat-typing", ({ isTyping }) => {
    if (!currentRoomId) return;
    socket.to(currentRoomId).emit("chat-typing", {
      sender: currentUserName,
      isTyping: !!isTyping
    });
  });

  // Floating Emoji Burst Reaction
  socket.on("reaction-burst", ({ emoji }) => {
    if (!currentRoomId || !emoji) return;
    io.to(currentRoomId).emit("reaction-burst", {
      emoji,
      sender: currentUserName
    });
  });

  // ==========================================
  // Disconnect & Room Cleanup
  // ==========================================

  socket.on("disconnect", () => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    room.users.delete(socket.id);

    // Notify peers
    socket.to(currentRoomId).emit("user-left", {
      userId: socket.id,
      userName: currentUserName,
      userCount: room.users.size
    });

    const leaveMsg = {
      id: "sys-" + Date.now(),
      sender: "System",
      text: `${currentUserName} left the room`,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      isSystem: true
    };
    room.messages.push(leaveMsg);
    socket.to(currentRoomId).emit("chat-message", leaveMsg);

    if (room.users.size === 0) {
      setTimeout(() => {
        const checkRoom = rooms.get(currentRoomId);
        if (checkRoom && checkRoom.users.size === 0) {
          clearInterval(checkRoom.heartbeatTimer);
          rooms.delete(currentRoomId);
        }
      }, 60000);
    }
  });
});

server.listen(port, () => {
  console.log(`===============================================`);
  console.log(`🚀 Watch Together Server listening on port ${port}`);
  console.log(`🌐 Open in browser: http://localhost:${port}`);
  console.log(`===============================================`);
});
