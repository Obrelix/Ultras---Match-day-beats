// ============================================
// input.js — Input handling, scoring, AI
// ============================================

import { GameState, SCORE, BEAT_RESULT_COLORS, AI_ACCURACY, AI_RUBBER_BAND, POWERUPS, AI_PERSONALITIES, CLUB_AI_PERSONALITIES } from './config.js';
import { state } from './state.js';
import { elements } from './ui.js';
import { playSFX } from './audio.js';
import { playCrowdCheer, playCrowdGroan } from './crowdAudio.js';

// Import functions from main.js for power-up UI updates and replay recording
// Note: We'll call these via callbacks to avoid circular imports
let _updatePowerupUI = null;
let _updateAIMoodUI = null;
let _recordInput = null;

export function setMainCallbacks(updatePowerupUI, updateAIMoodUI, recordInput) {
    _updatePowerupUI = updatePowerupUI;
    _updateAIMoodUI = updateAIMoodUI;
    _recordInput = recordInput;
}

const INPUT_COOLDOWN_MS = 80;
let lastInputTime = 0;

// Confetti colors (club primary + celebratory colors)
const CONFETTI_COLORS = ['#ffcc00', '#ff6600', '#00ff88', '#ff4488', '#44aaff', '#ffffff'];

// ============================================
// Performance: Object Pool for particles
// Reuses particle objects to reduce GC pressure
// ============================================

const _particlePool = [];
const MAX_POOL_SIZE = 100;

function getParticle() {
    return _particlePool.length > 0 ? _particlePool.pop() : {};
}

function releaseParticle(p) {
    if (_particlePool.length < MAX_POOL_SIZE) {
        // Clear old properties to prevent stale data from previous use
        p.beatTime = 0;
        p.vx = 0;
        p.vy = 0;
        p.color = '';
        p.spawnTime = 0;
        p.isConfetti = false;
        _particlePool.push(p);
    }
}

// Export for renderer.js to return particles
export { releaseParticle };

