// ============================================
// audio.js — Audio pipeline (Web Audio API)
// ============================================

import { GameState, SFX_DURATIONS, createLogger } from './config.js';
import { state } from './state.js';

const log = createLogger('Audio');

/**
 * Safely disconnect an audio node (expected to fail if not connected)
 * @param {AudioNode} node - Node to disconnect
 * @param {string} nodeName - Name for debug logging
 */
function safeDisconnect(node, nodeName) {
    if (!node) return;
    try {
        node.disconnect();
    } catch (e) {
        // Expected when node isn't connected - only log in debug mode
        log.debug(`${nodeName} disconnect skipped (not connected)`);
    }
}

/**
 * Safely stop an audio source (expected to fail if already stopped)
 * @param {AudioBufferSourceNode} source - Source to stop
 */
function safeStop(source) {
    if (!source) return;
    try {
        source.stop();
    } catch (e) {
        // Expected when source already stopped or never started
        log.debug('Audio source stop skipped (already stopped)');
    }
}

export async function initAudio() {
    if (!state.audioContext) {
        state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    if (state.audioContext.state === 'suspended') {
        await state.audioContext.resume();
    }

    // Disconnect and clean up old nodes to prevent memory leaks
    if (state.analyser) {
        safeDisconnect(state.analyser, 'analyser');
        state.analyser = null;
    }
    if (state.masterGain) {
        safeDisconnect(state.masterGain, 'masterGain');
        state.masterGain = null;
    }
    if (state.sfxGain) {
        safeDisconnect(state.sfxGain, 'sfxGain');
        state.sfxGain = null;
    }

    state.analyser = state.audioContext.createAnalyser();
    state.analyser.fftSize = 256;
    state.analyser.smoothingTimeConstant = 0.6;
    state.dataArray = new Uint8Array(state.analyser.frequencyBinCount);

    // Master gain for music volume
    state.masterGain = state.audioContext.createGain();
    state.masterGain.gain.value = state.settings.volume;
    state.masterGain.connect(state.audioContext.destination);

    // SFX gain (separate from music)
    state.sfxGain = state.audioContext.createGain();
    state.sfxGain.gain.value = state.settings.sfxVolume;
    state.sfxGain.connect(state.audioContext.destination);
}

export async function loadAudio(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        state.audioBuffer = await state.audioContext.decodeAudioData(arrayBuffer);
    } catch (error) {
        log.error('Failed to load audio:', error);
        throw error; // Re-throw so caller can handle
    }
}

/**
 * Play audio from buffer
 * @param {Function} onEnded - Callback when audio finishes
 * @param {number} [startTime=0] - Start position in seconds (for seeking)
 */
export function playAudio(onEnded, startTime = 0) {
    if (state.audioSource) {
        safeStop(state.audioSource);
        safeDisconnect(state.audioSource, 'audioSource');
    }

    state.audioSource = state.audioContext.createBufferSource();
    state.audioSource.buffer = state.audioBuffer;

    // Chain: source → analyser → masterGain → destination
    state.audioSource.connect(state.analyser);
    state.analyser.connect(state.masterGain);

    // Start from specified position (clamped to valid range)
    const safeStartTime = Math.max(0, Math.min(startTime, state.audioBuffer.duration - 0.01));
    state.audioSource.start(0, safeStartTime);

    state.audioSource.onended = () => {
        if (state.currentState === GameState.PLAYING) {
            onEnded();
        }
    };
}

export function stopAudio() {
    if (state.audioSource) {
        safeStop(state.audioSource);
        safeDisconnect(state.audioSource, 'audioSource');
        state.audioSource = null;
    }
}

export function setVolume(value) {
    if (state.masterGain) {
        state.masterGain.gain.value = value;
    }
}

export function setSFXVolume(value) {
    if (state.sfxGain) {
        state.sfxGain.gain.value = value;
    }
}

