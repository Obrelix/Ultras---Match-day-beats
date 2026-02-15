// ============================================
// input.js — Input handling, scoring, AI
// ============================================

import { GameState, SCORE, BEAT_RESULT_COLORS, AI_ACCURACY, AI_RUBBER_BAND } from './config.js';
import { state } from './state.js';
import { elements } from './ui.js';
import { playSFX } from './audio.js';

const INPUT_COOLDOWN_MS = 80;
let lastInputTime = 0;

// Confetti colors (club primary + celebratory colors)
const CONFETTI_COLORS = ['#ffcc00', '#ff6600', '#00ff88', '#ff4488', '#44aaff', '#ffffff'];

// Spawn confetti particles on combo milestones (#6)
function spawnConfetti(beatTime, count, now) {
    const primary = state.selectedClub?.colors?.primary || '#ffcc00';
    const colors = [primary, ...CONFETTI_COLORS];

    for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
        const speed = 2.5 + Math.random() * 2;
        state.hitParticles.push({
            beatTime: beatTime,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 2,  // Bias upward
            color: colors[Math.floor(Math.random() * colors.length)],
            spawnTime: now,
            isConfetti: true  // Flag for potential special rendering
        });
    }

    // Trigger CSS milestone effect on crowd canvas
    if (state.crowdBgCanvas) {
        state.crowdBgCanvas.classList.add('milestone');
        setTimeout(() => state.crowdBgCanvas.classList.remove('milestone'), 400);
    }
}

export function handleInput() {
    if (state.currentState !== GameState.PLAYING) return;
    if (state.isPaused) return;

    const now = performance.now();

    // Prevent duplicate hits from touch + click firing on the same tap
    if (now - lastInputTime < INPUT_COOLDOWN_MS) return;
    lastInputTime = now;

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
    if (!bestBeat || bestDiff > state.activeTiming.OK) {
        showFeedback('MISS');
        playSFX('MISS');
        if (navigator.vibrate) navigator.vibrate([40]);
        state.playerStats.miss++;
        state.playerCombo = 0;
        updateComboDisplay();
        return;
    }

    // Rate the hit
    let rating, score;

    if (bestDiff <= state.activeTiming.PERFECT) {
        rating = 'PERFECT';
        score = SCORE.PERFECT;
        state.playerStats.perfect++;
        state.playerCombo++;

        // Screen shake on perfect streaks (#1)
        if (!state.settings.reducedEffects && state.crowdBgCanvas) {
            const combo = state.playerCombo;
            if (combo >= 10) {
                const shakeClass = combo >= 30 ? 'shake-intense' : 'shake';
                state.crowdBgCanvas.classList.remove('shake', 'shake-intense');
                void state.crowdBgCanvas.offsetWidth;  // Force reflow for re-animation
                state.crowdBgCanvas.classList.add(shakeClass);
            }
        }
    } else if (bestDiff <= state.activeTiming.GOOD) {
        rating = 'GOOD';
        score = SCORE.GOOD;
        state.playerStats.good++;
        state.playerCombo++;
    } else {
        // bestDiff <= activeTiming.OK guaranteed (early return above for > OK)
        rating = 'OK';
        score = SCORE.OK;
        state.playerStats.ok++;
        state.playerCombo++;
    }

    // Record result for visualizer beat coloring
    if (bestBeat.index !== undefined) {
        state.beatResults[bestBeat.index] = rating.toLowerCase();
    }

    // Haptic feedback
    if (navigator.vibrate) {
        switch (rating) {
            case 'PERFECT': navigator.vibrate([15, 5, 15]); break;
            case 'GOOD': navigator.vibrate([10]); break;
            case 'OK': navigator.vibrate([5]); break;
            case 'MISS': navigator.vibrate([40]); break;
        }
    }

    // Audio SFX
    playSFX(rating);

    // If this was an early hit on an upcoming beat, advance past it
    if (bestBeat.isEarly && rating !== 'MISS') {
        if (state.activeBeat) {
            // Silently mark the skipped active beat as missed (no SFX/feedback — player already got hit feedback)
            if (state.activeBeat.index !== undefined) {
                state.beatResults[state.activeBeat.index] = 'miss';
            }
            state.playerStats.miss++;
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

        // Confetti burst on combo milestones (#6)
        const combo = state.playerCombo;
        if (combo === 50 || combo === 100 || combo % 100 === 0) {
            spawnConfetti(beatTime, combo >= 100 ? 30 : 20, now);
        } else if (combo === 25 || combo === 75) {
            spawnConfetti(beatTime, 12, now);
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
    playSFX('MISS');
    if (navigator.vibrate) navigator.vibrate([40]);
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
    let accuracy = AI_ACCURACY;

    // Rubber banding in matchday mode
    if (state.gameMode === 'matchday') {
        const diff = state.playerScore - state.aiScore;
        if (diff < -AI_RUBBER_BAND.SCORE_DIFF_THRESHOLD) {
            accuracy -= AI_RUBBER_BAND.LOSING_REDUCTION;
        } else if (diff > AI_RUBBER_BAND.SCORE_DIFF_THRESHOLD) {
            accuracy += AI_RUBBER_BAND.WINNING_INCREASE;
        }
        accuracy = Math.max(0.3, Math.min(0.95, accuracy));
    }

    // Miss roll
    const rand = Math.random();
    if (rand > accuracy) {
        elements.aiScore.textContent = state.aiScore;
        return;
    }

    // Quality roll (within scoring range)
    let scoreGained = 0;
    const scoringRoll = Math.random();
    if (scoringRoll < 0.40) {
        scoreGained = SCORE.PERFECT;
    } else if (scoringRoll < 0.70) {
        scoreGained = SCORE.GOOD;
    } else {
        scoreGained = SCORE.OK;
    }

    state.aiScore += scoreGained;
    elements.aiScore.textContent = state.aiScore;

    // AI score popup
    if (scoreGained > 0 && elements.aiScorePopupContainer) {
        const popup = document.createElement('div');
        popup.className = 'ai-score-popup';
        popup.textContent = `+${scoreGained}`;
        elements.aiScorePopupContainer.appendChild(popup);
        setTimeout(() => popup.remove(), 800);
    }
}
