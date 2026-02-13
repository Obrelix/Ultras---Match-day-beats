// ============================================
// crowdBg.js — Persistent background crowd canvas
// ============================================

import { state } from './state.js';
import { drawGameVisuals, drawAmbientCrowd, initSupporters } from './crowd.js';

let _resizeHandler = null;
let _lastIdleFrame = 0;
const IDLE_FRAME_INTERVAL = 50;  // ~20fps for idle animations (saves CPU)

export function initCrowdBg() {
    const canvas = document.getElementById('crowd-bg');
    state.crowdBgCanvas = canvas;
    state.crowdBgCtx = canvas.getContext('2d');

    function resizeCrowdCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        // Reinitialize supporters for the new dimensions
        state.supporters = [];
    }
    resizeCrowdCanvas();

    if (_resizeHandler) {
        window.removeEventListener('resize', _resizeHandler);
    }
    _resizeHandler = resizeCrowdCanvas;
    window.addEventListener('resize', resizeCrowdCanvas);

    // Start the persistent animation loop
    requestAnimationFrame(crowdLoop);
}

function crowdLoop(timestamp) {
    if (state.crowdMode === 'gameplay') {
        // Full 60fps during gameplay
        drawGameVisuals();
    } else {
        // Throttle idle/ambient animations to ~20fps to save CPU
        if (timestamp - _lastIdleFrame > IDLE_FRAME_INTERVAL) {
            drawAmbientCrowd();
            _lastIdleFrame = timestamp;
        }
    }
    requestAnimationFrame(crowdLoop);
}

export function setCrowdMode(mode) {
    state.crowdMode = mode;
}

export function updateCrowdClub() {
    // Cache club colors to avoid repeated lookups during rendering
    if (state.selectedClub) {
        state.cachedColors = {
            primary: state.selectedClub.colors.primary,
            secondary: state.selectedClub.colors.secondary
        };
    } else {
        state.cachedColors = { primary: '#006633', secondary: '#FFFFFF' };
    }
    // Reinit supporters with new club colors
    state.supporters = [];
    state.smokeParticles = [];
}
