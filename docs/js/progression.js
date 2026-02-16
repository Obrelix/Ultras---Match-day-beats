// ============================================
// progression.js — XP, Leveling, Achievements, Challenges, Loyalty
// ============================================

import {
    XP_CONFIG, LEVEL_UNLOCKS, ACHIEVEMENTS,
    CHALLENGE_TYPES, WEEKLY_CHALLENGES, SEASON_CHALLENGES,
    LOYALTY_CONFIG, clubs
} from './config.js';
import { state } from './state.js';

// ============================================
// Storage Keys
// ============================================

const STORAGE_KEY = 'ultras_progression';

// ============================================
// Default Progression Data
// ============================================

function getDefaultProgressionData() {
    return {
        // XP & Leveling
        totalXP: 0,
        level: 1,
        unlockedCosmetics: ['basic'],  // Start with basic scarf

        // Achievements
        achievements: {},  // { achievementId: { unlocked: bool, unlockedAt: timestamp, progress: number } }

        // Stats for achievement tracking
        stats: {
            totalWins: 0,
            totalMatchdayWins: 0,
            totalMatchdayDraws: 0,
            totalMatchdayLosses: 0,
            totalChantsPlayed: 0,
            totalPerfectHits: 0,
            totalComboAccumulated: 0,
            highestCombo: 0,
            highestScore: 0,
            clubsBeaten: [],  // Array of club IDs beaten in matchday
            feverTimeAccumulated: 0,  // Seconds in fever mode
            comebackWins: 0
        },

        // Weekly Challenges
        weeklyChallenge: null,  // { ...challenge, progress: number, startedAt: timestamp }
        lastWeeklyReset: 0,

        // Season Challenges
        seasonChallenges: {},  // { challengeIndex: { progress: number, completed: bool } }
        seasonStartDate: null,

        // Club Loyalty
        clubGames: {},  // { clubId: numberOfGames }
        loyaltyBadges: {},  // { clubId: ['loyal_fan', 'fanatic', etc.] }

        // Notification queue (achievements to show)
        pendingNotifications: []
    };
}

// ============================================
// Load/Save Progression
// ============================================

let _progressionData = null;

export function loadProgression() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            _progressionData = { ...getDefaultProgressionData(), ...JSON.parse(saved) };
        } else {
            _progressionData = getDefaultProgressionData();
        }

        // Initialize achievements if not present
        for (const [id, achievement] of Object.entries(ACHIEVEMENTS)) {
            if (!_progressionData.achievements[id]) {
                _progressionData.achievements[id] = {
                    unlocked: false,
                    unlockedAt: null,
                    progress: 0
                };
            }
        }

        // Check if weekly challenge needs reset (every Monday)
        checkWeeklyReset();

        // Initialize season if needed
        if (!_progressionData.seasonStartDate) {
            _progressionData.seasonStartDate = getSeasonStartDate();
            initializeSeasonChallenges();
        }

    } catch (e) {
        console.warn('Failed to load progression data:', e);
        _progressionData = getDefaultProgressionData();
    }

    return _progressionData;
}

export function saveProgression() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(_progressionData));
    } catch (e) {
        console.warn('Failed to save progression data:', e);
    }
}

export function getProgression() {
    if (!_progressionData) {
        loadProgression();
    }
    return _progressionData;
}

// ============================================
// XP & Leveling
// ============================================

/**
 * Calculate XP earned from a game result
 */
export function calculateXP(gameResult) {
    const { score, maxCombo, perfectHits, won, isMatchday, matchdayResult } = gameResult;

    let xp = 0;

    // Base XP from score
    xp += Math.floor(score / XP_CONFIG.SCORE_DIVISOR);

    // Combo bonus
    xp += maxCombo * XP_CONFIG.COMBO_BONUS;

    // Perfect hit bonus
    xp += (perfectHits || 0) * XP_CONFIG.PERFECT_HIT_BONUS;

    // Win bonus
    if (won) {
        xp += XP_CONFIG.WIN_BONUS;
    }

    // Match day bonuses
    if (isMatchday) {
        if (matchdayResult === 'win') {
            xp += XP_CONFIG.MATCHDAY_WIN;
        } else if (matchdayResult === 'draw') {
            xp += XP_CONFIG.MATCHDAY_DRAW;
        }
    }

    // Apply challenge multiplier if active challenge completed this game
    const weeklyChallenge = _progressionData.weeklyChallenge;
    if (weeklyChallenge && !weeklyChallenge.completed) {
        // Check if this game completes the challenge
        if (checkWeeklyChallengeProgress(gameResult)) {
            xp = Math.floor(xp * XP_CONFIG.CHALLENGE_MULTIPLIER);
        }
    }

    return xp;
}

