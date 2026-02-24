/**
 * Audio Service for Mahjong Game
 * Simplified version focusing on Character Voice Selection and BGM.
 */

class AudioService {
    private voiceCharacter: string = 'oneesan';
    private bgmName: string = '';
    private muted: boolean = false;
    private bgmAudio: HTMLAudioElement | null = null;

    // Fixed sound scenarios
    private fixedSounds: Record<string, string> = {
        'DRAW': 'draw.mp3',
        'DISCARD': 'discard.mp3',
        'DICE': 'dice.mp3',
        'SHUFFLE': 'shuffle.mp3'
    };

    /**
     * Play sound for a specific scenario
     */
    async playScenario(scenario: string, characterOverride?: string) {
        if (this.muted) return;

        // 1. Handle Fixed Sounds
        if (this.fixedSounds[scenario]) {
            const audio = new Audio(`/audio/fx/${this.fixedSounds[scenario]}`);
            audio.play().catch(() => {
                // Fallback to synthesis if file missing
                if (scenario === 'DRAW' || scenario === 'DISCARD') this.playTileClack();
            });
            return;
        }

        // 2. Handle Voice Sounds
        const voiceActions: Record<string, string> = {
            'HU': 'ron',
            'ZIMO': 'tsumo',
            'PUNG': 'pon',
            'CHOW': 'chii',
            'KONG': 'kan',
            'TING': 'reach'
        };

        const action = voiceActions[scenario];
        if (action) {
            const folder = characterOverride || this.voiceCharacter;

            // 1. Google TTS Character
            if (folder === 'google') {
                this.playVoiceFallback(scenario);
                return;
            }

            // 2. File-based Voices
            const audio = new Audio(`/audio/voices/${folder}/${action}.mp3`);
            audio.play().catch(() => {
                const wavAudio = new Audio(`/audio/voices/${folder}/${action}.wav`);
                wavAudio.play().catch(() => {
                    this.playVoiceFallback(scenario);
                });
            });
            return;
        }
    }

    private playVoiceFallback(scenario: string) {
        const texts: Record<string, string> = {
            'HU': '胡啦！', 'ZIMO': '自摸！', 'PUNG': '碰！',
            'CHOW': '吃！', 'KONG': '槓！', 'TING': '聽牌！'
        };
        const text = texts[scenario];
        if (text && window.speechSynthesis) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'zh-TW';
            utterance.rate = 1.2;
            window.speechSynthesis.speak(utterance);
        }
    }

    private bgmVolume: number = 0.5;

    setVoiceCharacter(character: string) {
        this.voiceCharacter = character;
    }

    getVoiceCharacter() {
        return this.voiceCharacter;
    }

    setMuted(muted: boolean) {
        this.muted = muted;
        if (muted) {
            this.stopBGM();
        } else if (this.bgmName) {
            this.playBGM();
        }
    }

    isMuted() {
        return this.muted;
    }

    setBGM(name: string) {
        this.bgmName = name;
        if (this.bgmAudio) {
            this.bgmAudio.pause();
            this.bgmAudio = null;
        }
        if (name && !this.muted) {
            this.bgmAudio = new Audio(`/audio/bgm/${name}`);
            this.bgmAudio.loop = true;
            this.bgmAudio.volume = this.bgmVolume;
            this.playBGM();
        }
    }

    getBGM() {
        return this.bgmName;
    }

    setBGMVolume(volume: number) {
        this.bgmVolume = volume;
        if (this.bgmAudio) {
            this.bgmAudio.volume = volume;
        }
    }

    getBGMVolume() {
        return this.bgmVolume;
    }

    playBGM() {
        if (this.bgmAudio && !this.muted) {
            this.bgmAudio.volume = this.bgmVolume;
            this.bgmAudio.play().catch(e => console.log("BGM play failed", e));
        }
    }

    stopBGM() {
        this.bgmAudio?.pause();
    }

    // Persistence Methods
    toSerializable() {
        return {
            voiceCharacter: this.voiceCharacter,
            bgmName: this.bgmName,
            isMuted: this.muted,
            bgmVolume: this.bgmVolume
        };
    }

    loadFromSerializable(data: any) {
        if (!data) return;
        if (data.voiceCharacter) this.voiceCharacter = data.voiceCharacter;
        if (data.bgmVolume !== undefined) this.bgmVolume = data.bgmVolume;
        if (data.bgmName) this.setBGM(data.bgmName);
        if (data.isMuted !== undefined) this.setMuted(data.isMuted);
    }

    /**
     * Synthesized fallback for basic SFX
     */
    private playTileClack() {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.1);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.15);
    }
}

export const audioService = new AudioService();
