// ============================================
// main.js — Entry point, game loop, event wiring
// ============================================

import { GameState, MATCHDAY, DIFFICULTY_PRESETS, clubs } from './config.js';
import { state, resetGameState, resetMatchState } from './state.js';
import { initAudio, loadAudio, playAudio, stopAudio, setVolume, setSFXVolume } from './audio.js';
import { analyzeBeats } from './beatDetection.js';
import { handleInput, registerMiss, simulateAI } from './input.js';
import { initVisualizer, computeWaveformPeaks, buildWaveformCache, drawVisualizer } from './renderer.js';
import { drawGameVisuals, stopChantResultAnimation } from './crowd.js';
import {
    showScreen, applyClubTheme, renderClubSelection, renderChantSelection,
    renderMatchdayIntro, updateMatchScoreboard, updateScoreboardTeams,
    setMatchdayChantStarter, endGame, elements, screens
} from './ui.js';
import { loadSettings, saveSettings, hasTutorialSeen, markTutorialSeen } from './storage.js';

// ============================================
// Initialize settings from localStorage
// ============================================

const savedSettings = loadSettings();
Object.assign(state.settings, savedSettings);

// Apply difficulty preset
const preset = DIFFICULTY_PRESETS[state.settings.difficulty] || DIFFICULTY_PRESETS.normal;
state.activeTiming = { PERFECT: preset.PERFECT, GOOD: preset.GOOD, OK: preset.OK };

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
    stopChantResultAnimation(); // Stop any lingering result animation

    const chant = state.matchChants[state.currentChantIndex];
    state.selectedChant = chant;

    showScreen('gameplay');
    updateScoreboardTeams();

    // Show & update match scoreboard
    elements.matchScoreboard.classList.remove('hidden');
    updateMatchScoreboard();

    resetGameState();

    // Apply difficulty preset
    const diffPreset = DIFFICULTY_PRESETS[state.settings.difficulty] || DIFFICULTY_PRESETS.normal;
    state.activeTiming = { PERFECT: diffPreset.PERFECT, GOOD: diffPreset.GOOD, OK: diffPreset.OK };

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

    // Show loading overlay and yield for render
    elements.loadingOverlay.classList.remove('hidden');
    await new Promise(resolve => setTimeout(resolve, 50));

    // Pre-analyze beats and waveform
    state.detectedBeats = analyzeBeats(state.audioBuffer);
    computeWaveformPeaks();
    buildWaveformCache();

    elements.loadingOverlay.classList.add('hidden');

    // Tutorial on first play
    if (!hasTutorialSeen()) {
        await showTutorial();
    }

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
    stopChantResultAnimation(); // Stop any lingering result animation
    showScreen('gameplay');
    updateScoreboardTeams();

    // Hide match scoreboard in practice mode
    elements.matchScoreboard.classList.add('hidden');

    resetGameState();

    // Apply difficulty preset
    const diffPreset = DIFFICULTY_PRESETS[state.settings.difficulty] || DIFFICULTY_PRESETS.normal;
    state.activeTiming = { PERFECT: diffPreset.PERFECT, GOOD: diffPreset.GOOD, OK: diffPreset.OK };

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

    // Show loading overlay and yield for render
    elements.loadingOverlay.classList.remove('hidden');
    await new Promise(resolve => setTimeout(resolve, 50));

    // Pre-analyze beats and waveform
    state.detectedBeats = analyzeBeats(state.audioBuffer);
    computeWaveformPeaks();
    buildWaveformCache();

    elements.loadingOverlay.classList.add('hidden');

    // Tutorial on first play
    if (!hasTutorialSeen()) {
        await showTutorial();
    }

    // Start countdown then game
    await countdown();

    playAudio(endGame);
    state.audioStartTime = state.audioContext.currentTime;
    state.gameStartTime = performance.now();

    gameLoop();
}

