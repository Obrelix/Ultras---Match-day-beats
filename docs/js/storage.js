// ============================================
// storage.js — localStorage persistence layer
// ============================================

const STORAGE_KEY = 'ultras_matchday_beats';

function getStore() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch (e) {
        console.warn('Failed to read from localStorage:', e.message);
        return {};
    }
}

function setStore(data) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
        console.warn('Failed to write to localStorage:', e.message);
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
        crowdAudioEnabled: true,
        crowdAudioVolume: 0.3
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
