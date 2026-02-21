// ============================================
// input.js — Input handling, scoring, AI
// ============================================

import { GameState, SCORE, BEAT_RESULT_COLORS, AI_ACCURACY, AI_RUBBER_BAND, POWERUPS, AI_PERSONALITIES, CLUB_AI_PERSONALITIES, HOLD_BEAT, HOLD_SCORING, TRASH_TALK, TRASH_TALK_PERSONALITIES, PERFECT_STREAK, CALIBRATION, MODIFIERS, INPUT_CONFIG, PARTICLE_CONFIG, COMBO_VISUALS, ANIMATION_TIMINGS, SCREEN_EFFECTS, AI_THRESHOLDS, UI_TIMINGS, DEFAULT_COLORS } from './config.js';
import { state } from './state.js';
import { elements, powerupSlots, announce } from './ui.js';
import { playSFX } from './audio.js';

// Callback for sudden death game end (set by main.js to avoid circular import)
let _onSuddenDeathEnd = null;

export function setSuddenDeathCallback(callback) {
    _onSuddenDeathEnd = callback;
}

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

let lastInputTime = 0;

// Confetti colors (club primary + celebratory colors)
const CONFETTI_COLORS = ['#ffcc00', '#ff6600', '#00ff88', '#ff4488', '#44aaff', '#ffffff'];

// ============================================
// Performance: Object Pool for particles
// Reuses particle objects to reduce GC pressure
// ============================================

const _particlePool = [];

function getParticle() {
    return _particlePool.length > 0 ? _particlePool.pop() : {};
}

function releaseParticle(p) {
    if (_particlePool.length < PARTICLE_CONFIG.MAX_POOL_SIZE) {
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
        setTimeout(() => state.crowdBgCanvas.classList.remove('milestone'), ANIMATION_TIMINGS.MILESTONE_ANIMATION_MS);
    }
}

// ============================================
// Input Helper Functions (extracted for maintainability)
// ============================================

/**
 * Find the best matching beat for current input timing
 * @param {number} adjustedNow - Calibration-adjusted current time
 * @returns {{ beat: object|null, diff: number }} Best beat and timing difference
 */
function findBestMatchingBeat(adjustedNow) {
    let bestBeat = null;
    let bestDiff = Infinity;

    // Check active beat
    if (state.activeBeat) {
        const diff = Math.abs(adjustedNow - state.activeBeat.time);
        if (diff < bestDiff) {
            bestDiff = diff;
            bestBeat = state.activeBeat;
        }
    }

    // Check next upcoming beat (early hit)
    if (state.nextBeatIndex < state.detectedBeats.length) {
        const beat = state.detectedBeats[state.nextBeatIndex];
        const beatTime = typeof beat === 'object' ? beat.time : beat;
        const upcomingWallTime = state.gameStartTime + beatTime * 1000;
        const diff = Math.abs(adjustedNow - upcomingWallTime);
        if (diff < bestDiff) {
            bestDiff = diff;
            bestBeat = { time: upcomingWallTime, index: state.nextBeatIndex, isEarly: true, beatData: beat };
        }
    }

    return { beat: bestBeat, diff: bestDiff };
}

/**
 * Calculate effective timing windows (considering Slow Motion powerup)
 * @returns {{ PERFECT: number, GOOD: number, OK: number }} Timing windows in ms
 */
function calculateEffectiveTiming() {
    let slowMotionMultiplier = 1;
    if (state.powerups.slowMotion.active) {
        const baseMultiplier = 1 / POWERUPS.slowMotion.speedMultiplier;
        slowMotionMultiplier = state.activeModifiers.doubleTime ? baseMultiplier * 1.5 : baseMultiplier;
    }
    return {
        PERFECT: state.activeTiming.PERFECT * slowMotionMultiplier,
        GOOD: state.activeTiming.GOOD * slowMotionMultiplier,
        OK: state.activeTiming.OK * slowMotionMultiplier
    };
}

/**
 * Rate a hit based on timing difference
 * @param {number} diff - Timing difference in ms
 * @param {object} timing - Effective timing windows
 * @returns {{ rating: string, score: number }} Rating and score value
 */
function rateHitTiming(diff, timing) {
    if (diff <= timing.PERFECT) {
        return { rating: 'PERFECT', score: SCORE.PERFECT };
    } else if (diff <= timing.GOOD) {
        return { rating: 'GOOD', score: SCORE.GOOD };
    } else {
        return { rating: 'OK', score: SCORE.OK };
    }
}

/**
 * Process tap beat rating - update stats, combo, and perfect streak
 * @param {string} rating - PERFECT, GOOD, or OK
 */
function processTapBeatRating(rating) {
    if (rating === 'PERFECT') {
        state.playerStats.perfect++;
        state.playerCombo++;
        state.perfectStreak++;
        if (state.perfectStreak > state.maxPerfectStreak) {
            state.maxPerfectStreak = state.perfectStreak;
        }
        checkPerfectStreakMilestone(state.perfectStreak);
        if (state.playerCombo >= 10) {
            triggerScreenShake('perfect');
        }
    } else if (rating === 'GOOD') {
        state.playerStats.good++;
        state.playerCombo++;
        if (state.perfectStreak >= PERFECT_STREAK.MIN_DISPLAY) {
            showPerfectStreakBreak(state.perfectStreak);
        }
        state.perfectStreak = 0;
    } else {
        state.playerStats.ok++;
        state.playerCombo++;
        if (state.perfectStreak >= PERFECT_STREAK.MIN_DISPLAY) {
            showPerfectStreakBreak(state.perfectStreak);
        }
        state.perfectStreak = 0;
    }
}

/**
 * Process early hit side-effects (when player hits upcoming beat before active beat)
 * @param {object} bestBeat - The beat that was hit early
 * @param {number} now - Current timestamp
 */
function processEarlyHit(bestBeat, now) {
    if (state.activeBeat) {
        // Mark skipped active beat as missed for visualization only
        if (state.activeBeat.index !== undefined) {
            state.beatResults[state.activeBeat.index] = 'miss';
        }
    }
    state.nextBeatIndex = bestBeat.index + 1;
    state.activeBeat = null;

    // Trigger side-effects that triggerBeat() would have
    state.totalBeats++;
    state.crowdBeatTime = now;
    state.beatFlashIntensity = 1;
    elements.gameCanvas.classList.remove('beat-pulse');
    void elements.gameCanvas.offsetWidth;
    elements.gameCanvas.classList.add('beat-pulse');
    simulateAI();
}

/**
 * Spawn visual effects for a successful hit
 * @param {object} bestBeat - The beat that was hit
 * @param {string} rating - PERFECT, GOOD, or OK
 * @param {number} now - Current timestamp
 */
