// ============================================
// audio.js — Audio pipeline (Web Audio API)
// ============================================

import { GameState } from './config.js';
import { state } from './state.js';

export async function initAudio() {
    if (!state.audioContext) {
        state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    if (state.audioContext.state === 'suspended') {
        await state.audioContext.resume();
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
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    state.audioBuffer = await state.audioContext.decodeAudioData(arrayBuffer);
}

export function playAudio(onEnded) {
    if (state.audioSource) {
        state.audioSource.stop();
    }

    state.audioSource = state.audioContext.createBufferSource();
    state.audioSource.buffer = state.audioBuffer;

    // Chain: source → analyser → masterGain → destination
    state.audioSource.connect(state.analyser);
    state.analyser.connect(state.masterGain);

    state.audioSource.start(0);

    state.audioSource.onended = () => {
        if (state.currentState === GameState.PLAYING) {
            onEnded();
        }
    };
}

export function stopAudio() {
    if (state.audioSource) {
        try {
            state.audioSource.stop();
        } catch (e) {}
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

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(state.sfxGain);

    switch (type) {
        case 'PERFECT':
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, now);
            osc.frequency.exponentialRampToValueAtTime(1320, now + 0.03);
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
            osc.start(now);
            osc.stop(now + 0.06);
            break;
        case 'GOOD':
            osc.type = 'sine';
            osc.frequency.setValueAtTime(660, now);
            gain.gain.setValueAtTime(0.25, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
            osc.start(now);
            osc.stop(now + 0.05);
            break;
        case 'OK':
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(440, now);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
            osc.start(now);
            osc.stop(now + 0.04);
            break;
        case 'MISS':
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, now);
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
            osc.start(now);
            osc.stop(now + 0.08);
            break;
    }
}
