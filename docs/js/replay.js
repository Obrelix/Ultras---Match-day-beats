// ============================================
// replay.js — Replay recording, playback, and sharing
// ============================================

import { REPLAY, createLogger } from './config.js';
import { state } from './state.js';

const log = createLogger('Replay');

// ============================================
// Replay Data Structure
// ============================================

/**
 * Creates a new replay data object
 * @returns {Object} Empty replay data structure
 */
export function createReplayData() {
    return {
        version: REPLAY.VERSION,
        timestamp: Date.now(),
        clubId: null,
        chantId: null,
        chantName: null,
        difficulty: null,
        modifiers: {
            doubleTime: false,
            hidden: false,
            mirror: false,
            suddenDeath: false,
            flash: false,
            random: false,
            noFail: false
        },
        beats: [],           // Array of beat times from detection
        inputs: [],          // Array of input events with timing data
        finalStats: null,    // Final game stats
        duration: 0          // Total replay duration in ms
    };
}

// ============================================
// Recording Functions
// ============================================

/**
 * Starts recording a new replay
 */
export function startRecording() {
    state.replayData = createReplayData();
    state.replayData.clubId = state.selectedClub?.id || null;
    state.replayData.chantId = state.selectedChant?.id || null;
    state.replayData.chantName = state.selectedChant?.name || 'Unknown';
    state.replayData.difficulty = state.settings.difficulty;
    state.replayData.modifiers = { ...state.activeModifiers };
    state.isRecording = true;
    state.isReplaying = false;
}

/**
 * Records an input event during gameplay
 * @param {number} time - Timestamp relative to game start (ms)
 * @param {number} beatIndex - Index of the beat that was hit (-1 for miss with no beat)
 * @param {string} result - Hit result: 'perfect', 'good', 'ok', 'miss', 'hold_start', 'shielded'
 * @param {number} score - Score gained from this input
 * @param {string} [type='tap'] - Input type: 'tap' or 'hold'
 * @param {number} [holdDuration=0] - Duration of hold in ms (for hold beats)
 */
export function recordInput(time, beatIndex, result, score, type = 'tap', holdDuration = 0) {
    if (!state.isRecording || !state.replayData) return;

    // Calculate timing deviation from perfect if we have a beat index
    let deviation = 0;
    if (beatIndex >= 0 && beatIndex < state.detectedBeats.length) {
        const beat = state.detectedBeats[beatIndex];
        const beatTime = typeof beat === 'object' ? beat.time * 1000 : beat * 1000;
        deviation = Math.round(time - beatTime);
    }

    const input = {
        t: Math.round(time),      // Time in ms (rounded to save space)
        b: beatIndex,             // Beat index
        r: compressResult(result), // Compressed result code
        s: score,                 // Score
        d: deviation              // Timing deviation from beat (ms, negative = early, positive = late)
    };

    // Add hold-specific data
    if (type === 'hold') {
        input.h = Math.round(holdDuration);  // Hold duration in ms
    }

    state.replayData.inputs.push(input);
}

/**
 * Compresses result string to single character
 * @param {string} result - Full result string
 * @returns {string} Single character code
 */
function compressResult(result) {
    const resultStr = result.toLowerCase();
    switch (resultStr) {
        case 'perfect': return 'p';
        case 'good': return 'g';
        case 'ok': return 'o';
        case 'miss': return 'm';
        case 'hold_start': return 'h';
        case 'shielded': return 's';
        default: return resultStr.charAt(0);
    }
}

/**
 * Stops recording and finalizes the replay
 */