function spawnHitVisuals(bestBeat, rating, now) {
    if (rating === 'MISS' || bestBeat.index === undefined) return;

    const beatData = state.detectedBeats[bestBeat.index];
    const beatTime = typeof beatData === 'object' ? beatData.time : beatData;
    const hitColor = BEAT_RESULT_COLORS[rating.toLowerCase()] || '#ffffff';

    // Beat hit effect (expanding ring)
    state.beatHitEffects.push({
        beatTime: beatTime,
        color: hitColor,
        spawnTime: now
    });

    // PERFECT particles: 8 radiating particles
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

    // Confetti burst on combo milestones
    const combo = state.playerCombo;
    if (combo === 50 || combo === 100 || combo % 100 === 0) {
        spawnConfetti(beatTime, combo >= 100 ? COMBO_VISUALS.CONFETTI.LARGE : COMBO_VISUALS.CONFETTI.MEDIUM, now);
        if (navigator.vibrate) navigator.vibrate(COMBO_VISUALS.HAPTIC_PATTERNS.COMBO_100);
    } else if (combo === 25 || combo === 75) {
        spawnConfetti(beatTime, COMBO_VISUALS.CONFETTI.SMALL, now);
        if (navigator.vibrate) navigator.vibrate(COMBO_VISUALS.HAPTIC_PATTERNS.COMBO_50);
    } else if (combo === 10 || combo === 15 || combo === 20) {
        if (navigator.vibrate) navigator.vibrate(COMBO_VISUALS.HAPTIC_PATTERNS.COMBO_SMALL);
    }
}

/**
 * Apply haptic feedback for hit rating
 * @param {string} rating - PERFECT, GOOD, OK, or MISS
 */
function applyHitHaptics(rating) {
    if (!navigator.vibrate) return;
    switch (rating) {
        case 'PERFECT': navigator.vibrate([8, 30, 8, 30, 12]); break;
        case 'GOOD': navigator.vibrate([10, 25, 15]); break;
        case 'OK': navigator.vibrate([8]); break;
        case 'MISS': navigator.vibrate([50, 30, 30]); break;
    }
}

export function handleInput() {
    if (state.currentState !== GameState.PLAYING) return;
    if (state.isPaused) return;

    const now = performance.now();

    // Prevent duplicate hits from touch + click firing on the same tap
    if (now - lastInputTime < INPUT_CONFIG.COOLDOWN_MS) return;
    lastInputTime = now;

    // If already holding, ignore new press (release handles scoring)
    if (state.holdState.isHolding) return;

    // Apply input calibration offset
    const rawOffset = state.settings?.inputOffset || 0;
    const inputOffset = Math.max(CALIBRATION.MIN_OFFSET, Math.min(CALIBRATION.MAX_OFFSET, rawOffset));
    const adjustedNow = now - inputOffset;

    // Find best matching beat
    const { beat: bestBeat, diff: bestDiff } = findBestMatchingBeat(adjustedNow);

    // Calculate effective timing windows (Slow Motion widens them)
    const effectiveTiming = calculateEffectiveTiming();

    // No beat within reach - treat as a miss
    if (!bestBeat || bestDiff > effectiveTiming.OK) {
        registerMiss();
        return;
    }

    // Rate the hit
    const { rating, score } = rateHitTiming(bestDiff, effectiveTiming);

    // Check if this is a hold beat
    const beatData = bestBeat.beatData || state.activeBeat?.beatData || null;
    const isHoldBeat = beatData && typeof beatData === 'object' && beatData.type === 'hold';

    if (isHoldBeat) {
        initiateHoldBeat(bestBeat, beatData, rating, now);
        return;
    }

    // Process tap beat scoring (stats, combo, streak)
    processTapBeatRating(rating);

    // Reset consecutive misses on successful hit
    triggerTrashTalk('playerHit');

    // Check for combo milestone effects
    checkComboMilestone(state.playerCombo);

    // Record result for visualizer beat coloring
    if (bestBeat.index !== undefined) {
        state.beatResults[bestBeat.index] = rating.toLowerCase();
    }

    // Haptic and audio feedback
    applyHitHaptics(rating);
    playSFX(rating);

    // Handle early hit on upcoming beat
    if (bestBeat.isEarly && rating !== 'MISS') {
        processEarlyHit(bestBeat, now);
    } else {
        state.activeBeat = null;
    }

    // Spawn visual effects
    spawnHitVisuals(bestBeat, rating, now);

    // Calculate final score with all multipliers
    const comboMultiplier = getComboMultiplier();
    const modifierMultiplier = state.modifierScoreMultiplier || 1.0;
    const powerupMultiplier = state.activePowerupMultiplier || 1.0;
    const perfectStreakBonus = rating === 'PERFECT' ? getPerfectStreakMultiplier() : 1.0;
    const totalMultiplier = comboMultiplier * modifierMultiplier * powerupMultiplier * perfectStreakBonus;
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

    // Update UI
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

    // Shield auto-activates when reaching combo threshold (no manual activation needed)
    // Cooldown: Shield cannot reactivate within configured time of being used (prevents spam)
    const now = performance.now();
    const cooldownElapsed = now - (powerups.shield.lastUsedTime || 0);
    const shieldOffCooldown = cooldownElapsed >= INPUT_CONFIG.SHIELD_COOLDOWN_MS;

    if (!powerups.shield.active && combo >= POWERUPS.shield.chargeCombo && shieldOffCooldown) {
        powerups.shield.active = true;
        if (_updatePowerupUI) _updatePowerupUI('shield', 'active');
        showPowerupReady('shield');

        // Show activation feedback
        state.feedbackText = 'SHIELD READY!';
        state.feedbackAlpha = 1;
        state.feedbackSpawnTime = now;
        state.feedbackColor = POWERUPS.shield.color;
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
    // Shield shows charge progress until it auto-activates
    if (!powerups.shield.active && _updatePowerupUI) {
        _updatePowerupUI('shield', 'charging');
    }
    if (!powerups.slowMotion.charged && !powerups.slowMotion.active && _updatePowerupUI) {
        _updatePowerupUI('slowMotion', 'empty');
    }
    if (!powerups.scoreBurst.charged && !powerups.scoreBurst.active && _updatePowerupUI) {
        _updatePowerupUI('scoreBurst', 'empty');
    }
}

function showPowerupReady(powerupId) {
    const slot = powerupSlots[powerupId];
    if (slot) {
        slot.classList.add('pulse');
        setTimeout(() => slot.classList.remove('pulse'), ANIMATION_TIMINGS.POWERUP_PULSE_MS);
    }
}

export function registerMiss() {
    // Check if Shield is active - absorb the miss
    if (state.powerups.shield.active) {
        state.powerups.shield.active = false;
        state.powerups.shield.lastUsedTime = performance.now();  // Track for cooldown
        if (_updatePowerupUI) _updatePowerupUI('shield', 'empty');

        // Visual feedback for shield absorption
        state.feedbackText = 'SHIELDED!';
        state.feedbackAlpha = 1;
        state.feedbackSpawnTime = performance.now();
        state.feedbackColor = POWERUPS.shield.color;

        // Mark beat as OK instead of miss (shield saved it)
        if (state.activeBeat && state.activeBeat.index !== undefined) {
            state.beatResults[state.activeBeat.index] = 'ok';
        }

        // Record shielded event for replay (works with or without active beat)
        if (_recordInput && state.isRecording) {
            const relativeTime = performance.now() - state.gameStartTime;
            const beatIndex = state.activeBeat?.index ?? -1;
            _recordInput(relativeTime, beatIndex, 'shielded', 0);
        }

        // Audio and haptic feedback for shield use
        playSFX('OK');  // Distinct sound for shield activation
        if (navigator.vibrate) navigator.vibrate([15, 30, 15]);

        // Don't break combo OR perfect streak - shield protects both
        return;
    }

    // Sudden Death modifier - one miss ends the game immediately
    if (state.activeModifiers.suddenDeath) {
        // Show dramatic feedback before ending
        state.feedbackText = 'SUDDEN DEATH!';
        state.feedbackAlpha = 1;
        state.feedbackSpawnTime = performance.now();
        state.feedbackColor = '#ff0000';

        playSFX('MISS');
        if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 100]);

        // Record the fatal miss
        if (_recordInput && state.isRecording) {
            const relativeTime = performance.now() - state.gameStartTime;
            const beatIndex = state.activeBeat?.index ?? -1;
            _recordInput(relativeTime, beatIndex, 'miss', 0);
        }

        // End game immediately via callback
        if (_onSuddenDeathEnd) {
            // Small delay for feedback to show
            setTimeout(() => _onSuddenDeathEnd(), ANIMATION_TIMINGS.SUDDEN_DEATH_DELAY_MS);
        }
        return;
    }

    const beatIndex = state.activeBeat?.index ?? -1;

    // Trigger combo break effect if breaking a significant combo
    const brokenCombo = state.playerCombo;

    // Trigger AI trash talk for player miss
    triggerTrashTalk('playerMiss');
    if (brokenCombo >= 10) {
        triggerScreenShake('comboBreak');
        triggerScreenFlash('comboBreak');

        // Add CSS animation fallback for combo break
        if (state.crowdBgCanvas) {
            state.crowdBgCanvas.classList.remove('combo-break');
            void state.crowdBgCanvas.offsetWidth;
            state.crowdBgCanvas.classList.add('combo-break');
        }

        // Trigger combo break trash talk
        triggerTrashTalk('comboBreak', { brokenCombo });
    }

    if (state.activeBeat && state.activeBeat.index !== undefined) {
        state.beatResults[state.activeBeat.index] = 'miss';
    }
    state.playerStats.miss++;
    state.playerCombo = 0;
    state.lastMilestoneCombo = 0;  // Reset milestone tracker
    state.powerupChargeProgress = 0;  // Reset power-up charge on miss

    // Reset perfect streak on miss
    if (state.perfectStreak >= PERFECT_STREAK.MIN_DISPLAY) {
        showPerfectStreakBreak(state.perfectStreak);
    }
    state.perfectStreak = 0;

    // Record miss for replay
    if (_recordInput && state.isRecording) {
        const relativeTime = performance.now() - state.gameStartTime;
        _recordInput(relativeTime, beatIndex, 'miss', 0);
    }

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