/**
 * Award XP and check for level up
 */
export function awardXP(amount) {
    const prog = getProgression();
    const oldLevel = prog.level;

    prog.totalXP += amount;

    // Check for level up
    const newLevel = calculateLevel(prog.totalXP);
    if (newLevel > oldLevel) {
        prog.level = newLevel;

        // Check for unlocks at each level
        for (let lvl = oldLevel + 1; lvl <= newLevel; lvl++) {
            const unlock = LEVEL_UNLOCKS[lvl];
            if (unlock && !prog.unlockedCosmetics.includes(unlock.id)) {
                prog.unlockedCosmetics.push(unlock.id);
                queueNotification({
                    type: 'level_up',
                    level: lvl,
                    title: XP_CONFIG.LEVEL_TITLES[lvl - 1],
                    unlock: unlock
                });
            }
        }
    }

    saveProgression();
    return { xpGained: amount, newTotal: prog.totalXP, leveledUp: newLevel > oldLevel, newLevel };
}

/**
 * Calculate level from total XP
 */
export function calculateLevel(totalXP) {
    const thresholds = XP_CONFIG.LEVEL_THRESHOLDS;
    for (let i = thresholds.length - 1; i >= 0; i--) {
        if (totalXP >= thresholds[i]) {
            return i + 1;
        }
    }
    return 1;
}

/**
 * Get XP needed for next level
 */
export function getXPForNextLevel() {
    const prog = getProgression();
    const currentLevel = prog.level;
    const thresholds = XP_CONFIG.LEVEL_THRESHOLDS;

    if (currentLevel >= thresholds.length) {
        return { current: prog.totalXP, needed: prog.totalXP, progress: 1 };
    }

    const currentThreshold = thresholds[currentLevel - 1];
    const nextThreshold = thresholds[currentLevel];
    const progressXP = prog.totalXP - currentThreshold;
    const neededXP = nextThreshold - currentThreshold;

    return {
        current: progressXP,
        needed: neededXP,
        progress: progressXP / neededXP
    };
}

/**
 * Get level title
 */
export function getLevelTitle(level) {
    return XP_CONFIG.LEVEL_TITLES[Math.min(level, XP_CONFIG.LEVEL_TITLES.length) - 1];
}

// ============================================
// Achievement System
// ============================================

/**
 * Check and unlock achievements based on game result
 */
export function checkAchievements(gameResult) {
    const prog = getProgression();
    const unlocked = [];

    // Update stats
    updateStats(gameResult);

    // Check each achievement
    for (const [id, achievement] of Object.entries(ACHIEVEMENTS)) {
        if (prog.achievements[id].unlocked) continue;

        let earned = false;

        switch (id) {
            case 'first_blood':
                earned = prog.stats.totalWins >= 1;
                break;

            case 'perfect_chant':
                earned = gameResult.accuracy === 100;
                break;

            case 'centurion':
                earned = gameResult.maxCombo >= 100 || prog.stats.highestCombo >= 100;
                break;

            case 'rivalry':
                // Need to beat all clubs (excluding player's own club)
                const allClubIds = Object.values(clubs).map(c => c.id);
                earned = allClubIds.every(cid =>
                    cid === state.selectedClub?.id || prog.stats.clubsBeaten.includes(cid)
                );
                break;

            case 'untouchable':
                earned = gameResult.won && gameResult.misses === 0;
                break;

            case 'comeback_king':
                earned = prog.stats.comebackWins >= 1;
                break;

            case 'marathon':
                earned = prog.stats.totalChantsPlayed >= 100;
                break;

            case 'dedicated':
                earned = (prog.stats.totalMatchdayWins + prog.stats.totalMatchdayDraws + prog.stats.totalMatchdayLosses) >= 10;
                break;

            case 'high_scorer':
                earned = gameResult.score >= 5000 || prog.stats.highestScore >= 5000;
                break;

            case 'fever_master':
                earned = prog.stats.feverTimeAccumulated >= 30;
                break;
        }

        if (earned) {
            unlockAchievement(id);
            unlocked.push(achievement);
        }
    }

    saveProgression();
    return unlocked;
}