export function stopRecording() {
    if (!state.isRecording || !state.replayData) return;

    state.replayData.beats = [...state.detectedBeats];
    state.replayData.duration = performance.now() - state.gameStartTime;

    // Calculate accuracy percentage
    const totalHits = state.playerStats.perfect + state.playerStats.good + state.playerStats.ok + state.playerStats.miss;
    const successfulHits = state.playerStats.perfect + state.playerStats.good + state.playerStats.ok;
    const accuracy = totalHits > 0 ? Math.round((successfulHits / totalHits) * 100) : 0;

    state.replayData.finalStats = {
        score: state.playerScore,
        perfect: state.playerStats.perfect,
        good: state.playerStats.good,
        ok: state.playerStats.ok,
        miss: state.playerStats.miss,
        maxCombo: state.playerMaxCombo,
        maxPerfectStreak: state.maxPerfectStreak,
        accuracy: accuracy,
        aiScore: state.aiScore,
        totalBeats: state.totalBeats
    };

    state.isRecording = false;
}

/**
 * Gets the current replay data
 * @returns {Object|null} Current replay data or null
 */
export function getReplayData() {
    return state.replayData;
}

// ============================================
// Encoding/Decoding Functions
// ============================================

/**
 * Compresses inputs using delta encoding for timestamps
 * @param {Array} inputs - Array of input objects
 * @returns {Array} Compressed inputs with delta times
 */
function compressInputs(inputs) {
    if (!inputs || inputs.length === 0) return [];

    const compressed = [];
    let lastTime = 0;

    for (const input of inputs) {
        const deltaTime = input.t - lastTime;
        lastTime = input.t;

        // Create compressed input with delta time
        const comp = {
            dt: deltaTime,  // Delta time instead of absolute
            b: input.b,
            r: input.r,
            s: input.s
        };

        // Only include deviation if non-zero
        if (input.d && input.d !== 0) {
            comp.d = input.d;
        }

        // Include hold duration if present
        if (input.h !== undefined) {
            comp.h = input.h;
        }

        compressed.push(comp);
    }

    return compressed;
}

/**
 * Decompresses inputs from delta encoding
 * @param {Array} compressed - Compressed inputs with delta times
 * @returns {Array} Decompressed inputs with absolute times
 */
function decompressInputs(compressed) {
    if (!compressed || compressed.length === 0) return [];

    const inputs = [];
    let currentTime = 0;

    for (const comp of compressed) {
        currentTime += comp.dt || comp.t || 0;  // Handle both delta and absolute times

        const input = {
            t: currentTime,
            b: comp.b,
            r: comp.r,
            s: comp.s
        };

        if (comp.d !== undefined) {
            input.d = comp.d;
        }

        if (comp.h !== undefined) {
            input.h = comp.h;
        }

        inputs.push(input);
    }

    return inputs;
}

/**
 * Encodes replay data to a shareable code
 * @param {Object} replayData - Replay data to encode
 * @returns {string} Base64 encoded replay code
 */
export function encodeReplay(replayData) {
    if (!replayData) return null;

    try {
        // Create a minimal version for sharing with compressed inputs
        const minimal = {
            v: replayData.version,
            c: replayData.clubId,
            h: replayData.chantId,
            d: replayData.difficulty,
            m: [
                replayData.modifiers.doubleTime ? 1 : 0,
                replayData.modifiers.hidden ? 1 : 0,
                replayData.modifiers.mirror ? 1 : 0,
                replayData.modifiers.suddenDeath ? 1 : 0,
                replayData.modifiers.flash ? 1 : 0,
                replayData.modifiers.random ? 1 : 0,
                replayData.modifiers.noFail ? 1 : 0
            ],
            i: compressInputs(replayData.inputs),
            s: replayData.finalStats
        };

        const json = JSON.stringify(minimal);

        // Encode to base64
        const base64 = btoa(unescape(encodeURIComponent(json)));

        // Add prefix for identification (version 3 with 7 modifiers)
        return 'UMB3_' + base64;
    } catch (e) {
        log.error('Failed to encode replay', e);
        return null;
    }
}

/**
 * Decodes a replay code back to replay data
 * @param {string} code - Base64 encoded replay code
 * @returns {Object|null} Decoded replay data or null if invalid
 */
