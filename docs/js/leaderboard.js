// ============================================
// leaderboard.js — Firebase leaderboard service
// ============================================

import { LEADERBOARD, createLogger } from './config.js';

const log = createLogger('Leaderboard');
import {
    loadPlayerProfile, savePlayerProfile,
    loadOfflineQueue, saveOfflineQueue,
    loadLeaderboardCache, saveLeaderboardCache
} from './storage.js';

let firebaseApp = null;
let firebaseDb = null;
let firebaseAuth = null;
let isInitialized = false;
let lastSubmitTime = 0;
let permissionDenied = false; // Track if we've hit permission errors

// ============================================
// Firebase Initialization
// ============================================

export async function initLeaderboard() {
    if (!LEADERBOARD.ENABLED) return false;
    if (isInitialized) return true;

    // Check if Firebase config is placeholder
    if (LEADERBOARD.FIREBASE.apiKey === 'YOUR_API_KEY') {
        log.warn('Firebase not configured - using offline mode');
        return false;
    }

    try {
        // Dynamically import Firebase SDK from CDN
        const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
        const { getDatabase, ref, push, get, query, orderByChild, limitToLast } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js');
        const { getAuth, signInAnonymously } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');

        // Initialize Firebase
        firebaseApp = initializeApp(LEADERBOARD.FIREBASE);
        firebaseDb = getDatabase(firebaseApp);
        firebaseAuth = getAuth(firebaseApp);

        // Store module references for later use
        window._firebaseRefs = { ref, push, get, query, orderByChild, limitToLast };

        // Sign in anonymously
        await signInAnonymously(firebaseAuth);

        isInitialized = true;

        // Flush offline queue
        await flushOfflineQueue();

        return true;
    } catch (error) {
        // Handle common auth errors gracefully
        if (error.code === 'auth/requests-from-referer-are-blocked' ||
            (error.message && error.message.includes('requests-from-referer'))) {
            log.warn('Domain not authorized in Firebase - add this domain to Firebase Auth settings');
        } else {
            log.error('Failed to initialize Firebase', error);
        }
        return false;
    }
}

// ============================================
// Player Profile Management
// ============================================

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

export function getPlayerProfile() {
    let profile = loadPlayerProfile();
    if (!profile) {
        profile = {
            playerId: generateUUID(),
            playerName: null
        };
        savePlayerProfile(profile);
    }
    return profile;
}

export function setPlayerName(name) {
    const trimmed = name.trim();
    if (trimmed.length < LEADERBOARD.NAME_MIN_LENGTH || trimmed.length > LEADERBOARD.NAME_MAX_LENGTH) {
        return false;
    }
    const profile = getPlayerProfile();
    profile.playerName = trimmed;
    savePlayerProfile(profile);
    return true;
}

export function hasPlayerName() {
    const profile = getPlayerProfile();
    return profile.playerName && profile.playerName.length >= LEADERBOARD.NAME_MIN_LENGTH;
}

// ============================================
// Score Submission
// ============================================

export async function submitScore(scoreData) {
    if (!LEADERBOARD.ENABLED) return { success: false, reason: 'disabled' };

    const profile = getPlayerProfile();
    if (!hasPlayerName()) {
        return { success: false, reason: 'no_name', needsName: true };
    }

    // Rate limiting
    const now = Date.now();
    if (now - lastSubmitTime < LEADERBOARD.MIN_SUBMIT_INTERVAL) {
        return { success: false, reason: 'rate_limited' };
    }

    // Entry format matches Firebase rules: name, score, timestamp required
    // clubId/chantId/difficulty kept for offline queue path reconstruction
    const entry = {
        playerId: profile.playerId,
        name: profile.playerName,  // 'name' to match Firebase rules
        score: scoreData.score,
        maxCombo: scoreData.maxCombo,
        accuracy: scoreData.accuracy,
        timestamp: now,
        // Metadata for offline queue (not validated by Firebase rules)
        clubId: scoreData.clubId,
        chantId: scoreData.chantId,
        difficulty: scoreData.difficulty
    };

    if (!isInitialized || !navigator.onLine || permissionDenied) {
        // Queue for later (or if permissions are blocked)
        queueOfflineSubmission(entry);
        return { success: true, offline: true };
    }

    try {
        const { ref, push } = window._firebaseRefs;
        const chantKey = `${scoreData.clubId}_${scoreData.chantId}_${scoreData.difficulty}`;
        const scoresRef = ref(firebaseDb, `leaderboards/${chantKey}`);
        await push(scoresRef, entry);
        lastSubmitTime = now;

        // Invalidate cache for this leaderboard
        invalidateCache(scoreData.clubId, scoreData.chantId, scoreData.difficulty);

        return { success: true };
    } catch (error) {
        // Check for permission denied
        if (error.message && error.message.includes('PERMISSION_DENIED')) {
            log.warn('Database write permission denied - check Firebase rules');
            permissionDenied = true;
        } else {
            log.error('Failed to submit score', error);
        }
        queueOfflineSubmission(entry);
        return { success: true, offline: true };
    }
}

// ============================================
// Leaderboard Fetching
// ============================================

