import React, { useState, useEffect } from 'react';

const SAMPLE_VIDEOS = [
  {
    title: 'Big Buck Bunny (HD Animation)',
    type: 'html5',
    source: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    badge: 'MP4 • 1080p'
  },
  {
    title: 'Tears of Steel (Sci-Fi Demo)',
    type: 'html5',
    source: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
    badge: 'MP4 • Sci-Fi'
  },
  {
    title: 'Nature 4K Relaxation (YouTube)',
    type: 'youtube',
    source: '1ZYbU888YX8',
    badge: 'YouTube • 4K'
  },
  {
    title: 'Lofi Hip Hop - Chill Beats (YouTube)',
    type: 'youtube',
    source: 'jfKfPfyJRdk',
    badge: 'YouTube • Music'
  }
];

export default function Lobby({ onNavigate }) {
  const [displayName, setDisplayName] = useState(() => {
    return localStorage.getItem('wt_username') || 'Alex';
  });
  const [roomId, setRoomId] = useState('');
  const [videoLink, setVideoLink] = useState('');
  const [selectedSample, setSelectedSample] = useState(null);

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

  const handleSelectSample = (sample) => {
    setSelectedSample(sample.source);
    setVideoLink(sample.source);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    let targetRoom = (roomId || '').trim().toLowerCase();
    if (targetRoom.includes('/room/')) {
      targetRoom = targetRoom.split('/room/')[1].split('?')[0].split('#')[0].trim();
    }
    if (!targetRoom) {
      targetRoom = 'room-' + Math.random().toString(36).substring(2, 8);
    }
    const cleanName = (displayName || 'Alex').trim();
    localStorage.setItem('wt_username', cleanName);

    // If a custom video link was provided, store it temporarily for initial room setup
    if (videoLink.trim()) {
      sessionStorage.setItem('wt_pending_video_' + targetRoom, videoLink.trim());
    }

    onNavigate(`/room/${encodeURIComponent(targetRoom)}?name=${encodeURIComponent(cleanName)}`);
  };

  return (
    <div className="finsage-app">
      {/* Top Navigation Bar */}
      <nav className="finsage-nav">
        <a href="/" className="finsage-brand" onClick={(e) => { e.preventDefault(); onNavigate('/'); }}>
          <img src="/images/logo.png" alt="Watchooo Logo" className="brand-logo-img" />
          <span>Watchooo</span>
        </a>

        <div className="finsage-nav-links">
          <a href="#about" className="finsage-nav-link active">About us</a>
          <a href="#joinForm" className="finsage-nav-link">Direct Link</a>
          <a href="#joinForm" className="finsage-nav-link">Screen Share</a>
          <a href="#howToUse" className="finsage-nav-link">How to Use</a>
        </div>

        <a href="#joinForm" className="btn-mint-pill">
          <span>↗ Enter Theater</span>
        </a>
      </nav>

      {/* Hero Section */}
      <main className="finsage-hero">
        <div className="hero-tag-pill">
          <span className="hero-tag-dot"></span>
          <span>Zero-drift synchronization &amp; HD Video Call</span>
        </div>

        <div className="hero-columns">
          <h1 className="hero-big-title">
            Transform how<br />you watch together
          </h1>

          <div className="hero-right-side">
            <p className="hero-description">
              Paste any YouTube or direct video link to synchronize playback with zero drift, or share your screen directly in theater mode while enjoying a crystal-clear 2-way video call.
            </p>
            <div className="hero-actions">
              <a href="#joinForm" className="btn-mint-pill" style={{ padding: '12px 24px' }}>
                <span>↗ Enter Theater</span>
              </a>
              <a href="#joinForm" className="btn-glass-pill" style={{ padding: '12px 24px' }}>
                <span>Direct Link or Screen Share ▷</span>
              </a>
            </div>
          </div>
        </div>

        {/* Bento Showcase Card Container */}
        <div className="finsage-bento-container">
          
          {/* Left Column: Metrics & Vertical Bar Graph */}
          <div className="bento-left-col">
            <div className="user-stack-row">
              <div className="avatar-stack">
                <img className="avatar-stack-item" src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&q=80" alt="Viewer" />
                <img className="avatar-stack-item" src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&q=80" alt="Viewer" />
                <img className="avatar-stack-item" src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&q=80" alt="Viewer" />
                <img className="avatar-stack-item" src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&q=80" alt="Viewer" />
              </div>
              <div>
                <div className="avatar-stack-label">+150K</div>
                <div className="avatar-stack-sub">active watch parties</div>
              </div>
            </div>

            <div className="bento-metric-card">
              <div className="card-top-action">↗</div>
              <div className="metric-caption">More in-sync and seamless</div>
              <div className="metric-val-row">
                <div className="metric-big-num">99.8%</div>
                <div className="metric-badge-pill">↑ 0.02s drift</div>
              </div>

              {/* Rounded Vertical Bar Graph matching FinSage */}
              <div className="bar-chart-container">
                <div className="bar-col" style={{ height: '35%' }}></div>
                <div className="bar-col fill-white" style={{ height: '60%' }}></div>
                <div className="bar-col" style={{ height: '45%' }}></div>
                <div className="bar-col fill-white" style={{ height: '80%' }}></div>
                <div className="bar-col" style={{ height: '55%' }}></div>
                <div className="bar-col fill-white" style={{ height: '92%' }}></div>
                <div className="bar-col" style={{ height: '70%' }}></div>
                <div className="bar-col fill-white" style={{ height: '100%' }}></div>
              </div>
            </div>
          </div>

          {/* Right Column: Interactive Room Setup Form */}
          <div className="bento-interactive-card" id="joinForm">
            <div className="card-top-badge">
              <i className="fa-solid fa-sparkles" style={{ color: 'var(--mint)' }}></i>
              <span>Instant Video Room</span>
            </div>

            <h2 className="interactive-title">Create or Join a Room</h2>
            <p className="interactive-desc">
              Watch YouTube, direct MP4 streams, or broadcast your screen in sync with friends.
            </p>

            <form onSubmit={handleSubmit}>
              <div className="form-group-clean">
                <label className="input-label-clean" htmlFor="displayName">Your Display Name</label>
                <input
                  type="text"
                  id="displayName"
                  className="clean-input-box"
                  placeholder="e.g. Alex"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group-clean">
                <label className="input-label-clean" htmlFor="roomId">
                  Room Code or Paste Invite Link
                  <button type="button" onClick={generateRandomRoom} className="btn-text-action" style={{ float: 'right' }}>
                    🎲 Random Code
                  </button>
                </label>
                <input
                  type="text"
                  id="roomId"
                  className="clean-input-box"
                  placeholder="e.g. cinema-lounge-42 or leave empty for auto"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                />
              </div>

              <div className="form-group-clean">
                <label className="input-label-clean" htmlFor="videoLink">
                  Video Link (YouTube or Direct MP4 URL)
                  <span style={{ color: 'var(--text-dim)', fontWeight: 400, fontSize: '0.78rem' }}> (Optional)</span>
                </label>
                <input
                  type="text"
                  id="videoLink"
                  className="clean-input-box"
                  placeholder="https://www.youtube.com/watch?v=... or .mp4 file URL"
                  value={videoLink}
                  onChange={(e) => setVideoLink(e.target.value)}
                />
              </div>

              {/* Sample Videos Picker */}
              <div style={{ margin: '14px 0 18px' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '8px' }}>
                  Or pick a quick demo video:
                </div>
                <div className="sample-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))' }}>
                  {SAMPLE_VIDEOS.map((s) => (
                    <div
                      key={s.source}
                      className={`sample-card ${selectedSample === s.source ? 'active' : ''}`}
                      onClick={() => handleSelectSample(s)}
                    >
                      <span className="sample-badge">{s.badge}</span>
                      <div className="sample-name">{s.title}</div>
                    </div>
                  ))}
                </div>
              </div>

              <button type="submit" className="btn-mint-pill" style={{ width: '100%', padding: '14px', fontSize: '1rem' }}>
                <span>↗ Enter Watchooo Theater</span>
              </button>
            </form>
          </div>
        </div>

        {/* How To Use Section */}
        <section className="how-to-use" id="howToUse">
          <div className="how-to-use-inner">
            <h2 className="how-to-use-title">How Watchooo Works</h2>
            <div className="how-to-steps">
              <div className="how-to-step">
                <span className="step-badge">1</span>
                <h3>Create or Join</h3>
                <p>Enter your name, pick or generate a room code, and optionally paste a YouTube or video URL.</p>
              </div>
              <div className="how-to-step">
                <span className="step-badge">2</span>
                <h3>Share the Link</h3>
                <p>Send the invite link to your friend. If you're on the same Wi-Fi, the built-in LAN link lets phones and laptops connect instantly.</p>
              </div>
              <div className="how-to-step">
                <span className="step-badge">3</span>
                <h3>Watch, Talk &amp; Catch Up</h3>
                <p>Enjoy synchronized playback, 2-way WebRTC video calling, live chat, and our <strong>✨ Groq AI Assistant</strong> to catch up if you join late!</p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