export function playSFX(type) {
    if (!state.audioContext || !state.sfxGain) return;
    const ctx = state.audioContext;
    const now = ctx.currentTime;

    // Helper to create and connect an oscillator with cleanup
    const createOsc = (waveType, connectTo) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = waveType;
        osc.connect(gain);
        gain.connect(connectTo);
        osc.onended = () => {
            osc.disconnect();
            gain.disconnect();
        };
        return { osc, gain };
    };

    switch (type) {
        case 'PERFECT': {
            // Triumphant chord with sparkle sweep - celebratory!
            const masterGain = ctx.createGain();
            masterGain.connect(state.sfxGain);
            masterGain.gain.setValueAtTime(0.25, now);
            masterGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

            // Root note with pitch rise
            const { osc: osc1, gain: g1 } = createOsc('sine', masterGain);
            osc1.frequency.setValueAtTime(880, now);
            osc1.frequency.exponentialRampToValueAtTime(1320, now + 0.06);
            g1.gain.setValueAtTime(0.4, now);
            g1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
            osc1.start(now);
            osc1.stop(now + 0.12);

            // Major third harmony
            const { osc: osc2, gain: g2 } = createOsc('sine', masterGain);
            osc2.frequency.setValueAtTime(1108, now); // E6
            osc2.frequency.exponentialRampToValueAtTime(1660, now + 0.06);
            g2.gain.setValueAtTime(0.25, now);
            g2.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
            osc2.start(now + 0.01);
            osc2.stop(now + 0.1);

            // Fifth harmony
            const { osc: osc3, gain: g3 } = createOsc('triangle', masterGain);
            osc3.frequency.setValueAtTime(1320, now); // E6
            osc3.frequency.exponentialRampToValueAtTime(1980, now + 0.05);
            g3.gain.setValueAtTime(0.2, now);
            g3.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
            osc3.start(now + 0.02);
            osc3.stop(now + 0.1);

            // High sparkle
            const { osc: osc4, gain: g4 } = createOsc('sine', masterGain);
            osc4.frequency.setValueAtTime(2640, now);
            osc4.frequency.exponentialRampToValueAtTime(3520, now + 0.04);
            g4.gain.setValueAtTime(0.12, now);
            g4.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
            osc4.start(now + 0.03);
            osc4.stop(now + 0.09);

            setTimeout(() => masterGain.disconnect(), SFX_DURATIONS.PERFECT_MS);
            break;
        }

        case 'GOOD': {
            // Pleasant two-tone chime with slight wobble
            const masterGain = ctx.createGain();
            masterGain.connect(state.sfxGain);
            masterGain.gain.setValueAtTime(0.22, now);
            masterGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

            // Main tone
            const { osc: osc1, gain: g1 } = createOsc('sine', masterGain);
            osc1.frequency.setValueAtTime(660, now);
            osc1.frequency.setValueAtTime(680, now + 0.02);
            osc1.frequency.setValueAtTime(660, now + 0.04);
            g1.gain.setValueAtTime(0.35, now);
            g1.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
            osc1.start(now);
            osc1.stop(now + 0.1);

            // Octave above for brightness
            const { osc: osc2, gain: g2 } = createOsc('sine', masterGain);
            osc2.frequency.setValueAtTime(1320, now);
            g2.gain.setValueAtTime(0.15, now);
            g2.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
            osc2.start(now + 0.01);
            osc2.stop(now + 0.08);

            // Soft sub tone
            const { osc: osc3, gain: g3 } = createOsc('triangle', masterGain);
            osc3.frequency.setValueAtTime(330, now);
            g3.gain.setValueAtTime(0.1, now);
            g3.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
            osc3.start(now);
            osc3.stop(now + 0.06);

            setTimeout(() => masterGain.disconnect(), SFX_DURATIONS.GOOD_MS);
            break;
        }

        case 'OK': {
            // Muted tap with slight metallic quality
            const masterGain = ctx.createGain();
            masterGain.connect(state.sfxGain);
            masterGain.gain.setValueAtTime(0.18, now);
            masterGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

            // Main tone - slightly flat feeling
            const { osc: osc1, gain: g1 } = createOsc('triangle', masterGain);
            osc1.frequency.setValueAtTime(440, now);
            osc1.frequency.exponentialRampToValueAtTime(420, now + 0.04);
            g1.gain.setValueAtTime(0.25, now);
            g1.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
            osc1.start(now);
            osc1.stop(now + 0.06);

            // Soft click layer
            const { osc: osc2, gain: g2 } = createOsc('square', masterGain);
            osc2.frequency.setValueAtTime(880, now);
            g2.gain.setValueAtTime(0.05, now);
            g2.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
            osc2.start(now);
            osc2.stop(now + 0.02);

            setTimeout(() => masterGain.disconnect(), SFX_DURATIONS.OK_MS);
            break;
        }

        case 'MISS': {
            // Dramatic buzzer with descending wobble
            const masterGain = ctx.createGain();
            masterGain.connect(state.sfxGain);
            masterGain.gain.setValueAtTime(0.18, now);
            masterGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

            // Low buzz
            const { osc: osc1, gain: g1 } = createOsc('sawtooth', masterGain);
            osc1.frequency.setValueAtTime(180, now);
            osc1.frequency.exponentialRampToValueAtTime(80, now + 0.15);
            g1.gain.setValueAtTime(0.2, now);
            g1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
            osc1.start(now);
            osc1.stop(now + 0.15);

            // Dissonant minor second
            const { osc: osc2, gain: g2 } = createOsc('sawtooth', masterGain);
            osc2.frequency.setValueAtTime(190, now);
            osc2.frequency.exponentialRampToValueAtTime(85, now + 0.12);
            g2.gain.setValueAtTime(0.12, now);
            g2.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
            osc2.start(now);
            osc2.stop(now + 0.12);

            // Noise-like texture with square wave
            const { osc: osc3, gain: g3 } = createOsc('square', masterGain);
            osc3.frequency.setValueAtTime(55, now);
            osc3.frequency.setValueAtTime(50, now + 0.05);
            osc3.frequency.setValueAtTime(45, now + 0.1);
            g3.gain.setValueAtTime(0.08, now);
            g3.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
            osc3.start(now);
            osc3.stop(now + 0.1);

            setTimeout(() => masterGain.disconnect(), SFX_DURATIONS.MISS_MS);
            break;
        }
    }
}

// ============================================
// Metronome Practice Mode
// ============================================

/**
 * Play metronome click sound on beat
 * Uses a short click sound that helps players learn timing
 */
export function playMetronomeClick() {
    if (!state.audioContext || !state.sfxGain) return;
    if (!state.settings.metronomeEnabled) return;

    const ctx = state.audioContext;
    const now = ctx.currentTime;

    // Create a short, sharp click sound
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(state.sfxGain);

    // High-pitched click that cuts through the music
    osc.type = 'square';
    osc.frequency.setValueAtTime(1000, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.02);

    // Quick attack and decay
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
    };

    osc.start(now);
    osc.stop(now + 0.05);
}
