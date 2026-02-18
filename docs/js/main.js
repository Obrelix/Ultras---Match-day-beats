// ============================================
// main.js — Entry point, game loop, event wiring
// ============================================

import { GameState, MATCHDAY, DIFFICULTY_PRESETS, BEAT_DETECTION, clubs, MODIFIERS, MODIFIER_BONUSES, POWERUPS, POWERUP_KEY, AI_PERSONALITIES, CLUB_AI_PERSONALITIES, normalizeBeats, autoGenerateHoldBeats } from './config.js';
import { state, resetGameState, resetMatchState } from './state.js';
import { initAudio, loadAudio, playAudio, stopAudio, setVolume, setSFXVolume, playMetronomeClick } from './audio.js';
import {
    initCustomChantDB, getAllCustomChants, saveCustomChant, deleteCustomChant,
    processUploadedFile, decodeCustomChantAudio
} from './customChants.js';
import { handleInput, handleInputRelease, registerMiss, simulateAI, simulateAIHoldBeat, updateHoldProgress, setMainCallbacks, triggerTrashTalk, hideTrashTalk } from './input.js';
import { initVisualizer, computeWaveformPeaks, buildWaveformCache, drawVisualizer } from './renderer.js';
import { initCrowdBg, setCrowdMode, updateCrowdClub } from './crowdBg.js';
import {
    showScreen, applyClubTheme, renderClubSelection, renderChantSelection,
    renderMatchdayIntro, updateMatchScoreboard, updateScoreboardTeams,
    setMatchdayChantStarter, setScoreSubmitHandler, endGame, elements, screens,
    updateTitleLevelBadge, renderProfileScreen, switchProfileTab, initAnalyticsSession,
    navigateBack, navigateHome, hideAbandonMatchConfirm, confirmAbandonMatch,
    startCalibration, cancelCalibration
} from './ui.js';
import { loadProgression, toggleChoreoDebug } from './progression.js';
import { loadSettings, saveSettings, hasTutorialSeen, markTutorialSeen } from './storage.js';
import { initLeaderboard } from './leaderboard.js';
import { setupLeaderboardUI, handleScoreSubmission } from './leaderboardUI.js';
import {
    startRecording, stopRecording, recordInput, getReplayData,
    encodeReplay, decodeReplay, validateReplayCode,
    preparePlayback, getNextReplayInput, isReplayFinished, stopPlayback,
    formatReplayDuration
} from './replay.js';

// ============================================
// Beat Detection Worker (runs off main thread)
// ============================================

let beatWorker = null;
let beatWorkerRequestId = 0;  // Track request IDs to prevent race conditions

function analyzeBeatsAsync(audioBuffer) {
    const WORKER_TIMEOUT_MS = 30000; // 30 second timeout
    const currentRequestId = ++beatWorkerRequestId;  // Unique ID for this request

    const workerPromise = new Promise((resolve, reject) => {
        // Create worker if not exists
        if (!beatWorker) {
            beatWorker = new Worker('./js/beatWorker.js');
        }

        // Extract channel data from AudioBuffer
        // Use slice() to create transferable Float32Array copies (more efficient than Array.from)
        const numChannels = audioBuffer.numberOfChannels;
        const channelData = [];
        const transferList = [];
        for (let i = 0; i < numChannels; i++) {
            const original = audioBuffer.getChannelData(i);
            const copy = original.slice();  // Creates a new Float32Array
            channelData.push(copy);
            transferList.push(copy.buffer);  // Transfer the underlying ArrayBuffer
        }

        // Set up one-time message handler for this analysis
        // Uses requestId to prevent race conditions with concurrent requests
        beatWorker.onmessage = (e) => {
            // Ignore responses from stale requests
            if (e.data.requestId !== currentRequestId) {
                return;
            }
            if (e.data.error) {
                reject(new Error(e.data.error));
            } else {
                resolve(e.data.beats);
            }
        };

        beatWorker.onerror = (e) => {
            console.error('Beat worker error:', e);
            reject(e);
        };

        // Send data to worker with requestId (use transferList for zero-copy transfer)
        beatWorker.postMessage({
            requestId: currentRequestId,
            channelData,
            numChannels,
            sampleRate: audioBuffer.sampleRate,
            duration: audioBuffer.duration,
            config: BEAT_DETECTION
        }, transferList);
    });

    // Race against timeout to prevent indefinite hanging
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Beat analysis timed out')), WORKER_TIMEOUT_MS);
    });

    return Promise.race([workerPromise, timeoutPromise]);
}

// Terminate worker when no longer needed (call on game quit/cleanup)
function terminateBeatWorker() {
    if (beatWorker) {
        beatWorker.terminate();
        beatWorker = null;
    }
}

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
    updateCrowdClub();
    renderChantSelection(selectChant);
    renderCustomChants();
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
    updateCrowdClub();
    resetMatchState();
    state.gameMode = 'matchday';

    // Pick random rival (exclude player's team, must have >= MIN_CHANTS_FOR_MATCHDAY unique chants)
    const eligible = Object.values(clubs).filter(c => {
        if (c.id === club.id) return false;
        const uniqueChants = new Set(c.chants.map(ch => ch.audio));
        return uniqueChants.size >= MATCHDAY.MIN_CHANTS_FOR_MATCHDAY;
    });

    state.rivalClub = eligible[Math.floor(Math.random() * eligible.length)];

    // Initialize AI personality based on rival club
    const personalityId = CLUB_AI_PERSONALITIES[state.rivalClub.id] || 'consistent';
    state.aiPersonality = AI_PERSONALITIES[personalityId];
    state.aiMood = 'neutral';
    state.aiStreakCounter = 0;
    state.aiInStreak = false;

    // Show AI mood indicator
    updateAIMoodUI();

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
    setCrowdMode('gameplay');
    updateScoreboardTeams();

    // Show & update match info
    elements.matchInfo.classList.remove('hidden');
    updateMatchScoreboard();

    // Show AI mood indicator in matchday mode
    updateAIMoodUI();

    // Show active modifiers if any
    showActiveModifiers();

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

    // Show loading overlay
    elements.loadingOverlay.classList.remove('hidden');

    try {
        // Initialize audio and visualizer
        await initAudio();
        initVisualizer();
        await loadAudio(chant.audio);

        // Yield for render
        await new Promise(resolve => setTimeout(resolve, 50));

        // Use manual beats if defined in chant config, otherwise detect automatically
        if (state.selectedChant.beats && state.selectedChant.beats.length > 0) {
            // Normalize manual beats (supports mixed tap/hold format)
            state.detectedBeats = normalizeBeats(state.selectedChant.beats);
            console.log('Using manual beats:', state.detectedBeats.length);
        } else {
            // Pre-analyze beats in Web Worker (non-blocking)
            // Auto-generate hold beats from closely-spaced detected beats
            const rawBeats = await analyzeBeatsAsync(state.audioBuffer);
            state.detectedBeats = autoGenerateHoldBeats(rawBeats);
            const holdCount = state.detectedBeats.filter(b => b.type === 'hold').length;
            console.log(`Auto-detected ${rawBeats.length} beats, generated ${holdCount} hold beats`);
        }

        // Bug #24 fix: Guard against empty beat detection
        if (!state.detectedBeats || state.detectedBeats.length === 0) {
            console.warn('No beats detected in audio - gameplay may not work correctly');
            // Generate fallback beats at regular intervals based on audio duration
            const duration = state.audioBuffer?.duration || 60;
            const fallbackBPM = 120;
            const interval = 60 / fallbackBPM;
            state.detectedBeats = [];
            for (let t = 0.5; t < duration - 0.5; t += interval) {
                state.detectedBeats.push({ time: t, type: 'tap' });
            }
            console.log(`Generated ${state.detectedBeats.length} fallback beats at ${fallbackBPM} BPM`);
        }

        computeWaveformPeaks();
        buildWaveformCache();

        elements.loadingOverlay.classList.add('hidden');

        // Tutorial on first play
        if (!hasTutorialSeen()) {
            await showTutorial();
        }

        // Start countdown then game
        await countdown();

        // Start recording replay (only if not replaying)
        if (!state.isReplaying) {
            startRecording();
        }

        playAudio(endGame);
        state.audioStartTime = state.audioContext.currentTime;
        state.gameStartTime = performance.now();

        // Trigger game start trash talk
        setTimeout(() => triggerTrashTalk('gameStart'), 500);

        gameLoop();
    } catch (error) {
        console.error('Failed to start chant:', error);
        elements.loadingOverlay.classList.add('hidden');
        // Show error and return to menu
        alert('Failed to load audio. Please try again.');
        quitToMenu();
    }
}