/**
 * Unlock an achievement
 */
function unlockAchievement(achievementId) {
    const prog = getProgression();
    const achievement = ACHIEVEMENTS[achievementId];

    if (!achievement || prog.achievements[achievementId].unlocked) return;

    prog.achievements[achievementId].unlocked = true;
    prog.achievements[achievementId].unlockedAt = Date.now();

    // Award XP
    awardXP(achievement.xpReward);

    // Queue notification
    queueNotification({
        type: 'achievement',
        achievement: achievement
    });
}

/**
 * Update stats based on game result
 */
function updateStats(gameResult) {
    const prog = getProgression();
    const stats = prog.stats;

    // Basic stats
    stats.totalChantsPlayed++;
    stats.totalPerfectHits += gameResult.perfectHits || 0;
    stats.totalComboAccumulated += gameResult.maxCombo || 0;

    if (gameResult.maxCombo > stats.highestCombo) {
        stats.highestCombo = gameResult.maxCombo;
    }

    if (gameResult.score > stats.highestScore) {
        stats.highestScore = gameResult.score;
    }

    if (gameResult.won) {
        stats.totalWins++;
    }

    // Matchday stats
    if (gameResult.isMatchday) {
        if (gameResult.matchdayResult === 'win') {
            stats.totalMatchdayWins++;

            // Track beaten clubs
            if (gameResult.rivalClubId && !stats.clubsBeaten.includes(gameResult.rivalClubId)) {
                stats.clubsBeaten.push(gameResult.rivalClubId);
            }
        } else if (gameResult.matchdayResult === 'draw') {
            stats.totalMatchdayDraws++;
        } else if (gameResult.matchdayResult === 'loss') {
            stats.totalMatchdayLosses++;
        }
    }

    // Comeback tracking
    if (gameResult.wasComeback) {
        stats.comebackWins++;
    }

    // Fever time
    if (gameResult.feverTime) {
        stats.feverTimeAccumulated += gameResult.feverTime;
    }
}

/**
 * Get all achievements with their status
 */
export function getAllAchievements() {
    const prog = getProgression();
    return Object.entries(ACHIEVEMENTS).map(([id, achievement]) => ({
        ...achievement,
        ...prog.achievements[id]
    }));
}

// ============================================
// Weekly/Season Challenges
// ============================================

/**
 * Get current week number since epoch
 */
function getWeekNumber() {
    const now = new Date();
    const start = new Date(2024, 0, 1);  // Jan 1, 2024
    const diff = now - start;
    return Math.floor(diff / (7 * 24 * 60 * 60 * 1000));
}

/**
 * Get season start date (quarters)
 */
function getSeasonStartDate() {
    const now = new Date();
    const quarter = Math.floor(now.getMonth() / 3);
    return new Date(now.getFullYear(), quarter * 3, 1).getTime();
}

/**
 * Check if weekly challenge needs reset
 */
function checkWeeklyReset() {
    const currentWeek = getWeekNumber();
    const prog = getProgression();

    if (prog.lastWeeklyReset !== currentWeek) {
        // Assign new weekly challenge
        const challengeIndex = currentWeek % WEEKLY_CHALLENGES.length;
        const challenge = { ...WEEKLY_CHALLENGES[challengeIndex] };

        prog.weeklyChallenge = {
            ...challenge,
            progress: 0,
            completed: false,
            startedAt: Date.now()
        };
        prog.lastWeeklyReset = currentWeek;
        saveProgression();
    }
}

/**
 * Initialize season challenges
 */
function initializeSeasonChallenges() {
    const prog = getProgression();
    prog.seasonChallenges = {};

    SEASON_CHALLENGES.forEach((challenge, index) => {
        prog.seasonChallenges[index] = {
            progress: 0,
            completed: false
        };
    });

    saveProgression();
}

