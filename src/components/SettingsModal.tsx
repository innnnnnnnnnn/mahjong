import React from 'react';
import { audioService } from '../logic/audioService';
import { motion } from 'framer-motion';
import { socket } from '../services/socket';

const CHARACTERS = [
    { id: 'oneesan', name: '👩‍💼 大姐姐' },
    { id: 'milk', name: '👧🏻 彌音' },
    { id: 'shota', name: '👦 正太' },
    { id: 'loli', name: '👧 蘿莉' },
    { id: 'daige', name: '🔥 豪邁大哥' },
    { id: 'denzi', name: '🤖 電子音' },
    { id: 'google', name: '👩‍🏫 Google 小姐' },
];

const BGM_LIST = [
    { id: '', name: '--- 無背景音樂 ---' },
    { id: 'タンヤオ_2.mp3', name: '🀄 斷麼九 (Tanyao)' },
    { id: 'A Very Brady Special.mp3', name: '🎵 Brady Special' },
    { id: 'As I Figure.mp3', name: '🎵 As I Figure' },
    { id: 'Desert City.mp3', name: '🎵 Desert City' },
    { id: 'Double Polka.mp3', name: '🎵 Double Polka' },
    { id: 'Eastern Thought.mp3', name: '🎵 Eastern Thought' },
    { id: 'Five Armies.mp3', name: '🎵 Five Armies' },
    { id: 'Lord of the Land.mp3', name: '🎵 Lord of the Land' },
    { id: 'Night of Chaos.mp3', name: '🎵 Night of Chaos' },
    { id: 'Tempting Secrets.mp3', name: '🎵 Tempting Secrets' },
];

const SettingsModal: React.FC<{ username: string, onClose: () => void }> = ({ username, onClose }) => {
    const [, setTick] = React.useState(0);
    const [isSaving, setIsSaving] = React.useState(false);

    const forceUpdate = () => setTick(t => t + 1);

    const handleSave = () => {
        setIsSaving(true);
        const settings = audioService.toSerializable();
        localStorage.setItem(`mahjong_settings_${username}`, JSON.stringify(settings));

        // Brief artificial delay for better UX feel
        setTimeout(() => {
            setIsSaving(false);
            alert('✨ 設定已儲存成功！');
        }, 300);
    };

    return (
        <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center',
                alignItems: 'center', zIndex: 1000, backdropFilter: 'blur(10px)'
            }}
        >
            <motion.div
                className="settings-card"
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                style={{
                    background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '24px', padding: '40px', width: '90%', maxWidth: '500px',
                    boxShadow: '0 20px 50px rgba(0,0,0,0.5)', position: 'relative'
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                    <h2 style={{ color: 'var(--accent-gold)', margin: 0, fontSize: '1.8rem' }}>遊戲音效設定</h2>
                    <button
                        onClick={onClose}
                        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: '1.5rem', cursor: 'pointer' }}
                    >✕</button>
                </div>

                <div className="settings-section" style={{ marginBottom: '30px' }}>
                    <label style={{ color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: '10px', fontSize: '0.9rem' }}>角色配音選擇</label>
                    <select
                        value={audioService.getVoiceCharacter()}
                        onChange={(e) => {
                            audioService.setVoiceCharacter(e.target.value);
                            audioService.playScenario('ZIMO'); // Preview with Zimo (自摸)
                            forceUpdate();
                        }}
                        style={{
                            width: '100%', background: 'rgba(255,255,255,0.05)', color: 'white',
                            border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px',
                            padding: '15px', fontSize: '1.1rem', cursor: 'pointer'
                        }}
                    >
                        {CHARACTERS.map(c => (
                            <option key={c.id} value={c.id} style={{ background: '#1a1a1a' }}>{c.name}</option>
                        ))}
                    </select>
                </div>

                <div className="settings-section" style={{ marginBottom: '30px' }}>
                    <label style={{ color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: '10px', fontSize: '0.9rem' }}>背景音樂 (BGM)</label>
                    <select
                        value={audioService.getBGM()}
                        onChange={(e) => {
                            audioService.setBGM(e.target.value);
                            forceUpdate();
                        }}
                        style={{
                            width: '100%', background: 'rgba(255,255,255,0.05)', color: 'white',
                            border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px',
                            padding: '15px', fontSize: '1.1rem', cursor: 'pointer'
                        }}
                    >
                        {BGM_LIST.map(b => (
                            <option key={b.id} value={b.id} style={{ background: '#1a1a1a' }}>{b.name}</option>
                        ))}
                    </select>
                </div>

                <div className="settings-section" style={{ marginBottom: '40px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem' }}>背景音樂音量</label>
                        <span style={{ color: 'var(--accent-gold)', fontSize: '0.9rem' }}>{Math.round(audioService.getBGMVolume() * 100)}%</span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={audioService.getBGMVolume()}
                        onChange={(e) => {
                            audioService.setBGMVolume(parseFloat(e.target.value));
                            forceUpdate();
                        }}
                        style={{
                            width: '100%',
                            accentColor: 'var(--accent-gold)',
                            cursor: 'pointer'
                        }}
                    />
                </div>

                <div className="settings-footer" style={{ display: 'flex', gap: '15px' }}>
                    <button
                        className="btn-join"
                        onClick={onClose}
                        style={{
                            flex: 1,
                            padding: '1rem',
                            borderRadius: '0.75rem',
                            fontSize: '1.125rem',
                            fontWeight: 900,
                            boxShadow: '0 5px 0 rgb(150, 150, 150)'
                        }}
                    >
                        返回遊戲
                    </button>
                    <button
                        className="btn-create"
                        onClick={handleSave}
                        disabled={isSaving}
                        style={{
                            flex: 1,
                            padding: '1rem',
                            borderRadius: '0.75rem',
                            fontSize: '1.125rem',
                            fontWeight: 900,
                            background: isSaving ? '#666' : '#eab308',
                            boxShadow: isSaving ? 'none' : '0 5px 0 rgb(180, 100, 0)',
                            color: 'black'
                        }}
                    >
                        {isSaving ? '儲存中...' : '💾 儲存'}
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
};

export default SettingsModal;
