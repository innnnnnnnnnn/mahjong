import React from 'react';
import type { Tile as TileType } from '../logic/tiles';
import { TILE_MAPPING, TILE_COLORS } from '../constants/tileMapping';
import { motion } from 'framer-motion';

interface TileProps {
    tile: TileType;
    onClick?: () => void;
    selected?: boolean;
    isFaceDown?: boolean;
    isDimmed?: boolean;
    className?: string;
}

const renderTong = (value: number) => {
    const dots: { top: string, left: string, color: string }[] = [];
    const R = '#d32f2f'; // Red
    const B = '#1976d2'; // Blue
    const G = '#2e7d32'; // Green

    const add = (top: string, left: string, color: string) => dots.push({ top, left, color });

    if (value === 1) {
        return <div style={{ width: 'calc(var(--tile-fs) * 1.1)', height: 'calc(var(--tile-fs) * 1.1)', borderRadius: '50%', backgroundColor: R, position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', boxShadow: 'inset -2px -2px 6px rgba(0,0,0,0.4)', border: '1px solid #a00' }} />;
    }

    const T = '22%', M = '50%', B_POS = '78%', L = '25%', C = '50%', R_POS = '75%';

    if (value === 2) { add(T, C, B); add(B_POS, C, B); }
    if (value === 3) { add(T, L, B); add(M, C, R); add(B_POS, R_POS, G); }
    if (value === 4) { add(T, L, B); add(T, R_POS, G); add(B_POS, L, B); add(B_POS, R_POS, G); }
    if (value === 5) { add(T, L, B); add(T, R_POS, G); add(M, C, R); add(B_POS, L, B); add(B_POS, R_POS, G); }
    if (value === 6) {
        add('20%', L, G); add('20%', R_POS, G);
        add('50%', L, R); add('50%', R_POS, R);
        add('80%', L, R); add('80%', R_POS, R);
    }
    if (value === 7) {
        add('16%', '20%', G); add('26%', '50%', G); add('36%', '80%', G);
        add('65%', L, R); add('65%', R_POS, R);
        add('85%', L, R); add('85%', R_POS, R);
    }
    if (value === 8) {
        add('15%', L, B); add('15%', R_POS, B);
        add('38%', L, B); add('38%', R_POS, B);
        add('62%', L, B); add('62%', R_POS, B);
        add('85%', L, B); add('85%', R_POS, B);
    }
    if (value === 9) {
        add('20%', L, B); add('20%', C, R); add('20%', R_POS, G);
        add('50%', L, B); add('50%', C, R); add('50%', R_POS, G);
        add('80%', L, B); add('80%', C, R); add('80%', R_POS, G);
    }

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            {dots.map((d, i) => (
                <div key={i} style={{
                    position: 'absolute',
                    top: d.top, left: d.left,
                    width: 'calc(var(--tile-fs) * 0.45)', height: 'calc(var(--tile-fs) * 0.45)',
                    borderRadius: '50%',
                    backgroundColor: d.color,
                    transform: 'translate(-50%, -50%)',
                    boxShadow: 'inset -2px -2px 3px rgba(0,0,0,0.3)'
                }} />
            ))}
        </div>
    );
};

const renderTiao = (value: number) => {
    const sticks: { top: string, left: string, color: string, rot?: number, width?: string, height?: string }[] = [];
    const R = '#d32f2f', B = '#1976d2', G = '#2e7d32';

    const add = (top: string, left: string, color: string, rot = 0, width = 'calc(var(--tile-fs) * 0.25)', height = 'calc(var(--tile-fs) * 0.65)') =>
        sticks.push({ top, left, color, rot, width, height });

    const L = '35%', C = '50%', R_POS = '65%';
    const T = '25%', M = '50%', B_POS = '75%';

    if (value === 2) { add(T, C, G); add(B_POS, C, G); }
    if (value === 3) { add('20%', '35%', G); add('50%', '50%', G); add('80%', '65%', G); }
    if (value === 4) { add(T, L, G); add(T, R_POS, G); add(B_POS, L, G); add(B_POS, R_POS, G); }
    if (value === 5) { add(T, L, G); add(T, R_POS, G); add(M, C, R); add(B_POS, L, G); add(B_POS, R_POS, G); }
    if (value === 6) {
        add('20%', L, G); add('20%', R_POS, G);
        add('50%', L, G); add('50%', R_POS, G);
        add('80%', L, G); add('80%', R_POS, G);
    }
    if (value === 7) {
        add('20%', C, R);
        add('50%', '25%', G); add('50%', '50%', G); add('50%', '75%', G);
        add('80%', '25%', G); add('80%', '50%', G); add('80%', '75%', G);
    }
    if (value === 8) {
        // Top row : \ / \ / (V V)
        add('28%', '25%', G, 25, 'calc(var(--tile-fs) * 0.18)', 'calc(var(--tile-fs) * 0.6)'); add('28%', '42%', G, -25, 'calc(var(--tile-fs) * 0.18)', 'calc(var(--tile-fs) * 0.6)');
        add('28%', '58%', G, 25, 'calc(var(--tile-fs) * 0.18)', 'calc(var(--tile-fs) * 0.6)'); add('28%', '75%', G, -25, 'calc(var(--tile-fs) * 0.18)', 'calc(var(--tile-fs) * 0.6)');
        // Bottom row: / \ / \ (^ ^)
        add('72%', '25%', R, -25, 'calc(var(--tile-fs) * 0.18)', 'calc(var(--tile-fs) * 0.6)'); add('72%', '42%', R, 25, 'calc(var(--tile-fs) * 0.18)', 'calc(var(--tile-fs) * 0.6)');
        add('72%', '58%', R, -25, 'calc(var(--tile-fs) * 0.18)', 'calc(var(--tile-fs) * 0.6)'); add('72%', '75%', R, 25, 'calc(var(--tile-fs) * 0.18)', 'calc(var(--tile-fs) * 0.6)');
    }
    if (value === 9) {
        [R, R, R].forEach((col, i) => add('20%', `${25 + i * 25}%`, col));
        [B, B, B].forEach((col, i) => add('50%', `${25 + i * 25}%`, col));
        [G, G, G].forEach((col, i) => add('80%', `${25 + i * 25}%`, col));
    }

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            {value === 1 ? (
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: G, fontSize: 'calc(var(--tile-fs) * 1.5)', fontWeight: 'bold' }}>
                    🀐
                </div>
            ) : sticks.map((s, i) => (
                <div key={i} style={{
                    position: 'absolute',
                    top: s.top, left: s.left,
                    width: s.width, height: s.height,
                    backgroundColor: s.color,
                    borderRadius: '3px',
                    transform: `translate(-50%, -50%) rotate(${s.rot || 0}deg)`,
                    boxShadow: 'inset 1px 1px 2px rgba(255,255,255,0.4), inset -1px -1px 2px rgba(0,0,0,0.1)',
                    border: '1px solid rgba(0,0,0,0.1)'
                }} />
            ))}
        </div>
    );
};

