import type { Tile } from './tiles';

export interface Player {
    id: string;
    name: string;
    hand: Tile[];
    flowerCards: Tile[];
    exposedSets: ExposedSet[];
    discards: Tile[];
    isAI: boolean;
    isLocked?: boolean; // 過水鎖定
    streakCount?: number; // 連莊數
    isTing?: boolean; // 聽牌狀態
    score: number; // 玩家籌碼
    roundScoreDelta?: number; // 當局輸贏籌碼 (for UI settlement)
    voiceCharacter?: string; // 語音角色
}

export interface ExposedSet {
    type: 'CHOW' | 'PUNG' | 'KONG' | 'ANKONG';
    tiles: Tile[];
}

export interface GameState {
    players: Player[];
    activePlayerIndex: number;
    dealerIndex: number;
    deck: Tile[];
    lastDiscard: Tile | null;
    status: 'WAITING' | 'DICE_ROLL' | 'DEALING' | 'FLOWER_REPLACE' | 'PLAYING' | 'ACTION_WINDOW' | 'HU' | 'LIUJU' | 'SETTLEMENT';
    pendingActions: PendingAction[];
    winnerIndex: number | null;
    loserIndex?: number | null; // 放槍者 (若自摸則為 null)
    winType: 'ZIMO' | 'RONG' | null;
    windOfTheRound: number;
    windOfTheHand: number;
    dice: number[];
    isContinuation: boolean;
    globalDiscards: { tile: Tile, playerId: string }[];
    pendingJiakong: Tile | null;
}

export interface PendingAction {
    playerIndex: number;
    type: 'HU' | 'PUNG' | 'KONG' | 'CHOW';
    data?: any;
}

export const sortHand = (hand: Tile[]): Tile[] => {
    const typeOrder: Record<string, number> = {
        'WAN': 1, 'TONG': 2, 'TIAO': 3, 'WIND': 4, 'DRAGON': 5, 'FLOWER': 6,
    };
    const windOrder: Record<string, number> = { 'EAST': 1, 'SOUTH': 2, 'WEST': 3, 'NORTH': 4 };
    const dragonOrder: Record<string, number> = { 'ZHONG': 1, 'FA': 2, 'BAI': 3 };

    return [...hand].sort((a, b) => {
        if (a.type !== b.type) return typeOrder[a.type] - typeOrder[b.type];
        if (['WAN', 'TONG', 'TIAO'].includes(a.type)) return (a.value as number) - (b.value as number);
        if (a.type === 'WIND') return windOrder[a.value as string] - windOrder[b.value as string];
        if (a.type === 'DRAGON') return dragonOrder[a.value as string] - dragonOrder[b.value as string];
        return 0;
    });
};

export const isHu = (hand: Tile[]): boolean => {
    if (hand.length % 3 !== 2) return false;
    const sorted = sortHand(hand);

    const checkDecompose = (currentHand: Tile[]): boolean => {
        if (currentHand.length === 0) return true;

        const first = currentHand[0];

        // Triplet
        const tripletMatch = currentHand.filter(t => t.type === first.type && t.value === first.value);
        if (tripletMatch.length >= 3) {
            const remaining = [...currentHand];
            let removed = 0;
            for (let i = 0; i < remaining.length && removed < 3; i++) {
                if (remaining[i].type === first.type && remaining[i].value === first.value) {
                    remaining.splice(i, 1);
                    i--; removed++;
                }
            }
            if (checkDecompose(remaining)) return true;
        }

        // Sequence
        if (['WAN', 'TONG', 'TIAO'].includes(first.type)) {
            const v = first.value as number;
            const next1 = currentHand.find(t => t.type === first.type && t.value === v + 1);
            const next2 = currentHand.find(t => t.type === first.type && t.value === v + 2);
            if (next1 && next2) {
                const remaining = [...currentHand];
                remaining.splice(remaining.indexOf(first), 1);
                remaining.splice(remaining.indexOf(next1), 1);
                remaining.splice(remaining.indexOf(next2), 1);
                if (checkDecompose(remaining)) return true;
            }
        }
        return false;
    };

    // Find all possible pairs
    const uniquePairs: Tile[][] = [];
    const seenPairVals = new Set<string>();

    for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i].type === sorted[i + 1].type && sorted[i].value === sorted[i + 1].value) {
            const key = `${sorted[i].type}-${sorted[i].value}`;
            if (!seenPairVals.has(key)) {
                seenPairVals.add(key);
                uniquePairs.push([sorted[i], sorted[i + 1]]);
            }
        }
    }

    if (uniquePairs.length === 0 && hand.length > 0) return false;

    for (const pair of uniquePairs) {
        const remaining = [...sorted];
        remaining.splice(remaining.findIndex(t => t.type === pair[0].type && t.value === pair[0].value), 1);
        remaining.splice(remaining.findIndex(t => t.type === pair[1].type && t.value === pair[1].value), 1);
        if (checkDecompose(remaining)) return true;
    }

    return false;
};