export function decodeReplay(code) {
    if (!code || typeof code !== 'string') return null;

    try {
        // Check prefix (support all format versions)
        let base64, useCompression = false, hasExtendedModifiers = false;
        if (code.startsWith('UMB3_')) {
            base64 = code.slice(5);
            useCompression = true;
            hasExtendedModifiers = true;
        } else if (code.startsWith('UMB2_')) {
            base64 = code.slice(5);
            useCompression = true;
            hasExtendedModifiers = false;
        } else if (code.startsWith('UMB1_')) {
            base64 = code.slice(5);
            useCompression = false;
            hasExtendedModifiers = false;
        } else {
            log.error('Invalid replay code format');
            return null;
        }

        const json = decodeURIComponent(escape(atob(base64)));
        const minimal = JSON.parse(json);

        // Validate version
        if (minimal.v !== REPLAY.VERSION) {
            log.warn('Replay version mismatch - playback may not be accurate');
        }

        // Decompress inputs if needed
        const inputs = useCompression ? decompressInputs(minimal.i) : minimal.i;

        // Reconstruct full replay data with all modifiers
        // For older replays, extended modifiers default to false
        return {
            version: minimal.v,
            timestamp: Date.now(),
            clubId: minimal.c,
            chantId: minimal.h,
            chantName: null,  // Will be filled in from club data
            difficulty: minimal.d,
            modifiers: {
                doubleTime: minimal.m[0] === 1,
                hidden: minimal.m[1] === 1,
                mirror: minimal.m[2] === 1,
                suddenDeath: hasExtendedModifiers && minimal.m[3] === 1,
                flash: hasExtendedModifiers && minimal.m[4] === 1,
                random: hasExtendedModifiers && minimal.m[5] === 1,
                noFail: hasExtendedModifiers && minimal.m[6] === 1
            },
            beats: [],  // Will be regenerated from audio
            inputs: inputs,
            finalStats: minimal.s,
            duration: 0
        };
    } catch (e) {
        log.error('Failed to decode replay', e);
        return null;
    }
}

/**
 * Validates a replay code
 * @param {string} code - Replay code to validate
 * @returns {boolean} Whether the code is valid
 */
export function validateReplayCode(code) {
    if (!code || typeof code !== 'string') return false;
    if (code.length > REPLAY.MAX_CODE_LENGTH) return false;
    if (!code.startsWith('UMB1_') && !code.startsWith('UMB2_') && !code.startsWith('UMB3_')) return false;

    // Try to decode it
    const decoded = decodeReplay(code);
    return decoded !== null;
}

// ============================================
// Playback Functions
// ============================================

/**
 * Prepares replay for playback
 * @param {Object} replayData - Replay data to play
 */
export function preparePlayback(replayData) {
    state.replayData = replayData;
    state.isReplaying = true;
    state.isRecording = false;
    state.replayInputIndex = 0;
}

/**
 * Gets the next input event for playback
 * @param {number} currentTime - Current game time in ms
 * @returns {Object|null} Next input event or null if none available
 */
export function getNextReplayInput(currentTime) {
    if (!state.isReplaying || !state.replayData) return null;

    const inputs = state.replayData.inputs;
    if (state.replayInputIndex >= inputs.length) return null;

    const nextInput = inputs[state.replayInputIndex];
    if (nextInput.t <= currentTime) {
        state.replayInputIndex++;
        const result = {
            time: nextInput.t,
            beatIndex: nextInput.b,
            result: expandResult(nextInput.r),
            score: nextInput.s,
            deviation: nextInput.d || 0
        };

        // Include hold-specific data if present
        if (nextInput.h !== undefined) {
            result.type = 'hold';
            result.holdDuration = nextInput.h;
        } else {
            result.type = 'tap';
        }

        return result;
    }

    return null;
}

