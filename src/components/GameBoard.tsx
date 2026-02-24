import React, { useEffect, useState } from 'react';
import { useMahjongGame } from '../hooks/useMahjongGame';
import Tile from './Tile';
import { canPung, isHu, calculateTai, canChow, canMingKong, canAnKong, canJiaKong, canTing, getWaitingTiles } from '../logic/gameLogic';
import { motion, AnimatePresence } from 'framer-motion';
import { socket } from '../services/socket';
import { audioService } from '../logic/audioService';
import RoomScreen from './RoomScreen';
import { decideDiscard, AIDifficulty, shouldAction } from '../logic/aiService';

interface GameBoardProps {
    mode: 'SINGLE' | 'MULTI';
    roomId: string;
    username: string;
    onBack: () => void;
}

const GameBoard: React.FC<GameBoardProps> = ({ mode, roomId, username, onBack }) => {
    const isMultiplayer = mode === 'MULTI';

    const {
        gameState,
        initGame,
        rollDice,
        drawCard,
        discardTile,
        processAction,
        selectedTileId,
        setSelectedTileId,
        isConnecting,
        roomData,
        myPlayerIndex,
        addAI
    } = useMahjongGame(isMultiplayer, roomId, username);

    const [showDice, setShowDice] = useState(false);
    const [showChowPicker, setShowChowPicker] = useState(false);
    const [shake, setShake] = useState(false);
    const [showHuOverlay, setShowHuOverlay] = useState(false);
    const [tingHint, setTingHint] = useState<{ discards: any[] } | null>(null);
    const [isMuted, setIsMuted] = useState(audioService.isMuted());
    const [showAIHint, setShowAIHint] = useState(false);

    useEffect(() => {
        if (gameState?.status === 'HU') {
            setShowHuOverlay(true);
            setShake(true);
            setTimeout(() => setShake(false), 500);
            setTimeout(() => setShowHuOverlay(false), 3000);
        }
    }, [gameState?.status]);

    useEffect(() => {
        if (gameState?.status !== 'ACTION_WINDOW') {
            setShowChowPicker(false);
        }
    }, [gameState?.status]);

    const handleRollDice = () => {
        rollDice();
        setShowDice(true);
        setTimeout(() => setShowDice(false), 3000);
    };

    useEffect(() => {
        if (!gameState && !isConnecting && !isMultiplayer) {
            initGame();
        }
    }, [gameState, isConnecting, initGame, isMultiplayer]);

    const handleTileClick = (tileId: string) => {
        if (!gameState || gameState.status !== 'PLAYING') return;
        if (gameState.activePlayerIndex !== myPlayerIndex) return;

        const player = gameState.players[myPlayerIndex];
        if (player.isTing) return; // Cannot manually play while in Ting mode
        if (player.hand.length % 3 !== 2) return;

        if (selectedTileId === tileId) {
            discardTile(tileId);
            setTingHint(null);
        } else {
            setSelectedTileId(tileId);
            // Ting Hint Logic (Single Player Only)
            if (!isMultiplayer) {
                const discards = getTingDiscards(player.hand);
                const hint = discards.find(d => d.tileId === tileId);
                if (hint) {
                    setTingHint({ discards: hint.waitingTiles });
                } else {
                    setTingHint(null);
                }
            }
        }
    };

    const getWindName = (w: number) => ['東', '南', '西', '北'][w];
    const getTileName = (tile: any) => {
        if (tile.type === 'WAN') return `${tile.value}萬`;
        if (tile.type === 'TONG') return `${tile.value}筒`;
        if (tile.type === 'TIAO') return `${tile.value}條`;
        if (tile.type === 'WIND') {
            const windMap: any = { 'EAST': '東', 'SOUTH': '南', 'WEST': '西', 'NORTH': '北' };
            return windMap[tile.value] || tile.value;
        }
        if (tile.type === 'DRAGON') {
            const dragonMap: any = { 'ZHONG': '中', 'FA': '發', 'BAI': '白' };
            return dragonMap[tile.value] || tile.value;
        }
        return tile.value;
    };

    if (isConnecting) return <div className="loading">Connecting to Server...</div>;

    // Lobby / Waiting Room UI
    if (!gameState && roomData) {
        const myPlayer = roomData.players.find((p: any) => p.socketId === socket.id);
        const isHost = myPlayer?.isHost || roomData.hostId === socket.id;

        const handleCopyLink = () => {
            navigator.clipboard.writeText(window.location.href);
            alert("📋 複製邀請連結成功！請分享給好友。");
        };

        return (
            <RoomScreen
                roomId={roomId}
                players={roomData.players}
                isHost={isHost}
                mySocketId={socket.id || ''}
                onCopyLink={handleCopyLink}
                onAddAI={addAI}
                onStartGame={() => initGame()}
                onLeaveRoom={onBack}
            />
        );
    }

    if (!gameState) return <div className="loading">Waiting for Room to Start...</div>;
    const player = gameState.players[myPlayerIndex];
    if (!player) return <div className="loading">Initializing Player...</div>;

    const getPlayerWind = (pIdx: number, dealerIdx: number) => {
        const winds = ['東', '南', '西', '北'];
        let offset = pIdx - dealerIdx;
        if (offset < 0) offset += 4;
        return winds[offset];
    };

    const isMyTurn = gameState.activePlayerIndex === myPlayerIndex;

    const canUserPung = gameState.status === 'ACTION_WINDOW' && !isMyTurn && gameState.lastDiscard && canPung(player.hand, gameState.lastDiscard);
    const canUserHu = gameState.status === 'ACTION_WINDOW' && !isMyTurn && gameState.lastDiscard && isHu([...player.hand, gameState.lastDiscard]);

    // Chow from previous player
    const prevPlayerIdx = (myPlayerIndex + 3) % 4;
    const isPrevPlayerTurn = gameState.activePlayerIndex === prevPlayerIdx;
    const chowCombos = gameState.status === 'ACTION_WINDOW' && isPrevPlayerTurn && gameState.lastDiscard ? canChow(player.hand, gameState.lastDiscard) : [];
    const canUserChow = chowCombos.length > 0;

    const canUserMingKong = gameState.status === 'ACTION_WINDOW' && !isMyTurn && gameState.lastDiscard && canMingKong(player.hand, gameState.lastDiscard);

    const anKongCombos = gameState.status === 'PLAYING' && isMyTurn && player.hand.length % 3 === 2 ? canAnKong(player.hand) : [];
    const jiaKongCombos = gameState.status === 'PLAYING' && isMyTurn && player.hand.length % 3 === 2 ? canJiaKong(player.hand, player.exposedSets) : [];

    const canUserAnKong = anKongCombos.length > 0;
    const canUserJiaKong = jiaKongCombos.length > 0;
    const canUserPlayHu = gameState.status === 'PLAYING' && isMyTurn && player.hand.length % 3 === 2 && isHu(player.hand);
    const canUserTing = gameState.status === 'PLAYING' && isMyTurn && player.hand.length % 3 === 2 && !player.isTing && canTing(player.hand);

    const allOthersAreAI = isMultiplayer && gameState.players.filter((p, i) => i !== myPlayerIndex).every(p => p.isAI);
    const bestDiscardTileId = (allOthersAreAI && showAIHint && isMyTurn && player.hand.length % 3 === 2 && !player.isTing)
        ? decideDiscard(player.hand, AIDifficulty.HARD).id
        : null;

    //Seat positions logic: Bottom=0, Right=1, Top=2, Left=3 relative to myPlayerIndex


    return (
        <div className={`game-container ${shake ? 'shake' : ''}`}>
            <div className="mahjong-table">
                <button
                    className="btn-leave-room"
                    onClick={onBack}
                    style={{ position: 'absolute', top: '1%', left: '15px', zIndex: 1000, padding: '6px 15px', borderRadius: '12px', fontSize: '0.8rem', backgroundColor: 'rgba(0,0,0,0.3)' }}
                >
                    🏠 返回大廳
                </button>

                <button
                    onClick={() => {
                        const newMuted = !audioService.isMuted();
                        audioService.setMuted(newMuted);
                        setIsMuted(newMuted);
                    }}
                    style={{
                        position: 'absolute', top: '1%', right: '15px', zIndex: 1000,
                        background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: '12px', padding: '6px 12px', cursor: 'pointer', fontSize: '1.2rem',
                        transition: 'all 0.2s'
                    }}
                >
                    {isMuted ? '🔇' : '🔊'}
                </button>

                {/* Ting Hint Display */}
                {tingHint && !isMultiplayer && (
                    <div className="ting-hint-overlay" style={{
                        position: 'absolute', bottom: '150px', left: '50%', transform: 'translateX(-50%)',
                        background: 'rgba(0,0,0,0.8)', padding: '10px 20px', borderRadius: '12px',
                        border: '1px solid var(--accent-gold)', display: 'flex', alignItems: 'center', gap: '10px',
                        zIndex: 1000
                    }}>
                        <span style={{ color: 'var(--accent-gold)', fontWeight: 'bold' }}>聽牌提示：</span>
                        <div style={{ display: 'flex', gap: '5px' }}>
                            {tingHint.discards.map((t, i) => (
                                <Tile key={`hint-${i}`} tile={t} style={{ transform: 'scale(0.6)', margin: '-10px' }} />
                            ))}
                        </div>
                    </div>
                )}


                <div className="river-area">
                    <div className="river-center-blocker"></div>
                    {gameState.globalDiscards?.map((discardInfo, i) => (
                        <Tile key={`g-discard-${discardInfo.tile.id}-${i}`} tile={discardInfo.tile} className="river-tile" />
                    ))}
                </div>


                {gameState.players.map((p, idx) => {
                    const playerWind = getPlayerWind(idx, gameState.dealerIndex);
                    // Determine which CSS class to use (local player at bottom)
                    let seatPosIdx = (idx - myPlayerIndex + 4) % 4;
                    const posClasses = ['bottom', 'right', 'top', 'left'];
                    const posClass = posClasses[seatPosIdx];

                    return (
                        <div key={`info-${idx}`} className={`player-info pi-${posClass} ${gameState.activePlayerIndex === idx ? 'active' : ''}`}>
                            <div className="pi-streak-container">
                                {gameState.dealerIndex === idx && (
                                    <div className={`dealer-badge ${p.streakCount && p.streakCount > 0 ? 'streak-active' : ''}`}>
                                        {p.streakCount && p.streakCount > 0 ? `🔥 莊 +${p.streakCount}` : '莊'}
                                    </div>
                                )}
                            </div>
                            <div className="player-name">
                                <span className="wind-badge">{playerWind}</span> {p.name}
                                {p.isTing && <span style={{ color: 'yellow', marginLeft: '5px', fontWeight: 'bold' }}>[聽]</span>}
                            </div>
                            <div className="flower-count">🌸 {p.flowerCards.length}</div>
                            <div className="score-count">💰 {p.score}</div>

                            {/* AI Hint Switch on My Info Panel only */}
                            {allOthersAreAI && posClass === 'bottom' && (
                                <div className="ai-hint-switch-container">
                                    <span className="ai-hint-label">💡提示</span>
                                    <label className="switch">
                                        <input type="checkbox" checked={showAIHint} onChange={(e) => setShowAIHint(e.target.checked)} />
                                        <span className="slider round"></span>
                                    </label>
                                </div>
                            )}
                        </div>
                    );
                })}

                <div className={`player-area player-bottom ${player.isTing ? 'ting-aura' : ''}`}>
                    <div className="exposed-sets">
                        {player.exposedSets.map((set, setIdx) => (
                            <div key={`exp-${setIdx}`} className="exposed-set">
                                {set.tiles.map((t, i) => {
                                    const isAnkong = set.type === 'ANKONG';
                                    return <Tile key={t.id + i} tile={t} isFaceDown={false} isDimmed={isAnkong} />;
                                })}
                            </div>
                        ))}
                    </div>
                    <div className="hand">
                        {player.hand.map((t, idx) => {
                            const isNewlyDrawn = gameState.activePlayerIndex === myPlayerIndex &&
                                player.hand.length % 3 === 2 &&
                                idx === player.hand.length - 1;
                            return (
                                <div key={t.id} style={{ position: 'relative' }} className={isNewlyDrawn ? 'tile-gap' : ''}>
                                    {bestDiscardTileId === t.id && (
                                        <div className="ai-suggest-arrow">▼</div>
                                    )}
                                    <Tile
                                        tile={t}
                                        selected={selectedTileId === t.id}
                                        onClick={() => handleTileClick(t.id)}
                                        className={`${isNewlyDrawn ? 'drawn-glow' : ''}`}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>

                {['right', 'top', 'left'].map((pos, i) => {
                    const relativeIdx = i + 1; // 1, 2, 3
                    const actualIdx = (myPlayerIndex + relativeIdx) % 4;
                    const otherPlayer = gameState.players[actualIdx];

                    return (
                        <div key={pos} className={`player-area player-${pos}`}>
                            <div className="exposed-sets">
                                {otherPlayer.exposedSets.map((set, setIdx) => (
                                    <div key={`exp-${setIdx}`} className="exposed-set">
                                        {set.tiles.map((t, tidx) => {
                                            const isAnkong = set.type === 'ANKONG';
                                            const isHidden = isAnkong;
                                            return <Tile key={t.id + tidx} tile={t} isFaceDown={isHidden} />;
                                        })}
                                    </div>
                                ))}
                            </div>
                            <div className="hand">
                                {otherPlayer.hand.map((t, tidx) => {
                                    const isNewlyDrawn = gameState.activePlayerIndex === actualIdx &&
                                        otherPlayer.hand.length % 3 === 2 &&
                                        tidx === otherPlayer.hand.length - 1;
                                    return (
                                        <Tile
                                            key={t.id}
                                            tile={t}
                                            isFaceDown
                                            className={isNewlyDrawn ? 'tile-gap' : ''}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}

                {gameState.status === 'ACTION_WINDOW' && gameState.lastDiscard && (
                    <div className="center-discard-pop flex-center">
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}>
                            <Tile tile={gameState.lastDiscard} className="massive-tile" />
                        </motion.div>
                    </div>
                )}


                {gameState.status !== 'WAITING' && gameState.status !== 'SETTLEMENT' && (
                    <div className="center-info-board" style={{ top: '50%' }}>
                        {gameState.status === 'DICE_ROLL' ? (
                            <button className="btn btn-primary" onClick={handleRollDice} style={{ fontSize: '1.5rem', padding: '15px 40px' }}>
                                擲骰子開局
                            </button>
                        ) : showDice && gameState.dice && gameState.dice.length > 0 ? (
                            <div className="dice-display" style={{ fontSize: '2rem' }}>
                                🎲 {gameState.dice.reduce((a, b) => a + b, 0)} <span style={{ fontSize: '0.6em' }}>({gameState.dice.join(' ')})</span>
                            </div>
                        ) : (
                            <div className="wind-round-info" style={{ display: 'flex', alignItems: 'center', gap: '15px', fontSize: '1.2rem', fontWeight: 'bold' }}>
                                <span style={{ color: 'var(--accent-gold)' }}>{getWindName(gameState.windOfTheRound)}風{getWindName(gameState.windOfTheHand)}局</span>
                                <div className="deck-circle">
                                    {gameState.deck.length}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div className="main-controls">
                    {/* 正常出牌控制 */}
                    {gameState.status === 'PLAYING' && isMyTurn && !player.isTing && (
                        <>
                            {player.hand.length === 16 && (
                                <button className="btn btn-action" onClick={drawCard}>摸牌</button>
                            )}
                            {player.hand.length === 17 && (
                                <>
                                    {canUserTing && (
                                        <button className="btn btn-action" style={{ background: 'var(--accent-gold)', color: 'black' }} onClick={() => processAction(0, 'TING')}>聽牌</button>
                                    )}
                                    {canUserPlayHu && (
                                        <button className="btn btn-hu" onClick={() => processAction(0, 'HU')}>胡牌</button>
                                    )}
                                    {canUserAnKong && (
                                        <button className="btn btn-action" onClick={() => processAction(0, 'ANKONG', { combo: anKongCombos[0] })}>暗槓</button>
                                    )}
                                    {canUserJiaKong && (
                                        <button className="btn btn-action" onClick={() => processAction(0, 'JIAKONG', { tile: jiaKongCombos[0].tile })}>槓</button>
                                    )}
                                </>
                            )}
                        </>
                    )}

                    {/* 聽牌模式下的控制：持久顯示取消按鈕 */}
                    {player.isTing && gameState.status !== 'SETTLEMENT' && gameState.status !== 'WAITING' && (
                        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                            <button className="btn btn-action" style={{ background: '#555', border: '1px solid #777' }} onClick={() => processAction(myPlayerIndex, 'CANCEL_TING')}>
                                🚫 取消聽牌
                            </button>
                            {/* 聽牌時如果輪到自己且可以自摸，雖然會自動胡，但也保留手動按鈕以防萬一 */}
                            {isMyTurn && player.hand.length === 17 && canUserPlayHu && (
                                <button className="btn btn-hu" onClick={() => processAction(myPlayerIndex, 'HU')}>胡牌</button>
                            )}
                        </div>
                    )}
                </div>

                {gameState.status === 'ACTION_WINDOW' && (canUserPung || canUserHu || canUserChow || canUserMingKong) && !showChowPicker && (() => {
                    const recHu = canUserHu;
                    const recMingKong = !recHu && canUserMingKong;
                    const recPung = !recHu && !recMingKong && canUserPung && shouldAction(player.hand, gameState.lastDiscard!, 'PUNG');
                    const recChow = !recHu && !recMingKong && !recPung && canUserChow && shouldAction(player.hand, gameState.lastDiscard!, 'CHOW');
                    const recPass = !recHu && !recMingKong && !recPung && !recChow;

                    const renderArrow = (isRec: boolean) => (allOthersAreAI && showAIHint && isRec) ? <div className="ai-suggest-arrow">▼</div> : null;

                    return (
                        <div className="reaction-menu">
                            {canUserHu && <button className="btn btn-hu" style={{ position: 'relative' }} onClick={() => processAction(myPlayerIndex, 'HU')}>{renderArrow(recHu)}胡牌</button>}
                            {canUserMingKong && <button className="btn btn-action" style={{ position: 'relative' }} onClick={() => processAction(myPlayerIndex, 'MINGKONG')}>{renderArrow(recMingKong)}槓</button>}
                            {canUserPung && <button className="btn btn-action" style={{ position: 'relative' }} onClick={() => processAction(myPlayerIndex, 'PUNG')}>{renderArrow(recPung)}碰</button>}
                            {canUserChow && <button className="btn btn-action" style={{ position: 'relative' }} onClick={() => {
                                if (chowCombos.length > 1) {
                                    setShowChowPicker(true);
                                } else {
                                    processAction(myPlayerIndex, 'CHOW', { combo: chowCombos[0] });
                                }
                            }}>{renderArrow(recChow)}吃</button>}
                            <button className="btn" style={{ position: 'relative' }} onClick={() => processAction(myPlayerIndex, 'PASS')}>{renderArrow(recPass)}過</button>
                        </div>
                    );
                })()}

                <AnimatePresence>
                    {showChowPicker && gameState.status === 'ACTION_WINDOW' && gameState.lastDiscard && (
                        <motion.div className="chow-picker-menu" initial={{ opacity: 0, y: 30, x: '-50%' }} animate={{ opacity: 1, y: 0, x: '-50%' }} exit={{ opacity: 0, y: 30, x: '-50%' }}>
                            <h3 style={{ margin: '0 0 15px 0', color: 'var(--accent-gold)' }}>選擇吃牌組合</h3>
                            <div className="chow-combo-list">
                                {chowCombos.map((combo, idx) => {
                                    const fullCombo = [...combo, gameState.lastDiscard!].sort((a, b) => Number(a.value) - Number(b.value));
                                    const isRecChowCombo = idx === 0; // default suggest first combo
                                    return (
                                        <div key={`chow-${idx}`} className="chow-combo-btn" style={{ position: 'relative' }} onClick={() => {
                                            setShowChowPicker(false);
                                            processAction(0, 'CHOW', { combo });
                                        }}>
                                            {allOthersAreAI && showAIHint && isRecChowCombo && <div className="ai-suggest-arrow" style={{ top: '-15px' }}>▼</div>}
                                            {fullCombo.map(t => (
                                                <div key={t.id} className={t.id === gameState.lastDiscard!.id ? 'eaten-tile-wrapper win-highlight' : 'eaten-tile-wrapper'}>
                                                    <Tile tile={t} />
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })}
                            </div>
                            <button className="btn btn-action" style={{ marginTop: '20px', padding: '5px 30px', background: '#555' }} onClick={() => setShowChowPicker(false)}>取消</button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {gameState.status === 'PLAYING' && isMyTurn && player.hand.length % 3 === 2 && (canUserPlayHu || canUserAnKong || canUserJiaKong || canUserTing) && (
                    <div className="reaction-menu" style={{ transform: 'translate(-50%, -150%)' }}>
                        {canUserPlayHu && <button className="btn btn-hu btn-juice" onClick={() => processAction(myPlayerIndex, 'HU')}>自摸</button>}
                        {canUserAnKong && <button className="btn btn-action btn-juice" onClick={() => processAction(myPlayerIndex, 'ANKONG', { combo: anKongCombos[0] })}>暗槓</button>}
                        {canUserJiaKong && <button className="btn btn-action btn-juice" onClick={() => processAction(myPlayerIndex, 'JIAKONG', { tile: jiaKongCombos[0].tile })}>加槓</button>}
                        {canUserTing && <button className="btn btn-primary btn-juice" onClick={() => processAction(myPlayerIndex, 'TING')}>宣告聽牌 (自動代打)</button>}
                    </div>
                )}

                <AnimatePresence>
                    {showHuOverlay && (
                        <motion.div
                            className="hu-overlay"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                        >
                            <motion.div
                                className="hu-text"
                                initial={{ scale: 0, rotate: -20 }}
                                animate={{ scale: 1, rotate: 0 }}
                                transition={{ type: 'spring', damping: 10, stiffness: 100 }}
                            >
                                胡
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <AnimatePresence>
                    {(gameState.status === 'HU' || gameState.status === 'LIUJU') && (
                        <motion.div className="overlay-menu" initial={{ opacity: 0, scale: 0.8, x: '-50%', y: '-50%' }} animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }}>
                            <div className="settlement-header">
                                <h2 className={gameState.status === 'HU' ? (gameState.winType === 'ZIMO' ? 'zimo-text' : 'rong-text') : 'liuju-text'}>
                                    {gameState.status === 'HU' ? `${gameState.players[gameState.winnerIndex!].name} ${gameState.winType === 'ZIMO' ? '自摸' : '胡牌'}！` : '流局 (和局)'}
                                </h2>
                                {(gameState.status === 'HU' || gameState.status === 'LIUJU') && (
                                    <div className="settlement-info-row" style={{
                                        marginTop: '15px',
                                        display: 'grid',
                                        gridTemplateColumns: '1fr auto 1fr',
                                        alignItems: 'center',
                                        width: '100%',
                                        fontSize: '0.9rem',
                                        color: 'rgba(255,255,255,0.6)',
                                        borderTop: '1px solid rgba(255,255,255,0.05)',
                                        paddingTop: '10px'
                                    }}>
                                        <div style={{ textAlign: 'left' }}>
                                            {getWindName(gameState.windOfTheRound)}風{getWindName(gameState.windOfTheHand)}局 | 剩餘牌數: {gameState.deck.length} 張
                                        </div>

                                        <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--accent-gold)', display: 'flex', alignItems: 'center' }}>
                                            {gameState.status === 'HU' ? (
                                                <>
                                                    聽哪幾張牌：
                                                    <span style={{ color: 'white', marginLeft: '6px' }}>
                                                        {(() => {
                                                            const winnerIdx = gameState.winnerIndex;
                                                            if (winnerIdx === null) return '';
                                                            const winner = gameState.players[winnerIdx];
                                                            // 自摸時手牌已有 3n+2 張，需取前 3n+1 張來計算聽牌
                                                            // 榮胡時手牌只有 3n+1 張，直接計算即可
                                                            const handBeforeWin = gameState.winType === 'ZIMO'
                                                                ? winner.hand.slice(0, winner.hand.length - 1)
                                                                : winner.hand;
                                                            return getWaitingTiles(handBeforeWin).map(t => getTileName(t)).join(', ');
                                                        })()}
                                                    </span>
                                                </>
                                            ) : (
                                                <span style={{ fontStyle: 'italic', opacity: 0.8 }}>和局 (流局)</span>
                                            )}
                                        </div>

                                        <div style={{ textAlign: 'right' }}>
                                            (底 $50 / 台 $20)
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="settlement-body">
                                {gameState.status === 'HU' && (() => {
                                    const winner = gameState.players[gameState.winnerIndex!];
                                    return (
                                        <div className="winning-hand-display small-tile" style={{ marginBottom: '15px', display: 'flex', flexWrap: 'nowrap', overflowX: 'auto', paddingBottom: '5px' }}>
                                            {winner.exposedSets.map((set, setIdx) => (
                                                <div key={`exp-${setIdx}`} style={{ display: 'flex', gap: '2px', marginRight: '8px', borderRight: '1px solid rgba(255,255,255,0.1)', paddingRight: '8px' }}>
                                                    {set.tiles.map((t, i) => <Tile key={`exp-t-${i}`} tile={t} />)}
                                                </div>
                                            ))}
                                            <div style={{ display: 'flex', gap: '2px' }}>
                                                {winner.hand.map((t, i) => (
                                                    <Tile key={`h-${i}`} tile={t} className={(gameState.winType === 'ZIMO' && i === winner.hand.length - 1) ? 'win-highlight' : ''} />
                                                ))}
                                            </div>
                                            {gameState.lastDiscard && gameState.winType !== 'ZIMO' && (
                                                <div className="winning-tile win-highlight" style={{ marginLeft: '8px' }}>
                                                    <Tile tile={gameState.lastDiscard} />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}

                                <div className="settlement-details-row" style={{ display: 'flex', gap: '15px', alignItems: 'stretch' }}>
                                    {gameState.status === 'HU' && (() => {
                                        const taiResult = calculateTai(gameState, gameState.winnerIndex!);
                                        return (
                                            <div className="tai-breakdown-container" style={{ flex: 1 }}>
                                                <div className="tai-list">
                                                    {taiResult.details.map((d, i) => (
                                                        <div key={`tai-${i}`} className="tai-row">
                                                            <span>{d.name}</span>
                                                            <span className="tai-value">{d.tai} 台</span>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="tai-total" style={{ borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: '8px', marginTop: '8px', fontSize: '1.2rem' }}>
                                                    總計：{taiResult.total} 台
                                                    <div style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.5)', fontWeight: 'normal', marginTop: '4px' }}>
                                                        計算：底 $50 + ({taiResult.total} 台 × $20) = ${50 + taiResult.total * 20}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    <div className="cash-flow-container" style={{ flex: 1, margin: 0 }}>
                                        {gameState.players.map((p, idx) => {
                                            const delta = p.roundScoreDelta || 0;
                                            const isWinner = gameState.winnerIndex === idx;
                                            const isLoser = gameState.loserIndex === idx && gameState.winType === 'RONG';
                                            let itemClass = 'cash-flow-item';
                                            if (isWinner) itemClass += ' winner';
                                            if (isLoser) itemClass += ' loser';

                                            return (
                                                <div key={`settle-${idx}`} className={itemClass}>
                                                    <div className="cf-player">
                                                        <span className="cf-wind">{getPlayerWind(idx, gameState.dealerIndex)}</span>
                                                        <span className="cf-name">{p.name} {gameState.dealerIndex === idx ? '(莊)' : ''}</span>
                                                    </div>
                                                    <div className={`cf-score ${delta > 0 ? 'positive' : delta < 0 ? 'negative' : ''}`}>
                                                        {delta > 0 ? `+${delta}` : delta}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>


                            </div>

                            <div className="settlement-actions" style={{ pointerEvents: 'auto' }}>
                                <button className="btn btn-action" style={{ pointerEvents: 'auto' }} onClick={() => {
                                    if (isMultiplayer) socket.emit('leave_room', roomId);
                                    onBack();
                                }}>退出大廳</button>
                                <button className="btn btn-primary" style={{ pointerEvents: 'auto' }} onClick={() => initGame(true, gameState.dealerIndex)}>開始下一局</button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {gameState.status === 'DEALING' && <div className="overlay-info">正在配牌...</div>}
            </div>
        </div>
    );
};

export default GameBoard;
