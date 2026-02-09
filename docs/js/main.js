// ============================================
// main.js — Entry point, game loop, event wiring
// ============================================

import { GameState, TIMING, MATCHDAY, clubs } from './config.js';
import { state, resetGameState, resetMatchState } from './state.js';
import { initAudio, loadAudio, playAudio } from './audio.js';
import { analyzeBeats } from './beatDetection.js';
import { handleInput, registerMiss, simulateAI } from './input.js';
import { initVisualizer, computeWaveformPeaks, buildWaveformCache, drawVisualizer } from './renderer.js';
import { drawGameVisuals } from './crowd.js';
import {
    showScreen, applyClubTheme, renderClubSelection, renderChantSelection,
    renderMatchdayIntro, updateMatchScoreboard, setMatchdayChantStarter,
    endGame, elements, screens
} from './ui.js';

// ============================================
// Club & Chant Selection (Practice)
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
// Club Selection (Match Day)
// ============================================

function selectClubMatchday(club) {
    state.selectedClub = club;
    applyClubTheme(club);
    resetMatchState();
    state.gameMode = 'matchday';

    // Pick random rival (exclude player's team, must have >= MIN_CHANTS_FOR_MATCHDAY unique chants)
    const eligible = Object.values(clubs).filter(c => {
        if (c.id === club.id) return false;
        const uniqueChants = new Set(c.chants.map(ch => ch.audio));
        return uniqueChants.size >= MATCHDAY.MIN_CHANTS_FOR_MATCHDAY;
    });

    state.rivalClub = eligible[Math.floor(Math.random() * eligible.length)];

    // Deduplicate player's chants by audio path, then shuffle and pick 6
    const seen = new Set();
    const uniqueChants = club.chants.filter(c => {
        if (seen.has(c.audio)) return false;
        seen.add(c.audio);
        return true;
    });

    // Fisher-Yates shuffle
    for (let i = uniqueChants.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [uniqueChants[i], uniqueChants[j]] = [uniqueChants[j], uniqueChants[i]];
    }

    state.matchChants = uniqueChants.slice(0, MATCHDAY.CHANTS_PER_HALF * 2);

    renderMatchdayIntro();
    showScreen('matchdayIntro');
}

// ============================================
// Start a Match Day chant
// ============================================

async function startMatchdayChant() {
    const chant = state.matchChants[state.currentChantIndex];
    state.selectedChant = chant;

    showScreen('gameplay');

    // Show & update match scoreboard
    elements.matchScoreboard.classList.remove('hidden');
    updateMatchScoreboard();

    resetGameState();

    // Update UI
    elements.playerScore.textContent = '0';
    elements.aiScore.textContent = '0';
    elements.currentChantName.textContent = chant.name;

    // Clear canvas effects
    elements.gameCanvas.classList.remove('beat-pulse', 'hit-perfect', 'hit-good', 'hit-ok', 'hit-miss');

    // Initialize audio and visualizer
    await initAudio();
    initVisualizer();
    await loadAudio(chant.audio);

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

// Register the chant starter with ui.js so it can auto-advance
setMatchdayChantStarter(startMatchdayChant);

// ============================================
// Game Logic (Practice)
// ============================================

async function startGame() {
    showScreen('gameplay');

    // Hide match scoreboard in practice mode
    elements.matchScoreboard.classList.add('hidden');

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

// Title → Mode Select
elements.startBtn.addEventListener('click', () => {
    showScreen('modeSelect');
});

// Mode Select → Back to Title
elements.backToTitleFromMode.addEventListener('click', () => {
    showScreen('title');
});

// Practice mode
elements.modePractice.addEventListener('click', () => {
    state.gameMode = 'practice';
    renderClubSelection(selectClub);
    showScreen('clubSelect');
});

// Match Day mode
elements.modeMatchday.addEventListener('click', () => {
    state.gameMode = 'matchday';
    renderClubSelection(selectClubMatchday, MATCHDAY.MIN_CHANTS_FOR_MATCHDAY);
    showScreen('clubSelect');
});

// Club select → Back (returns to mode select now)
elements.backToTitle.addEventListener('click', () => {
    showScreen('modeSelect');
});

elements.backToClubs.addEventListener('click', () => {
    showScreen('clubSelect');
});

// Match Day intro → Kick Off
elements.kickoffBtn.addEventListener('click', () => {
    startMatchdayChant();
});

// Halftime → Second Half
elements.secondHalfBtn.addEventListener('click', () => {
    startMatchdayChant();
});

// Fulltime buttons
elements.fulltimePlayAgainBtn.addEventListener('click', () => {
    // Restart match with same club
    selectClubMatchday(state.selectedClub);
});

elements.fulltimeMainMenuBtn.addEventListener('click', () => {
    showScreen('title');
});

// Practice results buttons
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
}, { passive: false });

// Click support during gameplay
screens.gameplay.addEventListener('click', () => {
    handleInput();
});

// Initialize on load
showScreen('title');
