// ============================================
// crowdBg.js — Persistent background crowd canvas
// ============================================

import { state } from './state.js';
import { drawGameVisuals, drawAmbientCrowd, initSupporters, generateTifoMap, resetDrawBatch } from './crowd.js';

let _resizeHandler = null;
let _lastIdleFrame = 0;
const IDLE_FRAME_INTERVAL = 50;  // ~20fps for idle animations (saves CPU)

// Stadium layout configuration (shared with crowd.js via state)
const STADIUM_CONFIG = {
    edgeMargin: 30,
    aisleWidth: 40,
    sectionDivisor: 500,  // canvasWidth / this = numSections
    barrierColor: '#1a1a2e',
    barrierHighlight: '#2a2a4e',
    railingColor: '#444466'
};

export function initCrowdBg() {
    const canvas = document.getElementById('crowd-bg');
    state.crowdBgCanvas = canvas;
    state.crowdBgCtx = canvas.getContext('2d');

    // Remove old handler first (if exists)
    if (_resizeHandler) {
        window.removeEventListener('resize', _resizeHandler);
        _resizeHandler = null;
    }

    // Create new resize handler
    function resizeCanvases() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        // Reinitialize supporters for the new dimensions
        state.supporters = [];
        // Recalculate stadium layout
        calculateStadiumLayout();
    }

    // Store reference BEFORE adding listener (so we can remove it later)
    _resizeHandler = resizeCanvases;
    window.addEventListener('resize', _resizeHandler);

    // Initial resize
    resizeCanvases();

    // Start the persistent animation loop
    requestAnimationFrame(crowdLoop);
}

// Calculate stadium layout (edges and aisle positions) - called on init/resize
// The actual drawing is done in crowd.js each frame (after background gradient)
function calculateStadiumLayout() {
    const w = state.crowdBgCanvas.width;

    const { edgeMargin, aisleWidth, sectionDivisor } = STADIUM_CONFIG;
    const numSections = Math.max(1, Math.floor(w / sectionDivisor));
    const numAisles = numSections - 1;
    const availableWidth = w - (2 * edgeMargin) - (numAisles * aisleWidth);
    const sectionWidth = availableWidth / numSections;

    // Store layout in state for crowd.js to use
    state.stadiumLayout = {
        canvasWidth: w,
        edgeMargin,
        aisleWidth,
        numSections,
        sectionWidth,
        aislePositions: []
    };

    // Calculate aisle positions
    for (let a = 0; a < numAisles; a++) {
        const aisleStart = edgeMargin + (a + 1) * sectionWidth + a * aisleWidth;
        state.stadiumLayout.aislePositions.push({
            start: aisleStart,
            end: aisleStart + aisleWidth
        });
    }
}

function crowdLoop(timestamp) {
    // Stop loop if canvas is removed from DOM or not connected
    if (!state.crowdBgCanvas || !state.crowdBgCanvas.isConnected) {
        return;
    }

    // Pause the crowd visuals if the game is paused
    if (state.isPaused) {
        requestAnimationFrame(crowdLoop);
        return;
    }

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

        // Generate tifo map from club badge for coreoType 3
        state.tifoReady = false;
        state.tifoMap = null;
        const canvasWidth = state.crowdBgCanvas?.width || 1200;
        const canvasHeight = state.crowdBgCanvas?.height || 300;
        // Properly handle the async tifo generation with error catching
        generateTifoMap(state.selectedClub.badge, canvasWidth, canvasHeight)
            .then(() => {
                // tifoReady is set inside generateTifoMap on success
            })
            .catch((err) => {
                console.warn('Failed to generate tifo map:', err);
                state.tifoReady = false;
                state.tifoMap = null;
            });
    } else {
        state.cachedColors = { primary: '#006633', secondary: '#FFFFFF' };
        state.tifoReady = false;
        state.tifoMap = null;
    }
    // Reinit supporters with new club colors
    state.supporters = [];
    state.smokeParticles = [];
    // Reset draw batch to clear accumulated color groups from previous club
    resetDrawBatch();
}
