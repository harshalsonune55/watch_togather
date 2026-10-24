require("dotenv").config();

const express = require("express");
const http = require("http");
const path = require("path");
const fs = require("fs");
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

function parseVideoSource(input) {
  if (!input || typeof input !== "string" || input.trim() === "") {
    return {
      type: null,
      source: null,
      title: "Waiting for video link or screen share"
    };
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
    const filename = input.split("/").pop().split("?")[0] || "Direct Stream";
    return {
      type: "html5",
      source: input,
      title: filename
    };
  }

  // Default fallback
  return {
    type: "html5",
    source: input,
    title: "Direct Stream"
  };
}

// Helper: Fetch YouTube Title & Description for AI Context
async function fetchYouTubeMetadata(videoId) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9"
      },
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const html = await res.text();
    const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i) || html.match(/<meta\s+property="og:description"\s+content="([^"]*)"/i);
    const titleMatch = html.match(/<meta\s+name="title"\s+content="([^"]*)"/i) || html.match(/<meta\s+property="og:title"\s+content="([^"]*)"/i);
    return {
      title: titleMatch ? titleMatch[1].replace(/ - YouTube$/i, "").trim() : null,
      description: descMatch ? descMatch[1].trim() : null
    };
  } catch (e) {
    return null;
  }
}

// In-Memory Room State Store
const rooms = new Map();

function getOrCreateRoom(roomId) {
  roomId = (roomId || "default-room").toLowerCase().trim();
  if (!rooms.has(roomId)) {
    const room = {
      id: roomId,
      users: new Map(), // socketId -> { id, name, isHost, cam: true, mic: true }
      video: {
        type: null,
        source: null,
        title: "Waiting for video link or screen share",
        description: "",
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
      if (room.users.size > 0 && room.video.state === "playing" && room.video.source) {
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

// Serve built React frontend from client/dist if present
const clientDistPath = path.join(__dirname, "client", "dist");
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath, {
    maxAge: "1d",
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".js") || filePath.endsWith(".mjs")) {
        res.setHeader("Content-Type", "application/javascript; charset=utf-8");
      } else if (filePath.endsWith(".css")) {
        res.setHeader("Content-Type", "text/css; charset=utf-8");
      }
    }
  }));
}

app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride("_method"));

// AI Co-Pilot Assistant API (Groq LLaMA / Qwen / GPT-OSS)
app.post("/api/ai/catch-up", async (req, res) => {
  const { roomId, currentTime, videoTitle, videoDescription, recentMessages, prompt } = req.body || {};
  const apiKey = process.env.GROQ_API_KEY;

  const room = roomId ? rooms.get(roomId.toLowerCase().trim()) : null;
  const effectiveTitle = videoTitle || room?.video?.title || "Live Video";
  const effectiveDescription = videoDescription || room?.video?.description || "";
  const effectiveTime = currentTime || (room ? `${Math.floor(getRoomCurrentTime(room) / 60)}:${String(Math.floor(getRoomCurrentTime(room) % 60)).padStart(2, "0")}` : "00:00");

  if (!apiKey) {
    return res.json({
      summary: `🍿 **Watchooo AI Co-Pilot**:\n• You are currently watching **${effectiveTitle}** at **${effectiveTime}**!\n${effectiveDescription ? `• *Synopsis*: ${effectiveDescription.slice(0, 140)}...\n` : ''}• To activate real-time intelligent summaries for latecomers, add \`GROQ_API_KEY=...\` to your \`.env\` file.`
    });
  }

  try {
    const formattedChat = (recentMessages || [])
      .map(m => `${m.sender}: ${m.text}`)
      .join("\n") || "No chat messages yet.";

    const systemPrompt = `You are Watchooo AI, a friendly, hyper-concise co-pilot for a synchronized video watch party. The user joined the room late or asked for an update. Using the video title, video description/synopsis, current video timestamp, and recent room chat, provide a crisp 2-3 bullet point summary catching them up on what's happening right now in the video and what friends in the room are saying. Keep it engaging, fun, and brief (under 85 words).`;

    const userContent = `Video Title: ${effectiveTitle}
Video Description / Synopsis: ${effectiveDescription || 'No description provided.'}
Current Timestamp: ${effectiveTime}
Recent Room Chat:
${formattedChat}
User Request: ${prompt || 'What did I miss?'}`;

    const modelName = process.env.GROQ_MODEL || "qwen/qwen3.8-27b";
    let response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent }
        ],
        temperature: 0.6,
        max_tokens: 300
      })
    });

    if (!response.ok) {
      // Fallback model if primary failed
      response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "openai/gpt-oss-120b",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent }
          ],
          temperature: 0.6,
          max_tokens: 300
        })
      });
    }

    if (!response.ok) {
      const errText = await response.text();
      console.warn("Groq API error response:", errText);
      return res.json({
        summary: `🍿 You're watching **${effectiveTitle}** at **${effectiveTime}**! ${effectiveDescription ? effectiveDescription.slice(0, 110) + '...' : 'Chat is active, jump right in!'}`
      });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || `🍿 Catching you up: watching **${effectiveTitle}** at **${effectiveTime}**!`;
    return res.json({ summary: reply });
  } catch (err) {
    console.error("AI Catch-Up exception:", err);
    return res.json({
      summary: `🍿 You're watching **${effectiveTitle}** at **${effectiveTime}**! Have fun watching together!`
    });
  }
});

// React SPA Route Handler (Serves React index.html for page navigation routes only)
app.get("*", (req, res, next) => {
  // Never serve index.html for static asset files, scripts, stylesheets, or API routes
  if (
    req.path.startsWith("/api/") ||
    req.path.startsWith("/assets/") ||
    req.path.startsWith("/socket.io/") ||
    /\.[a-zA-Z0-9]+$/.test(req.path)
  ) {
    return next();
  }

  const indexPath = path.join(__dirname, "client", "dist", "index.html");
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  next();
});

// Routes (EJS Fallbacks)
// 1. Landing / Lobby page
app.get("/", (req, res) => {
  res.render("lobby.ejs");
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
    networkIp: getLocalIpAddress(),
    serverPort: port
  });
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
      video: {
        type: room.video.type,
        source: room.video.source,
        title: room.video.title,
        description: room.video.description || "",
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
    room.video.description = payload.description || "";
    room.video.currentTime = 0;
    room.video.state = "paused";
    room.video.lastUpdated = Date.now();

    // If YouTube video, asynchronously fetch title and description for richer AI context
    if (parsed.type === "youtube") {
      fetchYouTubeMetadata(parsed.source).then((meta) => {
        if (meta) {
          if (meta.title && (room.video.title.startsWith("YouTube Video") || !room.video.title)) {
            room.video.title = meta.title;
          }
          if (meta.description) {
            room.video.description = meta.description;
          }
          io.to(currentRoomId).emit("video-metadata-update", {
            title: room.video.title,
            description: room.video.description
          });
        }
      });
    }

    io.to(currentRoomId).emit("video-change", {
      video: {
        type: room.video.type,
        source: room.video.source,
        title: room.video.title,
        description: room.video.description,
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

  // Local File Synchronized Announce (when watching downloaded video file)
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

  socket.on("chat-message", ({ text, id }) => {
    if (!currentRoomId || !text || !text.trim()) return;
    const room = getOrCreateRoom(currentRoomId);

    const message = {
      id: id || ("msg-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6)),
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