// ============================================
// Perfect Streak Bonus System
// ============================================

/**
 * Get the bonus multiplier for current perfect streak
 * @returns {number} Multiplier (1.0 to MAX_BONUS)
 */
function getPerfectStreakMultiplier() {
    if (state.perfectStreak < PERFECT_STREAK.MIN_DISPLAY) return 1.0;
    const bonus = 1 + (state.perfectStreak * PERFECT_STREAK.BONUS_PER_STREAK);
    return Math.min(bonus, PERFECT_STREAK.MAX_BONUS);
}

/**
 * Check for perfect streak milestones and award bonuses
 * @param {number} streak - Current perfect streak count
 */
function checkPerfectStreakMilestone(streak) {
    const milestoneBonus = PERFECT_STREAK.MILESTONE_BONUS[streak];
    if (milestoneBonus) {
        state.playerScore += milestoneBonus;
        state.perfectStreakBonusEarned += milestoneBonus;

        // Show milestone feedback
        showPerfectStreakMilestone(streak, milestoneBonus);

        // Trigger celebratory effects
        triggerScreenShake('perfect');
        triggerScreenFlash('combo10');

        // Haptic feedback for milestone
        if (navigator.vibrate) {
            navigator.vibrate([12, 40, 12, 40, 20]);
        }
    } else if (streak >= PERFECT_STREAK.MIN_DISPLAY) {
        // Show streak counter for non-milestone streaks
        showPerfectStreakCounter(streak);
    }
}

/**
 * Show perfect streak milestone celebration
 * @param {number} streak - The milestone streak number
 * @param {number} bonus - Bonus points awarded
 */
function showPerfectStreakMilestone(streak, bonus) {
    state.feedbackText = `PERFECT x${streak}! +${bonus}`;
    state.feedbackAlpha = 1;
    state.feedbackSpawnTime = performance.now();
    state.feedbackColor = DEFAULT_COLORS.PERFECT_STREAK_MILESTONE;  // Gold for milestones

    // Update perfect streak display
    updatePerfectStreakDisplay(streak, true);
}

/**
 * Show perfect streak counter (non-milestone)
 * @param {number} streak - Current streak count
 */
function showPerfectStreakCounter(streak) {
    // Update the perfect streak display element
    updatePerfectStreakDisplay(streak, false);
}

/**
 * Show feedback when perfect streak is broken
 * @param {number} brokenStreak - The streak that was broken
 */
function showPerfectStreakBreak(brokenStreak) {
    // Brief visual indicator that streak was lost
    updatePerfectStreakDisplay(0, false);
}

/**
 * Update the perfect streak display in the UI
 * @param {number} streak - Current streak count
 * @param {boolean} isMilestone - Whether this is a milestone
 */
function updatePerfectStreakDisplay(streak, isMilestone) {
    const display = elements.perfectStreakDisplay;
    if (!display) return;

    if (streak < PERFECT_STREAK.MIN_DISPLAY) {
        display.classList.add('hidden');
        return;
    }

    const multiplier = getPerfectStreakMultiplier();
    display.textContent = `PERFECT x${streak} (${multiplier.toFixed(1)}x)`;
    display.classList.remove('hidden');

    if (isMilestone) {
        display.classList.remove('milestone');
        void display.offsetWidth;  // Force reflow
        display.classList.add('milestone');
    }
}

// ============================================
// Screen Shake & Flash Effects
// ============================================