// Register the chant starter with ui.js so it can auto-advance
setMatchdayChantStarter(startMatchdayChant);

// ============================================
// Game Logic (Practice)
// ============================================

async function startGame() {
    showScreen('gameplay');
    setCrowdMode('gameplay');
    updateScoreboardTeams();

    // Hide match info in practice mode
    elements.matchInfo.classList.add('hidden');

    // Hide AI mood indicator in practice mode
    elements.aiMoodIndicator?.classList.add('hidden');

    // Show active modifiers if any
    showActiveModifiers();

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

    // Show loading overlay
    elements.loadingOverlay.classList.remove('hidden');

    try {
        // Initialize audio and visualizer
        await initAudio();
        initVisualizer();
        await loadAudio(state.selectedChant.audio);

        // Yield for render
        await new Promise(resolve => setTimeout(resolve, 50));

        // Use manual beats if defined in chant config, otherwise detect automatically
        if (state.selectedChant.beats && state.selectedChant.beats.length > 0) {
            // Normalize manual beats (supports mixed tap/hold format)
            state.detectedBeats = normalizeBeats(state.selectedChant.beats);
            console.log('Using manual beats:', state.detectedBeats.length);
        } else {
            // Pre-analyze beats in Web Worker (non-blocking)
            // Auto-generate hold beats from closely-spaced detected beats
            const rawBeats = await analyzeBeatsAsync(state.audioBuffer);
            state.detectedBeats = autoGenerateHoldBeats(rawBeats);
            const holdCount = state.detectedBeats.filter(b => b.type === 'hold').length;
            console.log(`Auto-detected ${rawBeats.length} beats, generated ${holdCount} hold beats`);
        }

        // Bug #24 fix: Guard against empty beat detection
        if (!state.detectedBeats || state.detectedBeats.length === 0) {
            console.warn('No beats detected in audio - gameplay may not work correctly');
            // Generate fallback beats at regular intervals based on audio duration
            const duration = state.audioBuffer?.duration || 60;
            const fallbackBPM = 120;
            const interval = 60 / fallbackBPM;
            state.detectedBeats = [];
            for (let t = 0.5; t < duration - 0.5; t += interval) {
                state.detectedBeats.push({ time: t, type: 'tap' });
            }
            console.log(`Generated ${state.detectedBeats.length} fallback beats at ${fallbackBPM} BPM`);
        }

        computeWaveformPeaks();
        buildWaveformCache();

        elements.loadingOverlay.classList.add('hidden');

        // Tutorial on first play
        if (!hasTutorialSeen()) {
            await showTutorial();
        }

        // Start countdown then game
        await countdown();

        // Start recording replay (only in practice mode, not replay playback)
        if (!state.isReplaying) {
            startRecording();
        }

        playAudio(endGame);
        state.audioStartTime = state.audioContext.currentTime;
        state.gameStartTime = performance.now();

        // Trigger game start trash talk
        setTimeout(() => triggerTrashTalk('gameStart'), 500);

        gameLoop();
    } catch (error) {
        console.error('Failed to start game:', error);
        elements.loadingOverlay.classList.add('hidden');
        // Show error and return to menu
        alert('Failed to load audio. Please try again.');
        quitToMenu();
    }
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

    // Check power-up expiration
    checkPowerupExpiration();

    // Update hold beat progress
    updateHoldProgress();

    // Trigger pre-computed beats as playback reaches them
    while (state.nextBeatIndex < state.detectedBeats.length) {
        const beat = state.detectedBeats[state.nextBeatIndex];
        const beatTime = typeof beat === 'object' ? beat.time : beat;
        if (audioElapsed < beatTime) break;
        triggerBeat();
        state.nextBeatIndex++;
    }

    // Check for missed beats
    if (state.activeBeat && (now - state.activeBeat.time) > state.activeTiming.OK) {
        registerMiss();
        state.activeBeat = null;
    }

    // Check for near-end trash talk (once when crossing 80% threshold)
    const totalBeats = state.detectedBeats.length;
    const progress = totalBeats > 0 ? state.nextBeatIndex / totalBeats : 0;
    if (progress >= 0.8 && !state._nearEndTrashTalkTriggered) {
        state._nearEndTrashTalkTriggered = true;
        triggerTrashTalk('nearEnd');
    }

    // Update frenzy CSS class for visual filters (#2)
    // Performance: Use state tracking instead of DOM queries
    const crowdCanvas = state.crowdBgCanvas;
    if (crowdCanvas) {
        const isFrenzy = state.playerCombo > 5 || state.crowdEmotion === 'celebrate';
        const isIntense = state.playerCombo >= 20;

        // Track fever/frenzy time for Fever Master achievement
        if (isFrenzy) {
            if (state.lastFeverCheckTime > 0) {
                const deltaSeconds = (now - state.lastFeverCheckTime) / 1000;
                state.feverTimeAccumulated += deltaSeconds;
            }
            state.lastFeverCheckTime = now;
        } else {
            state.lastFeverCheckTime = 0;
        }

        // Track state to avoid classList.contains() calls
        if (isFrenzy !== state._lastFrenzyState) {
            crowdCanvas.classList.toggle('frenzy', isFrenzy);
            state._lastFrenzyState = isFrenzy;
        }

        if (isIntense !== state._lastIntenseState) {
            crowdCanvas.classList.toggle('frenzy-intense', isIntense);
            state._lastIntenseState = isIntense;
        }
    }

    // Draw audio visualizer (crowd is drawn by persistent crowdBg loop)
    drawVisualizer();

    state.gameLoopId = requestAnimationFrame(gameLoop);
}

