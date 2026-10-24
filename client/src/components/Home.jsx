import React, { useState, useEffect, useRef } from 'react';
import { Typewriter } from 'motion-plus/react';

const DEMO_VIDEOS = [
  {
    title: 'Watchooo Feature Showcase (YouTube)',
    type: 'youtube',
    source: 'oc_o5DZM3qc',
    badge: 'YouTube • Live Lo-Fi',
    desc: 'Continuous synchronized stream demo, plays silently in a loop.'
  },
  {
    title: 'Big Buck Bunny (HD Animation)',
    type: 'html5',
    source: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    badge: 'MP4 • 1080p',
    desc: 'Fun animated forest adventure, perfect for group testing.'
  },
  {
    title: 'Tears of Steel (Sci-Fi VFX Demo)',
    type: 'html5',
    source: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
    badge: 'MP4 • Sci-Fi VFX',
    desc: 'High-octane futuristic thriller with cinematic visual effects.'
  },
  {
    title: 'Nature 4K Relaxation (YouTube)',
    type: 'youtube',
    source: '1ZYbU888YX8',
    badge: 'YouTube • 4K HDR',
    desc: 'Deep mountain waterfalls, wild rivers, and calming scenery.'
  }
];

export default function Home({ onNavigate }) {
  const [displayName, setDisplayName] = useState(() => {
    return localStorage.getItem('wt_username') || 'Alex';
  });
  const [roomId, setRoomId] = useState('');
  const [videoLink, setVideoLink] = useState('');
  const [activeFaq, setActiveFaq] = useState(null);

  // Active YouTube Demo Preview (Plays continuously without audio)
  const [activeYoutubeVideo, setActiveYoutubeVideo] = useState('oc_o5DZM3qc');
  const [typewriterCycle, setTypewriterCycle] = useState(0);

  const handleTypewriterDone = () => {
    setTimeout(() => {
      setTypewriterCycle((prev) => prev + 1);
    }, 1800);
  };

  useEffect(() => {
    localStorage.setItem('wt_username', displayName);
  }, [displayName]);

  const generateRandomRoom = () => {
    const adjectives = ['cosmic', 'neon', 'velvet', 'stellar', 'cinema', 'midnight', 'crystal', 'cyber'];
    const nouns = ['wave', 'theater', 'lounge', 'stream', 'orbit', 'spark', 'echo', 'pulse'];
    const randAdj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const randNoun = nouns[Math.floor(Math.random() * nouns.length)];
    const randNum = Math.floor(Math.random() * 899 + 100);
    setRoomId(`${randAdj}-${randNoun}-${randNum}`);
  };

  const handleLaunchRoom = (customVideo = null) => {
    let targetRoom = (roomId || '').trim().toLowerCase();
    if (targetRoom.includes('/room/')) {
      targetRoom = targetRoom.split('/room/')[1].split('?')[0].split('#')[0].trim();
    }
    if (!targetRoom) {
      targetRoom = 'watch-' + Math.random().toString(36).substring(2, 8);
    }
    const cleanName = (displayName || 'Alex').trim();
    localStorage.setItem('wt_username', cleanName);

    const targetVid = customVideo || videoLink.trim();
    if (targetVid) {
      sessionStorage.setItem('wt_pending_video_' + targetRoom, targetVid);
    }

    onNavigate(`/room/${encodeURIComponent(targetRoom)}?name=${encodeURIComponent(cleanName)}`);
  };

  const toggleFaq = (index) => {
    setActiveFaq(activeFaq === index ? null : index);
  };

  return (
    <div className="home-wrapper">
      {/* Top Navbar */}
      <nav className="home-nav">
        <a href="/" className="home-brand" onClick={(e) => { e.preventDefault(); onNavigate('/'); }}>
          <img src="/images/logo.png" alt="Watchooo Logo" className="brand-logo-img" />
          <span>Watchooo</span>
        </a>

        <div className="home-nav-links">
          <a href="#features" className="home-nav-link">Features</a>
          <a href="#ai-assistant" className="home-nav-link">✨ AI Assistant</a>
          <a href="#demos" className="home-nav-link">Demo Videos</a>
          <a href="#how-it-works" className="home-nav-link">How It Works</a>
          <a href="#faq" className="home-nav-link">FAQ</a>
        </div>

        <button type="button" onClick={() => handleLaunchRoom()} className="btn-mint-pill">
          <i className="fa-solid fa-door-open"></i>
          <span>Enter Theater</span>
        </button>
      </nav>

      {/* Hero Section */}
      <section className="home-hero-section">
        <div className="home-hero-badge">
          <span className="live-dot-green"></span>
          <span>Zero-Drift Synchronization &bull; 2-Way HD Video Call &bull; ✨ Groq AI Assistant</span>
        </div>

        <h1 className="home-hero-title">
          <span className="hero-text-solid">Watch Any Video Together.</span><br />
          <span className="hero-text-accent">
            <Typewriter
              key={typewriterCycle}
              speed="normal"
              variance="natural"
              onComplete={handleTypewriterDone}
            >
              In Total Real-Time Sync.
            </Typewriter>
          </span>
        </h1>

        <p className="home-hero-subtitle">
          Experience synchronized movies, YouTube streams, and web series with 2-way HD video calling,
          crystal-clear audio, live reactions, and our built-in <strong>✨ Groq AI Assistant</strong> that catches up friends who join late.
        </p>

        {/* Quick Launch Card */}
        <div className="home-launch-card" id="start-party">
          <div className="launch-card-header">
            <div className="launch-tag">
              <i className="fa-solid fa-sparkles" style={{ color: 'var(--mint)' }}></i>
              <span>Instant Theater Setup</span>
            </div>
            <div className="launch-live-status">
              <span className="live-dot-green"></span> 100% Free &bull; No Login Required
            </div>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); handleLaunchRoom(); }} className="launch-form">
            <div className="launch-inputs-grid">
              <div className="launch-input-group">
                <label className="launch-label" htmlFor="nameInput">Your Name</label>
                <input
                  id="nameInput"
                  type="text"
                  className="clean-input-box"
                  placeholder="e.g. Alex"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                />
              </div>

              <div className="launch-input-group">
                <label className="launch-label" htmlFor="roomCodeInput">
                  Room Name
                  <button type="button" onClick={generateRandomRoom} className="btn-random-code">
                    🎲 Random
                  </button>
                </label>
                <input
                  id="roomCodeInput"
                  type="text"
                  className="clean-input-box"
                  placeholder="e.g. cinema-lounge or auto"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                />
              </div>

              <div className="launch-input-group">
                <label className="launch-label" htmlFor="urlInput">
                  Video URL (YouTube or MP4)
                  <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}> (Optional)</span>
                </label>
                <input
                  id="urlInput"
                  type="text"
                  className="clean-input-box"
                  placeholder="Paste YouTube link or direct MP4 URL"
                  value={videoLink}
                  onChange={(e) => setVideoLink(e.target.value)}
                />
              </div>
            </div>

            <button type="submit" className="btn-mint-pill launch-btn">
              <i className="fa-solid fa-door-open"></i>
              <span>Enter Theater</span>
            </button>
          </form>
        </div>
      </section>

      {/* Product Demo Showcase Section */}
      <section className="home-section" id="demos">
        <div className="section-header-centered">
          <div className="section-pill">🎬 Live Product Demo</div>
          <h2 className="section-title">See Watchooo in Action</h2>
          <p className="section-subtitle">
            Experience real-time playback synchronization, 2-way WebRTC video calling, and our built-in ✨ Groq AI co-pilot.
          </p>
        </div>

        {/* 2-Column Showcase: YouTube Video on Left & Product Description on Right */}
        <div className="demo-showcase-split-grid">
          {/* Left Column: YouTube Video Embed */}
          <div className="demo-video-col">
            <div className="demo-video-card">
              <div className="demo-window-bar">
                <div className="window-dots">
                  <span className="dot-circle red"></span>
                  <span className="dot-circle yellow"></span>
                  <span className="dot-circle green"></span>
                </div>
                <div className="demo-video-tag">
                  <span className="live-dot-green"></span>
                  <span>YouTube Stream Sync</span>
                </div>
              </div>
              <div className="demo-video-embed-box">
                <iframe
                  className="demo-youtube-iframe"
                  src={`https://www.youtube-nocookie.com/embed/${activeYoutubeVideo}?autoplay=1&mute=1&loop=1&playlist=${activeYoutubeVideo}&enablejsapi=1&playsinline=1&controls=0&rel=0&modestbranding=1`}
                  title="Watchooo Product Demo Video"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                ></iframe>
              </div>
              <div className="demo-video-footer">
                <div className="demo-video-caption">
                  <i className="fa-brands fa-youtube" style={{ color: '#ef4444' }}></i>
                  <span>Live 1080p Stream &bull; Low Latency Synced Playback</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleLaunchRoom(activeYoutubeVideo)}
                  className="btn-mint-pill"
                  style={{ padding: '6px 14px', fontSize: '0.78rem' }}
                >
                  <i className="fa-solid fa-door-open"></i>
                  <span>Enter Theater</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Product Description & Highlights */}
          <div className="demo-description-col">
            <div className="demo-desc-badge">
              <i className="fa-solid fa-sparkles" style={{ color: 'var(--mint)' }}></i>
              <span>Real-Time Sync Demo</span>
            </div>

            <h3 className="demo-desc-heading">
              Stream in Lockstep Sync
            </h3>

            <p className="demo-desc-lead">
              Watch movies and YouTube streams with zero lag, 2-way WebRTC facecams, and instant AI scene recaps.
            </p>

            <div className="demo-features-checklist">
              <div className="checklist-item">
                <div className="check-icon-circle">
                  <i className="fa-solid fa-check"></i>
                </div>
                <div className="check-text-box">
                  <h4 className="check-title">Zero-Drift Playback</h4>
                  <p className="check-desc">Every pause, seek, and frame is calibrated in real-time across all viewers.</p>
                </div>
              </div>

              <div className="checklist-item">
                <div className="check-icon-circle">
                  <i className="fa-solid fa-check"></i>
                </div>
                <div className="check-text-box">
                  <h4 className="check-title">2-Way HD Video &amp; Voice</h4>
                  <p className="check-desc">Low-latency WebRTC facecams with animated speaking detection.</p>
                </div>
              </div>

              <div className="checklist-item">
                <div className="check-icon-circle">
                  <i className="fa-solid fa-check"></i>
                </div>
                <div className="check-text-box">
                  <h4 className="check-title">✨ Groq AI Co-Pilot</h4>
                  <p className="check-desc">Instant 300ms scene recap for friends who join the room late.</p>
                </div>
              </div>
            </div>

            <div className="demo-cta-row">
              <button
                type="button"
                onClick={() => handleLaunchRoom(activeYoutubeVideo)}
                className="btn-mint-pill demo-launch-cta-btn"
              >
                <i className="fa-solid fa-door-open"></i>
                <span>Enter Theater</span>
              </button>
            </div>
          </div>
        </div>

        {/* 1-Click Ready Demos Grid */}
        <div style={{ textAlign: 'center', marginTop: '48px', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 6px' }}>
            Instant Pre-Loaded Demo Rooms
          </h3>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', margin: 0 }}>
            Click any stream below to preview or spin up a synchronized room immediately:
          </p>
        </div>

        <div className="demo-cards-grid">
          {DEMO_VIDEOS.map((demo) => (
            <div
              key={demo.source}
              className={`demo-card ${activeYoutubeVideo === demo.source ? 'active-preview-card' : ''}`}
              onClick={() => {
                if (demo.type === 'youtube') {
                  setActiveYoutubeVideo(demo.source);
                } else {
                  handleLaunchRoom(demo.source);
                }
              }}
            >
              <div className="demo-card-top">
                <span className="demo-badge">{demo.badge}</span>
                <span className="demo-play-icon">▶</span>
              </div>
              <h3 className="demo-title">{demo.title}</h3>
              <p className="demo-desc">{demo.desc}</p>
              <div className="demo-card-footer">
                <span>{demo.type === 'youtube' && activeYoutubeVideo === demo.source ? '✓ Previewing Above' : 'Launch in Sync ↗'}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Features Grid Section */}
      <section className="home-section" id="features">
        <div className="section-header-centered">
          <div className="section-pill">Why Watchooo</div>
          <h2 className="section-title">Everything You Need for the Ultimate Watch Party</h2>
          <p className="section-subtitle">Engineered with modern WebRTC, Socket.IO, and Groq LLMs for zero lag and seamless fun.</p>
        </div>

        <div className="features-bento-grid">
          <div className="bento-box">
            <div className="bento-icon-box">
              <i className="fa-solid fa-arrows-rotate"></i>
            </div>
            <h3 className="bento-title">Zero-Drift Playback Sync</h3>
            <p className="bento-desc">
              Play, pause, seek, and adjust playback speed in lockstep. Our server heartbeat calibration eliminates drift so everyone watches the exact same frame.
            </p>
          </div>

          <div className="bento-box">
            <div className="bento-icon-box">
              <i className="fa-solid fa-video"></i>
            </div>
            <h3 className="bento-title">HD 2-Way Video Calling</h3>
            <p className="bento-desc">
              See your partner's live expressions with ultra-low latency WebRTC facecams, animated speaking indicators, and automatic multi-region TURN relay servers.
            </p>
          </div>

          <div className="bento-box accent-box" id="ai-assistant">
            <div className="bento-icon-box">
              <i className="fa-solid fa-wand-magic-sparkles"></i>
            </div>
            <h3 className="bento-title">✨ Groq AI Assistant for Latecomers</h3>
            <p className="bento-desc">
              Friend joined late? Our built-in Groq AI co-pilot analyzes the scene timestamp and room discussion to generate an instant, snappy recap so nobody is left behind!
            </p>
          </div>

          <div className="bento-box">
            <div className="bento-icon-box">
              <i className="fa-solid fa-desktop"></i>
            </div>
            <h3 className="bento-title">Theater Screen Sharing</h3>
            <p className="bento-desc">
              Stream games, browser tabs, Netflix, or presentations directly into the big theater stage with full audio sharing capabilities.
            </p>
          </div>

          <div className="bento-box">
            <div className="bento-icon-box">
              <i className="fa-solid fa-comments"></i>
            </div>
            <h3 className="bento-title">Live Chat &amp; Physics Reactions</h3>
            <p className="bento-desc">
              Type in real-time with typing indicators, trigger physics-animated floating emoji bursts (❤️, 🔥, 🍿), and ask the AI co-pilot with <code>@ai</code>.
            </p>
          </div>

          <div className="bento-box">
            <div className="bento-icon-box">
              <i className="fa-regular fa-folder-open"></i>
            </div>
            <h3 className="bento-title">Local File Zero-Buffer Sync</h3>
            <p className="bento-desc">
              Have matching downloaded movie files? Play local MP4 files synchronously with zero upload bandwidth or buffering.
            </p>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="home-section" id="how-it-works">
        <div className="section-header-centered">
          <div className="section-pill">Simple Workflow</div>
          <h2 className="section-title">How Watchooo Works in 3 Steps</h2>
        </div>

        <div className="steps-container">
          <div className="step-card">
            <div className="step-number">01</div>
            <h3 className="step-heading">Create a Party Room</h3>
            <p className="step-text">Enter your nickname, pick a room code or generate one randomly, and paste any video link or pick a demo.</p>
          </div>

          <div className="step-card">
            <div className="step-number">02</div>
            <h3 className="step-heading">Send Invite Link</h3>
            <p className="step-text">Copy the invite link with 1 click. If your friend is on the same Wi-Fi, use the built-in LAN link for phones and tablets.</p>
          </div>

          <div className="step-card">
            <div className="step-number">03</div>
            <h3 className="step-heading">Watch, Call &amp; Catch Up</h3>
            <p className="step-text">Watch together in lockstep synchronization, video call face-to-face, chat, and click ✨ AI Catch Up whenever needed.</p>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="home-section" id="faq">
        <div className="section-header-centered">
          <div className="section-pill">Questions &amp; Answers</div>
          <h2 className="section-title">Frequently Asked Questions</h2>
        </div>

        <div className="faq-list">
          {[
            {
              q: 'Do my friends need to create an account to join?',
              a: 'No! Watchooo requires zero registration or passwords. Just send your room link and your friends can join instantly with one click.'
            },
            {
              q: 'How does the ✨ Groq AI Assistant catch latecomers up?',
              a: 'When someone joins a room mid-way or clicks "Catch Up", the AI assistant reads the current video title, playback timestamp (e.g. 05:20), and recent room discussion, querying Groq LLaMA 3.3 to deliver a crisp 2-3 bullet point summary.'
            },
            {
              q: 'Can I watch videos from my smartphone or tablet?',
              a: 'Yes! Watchooo is fully mobile-responsive. When connected to the same Wi-Fi network, you can use the LAN IP link to join directly from any mobile browser.'
            },
            {
              q: 'What video sources are supported?',
              a: 'Watchooo supports YouTube URLs, YouTube Shorts, direct MP4/WebM video streams, screen sharing, and local files on your computer.'
            }
          ].map((item, idx) => (
            <div
              key={idx}
              className={`faq-item ${activeFaq === idx ? 'open' : ''}`}
              onClick={() => toggleFaq(idx)}
            >
              <div className="faq-question">
                <span>{item.q}</span>
                <span className="faq-icon-wrapper">
                  <i className="fa-solid fa-chevron-down faq-chevron"></i>
                </span>
              </div>
              <div className={`faq-answer-collapse ${activeFaq === idx ? 'expanded' : ''}`}>
                <div className="faq-answer-inner">{item.a}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="home-footer">
        <div className="footer-top">
          <div className="footer-brand">
            <img src="/images/logo.png" alt="Watchooo Logo" className="brand-logo-img" />
            <span style={{ fontSize: '1.2rem', fontWeight: 800 }}>Watchooo</span>
          </div>
          <div className="footer-links">
            <a href="#features">Features</a>
            <a href="#ai-assistant">AI Assistant</a>
            <a href="#demos">Demo Videos</a>
            <a href="#faq">FAQ</a>
            <a href="https://github.com/harshalsonune55/watch_togather" target="_blank" rel="noreferrer">GitHub</a>
          </div>
        </div>

        <div className="footer-bottom">
          <div>&copy; {new Date().getFullYear()} Watchooo. Built for synchronized watch parties &amp; real-time video calls.</div>
          <div style={{ color: 'var(--mint)' }}>✨ Powered by WebRTC &amp; Groq LLaMA 3.3</div>
        </div>
      </footer>
    </div>
  );
}
