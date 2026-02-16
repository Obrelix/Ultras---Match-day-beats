// ============================================
// crowdAudio.js — Dynamic crowd noise layer (Web Audio API)
// ============================================

import { state } from './state.js';

// Audio nodes
let crowdGain = null;
let noiseSource = null;
let noiseGain = null;
let crowdOscillators = [];
let isInitialized = false;

// Crowd noise state
let baseVolume = 0.15;
let currentVolume = 0.15;
let targetVolume = 0.15;
let frenzyMultiplier = 1.0;

/**
 * Initialize the crowd audio system
 * Creates a layered crowd noise using filtered noise and oscillators
 */
export function initCrowdAudio() {
    if (!state.audioContext || isInitialized) return;
    if (!state.settings.crowdAudioEnabled) return;

    const ctx = state.audioContext;

    // Main crowd gain node
    crowdGain = ctx.createGain();
    crowdGain.gain.value = state.settings.crowdAudioVolume || 0.3;
    crowdGain.connect(ctx.destination);

    // Create base crowd ambience using filtered noise
    createCrowdNoise(ctx);

    // Create subtle crowd hum oscillators
    createCrowdHum(ctx);

    isInitialized = true;
}

/**
 * Create filtered noise for crowd ambience
 */
function createCrowdNoise(ctx) {
    // Create noise buffer (white noise filtered to sound like crowd murmur)
    const bufferSize = ctx.sampleRate * 2; // 2 seconds
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    // Generate pink-ish noise (more low frequencies)
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
    }

    // Create looping noise source
    noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    // Bandpass filter to make it sound like distant crowd murmur
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 400;
    filter.Q.value = 0.5;

    // Noise gain for dynamic control
    noiseGain = ctx.createGain();
    noiseGain.gain.value = baseVolume;

    noiseSource.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(crowdGain);

    noiseSource.start();
}

/**
 * Create subtle oscillators for crowd hum/chanting undertone
 */
function createCrowdHum(ctx) {
    // Multiple detuned oscillators for a "crowd humming" effect
    const frequencies = [100, 150, 200]; // Low frequencies
    const detunes = [-10, 0, 10];

    frequencies.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.value = freq;
        osc.detune.value = detunes[i];

        gain.gain.value = 0.02; // Very subtle

        osc.connect(gain);
        gain.connect(crowdGain);
        osc.start();

        crowdOscillators.push({ osc, gain });
    });
}

/**
 * Update crowd audio based on game state
 * Called from game loop or on events
 */
export function updateCrowdAudio() {
    if (!isInitialized || !state.settings.crowdAudioEnabled) return;
    if (!noiseGain) return;

    const combo = state.playerCombo || 0;
    const isFrenzy = combo >= 5;
    const isIntense = combo >= 15;

    // Calculate target volume based on performance
    if (isIntense) {
        targetVolume = baseVolume * 3.0;
        frenzyMultiplier = 2.5;
    } else if (isFrenzy) {
        targetVolume = baseVolume * 2.0;
        frenzyMultiplier = 1.8;
    } else if (combo >= 3) {
        targetVolume = baseVolume * 1.4;
        frenzyMultiplier = 1.3;
    } else {
        targetVolume = baseVolume;
        frenzyMultiplier = 1.0;
    }

    // Smooth transition
    currentVolume += (targetVolume - currentVolume) * 0.1;

    // Apply volume
    const ctx = state.audioContext;
    if (ctx && noiseGain) {
        noiseGain.gain.setTargetAtTime(currentVolume, ctx.currentTime, 0.1);
    }

    // Modulate hum oscillators based on frenzy
    crowdOscillators.forEach(({ gain }) => {
        if (gain) {
            gain.gain.setTargetAtTime(0.02 * frenzyMultiplier, ctx.currentTime, 0.1);
        }
    });
}

/**
 * Play crowd cheer sound (on good hits)
 */