function triggerBeat() {
    state.totalBeats++;

    if (state.activeBeat) {
        registerMiss();
    }

    const beatData = state.detectedBeats[state.nextBeatIndex];
    const beatTime = typeof beatData === 'object' ? beatData.time : beatData;
    const beatWallTime = state.gameStartTime + beatTime * 1000;

    state.activeBeat = {
        time: beatWallTime,
        index: state.nextBeatIndex,
        beatData: beatData  // Include full beat data for hold beat detection
    };

    // Visual feedback
    elements.gameCanvas.classList.remove('beat-pulse');
    void elements.gameCanvas.offsetWidth;
    elements.gameCanvas.classList.add('beat-pulse');
    state.beatFlashIntensity = 1;

    // Trigger crowd jump
    state.crowdBeatTime = performance.now();

    // Play metronome click if enabled
    playMetronomeClick();

    // AI plays - use different simulation for hold beats
    const isHoldBeat = typeof beatData === 'object' && beatData.type === 'hold';
    if (isHoldBeat) {
        simulateAIHoldBeat(beatData);
    } else {
        simulateAI();
    }
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
    // Hide trash talk on pause
    hideTrashTalk();
}

async function resumeGame() {
    if (!state.isPaused) return;

    // Timing system: All wall-clock times use performance.now() in milliseconds.
    // audioContext.currentTime is in seconds and pauses during suspend.
    // Shift wall-clock references by pause duration to stay in sync.
    const pauseDuration = performance.now() - state._pauseTime;
    state.gameStartTime += pauseDuration;
    if (state.activeBeat) {
        state.activeBeat.time += pauseDuration;  // activeBeat.time is wall-clock ms
    }
    // Also shift crowdBeatTime to keep visual sync
    if (state.crowdBeatTime > 0) {
        state.crowdBeatTime += pauseDuration;
    }
    // Bug #15 fix: Shift hold beat timing to stay in sync after pause
    if (state.holdState.isHolding) {
        if (state.holdState.pressTime > 0) {
            state.holdState.pressTime += pauseDuration;
        }
        if (state.holdState.expectedEndTime > 0) {
            state.holdState.expectedEndTime += pauseDuration;
        }
    }

    state.isPaused = false;
    if (state.audioContext) await state.audioContext.resume();
    elements.pauseOverlay.classList.add('hidden');
    // Close settings panel if open
    elements.settingsPanel.classList.add('hidden');
    // Use requestAnimationFrame instead of direct call to prevent race conditions
    state.gameLoopId = requestAnimationFrame(gameLoop);
}

function quitToMenu() {
    state.isPaused = false;
    cancelAnimationFrame(state.gameLoopId);
    stopAudio();
    setCrowdMode('idle');
    // Clean up countdown overlay if still present
    const countdownEl = document.getElementById('countdown-overlay');
    if (countdownEl) countdownEl.remove();
    elements.pauseOverlay.classList.add('hidden');
    elements.settingsPanel.classList.add('hidden');
    // Clean up frenzy CSS classes
    if (state.crowdBgCanvas) {
        state.crowdBgCanvas.classList.remove('frenzy', 'frenzy-intense');
    }
    // Hide gameplay UI elements
    elements.activeModifiers?.classList.add('hidden');
    elements.aiMoodIndicator?.classList.add('hidden');
    // Terminate beat worker to free memory
    terminateBeatWorker();
    // Reset match state to prevent stale data on next game
    resetMatchState();
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
    resetMatchState();  // Clear match state when returning to main menu
    showScreen('title');
});

// Practice results buttons
elements.playAgainBtn.addEventListener('click', () => {
    startGame();
});

elements.changeChantBtn.addEventListener('click', () => {
    showScreen('chantSelect');
});

// ============================================
// Global Navigation
// ============================================

elements.navBackBtn?.addEventListener('click', () => {
    navigateBack();
});

elements.navHomeBtn?.addEventListener('click', () => {
    navigateHome();
});

elements.navProfileBtn?.addEventListener('click', () => {
    renderProfileScreen();
    showScreen('profile');
});

// Abandon match modal handlers
elements.abandonConfirmBtn?.addEventListener('click', () => {
    confirmAbandonMatch();
});

elements.abandonCancelBtn?.addEventListener('click', () => {
    hideAbandonMatchConfirm();
});

// ============================================
// Input Handling - Keyboard, Mouse, Touch
// ============================================

// Tap zone elements
const tapZone = document.getElementById('tap-zone');
const tapRipple = document.getElementById('tap-ripple');
let lastInputTime = 0;
let isPointerDown = false;
let activeTouchId = null; // Track single touch to prevent multi-touch

// Visual feedback - ripple effect at tap location
function triggerTapFeedback(x, y) {
    if (!tapRipple || !tapZone) return;

    const rect = tapZone.getBoundingClientRect();
    const relX = x - rect.left;
    const relY = y - rect.top;

    tapRipple.style.left = `${relX}px`;
    tapRipple.style.top = `${relY}px`;
    tapRipple.classList.remove('active');
    // Force reflow to restart animation
    void tapRipple.offsetWidth;
    tapRipple.classList.add('active');

    // Add pressed state to tap zone
    tapZone.classList.add('pressed');
}

function releaseTapFeedback() {
    if (tapZone) {
        tapZone.classList.remove('pressed');
    }
}

// Haptic feedback for mobile
function triggerHaptic(type = 'light') {
    if (!navigator.vibrate) return;
    switch (type) {
        case 'light': navigator.vibrate(10); break;
        case 'medium': navigator.vibrate(25); break;
        case 'heavy': navigator.vibrate([30, 20, 30]); break;
        case 'success': navigator.vibrate([10, 50, 20]); break;
        case 'error': navigator.vibrate([50, 30, 50]); break;
    }
}

// Input - Spacebar (keydown for press, keyup for release)
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
        triggerHaptic('light');
    }
});

// Input release - for hold beats
document.addEventListener('keyup', (e) => {
    if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        if (state.isPaused) return;
        handleInputRelease();
    }
});