export const canTing = (hand: Tile[]): boolean => {
    return getTingDiscards(hand).length > 0;
};

export const getTingDiscards = (hand: Tile[]): Tile[] => {
    if (hand.length % 3 !== 2) return [];

    const tingCandidates: { tile: Tile, waiterCount: number }[] = [];
    const seen = new Set();

    const uniqueCandidates: Tile[] = [];
    for (const t of hand) {
        const key = `${t.type}-${t.value}`;
        if (!seen.has(key)) {
            seen.add(key);
            uniqueCandidates.push(t);
        }
    }

    for (const discardCandidate of uniqueCandidates) {
        const remaining16 = [...hand];
        const idx = remaining16.findIndex(t => t.id === discardCandidate.id);
        remaining16.splice(idx, 1);

        const waiters = getWaitingTiles(remaining16);
        if (waiters.length > 0) {
            tingCandidates.push({ tile: discardCandidate, waiterCount: waiters.length });
        }
    }

    tingCandidates.sort((a, b) => b.waiterCount - a.waiterCount);
    return tingCandidates.map(c => c.tile);
};

export const getTingInfo = (hand: Tile[]): { tileId: string, waitingTiles: Tile[] }[] => {
    if (hand.length % 3 !== 2) return [];

    const results: { tileId: string, waitingTiles: Tile[] }[] = [];
    const seen = new Set();

    for (const discardCandidate of hand) {
        const key = `${discardCandidate.type}-${discardCandidate.value}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const remaining16 = [...hand];
        const idx = remaining16.findIndex(t => t.id === discardCandidate.id);
        remaining16.splice(idx, 1);

        const waiters = getWaitingTiles(remaining16);
        if (waiters.length > 0) {
            results.push({ tileId: discardCandidate.id, waitingTiles: waiters });
        }
    }
    return results;
};

export const getWaitingTiles = (hand16: Tile[]): Tile[] => {
    const ALL_TILE_TYPES: Tile[] = [
        ...Array.from({ length: 9 }, (_, i) => ({ type: 'WAN', value: i + 1, id: `test-wan-${i + 1}`, display: `WAN_${i + 1}` } as Tile)),
        ...Array.from({ length: 9 }, (_, i) => ({ type: 'TONG', value: i + 1, id: `test-tong-${i + 1}`, display: `TONG_${i + 1}` } as Tile)),
        ...Array.from({ length: 9 }, (_, i) => ({ type: 'TIAO', value: i + 1, id: `test-tiao-${i + 1}`, display: `TIAO_${i + 1}` } as Tile)),
        ...['EAST', 'SOUTH', 'WEST', 'NORTH'].map(v => ({ type: 'WIND', value: v, id: `test-wind-${v}`, display: `WIND_${v}` } as Tile)),
        ...['ZHONG', 'FA', 'BAI'].map(v => ({ type: 'DRAGON', value: v, id: `test-dragon-${v}`, display: `DRAGON_${v}` } as Tile))
    ];

    const results: Tile[] = [];
    for (const testDraw of ALL_TILE_TYPES) {
        if (isHu([...hand16, testDraw])) {
            results.push(testDraw);
        }
    }
    return results;
};

export const canPung = (hand: Tile[], discardedTile: Tile): boolean => {
    const matchingTiles = hand.filter(t => t.type === discardedTile.type && t.value === discardedTile.value);
    return matchingTiles.length >= 2;
};

export const canChow = (hand: Tile[], discardedTile: Tile): Tile[][] => {
    if (!['WAN', 'TONG', 'TIAO'].includes(discardedTile.type)) return [];
    const v = discardedTile.value as number;
    const combos: Tile[][] = [];
    const m2 = hand.find(t => t.type === discardedTile.type && t.value === v - 2);
    const m1 = hand.find(t => t.type === discardedTile.type && t.value === v - 1);
    if (m2 && m1) combos.push([m2, m1]);
    const p1 = hand.find(t => t.type === discardedTile.type && t.value === v + 1);
    if (m1 && p1) combos.push([m1, p1]);
    const p2 = hand.find(t => t.type === discardedTile.type && t.value === v + 2);
    if (p1 && p2) combos.push([p1, p2]);
    return combos;
};

export const canMingKong = (hand: Tile[], discardedTile: Tile): boolean => {
    const matchingTiles = hand.filter(t => t.type === discardedTile.type && t.value === discardedTile.value);
    return matchingTiles.length >= 3;
};

export const canAnKong = (hand: Tile[]): Tile[][] => {
    const counts: Record<string, Tile[]> = {};
    for (const t of hand) {
        const key = `${t.type}-${t.value}`;
        if (!counts[key]) counts[key] = [];
        counts[key].push(t);
    }
    return Object.values(counts).filter(tiles => tiles.length === 4);
};

export const canJiaKong = (hand: Tile[], exposedSets: ExposedSet[]): { tile: Tile, originalSet: ExposedSet }[] => {
    const results = [];
    const pungs = exposedSets.filter(s => s.type === 'PUNG');
    for (const pung of pungs) {
        const pungTile = pung.tiles[0];
        const match = hand.find(t => t.type === pungTile.type && t.value === pungTile.value);
        if (match) {
            results.push({ tile: match, originalSet: pung });
        }
    }
    return results;
};

export interface TaiDetail {
    name: string;
    tai: number;
}

// Helpers for calculateTai
const hasInHandTriplet = (hand: Tile[], type: string, value: string | number): boolean => {
    const matches = hand.filter(t => t.type === type && t.value === value);
    return matches.length >= 3;
};

const isHandPengPeng = (hand: Tile[], exposed: ExposedSet[]): boolean => {
    if (exposed.some(s => s.type === 'CHOW')) return false;
    const counts: Record<string, number> = {};
    hand.forEach(t => {
        const key = `${t.type}-${t.value}`;
        counts[key] = (counts[key] || 0) + 1;
    });
    const vals = Object.values(counts);
    return vals.every(v => v === 2 || v === 3 || v === 4);
};

export const calculateTai = (gameState: GameState, winnerIndex: number): { total: number, details: TaiDetail[] } => {
    let tai = 0;
    const details: TaiDetail[] = [];
    const player = gameState.players[winnerIndex];

    // 1. 莊家與連莊台數 (Lian N La N)
    if (winnerIndex === gameState.dealerIndex) {
        tai += 1; // 莊家底台
        details.push({ name: '莊家', tai: 1 });
        const sc = player.streakCount || 0;
        if (sc > 0) {
            const streakTai = sc * 2;
            tai += streakTai;
            details.push({ name: `連莊(${sc})拉${sc}`, tai: streakTai });
        }
    } else if (gameState.winType === 'RONG' && gameState.loserIndex === gameState.dealerIndex) {
        // 閒家胡莊家
        const dealer = gameState.players[gameState.dealerIndex];
        const sc = dealer.streakCount || 0;
        tai += 1; // 胡莊家
        details.push({ name: '莊家', tai: 1 });
        if (sc > 0) {
            const streakTai = sc * 2;
            tai += streakTai;
            details.push({ name: `拉莊(${sc})`, tai: streakTai });
        }
    } else if (gameState.winType === 'ZIMO' && winnerIndex !== gameState.dealerIndex) {
        // 閒家自摸，對莊家而言有額外台數 (在算分時處理，詳情顯示基礎台數)
        // 這裡可以選擇性加入提示，或在結算畫面動態顯示
    }

    // 2. 圈風台 (Round Wind)
    const windValues = ['EAST', 'SOUTH', 'WEST', 'NORTH'];
    const targetWindValue = windValues[gameState.windOfTheRound];
    const hasRoundWindTriplet = player.exposedSets.some(s => s.tiles[0].type === 'WIND' && s.tiles[0].value === targetWindValue) ||
        hasInHandTriplet(player.hand, 'WIND', targetWindValue);
    if (hasRoundWindTriplet) {
        tai += 1;
        details.push({ name: `${targetWindValue === 'EAST' ? '東' : targetWindValue === 'SOUTH' ? '南' : targetWindValue === 'WEST' ? '西' : '北'}風圈`, tai: 1 });
    }

    // 3. 位置風台 (Seat Wind)
    const seatPos = (winnerIndex - gameState.dealerIndex + 4) % 4;
    const targetSeatWindValue = windValues[seatPos];
    const hasSeatWindTriplet = player.exposedSets.some(s => s.tiles[0].type === 'WIND' && s.tiles[0].value === targetSeatWindValue) ||
        hasInHandTriplet(player.hand, 'WIND', targetSeatWindValue);
    if (hasSeatWindTriplet) {
        tai += 1;
        details.push({ name: `${targetSeatWindValue === 'EAST' ? '門風東' : targetSeatWindValue === 'SOUTH' ? '門風南' : targetSeatWindValue === 'WEST' ? '門風西' : '門風北'}`, tai: 1 });
    }

    // 4. 三元牌 (Dragons)
    ['ZHONG', 'FA', 'BAI'].forEach(v => {
        const hasTriplet = player.exposedSets.some(s => s.tiles[0].type === 'DRAGON' && s.tiles[0].value === v) ||
            hasInHandTriplet(player.hand, 'DRAGON', v);
        if (hasTriplet) {
            tai += 1;
            details.push({ name: v === 'ZHONG' ? '紅中' : v === 'FA' ? '青發' : '白板', tai: 1 });
        }
    });

    if (gameState.winType === 'ZIMO') { tai += 1; details.push({ name: '自摸', tai: 1 }); }

    // 搶槓: 1台
    if (gameState.winType === 'RONG' && gameState.pendingJiakong) {
        tai += 1;
        details.push({ name: '搶槓', tai: 1 });
    }

    // 門清: 沒有明牌 (不計暗槓)
    const isMenQing = player.exposedSets.every(s => s.type === 'ANKONG');
    if (isMenQing) {
        tai += 1;
        details.push({ name: '門清', tai: 1 });
    }

    // 暗槓: 每一組 1 台
    const anKongCount = player.exposedSets.filter(s => s.type === 'ANKONG').length;
    if (anKongCount > 0) {
        tai += anKongCount;
        details.push({ name: `暗槓(${anKongCount})`, tai: anKongCount });
    }

    if (isHandPengPeng(player.hand, player.exposedSets)) { tai += 4; details.push({ name: '碰碰胡', tai: 4 }); }

    if (tai === 0) {
        tai = 1;
        details.push({ name: '屁胡 (底台)', tai: 1 });
    }
    return { total: tai, details };
};

export const calculateScores = (gameState: GameState): GameState => {
    const nextState = { ...gameState, players: gameState.players.map(p => ({ ...p, roundScoreDelta: 0 })) };
    if (nextState.status !== 'HU' || nextState.winnerIndex === null) return nextState;

    const BASE_SCORE = 50;
    const TAI_SCORE = 20;
    const winnerIdx = nextState.winnerIndex;
    const dealerIdx = nextState.dealerIndex;
    const streakBonus = (nextState.players[dealerIdx].streakCount || 0) * 2 + 1;

    const taiResult = calculateTai(nextState, winnerIdx);
    const winnerTai = taiResult.total;

    if (nextState.winType === 'ZIMO') {
        for (let i = 0; i < 4; i++) {
            if (i === winnerIdx) continue;
            let finalTai = winnerTai;
            if (winnerIdx !== dealerIdx && i === dealerIdx) finalTai += streakBonus;
            const amount = BASE_SCORE + (finalTai * TAI_SCORE);
            nextState.players[i].roundScoreDelta -= amount;
            nextState.players[i].score -= amount;
            nextState.players[winnerIdx].roundScoreDelta += amount;
            nextState.players[winnerIdx].score += amount;
        }
    } else if (nextState.winType === 'RONG' && nextState.loserIndex !== null && nextState.loserIndex !== undefined) {
        const loserIdx = nextState.loserIndex;
        // calculateTai 已經在 RONG 情況下考慮了「胡莊家」與「拉莊」
        const amount = BASE_SCORE + (winnerTai * TAI_SCORE);
        nextState.players[loserIdx].roundScoreDelta = -amount;
        nextState.players[loserIdx].score -= amount;
        nextState.players[winnerIdx].roundScoreDelta = amount;
        nextState.players[winnerIdx].score += amount;
    }
    return nextState;
};

export const checkXiangGong = (player: Player, isDraw: boolean): boolean => {
    const expected = isDraw ? 17 : 16;
    return player.hand.length !== expected;
};