/**
 * Gets all inputs for a specific beat
 * @param {number} beatIndex - Beat index to find inputs for
 * @returns {Array} Array of inputs for this beat
 */
export function getInputsForBeat(beatIndex) {
    if (!state.replayData || !state.replayData.inputs) return [];

    return state.replayData.inputs
        .filter(input => input.b === beatIndex)
        .map(input => ({
            time: input.t,
            result: expandResult(input.r),
            score: input.s,
            deviation: input.d || 0
        }));
}

/**
 * Expands single-char result back to full string
 * @param {string} char - Single character result
 * @returns {string} Full result string
 */
function expandResult(char) {
    switch (char) {
        case 'p': return 'perfect';
        case 'g': return 'good';
        case 'o': return 'ok';
        case 'm': return 'miss';
        case 'h': return 'hold_start';
        case 's': return 'shielded';
        default: return 'miss';
    }
}

/**
 * Checks if there are more inputs to play
 * @returns {boolean} Whether replay has finished
 */
export function isReplayFinished() {
    if (!state.isReplaying || !state.replayData) return true;
    return state.replayInputIndex >= state.replayData.inputs.length;
}

/**
 * Stops replay playback
 */
export function stopPlayback() {
    state.isReplaying = false;
    state.replayInputIndex = 0;
}

/**
 * Seeks to a specific time in the replay
 * @param {number} targetTime - Time to seek to (ms)
 */
export function seekToTime(targetTime) {
    if (!state.replayData || !state.replayData.inputs) return;

    // Find the index of the first input after targetTime
    let newIndex = 0;
    for (let i = 0; i < state.replayData.inputs.length; i++) {
        if (state.replayData.inputs[i].t > targetTime) {
            break;
        }
        newIndex = i + 1;
    }

    state.replayInputIndex = newIndex;
}

/**
 * Gets replay progress info
 * @returns {Object} Progress info with current index and total inputs
 */
export function getReplayProgress() {
    if (!state.replayData) return { current: 0, total: 0, percentage: 0 };

    const total = state.replayData.inputs.length;
    const current = state.replayInputIndex;
    const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

    return { current, total, percentage };
}

// ============================================
// Utility Functions
// ============================================

/**
 * Formats replay stats for display
 * @param {Object} stats - Final stats from replay
 * @returns {string} Formatted stats string
 */
export function formatReplayStats(stats) {
    if (!stats) return 'No stats available';

    return `Score: ${stats.score} | Perfect: ${stats.perfect} | Good: ${stats.good} | OK: ${stats.ok} | Miss: ${stats.miss} | Max Combo: ${stats.maxCombo}`;
}

/**
 * Gets replay duration formatted as MM:SS
 * @param {number} durationMs - Duration in milliseconds
 * @returns {string} Formatted duration
 */
export function formatReplayDuration(durationMs) {
    const totalSeconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Calculates timing accuracy statistics from replay
 * @returns {Object} Timing stats including avg deviation, early/late counts
 */
export function getTimingStats() {
    if (!state.replayData || !state.replayData.inputs) {
        return { avgDeviation: 0, earlyCount: 0, lateCount: 0, perfectTimingCount: 0 };
    }

    const inputs = state.replayData.inputs.filter(i => i.b >= 0 && i.r !== 'm');
    if (inputs.length === 0) {
        return { avgDeviation: 0, earlyCount: 0, lateCount: 0, perfectTimingCount: 0 };
    }

    let totalDeviation = 0;
    let earlyCount = 0;
    let lateCount = 0;
    let perfectTimingCount = 0;

    for (const input of inputs) {
        const dev = input.d || 0;
        totalDeviation += Math.abs(dev);

        if (dev < -50) earlyCount++;
        else if (dev > 50) lateCount++;
        else perfectTimingCount++;
    }

    return {
        avgDeviation: Math.round(totalDeviation / inputs.length),
        earlyCount,
        lateCount,
        perfectTimingCount
    };
}