// Touch support for mobile - with multi-touch prevention
document.addEventListener('touchstart', (e) => {
    if (state.currentState !== GameState.PLAYING || state.isPaused) return;

    // Only track the first touch, ignore additional fingers
    if (activeTouchId !== null) return;

    const touch = e.changedTouches[0];
    activeTouchId = touch.identifier;

    // Don't intercept touches on UI controls
    const target = document.elementFromPoint(touch.clientX, touch.clientY);
    if (target?.closest('#global-settings') ||
        target?.closest('#pause-btn') ||
        target?.closest('#powerup-hud')) {
        activeTouchId = null;
        return;
    }

    e.preventDefault();
    lastInputTime = performance.now();
    isPointerDown = true;

    triggerTapFeedback(touch.clientX, touch.clientY);
    triggerHaptic('light');
    handleInput();
}, { passive: false });

// Touch move - update ripple position for hold beats
document.addEventListener('touchmove', (e) => {
    if (state.currentState !== GameState.PLAYING || state.isPaused) return;
    if (activeTouchId === null) return;

    // Find our tracked touch
    for (const touch of e.changedTouches) {
        if (touch.identifier === activeTouchId) {
            triggerTapFeedback(touch.clientX, touch.clientY);
            break;
        }
    }
}, { passive: true });

// Touch release for hold beats
document.addEventListener('touchend', (e) => {
    if (state.currentState !== GameState.PLAYING) return;

    // Only respond to our tracked touch
    for (const touch of e.changedTouches) {
        if (touch.identifier === activeTouchId) {
            activeTouchId = null;
            isPointerDown = false;
            releaseTapFeedback();
            if (!state.isPaused) {
                handleInputRelease();
            }
            break;
        }
    }
}, { passive: true });

// Touch cancel - treat as release
document.addEventListener('touchcancel', (e) => {
    if (activeTouchId !== null) {
        activeTouchId = null;
        isPointerDown = false;
        releaseTapFeedback();
        if (state.currentState === GameState.PLAYING && !state.isPaused) {
            handleInputRelease();
        }
    }
}, { passive: true });

// Mouse support - mousedown/mouseup for hold beats
screens.gameplay.addEventListener('mousedown', (e) => {
    if (state.currentState !== GameState.PLAYING) return;
    if (state.isPaused) return;
    // Skip if this was triggered by touch (reduced from 500ms to 100ms)
    if (performance.now() - lastInputTime < 100) return;
    // Don't handle clicks on UI controls
    if (e.target.closest('#global-settings') ||
        e.target.closest('#pause-btn') ||
        e.target.closest('#powerup-hud') ||
        e.target.closest('.btn-primary') ||
        e.target.closest('.btn-secondary')) return;

    e.preventDefault();
    isPointerDown = true;
    lastInputTime = performance.now();

    triggerTapFeedback(e.clientX, e.clientY);
    handleInput();
});

// Also handle clicks on the tap zone specifically
if (tapZone) {
    tapZone.addEventListener('mousedown', (e) => {
        if (state.currentState !== GameState.PLAYING) return;
        if (state.isPaused) return;
        if (performance.now() - lastInputTime < 100) return;

        e.preventDefault();
        e.stopPropagation();
        isPointerDown = true;
        lastInputTime = performance.now();

        triggerTapFeedback(e.clientX, e.clientY);
        handleInput();
    });
}

// Direct handler on game canvas for reliable click detection
elements.gameCanvas.addEventListener('mousedown', (e) => {
    if (state.currentState !== GameState.PLAYING) return;
    if (state.isPaused) return;
    if (performance.now() - lastInputTime < 100) return;

    e.preventDefault();
    isPointerDown = true;
    lastInputTime = performance.now();

    triggerTapFeedback(e.clientX, e.clientY);
    handleInput();
});

// Mouse release for hold beats
document.addEventListener('mouseup', (e) => {
    if (!isPointerDown) return;
    isPointerDown = false;
    releaseTapFeedback();

    if (state.currentState === GameState.PLAYING && !state.isPaused) {
        handleInputRelease();
    }
});

// Mouse leave - treat as release if holding
document.addEventListener('mouseleave', (e) => {
    if (isPointerDown) {
        isPointerDown = false;
        releaseTapFeedback();
        if (state.currentState === GameState.PLAYING && !state.isPaused) {
            handleInputRelease();
        }
    }
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

// Settings toggle
elements.settingsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    elements.settingsPanel.classList.toggle('hidden');
});