export function triggerScreenShake(type) {
    if (state.settings?.reducedEffects) return;
    const preset = SCREEN_EFFECTS.SHAKE_PRESETS[type];
    if (!preset) return;

    state.screenShake = {
        active: true,
        intensity: preset.intensity,
        startTime: performance.now(),
        duration: preset.duration,
        decay: preset.decay
    };
}

export function triggerScreenFlash(type) {
    if (state.settings?.reducedEffects) return;
    const preset = SCREEN_EFFECTS.FLASH_PRESETS[type];
    if (!preset) return;

    state.screenFlash = {
        active: true,
        color: preset.color,
        intensity: preset.intensity,
        startTime: performance.now(),
        duration: preset.duration
    };
}

// Check for combo milestones and trigger effects
function checkComboMilestone(combo) {
    // Only trigger milestone effects once per milestone
    const lastMilestone = state.lastMilestoneCombo || 0;

    if (combo >= 100 && lastMilestone < 100 && combo % 100 === 0) {
        if (!state.settings?.reducedEffects) {
            triggerScreenShake('combo100');
            triggerScreenFlash('combo100');
        }
        state.lastMilestoneCombo = combo;
        announce(`Combo ${combo}! Maximum multiplier!`, 'assertive');
    } else if (combo === 50) {
        if (!state.settings?.reducedEffects) {
            triggerScreenShake('combo50');
            triggerScreenFlash('combo50');
        }
        state.lastMilestoneCombo = 50;
        announce('Combo 50!', 'assertive');
    } else if (combo === 25) {
        if (!state.settings?.reducedEffects) {
            triggerScreenShake('combo25');
            triggerScreenFlash('combo25');
        }
        state.lastMilestoneCombo = 25;
        announce('Combo 25!');
    } else if (combo === 20 && lastMilestone < 20) {
        if (!state.settings?.reducedEffects) {
            triggerScreenFlash('combo20');
        }
        state.lastMilestoneCombo = 20;
        announce('Combo 20, max multiplier!');
    } else if (combo === 10 && lastMilestone < 10) {
        if (!state.settings?.reducedEffects) {
            triggerScreenShake('combo10');
            triggerScreenFlash('combo10');
        }
        state.lastMilestoneCombo = 10;
        announce('Combo 10!');
    } else if (combo === 6 && lastMilestone < 6) {
        state.lastMilestoneCombo = 6;
        announce('Fever mode!', 'assertive');
    }
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
    }, INPUT_CONFIG.HIT_EFFECT_DURATION_MS);
}

// ============================================
// AI Simulation Helper Functions (extracted for maintainability)
// ============================================

/**
 * Apply personality-specific accuracy modifiers
 * @param {number} accuracy - Base accuracy
 * @param {object} personality - AI personality config
 * @param {number} progress - Game progress (0-1)
 * @returns {number} Modified accuracy
 */
