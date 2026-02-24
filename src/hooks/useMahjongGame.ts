import { useState, useCallback, useEffect, useRef } from 'react';
import { createDeck, shuffleDeck } from '../logic/tiles';
import type { Tile } from '../logic/tiles';
import { sortHand, isHu, canPung, canChow, canMingKong, canAnKong, canJiaKong, calculateScores, getTingDiscards } from '../logic/gameLogic';
import type { Player, GameState } from '../logic/gameLogic';

import { decideDiscard, shouldAction } from '../logic/aiService';

import { socket } from '../services/socket';
import { audioService } from '../logic/audioService';

const AI_CHARACTERS = ['oneesan', 'milk', 'shota', 'loli', 'daige', 'google', 'denzi'];
const CHAR_DISPLAY_NAMES: Record<string, string> = {
    'oneesan': '大姐姐',
    'milk': '彌音',
    'shota': '正太',
    'loli': '蘿莉',
    'daige': '豪邁大哥',
    'google': 'Google 小姐',
    'denzi': '電子音'
};

const getRemainingAIChars = (count: number, excluded: Set<string>) => {
    let pool = AI_CHARACTERS.filter(c => !excluded.has(c));
    // Shuffle the pool
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, count);
};

export const useMahjongGame = (isMultiplayer: boolean = false, roomId: string = 'default-room', playerName: string = 'Guest') => {
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
    const [isConnecting, setIsConnecting] = useState(isMultiplayer);
    const [roomData, setRoomData] = useState<any>(null);
    const [myPlayerIndex, setMyPlayerIndex] = useState<number>(0);
    const [connectionError, setConnectionError] = useState<string | null>(null);
    const stateRef = useRef<GameState | null>(null);

    // Sync ref with state for use in callbacks without stale closures
    useEffect(() => {
        stateRef.current = gameState;
    }, [gameState]);

    // Audio trigger effect for state transitions
    useEffect(() => {
        if (!gameState) return;

        // Start of game/round
        if (gameState.status === 'DICE_ROLL') {
            audioService.playScenario('SHUFFLE');
        }

        // Settlement screen / End of round
        if (gameState.status === 'HU' || gameState.status === 'LIUJU') {
            audioService.playScenario('SHUFFLE');
        }
    }, [gameState?.status]);

    const syncStateWithServer = useCallback((action: string, data: any) => {
        if (isMultiplayer) {
            socket.emit('game_action', { roomId, action, data });
        }
    }, [isMultiplayer, roomId]);



    const addAI = useCallback(() => {
        if (isMultiplayer) {
            socket.emit('add_ai', roomId);
        }
    }, [isMultiplayer, roomId]);

    const initGame = useCallback((isContinuation: boolean = false, dealerIdx: number = 0) => {
        console.log(`[initGame] isMultiplayer: ${isMultiplayer}, roomId: ${roomId}, isContinuation: ${isContinuation}`);

        let nextDealerIdx = dealerIdx;
        let nextWindOfTheRound = gameState?.windOfTheRound || 0;

        if (isContinuation && gameState) {
            const isLianZhuang = gameState.status === 'LIUJU' || (gameState.status === 'HU' && gameState.winnerIndex === gameState.dealerIndex);
            if (!isLianZhuang) {
                const prevDealer = gameState.dealerIndex;
                nextDealerIdx = (prevDealer + 1) % 4;
                // If dealer rotates from North seat (index 3) back to East seat (index 0), advance the round wind
                if (prevDealer === 3) {
                    nextWindOfTheRound = (nextWindOfTheRound + 1) % 4;
                }
            }
        }

        if (isMultiplayer) {
            console.log(`[initGame] Emitting start_game to room ${roomId} (isContinuation: ${isContinuation})`);
            socket.emit('start_game', { roomId, isContinuation, dealerIdx: nextDealerIdx, windOfTheRound: nextWindOfTheRound });
            return;
        }

        // Single player logic
        const deck = shuffleDeck(createDeck());
        const pArray = gameState?.players;
        const players: Player[] = pArray ? pArray.map((p, idx) => {
            const isPrevDealer = idx === gameState?.dealerIndex;
            const isLianZhuang = isPrevDealer && (gameState?.status === 'LIUJU' || (gameState?.status === 'HU' && gameState?.winnerIndex === gameState?.dealerIndex));

            return {
                ...p, hand: [], flowerCards: [], exposedSets: [], discards: [],
                isLocked: false, isTing: false, score: p.score ?? 1000, roundScoreDelta: 0,
                streakCount: isLianZhuang ? (p.streakCount || 0) + 1 : 0
            };
        }) : (() => {
            const userChar = audioService.getVoiceCharacter();
            const aiChars = getRemainingAIChars(3, new Set([userChar]));

            return [
                { id: 'p0', name: playerName, hand: [], flowerCards: [], exposedSets: [], discards: [], isAI: false, streakCount: 0, score: 1000, roundScoreDelta: 0, voiceCharacter: userChar },
                { id: 'ai1', name: CHAR_DISPLAY_NAMES[aiChars[0]], hand: [], flowerCards: [], exposedSets: [], discards: [], isAI: true, streakCount: 0, score: 1000, roundScoreDelta: 0, voiceCharacter: aiChars[0] },
                { id: 'ai2', name: CHAR_DISPLAY_NAMES[aiChars[1]], hand: [], flowerCards: [], exposedSets: [], discards: [], isAI: true, streakCount: 0, score: 1000, roundScoreDelta: 0, voiceCharacter: aiChars[1] },
                { id: 'ai3', name: CHAR_DISPLAY_NAMES[aiChars[2]], hand: [], flowerCards: [], exposedSets: [], discards: [], isAI: true, streakCount: 0, score: 1000, roundScoreDelta: 0, voiceCharacter: aiChars[2] },
            ];
        })();

        const newState: GameState = {
            players,
            activePlayerIndex: nextDealerIdx,
            dealerIndex: nextDealerIdx,
            deck,
            lastDiscard: null,
            status: 'DICE_ROLL',
            pendingActions: [],
            winnerIndex: null,
            winType: null,
            windOfTheRound: nextWindOfTheRound,
            windOfTheHand: nextDealerIdx,
            dice: [],
            isContinuation,
            globalDiscards: [],
            pendingJiakong: null
        };

        setGameState(newState);
        syncStateWithServer('init', newState);
    }, [isMultiplayer, gameState, roomId, syncStateWithServer]);

    const createGameState = useCallback((room: any, isContinuation: boolean = false, dealerIdx: number = 0, windOfTheRound: number = 0) => {
        const deck = shuffleDeck(createDeck());

        // 1. Identify which AI already have characters in our current session
        const existingAssignments = new Map<string, string>();
        if (isContinuation) {
            stateRef.current?.players.forEach(oldP => {
                if (oldP.isAI && oldP.voiceCharacter) existingAssignments.set(oldP.id, oldP.voiceCharacter);
            });
        }

        const playerChar = audioService.getVoiceCharacter();
        const usedChars = new Set(existingAssignments.values());
        usedChars.add(playerChar);

        // 2. Prepare a pool for UNASSIGNED AI
        const unassignedAICount = room.players.filter((p: any) => p.isAI && !existingAssignments.has(p.id || p.socketId)).length;
        const newAIChars = getRemainingAIChars(unassignedAICount, usedChars);
        let poolIdx = 0;

        const players: Player[] = room.players.map((p: any, idx: number) => {
            const playerId = p.id || p.socketId;
            let voiceChar = (isContinuation ? p.voiceCharacter : null) || existingAssignments.get(playerId);

            if (p.isAI && !voiceChar) {
                voiceChar = newAIChars[poolIdx++];
            } else if (!p.isAI && !voiceChar) {
                // For humans, always prioritize current audioService setting if not a continuation
                voiceChar = isContinuation ? (p.voiceCharacter || audioService.getVoiceCharacter()) : audioService.getVoiceCharacter();
            }

            // Calculate streak inheritance/increment
            let streakCount = isContinuation ? (p.streakCount || 0) : 0;
            if (isContinuation && stateRef.current) {
                const prev = stateRef.current;
                const isPreviousDealer = idx === prev.dealerIndex;
                const isLianZhuangSituation = prev.status === 'LIUJU' || (prev.status === 'HU' && prev.winnerIndex === prev.dealerIndex);

                if (isPreviousDealer) {
                    streakCount = isLianZhuangSituation ? (prev.players[idx].streakCount || 0) + 1 : 0;
                } else {
                    streakCount = 0; // Only the dealer has a streak in Taiwan Mahjong
                }
            }

            return {
                id: playerId,
                name: p.isAI ? CHAR_DISPLAY_NAMES[voiceChar] : p.name,
                hand: [],
                flowerCards: [],
                exposedSets: [],
                discards: [],
                isAI: p.isAI,
                streakCount: streakCount,
                score: isContinuation ? (p.score ?? 1000) : 1000,
                roundScoreDelta: 0,
                voiceCharacter: voiceChar
            };
        });

        const newState: GameState = {
            players,
            activePlayerIndex: dealerIdx,
            dealerIndex: dealerIdx,
            deck,
            lastDiscard: null,
            status: 'DICE_ROLL',
            pendingActions: [],
            winnerIndex: null,
            winType: null,
            windOfTheRound: windOfTheRound,
            windOfTheHand: dealerIdx,
            dice: [],
            isContinuation,
            globalDiscards: [],
            pendingJiakong: null
        };
        setGameState(newState);
        syncStateWithServer('init', newState);
        console.log(`[createGameState] Initialized and synced state for room ${room.id}`);
    }, [syncStateWithServer]);


    const rollDice = useCallback(() => {
        if (!stateRef.current) return;
        const diceNum = [1, 2, 3].map(() => Math.floor(Math.random() * 6) + 1);
        const total = diceNum.reduce((a, b) => a + b, 0);

        audioService.playScenario('DICE');

        // 如果是第一局 (isContinuation = false 或是 streakCount=0 且還沒真的丟過骰子)，決定「起莊」
        // 但其實既然按了「擲骰子開局」，且狀態是 DICE_ROLL，我們可以在這階段結算起莊。
        // 起莊從東(0)算起，逆時針(0, 1, 2, 3)。也就是 total % 4. 
        // 1(東), 2(南), 3(西), 4(北), 5(東)...
        // 公式： offset = (total - 1) % 4.
        // 注意：座位在陣列裡 0=東, 1=南(下家), 2=西(對家), 3=北(上家) 這個順序剛好對應逆時針。
        let newDealerIdx = stateRef.current.dealerIndex;

        // Only set initial dealer on very first roll of a series
        if (!stateRef.current.isContinuation) {
            newDealerIdx = (total - 1) % 4;
        }

        const nextState = {
            ...stateRef.current,
            dice: diceNum,
            dealerIndex: newDealerIdx,
            activePlayerIndex: newDealerIdx, // Dealer draws first door
            status: 'DEALING' as const
        };
        setGameState(nextState);
        syncStateWithServer('rollDice', nextState);
    }, [syncStateWithServer]);

    const performDealing = useCallback(() => {
        if (!stateRef.current || stateRef.current.status !== 'DEALING') return;
        let deck = [...stateRef.current.deck];
        let players = [...stateRef.current.players.map(p => ({ ...p, hand: [...p.hand] }))];

        for (let i = 0; i < 64; i++) {
            const pIdx = (stateRef.current.dealerIndex + (Math.floor(i / 4))) % 4;
            const tile = deck.pop();
            if (tile) players[pIdx].hand.push(tile);
        }
        const door = deck.pop();
        if (door) players[stateRef.current.dealerIndex].hand.push(door);

        const nextState = { ...stateRef.current, dealerIndex: stateRef.current.dealerIndex, deck, players, status: 'FLOWER_REPLACE' as const };
        setGameState(nextState);
    }, []);

    const replaceFlowers = useCallback(() => {
        if (!stateRef.current || stateRef.current.status !== 'FLOWER_REPLACE') return;
        let deck = [...stateRef.current.deck];
        let players = stateRef.current.players.map(p => ({ ...p, hand: [...p.hand], flowerCards: [...p.flowerCards] }));
        const dealerIdx = stateRef.current.dealerIndex;

        let anyChanged = true;
        while (anyChanged) {
            anyChanged = false;
            // Process in order: Dealer (idx) -> Dealer+1 -> Dealer+2 -> Dealer+3
            for (let offset = 0; offset < 4; offset++) {
                const pIdx = (dealerIdx + offset) % 4;
                const p = players[pIdx];

                // Keep replacing until this player has no flowers
                let hasFlowers = true;
                while (hasFlowers && deck.length > 0) {
                    const flowers = p.hand.filter(t => t.type === 'FLOWER');
                    if (flowers.length > 0) {
                        anyChanged = true;
                        flowers.forEach(f => {
                            p.hand.splice(p.hand.indexOf(f), 1);
                            p.flowerCards.push(f);
                            const rep = deck.shift(); // From the back
                            if (rep) p.hand.push(rep);
                        });
                    } else {
                        hasFlowers = false;
                    }
                }
            }
        }

        players.forEach(p => p.hand = sortHand(p.hand));

        let initialStatus: 'PLAYING' | 'HU' = 'PLAYING';
        let winnerIndex: number | null = null;
        let winType: 'ZIMO' | 'RONG' | null = null;

        // Tian Hu check (Dealer has 17 cards, and isHu)
        if (isHu(players[dealerIdx].hand)) {
            initialStatus = 'HU';
            winnerIndex = dealerIdx;
            winType = 'ZIMO';
        }

        let nextState: GameState = {
            ...stateRef.current, deck, players, status: initialStatus, activePlayerIndex: stateRef.current.dealerIndex, winnerIndex, winType
        };

        if (initialStatus === 'HU') nextState = calculateScores(nextState);
        setGameState(nextState);
    }, []);

    const drawCard = useCallback(() => {
        if (stateRef.current?.status !== 'PLAYING') return;
        audioService.playScenario('DRAW');


        setGameState(prev => {
            if (!prev) return null;
            // 台灣麻將通常保留 16 張為海底
            if (prev.deck.length <= 16) return { ...prev, status: 'LIUJU' };

            const deck = [...prev.deck];
            const players = prev.players.map(p => ({ ...p, hand: [...p.hand], flowerCards: [...p.flowerCards] }));
            const p = players[prev.activePlayerIndex];
            p.isLocked = false;

            // 正常摸牌從牌堆前端(shift)
            let currentTile = deck.shift();

            // 如果摸到花牌，需從牌堆末端(pop)補牌
            while (currentTile && currentTile.type === 'FLOWER') {
                p.flowerCards.push(currentTile);
                currentTile = deck.pop();
            }

            if (!currentTile) return { ...prev, status: 'LIUJU' };

            p.hand.push(currentTile);

            const nextState = { ...prev, deck, players };
            if (isHu(p.hand)) {
                if (p.isAI || p.isTing) {
                    const winStateStr = { ...nextState, status: 'HU' as const, winnerIndex: prev.activePlayerIndex, winType: 'ZIMO' as const };
                    const winState = calculateScores(winStateStr);
                    syncStateWithServer('drawCard', winState);
                    return winState;
                }
            }
            syncStateWithServer('drawCard', nextState);
            return nextState;
        });
    }, [syncStateWithServer]);


    const discardTile = useCallback((tileId: string) => {
        audioService.playScenario('DISCARD');
        setGameState(prev => {
            if (!prev) return null;
            if (prev.status !== 'PLAYING') return prev; // Prevent discarding during ACTION_WINDOW or other states

            const players = prev.players.map(p => ({ ...p, hand: [...p.hand], discards: [...p.discards] }));
            const p = players[prev.activePlayerIndex];

            // Ensure the player actually has 17, 14, 11... tiles (meaning it's their turn to discard)
            if (p.hand.length % 3 !== 2) return prev;

            const idx = p.hand.findIndex(t => t.id === tileId);
            if (idx === -1) return prev;

            const [tile] = p.hand.splice(idx, 1);
            p.discards.push(tile);
            p.hand = sortHand(p.hand);

            const globalDiscards = [...(prev.globalDiscards || [])];
            globalDiscards.push({ tile, playerId: p.id });

            const nextState = { ...prev, players, lastDiscard: tile, status: 'ACTION_WINDOW' as const, pendingActions: [], globalDiscards };
            syncStateWithServer('discard', nextState);
            return nextState;
        });
        setSelectedTileId(null);
    }, [syncStateWithServer]);

    const processAction = useCallback((playerIndex: number, type: 'HU' | 'PUNG' | 'CHOW' | 'PASS' | 'MINGKONG' | 'ANKONG' | 'JIAKONG' | 'TING' | 'CANCEL_TING', data?: any) => {
        if (type !== 'PASS' && type !== 'TING' && type !== 'CANCEL_TING') {
            const scenario = type === 'HU' ? (stateRef.current?.status === 'PLAYING' ? 'ZIMO' : 'HU') :
                (type === 'ANKONG' || type === 'MINGKONG' || type === 'JIAKONG') ? 'KONG' : type;
            audioService.playScenario(scenario, stateRef.current?.players[playerIndex].voiceCharacter);
        }
        setGameState(prev => {
            if (!prev) return prev;

            const players = prev.players.map(p => ({
                ...p,
                hand: [...p.hand],
                exposedSets: [...p.exposedSets],
                discards: [...p.discards]
            }));

            if (type === 'CANCEL_TING') {
                players[playerIndex].isTing = false;
                const nextState = { ...prev, players };
                syncStateWithServer('cancel_ting', nextState);
                return nextState;
            }

            if (type === 'TING') {
                players[playerIndex].isTing = true;
                audioService.playScenario('TING', players[playerIndex].voiceCharacter);
                // If they have 17 tiles (it's their turn), auto-discard
                if (players[playerIndex].hand.length % 3 === 2) {
                    const p = players[playerIndex];
                    const candidates = getTingDiscards(p.hand);
                    const tileToDiscard = candidates.length > 0 ? candidates[0] : decideDiscard(p.hand, 'MEDIUM');
                    const idx = p.hand.findIndex(t => t.id === tileToDiscard.id);
                    if (idx !== -1) {
                        const [discarded] = p.hand.splice(idx, 1);
                        p.discards.push(discarded);
                        p.hand = sortHand(p.hand);

                        const globalDiscards = [...(prev.globalDiscards || [])];
                        globalDiscards.push({ tile: discarded, playerId: p.id });

                        const nextState = {
                            ...prev,
                            players,
                            lastDiscard: discarded,
                            status: 'ACTION_WINDOW' as const,
                            pendingActions: [],
                            globalDiscards
                        };
                        syncStateWithServer('ting', nextState);
                        setSelectedTileId(null);
                        return nextState;
                    }
                }
                const nextState = { ...prev, players };
                syncStateWithServer('ting', nextState);
                setSelectedTileId(null);
                return nextState;
            }

            // Actions that happen during ACTION_WINDOW (responding to a discard)
            if (['PASS', 'PUNG', 'CHOW', 'MINGKONG'].includes(type) && prev.status === 'ACTION_WINDOW') {
                if (type === 'PASS') {
                    if (prev.pendingJiakong) {
                        // 搶槓挑戰結束，完成加槓
                        const kongTile = prev.pendingJiakong;
                        const p = players[prev.activePlayerIndex];
                        const idx = p.hand.findIndex(t => t.id === kongTile.id);
                        if (idx !== -1) p.hand.splice(idx, 1);

                        const pungSetIdx = p.exposedSets.findIndex(s => s.type === 'PUNG' && s.tiles[0].type === kongTile.type && s.tiles[0].value === kongTile.value);
                        if (pungSetIdx !== -1) {
                            p.exposedSets[pungSetIdx].type = 'KONG';
                            p.exposedSets[pungSetIdx].tiles.push(kongTile);
                        }

                        const deck = [...prev.deck];
                        let replacement = deck.pop();
                        while (replacement && replacement.type === 'FLOWER') {
                            p.flowerCards.push(replacement);
                            replacement = deck.pop();
                        }
                        if (replacement) p.hand.push(replacement);

                        if (isHu(p.hand)) {
                            const huState = { ...prev, players, deck, status: 'HU' as const, winnerIndex: prev.activePlayerIndex, winType: 'ZIMO' as const, pendingJiakong: null, lastDiscard: null };
                            const finalState = calculateScores(huState);
                            syncStateWithServer('jiakong_hu', finalState);
                            return finalState;
                        }

                        if (deck.length <= 16) {
                            const liujuState = { ...prev, players, deck, status: 'LIUJU' as const, pendingJiakong: null, lastDiscard: null };
                            syncStateWithServer('liuju', liujuState);
                            return liujuState;
                        }

                        const nextState = { ...prev, players, deck, status: 'PLAYING' as const, pendingJiakong: null, lastDiscard: null };
                        syncStateWithServer('jiakong_final', nextState);
                        return nextState;
                    }
                    const nextPlayerIdx = (prev.activePlayerIndex + 1) % 4;
                    const nextState = { ...prev, status: 'PLAYING' as const, activePlayerIndex: nextPlayerIdx, lastDiscard: null };
                    syncStateWithServer('pass', nextState);
                    return nextState;
                }

                const p = players[playerIndex];
                const tile = prev.lastDiscard!;

                if (type === 'PUNG') {
                    for (let i = 0; i < 2; i++) {
                        const idx = p.hand.findIndex(t => t.type === tile.type && t.value === tile.value);
                        if (idx !== -1) p.hand.splice(idx, 1);
                    }
                    // Remove from discarder and global river
                    players[prev.activePlayerIndex].discards.pop();
                    const globalDiscards = [...prev.globalDiscards];
                    globalDiscards.pop();

                    p.exposedSets.push({ type: 'PUNG', tiles: [tile, tile, tile] });
                    const nextState = { ...prev, players, globalDiscards, status: 'PLAYING' as const, activePlayerIndex: playerIndex, lastDiscard: null };
                    syncStateWithServer('pung', nextState);
                    return nextState;
                }

                if (type === 'CHOW') {
                    const combo = data?.combo as Tile[] || canChow(p.hand, tile)[0];
                    if (combo) {
                        combo.forEach(comboTile => {
                            const idx = p.hand.findIndex(t => t.id === comboTile.id);
                            if (idx !== -1) p.hand.splice(idx, 1);
                        });
                        // Remove from discarder and global river
                        players[prev.activePlayerIndex].discards.pop();
                        const globalDiscards = [...prev.globalDiscards];
                        globalDiscards.pop();

                        // Arrange eaten tile in the middle: 吃到上一家的牌要放在組合的中間
                        // Requirement: 吃到上一家的牌要放在組合的中間 (eaten tile must be in the middle regardless of sequence order? Or maybe ordered like 2,4,3 if 4 is eaten? Let's assume order value but eaten tile placed strictly in the middle array index.)
                        const tilesArray = [combo[0], tile, combo[1]];

                        p.exposedSets.push({ type: 'CHOW', tiles: tilesArray });
                        const nextState = { ...prev, players, globalDiscards, status: 'PLAYING' as const, activePlayerIndex: playerIndex, lastDiscard: null };
                        syncStateWithServer('chow', nextState);
                        return nextState;
                    }
                }

                if (type === 'MINGKONG') {
                    for (let i = 0; i < 3; i++) {
                        const idx = p.hand.findIndex(t => t.type === tile.type && t.value === tile.value);
                        if (idx !== -1) p.hand.splice(idx, 1);
                    }
                    // Remove from discarder and global river
                    players[prev.activePlayerIndex].discards.pop();
                    const globalDiscards = [...prev.globalDiscards];
                    globalDiscards.pop();

                    p.exposedSets.push({ type: 'KONG', tiles: [tile, tile, tile, tile] });

                    const deck = [...prev.deck];
                    let replacement = deck.pop(); // 槓牌補牌應從牌堆末端(pop)
                    while (replacement && replacement.type === 'FLOWER') {
                        p.flowerCards.push(replacement);
                        replacement = deck.pop();
                    }
                    if (replacement) p.hand.push(replacement);

                    if (isHu(p.hand)) {
                        const huState = { ...prev, players, deck, status: 'HU' as const, winnerIndex: playerIndex, winType: 'ZIMO' as const, lastDiscard: null };
                        const finalState = calculateScores(huState);
                        syncStateWithServer('mingkong_hu', finalState);
                        return finalState;
                    }

                    if (deck.length <= 16) {
                        const liujuState = { ...prev, players, deck, status: 'LIUJU' as const };
                        syncStateWithServer('liuju', liujuState);
                        return liujuState;
                    }

                    const nextState = { ...prev, players, deck, globalDiscards, status: 'PLAYING' as const, activePlayerIndex: playerIndex, lastDiscard: null };
                    syncStateWithServer('mingkong', nextState);
                    return nextState;
                }
            }

            // Actions that happen during PLAYING
            if (['HU', 'ANKONG', 'JIAKONG'].includes(type) && prev.status === 'PLAYING') {
                const p = players[playerIndex];

                if (type === 'HU') {
                    const huState = { ...prev, status: 'HU' as const, winnerIndex: playerIndex, winType: 'ZIMO' as const };
                    const finalState = calculateScores(huState);
                    syncStateWithServer('hu', finalState);
                    return finalState;
                }

                if (type === 'ANKONG') {
                    const kongSet = data?.combo as Tile[];
                    if (kongSet) {
                        kongSet.forEach(kongTile => {
                            const idx = p.hand.findIndex(t => t.id === kongTile.id);
                            if (idx !== -1) p.hand.splice(idx, 1);
                        });
                        p.exposedSets.push({ type: 'ANKONG', tiles: kongSet });

                        const deck = [...prev.deck];
                        let replacement = deck.pop(); // 槓牌補牌應從牌堆末端(pop)
                        while (replacement && replacement.type === 'FLOWER') {
                            p.flowerCards.push(replacement);
                            replacement = deck.pop();
                        }
                        if (replacement) p.hand.push(replacement);

                        if (isHu(p.hand)) {
                            const huState = { ...prev, players, deck, status: 'HU' as const, winnerIndex: playerIndex, winType: 'ZIMO' as const, lastDiscard: null };
                            const finalState = calculateScores(huState);
                            syncStateWithServer('ankong_hu', finalState);
                            return finalState;
                        }

                        if (deck.length <= 16) {
                            const liujuState = { ...prev, players, deck, status: 'LIUJU' as const };
                            syncStateWithServer('liuju', liujuState);
                            return liujuState;
                        }

                        const nextState = { ...prev, players, deck, status: 'PLAYING' as const, lastDiscard: null };
                        syncStateWithServer('ankong', nextState);
                        return nextState;
                    }
                }

                if (type === 'JIAKONG') {
                    const kongTile = data?.tile as Tile;
                    if (kongTile) {
                        // 檢查是否有其他玩家可以搶槓
                        const canBeRobbed = players.some((p, idx) => idx !== playerIndex && isHu([...p.hand, kongTile]));
                        if (canBeRobbed) {
                            console.log("Jiakong attempt: can be robbed! Entering action window.");
                            const nextState = {
                                ...prev,
                                players,
                                status: 'ACTION_WINDOW' as const,
                                lastDiscard: kongTile,
                                pendingJiakong: kongTile,
                                activePlayerIndex: playerIndex
                            };
                            syncStateWithServer('jiakong_attempt', nextState);
                            return nextState;
                        }

                        const idx = p.hand.findIndex(t => t.id === kongTile.id);
                        if (idx !== -1) p.hand.splice(idx, 1);

                        const pungSetIdx = p.exposedSets.findIndex(s => s.type === 'PUNG' && s.tiles[0].type === kongTile.type && s.tiles[0].value === kongTile.value);
                        if (pungSetIdx !== -1) {
                            p.exposedSets[pungSetIdx].type = 'KONG';
                            p.exposedSets[pungSetIdx].tiles.push(kongTile);
                        }

                        const deck = [...prev.deck];
                        let replacement = deck.pop(); // 補牌
                        while (replacement && replacement.type === 'FLOWER') {
                            p.flowerCards.push(replacement);
                            replacement = deck.pop();
                        }
                        if (replacement) p.hand.push(replacement);

                        if (isHu(p.hand)) {
                            const huState = { ...prev, players, deck, status: 'HU' as const, winnerIndex: playerIndex, winType: 'ZIMO' as const, lastDiscard: null };
                            const finalState = calculateScores(huState);
                            syncStateWithServer('jiakong_hu', finalState);
                            return finalState;
                        }

                        if (deck.length <= 16) {
                            const liujuState = { ...prev, players, deck, status: 'LIUJU' as const };
                            syncStateWithServer('liuju', liujuState);
                            return liujuState;
                        }

                        const nextState = { ...prev, players, deck, status: 'PLAYING' as const, lastDiscard: null };
                        syncStateWithServer('jiakong', nextState);
                        return nextState;
                    }
                }
            }

            if (type === 'HU' && prev.status === 'ACTION_WINDOW') {
                const isQiangKong = !!prev.pendingJiakong;

                // If not robbing kong, remove the winning tile from the river/discarder
                if (!isQiangKong) {
                    players[prev.activePlayerIndex].discards.pop();
                    prev.globalDiscards.pop();
                }

                const huState = {
                    ...prev,
                    players, // use updated players with popped discards
                    status: 'HU' as const,
                    winnerIndex: playerIndex,
                    loserIndex: prev.activePlayerIndex,
                    winType: 'RONG' as const
                };
                const finalState = calculateScores(huState);
                finalState.pendingJiakong = null; // 結算後再清掉
                syncStateWithServer(isQiangKong ? 'qiangkong_hu' : 'hu', finalState);
                return finalState;
            }

            return prev;
        });
    }, [syncStateWithServer]);
    // Socket.io sync effect
    useEffect(() => {
        if (!isMultiplayer) return;

        socket.connect();
        setConnectionError(null);

        const join = () => {
            socket.emit('join_room', { roomId, playerName: playerName || localStorage.getItem('mahjong_user') || 'Guest' });
        };

        const onConnect = () => {
            setConnectionError(null);
            join();
        };

        const onConnectError = (err: Error) => {
            console.error("[Socket] Connection Error:", err.message);
            setConnectionError(`連線伺服器失敗。伺服器可能正在喚醒中 (免費主機冷啟動需約 50 秒)，請稍後並重整網頁。`);
        };

        const onRoomUpdate = (room: any) => {
            setRoomData(room);
            setIsConnecting(false);
            setConnectionError(null);
            const myIdx = room.players.findIndex((p: any) => p.socketId === socket.id);
            if (myIdx !== -1) setMyPlayerIndex(myIdx);
        };

        if (socket.connected) {
            join();
        }

        socket.on('connect', onConnect);
        socket.on('connect_error', onConnectError);
        socket.on('room_update', onRoomUpdate);

        socket.on('sync_state', ({ action: _action, data }) => {
            setGameState(data);
        });

        socket.on('game_started', (data) => {
            console.log("[useMahjongGame] Received game_started event", data);
            const { room, isContinuation, dealerIdx, windOfTheRound } = data;
            setRoomData(room);
            if (room.gameState) {
                console.log("[useMahjongGame] Setting existing gameState from room");
                setGameState(room.gameState);
            } else {
                const isHost = room.hostId === socket.id;
                console.log(`[useMahjongGame] Host check: room.hostId=${room.hostId}, socket.id=${socket.id}, isHost=${isHost}`);
                if (isHost) {
                    createGameState(room, isContinuation, dealerIdx, windOfTheRound);
                }
            }
        });

        return () => {
            socket.off('connect', onConnect);
            socket.off('connect_error', onConnectError);
            socket.off('room_update', onRoomUpdate);
            socket.off('sync_state');
            socket.off('game_started');
            socket.disconnect();
        };
    }, [isMultiplayer, roomId, createGameState]);

    // Local State Machine
    useEffect(() => {
        if (gameState?.status === 'DEALING') {
            performDealing();
        } else if (gameState?.status === 'FLOWER_REPLACE') {
            replaceFlowers();
        }
    }, [gameState?.status, performDealing, replaceFlowers]);

    // AI Reaction logic (Pung/Pass/Hu intercept)
    useEffect(() => {
        const isHost = roomData?.hostId === socket.id;
        // In multiplayer, ONLY the host manages AI automation
        if (isMultiplayer && !isHost) return;
        if (!gameState || gameState.status !== 'ACTION_WINDOW') return;

        const discarderIdx = gameState.activePlayerIndex;
        const lastTile = gameState.lastDiscard;
        if (!lastTile) return;

        const timer = setTimeout(() => {
            const players = gameState.players;
            let huProcessed = false;

            // 1. Check for HU using Intercepting Hu (攔胡) order: Next(1), Opposite(2), Previous(3)
            for (let i = 1; i <= 3; i++) {
                const pIdx = (discarderIdx + i) % 4;
                const p = players[pIdx];
                if (isHu([...p.hand, lastTile])) {
                    if (p.isAI || p.isTing) {
                        console.log(`Player ${p.name} performs Auto-HU! Intercept sequence: ${i}`);
                        processAction(pIdx, 'HU');
                        huProcessed = true;
                        return;
                    }
                }
            }

            if (huProcessed) return;

            // 2. See if the User has actions to perform (and isn't Ting)
            const user = players[0];
            const canUserHu = discarderIdx !== 0 && isHu([...user.hand, lastTile]);
            const canUserPung = discarderIdx !== 0 && canPung(user.hand, lastTile);
            const canUserChow = discarderIdx === 3 && canChow(user.hand, lastTile).length > 0;
            const canUserMingKong = discarderIdx !== 0 && canMingKong(user.hand, lastTile);
            const canUserAct = canUserHu || canUserPung || canUserChow || canUserMingKong;

            // If user can act and is NOT Ting, wait for user input. Do not process AI actions yet.
            if (!user.isAI && !user.isTing && canUserAct && discarderIdx !== 0) {
                return;
            }

            // 3. User can't act or passed. Evaluate AI logic (Pung > Chow)
            for (let i = 1; i <= 3; i++) {
                const pIdx = (discarderIdx + i) % 4;
                if (pIdx === 0) continue;
                const ai = players[pIdx];
                if (shouldAction(ai.hand, lastTile, 'PUNG')) {
                    console.log(`AI ${ai.name} performs PUNG!`);
                    processAction(pIdx, 'PUNG');
                    return;
                }
            }

            // Chow check for next AI player
            const nextIdx = (discarderIdx + 1) % 4;
            if (nextIdx !== 0 && players[nextIdx].isAI) {
                if (shouldAction(players[nextIdx].hand, lastTile, 'CHOW')) {
                    console.log(`AI ${players[nextIdx].name} performs CHOW!`);
                    processAction(nextIdx, 'CHOW');
                    return;
                }
            }

            // 4. No one did anything. Pass automatically.
            processAction(0, 'PASS');

        }, 1200);

        return () => clearTimeout(timer);
    }, [isMultiplayer, gameState?.status, gameState?.activePlayerIndex, gameState?.lastDiscard, processAction, gameState?.players]);


    // Turn Effect (Auto-draw / AI Play)
    useEffect(() => {
        const isHost = roomData?.hostId === socket.id;
        // In multiplayer, ONLY the host manages AI automation
        if (isMultiplayer && !isHost) return;
        if (!gameState || gameState.status !== 'PLAYING') return;

        const currentPlayer = gameState.players[gameState.activePlayerIndex];

        const timer = setTimeout(() => {
            if (currentPlayer.isAI) {
                if (currentPlayer.hand.length % 3 === 1) {
                    console.log(`AI ${currentPlayer.name} drawing card...`);
                    drawCard();
                } else if (currentPlayer.hand.length % 3 === 2) {
                    // AI 判斷是否胡牌 (自摸)
                    if (isHu(currentPlayer.hand)) {
                        console.log(`AI ${currentPlayer.name} performs ZIMO!`);
                        processAction(gameState.activePlayerIndex, 'HU');
                        return;
                    }

                    // AI 判斷是否槓牌
                    const ak = canAnKong(currentPlayer.hand);
                    if (ak.length > 0) {
                        console.log(`AI ${currentPlayer.name} performs ANKONG!`);
                        processAction(gameState.activePlayerIndex, 'ANKONG', { combo: ak[0] });
                        return;
                    }
                    const jk = canJiaKong(currentPlayer.hand, currentPlayer.exposedSets);
                    if (jk.length > 0) {
                        console.log(`AI ${currentPlayer.name} performs JIAKONG!`);
                        processAction(gameState.activePlayerIndex, 'JIAKONG', { tile: jk[0].tile });
                        return;
                    }

                    console.log(`AI ${currentPlayer.name} discarding card...`);
                    const tileToDiscard = decideDiscard(currentPlayer.hand, 'MEDIUM');
                    discardTile(tileToDiscard.id);
                }
            } else {
                // User Auto-draw
                if (currentPlayer.hand.length % 3 === 1) {
                    drawCard();
                } else if (currentPlayer.hand.length % 3 === 2 && currentPlayer.isTing) {
                    // Auto discard for Ting user (discard the freshly drawn tile, last in array)
                    const tileToDiscard = currentPlayer.hand[currentPlayer.hand.length - 1];
                    discardTile(tileToDiscard.id);
                }
            }
        }, currentPlayer.isAI ? 1000 : 300); // Faster draw for user

        return () => clearTimeout(timer);
    }, [

        gameState?.status,
        gameState?.activePlayerIndex,
        gameState?.players,
        gameState?.pendingJiakong,
        gameState?.lastDiscard,
        gameState?.deck.length,
        isMultiplayer,
        drawCard,
        discardTile
    ]);



    return {
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
        addAI,
        connectionError
    };
};


