import { useState, useEffect } from 'react';
import GameBoard from './components/GameBoard';
import LoginScreen from './components/LoginScreen';
import LobbyScreen from './components/LobbyScreen';
import SettingsModal from './components/SettingsModal';
import { connectSocket } from './services/socket';
import { audioService } from './logic/audioService';
import liff from '@line/liff';
import './index.css';

function App() {
  const [mode, setMode] = useState<'AUTH' | 'LOBBY' | 'SINGLE' | 'MULTI'>('AUTH');
  const [roomId, setRoomId] = useState('lobby-1');
  const [username, setUsername] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    // Check for room invitation in URL
    const params = new URLSearchParams(window.location.search);
    const inviteRoomId = params.get('room');

    // Basic session persistence for guest login
    const savedUser = localStorage.getItem('mahjong_user');

    if (inviteRoomId) {
      setRoomId(inviteRoomId.toUpperCase());
      if (savedUser) {
        setUsername(savedUser);
        setMode('MULTI');
        connectSocket();
      } else {
        setMode('AUTH');
      }
    } else if (savedUser) {
      setUsername(savedUser);
      setMode('LOBBY');
      connectSocket();
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

    // Check if there's a room in the URL to join after login
    const params = new URLSearchParams(window.location.search);
    const inviteRoomId = params.get('room');

    if (inviteRoomId) {
      setRoomId(inviteRoomId.toUpperCase());
      setMode('MULTI');
    } else {
      setMode('LOBBY');
    }
    connectSocket();
  };

  const handleLogout = () => {
    if (liff.isLoggedIn()) {
      liff.logout();
    }
    setUsername(null);
    localStorage.removeItem('mahjong_user');
    setMode('AUTH');
    // Refresh to clear any internal state if needed
    window.location.reload();
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
    // Clear room param from URL when returning to lobby
    const url = new URL(window.location.href);
    url.searchParams.delete('room');
    window.history.replaceState({}, '', url.toString());

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

