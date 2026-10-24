/**
 * ChatEngine - Real-Time Chat, Typing Indicators, Synthesized Sound Effects,
 * and Physics-Animated Floating Emoji Reactions.
 */
class ChatEngine {
  constructor(socket, roomId, userName) {
    this.socket = socket;
    this.roomId = roomId;
    this.userName = userName;

    this.messagesList = document.getElementById("messagesList");
    this.chatInput = document.getElementById("chatInput");
    this.typingIndicator = document.getElementById("typingIndicator");

    this.typingTimeout = null;
    this.isTyping = false;

    this.initAudioContext();
    this.initSocketEvents();
    this.bindDOMEvents();
  }

  // Synthesized sound effects without external audio assets
  initAudioContext() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioCtx();
    } catch (e) {
      this.audioCtx = null;
    }
  }

  playTone(freq, duration = 0.08, type = "sine") {
    if (!this.audioCtx) return;
    try {
      if (this.audioCtx.state === "suspended") {
        this.audioCtx.resume();
      }
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
      gain.gain.setValueAtTime(0.08, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();
      osc.stop(this.audioCtx.currentTime + duration);
    } catch (e) {}
  }

  initSocketEvents() {
    // 1. Incoming chat message
    this.socket.on("chat-message", (msg) => {
      this.appendMessage(msg);
      if (msg.sender === this.userName) {
        this.playTone(580, 0.06, "triangle"); // gentle send pop
      } else if (!msg.isSystem) {
        this.playTone(880, 0.12, "sine"); // bell ping
      }
    });

    // 2. Incoming typing status
    this.socket.on("chat-typing", ({ sender, isTyping }) => {
      if (!this.typingIndicator) return;
      if (isTyping) {
        this.typingIndicator.textContent = `${sender} is typing...`;
      } else {
        this.typingIndicator.textContent = "";
      }
    });

    // 3. Incoming floating reaction burst
    this.socket.on("reaction-burst", ({ emoji, sender }) => {
      this.spawnFloatingEmoji(emoji);
      this.playTone(1050, 0.08, "sine");
    });
  }

  bindDOMEvents() {
    if (this.chatInput) {
      this.chatInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          this.sendMessage();
        } else {
          this.handleTyping();
        }
      });
    }

    const sendBtn = document.getElementById("btnSendChat");
    if (sendBtn) {
      sendBtn.addEventListener("click", () => this.sendMessage());
    }

    // Reaction emoji buttons
    const emojiBtns = document.querySelectorAll(".btn-emoji");
    emojiBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const emoji = btn.getAttribute("data-emoji");
        this.sendReaction(emoji);
      });
    });
  }

  sendMessage() {
    if (!this.chatInput) return;
    const text = this.chatInput.value.trim();
    if (!text) return;

    this.socket.emit("chat-message", { text });
    this.chatInput.value = "";
    this.stopTyping();
  }

  handleTyping() {
    if (!this.isTyping) {
      this.isTyping = true;
      this.socket.emit("chat-typing", { isTyping: true });
    }

    clearTimeout(this.typingTimeout);
    this.typingTimeout = setTimeout(() => {
      this.stopTyping();
    }, 1500);
  }

  stopTyping() {
    if (this.isTyping) {
      this.isTyping = false;
      this.socket.emit("chat-typing", { isTyping: false });
    }
  }

  sendReaction(emoji) {
    if (!emoji) return;
    this.socket.emit("reaction-burst", { emoji });
    this.spawnFloatingEmoji(emoji);
    this.playTone(1050, 0.08, "sine");
  }

  appendMessage(msg) {
    if (!this.messagesList) return;

    const item = document.createElement("div");
    const isSent = msg.sender === this.userName;

    if (msg.isSystem) {
      item.className = "message-item system";
      item.innerHTML = `<div class="msg-bubble">${this.escapeHTML(msg.text)}</div>`;
    } else {
      item.className = `message-item ${isSent ? "sent" : "received"}`;
      item.innerHTML = `
        <div class="msg-meta">
          <span>${isSent ? "You" : this.escapeHTML(msg.sender)}</span>
          <span>•</span>
          <span>${msg.time || ""}</span>
        </div>
        <div class="msg-bubble">${this.escapeHTML(msg.text)}</div>
      `;
    }

    this.messagesList.appendChild(item);
    this.messagesList.scrollTop = this.messagesList.scrollHeight;
  }

  spawnFloatingEmoji(emoji) {
    const el = document.createElement("div");
    el.className = "floating-emoji";
    el.textContent = emoji;

    // Randomize horizontal placement
    const randomOffset = Math.random() * 80 - 40; // -40px to +40px
    el.style.right = `${60 + randomOffset}px`;

    document.body.appendChild(el);

    // Remove from DOM when animation completes
    setTimeout(() => {
      el.remove();
    }, 3000);
  }

  escapeHTML(str) {
    const p = document.createElement("p");
    p.appendChild(document.createTextNode(str || ""));
    return p.innerHTML;
  }
}

window.ChatEngine = ChatEngine;
