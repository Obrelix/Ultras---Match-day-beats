// ============================================
// replay.js — Replay recording, playback, and sharing
// ============================================

import { REPLAY } from './config.js';
import { state } from './state.js';

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
            mirror: false
        },
        beats: [],           // Array of beat times from detection
        inputs: [],          // Array of { time: ms, beatIndex: number, result: string, score: number }
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
 * @param {string} result - Hit result: 'perfect', 'good', 'ok', 'miss', 'hold_start'
 * @param {number} score - Score gained from this input
 * @param {string} [type='tap'] - Input type: 'tap' or 'hold'
 * @param {number} [holdDuration=0] - Duration of hold in ms (for hold beats)
 */
export function recordInput(time, beatIndex, result, score, type = 'tap', holdDuration = 0) {
    if (!state.isRecording || !state.replayData) return;

    const input = {
        t: Math.round(time),      // Time in ms (rounded to save space)
        b: beatIndex,             // Beat index
        r: result.charAt(0),      // First char of result (p/g/o/m/h for hold_start)
        s: score                  // Score
    };

    // Add hold-specific data
    if (type === 'hold') {
        input.h = Math.round(holdDuration);  // Hold duration in ms
    }

    state.replayData.inputs.push(input);
}

/**
 * Stops recording and finalizes the replay
 */
export function stopRecording() {
    if (!state.isRecording || !state.replayData) return;

    state.replayData.beats = [...state.detectedBeats];
    state.replayData.duration = performance.now() - state.gameStartTime;
    state.replayData.finalStats = {
        score: state.playerScore,
        perfect: state.playerStats.perfect,
        good: state.playerStats.good,
        ok: state.playerStats.ok,
        miss: state.playerStats.miss,
        maxCombo: state.playerMaxCombo
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
 * Compresses a string using simple RLE-like compression
 * @param {string} str - String to compress
 * @returns {string} Compressed string
 */
function compress(str) {
    if (!REPLAY.COMPRESSION_ENABLED) return str;

    // Use built-in compression if available (modern browsers)
    try {
        const encoder = new TextEncoder();
        const data = encoder.encode(str);

        // Simple delta encoding for the time values to reduce size
        return str;  // For now, just return as-is (compression can be added later)
    } catch (e) {
        return str;
    }
}

/**
 * Decompresses a string
 * @param {string} str - Compressed string
 * @returns {string} Decompressed string
 */
function decompress(str) {
    if (!REPLAY.COMPRESSION_ENABLED) return str;
    return str;  // Match compress for now
}

/**
 * Encodes replay data to a shareable code
 * @param {Object} replayData - Replay data to encode
 * @returns {string} Base64 encoded replay code
 */
export function encodeReplay(replayData) {
    if (!replayData) return null;

    try {
        // Create a minimal version for sharing
        const minimal = {
            v: replayData.version,
            c: replayData.clubId,
            h: replayData.chantId,
            d: replayData.difficulty,
            m: [
                replayData.modifiers.doubleTime ? 1 : 0,
                replayData.modifiers.hidden ? 1 : 0,
                replayData.modifiers.mirror ? 1 : 0
            ],
            i: replayData.inputs,
            s: replayData.finalStats
        };

        const json = JSON.stringify(minimal);
        const compressed = compress(json);

        // Encode to base64
        const base64 = btoa(unescape(encodeURIComponent(compressed)));

        // Add prefix for identification
        return 'UMB1_' + base64;
    } catch (e) {
        console.error('Failed to encode replay:', e);
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
        // Check prefix
        if (!code.startsWith('UMB1_')) {
            console.error('Invalid replay code format');
            return null;
        }

        const base64 = code.slice(5);  // Remove prefix
        const compressed = decodeURIComponent(escape(atob(base64)));
        const json = decompress(compressed);
        const minimal = JSON.parse(json);

        // Validate version
        if (minimal.v !== REPLAY.VERSION) {
            console.warn('Replay version mismatch');
        }

        // Reconstruct full replay data
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
                mirror: minimal.m[2] === 1
            },
            beats: [],  // Will be regenerated from audio
            inputs: minimal.i,
            finalStats: minimal.s,
            duration: 0
        };
    } catch (e) {
        console.error('Failed to decode replay:', e);
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
    if (!code.startsWith('UMB1_')) return false;

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
            score: nextInput.s
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
        case 'h': return 'hold_start';  // Hold beat initiation
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