export async function fetchLeaderboard(clubId, chantId, difficulty) {
    if (!LEADERBOARD.ENABLED) return { entries: [], fromCache: false };

    const cacheKey = `${clubId}_${chantId}_${difficulty}`;
    const cache = loadLeaderboardCache();

    // Check cache validity
    if (cache[cacheKey] && Date.now() - cache[cacheKey].timestamp < LEADERBOARD.CACHE_TTL) {
        return { entries: cache[cacheKey].entries, fromCache: true };
    }

    if (!isInitialized || !navigator.onLine) {
        // Return cached data if available, otherwise empty
        if (cache[cacheKey]) {
            return { entries: cache[cacheKey].entries, fromCache: true, stale: true };
        }
        return { entries: [], fromCache: false, offline: true };
    }

    try {
        const { ref, get, query, orderByChild, limitToLast } = window._firebaseRefs;
        const chantKey = `${clubId}_${chantId}_${difficulty}`;
        const scoresRef = ref(firebaseDb, `leaderboards/${chantKey}`);
        const topScoresQuery = query(scoresRef, orderByChild('score'), limitToLast(100));

        const snapshot = await get(topScoresQuery);

        if (!snapshot.exists()) {
            return { entries: [], fromCache: false };
        }

        // Convert to array and sort by score descending
        const scores = [];
        snapshot.forEach(child => {
            scores.push({ id: child.key, ...child.val() });
        });

        scores.sort((a, b) => b.score - a.score);

        // Get unique top entries per player (best score only)
        const seenPlayers = new Set();
        const uniqueEntries = [];
        for (const score of scores) {
            if (!seenPlayers.has(score.playerId)) {
                seenPlayers.add(score.playerId);
                uniqueEntries.push(score);
                if (uniqueEntries.length >= LEADERBOARD.TOP_ENTRIES) break;
            }
        }

        // Add rank numbers and check current player
        const profile = getPlayerProfile();
        const entries = uniqueEntries.map((entry, index) => ({
            rank: index + 1,
            playerName: entry.name,  // 'name' in DB, 'playerName' for UI
            score: entry.score,
            maxCombo: entry.maxCombo,
            isCurrentPlayer: entry.playerId === profile.playerId
        }));

        // Update cache
        cache[cacheKey] = { entries, timestamp: Date.now() };
        saveLeaderboardCache(cache);

        return { entries, fromCache: false };
    } catch (error) {
        log.error('Failed to fetch leaderboard', error);
        if (cache[cacheKey]) {
            return { entries: cache[cacheKey].entries, fromCache: true, stale: true };
        }
        return { entries: [], fromCache: false, error: true };
    }
}

export async function getPlayerRank(clubId, chantId, difficulty, playerScore) {
    const result = await fetchLeaderboard(clubId, chantId, difficulty);
    if (!result.entries.length) return null;

    const profile = getPlayerProfile();

    // Find current player's entry
    const playerEntry = result.entries.find(e => e.isCurrentPlayer);
    if (playerEntry) {
        return playerEntry.rank;
    }

    // Estimate rank based on score
    let rank = 1;
    for (const entry of result.entries) {
        if (playerScore < entry.score) rank++;
    }

    return rank > LEADERBOARD.TOP_ENTRIES ? `${LEADERBOARD.TOP_ENTRIES}+` : rank;
}

// ============================================
// Offline Queue Management
// ============================================

function queueOfflineSubmission(entry) {
    const queue = loadOfflineQueue();

    // Limit queue size
    if (queue.length >= LEADERBOARD.OFFLINE_QUEUE_MAX) {
        queue.shift(); // Remove oldest
    }

    queue.push(entry);
    saveOfflineQueue(queue);
}

async function flushOfflineQueue() {
    if (!isInitialized || !navigator.onLine || permissionDenied) return;

    const queue = loadOfflineQueue();
    if (!queue.length) return;

    const { ref, push } = window._firebaseRefs;
    const remaining = [];

    for (const entry of queue) {
        try {
            const chantKey = `${entry.clubId}_${entry.chantId}_${entry.difficulty}`;
            const scoresRef = ref(firebaseDb, `leaderboards/${chantKey}`);
            await push(scoresRef, entry);
            invalidateCache(entry.clubId, entry.chantId, entry.difficulty);
        } catch (error) {
            // Check for permission denied - stop retrying if database rules block writes
            if (error.message && error.message.includes('PERMISSION_DENIED')) {
                log.warn('Database write permission denied - check Firebase rules');
                permissionDenied = true;
                // Keep entries in queue for when permissions are fixed
                saveOfflineQueue(queue);
                return;
            }
            log.error('Failed to flush offline queue entry', error);
            remaining.push(entry);
        }
    }

    saveOfflineQueue(remaining);
}

// ============================================
// Cache Management
// ============================================

function invalidateCache(clubId, chantId, difficulty) {
    const cacheKey = `${clubId}_${chantId}_${difficulty}`;
    const cache = loadLeaderboardCache();
    delete cache[cacheKey];
    saveLeaderboardCache(cache);
}

// ============================================
// Connection Status
// ============================================

export function isOnline() {
    return navigator.onLine && isInitialized;
}

// Listen for online status changes to flush queue
if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
        if (isInitialized) {
            flushOfflineQueue();
        }
    });
}