// Close settings panel when clicking outside
document.addEventListener('click', (e) => {
    if (!elements.settingsPanel.classList.contains('hidden') &&
        !elements.settingsPanel.contains(e.target) &&
        !elements.settingsBtn.contains(e.target)) {
        elements.settingsPanel.classList.add('hidden');
    }
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

// Metronome toggle
elements.metronomeToggle?.addEventListener('change', (e) => {
    state.settings.metronomeEnabled = e.target.checked;
    saveSettings(state.settings);
});

// Trash talk toggle
document.getElementById('trash-talk-toggle')?.addEventListener('change', (e) => {
    state.settings.trashTalkEnabled = e.target.checked;
    saveSettings(state.settings);
    // Hide any visible trash talk if disabled
    if (!e.target.checked) {
        hideTrashTalk();
    }
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
// Modifier Buttons
// ============================================

function updateModifierBonus() {
    const activeCount = Object.values(state.activeModifiers).filter(v => v).length;
    let bonus;
    switch (activeCount) {
        case 0: bonus = MODIFIER_BONUSES.none; break;
        case 1: bonus = MODIFIER_BONUSES.one; break;
        case 2: bonus = MODIFIER_BONUSES.two; break;
        default: bonus = MODIFIER_BONUSES.three;
    }
    state.modifierScoreMultiplier = bonus;

    // Update UI
    const bonusEl = elements.modifierBonus;
    if (bonusEl) {
        if (activeCount > 0) {
            bonusEl.textContent = `Score Bonus: ${Math.round((bonus - 1) * 100)}%`;
            bonusEl.classList.add('active');
        } else {
            bonusEl.textContent = '';
            bonusEl.classList.remove('active');
        }
    }
}

document.querySelectorAll('.modifier-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const mod = btn.dataset.modifier;
        if (mod && state.activeModifiers.hasOwnProperty(mod)) {
            state.activeModifiers[mod] = !state.activeModifiers[mod];
            btn.classList.toggle('active', state.activeModifiers[mod]);
            updateModifierBonus();
        }
    });
});

// ============================================
// Power-up Activation (SHIFT key)
// ============================================

document.addEventListener('keydown', (e) => {
    if (e.code === POWERUP_KEY && state.currentState === GameState.PLAYING && !state.isPaused) {
        activateNextPowerup();
    }
});

function activateNextPowerup() {
    const { powerups } = state;

    // Priority: Shield > Slow Motion > Score Burst
    if (powerups.shield.charged && !powerups.shield.active) {
        powerups.shield.charged = false;
        powerups.shield.active = true;
        updatePowerupUI('shield', 'active');
        showPowerupActivation('shield');
        return;
    }

    if (powerups.slowMotion.charged && !powerups.slowMotion.active) {
        powerups.slowMotion.charged = false;
        powerups.slowMotion.active = true;
        powerups.slowMotion.endTime = performance.now() + POWERUPS.slowMotion.duration;
        updatePowerupUI('slowMotion', 'active');
        showPowerupActivation('slowMotion');
        return;
    }

    if (powerups.scoreBurst.charged && !powerups.scoreBurst.active) {
        powerups.scoreBurst.charged = false;
        powerups.scoreBurst.active = true;
        powerups.scoreBurst.endTime = performance.now() + POWERUPS.scoreBurst.duration;
        state.activePowerupMultiplier = POWERUPS.scoreBurst.multiplier;
        updatePowerupUI('scoreBurst', 'active');
        showPowerupActivation('scoreBurst');
        return;
    }
}

function updatePowerupUI(powerupId, status) {
    const slot = document.getElementById(`powerup-${powerupId}`);
    if (!slot) return;

    slot.classList.remove('charged', 'active', 'empty');
    if (status === 'charged') {
        slot.classList.add('charged');
    } else if (status === 'active') {
        slot.classList.add('active');
    } else {
        slot.classList.add('empty');
    }

    // Update charge bar
    const chargeBar = slot.querySelector('.powerup-charge');
    if (chargeBar) {
        const config = POWERUPS[powerupId];
        if (config && status === 'empty') {
            const progress = Math.min(1, state.powerupChargeProgress / config.chargeCombo);
            chargeBar.style.width = `${progress * 100}%`;
        } else if (status === 'charged') {
            chargeBar.style.width = '100%';
        } else {
            chargeBar.style.width = '0%';
        }
    }
}

function showPowerupActivation(powerupId) {
    const config = POWERUPS[powerupId];
    if (!config) return;

    // Flash effect on crowd canvas
    if (state.crowdBgCanvas) {
        state.crowdBgCanvas.classList.add('powerup-flash');
        setTimeout(() => state.crowdBgCanvas.classList.remove('powerup-flash'), 300);
    }

    // Show activation text in feedback
    state.feedbackText = config.name.toUpperCase() + '!';
    state.feedbackAlpha = 1;
    state.feedbackSpawnTime = performance.now();
    state.feedbackColor = config.color;
}

// ============================================
// Active Modifiers Display (during gameplay)
// ============================================

function showActiveModifiers() {
    const container = elements.activeModifiers;
    if (!container) return;

    // Clear existing badges
    container.innerHTML = '';

    const activeCount = Object.entries(state.activeModifiers)
        .filter(([, active]) => active).length;

    if (activeCount === 0) {
        container.classList.add('hidden');
        return;
    }

    container.classList.remove('hidden');

    for (const [modId, active] of Object.entries(state.activeModifiers)) {
        if (!active) continue;
        const config = MODIFIERS[modId];
        if (!config) continue;

        const badge = document.createElement('span');
        badge.className = 'modifier-badge';
        badge.innerHTML = `<span class="modifier-badge-icon">${config.icon}</span>${config.name}`;
        container.appendChild(badge);
    }
}

function resetModifiers() {
    state.activeModifiers = {
        doubleTime: false,
        hidden: false,
        mirror: false
    };
    state.modifierScoreMultiplier = 1.0;

    // Reset UI buttons
    document.querySelectorAll('.modifier-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Clear bonus display
    if (elements.modifierBonus) {
        elements.modifierBonus.textContent = '';
        elements.modifierBonus.classList.remove('active');
    }
}

// ============================================
// AI Mood UI
// ============================================

function updateAIMoodUI() {
    if (!state.aiPersonality) {
        elements.aiMoodIndicator?.classList.add('hidden');
        return;
    }

    elements.aiMoodIndicator?.classList.remove('hidden');

    if (elements.aiMoodIcon) {
        elements.aiMoodIcon.textContent = state.aiPersonality.icon;
    }
    if (elements.aiMoodText) {
        let moodText = state.aiPersonality.name;
        if (state.aiMood === 'confident') {
            moodText += ' 🔥';
        } else if (state.aiMood === 'struggling') {
            moodText += ' 😰';
        }
        elements.aiMoodText.textContent = moodText;
    }
}

// ============================================
// Power-up Expiration Check (called in game loop)
// ============================================

function checkPowerupExpiration() {
    const now = performance.now();
    const { powerups } = state;

    // Check Score Burst expiration
    if (powerups.scoreBurst.active && now >= powerups.scoreBurst.endTime) {
        powerups.scoreBurst.active = false;
        state.activePowerupMultiplier = 1.0;
        updatePowerupUI('scoreBurst', 'empty');
    }

    // Check Slow Motion expiration
    if (powerups.slowMotion.active && now >= powerups.slowMotion.endTime) {
        powerups.slowMotion.active = false;
        updatePowerupUI('slowMotion', 'empty');
    }
}

// Export for input.js to use
export { updatePowerupUI, updateAIMoodUI };

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

// Initialize persistent crowd background canvas
initCrowdBg();

// Initialize leaderboard system
setScoreSubmitHandler(handleScoreSubmission);
initLeaderboard().then(() => {
    setupLeaderboardUI();
});

// Wire up input.js callbacks to avoid circular imports
setMainCallbacks(updatePowerupUI, updateAIMoodUI, recordInput);

// ============================================
// Replay System Event Handlers
// ============================================

let replaySpeed = 1;
let replayPaused = false;
let replayLoopId = null;

// Share Replay button (on results screen)
elements.shareReplayBtn?.addEventListener('click', () => {
    const replayData = getReplayData();
    if (!replayData) {
        alert('No replay data available');
        return;
    }

    const code = encodeReplay(replayData);
    if (!code) {
        alert('Failed to encode replay');
        return;
    }

    // Show share modal
    elements.replayModalTitle.textContent = 'Share Replay';
    elements.replayModalDesc.textContent = 'Copy this code to share your replay:';
    elements.replayCodeInput.value = code;
    elements.replayCodeInput.readOnly = true;
    elements.replayCopyBtn.classList.remove('hidden');
    elements.replayImportBtn.classList.add('hidden');
    elements.replayCodeError.classList.add('hidden');
    elements.replayModal.classList.remove('hidden');
});

// Watch Replay button (on results screen)
elements.watchReplayBtn?.addEventListener('click', () => {
    const replayData = getReplayData();
    if (!replayData) {
        alert('No replay data available');
        return;
    }

    startReplayPlayback(replayData);
});

// Import Replay button (on title screen)
elements.importReplayBtn?.addEventListener('click', () => {
    // Show import modal
    elements.replayModalTitle.textContent = 'Import Replay';
    elements.replayModalDesc.textContent = 'Paste a replay code to watch:';
    elements.replayCodeInput.value = '';
    elements.replayCodeInput.readOnly = false;
    elements.replayCopyBtn.classList.add('hidden');
    elements.replayImportBtn.classList.remove('hidden');
    elements.replayCodeError.classList.add('hidden');
    elements.replayModal.classList.remove('hidden');
});

// Copy button in modal
elements.replayCopyBtn?.addEventListener('click', () => {
    elements.replayCodeInput.select();
    navigator.clipboard.writeText(elements.replayCodeInput.value).then(() => {
        elements.replayCopyBtn.textContent = 'Copied!';
        setTimeout(() => {
            elements.replayCopyBtn.textContent = 'Copy Code';
        }, 2000);
    }).catch(() => {
        // Fallback for older browsers
        document.execCommand('copy');
        elements.replayCopyBtn.textContent = 'Copied!';
        setTimeout(() => {
            elements.replayCopyBtn.textContent = 'Copy Code';
        }, 2000);
    });
});

// Import button in modal
elements.replayImportBtn?.addEventListener('click', () => {
    const code = elements.replayCodeInput.value.trim();

    if (!code) {
        elements.replayCodeError.textContent = 'Please enter a replay code';
        elements.replayCodeError.classList.remove('hidden');
        return;
    }

    if (!validateReplayCode(code)) {
        elements.replayCodeError.textContent = 'Invalid replay code';
        elements.replayCodeError.classList.remove('hidden');
        return;
    }

    const replayData = decodeReplay(code);
    if (!replayData) {
        elements.replayCodeError.textContent = 'Failed to decode replay';
        elements.replayCodeError.classList.remove('hidden');
        return;
    }

    // Find club and chant
    const club = Object.values(clubs).find(c => c.id === replayData.clubId);
    if (!club) {
        elements.replayCodeError.textContent = 'Unknown club in replay';
        elements.replayCodeError.classList.remove('hidden');
        return;
    }

    const chant = club.chants.find(c => c.id === replayData.chantId);
    if (!chant) {
        elements.replayCodeError.textContent = 'Unknown chant in replay';
        elements.replayCodeError.classList.remove('hidden');
        return;
    }

    replayData.chantName = chant.name;

    // Close modal and start playback
    elements.replayModal.classList.add('hidden');

    // Set up state for replay
    state.selectedClub = club;
    state.selectedChant = chant;
    state.settings.difficulty = replayData.difficulty;
    state.activeModifiers = { ...replayData.modifiers };

    applyClubTheme(club);
    updateCrowdClub();

    startReplayPlayback(replayData);
});

// Close modal button
elements.replayCloseBtn?.addEventListener('click', () => {
    elements.replayModal.classList.add('hidden');
});

// Replay screen controls
elements.replayPlayPauseBtn?.addEventListener('click', () => {
    replayPaused = !replayPaused;
    elements.replayPlayPauseBtn.textContent = replayPaused ? 'Play' : 'Pause';

    if (replayPaused && state.audioContext) {
        state.audioContext.suspend();
    } else if (!replayPaused && state.audioContext) {
        state.audioContext.resume();
    }
});

elements.replaySpeedBtn?.addEventListener('click', () => {
    // Cycle through speeds: 1x -> 1.5x -> 2x -> 0.5x -> 1x
    const speeds = [1, 1.5, 2, 0.5];
    const currentIndex = speeds.indexOf(replaySpeed);
    replaySpeed = speeds[(currentIndex + 1) % speeds.length];
    elements.replaySpeedBtn.textContent = `${replaySpeed}x`;

    // Adjust audio playback rate
    if (state.audioSource) {
        state.audioSource.playbackRate.value = replaySpeed;
    }
});

elements.replayRestartBtn?.addEventListener('click', () => {
    const replayData = getReplayData();
    if (replayData) {
        stopReplayPlayback();
        startReplayPlayback(replayData);
    }
});

elements.replayBackBtn?.addEventListener('click', () => {
    stopReplayPlayback();
    showScreen('results');
});

// ============================================
// Replay Playback Functions
// ============================================

async function startReplayPlayback(replayData) {
    // Reset game state for fresh replay
    resetGameState();
    preparePlayback(replayData);

    // Reset playback state
    replaySpeed = 1;
    replayPaused = false;
    elements.replaySpeedBtn.textContent = '1x';
    elements.replayPlayPauseBtn.textContent = 'Pause';

    // Update UI
    elements.replayChantName.textContent = replayData.chantName || 'Unknown Chant';

    // Show modifiers
    elements.replayModifiers.innerHTML = '';
    for (const [modId, active] of Object.entries(replayData.modifiers)) {
        if (!active) continue;
        const config = MODIFIERS[modId];
        if (!config) continue;
        const badge = document.createElement('span');
        badge.className = 'modifier-badge';
        badge.textContent = `${config.icon} ${config.name}`;
        elements.replayModifiers.appendChild(badge);
    }

    // Initialize canvas
    const canvas = elements.replayCanvas;
    if (canvas) {
        const ctx = canvas.getContext('2d');
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    showScreen('replay');
    setCrowdMode('gameplay');

    // Load audio
    elements.loadingOverlay.classList.remove('hidden');

    try {
        await initAudio();
        await loadAudio(state.selectedChant.audio);

        // Analyze beats with auto-generated holds
        const rawBeats = await analyzeBeatsAsync(state.audioBuffer);
        state.detectedBeats = autoGenerateHoldBeats(rawBeats);
        replayData.beats = state.detectedBeats;

        elements.loadingOverlay.classList.add('hidden');

        // Update duration display
        const duration = state.audioBuffer.duration * 1000;
        replayData.duration = duration;
        elements.replayDuration.textContent = formatReplayDuration(duration);
        elements.replayTime.textContent = '0:00';
        elements.replayProgressFill.style.width = '0%';

        // Reset stats display
        elements.replayScore.textContent = '0';
        elements.replayCombo.textContent = '0';

        // Start playback
        playAudio(() => {
            // Replay finished
            stopReplayPlayback();
            showScreen('results');
        });

        state.audioStartTime = state.audioContext.currentTime;
        state.gameStartTime = performance.now();

        replayLoop();
    } catch (error) {
        console.error('Failed to start replay:', error);
        elements.loadingOverlay.classList.add('hidden');
        alert('Failed to load replay audio');
        showScreen('title');
    }
}

function replayLoop() {
    if (!state.isReplaying) return;

    if (!replayPaused) {
        const now = performance.now();
        const audioElapsed = state.audioContext ? (state.audioContext.currentTime - state.audioStartTime) * 1000 : 0;
        const replayData = getReplayData();

        // Update progress
        if (replayData && replayData.duration > 0) {
            const progress = Math.min(1, audioElapsed / replayData.duration);
            elements.replayProgressFill.style.width = `${progress * 100}%`;
            elements.replayTime.textContent = formatReplayDuration(audioElapsed);
        }

        // Process inputs from replay
        let input;
        while ((input = getNextReplayInput(audioElapsed)) !== null) {
            // Simulate the hit
            processReplayInput(input);
        }

        // Draw visualization
        drawReplayVisualization(audioElapsed);
    }

    replayLoopId = requestAnimationFrame(replayLoop);
}

function processReplayInput(input) {
    // Update stats based on replay input
    const result = input.result;

    if (result === 'perfect') {
        state.playerStats.perfect++;
        state.playerCombo++;
    } else if (result === 'good') {
        state.playerStats.good++;
        state.playerCombo++;
    } else if (result === 'ok') {
        state.playerStats.ok++;
        state.playerCombo++;
    } else {
        state.playerStats.miss++;
        state.playerCombo = 0;
    }

    state.playerScore += input.score;
    if (state.playerCombo > state.playerMaxCombo) {
        state.playerMaxCombo = state.playerCombo;
    }

    // Update UI
    elements.replayScore.textContent = state.playerScore;
    elements.replayCombo.textContent = state.playerCombo;

    // Mark beat result for visualization
    if (input.beatIndex >= 0) {
        state.beatResults[input.beatIndex] = result;
    }
}

function drawReplayVisualization(currentTime) {
    const canvas = elements.replayCanvas;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const midY = h / 2;

    // Clear
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, w, h);

    const beats = state.detectedBeats;
    if (!beats || beats.length === 0) return;

    const duration = getReplayData()?.duration || (state.audioBuffer?.duration * 1000) || 1;
    const currentTimeSec = currentTime / 1000;

    // Draw beat markers
    const primary = state.selectedClub?.colors?.primary || '#006633';

    for (let i = 0; i < beats.length; i++) {
        const beat = beats[i];
        const beatTime = typeof beat === 'object' ? beat.time : beat;
        const x = (beatTime / (duration / 1000)) * w;

        // Determine color based on result
        let color = '#444444';  // Default: unplayed
        const result = state.beatResults[i];
        if (result === 'perfect') color = '#00ff88';
        else if (result === 'good') color = '#88ff00';
        else if (result === 'ok') color = '#ffaa00';
        else if (result === 'miss') color = '#ff4444';
        else if (beatTime < currentTimeSec) color = '#666666';  // Passed but not recorded

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, midY, 5, 0, Math.PI * 2);
        ctx.fill();
    }

    // Draw playhead
    const playheadX = (currentTimeSec / (duration / 1000)) * w;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, h);
    ctx.stroke();
}

