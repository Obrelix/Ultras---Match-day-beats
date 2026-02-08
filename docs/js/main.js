// ============================================
// main.js — Entry point, game loop, event wiring
// ============================================

import { GameState, TIMING } from './config.js';
import { state, resetGameState } from './state.js';
import { initAudio, loadAudio, playAudio } from './audio.js';
import { analyzeBeats } from './beatDetection.js';
import { handleInput, registerMiss, simulateAI } from './input.js';
import { initVisualizer, computeWaveformPeaks, buildWaveformCache, drawVisualizer } from './renderer.js';
import { drawGameVisuals } from './crowd.js';
import { showScreen, applyClubTheme, renderClubSelection, renderChantSelection, endGame, elements, screens } from './ui.js';

// ============================================
// Club & Chant Selection
// ============================================

function selectClub(club) {
    state.selectedClub = club;
    applyClubTheme(club);
    renderChantSelection(selectChant);
    showScreen('chantSelect');
}

function selectChant(chant) {
    state.selectedChant = chant;
    startGame();
}

// ============================================
// Game Logic
// ============================================

async function startGame() {
    showScreen('gameplay');

    resetGameState();

    // Update UI
    elements.playerScore.textContent = '0';
    elements.aiScore.textContent = '0';
    elements.currentChantName.textContent = state.selectedChant.name;

    // Clear canvas effects
    elements.gameCanvas.classList.remove('beat-pulse', 'hit-perfect', 'hit-good', 'hit-ok', 'hit-miss');

    // Initialize audio and visualizer
    await initAudio();
    initVisualizer();
    await loadAudio(state.selectedChant.audio);

    // Pre-analyze beats and waveform
    state.detectedBeats = analyzeBeats(state.audioBuffer);
    computeWaveformPeaks();
    buildWaveformCache();

    // Start countdown then game
    await countdown();

    playAudio(endGame);
    state.audioStartTime = state.audioContext.currentTime;
    state.gameStartTime = performance.now();

    gameLoop();
}

async function countdown() {
    return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.id = 'countdown-overlay';
        overlay.innerHTML = '<span id="countdown-number">3</span>';
        document.body.appendChild(overlay);

        const numberEl = overlay.querySelector('#countdown-number');
        let count = 3;

        const interval = setInterval(() => {
            count--;
            if (count > 0) {
                numberEl.textContent = count;
            } else if (count === 0) {
                numberEl.textContent = 'GO!';
            } else {
                clearInterval(interval);
                overlay.remove();
                resolve();
            }
        }, 800);
    });
}

function gameLoop() {
    if (state.currentState !== GameState.PLAYING) return;

    const now = performance.now();
    const audioElapsed = state.audioContext.currentTime - state.audioStartTime;

    // Trigger pre-computed beats as playback reaches them
    while (state.nextBeatIndex < state.detectedBeats.length &&
           audioElapsed >= state.detectedBeats[state.nextBeatIndex]) {
        triggerBeat();
        state.nextBeatIndex++;
    }

    // Check for missed beats
    if (state.activeBeat && (now - state.activeBeat.time) > TIMING.OK) {
        registerMiss();
        state.activeBeat = null;
    }

    // Draw game visuals and audio visualizer
    drawGameVisuals();
    drawVisualizer();

    state.gameLoopId = requestAnimationFrame(gameLoop);
}

function triggerBeat() {
    state.totalBeats++;

    if (state.activeBeat) {
        registerMiss();
    }

    const beatAudioTime = state.detectedBeats[state.nextBeatIndex];
    const beatWallTime = state.gameStartTime + beatAudioTime * 1000;

    state.activeBeat = {
        time: beatWallTime,
        index: state.nextBeatIndex
    };

    // Visual feedback
    elements.gameCanvas.classList.remove('beat-pulse');
    void elements.gameCanvas.offsetWidth;
    elements.gameCanvas.classList.add('beat-pulse');

    elements.gameVisualCanvas.classList.remove('visual-canvas-beat-pulse');
    void elements.gameVisualCanvas.offsetWidth;
    elements.gameVisualCanvas.classList.add('visual-canvas-beat-pulse');
    state.beatFlashIntensity = 1;

    // Trigger crowd jump
    state.crowdBeatTime = performance.now();

    // AI plays
    simulateAI();
}

// ============================================
// Event Listeners
// ============================================

elements.startBtn.addEventListener('click', () => {
    renderClubSelection(selectClub);
    showScreen('clubSelect');
});

elements.backToTitle.addEventListener('click', () => {
    showScreen('title');
});

elements.backToClubs.addEventListener('click', () => {
    showScreen('clubSelect');
});

elements.playAgainBtn.addEventListener('click', () => {
    startGame();
});

elements.changeChantBtn.addEventListener('click', () => {
    showScreen('chantSelect');
});

// Input - Spacebar
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        handleInput();
    }
});

// Touch support for mobile
document.addEventListener('touchstart', (e) => {
    if (state.currentState === GameState.PLAYING) {
        e.preventDefault();
        handleInput();
    }
});

// Click support during gameplay
screens.gameplay.addEventListener('click', () => {
    handleInput();
});

// Initialize on load
showScreen('title');