/**
 * Check and update weekly challenge progress
 */
function checkWeeklyChallengeProgress(gameResult) {
    const prog = getProgression();
    const challenge = prog.weeklyChallenge;

    if (!challenge || challenge.completed) return false;

    let progressMade = false;

    switch (challenge.type) {
        case 'score_with_club':
            if (gameResult.clubId === challenge.clubId) {
                challenge.progress += gameResult.score;
                progressMade = true;
            }
            break;

        case 'win_matchdays':
            if (gameResult.isMatchday && gameResult.matchdayResult === 'win') {
                challenge.progress++;
                progressMade = true;
            }
            break;

        case 'perfect_hits':
            challenge.progress += gameResult.perfectHits || 0;
            progressMade = true;
            break;

        case 'combo_total':
            challenge.progress += gameResult.maxCombo || 0;
            progressMade = true;
            break;

        case 'play_chants':
            challenge.progress++;
            progressMade = true;
            break;
    }

    if (progressMade && challenge.progress >= challenge.target && !challenge.completed) {
        challenge.completed = true;
        awardXP(challenge.xpReward);
        queueNotification({
            type: 'challenge_complete',
            challenge: challenge,
            isWeekly: true
        });
    }

    saveProgression();
    return challenge.completed;
}

/**
 * Check and update season challenge progress
 */
function checkSeasonChallengeProgress(gameResult) {
    const prog = getProgression();

    SEASON_CHALLENGES.forEach((challenge, index) => {
        const status = prog.seasonChallenges[index];
        if (status.completed) return;

        switch (challenge.type) {
            case 'win_matchdays':
                if (gameResult.isMatchday && gameResult.matchdayResult === 'win') {
                    status.progress++;
                }
                break;

            case 'perfect_hits':
                status.progress += gameResult.perfectHits || 0;
                break;

            case 'combo_total':
                status.progress += gameResult.maxCombo || 0;
                break;

            case 'play_chants':
                status.progress++;
                break;
        }

        if (status.progress >= challenge.target && !status.completed) {
            status.completed = true;
            awardXP(challenge.xpReward);
            queueNotification({
                type: 'challenge_complete',
                challenge: { ...challenge, name: challenge.name },
                isWeekly: false
            });
        }
    });

    saveProgression();
}

/**
 * Get current weekly challenge
 */
export function getWeeklyChallenge() {
    const prog = getProgression();
    if (!prog.weeklyChallenge) return null;

    const challenge = prog.weeklyChallenge;
    const type = CHALLENGE_TYPES[challenge.type];
    const clubName = challenge.clubId ? clubs[challenge.clubId]?.name || challenge.clubId : '';

    return {
        ...challenge,
        description: type.template
            .replace('{target}', challenge.target)
            .replace('{club}', clubName),
        icon: type.icon,
        progressPercent: Math.min(100, (challenge.progress / challenge.target) * 100)
    };
}

/**
 * Get all season challenges with progress
 */
export function getSeasonChallenges() {
    const prog = getProgression();

    return SEASON_CHALLENGES.map((challenge, index) => {
        const status = prog.seasonChallenges[index] || { progress: 0, completed: false };
        const type = CHALLENGE_TYPES[challenge.type];

        return {
            ...challenge,
            ...status,
            description: type.template.replace('{target}', challenge.target),
            icon: type.icon,
            progressPercent: Math.min(100, (status.progress / challenge.target) * 100)
        };
    });
}

// ============================================
// Club Loyalty System
// ============================================

/**
 * Record a game played with a club
 */
export function recordClubGame(clubId) {
    const prog = getProgression();

    if (!prog.clubGames[clubId]) {
        prog.clubGames[clubId] = 0;
    }

    prog.clubGames[clubId]++;

    // Check for loyalty badges
    checkLoyaltyBadges(clubId);

    saveProgression();
}

/**
 * Check and award loyalty badges
 */
