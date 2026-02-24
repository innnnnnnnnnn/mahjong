export const TileType = {
    WAN: 'WAN',
    TONG: 'TONG',
    TIAO: 'TIAO',
    WIND: 'WIND',
    DRAGON: 'DRAGON',
    FLOWER: 'FLOWER'
} as const;

export type TileType = typeof TileType[keyof typeof TileType];

export type TileValue = number | string;

export interface Tile {
    id: string;
    type: TileType;
    value: TileValue;
    display: string;
}

export const WIND_VALUES = ['EAST', 'SOUTH', 'WEST', 'NORTH'] as const;
export const DRAGON_VALUES = ['ZHONG', 'FA', 'BAI'] as const;
export const FLOWER_VALUES = [
    'SPRING', 'SUMMER', 'AUTUMN', 'WINTER',
    'PLUM', 'ORCHID', 'BAMBOO', 'CHRYSANTHEMUM'
] as const;

export const createDeck = (): Tile[] => {
    const deck: Tile[] = [];
    let id = 0;

    [TileType.WAN, TileType.TONG, TileType.TIAO].forEach(type => {
        for (let v = 1; v <= 9; v++) {
            for (let i = 0; i < 4; i++) {
                deck.push({ id: `${id++}`, type, value: v, display: `${type}_${v}` });
            }
        }
    });

    WIND_VALUES.forEach(v => {
        for (let i = 0; i < 4; i++) {
            deck.push({ id: `${id++}`, type: TileType.WIND, value: v, display: `WIND_${v}` });
        }
    });

    DRAGON_VALUES.forEach(v => {
        for (let i = 0; i < 4; i++) {
            deck.push({ id: `${id++}`, type: TileType.DRAGON, value: v, display: `DRAGON_${v}` });
        }
    });

    FLOWER_VALUES.forEach(v => {
        deck.push({ id: `${id++}`, type: TileType.FLOWER, value: v, display: `FLOWER_${v}` });
    });

    return deck;
};

export const shuffleDeck = (deck: Tile[]): Tile[] => {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
};