export function playCrowdCheer(intensity = 'normal') {
    if (!state.audioContext || !crowdGain) return;
    if (!state.settings.crowdAudioEnabled) return;

    const ctx = state.audioContext;
    const now = ctx.currentTime;

    // Create a short cheer burst using filtered noise
    const bufferSize = ctx.sampleRate * 0.3;
    const cheerBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = cheerBuffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
        const envelope = Math.sin((i / bufferSize) * Math.PI);
        output[i] = (Math.random() * 2 - 1) * envelope * 0.5;
    }

    const source = ctx.createBufferSource();
    source.buffer = cheerBuffer;

    // Higher bandpass for cheer
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = intensity === 'loud' ? 800 : 600;
    filter.Q.value = 0.8;

    const gain = ctx.createGain();
    const volume = intensity === 'loud' ? 0.25 : intensity === 'soft' ? 0.08 : 0.15;
    gain.gain.setValueAtTime(volume * frenzyMultiplier, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(crowdGain);

    source.onended = () => {
        source.disconnect();
        filter.disconnect();
        gain.disconnect();
    };

    source.start(now);
}

/**
 * Play crowd groan sound (on misses)
 */
export function playCrowdGroan() {
    if (!state.audioContext || !crowdGain) return;
    if (!state.settings.crowdAudioEnabled) return;

    const ctx = state.audioContext;
    const now = ctx.currentTime;

    // Low groan using oscillator
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.2);

    // Low-pass filter for muffled sound
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 300;

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(crowdGain);

    osc.onended = () => {
        osc.disconnect();
        filter.disconnect();
        gain.disconnect();
    };

    osc.start(now);
    osc.stop(now + 0.25);
}

/**
 * Play crowd celebration (on wins/goals)
 */
export function playCrowdCelebration() {
    if (!state.audioContext || !crowdGain) return;
    if (!state.settings.crowdAudioEnabled) return;

    const ctx = state.audioContext;
    const now = ctx.currentTime;

    // Layer multiple cheer bursts
    for (let i = 0; i < 3; i++) {
        setTimeout(() => {
            playCrowdCheer('loud');
        }, i * 100);
    }

    // Add a rising tone for excitement
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.5);

    gain.gain.setValueAtTime(0.1, now);
    gain.gain.setValueAtTime(0.15, now + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    osc.connect(gain);
    gain.connect(crowdGain);

    osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
    };

    osc.start(now);
    osc.stop(now + 0.6);
}

/**
 * Play crowd dejection (on losses)
 */
export function playCrowdDejection() {
    if (!state.audioContext || !crowdGain) return;
    if (!state.settings.crowdAudioEnabled) return;

    const ctx = state.audioContext;
    const now = ctx.currentTime;

    // Multiple groans
    for (let i = 0; i < 2; i++) {
        setTimeout(() => {
            playCrowdGroan();
        }, i * 150);
    }

    // Descending tone
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.4);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc.connect(gain);
    gain.connect(crowdGain);

    osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
    };

    osc.start(now);
    osc.stop(now + 0.5);
}

/**
 * Set crowd audio volume
 */
export function setCrowdVolume(value) {
    if (crowdGain && state.audioContext) {
        crowdGain.gain.setTargetAtTime(value, state.audioContext.currentTime, 0.1);
    }
    state.settings.crowdAudioVolume = value;
}

/**
 * Stop and clean up crowd audio
 */
export function stopCrowdAudio() {
    if (noiseSource) {
        try { noiseSource.stop(); } catch (e) {}
        try { noiseSource.disconnect(); } catch (e) {}
        noiseSource = null;
    }

    crowdOscillators.forEach(({ osc }) => {
        try { osc.stop(); } catch (e) {}
        try { osc.disconnect(); } catch (e) {}
    });
    crowdOscillators = [];

    if (noiseGain) {
        try { noiseGain.disconnect(); } catch (e) {}
        noiseGain = null;
    }

    if (crowdGain) {
        try { crowdGain.disconnect(); } catch (e) {}
        crowdGain = null;
    }

    isInitialized = false;
    currentVolume = baseVolume;
    targetVolume = baseVolume;
    frenzyMultiplier = 1.0;
}

/**
 * Check if crowd audio is initialized
 */
export function isCrowdAudioActive() {
    return isInitialized;
}
