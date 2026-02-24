import { useState, useEffect } from 'react';
import GameBoard from './components/GameBoard';
import LoginScreen from './components/LoginScreen';
import LobbyScreen from './components/LobbyScreen';
import SettingsModal from './components/SettingsModal';
import { connectSocket } from './services/socket';
import { audioService } from './logic/audioService';
import './index.css';
import liff from '@line/liff';

function App() {
  const [mode, setMode] = useState<'AUTH' | 'LOBBY' | 'SINGLE' | 'MULTI'>('AUTH');
  const [roomId, setRoomId] = useState('lobby-1');
  const [username, setUsername] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const checkUrlForRoom = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomFromUrl = urlParams.get('room');
    if (roomFromUrl) {
      setRoomId(roomFromUrl);
      setMode('MULTI');
      window.history.replaceState({}, document.title, window.location.pathname);
      return true;
    }
    return false;
  };

  useEffect(() => {
    // Basic session persistence for guest login
    const savedUser = localStorage.getItem('mahjong_user');
    if (savedUser) {
      setUsername(savedUser);
      connectSocket();
      if (!checkUrlForRoom()) {
        setMode('LOBBY');
      }
    }
  }, []);

  // Load settings from localStorage when username is available
  useEffect(() => {
    if (username) {
      const savedSettings = localStorage.getItem(`mahjong_settings_${username}`);
      if (savedSettings) {
        try {
          const settings = JSON.parse(savedSettings);
          audioService.loadFromSerializable(settings);
        } catch (e) {
          console.error('Failed to parse saved settings', e);
        }
      }
    }
  }, [username]);

  const handleLogin = (name: string) => {
    setUsername(name);
    localStorage.setItem('mahjong_user', name);
    connectSocket();
    if (!checkUrlForRoom()) {
      setMode('LOBBY');
    }
  };

  const handleLogout = () => {
    try {
      if (liff && liff.isLoggedIn()) {
        liff.logout();
      }
    } catch (e) {
      console.error('LIFF Logout Error:', e);
    }
    setUsername(null);
    localStorage.removeItem('mahjong_user');
    setMode('AUTH');
  };

  const handleCreateRoom = () => {
    const id = Math.random().toString(36).substring(2, 8).toUpperCase();
    setRoomId(id);
    setMode('MULTI');
  };



  const handleJoinRoom = (id: string) => {
    setRoomId(id);
    setMode('MULTI');
  };

  const handleBackToLobby = () => {
    setMode('LOBBY');
  };

  let content;
  if (mode === 'AUTH') {
    content = <LoginScreen onLogin={handleLogin} />;
  } else if (mode === 'LOBBY') {
    content = (
      <LobbyScreen
        username={username || 'Guest'}
        onLogout={handleLogout}
        onCreateRoom={handleCreateRoom}
        onJoinRoom={handleJoinRoom}
        onOpenSettings={() => setShowSettings(true)}
      />
    );
  } else {
    content = (
      <GameBoard
        mode={mode === 'SINGLE' ? 'SINGLE' : 'MULTI'}
        roomId={roomId}
        username={username || 'Guest'}
        onBack={handleBackToLobby}
      />
    );
  }

  return (
    <div className="App">
      {content}
      {showSettings && <SettingsModal username={username || 'Guest'} onClose={() => setShowSettings(false)} />}
    </div>
  );
}

export default App;