function stopReplayPlayback() {
    stopPlayback();
    stopAudio();
    if (replayLoopId) {
        cancelAnimationFrame(replayLoopId);
        replayLoopId = null;
    }
    setCrowdMode('idle');
}

// ============================================
// Profile Screen Event Handlers
// ============================================

elements.profileBtn?.addEventListener('click', () => {
    renderProfileScreen();
    showScreen('profile');
});

elements.profileBackBtn?.addEventListener('click', () => {
    showScreen('title');
});

// Profile tab navigation
elements.profileTabStats?.addEventListener('click', () => switchProfileTab('stats'));
elements.profileTabAnalytics?.addEventListener('click', () => switchProfileTab('analytics'));

// ============================================
// Custom Chant Upload System
// ============================================

let pendingUploadData = null;

// Render custom chants in the chant list
async function renderCustomChants() {
    if (!elements.customChantList) return;

    const chants = await getAllCustomChants();
    elements.customChantList.innerHTML = '';

    if (chants.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty-custom-chants';
        empty.textContent = 'No custom chants yet. Upload your own MP3!';
        elements.customChantList.appendChild(empty);
        return;
    }

    chants.forEach(chant => {
        const item = document.createElement('div');
        item.className = 'custom-chant-item';

        // Music icon
        const icon = document.createElement('div');
        icon.className = 'custom-chant-icon';
        icon.textContent = '♪';

        // Info section
        const info = document.createElement('div');
        info.className = 'custom-chant-info';

        const name = document.createElement('span');
        name.className = 'custom-chant-name';
        name.textContent = chant.name;

        const meta = document.createElement('span');
        meta.className = 'custom-chant-meta';
        const mins = Math.floor(chant.duration / 60);
        const secs = Math.floor(chant.duration % 60);
        meta.textContent = `${mins}:${secs.toString().padStart(2, '0')} • ${(chant.fileSize / 1024 / 1024).toFixed(1)}MB`;

        info.appendChild(name);
        info.appendChild(meta);

        // Play button
        const playBtn = document.createElement('div');
        playBtn.className = 'custom-chant-play';
        playBtn.textContent = '▶';

        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'custom-chant-delete';
        deleteBtn.textContent = '×';
        deleteBtn.title = 'Delete chant';
        deleteBtn.onclick = async (e) => {
            e.stopPropagation();
            if (confirm(`Delete "${chant.name}"?`)) {
                await deleteCustomChant(chant.id);
                renderCustomChants();
            }
        };

        item.appendChild(icon);
        item.appendChild(info);
        item.appendChild(playBtn);
        item.appendChild(deleteBtn);

        item.onclick = () => playCustomChant(chant);

        elements.customChantList.appendChild(item);
    });
}

