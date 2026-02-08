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

    state.audioSource.connect(state.analyser);
    state.analyser.connect(state.audioContext.destination);

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
