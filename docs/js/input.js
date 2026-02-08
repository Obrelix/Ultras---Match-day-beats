// ============================================
// input.js — Input handling, scoring, AI
// ============================================

import { GameState, TIMING, SCORE, BEAT_RESULT_COLORS, AI_ACCURACY } from './config.js';
import { state } from './state.js';
import { elements } from './ui.js';

export function handleInput() {
    if (state.currentState !== GameState.PLAYING) return;

    const now = performance.now();

    let bestBeat = null;
    let bestDiff = Infinity;

    // Check active beat
    if (state.activeBeat) {
        const diff = Math.abs(now - state.activeBeat.time);
        if (diff < bestDiff) {
            bestDiff = diff;
            bestBeat = state.activeBeat;
        }
    }

    // Check next upcoming beat (early hit)
    if (state.nextBeatIndex < state.detectedBeats.length) {
        const upcomingWallTime = state.gameStartTime + state.detectedBeats[state.nextBeatIndex] * 1000;
        const diff = Math.abs(now - upcomingWallTime);
        if (diff < bestDiff) {
            bestDiff = diff;
            bestBeat = { time: upcomingWallTime, index: state.nextBeatIndex, isEarly: true };
        }
    }

    // No beat within reach
    if (!bestBeat || bestDiff > TIMING.OK) {
        showFeedback('MISS');
        state.playerStats.miss++;
        state.playerCombo = 0;
        updateComboDisplay();
        return;
    }

    // Rate the hit
    let rating, score;

    if (bestDiff <= TIMING.PERFECT) {
        rating = 'PERFECT';
        score = SCORE.PERFECT;
        state.playerStats.perfect++;
        state.playerCombo++;
    } else if (bestDiff <= TIMING.GOOD) {
        rating = 'GOOD';
        score = SCORE.GOOD;
        state.playerStats.good++;
        state.playerCombo++;
    } else if (bestDiff <= TIMING.OK) {
        rating = 'OK';
        score = SCORE.OK;
        state.playerStats.ok++;
        state.playerCombo++;
    } else {
        rating = 'MISS';
        score = SCORE.MISS;
        state.playerStats.miss++;
        state.playerCombo = 0;
    }

    // Record result for visualizer beat coloring
    if (bestBeat.index !== undefined) {
        state.beatResults[bestBeat.index] = rating.toLowerCase();
    }

    // If this was an early hit on an upcoming beat, advance past it
    if (bestBeat.isEarly && rating !== 'MISS') {
        if (state.activeBeat) {
            registerMiss();
        }
        state.nextBeatIndex = bestBeat.index + 1;
        state.activeBeat = null;

        // Trigger the same side-effects that triggerBeat() would have
        state.totalBeats++;
        state.crowdBeatTime = now;
        state.beatFlashIntensity = 1;
        elements.gameCanvas.classList.remove('beat-pulse');
        void elements.gameCanvas.offsetWidth;
        elements.gameCanvas.classList.add('beat-pulse');
        elements.gameVisualCanvas.classList.remove('visual-canvas-beat-pulse');
        void elements.gameVisualCanvas.offsetWidth;
        elements.gameVisualCanvas.classList.add('visual-canvas-beat-pulse');
        simulateAI();
    } else {
        state.activeBeat = null;
    }

    // Spawn beat hit visual effects (not for misses)
    if (rating !== 'MISS' && bestBeat.index !== undefined) {
        const beatTime = state.detectedBeats[bestBeat.index];
        const hitColor = BEAT_RESULT_COLORS[rating.toLowerCase()] || '#ffffff';
        state.beatHitEffects.push({
            beatTime: beatTime,
            color: hitColor,
            spawnTime: now
        });

        // PERFECT particles: 8 radiating particles
        if (rating === 'PERFECT') {
            for (let p = 0; p < 8; p++) {
                const angle = (p / 8) * Math.PI * 2;
                state.hitParticles.push({
                    beatTime: beatTime,
                    vx: Math.cos(angle) * (2 + Math.random()),
                    vy: Math.sin(angle) * (2 + Math.random()) - 1,
                    color: hitColor,
                    spawnTime: now
                });
            }
        }
    }

    // Apply combo multiplier
    const comboMultiplier = getComboMultiplier();
    state.playerScore += Math.floor(score * comboMultiplier);

    if (state.playerCombo > state.playerMaxCombo) {
        state.playerMaxCombo = state.playerCombo;
    }

    elements.playerScore.textContent = state.playerScore;
    showFeedback(rating);
    updateComboDisplay();
    showHitEffect(rating);
}

export function registerMiss() {
    if (state.activeBeat && state.activeBeat.index !== undefined) {
        state.beatResults[state.activeBeat.index] = 'miss';
    }
    state.playerStats.miss++;
    state.playerCombo = 0;
    showFeedback('MISS');
    updateComboDisplay();
}

export function getComboMultiplier() {
    if (state.playerCombo >= 20) return 3;
    if (state.playerCombo >= 15) return 2.5;
    if (state.playerCombo >= 10) return 2;
    if (state.playerCombo >= 5) return 1.5;
    return 1;
}

export function showFeedback(rating) {
    state.feedbackText = rating;
    state.feedbackAlpha = 1;
    state.feedbackSpawnTime = performance.now();
    state.feedbackColor = BEAT_RESULT_COLORS[rating.toLowerCase()] || '#ffffff';
}

export function updateComboDisplay() {
    if (state.playerCombo !== state.comboDisplayCount) {
        state.comboPrevCount = state.comboDisplayCount;
        state.comboBumpTime = performance.now();
    }
    state.comboDisplayCount = state.playerCombo;
}

export function showHitEffect(rating) {
    const hitClass = `hit-${rating.toLowerCase()}`;
    elements.gameCanvas.classList.remove('hit-perfect', 'hit-good', 'hit-ok', 'hit-miss');
    elements.gameCanvas.classList.add(hitClass);
    setTimeout(() => {
        elements.gameCanvas.classList.remove(hitClass);
    }, 100);
}

export function simulateAI() {
    const rand = Math.random();

    if (rand < AI_ACCURACY * 0.4) {
        state.aiScore += SCORE.PERFECT;
    } else if (rand < AI_ACCURACY * 0.7) {
        state.aiScore += SCORE.GOOD;
    } else if (rand < AI_ACCURACY) {
        state.aiScore += SCORE.OK;
    }

    elements.aiScore.textContent = state.aiScore;
}
