# Watch Together 🎬✨

Watch Together is an ultra-modern, real-time synchronized video theater and WebRTC video call platform designed for two people to watch videos together seamlessly with **zero drift, zero noticeable latency, 2-way HD video calling, and live interactive chat**.

---

## ✨ Features

- ⚡ **Zero-Drift Video Synchronization**:
  - Play, pause, seek, scrub, and speed change (0.5x – 2x) in perfect lockstep.
  - Precision drift correction algorithm: automatically detects client lag and micro-adjusts playback speed smoothly without audio pops or jarring stutters.
  - Periodic server clock-offset heartbeats eliminate long-term drift.
  - Supports both **YouTube** (via official YouTube IFrame API) and **Direct Video Streams** (MP4, WebM, HLS).
  - Instant curated sample videos (Sci-Fi, Nature 4K, Animation HD, Lofi Beats) for one-click testing.

- 📹 **2-Person HD WebRTC Video & Audio Call**:
  - Peer-to-peer WebRTC video calling so both persons can see and hear each other while watching.
  - Dynamic audio speaking indicator: visual glowing aura around the active speaker.
  - Camera toggle (on/off) with fallback customized user avatar placeholder.
  - Microphone mute/unmute toggle.
  - One-click Screen Sharing into the **Main Video Theater Section** so you can share any screen/browser tab while keeping both webcams live in the person view windows!

- 💬 **Live Chat & Floating Emoji Bursts**:
  - Real-time text messaging with sender badges, timestamps, and auto-scroll.
  - Live typing indicator ("... is typing").
  - Quick emoji reaction bar (❤️, 🔥, 😂, 🍿, 👏, 🚀, 😮) that spawns physics-animated floating bubbles across both screens.
  - Pleasant synthesized Web Audio API audio chimes for messages and reactions.

- 💎 **Ultra-Clean Modern Dark Aesthetic**:
  - Sleek dark slate glassmorphism theme (`backdrop-filter: blur(16px)`).
  - Clean custom media controls bar with interactive progress scrubber and buffer bar.
  - 1-click room invite link copying with clipboard toast notifications.
  - Responsive layout for desktop and tablet screens.

---

## 🚀 Quick Start

### 1. Prerequisites
- Node.js (v18+)
- npm

### 2. Start the Server
```bash
npm start
```
*(By default runs on `http://localhost:8080`. You can configure `PORT=3000` via environment variables).*

### 3. Open in Browser
1. Open **[http://localhost:8080](http://localhost:8080)** on your browser.
2. Enter your display name and click **"Enter Theater"** (or generate a random room code).
3. Copy the invite link from the top navigation bar and send it to your friend!
4. When your friend opens the link, the WebRTC video call connects automatically and playback stays in lockstep!

---

## 🛠️ Tech Stack
- **Backend**: Node.js, Express.js, Socket.IO, EJS Templates
- **Video Sync Engine**: YouTube IFrame API & HTML5 Video with drift-correction algorithm
- **Video Call**: WebRTC `RTCPeerConnection`, `getUserMedia`, `getDisplayMedia`, Web Audio API
- **Styling**: Modern CSS3, Flexbox/Grid, Glassmorphism, FontAwesome 6

---

## 📄 License
MIT License.
