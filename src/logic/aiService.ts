import type { Tile } from './tiles';
import { canChow, getTingDiscards, getWaitingTiles } from './gameLogic';
import type { GameState } from './gameLogic';

export const AIDifficulty = {
    EASY: 'EASY',
    MEDIUM: 'MEDIUM',
    HARD: 'HARD'
} as const;

export type AIDifficulty = typeof AIDifficulty[keyof typeof AIDifficulty];

const ALL_TILE_TYPES: Tile[] = [
    ...Array.from({ length: 9 }, (_, i) => ({ type: 'WAN', value: i + 1, id: `test-wan-${i + 1}`, display: `WAN_${i + 1}` } as Tile)),
    ...Array.from({ length: 9 }, (_, i) => ({ type: 'TONG', value: i + 1, id: `test-tong-${i + 1}`, display: `TONG_${i + 1}` } as Tile)),
    ...Array.from({ length: 9 }, (_, i) => ({ type: 'TIAO', value: i + 1, id: `test-tiao-${i + 1}`, display: `TIAO_${i + 1}` } as Tile)),
    ...['EAST', 'SOUTH', 'WEST', 'NORTH'].map(v => ({ type: 'WIND', value: v, id: `test-wind-${v}`, display: `WIND_${v}` } as Tile)),
    ...['ZHONG', 'FA', 'BAI'].map(v => ({ type: 'DRAGON', value: v, id: `test-dragon-${v}`, display: `DRAGON_${v}` } as Tile))
];

const evaluateHand = (hand: Tile[]): number => {
    let score = 0;
    const freqs: Record<string, number> = {};
    for (const t of hand) {
        const key = `${t.type}-${t.value}`;
        freqs[key] = (freqs[key] || 0) + 1;
    }

    let sets = 0;
    let pairs = 0;
    let partials = 0;

    for (const key in freqs) {
        if (freqs[key] >= 3) { sets++; freqs[key] -= 3; }
        if (freqs[key] === 2) { pairs++; }
    }

    for (const type of ['WAN', 'TONG', 'TIAO']) {
        for (let i = 1; i <= 7; i++) {
            const k1 = `${type}-${i}`;
            const k2 = `${type}-${i + 1}`;
            const k3 = `${type}-${i + 2}`;
            while (freqs[k1] > 0 && freqs[k2] > 0 && freqs[k3] > 0) {
                sets++;
                freqs[k1]--; freqs[k2]--; freqs[k3]--;
            }
        }
    }

    for (const type of ['WAN', 'TONG', 'TIAO']) {
        for (let i = 1; i <= 8; i++) {
            const k1 = `${type}-${i}`;
            const k2 = `${type}-${i + 1}`;
            if (freqs[k1] > 0 && freqs[k2] > 0) {
                partials++;
                freqs[k1]--; freqs[k2]--;
            }
        }
        for (let i = 1; i <= 7; i++) {
            const k1 = `${type}-${i}`;
            const k3 = `${type}-${i + 2}`;
            if (freqs[k1] > 0 && freqs[k3] > 0) {
                partials++;
                freqs[k1]--; freqs[k3]--;
            }
        }
    }

    score = sets * 100 + pairs * 10 + partials * 5;

    for (const key in freqs) {
        if (freqs[key] > 0) {
            const parts = key.split('-');
            const v = parseInt(parts[1]);
            if (isNaN(v)) score -= 2;
            else if (v === 1 || v === 9) score -= 1;
        }
    }

    return score;
}