function checkLoyaltyBadges(clubId) {
    const prog = getProgression();
    const games = prog.clubGames[clubId] || 0;

    if (!prog.loyaltyBadges[clubId]) {
        prog.loyaltyBadges[clubId] = [];
    }

    const badges = prog.loyaltyBadges[clubId];

    for (const [badgeId, badge] of Object.entries(LOYALTY_CONFIG.BADGES)) {
        if (games >= badge.threshold && !badges.includes(badgeId)) {
            badges.push(badgeId);

            const clubName = clubs[clubId]?.name || clubId;
            queueNotification({
                type: 'loyalty_badge',
                badge: badge,
                clubId: clubId,
                clubName: clubName
            });
        }
    }
}

/**
 * Get club loyalty info
 */
export function getClubLoyalty(clubId) {
    const prog = getProgression();
    const games = prog.clubGames[clubId] || 0;
    const badges = prog.loyaltyBadges[clubId] || [];

    // Find next badge
    let nextBadge = null;
    let gamesNeeded = 0;

    for (const [badgeId, badge] of Object.entries(LOYALTY_CONFIG.BADGES)) {
        if (!badges.includes(badgeId)) {
            nextBadge = badge;
            gamesNeeded = badge.threshold - games;
            break;
        }
    }

    return {
        games,
        badges: badges.map(id => LOYALTY_CONFIG.BADGES[id]),
        nextBadge,
        gamesNeeded,
        progressPercent: nextBadge ? (games / nextBadge.threshold) * 100 : 100
    };
}

/**
 * Get most played club
 */
export function getMostPlayedClub() {
    const prog = getProgression();
    let maxGames = 0;
    let mostPlayed = null;

    for (const [clubId, games] of Object.entries(prog.clubGames)) {
        if (games > maxGames) {
            maxGames = games;
            mostPlayed = clubId;
        }
    }

    return mostPlayed ? { clubId: mostPlayed, games: maxGames } : null;
}

// ============================================
// Notification System
// ============================================

/**
 * Queue a notification to show to the user
 */
function queueNotification(notification) {
    const prog = getProgression();
    prog.pendingNotifications.push({
        ...notification,
        timestamp: Date.now()
    });
    saveProgression();
}

/**
 * Get and clear pending notifications
 */
export function getPendingNotifications() {
    const prog = getProgression();
    const notifications = [...prog.pendingNotifications];
    prog.pendingNotifications = [];
    saveProgression();
    return notifications;
}

// ============================================
// Main Processing Function
// ============================================

/**
 * Process end of game - update all progression systems
 */
export function processGameEnd(gameResult) {
    const prog = getProgression();

    // Record club game for loyalty
    if (gameResult.clubId) {
        recordClubGame(gameResult.clubId);
    }

    // Calculate and award XP
    const xp = calculateXP(gameResult);
    const xpResult = awardXP(xp);

    // Check achievements
    const unlockedAchievements = checkAchievements(gameResult);

    // Update challenge progress
    checkWeeklyChallengeProgress(gameResult);
    checkSeasonChallengeProgress(gameResult);

    saveProgression();

    return {
        xp: xpResult,
        achievements: unlockedAchievements,
        level: prog.level,
        levelTitle: getLevelTitle(prog.level)
    };
}

// ============================================
// Profile/Stats Display Helpers
// ============================================

/**
 * Get player profile summary
 */
export function getPlayerProfile() {
    const prog = getProgression();
    const xpProgress = getXPForNextLevel();
    const mostPlayed = getMostPlayedClub();

    const unlockedCount = Object.values(prog.achievements).filter(a => a.unlocked).length;
    const totalAchievements = Object.keys(ACHIEVEMENTS).length;

    return {
        level: prog.level,
        levelTitle: getLevelTitle(prog.level),
        totalXP: prog.totalXP,
        xpProgress,
        stats: prog.stats,
        achievementProgress: `${unlockedCount}/${totalAchievements}`,
        mostPlayedClub: mostPlayed,
        unlockedCosmetics: prog.unlockedCosmetics
    };
}

/**
 * Get level badge info for leaderboard display
 */
export function getLevelBadge(level) {
    const title = getLevelTitle(level);
    let color = '#888888';

    if (level >= 15) color = '#ff00ff';       // Purple for max
    else if (level >= 12) color = '#ffd700';  // Gold
    else if (level >= 9) color = '#c0c0c0';   // Silver
    else if (level >= 6) color = '#cd7f32';   // Bronze
    else if (level >= 3) color = '#00ff88';   // Green

    return { level, title, color };
}