// Play a custom chant
async function playCustomChant(chant) {
    state.selectedChant = {
        id: chant.id,
        name: chant.name,
        audio: null, // Will be loaded from IndexedDB
        isCustom: true
    };
    await startCustomChantGame(chant.id);
}

// Start game with custom chant
async function startCustomChantGame(chantId) {
    showScreen('gameplay');
    setCrowdMode('gameplay');
    updateScoreboardTeams();

    // Hide match info in practice mode
    elements.matchInfo.classList.add('hidden');
    elements.aiMoodIndicator?.classList.add('hidden');
    showActiveModifiers();

    resetGameState();

    const diffPreset = DIFFICULTY_PRESETS[state.settings.difficulty] || DIFFICULTY_PRESETS.normal;
    state.activeTiming = { PERFECT: diffPreset.PERFECT, GOOD: diffPreset.GOOD, OK: diffPreset.OK };

    elements.playerScore.textContent = '0';
    elements.aiScore.textContent = '0';
    elements.currentChantName.textContent = state.selectedChant.name;

    elements.gameCanvas.classList.remove('beat-pulse', 'hit-perfect', 'hit-good', 'hit-ok', 'hit-miss');
    elements.loadingOverlay.classList.remove('hidden');

    try {
        await initAudio();
        initVisualizer();

        // Load audio from IndexedDB
        state.audioBuffer = await decodeCustomChantAudio(chantId, state.audioContext);

        await new Promise(resolve => setTimeout(resolve, 50));

        // Auto-generate hold beats from closely-spaced detected beats
        const rawBeats = await analyzeBeatsAsync(state.audioBuffer);
        state.detectedBeats = autoGenerateHoldBeats(rawBeats);
        const holdCount = state.detectedBeats.filter(b => b.type === 'hold').length;
        console.log(`Custom chant: ${rawBeats.length} beats, ${holdCount} hold beats`);
        computeWaveformPeaks();
        buildWaveformCache();

        elements.loadingOverlay.classList.add('hidden');

        if (!hasTutorialSeen()) {
            await showTutorial();
        }

        await countdown();

        if (!state.isReplaying) {
            startRecording();
        }

        playAudio(endGame);
        state.audioStartTime = state.audioContext.currentTime;
        state.gameStartTime = performance.now();

        gameLoop();
    } catch (error) {
        console.error('Failed to start custom chant:', error);
        elements.loadingOverlay.classList.add('hidden');
        alert('Failed to load custom chant. ' + error.message);
        quitToMenu();
    }
}

