import React, { useState } from 'react';

interface LobbyScreenProps {
    username: string;
    onLogout: () => void;
    onCreateRoom: () => void;
    onJoinRoom: (roomId: string) => void;
    onOpenSettings: () => void;
}

const LobbyScreen: React.FC<LobbyScreenProps> = ({ username, onLogout, onCreateRoom, onJoinRoom, onOpenSettings }) => {
    const [roomIdInput, setRoomIdInput] = useState("");

    const handleJoinRoom = (e: React.FormEvent) => {
        e.preventDefault();
        if (roomIdInput.trim()) {
            onJoinRoom(roomIdInput.toUpperCase());
        }
    };

    return (
        <div className="lobby-screen-container">
            <div className="lobby-header">
                <h1 className="lobby-title">麻將大廳 Lobby</h1>
                <div className="user-info-panel">
                    <div className="user-details">
                        <div className="user-name">{username}</div>
                        <div className="user-coins">💰 1,000</div>
                    </div>
                    <button onClick={onOpenSettings} className="btn-logout" style={{ marginRight: '10px', backgroundColor: '#555' }}>⚙️ 設定</button>
                    <button onClick={onLogout} className="btn-logout">登出 (Sign Out)</button>
                </div>
            </div>

            <div className="lobby-cards-container">
                <div className="lobby-card create-card">
                    <div className="card-icon">🀄</div>
                    <h2 className="card-title">建立新牌桌</h2>
                    <p className="card-desc">建立一個專屬房間，系統會自動填補電腦 AI，或邀請好友加入。</p>
                    <button
                        onClick={onCreateRoom}
                        className="btn-start"
                        style={{ width: '100%', padding: '1rem', boxShadow: '0 5px 0 rgb(180, 100, 0)' }}
                    >
                        建立房間 (CREATE)
                    </button>
                </div>

                <div className="lobby-card join-card">
                    <div className="card-icon">🔗</div>
                    <h2 className="card-title">加入現有房間</h2>
                    <form onSubmit={handleJoinRoom} className="join-form">
                        <input
                            type="text"
                            value={roomIdInput}
                            onChange={(e) => setRoomIdInput(e.target.value)}
                            placeholder="請輸入房間代碼"
                            className="join-input"
                        />
                        <button
                            type="submit"
                            className="btn-join"
                        >
                            加入房間 (JOIN)
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default LobbyScreen;