const renderWan = (display: string) => {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', width: '100%', fontWeight: 'bold' }}>
            <span style={{ fontSize: 'calc(var(--tile-fs) * 0.7)', color: '#1976d2', marginBottom: '0px' }}>{display[0]}</span>
            <span style={{ fontSize: 'var(--tile-fs)', color: '#d32f2f', marginTop: '-4px' }}>{display[1]}</span>
        </div>
    );
}

const renderGeneric = (display: string, color: string) => {
    // If it's 2 chars, stack them
    if (display.length === 2) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', width: '100%', fontWeight: 'bold' }}>
                <span style={{ fontSize: 'var(--tile-fs)', color: color, marginBottom: '0px' }}>{display[0]}</span>
                <span style={{ fontSize: 'var(--tile-fs)', color: color, marginTop: '-4px' }}>{display[1]}</span>
            </div>
        );
    }
    return <div style={{ color, fontSize: 'var(--tile-fs)', whiteSpace: 'pre-wrap' }}>{display}</div>;
}


const Tile: React.FC<TileProps> = ({ tile, onClick, selected, isFaceDown, isDimmed, className }) => {
    const display = TILE_MAPPING[tile.display] || String(tile.value);
    const color = TILE_COLORS[tile.display] || TILE_COLORS[tile.type as string] || '#333';

    const handleClick = () => {
        if (onClick) onClick();
    };

    return (
        <div
            className={`tile-wrapper ${className || ''}`}
            onClick={handleClick}
            style={{ cursor: 'pointer', pointerEvents: 'auto' }}
        >
            <motion.div
                className={`tile ${selected ? 'selected' : ''}`}
                whileHover={!isFaceDown ? { y: -10 } : {}}
                animate={selected ? { y: -20, scale: 1.1 } : { y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                style={{ filter: isDimmed ? 'brightness(0.6)' : 'none' }}
            >
                {!isFaceDown && (
                    <div className="tile-face" style={{ color }}>
                        {tile.type === 'TONG' && renderTong(tile.value as number)}
                        {tile.type === 'TIAO' && renderTiao(tile.value as number)}
                        {tile.type === 'WAN' && renderWan(display)}
                        {tile.type !== 'TONG' && tile.type !== 'TIAO' && tile.type !== 'WAN' && renderGeneric(display, color)}
                    </div>
                )}
                {isFaceDown && (
                    <div className="tile-back" style={{
                        width: '100%',
                        height: '100%',
                        backgroundImage: `url('${import.meta.env.BASE_URL}tiles/tile_back.png')`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        borderRadius: '5px'
                    }} />
                )}
            </motion.div>
        </div>
    );
};

export default Tile;
