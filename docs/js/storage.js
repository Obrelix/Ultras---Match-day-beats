// ============================================
// storage.js — localStorage persistence layer
// ============================================

import { createLogger } from './config.js';

const log = createLogger('Storage');
const STORAGE_KEY = 'ultras_matchday_beats';

function getStore() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch (e) {
        log.warn('Failed to read from localStorage', e.message);
        return {};
    }
}

function setStore(data) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
        log.warn('Failed to write to localStorage', e.message);
    }
}

export function loadSettings() {
    const defaults = {
        volume: 1.0,
        sfxVolume: 0.5,
        difficulty: 'normal',
        reducedEffects: false,
        tutorialSeen: false,
        metronomeEnabled: false,
        inputOffset: 0,       // Calibration offset in ms (positive = player taps late)
        trashTalkEnabled: true // AI trash talk feature
    };
    const store = getStore();
    // Merge stored settings with defaults to handle missing properties from older versions
    return store.settings ? { ...defaults, ...store.settings } : defaults;
}

export function saveSettings(settings) {
    const store = getStore();
    store.settings = settings;
    setStore(store);
}

export function loadHighScore(clubId, chantId) {
    const store = getStore();
    const key = `${clubId}_${chantId}`;
    return (store.highScores && store.highScores[key]) || 0;
}

export function saveHighScore(clubId, chantId, score) {
    const store = getStore();
    if (!store.highScores) store.highScores = {};
    const key = `${clubId}_${chantId}`;
    if (score > (store.highScores[key] || 0)) {
        store.highScores[key] = score;
        setStore(store);
    }
}

export function loadMatchdayStats() {
    const store = getStore();
    return store.matchdayStats || { played: 0, won: 0, drawn: 0, lost: 0 };
}

export function saveMatchdayStats(stats) {
    const store = getStore();
    store.matchdayStats = stats;
    setStore(store);
}

export function hasTutorialSeen() {
    return loadSettings().tutorialSeen;
}

export function markTutorialSeen() {
    const settings = loadSettings();
    settings.tutorialSeen = true;
    saveSettings(settings);
}

// ============================================
// Player Profile (for leaderboards)
// ============================================

export function loadPlayerProfile() {
    const store = getStore();
    return store.playerProfile || null;
}

export function savePlayerProfile(profile) {
    const store = getStore();
    store.playerProfile = profile;
    setStore(store);
}

// ============================================
// Offline Queue (pending leaderboard submissions)
// ============================================

export function loadOfflineQueue() {
    const store = getStore();
    return store.offlineQueue || [];
}

export function saveOfflineQueue(queue) {
    const store = getStore();
    store.offlineQueue = queue;
    setStore(store);
}

// ============================================
// Leaderboard Cache
// ============================================

export function loadLeaderboardCache() {
    const store = getStore();
    return store.leaderboardCache || {};
}

export function saveLeaderboardCache(cache) {
    const store = getStore();
    store.leaderboardCache = cache;
    setStore(store);
}

// ============================================
// Game History (for Analytics Dashboard)
// ============================================

const MAX_HISTORY_ENTRIES = 100;

/**
 * Load game history array
 * @returns {Array} Array of game records, newest first
 */
export function loadGameHistory() {
    const store = getStore();
    return store.gameHistory || [];
}

/**
 * Save a game record to history
 * Automatically prunes oldest entries if over limit
 * @param {Object} record - Game record object
 */
export function saveGameRecord(record) {
    const store = getStore();
    if (!store.gameHistory) {
        store.gameHistory = [];
    }

    // Add unique ID and timestamp if not present
    if (!record.id) {
        record.id = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    }
    if (!record.timestamp) {
        record.timestamp = Date.now();
    }

    // Add to beginning (newest first)
    store.gameHistory.unshift(record);

    // Prune if over limit
    if (store.gameHistory.length > MAX_HISTORY_ENTRIES) {
        store.gameHistory = store.gameHistory.slice(0, MAX_HISTORY_ENTRIES);
    }

    setStore(store);
}

/**
 * Clear all game history
 */
export function clearGameHistory() {
    const store = getStore();
    store.gameHistory = [];
    setStore(store);
}

/**
 * Get current session ID (creates new one if expired or none exists)
 * @returns {Object} { sessionId, sessionStartTime, isNew }
 */
export function getOrCreateSession() {
    const store = getStore();
    const now = Date.now();
    const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

    // Check if existing session is still valid
    if (store.currentSession && store.currentSession.startTime) {
        const elapsed = now - store.currentSession.lastActivity;
        if (elapsed < SESSION_TIMEOUT) {
            // Update last activity
            store.currentSession.lastActivity = now;
            setStore(store);
            return {
                sessionId: store.currentSession.id,
                sessionStartTime: store.currentSession.startTime,
                isNew: false
            };
        }
    }

    // Create new session
    const newSession = {
        id: now.toString(36) + Math.random().toString(36).substr(2, 5),
        startTime: now,
        lastActivity: now
    };
    store.currentSession = newSession;
    setStore(store);

    return {
        sessionId: newSession.id,
        sessionStartTime: newSession.startTime,
        isNew: true
    };
}