// Spawn confetti particles on combo milestones (#6)
function spawnConfetti(beatTime, count, now) {
    const primary = state.selectedClub?.colors?.primary || '#ffcc00';
    const colors = [primary, ...CONFETTI_COLORS];

    for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
        const speed = 2.5 + Math.random() * 2;
        // Use pooled particle object
        const p = getParticle();
        p.beatTime = beatTime;
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed - 2;  // Bias upward
        p.color = colors[Math.floor(Math.random() * colors.length)];
        p.spawnTime = now;
        p.isConfetti = true;  // Flag for potential special rendering
        state.hitParticles.push(p);
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
        playCrowdGroan();
        if (navigator.vibrate) navigator.vibrate([40]);
        state.playerStats.miss++;
        state.playerCombo = 0;
        state.powerupChargeProgress = 0;

        // Record miss for replay (no beat associated)
        if (_recordInput && state.isRecording) {
            const relativeTime = now - state.gameStartTime;
            _recordInput(relativeTime, -1, 'miss', 0);
        }

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

    // Crowd audio feedback
    if (rating === 'PERFECT') {
        playCrowdCheer(state.playerCombo >= 10 ? 'loud' : 'normal');
    } else if (rating === 'GOOD') {
        playCrowdCheer('soft');
    }

    // If this was an early hit on an upcoming beat, advance past it
    if (bestBeat.isEarly && rating !== 'MISS') {
        if (state.activeBeat) {
            // Silently mark the skipped active beat as missed (no SFX/feedback — player already got hit feedback)
            // NOTE: Don't increment miss stats here - the player successfully hit a beat, they just
            // hit the next one early. The skipped beat is marked for visualization only.
            if (state.activeBeat.index !== undefined) {
                state.beatResults[state.activeBeat.index] = 'miss';
            }
            // Don't count this as a miss in stats - player got a hit
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

        // PERFECT particles: 8 radiating particles (using object pool)
        if (rating === 'PERFECT') {
            for (let i = 0; i < 8; i++) {
                const angle = (i / 8) * Math.PI * 2;
                const particle = getParticle();
                particle.beatTime = beatTime;
                particle.vx = Math.cos(angle) * (2 + Math.random());
                particle.vy = Math.sin(angle) * (2 + Math.random()) - 1;
                particle.color = hitColor;
                particle.spawnTime = now;
                particle.isConfetti = false;
                state.hitParticles.push(particle);
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

    // Apply combo multiplier + modifier multiplier + powerup multiplier
    const comboMultiplier = getComboMultiplier();
    const modifierMultiplier = state.modifierScoreMultiplier || 1.0;
    const powerupMultiplier = state.activePowerupMultiplier || 1.0;
    const totalMultiplier = comboMultiplier * modifierMultiplier * powerupMultiplier;
    const scoreGained = Math.floor(score * totalMultiplier);
    state.playerScore += scoreGained;

    if (state.playerCombo > state.playerMaxCombo) {
        state.playerMaxCombo = state.playerCombo;
    }

    // Record input for replay
    if (_recordInput && state.isRecording) {
        const relativeTime = now - state.gameStartTime;
        _recordInput(relativeTime, bestBeat.index ?? -1, rating.toLowerCase(), scoreGained);
    }

    // Update power-up charge progress
    updatePowerupCharge();

    elements.playerScore.textContent = state.playerScore;
    showFeedback(rating);
    updateComboDisplay();
    showHitEffect(rating);
}

// ============================================
// Power-up Charging Logic
// ============================================

function updatePowerupCharge() {
    const combo = state.playerCombo;
    const { powerups } = state;

    // Track cumulative combo for charging
    state.powerupChargeProgress = combo;

    // Check if we should charge each power-up (in order of charge requirement)
    if (!powerups.shield.charged && !powerups.shield.active && combo >= POWERUPS.shield.chargeCombo) {
        powerups.shield.charged = true;
        if (_updatePowerupUI) _updatePowerupUI('shield', 'charged');
        showPowerupReady('shield');
    }

    if (!powerups.slowMotion.charged && !powerups.slowMotion.active && combo >= POWERUPS.slowMotion.chargeCombo) {
        powerups.slowMotion.charged = true;
        if (_updatePowerupUI) _updatePowerupUI('slowMotion', 'charged');
        showPowerupReady('slowMotion');
    }

    if (!powerups.scoreBurst.charged && !powerups.scoreBurst.active && combo >= POWERUPS.scoreBurst.chargeCombo) {
        powerups.scoreBurst.charged = true;
        if (_updatePowerupUI) _updatePowerupUI('scoreBurst', 'charged');
        showPowerupReady('scoreBurst');
    }

    // Update charge bar for uncharged power-ups
    if (!powerups.shield.charged && !powerups.shield.active && _updatePowerupUI) {
        _updatePowerupUI('shield', 'empty');
    }
    if (!powerups.slowMotion.charged && !powerups.slowMotion.active && _updatePowerupUI) {
        _updatePowerupUI('slowMotion', 'empty');
    }
    if (!powerups.scoreBurst.charged && !powerups.scoreBurst.active && _updatePowerupUI) {
        _updatePowerupUI('scoreBurst', 'empty');
    }
}

function showPowerupReady(powerupId) {
    const slot = document.getElementById(`powerup-${powerupId}`);
    if (slot) {
        slot.classList.add('pulse');
        setTimeout(() => slot.classList.remove('pulse'), 600);
    }
}

export function registerMiss() {
    // Check if Shield is active - absorb the miss
    if (state.powerups.shield.active) {
        state.powerups.shield.active = false;
        if (_updatePowerupUI) _updatePowerupUI('shield', 'empty');

        // Visual feedback for shield absorption
        state.feedbackText = 'SHIELDED!';
        state.feedbackAlpha = 1;
        state.feedbackSpawnTime = performance.now();
        state.feedbackColor = POWERUPS.shield.color;

        // Mark beat as OK instead of miss (shield saved it)
        if (state.activeBeat && state.activeBeat.index !== undefined) {
            state.beatResults[state.activeBeat.index] = 'ok';

            // Record shielded hit as OK for replay
            if (_recordInput && state.isRecording) {
                const relativeTime = performance.now() - state.gameStartTime;
                _recordInput(relativeTime, state.activeBeat.index, 'ok', 0);
            }
        }

        // Don't break combo
        return;
    }

    const beatIndex = state.activeBeat?.index ?? -1;

    if (state.activeBeat && state.activeBeat.index !== undefined) {
        state.beatResults[state.activeBeat.index] = 'miss';
    }
    state.playerStats.miss++;
    state.playerCombo = 0;
    state.powerupChargeProgress = 0;  // Reset power-up charge on miss

    // Record miss for replay
    if (_recordInput && state.isRecording) {
        const relativeTime = performance.now() - state.gameStartTime;
        _recordInput(relativeTime, beatIndex, 'miss', 0);
    }

    showFeedback('MISS');
    playSFX('MISS');
    playCrowdGroan();
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
    const personality = state.aiPersonality;

    // Use personality-based accuracy in matchday mode
    if (state.gameMode === 'matchday' && personality) {
        accuracy = personality.baseAccuracy;

        // Calculate game progress (0-1)
        const totalBeats = state.detectedBeats.length;
        const progress = totalBeats > 0 ? state.nextBeatIndex / totalBeats : 0;

        // Apply personality modifiers
        switch (personality.id) {
            case 'aggressive':
                // Starts strong, loses accuracy over time
                accuracy -= personality.accuracyDecay * progress;
                break;

            case 'comebackKing':
                // Gets stronger when losing
                if (state.aiScore < state.playerScore) {
                    const deficit = state.playerScore - state.aiScore;
                    const comebackBoost = Math.min(personality.comebackBonus, deficit / 2000 * personality.comebackBonus);
                    accuracy += comebackBoost;
                }
                break;

            case 'consistent':
                // Small random variance
                accuracy += (Math.random() - 0.5) * personality.accuracyVariance * 2;
                break;

            case 'clutch':
                // Peaks in final moments
                if (progress >= personality.clutchThreshold) {
                    accuracy += personality.clutchBonus;
                }
                break;

            case 'wildcard':
                // Unpredictable streaks
                if (state.aiInStreak) {
                    accuracy = personality.streakAccuracy;
                    state.aiStreakCounter--;
                    if (state.aiStreakCounter <= 0) {
                        state.aiInStreak = false;
                    }
                } else if (Math.random() < personality.streakChance) {
                    state.aiInStreak = true;
                    state.aiStreakCounter = personality.streakLength;
                    accuracy = personality.streakAccuracy;
                }
                break;
        }

        // Apply rubber banding with personality strength
        const diff = state.playerScore - state.aiScore;
        const rubberBand = personality.rubberBandStrength || 1.0;
        if (diff < -AI_RUBBER_BAND.SCORE_DIFF_THRESHOLD) {
            accuracy -= AI_RUBBER_BAND.LOSING_REDUCTION * rubberBand;
        } else if (diff > AI_RUBBER_BAND.SCORE_DIFF_THRESHOLD) {
            accuracy += AI_RUBBER_BAND.WINNING_INCREASE * rubberBand;
        }

        // Update AI mood based on score difference
        const prevMood = state.aiMood;
        if (state.aiScore > state.playerScore + 300) {
            state.aiMood = 'confident';
        } else if (state.aiScore < state.playerScore - 300) {
            state.aiMood = 'struggling';
        } else {
            state.aiMood = 'neutral';
        }

        // Update mood UI if changed
        if (prevMood !== state.aiMood && _updateAIMoodUI) {
            _updateAIMoodUI();
        }
    } else {
        // Standard rubber banding for practice mode
        if (state.gameMode === 'matchday') {
            const diff = state.playerScore - state.aiScore;
            if (diff < -AI_RUBBER_BAND.SCORE_DIFF_THRESHOLD) {
                accuracy -= AI_RUBBER_BAND.LOSING_REDUCTION;
            } else if (diff > AI_RUBBER_BAND.SCORE_DIFF_THRESHOLD) {
                accuracy += AI_RUBBER_BAND.WINNING_INCREASE;
            }
        }
    }

    // Clamp accuracy
    accuracy = Math.max(0.3, Math.min(0.95, accuracy));

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