function applyPersonalityModifiers(accuracy, personality, progress) {
    switch (personality.id) {
        case 'aggressive':
            accuracy -= personality.accuracyDecay * progress;
            break;
        case 'comebackKing':
            if (state.aiScore < state.playerScore) {
                const deficit = state.playerScore - state.aiScore;
                const comebackBoost = Math.min(personality.comebackBonus, deficit / 2000 * personality.comebackBonus);
                accuracy += comebackBoost;
            }
            break;
        case 'consistent':
            accuracy += (Math.random() - 0.5) * personality.accuracyVariance * 2;
            break;
        case 'clutch':
            if (progress >= personality.clutchThreshold) {
                accuracy += personality.clutchBonus;
            }
            break;
        case 'wildcard':
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
    return accuracy;
}

/**
 * Apply rubber banding based on score difference
 * @param {number} accuracy - Current accuracy
 * @param {number} rubberBandStrength - Personality rubber band multiplier (1.0 = standard)
 * @returns {number} Modified accuracy
 */
function applyRubberBanding(accuracy, rubberBandStrength = 1.0) {
    const diff = state.playerScore - state.aiScore;
    if (diff < -AI_RUBBER_BAND.SCORE_DIFF_THRESHOLD) {
        accuracy -= AI_RUBBER_BAND.LOSING_REDUCTION * rubberBandStrength;
    } else if (diff > AI_RUBBER_BAND.SCORE_DIFF_THRESHOLD) {
        accuracy += AI_RUBBER_BAND.WINNING_INCREASE * rubberBandStrength;
    }
    return accuracy;
}

/**
 * Update AI mood based on score difference
 */
function updateAIMood() {
    const prevMood = state.aiMood;
    if (state.aiScore > state.playerScore + AI_THRESHOLDS.MOOD_CONFIDENT_LEAD) {
        state.aiMood = 'confident';
    } else if (state.aiScore < state.playerScore - AI_THRESHOLDS.MOOD_STRUGGLING_DEFICIT) {
        state.aiMood = 'struggling';
    } else {
        state.aiMood = 'neutral';
    }
    if (prevMood !== state.aiMood && _updateAIMoodUI) {
        _updateAIMoodUI();
    }
}

/**
 * Calculate AI accuracy for matchday mode with personality
 * @param {number} baseAccuracy - Base accuracy from personality
 * @param {object} personality - AI personality config
 * @returns {number} Final accuracy value
 */
function calculateMatchdayAccuracy(baseAccuracy, personality) {
    const totalBeats = state.detectedBeats.length;
    const progress = totalBeats > 0 ? state.nextBeatIndex / totalBeats : 0;

    let accuracy = applyPersonalityModifiers(baseAccuracy, personality, progress);
    accuracy = applyRubberBanding(accuracy, personality.rubberBandStrength || 1.0);
    updateAIMood();

    return accuracy;
}

/**
 * Process a successful AI hit - update score and trigger effects
 */
function processAIHit() {
    state.aiCombo++;
    if (state.aiCombo > state.aiMaxCombo) {
        state.aiMaxCombo = state.aiCombo;
    }

    // Trigger AI combo trash talk at milestones
    if (state.aiCombo === 10 || state.aiCombo === 20 || state.aiCombo === 30) {
        triggerTrashTalk('aiCombo', { aiCombo: state.aiCombo });
    }

    // Quality roll (within scoring range)
    let scoreGained = 0;
    const scoringRoll = Math.random();
    if (scoringRoll < 0.40) {
        scoreGained = SCORE.PERFECT;
        if (Math.random() < 0.15) {
            triggerTrashTalk('aiPerfect');
        }
    } else if (scoringRoll < 0.70) {
        scoreGained = SCORE.GOOD;
    } else {
        scoreGained = SCORE.OK;
    }

    state.aiScore += scoreGained;
    elements.aiScore.textContent = state.aiScore;

    // Track comeback potential
    const deficit = state.aiScore - state.playerScore;
    if (deficit > state.maxDeficit) {
        state.maxDeficit = deficit;
    }
    if (deficit >= AI_THRESHOLDS.COMEBACK_ACHIEVEMENT) {
        state.wasEverBehind500 = true;
    }

    // Periodic score check for trash talk
    if (Math.random() < 0.05) {
        triggerTrashTalk('scoreCheck');
    }

    // AI score popup
    if (scoreGained > 0 && elements.aiScorePopupContainer) {
        const popup = document.createElement('div');
        popup.className = 'ai-score-popup';
        popup.textContent = `+${scoreGained}`;
        elements.aiScorePopupContainer.appendChild(popup);
        setTimeout(() => popup.remove(), UI_TIMINGS.AI_SCORE_POPUP_MS);
    }
}

export function simulateAI() {
    let accuracy = AI_ACCURACY;
    const personality = state.aiPersonality;

    // Calculate accuracy based on game mode and personality
    if (state.gameMode === 'matchday' && personality) {
        accuracy = calculateMatchdayAccuracy(personality.baseAccuracy, personality);
    } else if (state.gameMode === 'matchday') {
        // Standard rubber banding for matchday without personality
        accuracy = applyRubberBanding(accuracy);
    }

    // Clamp accuracy to valid range
    accuracy = Math.max(0.3, Math.min(0.95, accuracy));

    // Miss roll
    if (Math.random() > accuracy) {
        state.aiCombo = 0;
        elements.aiScore.textContent = state.aiScore;
        return;
    }

    // AI hit - process scoring and effects
    processAIHit();
}

// ============================================
// Hold Beat (Long Press) Functions
// ============================================

/**
 * Initiates a hold beat - called when player presses on a hold beat
 * @param {Object} beat - The beat being hit
 * @param {Object} beatData - The normalized beat data with duration info
 * @param {string} pressRating - Rating of the initial press (PERFECT/GOOD/OK)
 * @param {number} now - Current timestamp
 */
function initiateHoldBeat(beat, beatData, pressRating, now) {
    const holdDurationMs = beatData.duration * 1000;
    const beatWallTime = state.gameStartTime + beatData.time * 1000;

    // Award initial combo for successful press
    state.playerCombo++;
    if (state.playerCombo > state.playerMaxCombo) {
        state.playerMaxCombo = state.playerCombo;
    }

    state.holdState = {
        isHolding: true,
        currentBeatIndex: beat.index,
        pressTime: now,
        pressRating: pressRating.toLowerCase(),
        expectedEndTime: beatWallTime + holdDurationMs,
        holdProgress: 0,
        wasBroken: false,
        lastComboTick: 0,
        comboTickCount: 0,
    };

    // Visual feedback for hold start
    showFeedback('HOLD!');
    state.feedbackColor = '#00aaff';  // Blue for hold
    playSFX(pressRating);
    updateComboDisplay();

    // Haptic feedback for hold start
    if (navigator.vibrate) {
        navigator.vibrate([10, 50, 10]);  // Distinct pattern for hold
    }

    // If this was an early hit, advance past the beat
    // NOTE: When a player hits a hold beat early, the skipped active beat is marked
    // as 'miss' for VISUALIZATION ONLY (grayed out in beat track). This is intentional:
    // - The player successfully initiated a hold beat, so they got a valid hit
    // - We don't call registerMiss() or increment miss stats - the player isn't penalized
    // - The visual marking helps show which beat was skipped in the track display
    // This is consistent with how early tap beat hits work (see handleInput lines 224-244)
    if (beat.isEarly) {
        if (state.activeBeat) {
            if (state.activeBeat.index !== undefined) {
                state.beatResults[state.activeBeat.index] = 'miss';  // Visual only, not stats
            }
        }
        state.nextBeatIndex = beat.index + 1;
        state.activeBeat = null;

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

    // Record hold start for replay
    if (_recordInput && state.isRecording) {
        const relativeTime = now - state.gameStartTime;
        _recordInput(relativeTime, beat.index, 'hold_start', 0);
    }
}

/**
 * Handles input release - calculates hold beat score
 * Called on keyup/touchend
 */
export function handleInputRelease() {
    if (state.currentState !== GameState.PLAYING) return;
    if (state.isPaused) return;
    if (!state.holdState.isHolding) return;

    const now = performance.now();
    const { holdState } = state;

    // Calculate hold score
    const result = calculateHoldScore(now);

    // Update stats based on overall result
    // Note: Combo was already incremented during the hold, so we only add a bonus on release
    let overallRating = result.overallRating;
    if (overallRating === 'perfect') {
        state.playerStats.perfect++;
        // Bonus combo for perfect release
        state.playerCombo++;
        if (state.playerCombo > state.playerMaxCombo) {
            state.playerMaxCombo = state.playerCombo;
        }

        // Perfect streak tracking for hold beats
        state.perfectStreak++;
        if (state.perfectStreak > state.maxPerfectStreak) {
            state.maxPerfectStreak = state.perfectStreak;
        }
        checkPerfectStreakMilestone(state.perfectStreak);

        // Screen shake on perfect holds (combo >= 10)
        if (state.playerCombo >= 10) {
            triggerScreenShake('perfect');
        }

        // Check for combo milestones
        checkComboMilestone(state.playerCombo);
    } else if (overallRating === 'good') {
        state.playerStats.good++;
        // Break perfect streak on non-perfect hit
        if (state.perfectStreak >= PERFECT_STREAK.MIN_DISPLAY) {
            showPerfectStreakBreak(state.perfectStreak);
        }
        state.perfectStreak = 0;
        // Combo maintained, no bonus
    } else if (overallRating === 'ok') {
        state.playerStats.ok++;
        // Break perfect streak on non-perfect hit
        if (state.perfectStreak >= PERFECT_STREAK.MIN_DISPLAY) {
            showPerfectStreakBreak(state.perfectStreak);
        }
        state.perfectStreak = 0;
        // Combo maintained, no bonus
    } else {
        // Check if Shield can absorb this hold beat miss
        if (state.powerups.shield.active) {
            state.powerups.shield.active = false;
            state.powerups.shield.lastUsedTime = now;  // Track for cooldown
            if (_updatePowerupUI) _updatePowerupUI('shield', 'empty');

            // Visual feedback for shield absorption
            state.feedbackText = 'SHIELDED!';
            state.feedbackAlpha = 1;
            state.feedbackSpawnTime = now;
            state.feedbackColor = POWERUPS.shield.color;

            // Audio and haptic feedback
            playSFX('OK');
            if (navigator.vibrate) navigator.vibrate([15, 30, 15]);

            // Upgrade rating to OK (shield saved it)
            overallRating = 'ok';
            state.playerStats.ok++;
            // Combo and perfect streak preserved
        } else {
            state.playerStats.miss++;
            state.playerCombo = 0;
            state.powerupChargeProgress = 0;
            // Break perfect streak on miss
            if (state.perfectStreak >= PERFECT_STREAK.MIN_DISPLAY) {
                showPerfectStreakBreak(state.perfectStreak);
            }
            state.perfectStreak = 0;
        }
    }

    // Apply combo multiplier + modifier multiplier + powerup multiplier + perfect streak bonus
    const comboMultiplier = getComboMultiplier();
    const modifierMultiplier = state.modifierScoreMultiplier || 1.0;
    const powerupMultiplier = state.activePowerupMultiplier || 1.0;
    const perfectStreakBonus = overallRating === 'perfect' ? getPerfectStreakMultiplier() : 1.0;
    const totalMultiplier = comboMultiplier * modifierMultiplier * powerupMultiplier * perfectStreakBonus;
    const scoreGained = Math.floor(result.totalScore * totalMultiplier);
    state.playerScore += scoreGained;

    if (state.playerCombo > state.playerMaxCombo) {
        state.playerMaxCombo = state.playerCombo;
    }

    // Mark beat result
    if (holdState.currentBeatIndex !== null) {
        state.beatResults[holdState.currentBeatIndex] = overallRating;
    }

    // Visual/audio feedback
    showFeedback(overallRating.toUpperCase());
    playSFX(overallRating.toUpperCase());

    // Haptic feedback
    if (navigator.vibrate) {
        switch (overallRating) {
            case 'perfect': navigator.vibrate([15, 5, 15]); break;
            case 'good': navigator.vibrate([10]); break;
            case 'ok': navigator.vibrate([5]); break;
            case 'miss': navigator.vibrate([40]); break;
        }
    }

    // Record hold end for replay
    if (_recordInput && state.isRecording) {
        const relativeTime = now - state.gameStartTime;
        const holdDuration = now - holdState.pressTime;
        _recordInput(relativeTime, holdState.currentBeatIndex, overallRating, scoreGained, 'hold', holdDuration);
    }

    // Update power-up charge progress
    updatePowerupCharge();

    elements.playerScore.textContent = state.playerScore;
    updateComboDisplay();
    showHitEffect(overallRating.toUpperCase());

    // Spawn visual effects
    if (overallRating !== 'miss' && holdState.currentBeatIndex !== null) {
        const beatData = state.detectedBeats[holdState.currentBeatIndex];
        const beatTime = typeof beatData === 'object' ? beatData.time : beatData;
        const hitColor = BEAT_RESULT_COLORS[overallRating] || '#ffffff';
        state.beatHitEffects.push({
            beatTime: beatTime,
            color: hitColor,
            spawnTime: now
        });
    }

    // Reset hold state
    state.holdState = {
        isHolding: false,
        currentBeatIndex: null,
        pressTime: 0,
        pressRating: null,
        expectedEndTime: 0,
        holdProgress: 0,
        wasBroken: false,
        lastComboTick: 0,
        comboTickCount: 0,
    };
}

/**
 * Calculates the score for a hold beat based on press, hold, and release
 * @param {number} releaseTime - When the player released
 * @returns {Object} Score breakdown and overall rating
 */
function calculateHoldScore(releaseTime) {
    const { holdState } = state;

    // Apply input calibration offset to release timing
    // Clamp to valid bounds to prevent extreme values from breaking gameplay
    const rawOffset = state.settings?.inputOffset || 0;
    const inputOffset = Math.max(CALIBRATION.MIN_OFFSET, Math.min(CALIBRATION.MAX_OFFSET, rawOffset));
    const adjustedReleaseTime = releaseTime - inputOffset;

    // Press score (based on initial press rating)
    let pressScore = 0;
    switch (holdState.pressRating) {
        case 'perfect': pressScore = SCORE.PERFECT; break;
        case 'good': pressScore = SCORE.GOOD; break;
        case 'ok': pressScore = SCORE.OK; break;
        default: pressScore = 0;
    }

    // Hold duration score
    const beatData = state.detectedBeats[holdState.currentBeatIndex];
    const beatTime = typeof beatData === 'object' ? beatData.time : beatData;
    const expectedDuration = holdState.expectedEndTime - (state.gameStartTime + beatTime * 1000);
    const actualDuration = adjustedReleaseTime - holdState.pressTime;
    const holdRatio = Math.min(1, actualDuration / expectedDuration);

    let holdScore = SCORE.PERFECT;
    if (holdState.wasBroken) {
        holdScore = SCORE.PERFECT * HOLD_SCORING.HOLD_BREAK_PENALTY * holdRatio;
    } else if (holdRatio >= HOLD_SCORING.THRESHOLDS.PERFECT) {
        holdScore = SCORE.PERFECT;
    } else if (holdRatio >= HOLD_SCORING.THRESHOLDS.OK) {
        holdScore = SCORE.GOOD;
    } else if (holdRatio >= HOLD_SCORING.THRESHOLDS.MINIMUM_HOLD) {
        holdScore = SCORE.OK;
    } else {
        holdScore = 0;
    }

    // Release timing score (use adjusted time and Slow Motion multiplier)
    const releaseError = Math.abs(adjustedReleaseTime - holdState.expectedEndTime);
    // When Double Time modifier is active, boost Slow Motion effect to compensate
    let slowMotionMultiplier = 1;
    if (state.powerups.slowMotion.active) {
        const baseMultiplier = 1 / POWERUPS.slowMotion.speedMultiplier; // ~1.43x
        slowMotionMultiplier = state.activeModifiers.doubleTime ? baseMultiplier * 1.5 : baseMultiplier;
    }
    const effectivePerfect = state.activeTiming.PERFECT * slowMotionMultiplier;
    const effectiveGood = state.activeTiming.GOOD * slowMotionMultiplier;
    const effectiveReleaseWindow = HOLD_BEAT.RELEASE_WINDOW * slowMotionMultiplier;

    let releaseScore = 0;
    let releaseRating = 'miss';

    if (releaseError <= effectivePerfect) {
        releaseScore = SCORE.PERFECT;
        releaseRating = 'perfect';
    } else if (releaseError <= effectiveGood) {
        releaseScore = SCORE.GOOD;
        releaseRating = 'good';
    } else if (releaseError <= effectiveReleaseWindow) {
        releaseScore = SCORE.OK;
        releaseRating = 'ok';
    } else {
        // Released too early or too late
        releaseScore = 0;
        releaseRating = 'miss';
    }

    // Calculate weighted total
    const totalScore = Math.floor(
        pressScore * HOLD_SCORING.PRESS_WEIGHT +
        holdScore * HOLD_SCORING.HOLD_WEIGHT +
        releaseScore * HOLD_SCORING.RELEASE_WEIGHT
    );

    // Determine overall rating based on weighted average
    const maxPossible = SCORE.PERFECT;
    const scoreRatio = totalScore / maxPossible;

    let overallRating;
    if (scoreRatio >= HOLD_SCORING.THRESHOLDS.GOOD && !holdState.wasBroken) {
        overallRating = 'perfect';
    } else if (scoreRatio >= HOLD_SCORING.THRESHOLDS.MINIMUM_HOLD) {
        overallRating = 'good';
    } else if (scoreRatio >= HOLD_SCORING.THRESHOLDS.EARLY_RELEASE) {
        overallRating = 'ok';
    } else {
        overallRating = 'miss';
    }

    return {
        pressScore,
        holdScore,
        releaseScore,
        totalScore,
        overallRating,
        holdRatio,
        releaseRating,
    };
}

/**
 * Updates hold progress - called from game loop
 * Checks if hold was broken (player released too early)
 */
export function updateHoldProgress() {
    if (!state.holdState.isHolding) return;

    const now = performance.now();
    const { holdState } = state;

    // Calculate progress
    const beatData = state.detectedBeats[holdState.currentBeatIndex];
    if (!beatData || typeof beatData !== 'object') return;

    const holdStartWall = state.gameStartTime + beatData.time * 1000;
    const holdDurationMs = beatData.duration * 1000;
    const elapsed = now - holdStartWall;
    holdState.holdProgress = Math.max(0, Math.min(1, elapsed / holdDurationMs));

    // Increment combo at regular intervals during hold (if not broken)
    if (!holdState.wasBroken) {
        const tickInterval = HOLD_SCORING.COMBO_TICK_INTERVAL;
        const currentTick = Math.floor(holdState.holdProgress / tickInterval);
        const previousTicks = holdState.comboTickCount;

        if (currentTick > previousTicks) {
            // Award combo and score for each new tick
            const newTicks = currentTick - previousTicks;
            for (let i = 0; i < newTicks; i++) {
                state.playerCombo++;
                if (state.playerCombo > state.playerMaxCombo) {
                    state.playerMaxCombo = state.playerCombo;
                }

                // Award incremental score
                const comboMultiplier = getComboMultiplier();
                const modifierMultiplier = state.modifierScoreMultiplier || 1.0;
                const powerupMultiplier = state.activePowerupMultiplier || 1.0;
                const tickScore = Math.floor(HOLD_SCORING.SCORE_PER_TICK * comboMultiplier * modifierMultiplier * powerupMultiplier);
                state.playerScore += tickScore;

                // Update power-up charge
                updatePowerupCharge();
            }

            holdState.comboTickCount = currentTick;
            holdState.lastComboTick = holdState.holdProgress;

            // Visual/audio feedback for combo tick
            showFeedback(`+${state.playerCombo}`);
            state.feedbackColor = '#00ffaa';
            updateComboDisplay();
            elements.playerScore.textContent = state.playerScore;

            // Subtle haptic for combo tick
            if (navigator.vibrate) {
                navigator.vibrate([5]);
            }
        }
    }

    // Check if hold should be auto-released (past the window)
    const releaseWindowEnd = holdState.expectedEndTime + HOLD_BEAT.RELEASE_WINDOW;
    if (now > releaseWindowEnd && !holdState.wasBroken) {
        // Player held too long - auto-trigger release with penalty
        handleInputRelease();
    }
}

/**
 * Marks the hold as broken (player released during grace period)
 * Called when player releases key while holding
 */
export function breakHold() {
    if (!state.holdState.isHolding) return;

    const now = performance.now();
    const holdDuration = now - state.holdState.pressTime;

    // Grace period - if released very quickly, don't break yet
    if (holdDuration < HOLD_BEAT.HOLD_GRACE_PERIOD) {
        return;
    }

    state.holdState.wasBroken = true;
}

/**
 * Simulates AI hold beat behavior
 * Uses weighted scoring aligned with player hold beat mechanics for fairness
 * @param {Object} beatData - The hold beat data
 */
export function simulateAIHoldBeat(beatData) {
    let accuracy = AI_ACCURACY;
    const personality = state.aiPersonality;

    // Use personality-based accuracy in matchday mode
    if (state.gameMode === 'matchday' && personality) {
        accuracy = personality.baseAccuracy;

        // Apply rubber banding
        const diff = state.playerScore - state.aiScore;
        const rubberBand = personality.rubberBandStrength || 1.0;
        if (diff < -AI_RUBBER_BAND.SCORE_DIFF_THRESHOLD) {
            accuracy -= AI_RUBBER_BAND.LOSING_REDUCTION * rubberBand;
        } else if (diff > AI_RUBBER_BAND.SCORE_DIFF_THRESHOLD) {
            accuracy += AI_RUBBER_BAND.WINNING_INCREASE * rubberBand;
        }
    }

    accuracy = Math.max(0.3, Math.min(0.95, accuracy));

    // Overall miss roll - determines if AI completely misses the hold beat
    const missRoll = Math.random();
    if (missRoll > accuracy) {
        // AI missed the hold beat entirely - reset combo
        state.aiCombo = 0;
        elements.aiScore.textContent = state.aiScore;
        return;
    }

    // AI successfully executed the hold beat - track combo
    state.aiCombo++;
    if (state.aiCombo > state.aiMaxCombo) {
        state.aiMaxCombo = state.aiCombo;
    }

    // Quality scoring using consistent distribution (aligned with player mechanics)
    // Press quality roll (40% PERFECT, 30% GOOD, 30% OK)
    const pressQuality = Math.random();
    let pressScore;
    if (pressQuality < 0.40) pressScore = SCORE.PERFECT;
    else if (pressQuality < 0.70) pressScore = SCORE.GOOD;
    else pressScore = SCORE.OK;

    // Hold quality roll (easier - 50% PERFECT, 30% GOOD, 20% OK)
    const holdQuality = Math.random();
    let holdScore;
    if (holdQuality < 0.50) holdScore = SCORE.PERFECT;
    else if (holdQuality < 0.80) holdScore = SCORE.GOOD;
    else holdScore = SCORE.OK;

    // Release quality roll (harder - 35% PERFECT, 35% GOOD, 30% OK)
    const releaseQuality = Math.random();
    let releaseScore;
    if (releaseQuality < 0.35) releaseScore = SCORE.PERFECT;
    else if (releaseQuality < 0.70) releaseScore = SCORE.GOOD;
    else releaseScore = SCORE.OK;

    // Apply weighted scoring (same as player: 40% press, 30% hold, 30% release)
    const totalScore = Math.floor(
        pressScore * HOLD_SCORING.PRESS_WEIGHT +
        holdScore * HOLD_SCORING.HOLD_WEIGHT +
        releaseScore * HOLD_SCORING.RELEASE_WEIGHT
    );

    state.aiScore += totalScore;
    elements.aiScore.textContent = state.aiScore;

    // AI score popup
    if (totalScore > 0 && elements.aiScorePopupContainer) {
        const popup = document.createElement('div');
        popup.className = 'ai-score-popup';
        popup.textContent = `+${totalScore}`;
        elements.aiScorePopupContainer.appendChild(popup);
        setTimeout(() => popup.remove(), UI_TIMINGS.AI_SCORE_POPUP_MS);
    }
}

// ============================================
// AI Trash Talk System
// ============================================

/**
 * Show a trash talk message from the specified category
 * @param {string} category - Message category from TRASH_TALK.MESSAGES
 * @param {boolean} force - If true, bypass interval check
 */
export function showTrashTalk(category, force = false) {
    // Check if trash talk is enabled
    if (!state.settings?.trashTalkEnabled) return;

    const now = performance.now();
    const { trashTalk } = state;

    // Check minimum interval (unless forced)
    if (!force && trashTalk.lastMessageTime > 0) {
        const elapsed = now - trashTalk.lastMessageTime;
        if (elapsed < TRASH_TALK.MIN_INTERVAL) return;
    }

    // Get personality-specific frequency multiplier
    let frequencyMult = 1.0;
    if (state.aiPersonality) {
        const personalityId = state.aiPersonality.id;
        const personalityConfig = TRASH_TALK_PERSONALITIES[personalityId];
        if (personalityConfig) {
            frequencyMult = personalityConfig.frequency;

            // Check if this category is preferred for this personality
            if (!personalityConfig.categories.includes(category)) {
                frequencyMult *= 0.5; // Less likely for non-preferred categories
            }
        }
    }

    // Random chance based on frequency (50% base chance, modified by personality)
    if (!force && Math.random() > 0.5 * frequencyMult) return;

    // Get messages for category
    const messages = TRASH_TALK.MESSAGES[category];
    if (!messages || messages.length === 0) return;

    // Pick random message
    const message = messages[Math.floor(Math.random() * messages.length)];

    // Display the message
    displayTrashTalkMessage(message);
    trashTalk.lastMessageTime = now;
}

/**
 * Display a trash talk message in the UI
 * @param {string} message - The message text to display
 */
function displayTrashTalkMessage(message) {
    const container = elements.aiTrashTalk;
    const textEl = elements.trashTalkText;
    const bubble = elements.trashTalkBubble;

    if (!container || !textEl || !bubble) return;

    // Announce to screen readers
    announce(`Rival says: ${message}`);

    // Clear any existing hide timeout
    if (state.trashTalk.hideTimeoutId) {
        clearTimeout(state.trashTalk.hideTimeoutId);
    }

    // Apply rival club colors
    let primaryColor = '#cc0000';  // Default red
    let secondaryColor = '#990000';

    // Get rival club colors (state.rivalClub is the club object itself)
    if (state.rivalClub && state.rivalClub.colors) {
        primaryColor = state.rivalClub.colors.primary;
        secondaryColor = state.rivalClub.colors.secondary;
    }

    // Apply colors via CSS custom properties
    container.style.setProperty('--rival-color', primaryColor);
    container.style.setProperty('--rival-secondary', secondaryColor);

    // Determine text color based on background brightness
    const textColor = isColorLight(primaryColor) ? '#1a1a1a' : '#ffffff';
    bubble.style.color = textColor;

    // Reset classes and show
    container.className = '';
    textEl.textContent = message;
    container.classList.remove('hidden', 'hiding');
    state.trashTalk.messageVisible = true;

    // Auto-hide after duration
    state.trashTalk.hideTimeoutId = setTimeout(() => {
        hideTrashTalk();
    }, TRASH_TALK.DISPLAY_DURATION);
}

/**
 * Check if a hex color is light (for text contrast)
 * @param {string} hex - Hex color string
 * @returns {boolean} True if color is light
 */
function isColorLight(hex) {
    const c = hex.replace('#', '');
    const r = parseInt(c.substr(0, 2), 16);
    const g = parseInt(c.substr(2, 2), 16);
    const b = parseInt(c.substr(4, 2), 16);
    // Using relative luminance formula
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5;
}

/**
 * Hide the trash talk message with animation
 */
export function hideTrashTalk() {
    const container = elements.aiTrashTalk;
    if (!container) return;

    container.classList.add('hiding');

    // Actually hide after animation
    setTimeout(() => {
        container.classList.add('hidden');
        container.classList.remove('hiding');
        state.trashTalk.messageVisible = false;
    }, UI_TIMINGS.TRASH_TALK_HIDE_MS);
}

/**
 * Trigger trash talk based on game events
 * Called from various places in the game logic
 * @param {string} event - Event type: 'playerMiss', 'comboBreak', 'aiPerfect', 'aiCombo', 'gameStart', etc.
 * @param {Object} context - Additional context (e.g., combo count, score diff)
 */
export function triggerTrashTalk(event, context = {}) {
    if (!state.settings?.trashTalkEnabled) return;

    const { trashTalk } = state;
    const scoreDiff = state.aiScore - state.playerScore;
    const totalBeats = state.detectedBeats.length;
    const progress = totalBeats > 0 ? state.nextBeatIndex / totalBeats : 0;

    switch (event) {
        case 'playerMiss':
            trashTalk.consecutiveMisses++;
            if (trashTalk.consecutiveMisses >= TRASH_TALK.MISS_STREAK_THRESHOLD) {
                showTrashTalk('missStreak');
            } else {
                showTrashTalk('playerMiss');
            }
            break;

        case 'comboBreak':
            if (context.brokenCombo >= 10) {
                showTrashTalk('comboBreak', true); // Force show for big combo breaks
            }
            break;

        case 'aiPerfect':
            showTrashTalk('aiPerfect');
            break;

        case 'aiCombo':
            if (context.aiCombo >= 10) {
                showTrashTalk('aiCombo');
            }
            break;

        case 'gameStart':
            showTrashTalk('gameStart', true);
            break;

        case 'scoreCheck':
            // Periodic check during gameplay
            if (scoreDiff > AI_THRESHOLDS.TRASH_TALK_WINNING_LEAD) {
                showTrashTalk('winning');
            } else if (scoreDiff < -AI_THRESHOLDS.TRASH_TALK_LOSING_DEFICIT) {
                showTrashTalk('losing');
            }
            break;

        case 'nearEnd':
            // Near end of song (last 20%)
            if (progress >= 0.8) {
                if (scoreDiff > 300) {
                    showTrashTalk('nearEndWinning');
                } else if (scoreDiff < -300) {
                    showTrashTalk('nearEndLosing');
                }
            }
            break;

        case 'aiGoal':
            showTrashTalk('aiGoal', true);
            break;

        case 'playerGoal':
            showTrashTalk('playerGoal');
            break;

        case 'playerHit':
            // Reset consecutive misses on successful hit
            trashTalk.consecutiveMisses = 0;
            break;
    }
}