// Upload chant button click
elements.uploadChantBtn?.addEventListener('click', () => {
    // Show copyright modal first
    elements.copyrightModal?.classList.remove('hidden');
    if (elements.copyrightAcknowledge) {
        elements.copyrightAcknowledge.checked = false;
    }
    if (elements.copyrightAcceptBtn) {
        elements.copyrightAcceptBtn.disabled = true;
    }
});

// Copyright acknowledgment checkbox
elements.copyrightAcknowledge?.addEventListener('change', (e) => {
    if (elements.copyrightAcceptBtn) {
        elements.copyrightAcceptBtn.disabled = !e.target.checked;
    }
});

// Copyright cancel button
elements.copyrightCancelBtn?.addEventListener('click', () => {
    elements.copyrightModal?.classList.add('hidden');
});

// Copyright accept button
elements.copyrightAcceptBtn?.addEventListener('click', () => {
    elements.copyrightModal?.classList.add('hidden');
    // Trigger file input
    elements.chantFileInput?.click();
});

// File input change
elements.chantFileInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset file input for future uploads
    e.target.value = '';

    // Show upload modal
    elements.uploadModal?.classList.remove('hidden');
    elements.uploadStatus?.classList.remove('hidden');
    elements.uploadForm?.classList.add('hidden');
    elements.uploadError?.classList.add('hidden');
    elements.uploadSaveBtn?.classList.add('hidden');
    elements.uploadStatusText.textContent = 'Reading file...';
    elements.uploadProgressFill.style.width = '30%';

    try {
        // Ensure audio context exists
        if (!state.audioContext) {
            state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        elements.uploadStatusText.textContent = 'Decoding audio...';
        elements.uploadProgressFill.style.width = '60%';

        // Process the uploaded file
        const processedData = await processUploadedFile(file, state.audioContext);

        elements.uploadStatusText.textContent = 'Analyzing beats...';
        elements.uploadProgressFill.style.width = '90%';

        // Store pending upload data
        pendingUploadData = {
            ...processedData,
            clubId: state.selectedClub?.id || 'custom',
            copyrightAcknowledged: true
        };

        // Show form for naming
        elements.uploadProgressFill.style.width = '100%';
        setTimeout(() => {
            elements.uploadStatus?.classList.add('hidden');
            elements.uploadForm?.classList.remove('hidden');
            elements.uploadSaveBtn?.classList.remove('hidden');

            // Pre-fill name
            if (elements.uploadChantName) {
                elements.uploadChantName.value = processedData.name;
            }

            // Show duration and size
            const mins = Math.floor(processedData.duration / 60);
            const secs = Math.floor(processedData.duration % 60);
            if (elements.uploadDuration) {
                elements.uploadDuration.textContent = `Duration: ${mins}:${secs.toString().padStart(2, '0')}`;
            }
            if (elements.uploadSize) {
                elements.uploadSize.textContent = `Size: ${(processedData.fileSize / 1024 / 1024).toFixed(1)}MB`;
            }
        }, 300);

    } catch (error) {
        console.error('Upload error:', error);
        elements.uploadError.textContent = error.message || 'Failed to process file';
        elements.uploadError?.classList.remove('hidden');
        elements.uploadStatus?.classList.add('hidden');
    }
});

// Upload cancel button
elements.uploadCancelBtn?.addEventListener('click', () => {
    elements.uploadModal?.classList.add('hidden');
    pendingUploadData = null;
});

// Upload save button
elements.uploadSaveBtn?.addEventListener('click', async () => {
    if (!pendingUploadData) return;

    const name = elements.uploadChantName?.value?.trim();
    if (!name) {
        elements.uploadError.textContent = 'Please enter a name for the chant';
        elements.uploadError?.classList.remove('hidden');
        return;
    }

    pendingUploadData.name = name;

    try {
        await saveCustomChant(pendingUploadData);
        elements.uploadModal?.classList.add('hidden');
        pendingUploadData = null;
        renderCustomChants();
    } catch (error) {
        console.error('Save error:', error);
        elements.uploadError.textContent = 'Failed to save chant: ' + error.message;
        elements.uploadError?.classList.remove('hidden');
    }
});

// ============================================
// Initialize Progression System
// ============================================

// Load progression data on startup
loadProgression();

// Expose debug toggle for browser console
// Usage: toggleChoreoDebug() or toggleChoreoDebug(true/false)
window.toggleChoreoDebug = toggleChoreoDebug;

// Update title screen level badge
updateTitleLevelBadge();

// Initialize analytics session tracking
initAnalyticsSession();

// Initialize custom chant database
initCustomChantDB().catch(err => {
    console.warn('Failed to initialize custom chants DB:', err);
});

// Apply audio settings from storage
if (elements.metronomeToggle) {
    elements.metronomeToggle.checked = state.settings.metronomeEnabled;
}

// Apply trash talk setting
const trashTalkToggle = document.getElementById('trash-talk-toggle');
if (trashTalkToggle) {
    trashTalkToggle.checked = state.settings.trashTalkEnabled !== false;
}

// ============================================
// Input Calibration Event Handlers
// ============================================

// Calibrate button click
document.getElementById('calibrate-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    startCalibration();
});

// Calibration cancel button
document.getElementById('calibration-cancel')?.addEventListener('click', () => {
    cancelCalibration();
});

// Display current offset on load
const currentOffsetDisplay = document.getElementById('current-offset');
if (currentOffsetDisplay && state.settings.inputOffset !== undefined) {
    const offset = state.settings.inputOffset;
    const sign = offset >= 0 ? '+' : '';
    currentOffsetDisplay.textContent = `${sign}${offset}ms`;
}

// Initialize on load
showScreen('title');
