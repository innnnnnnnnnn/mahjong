import React from 'react';

interface Player {
    id?: string;
    name: string;
    isHost?: boolean;
    isReady?: boolean;
    isAI?: boolean;
    socketId?: string;
}

interface RoomScreenProps {
    roomId: string;
    players: Player[];
    isHost: boolean;
    mySocketId: string;
    onCopyLink: () => void;
    onAddAI: () => void;
    onStartGame: () => void;
    onLeaveRoom: () => void;
}

const RoomScreen: React.FC<RoomScreenProps> = ({
    roomId,
    players,
    isHost,
    mySocketId,
    onCopyLink,
    onAddAI,
    onStartGame,
    onLeaveRoom
}) => {

    return (
        <div className="room-screen-container">
            <div className="room-panel">
                <div className="room-header">
                    <div>
                        <h1 className="room-title">房號: {roomId}</h1>
                        <p className="room-subtitle">等待玩家加入中... ({players.length}/4)</p>
                    </div>
                    <div className="room-header-actions">
                        <button
                            onClick={onCopyLink}
                            className="btn-copy-link"
                        >
                            📋 複製邀請連結
                        </button>
                        <button
                            onClick={onLeaveRoom}
                            className="btn-leave-room"
                        >
                            🚪 離開
                        </button>
                    </div>
                </div>

                <div className="player-slots-container">
                    {[0, 1, 2, 3].map((i) => {
                        const p = players[i];
                        const isMe = p && p.socketId === mySocketId;

                        return (
                            <div key={i} className={`player-slot ${p ? 'filled' : 'empty'}`}>
                                <div className="slot-info">
                                    <div className={`slot-avatar ${p ? 'filled' : ''}`}>
                                        {p ? (p.isAI ? '🤖' : '👤') : ''}
                                    </div>
                                    <div>
                                        <div className={`slot-name ${p ? 'filled' : ''}`}>
                                            {p ? p.name : '等待加入...'}
                                            {isMe && <span className="tag-me">我</span>}
                                        </div>
                                        {p?.isHost && <span className="tag-host">房主</span>}
                                    </div>
                                </div>
                                <div className="slot-action">
                                    {p ? <div className="status-text ready">已加入</div> : <div className="status-text waiting">等待中</div>}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="room-actions-footer">
                    {isHost ? (
                        <button
                            onClick={onStartGame}
                            className="btn-start-game"
                            style={{ gridColumn: 'span 2' }}
                        >
                            開始遊戲 (START)
                        </button>
                    ) : (
                        <div className="waiting-host-text" style={{ gridColumn: 'span 2' }}>等待房主開始...</div>
                    )}
                </div>

                <p className="room-footer-text">
                    真人人數不足四人時，房主可邀請電腦 AI 補位。
                </p>
            </div>
        </div>
    );
};

export default RoomScreen;