async function showTutorial() {
    elements.tutorialOverlay.classList.remove('hidden');
    return new Promise(resolve => {
        function dismiss() {
            elements.tutorialOverlay.classList.add('hidden');
            document.removeEventListener('keydown', dismiss);
            document.removeEventListener('touchstart', dismiss);
            document.removeEventListener('click', dismiss);
            markTutorialSeen();
            resolve();
        }
        // Small delay to avoid the click that opened gameplay from dismissing instantly
        setTimeout(() => {
            document.addEventListener('keydown', dismiss, { once: true });
            document.addEventListener('touchstart', dismiss, { once: true });
            document.addEventListener('click', dismiss, { once: true });
        }, 300);
    });
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
    if (state.isPaused) return;

    const now = performance.now();
    const audioElapsed = state.audioContext.currentTime - state.audioStartTime;

    // Trigger pre-computed beats as playback reaches them
    while (state.nextBeatIndex < state.detectedBeats.length &&
           audioElapsed >= state.detectedBeats[state.nextBeatIndex]) {
        triggerBeat();
        state.nextBeatIndex++;
    }

    // Check for missed beats
    if (state.activeBeat && (now - state.activeBeat.time) > state.activeTiming.OK) {
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
// Pause / Resume
// ============================================

function pauseGame() {
    if (state.isPaused || state.currentState !== GameState.PLAYING) return;
    state.isPaused = true;
    state._pauseTime = performance.now();
    cancelAnimationFrame(state.gameLoopId);
    if (state.audioContext) state.audioContext.suspend();
    elements.pauseOverlay.classList.remove('hidden');
}

async function resumeGame() {
    if (!state.isPaused) return;
    const pauseDuration = performance.now() - state._pauseTime;
    state.gameStartTime += pauseDuration;
    if (state.activeBeat) {
        state.activeBeat.time += pauseDuration;
    }
    state.isPaused = false;
    if (state.audioContext) await state.audioContext.resume();
    elements.pauseOverlay.classList.add('hidden');
    // Close volume panel if open
    elements.volumePanel.classList.add('hidden');
    gameLoop();
}

function quitToMenu() {
    state.isPaused = false;
    cancelAnimationFrame(state.gameLoopId);
    stopAudio();
    // Clean up countdown overlay if still present
    const countdownEl = document.getElementById('countdown-overlay');
    if (countdownEl) countdownEl.remove();
    elements.pauseOverlay.classList.add('hidden');
    elements.volumePanel.classList.add('hidden');
    showScreen('title');
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
    if (e.code === 'Escape') {
        if (state.isPaused) resumeGame();
        else if (state.currentState === GameState.PLAYING) pauseGame();
        return;
    }
    if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        if (state.isPaused) return;
        handleInput();
    }
});

// Touch support for mobile
let lastTouchTime = 0;
document.addEventListener('touchstart', (e) => {
    if (state.currentState === GameState.PLAYING && !state.isPaused) {
        e.preventDefault();
        lastTouchTime = performance.now();
        handleInput();
    }
}, { passive: false });

// Click support during gameplay (skip synthetic clicks from touch)
screens.gameplay.addEventListener('click', (e) => {
    if (state.isPaused) return;
    if (performance.now() - lastTouchTime < 500) return;
    // Don't handle clicks on UI controls
    if (e.target.closest('#volume-controls') || e.target.closest('#pause-btn')) return;
    handleInput();
});

// Pause button
elements.pauseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (state.isPaused) resumeGame();
    else pauseGame();
});

// Resume / Quit buttons
elements.resumeBtn.addEventListener('click', () => resumeGame());
elements.quitBtn.addEventListener('click', () => quitToMenu());

// Volume toggle
elements.volumeToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    elements.volumePanel.classList.toggle('hidden');
});

// Music volume slider
elements.volumeSlider.addEventListener('input', (e) => {
    const val = parseInt(e.target.value) / 100;
    setVolume(val);
    state.settings.volume = val;
    saveSettings(state.settings);
});

// SFX volume slider
elements.sfxVolumeSlider.addEventListener('input', (e) => {
    const val = parseInt(e.target.value) / 100;
    setSFXVolume(val);
    state.settings.sfxVolume = val;
    saveSettings(state.settings);
});

// Reduced effects toggle
elements.reducedEffectsToggle.addEventListener('change', (e) => {
    state.settings.reducedEffects = e.target.checked;
    saveSettings(state.settings);
});

// Difficulty buttons
document.querySelectorAll('.difficulty-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.difficulty-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.settings.difficulty = btn.dataset.difficulty;
        const p = DIFFICULTY_PRESETS[state.settings.difficulty] || DIFFICULTY_PRESETS.normal;
        state.activeTiming = { PERFECT: p.PERFECT, GOOD: p.GOOD, OK: p.OK };
        saveSettings(state.settings);
    });
});

// ============================================
// Apply persisted settings to UI on load
// ============================================

elements.volumeSlider.value = Math.round(state.settings.volume * 100);
elements.sfxVolumeSlider.value = Math.round(state.settings.sfxVolume * 100);
elements.reducedEffectsToggle.checked = state.settings.reducedEffects;

// Set active difficulty button
document.querySelectorAll('.difficulty-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.difficulty === state.settings.difficulty);
});

// Initialize on load
showScreen('title');
