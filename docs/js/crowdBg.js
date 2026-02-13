// ============================================
// crowdBg.js — Persistent background crowd canvas
// ============================================

import { state } from './state.js';
import { drawGameVisuals, drawAmbientCrowd, initSupporters } from './crowd.js';

let _resizeHandler = null;

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

function crowdLoop() {
    if (state.crowdMode === 'gameplay') {
        drawGameVisuals();
    } else {
        drawAmbientCrowd();
    }
    requestAnimationFrame(crowdLoop);
}

export function setCrowdMode(mode) {
    state.crowdMode = mode;
}

export function updateCrowdClub() {
    // Reinit supporters with new club colors
    state.supporters = [];
    state.frenzyParticles = [];
    state.smokeParticles = [];
}