export const decideDiscard = (hand: Tile[], difficulty: AIDifficulty, gameState?: GameState, myPlayerIndex?: number): Tile => {
    if (difficulty === AIDifficulty.EASY) {
        return hand[Math.floor(Math.random() * hand.length)];
    }

    const tingDiscards = getTingDiscards(hand);
    if (tingDiscards.length > 0) {
        let bestTile = tingDiscards[0];
        let maxWaiters = 0;
        let isBestTileDangerous = false;

        const seen = new Set();
        for (const t of tingDiscards) {
            const key = `${t.type}-${t.value}`;
            if (seen.has(key)) continue;
            seen.add(key);

            let dangerous = false;
            // Realistic board-reading danger heuristic
            if (gameState && myPlayerIndex !== undefined) {
                let anyOpponentTing = false;
                let visibleCount = 0;

                // Fast scan of visible tiles
                for (let i = 0; i < gameState.players.length; i++) {
                    if (i !== myPlayerIndex && gameState.players[i].isTing) {
                        anyOpponentTing = true;
                    }
                    // Count in discards
                    for (const discard of gameState.players[i].discards) {
                        if (discard.type === t.type && discard.value === t.value) visibleCount++;
                    }
                    // Count in exposed sets
                    for (const set of gameState.players[i].exposedSets) {
                        for (const setTile of set.tiles) {
                            if (setTile.type === t.type && setTile.value === t.value) visibleCount++;
                        }
                    }
                }

                // If endgame or someone is Ting, raw tiles (visible count 0 or 1) are considered dangerous
                if (anyOpponentTing && visibleCount < 2) {
                    dangerous = true;
                } else if (gameState.deck.length < 40 && visibleCount === 0) {
                    dangerous = true; // Late game raw tiles are dangerous
                }
            }

            const remaining = [...hand];
            remaining.splice(remaining.findIndex(x => x.id === t.id), 1);
            const waiters = getWaitingTiles(remaining);

            // If the current best is dangerous but this new one is safe, prefer the safe one even with fewer waiters
            if (isBestTileDangerous && !dangerous) {
                maxWaiters = waiters.length;
                bestTile = t;
                isBestTileDangerous = dangerous;
            } else if (!isBestTileDangerous && dangerous) {
                // If current best is safe and this new one is dangerous, ignore it entirely
                continue;
            } else if (waiters.length > maxWaiters) {
                // Both are safe or both are dangerous: pick the one with more waiters
                maxWaiters = waiters.length;
                bestTile = t;
                isBestTileDangerous = dangerous;
            }
        }
        return bestTile;
    }

    let bestScore = -999999;
    let bestCandidates: Tile[] = [];
    const uniqueCandidates = new Map<string, Tile>();

    for (const t of hand) {
        uniqueCandidates.set(`${t.type}-${t.value}`, t);
    }

    for (const discard of uniqueCandidates.values()) {
        const remaining = [...hand];
        remaining.splice(remaining.findIndex((t) => t.id === discard.id), 1);
        let expectedValue = 0;
        const baseScore = evaluateHand(remaining);

        for (const draw of ALL_TILE_TYPES) {
            const newHand = [...remaining, draw];
            const newScore = evaluateHand(newHand);
            if (newScore > baseScore) {
                expectedValue += (newScore - baseScore);
            }
        }

        let difficultyRandomness = difficulty === AIDifficulty.MEDIUM ? Math.random() * 5 : 0;
        let finalScore = baseScore * 10 + expectedValue + difficultyRandomness;

        // Defensive heuristic: Penalize dangerous tiles based on board state
        if (gameState && myPlayerIndex !== undefined) {
            let anyOpponentTing = false;
            let visibleCount = 0;

            for (let i = 0; i < gameState.players.length; i++) {
                if (i !== myPlayerIndex && gameState.players[i].isTing) anyOpponentTing = true;

                for (const d of gameState.players[i].discards) {
                    if (d.type === discard.type && d.value === discard.value) visibleCount++;
                }
                for (const set of gameState.players[i].exposedSets) {
                    for (const setTile of set.tiles) {
                        if (setTile.type === discard.type && setTile.value === discard.value) visibleCount++;
                    }
                }
            }

            // In hand count
            visibleCount += hand.filter(h => h.type === discard.type && h.value === discard.value).length;

            let dangerPenalty = 0;
            if (anyOpponentTing) {
                if (visibleCount === 1) dangerPenalty = 500; // Almost raw
                else if (visibleCount === 2) dangerPenalty = 100; // Semi-safe
                else if (visibleCount === 3) dangerPenalty = 20; // Very safe
            } else if (gameState.deck.length < 40) {
                if (visibleCount === 1) dangerPenalty = 100;
            }

            // Center tiles are inherently more dangerous to discard than terminals/honors
            if (['WAN', 'TONG', 'TIAO'].includes(discard.type)) {
                const v = discard.value as number;
                if (v >= 4 && v <= 6) dangerPenalty *= 1.5;
            }

            finalScore -= dangerPenalty;
        }

        if (finalScore > bestScore) {
            bestScore = finalScore;
            bestCandidates = [discard];
        } else if (Math.abs(finalScore - bestScore) < 0.01) {
            bestCandidates.push(discard);
        }
    }

    return bestCandidates[Math.floor(Math.random() * bestCandidates.length)] || hand[0];
};

export const shouldAction = (hand: Tile[], tile: Tile, actionType: 'PUNG' | 'CHOW'): boolean => {
    const baseScore = evaluateHand(hand);

    if (actionType === 'PUNG') {
        const matches = hand.filter(t => t.type === tile.type && t.value === tile.value);
        if (matches.length < 2) return false;

        const remaining = [...hand];
        remaining.splice(remaining.findIndex(t => t.id === matches[0].id), 1);
        remaining.splice(remaining.findIndex(t => t.id === matches[1].id), 1);

        const newScore = evaluateHand(remaining);
        return (newScore + 80) > baseScore;
    }

    if (actionType === 'CHOW') {
        const combos = canChow(hand, tile);
        if (combos.length === 0) return false;

        let bestChowScore = -99999;
        for (const combo of combos) {
            const remaining = [...hand];
            remaining.splice(remaining.findIndex(t => t.id === combo[0].id), 1);
            remaining.splice(remaining.findIndex(t => t.id === combo[1].id), 1);

            const newScore = evaluateHand(remaining) + 80;
            if (newScore > bestChowScore) bestChowScore = newScore;
        }

        return bestChowScore > baseScore;
    }

    return false;
};
