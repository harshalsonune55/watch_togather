import React, { useState, useEffect } from 'react';
import Lobby from './components/Lobby.jsx';
import Room from './components/Room.jsx';

export default function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname + window.location.search);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname + window.location.search);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
    window.scrollTo(0, 0);
  };

  const pathname = currentPath.split('?')[0];
  const search = currentPath.includes('?') ? currentPath.split('?')[1] : '';
  const queryParams = new URLSearchParams(search);

  if (pathname.startsWith('/room/')) {
    const rawRoom = pathname.replace('/room/', '');
    const roomId = decodeURIComponent(rawRoom.split('/')[0].split('#')[0]);
    const name = queryParams.get('name') || '';
    return <Room roomId={roomId} initialName={name} onNavigate={navigate} />;
  }

  return <Lobby onNavigate={navigate} />;
}
