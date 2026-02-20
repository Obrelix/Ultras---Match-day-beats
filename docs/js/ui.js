// ============================================
// ui.js — Screen management, navigation, DOM elements
// ============================================

import { GameState, clubs, MATCHDAY, ACHIEVEMENTS, LOYALTY_CONFIG, ANALYTICS, CALIBRATION } from './config.js';
import { state, resetMatchState } from './state.js';
import { stopAudio, initAudio } from './audio.js';
import { saveHighScore, loadHighScore, saveMatchdayStats, loadMatchdayStats, saveGameRecord, loadGameHistory, getOrCreateSession, loadSettings, saveSettings } from './storage.js';
import {
    initSession, getSessionStats, calculateAccuracyTrend, calculateScoreTrend,
    calculateHitDistribution, getClubStats, getChantPerformance, getAnalyticsSummary,
    renderLineChart, renderPieChart, renderBarChart, formatDuration
} from './analytics.js';
import { setCrowdEmotion } from './crowd.js';
import { setCrowdMode } from './crowdBg.js';
import { stopRecording } from './replay.js';
import {
    processGameEnd, getPlayerProfile, getAllAchievements,
    getWeeklyChallenge, getSeasonChallenges, getClubLoyalty,
    getPendingNotifications, getLevelBadge, loadProgression, getLevelTitle,
    getXPForNextLevel, getAllChoreoStatuses
} from './progression.js';
// DOM Elements (module runs after DOM is parsed due to type="module")
export const screens = {
    title: document.getElementById('title-screen'),
    modeSelect: document.getElementById('mode-select-screen'),
    clubSelect: document.getElementById('club-select-screen'),
    chantSelect: document.getElementById('chant-select-screen'),
    matchdaySubmode: document.getElementById('matchday-submode-screen'),
    rivalSelect: document.getElementById('rival-select-screen'),
    matchdayChantSelect: document.getElementById('matchday-chant-select-screen'),
    matchdayIntro: document.getElementById('matchday-intro-screen'),
    gameplay: document.getElementById('gameplay-screen'),
    chantResult: document.getElementById('chant-result-screen'),
    halftime: document.getElementById('halftime-screen'),
    results: document.getElementById('results-screen'),
    fulltime: document.getElementById('fulltime-screen'),
    leaderboard: document.getElementById('leaderboard-screen'),
    replay: document.getElementById('replay-screen'),
    profile: document.getElementById('profile-screen')
};

export const elements = {
    startBtn: document.getElementById('start-btn'),
    backToTitle: document.getElementById('back-to-title'),
    backToTitleFromMode: document.getElementById('back-to-title-from-mode'),
    backToClubs: document.getElementById('back-to-clubs'),
    clubGrid: document.getElementById('club-grid'),
    chantList: document.getElementById('chant-list'),
    selectedClubBanner: document.getElementById('selected-club-banner'),
    playerScore: document.getElementById('player-score'),
    aiScore: document.getElementById('ai-score'),
    playerScoreBadge: document.getElementById('player-score-badge'),
    aiScoreBadge: document.getElementById('ai-score-badge'),
    playerScoreLabel: document.getElementById('player-score-label'),
    aiScoreLabel: document.getElementById('ai-score-label'),
    aiScoreBox: document.getElementById('ai-score-box'),
    currentChantName: document.getElementById('current-chant-name'),
    gameCanvas: document.getElementById('game-canvas'),
    playerScoreBox: document.getElementById('player-score-box'),
    finalPlayerScore: document.getElementById('final-player-score'),
    finalAiScore: document.getElementById('final-ai-score'),
    resultMessage: document.getElementById('result-message'),
    playAgainBtn: document.getElementById('play-again-btn'),
    changeChantBtn: document.getElementById('change-chant-btn'),
    statPerfect: document.getElementById('stat-perfect'),
    statGood: document.getElementById('stat-good'),
    statOk: document.getElementById('stat-ok'),
    statMiss: document.getElementById('stat-miss'),
    statMaxCombo: document.getElementById('stat-max-combo'),

    // XP reward display (results screen)
    xpRewardDisplay: document.getElementById('xp-reward-display'),
    xpRewardAmount: document.getElementById('xp-reward-amount'),
    xpMiniFill: document.getElementById('xp-mini-fill'),
    xpMiniLevel: document.getElementById('xp-mini-level'),

    // Mode select
    modePractice: document.getElementById('mode-practice'),
    modeMatchday: document.getElementById('mode-matchday'),

    // Match Day sub-mode selection
    submodeRandom: document.getElementById('submode-random'),
    submodeCustom: document.getElementById('submode-custom'),
    backToClubsFromSubmode: document.getElementById('back-to-clubs-from-submode'),

    // Rival selection (Match Day)
    rivalGrid: document.getElementById('rival-grid'),
    backToClubsFromRival: document.getElementById('back-to-clubs-from-rival'),

    // Match Day chant selection
    matchdayChantList: document.getElementById('matchday-chant-list'),
    matchdayChantCounter: document.getElementById('matchday-chant-counter'),
    chantCount: document.getElementById('chant-count'),
    startMatchBtn: document.getElementById('start-match-btn'),
    backToRivalSelect: document.getElementById('back-to-rival-select'),

    // Match Day intro
    matchupPlayerBadge: document.getElementById('matchup-player-badge'),
    matchupPlayerName: document.getElementById('matchup-player-name'),
    matchupRivalBadge: document.getElementById('matchup-rival-badge'),
    matchupRivalName: document.getElementById('matchup-rival-name'),
    kickoffBtn: document.getElementById('kickoff-btn'),

    // Match info (in-game, matchday only)
    matchInfo: document.getElementById('match-info'),
    matchScorePlayer: document.getElementById('match-score-player'),
    matchScoreAi: document.getElementById('match-score-ai'),
    matchHalfLabel: document.getElementById('match-half-label'),
    matchChantProgress: document.getElementById('match-chant-progress'),

    // Chant result
    chantResultPlayerGoals: document.getElementById('chant-result-player-goals'),
    chantResultAiGoals: document.getElementById('chant-result-ai-goals'),
    chantResultMessage: document.getElementById('chant-result-message'),
    chantResultDetail: document.getElementById('chant-result-detail'),
    chantStatPerfect: document.getElementById('chant-stat-perfect'),
    chantStatGood: document.getElementById('chant-stat-good'),
    chantStatOk: document.getElementById('chant-stat-ok'),
    chantStatMiss: document.getElementById('chant-stat-miss'),
    chantStatMaxCombo: document.getElementById('chant-stat-max-combo'),
    nextChantBtn: document.getElementById('next-chant-btn'),

    // Halftime
    halftimePlayerGoals: document.getElementById('halftime-player-goals'),
    halftimeAiGoals: document.getElementById('halftime-ai-goals'),
    halftimeSummary: document.getElementById('halftime-summary'),
    secondHalfBtn: document.getElementById('second-half-btn'),

    // Fulltime
    fulltimePlayerGoals: document.getElementById('fulltime-player-goals'),
    fulltimeAiGoals: document.getElementById('fulltime-ai-goals'),
    fulltimeResultMessage: document.getElementById('fulltime-result-message'),
    fulltimeSummary: document.getElementById('fulltime-summary'),
    fulltimePlayAgainBtn: document.getElementById('fulltime-play-again-btn'),
    fulltimeMainMenuBtn: document.getElementById('fulltime-main-menu-btn'),

    // Pause
    pauseBtn: document.getElementById('pause-btn'),
    pauseOverlay: document.getElementById('pause-overlay'),
    resumeBtn: document.getElementById('resume-btn'),
    quitBtn: document.getElementById('quit-btn'),

    // Loading
    loadingOverlay: document.getElementById('loading-overlay'),
    loadingText: document.getElementById('loading-text'),

    // Tutorial
    tutorialOverlay: document.getElementById('tutorial-overlay'),

    // Global Settings
    settingsBtn: document.getElementById('settings-btn'),
    settingsPanel: document.getElementById('settings-panel'),
    volumeSlider: document.getElementById('volume-slider'),
    sfxVolumeSlider: document.getElementById('sfx-volume-slider'),
    reducedEffectsToggle: document.getElementById('reduced-effects-toggle'),

    // AI score popup
    aiScorePopupContainer: document.getElementById('ai-score-popup-container'),

    // High score
    highScoreDisplay: document.getElementById('high-score-display'),
    highScoreValue: document.getElementById('high-score-value'),

    // Leaderboard
    viewLeaderboardBtn: document.getElementById('view-leaderboard-btn'),
    playerRank: document.getElementById('player-rank'),

    // Modifiers
    modifierOptions: document.getElementById('modifier-options'),
    modifierBonus: document.getElementById('modifier-bonus'),
    activeModifiers: document.getElementById('active-modifiers'),

    // Power-ups
    powerupHud: document.getElementById('powerup-hud'),
    powerupShield: document.getElementById('powerup-shield'),
    powerupScoreBurst: document.getElementById('powerup-scoreBurst'),
    powerupSlowMotion: document.getElementById('powerup-slowMotion'),

    // AI Mood
    aiMoodIndicator: document.getElementById('ai-mood-indicator'),
    aiMoodIcon: document.getElementById('ai-mood-icon'),
    aiMoodText: document.getElementById('ai-mood-text'),

    // Replay System
    importReplayBtn: document.getElementById('import-replay-btn'),
    watchReplayBtn: document.getElementById('watch-replay-btn'),
    shareReplayBtn: document.getElementById('share-replay-btn'),
    replayChantName: document.getElementById('replay-chant-name'),
    replayModifiers: document.getElementById('replay-modifiers'),
    replayTime: document.getElementById('replay-time'),
    replayDuration: document.getElementById('replay-duration'),
    replayProgressFill: document.getElementById('replay-progress-fill'),
    replayScore: document.getElementById('replay-score'),
    replayCombo: document.getElementById('replay-combo'),
    replayCanvas: document.getElementById('replay-canvas'),
    replayPlayPauseBtn: document.getElementById('replay-play-pause-btn'),
    replaySpeedBtn: document.getElementById('replay-speed-btn'),
    replayRestartBtn: document.getElementById('replay-restart-btn'),
    replayBackBtn: document.getElementById('replay-back-btn'),
    replayModal: document.getElementById('replay-modal'),
    replayModalTitle: document.getElementById('replay-modal-title'),
    replayModalDesc: document.getElementById('replay-modal-desc'),
    replayCodeInput: document.getElementById('replay-code-input'),
    replayCodeError: document.getElementById('replay-code-error'),
    replayCopyBtn: document.getElementById('replay-copy-btn'),
    replayImportBtn: document.getElementById('replay-import-btn'),
    replayCloseBtn: document.getElementById('replay-close-btn'),

    // Title Screen Progression
    titleLevelBadge: document.getElementById('title-level-badge'),
    titleLevelNum: document.getElementById('title-level-num'),
    titleLevelTitle: document.getElementById('title-level-title'),
    profileBtn: document.getElementById('profile-btn'),

    // Profile Screen
    profileBackBtn: document.getElementById('profile-back-btn'),
    profileLevel: document.getElementById('profile-level'),
    profileLevelTitle: document.getElementById('profile-title'),
    profileXpFill: document.getElementById('profile-xp-fill'),
    profileXpText: document.getElementById('profile-xp-text'),
    profileStatWins: document.getElementById('profile-total-wins'),
    profileStatMatchdays: document.getElementById('profile-matchday-wins'),
    profileStatChants: document.getElementById('profile-chants-played'),
    profileStatCombo: document.getElementById('profile-highest-combo'),
    profileStatPerfects: document.getElementById('profile-perfect-hits'),
    profileStatHighScore: document.getElementById('profile-highest-score'),
    profileLoyaltyClub: document.getElementById('loyalty-club-name'),
    profileLoyaltyBadges: document.getElementById('loyalty-badges'),
    profileLoyaltyProgressFill: document.getElementById('loyalty-progress-fill'),
    profileLoyaltyProgressText: document.getElementById('loyalty-progress-text'),
    profileAchievementsGrid: document.getElementById('achievements-grid'),
    profileAchievementCount: document.getElementById('achievement-count'),
    profileWeeklyChallenge: document.getElementById('weekly-challenge-content'),
    profileSeasonChallenges: document.getElementById('season-challenges-list'),
    profileChoreosGrid: document.getElementById('choreos-grid'),
    profileChoreoCount: document.getElementById('choreo-count'),

    // XP Popup
    xpPopup: document.getElementById('xp-popup'),
    xpGained: document.getElementById('xp-gained'),
    xpLevelUp: document.getElementById('xp-level-up'),
    xpNewLevel: document.getElementById('xp-new-level'),
    xpNewTitle: document.getElementById('xp-new-title'),
    xpUnlock: document.getElementById('xp-unlock'),
    xpUnlockName: document.getElementById('xp-unlock-name'),

    // Achievement Popup
    achievementPopup: document.getElementById('achievement-popup'),
    achievementPopupIcon: document.getElementById('achievement-popup-icon'),
    achievementPopupName: document.getElementById('achievement-popup-name'),

    // Audio Settings
    metronomeToggle: document.getElementById('metronome-toggle'),

    // Input Calibration
    calibrateBtn: document.getElementById('calibrate-btn'),
    currentOffset: document.getElementById('current-offset'),
    calibrationModal: document.getElementById('calibration-modal'),
    calibrationCancel: document.getElementById('calibration-cancel'),

    // Profile Tabs & Analytics Dashboard
    profileTabStats: document.getElementById('profile-tab-stats'),
    profileTabAnalytics: document.getElementById('profile-tab-analytics'),
    profileStatsContent: document.getElementById('profile-stats-content'),
    profileAnalyticsContent: document.getElementById('profile-analytics-content'),
    analyticsSessionGames: document.getElementById('analytics-session-games'),
    analyticsSessionAccuracy: document.getElementById('analytics-session-accuracy'),
    analyticsSessionBest: document.getElementById('analytics-session-best'),
    analyticsSessionTime: document.getElementById('analytics-session-time'),
    analyticsAccuracyCanvas: document.getElementById('analytics-accuracy-canvas'),
    analyticsAccuracyTrend: document.getElementById('analytics-accuracy-trend'),
    analyticsScoreCanvas: document.getElementById('analytics-score-canvas'),
    analyticsScoreTrend: document.getElementById('analytics-score-trend'),
    analyticsHitsCanvas: document.getElementById('analytics-hits-canvas'),
    analyticsClubCanvas: document.getElementById('analytics-club-canvas'),
    analyticsBestChants: document.getElementById('analytics-best-chants'),
    analyticsWorstChants: document.getElementById('analytics-worst-chants'),

    // Global Navigation
    globalNav: document.getElementById('global-nav'),
    navBackBtn: document.getElementById('nav-back-btn'),
    navHomeBtn: document.getElementById('nav-home-btn'),
    navProfileBtn: document.getElementById('nav-profile-btn'),

    // Abandon Match Modal
    abandonMatchModal: document.getElementById('abandon-match-modal'),
    abandonConfirmBtn: document.getElementById('abandon-confirm-btn'),
    abandonCancelBtn: document.getElementById('abandon-cancel-btn'),

    // Custom Chants
    customChantList: document.getElementById('custom-chant-list'),
    uploadChantBtn: document.getElementById('upload-chant-btn'),
    chantFileInput: document.getElementById('chant-file-input'),

    // Copyright Modal
    copyrightModal: document.getElementById('copyright-modal'),
    copyrightAcknowledge: document.getElementById('copyright-acknowledge'),
    copyrightCancelBtn: document.getElementById('copyright-cancel-btn'),
    copyrightAcceptBtn: document.getElementById('copyright-accept-btn'),

    // Upload Modal
    uploadModal: document.getElementById('upload-modal'),
    uploadStatus: document.getElementById('upload-status'),
    uploadStatusText: document.getElementById('upload-status-text'),
    uploadProgressFill: document.getElementById('upload-progress-fill'),
    uploadForm: document.getElementById('upload-form'),
    uploadChantName: document.getElementById('upload-chant-name'),
    uploadDuration: document.getElementById('upload-duration'),
    uploadSize: document.getElementById('upload-size'),
    uploadError: document.getElementById('upload-error'),
    uploadCancelBtn: document.getElementById('upload-cancel-btn'),
    uploadSaveBtn: document.getElementById('upload-save-btn'),
};

export function showScreen(screenName, addToHistory = true) {
    // Push current screen to history before switching (if not already there)
    if (addToHistory && state.currentState && state.currentState !== screenName) {
        state.navigationHistory.push(state.currentState);
        // Limit history size to prevent memory issues
        if (state.navigationHistory.length > 20) state.navigationHistory.shift();
    }

    Object.values(screens).forEach(screen => screen.classList.remove('active'));
    screens[screenName].classList.add('active');
    state.currentState = screenName;

    updateNavVisibility();
}

/**
 * Navigate back to the previous screen
 */
export function navigateBack() {
    // If in active matchday, show confirmation
    if (isInActiveMatch()) {
        showAbandonMatchConfirm(() => {
            state.navigationHistory = [];
            resetMatchState();
            showScreen('title', false);
        });
        return;
    }

    if (state.navigationHistory.length === 0) return;
    const previousScreen = state.navigationHistory.pop();
    showScreen(previousScreen, false); // Don't add to history when going back
}

/**
 * Navigate directly to home/title screen
 */
export function navigateHome() {
    // If in active matchday, show confirmation
    if (isInActiveMatch()) {
        showAbandonMatchConfirm(() => {
            state.navigationHistory = [];
            resetMatchState();
            showScreen('title', false);
        });
        return;
    }

    state.navigationHistory = []; // Clear history
    showScreen('title', false);
}

/**
 * Check if we're in an active Match Day flow (not Practice)
 */
function isInActiveMatch() {
    const matchScreens = ['rivalSelect', 'matchdayChantSelect', 'matchdayIntro', 'chantResult', 'halftime'];
    return state.gameMode === 'matchday' && matchScreens.includes(state.currentState);
}

/**
 * Show/hide the abandon match confirmation modal
 */
let _abandonCallback = null;

function showAbandonMatchConfirm(onConfirm) {
    _abandonCallback = onConfirm;
    if (elements.abandonMatchModal) {
        elements.abandonMatchModal.classList.remove('hidden');
    }
}

export function hideAbandonMatchConfirm() {
    if (elements.abandonMatchModal) {
        elements.abandonMatchModal.classList.add('hidden');
    }
    _abandonCallback = null;
}

export function confirmAbandonMatch() {
    if (_abandonCallback) {
        _abandonCallback();
    }
    hideAbandonMatchConfirm();
}

/**
 * Update global nav visibility based on current screen
 */
function updateNavVisibility() {
    if (!elements.globalNav) return;

    // Hide on title screen (nothing to go back to) and during gameplay (use pause menu)
    const hideOn = ['title', 'gameplay'];
    const shouldHide = hideOn.includes(state.currentState);

    elements.globalNav.classList.toggle('hidden', shouldHide);

    // Hide profile button when already on profile screen
    if (elements.navProfileBtn) {
        elements.navProfileBtn.classList.toggle('hidden', state.currentState === 'profile');
    }
}

// Helper to convert hex color to RGB values for CSS rgba()
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
        ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
        : '0, 102, 51';
}

export function applyClubTheme(club) {
    document.documentElement.style.setProperty('--primary-color', club.colors.primary);
    document.documentElement.style.setProperty('--primary-color-rgb', hexToRgb(club.colors.primary));
    document.documentElement.style.setProperty('--secondary-color', club.colors.secondary);
    if (state.rivalClub) {
        document.documentElement.style.setProperty('--rival-color', state.rivalClub.colors.primary);
    } else {
        document.documentElement.style.setProperty('--rival-color', '#cc0000');
    }
}

export function updateScoreboardTeams() {
    // Player side: always show selected club badge and name
    elements.playerScoreBadge.src = state.selectedClub.badge;
    elements.playerScoreBadge.alt = state.selectedClub.name;
    elements.playerScoreLabel.textContent = state.selectedClub.name;

    if (state.rivalClub) {
        // Match Day: show rival club badge, name, and color
        elements.aiScoreBadge.src = state.rivalClub.badge;
        elements.aiScoreBadge.alt = state.rivalClub.name;
        elements.aiScoreBadge.style.display = '';
        elements.aiScoreLabel.textContent = state.rivalClub.name;
        document.documentElement.style.setProperty('--rival-color', state.rivalClub.colors.primary);
    } else {
        // Practice: generic rival
        elements.aiScoreBadge.src = '';
        elements.aiScoreBadge.style.display = 'none';
        elements.aiScoreLabel.textContent = 'RIVAL';
        document.documentElement.style.setProperty('--rival-color', '#cc0000');
    }
}

export function renderClubSelection(onSelectClub, minChants = 0) {
    elements.clubGrid.innerHTML = '';

    Object.values(clubs).forEach(club => {
        // Deduplicate chants by audio path for counting
        const uniqueChants = new Set(club.chants.map(c => c.audio));
        if (uniqueChants.size < minChants) return;

        const card = document.createElement('div');
        card.className = 'club-card';

        // Build DOM safely to prevent XSS
        const badgeDiv = document.createElement('div');
        badgeDiv.className = 'club-badge';
        badgeDiv.style.background = club.colors.primary;

        const badgeImg = document.createElement('img');
        badgeImg.src = club.badge;
        badgeImg.alt = club.name;
        badgeDiv.appendChild(badgeImg);

        const nameDiv = document.createElement('div');
        nameDiv.className = 'club-name';
        nameDiv.textContent = club.name;

        card.appendChild(badgeDiv);
        card.appendChild(nameDiv);
        card.addEventListener('click', () => onSelectClub(club));
        elements.clubGrid.appendChild(card);
    });
}

export function renderRivalSelection(playerClub, minChants, onSelectRival) {
    if (!elements.rivalGrid) return;
    elements.rivalGrid.innerHTML = '';

    Object.values(clubs).forEach(club => {
        // Exclude player's club
        if (club.id === playerClub.id) return;

        // Deduplicate chants by audio path for counting
        const uniqueChants = new Set(club.chants.map(c => c.audio));
        if (uniqueChants.size < minChants) return;

        const card = document.createElement('div');
        card.className = 'club-card rival-card';

        // Build DOM safely to prevent XSS
        const badgeDiv = document.createElement('div');
        badgeDiv.className = 'club-badge';
        badgeDiv.style.background = club.colors.primary;

        const badgeImg = document.createElement('img');
        badgeImg.src = club.badge;
        badgeImg.alt = club.name;
        badgeDiv.appendChild(badgeImg);

        const nameDiv = document.createElement('div');
        nameDiv.className = 'club-name';
        nameDiv.textContent = club.name;

        card.appendChild(badgeDiv);
        card.appendChild(nameDiv);
        card.addEventListener('click', () => onSelectRival(club));
        elements.rivalGrid.appendChild(card);
    });
}

// Track selected chants for Match Day
let selectedMatchdayChants = [];

export function renderMatchdayChantSelection(playerClub, requiredCount, onConfirm) {
    if (!elements.matchdayChantList) return;
    elements.matchdayChantList.innerHTML = '';
    selectedMatchdayChants = [];

    // Update counter
    updateChantCounter(0, requiredCount);

    // Deduplicate chants by audio path
    const seen = new Set();
    const uniqueChants = playerClub.chants.filter(c => {
        if (seen.has(c.audio)) return false;
        seen.add(c.audio);
        return true;
    });

    // Show warning if not enough chants
    if (uniqueChants.length < requiredCount) {
        const warning = document.createElement('div');
        warning.className = 'chant-warning';
        warning.textContent = `This club only has ${uniqueChants.length} unique chants. You need ${requiredCount} for Match Day.`;
        elements.matchdayChantList.appendChild(warning);
    }

    uniqueChants.forEach((chant, index) => {
        const highScore = loadHighScore(playerClub.id, chant.id);
        const item = document.createElement('div');
        item.className = 'chant-item matchday-chant-item';
        item.dataset.chantIndex = index;
        item.style.cssText = 'position: relative; display: flex; align-items: center; background: rgba(30, 30, 30, 0.95); border-radius: 12px; padding: 10px 14px; cursor: pointer; border: 2px solid rgba(255,255,255,0.1); transition: all 0.2s ease; min-height: 60px;';

        // Checkbox indicator
        const checkbox = document.createElement('div');
        checkbox.className = 'chant-checkbox';
        checkbox.innerHTML = '<span class="checkbox-icon"></span>';
        checkbox.style.cssText = 'position: absolute; left: 10px; top: 50%; transform: translateY(-50%); width: 24px; height: 24px; border-radius: 6px; background: rgba(40, 40, 40, 0.9); border: 2px solid #555; display: flex; align-items: center; justify-content: center; z-index: 2;';

        // Left accent bar
        const accent = document.createElement('div');
        accent.className = 'chant-accent';
        accent.style.cssText = 'position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: var(--primary-color); border-radius: 16px 0 0 16px; opacity: 0.5;';

        // Main content wrapper
        const content = document.createElement('div');
        content.className = 'chant-content';
        content.style.cssText = 'display: flex; align-items: center; flex: 1; min-width: 0; margin-left: 38px;';

        // Music icon
        const icon = document.createElement('div');
        icon.className = 'chant-icon';
        icon.textContent = '♫';
        icon.style.cssText = 'display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; background: rgba(0,150,80,0.3); border-radius: 10px; margin-right: 12px; font-size: 1.2rem; color: #00ff88; flex-shrink: 0;';

        // Text content wrapper
        const textWrapper = document.createElement('div');
        textWrapper.className = 'chant-text';
        textWrapper.style.cssText = 'flex: 1; min-width: 0; overflow: hidden;';

        // Chant name
        const nameDiv = document.createElement('div');
        nameDiv.className = 'chant-name';
        nameDiv.textContent = chant.name;
        nameDiv.style.cssText = 'color: #ffffff !important; font-size: 1rem; font-weight: 700; text-shadow: 0 1px 2px rgba(0,0,0,0.8); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';

        // Info row
        const infoDiv = document.createElement('div');
        infoDiv.className = 'chant-info';
        infoDiv.style.cssText = 'color: #cccccc !important; font-size: 0.75rem; margin-top: 3px; display: flex; align-items: center; gap: 8px;';

        // Duration badge
        if (chant.duration) {
            const durationBadge = document.createElement('span');
            durationBadge.className = 'chant-duration-badge';
            durationBadge.style.cssText = 'color: #aaaaaa !important; font-weight: 500;';
            const mins = Math.floor(chant.duration / 60);
            const secs = Math.floor(chant.duration % 60);
            durationBadge.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
            infoDiv.appendChild(durationBadge);
        }

        // High score
        if (highScore > 0) {
            const scoreText = document.createElement('span');
            scoreText.className = 'chant-high-score-text';
            scoreText.style.cssText = 'color: #ffdd00 !important; font-weight: 600;';
            scoreText.innerHTML = `★ ${highScore.toLocaleString()}`;
            infoDiv.appendChild(scoreText);
        }

        textWrapper.appendChild(nameDiv);
        textWrapper.appendChild(infoDiv);

        content.appendChild(icon);
        content.appendChild(textWrapper);

        item.appendChild(checkbox);
        item.appendChild(accent);
        item.appendChild(content);

        // Toggle selection on click
        item.addEventListener('click', () => {
            toggleChantSelection(item, chant, uniqueChants, requiredCount);
        });

        elements.matchdayChantList.appendChild(item);
    });

    // Set up start match button
    if (elements.startMatchBtn) {
        elements.startMatchBtn.disabled = true;
        elements.startMatchBtn.onclick = () => {
            if (selectedMatchdayChants.length === requiredCount) {
                onConfirm(selectedMatchdayChants);
            }
        };
    }
}

function toggleChantSelection(item, chant, allChants, requiredCount) {
    const isSelected = item.classList.contains('selected');

    if (isSelected) {
        // Deselect
        item.classList.remove('selected');
        selectedMatchdayChants = selectedMatchdayChants.filter(c => c.id !== chant.id);
    } else {
        // Select (if under limit)
        if (selectedMatchdayChants.length < requiredCount) {
            item.classList.add('selected');
            selectedMatchdayChants.push(chant);
        }
    }

    // Update counter and button state
    updateChantCounter(selectedMatchdayChants.length, requiredCount);

    // Enable/disable start button
    if (elements.startMatchBtn) {
        elements.startMatchBtn.disabled = selectedMatchdayChants.length !== requiredCount;
    }
}

function updateChantCounter(count, required) {
    if (elements.chantCount) {
        elements.chantCount.textContent = count;
    }
    if (elements.matchdayChantCounter) {
        elements.matchdayChantCounter.classList.toggle('complete', count === required);
        elements.matchdayChantCounter.classList.toggle('has-selection', count > 0);
    }
}

export function getSelectedMatchdayChants() {
    return [...selectedMatchdayChants];
}

export function renderChantSelection(onSelectChant) {
    elements.selectedClubBanner.textContent = state.selectedClub.name;
    elements.selectedClubBanner.style.background = state.selectedClub.colors.primary;
    elements.selectedClubBanner.style.color = state.selectedClub.colors.secondary;

    elements.chantList.innerHTML = '';

    state.selectedClub.chants.forEach(chant => {
        const highScore = loadHighScore(state.selectedClub.id, chant.id);
        const item = document.createElement('div');
        item.className = 'chant-item';

        // Left accent bar
        const accent = document.createElement('div');
        accent.className = 'chant-accent';

        // Main content wrapper
        const content = document.createElement('div');
        content.className = 'chant-content';

        // Music icon
        const icon = document.createElement('div');
        icon.className = 'chant-icon';
        icon.textContent = '♫';

        // Text content wrapper
        const textWrapper = document.createElement('div');
        textWrapper.className = 'chant-text';

        // Chant name
        const nameDiv = document.createElement('div');
        nameDiv.className = 'chant-name';
        nameDiv.textContent = chant.name;

        // Info row
        const infoDiv = document.createElement('div');
        infoDiv.className = 'chant-info';

        // Duration badge
        if (chant.duration) {
            const durationBadge = document.createElement('span');
            durationBadge.className = 'chant-duration-badge';
            const mins = Math.floor(chant.duration / 60);
            const secs = Math.floor(chant.duration % 60);
            durationBadge.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
            infoDiv.appendChild(durationBadge);
        }

        // High score or play prompt
        const scoreText = document.createElement('span');
        if (highScore > 0) {
            scoreText.className = 'chant-high-score-text';
            scoreText.innerHTML = `<span style="color: var(--accent-gold);">★</span> Best: ${highScore.toLocaleString()}`;
        } else {
            scoreText.textContent = 'Tap to play';
        }
        infoDiv.appendChild(scoreText);

        textWrapper.appendChild(nameDiv);
        textWrapper.appendChild(infoDiv);

        // Play button
        const playBtn = document.createElement('div');
        playBtn.className = 'chant-play';
        playBtn.textContent = '▶';

        content.appendChild(icon);
        content.appendChild(textWrapper);
        content.appendChild(playBtn);

        item.appendChild(accent);
        item.appendChild(content);
        item.addEventListener('click', () => onSelectChant(chant));
        elements.chantList.appendChild(item);
    });
}

export function renderMatchdayIntro() {
    const player = state.selectedClub;
    const rival = state.rivalClub;

    // Build DOM safely to prevent XSS
    elements.matchupPlayerBadge.innerHTML = '';
    const playerImg = document.createElement('img');
    playerImg.src = player.badge;
    playerImg.alt = player.name;
    elements.matchupPlayerBadge.appendChild(playerImg);
    elements.matchupPlayerBadge.style.background = player.colors.primary;
    elements.matchupPlayerName.textContent = player.name;

    elements.matchupRivalBadge.innerHTML = '';
    const rivalImg = document.createElement('img');
    rivalImg.src = rival.badge;
    rivalImg.alt = rival.name;
    elements.matchupRivalBadge.appendChild(rivalImg);
    elements.matchupRivalBadge.style.background = rival.colors.primary;
    elements.matchupRivalName.textContent = rival.name;
}

export function updateMatchScoreboard() {
    elements.matchScorePlayer.textContent = state.playerGoals;
    elements.matchScoreAi.textContent = state.aiGoals;
    elements.matchHalfLabel.textContent = state.currentHalf === 1 ? '1st Half' : '2nd Half';
    const chantInHalf = state.currentChantIndex - (state.currentHalf === 1 ? 0 : MATCHDAY.CHANTS_PER_HALF);
    elements.matchChantProgress.textContent = `Chant ${chantInHalf + 1}/${MATCHDAY.CHANTS_PER_HALF}`;
}

export function endGame() {
    // Clean up AI score popups
    if (elements.aiScorePopupContainer) {
        elements.aiScorePopupContainer.innerHTML = '';
    }

    // Stop recording replay (must be called before state changes)
    if (state.isRecording) {
        stopRecording();
    }

    if (state.gameMode === 'matchday') {
        endMatchdayChant();
        return;
    }

    // Practice mode
    state.currentState = GameState.RESULTS;
    cancelAnimationFrame(state.gameLoopId);
    stopAudio();

    elements.finalPlayerScore.textContent = state.playerScore;
    elements.finalAiScore.textContent = state.aiScore;

    let resultClass, resultText;
    if (state.playerScore > state.aiScore) {
        resultClass = 'win';
        resultText = 'YOU WIN!';
    } else if (state.playerScore < state.aiScore) {
        resultClass = 'lose';
        resultText = 'YOU LOSE!';
    } else {
        resultClass = 'draw';
        resultText = 'DRAW!';
    }

    elements.resultMessage.className = resultClass;
    elements.resultMessage.textContent = resultText;

    // Set crowd emotion/mode for results screen
    if (resultClass === 'win') {
        setCrowdEmotion('celebrate');
        setCrowdMode('celebrate');
    } else if (resultClass === 'lose') {
        setCrowdEmotion('deject');
        setCrowdMode('deject');
    } else {
        setCrowdEmotion('neutral');
        setCrowdMode('idle');
    }

    elements.statPerfect.textContent = state.playerStats.perfect;
    elements.statGood.textContent = state.playerStats.good;
    elements.statOk.textContent = state.playerStats.ok;
    elements.statMiss.textContent = state.playerStats.miss;
    elements.statMaxCombo.textContent = state.playerMaxCombo;

    // Save and show high score
    if (state.selectedClub && state.selectedChant) {
        saveHighScore(state.selectedClub.id, state.selectedChant.id, state.playerScore);
        const best = loadHighScore(state.selectedClub.id, state.selectedChant.id);
        elements.highScoreValue.textContent = best;
        elements.highScoreDisplay.classList.remove('hidden');

        // Process progression (XP, achievements, challenges, loyalty)
        const isWin = state.playerScore > state.aiScore;
        const progressionResult = processEndGameProgression(isWin, false, null);

        // Update XP reward display
        updateXPRewardDisplay(progressionResult);

        // Submit to leaderboard
        if (_onScoreSubmit) {
            const totalHits = state.playerStats.perfect + state.playerStats.good + state.playerStats.ok;
            const accuracy = state.totalBeats > 0
                ? Math.round((totalHits / state.totalBeats) * 100)
                : 0;

            _onScoreSubmit({
                clubId: state.selectedClub.id,
                chantId: state.selectedChant.id,
                difficulty: state.settings.difficulty,
                score: state.playerScore,
                maxCombo: state.playerMaxCombo,
                accuracy,
                stats: { ...state.playerStats }
            });
        }
    }

    // Reset player rank display
    if (elements.playerRank) {
        elements.playerRank.classList.add('hidden');
    }

    showScreen('results');
}

// Match Day: called when a chant ends during matchday mode
// onStartNextChant is set by main.js via setMatchdayChantStarter
let _startNextChant = null;

export function setMatchdayChantStarter(fn) {
    _startNextChant = fn;
}

// Leaderboard: called when a score should be submitted
// Set by main.js via setScoreSubmitHandler
let _onScoreSubmit = null;

export function setScoreSubmitHandler(fn) {
    _onScoreSubmit = fn;
}

function endMatchdayChant() {
    cancelAnimationFrame(state.gameLoopId);
    stopAudio();

    // Evaluate player goal based on accuracy (not combo ratio)
    const totalHits = state.playerStats.perfect + state.playerStats.good + state.playerStats.ok;
    const accuracy = state.totalBeats > 0 ? totalHits / state.totalBeats : 0;
    const playerScored = accuracy >= MATCHDAY.GOAL_COMBO_THRESHOLD;

    // Evaluate AI goal
    const aiScored = Math.random() < MATCHDAY.AI_GOAL_CHANCE;

    if (playerScored) state.playerGoals++;
    if (aiScored) state.aiGoals++;

    // Record result
    state.chantResults.push({
        chant: state.matchChants[state.currentChantIndex],
        playerScored,
        aiScored,
        accuracy,
        maxCombo: state.playerMaxCombo,
        totalBeats: state.totalBeats
    });

    state.currentChantIndex++;

    // Show chant result screen
    showChantResult(playerScored, aiScored);
}

function showChantResult(playerScored, aiScored) {
    elements.chantResultPlayerGoals.textContent = state.playerGoals;
    elements.chantResultAiGoals.textContent = state.aiGoals;

    // Build message parts
    const messages = [];
    if (playerScored) messages.push('GOAL!');
    if (aiScored) messages.push('Rival scores...');
    if (!playerScored && !aiScored) messages.push('No Goal');

    const msgEl = elements.chantResultMessage;
    msgEl.textContent = messages.join(' | ');
    msgEl.className = '';
    if (playerScored) msgEl.classList.add('goal');
    else if (aiScored) msgEl.classList.add('ai-goal');
    else msgEl.classList.add('no-goal');

    // Set crowd emotion and mode based on game outcome
    if (playerScored && !aiScored) {
        setCrowdEmotion('celebrate');
        setCrowdMode('celebrate');
    } else if (!playerScored && aiScored) {
        setCrowdEmotion('deject');
        setCrowdMode('deject');
    } else if (playerScored && aiScored) {
        setCrowdEmotion('celebrate');
        setCrowdMode('celebrate');
    } else {
        setCrowdEmotion('deject');
        setCrowdMode('deject');
    }

    // Populate detailed stats (like practice mode)
    elements.chantStatPerfect.textContent = state.playerStats.perfect;
    elements.chantStatGood.textContent = state.playerStats.good;
    elements.chantStatOk.textContent = state.playerStats.ok;
    elements.chantStatMiss.textContent = state.playerStats.miss;
    elements.chantStatMaxCombo.textContent = state.playerMaxCombo;

    const prevResult = state.chantResults[state.chantResults.length - 1];
    elements.chantResultDetail.textContent =
        `Accuracy: ${Math.round(prevResult.accuracy * 100)}% — Score 40%+ to score a goal!`;

    // Set up next-chant button with debounce to prevent double-clicks
    let btnText, btnAction;
    let btnClicked = false;

    if (state.currentChantIndex === MATCHDAY.CHANTS_PER_HALF) {
        btnText = 'HALF TIME';
        btnAction = () => {
            if (btnClicked) return;
            btnClicked = true;
            state.currentHalf = 2;
            showHalftime();
        };
    } else if (state.currentChantIndex === MATCHDAY.CHANTS_PER_HALF * 2) {
        btnText = 'FULL TIME';
        btnAction = () => {
            if (btnClicked) return;
            btnClicked = true;
            showFulltime();
        };
    } else {
        btnText = 'NEXT CHANT';
        btnAction = () => {
            if (btnClicked) return;
            btnClicked = true;
            if (_startNextChant) _startNextChant();
        };
    }

    elements.nextChantBtn.textContent = btnText;
    elements.nextChantBtn.onclick = btnAction;

    showScreen('chantResult');
}

export function showHalftime() {
    setCrowdMode('idle');
    elements.halftimePlayerGoals.textContent = state.playerGoals;
    elements.halftimeAiGoals.textContent = state.aiGoals;

    // Summary of first half - build DOM safely
    elements.halftimeSummary.innerHTML = '';
    state.chantResults.forEach((r, i) => {
        if (i > 0) elements.halftimeSummary.appendChild(document.createElement('br'));
        const text = document.createTextNode(
            `Chant ${i + 1}: ${r.playerScored ? 'GOAL' : '-'} | Rival: ${r.aiScored ? 'GOAL' : '-'}`
        );
        elements.halftimeSummary.appendChild(text);
    });

    showScreen('halftime');
}

export function showFulltime() {
    elements.fulltimePlayerGoals.textContent = state.playerGoals;
    elements.fulltimeAiGoals.textContent = state.aiGoals;

    let resultClass, resultText;
    if (state.playerGoals > state.aiGoals) {
        resultClass = 'win';
        resultText = 'VICTORY!';
    } else if (state.playerGoals < state.aiGoals) {
        resultClass = 'lose';
        resultText = 'DEFEAT';
    } else {
        resultClass = 'draw';
        resultText = 'DRAW';
    }

    elements.fulltimeResultMessage.className = resultClass;
    elements.fulltimeResultMessage.textContent = resultText;

    // Set crowd mode based on outcome
    if (resultClass === 'win') {
        setCrowdEmotion('celebrate');
        setCrowdMode('celebrate');
    } else if (resultClass === 'lose') {
        setCrowdEmotion('deject');
        setCrowdMode('deject');
    } else {
        setCrowdEmotion('neutral');
        setCrowdMode('idle');
    }

    // Full match summary - build DOM safely
    elements.fulltimeSummary.innerHTML = '';
    state.chantResults.forEach((r, i) => {
        if (i > 0) elements.fulltimeSummary.appendChild(document.createElement('br'));
        const half = i < MATCHDAY.CHANTS_PER_HALF ? '1st' : '2nd';
        const you = r.playerScored ? 'GOAL' : '-';
        const rival = r.aiScored ? 'GOAL' : '-';
        const text = document.createTextNode(
            `${half} Half - Chant ${(i % MATCHDAY.CHANTS_PER_HALF) + 1}: You ${you} | Rival ${rival}`
        );
        elements.fulltimeSummary.appendChild(text);
    });

    // Persist matchday stats
    const stats = loadMatchdayStats();
    stats.played++;
    let matchdayResult;
    if (state.playerGoals > state.aiGoals) {
        stats.won++;
        matchdayResult = 'win';
    } else if (state.playerGoals < state.aiGoals) {
        stats.lost++;
        matchdayResult = 'loss';
    } else {
        stats.drawn++;
        matchdayResult = 'draw';
    }
    saveMatchdayStats(stats);

    // Process progression for matchday
    processEndGameProgression(matchdayResult === 'win', true, matchdayResult);

    showScreen('fulltime');
}

// ============================================
// Progression UI Functions
// ============================================

/**
 * Update the title screen level badge
 */
export function updateTitleLevelBadge() {
    const profile = getPlayerProfile();
    if (elements.titleLevelNum) {
        elements.titleLevelNum.textContent = profile.level;
    }
    if (elements.titleLevelTitle) {
        elements.titleLevelTitle.textContent = profile.levelTitle;
    }
}

/**
 * Render the profile screen
 */
export function renderProfileScreen() {
    const profile = getPlayerProfile();
    const achievements = getAllAchievements();
    const weeklyChallenge = getWeeklyChallenge();
    const seasonChallenges = getSeasonChallenges();

    // Level & XP
    if (elements.profileLevel) {
        elements.profileLevel.textContent = `Lv. ${profile.level}`;
    }
    if (elements.profileLevelTitle) {
        elements.profileLevelTitle.textContent = profile.levelTitle;
    }
    if (elements.profileXpFill) {
        elements.profileXpFill.style.width = `${profile.xpProgress.progress * 100}%`;
    }
    if (elements.profileXpText) {
        elements.profileXpText.textContent = `${profile.xpProgress.current} / ${profile.xpProgress.needed} XP`;
    }

    // Stats
    if (elements.profileStatWins) {
        elements.profileStatWins.textContent = profile.stats.totalWins;
    }
    if (elements.profileStatMatchdays) {
        elements.profileStatMatchdays.textContent = profile.stats.totalMatchdayWins;
    }
    if (elements.profileStatChants) {
        elements.profileStatChants.textContent = profile.stats.totalChantsPlayed;
    }
    if (elements.profileStatCombo) {
        elements.profileStatCombo.textContent = profile.stats.highestCombo;
    }
    if (elements.profileStatPerfects) {
        elements.profileStatPerfects.textContent = profile.stats.totalPerfectHits;
    }
    if (elements.profileStatHighScore) {
        elements.profileStatHighScore.textContent = profile.stats.highestScore;
    }

    // Achievement count
    if (elements.profileAchievementCount) {
        const unlocked = achievements.filter(a => a.unlocked).length;
        elements.profileAchievementCount.textContent = `${unlocked}/${achievements.length}`;
    }

    // Club Loyalty
    if (profile.mostPlayedClub) {
        const clubId = profile.mostPlayedClub.clubId;
        const club = clubs[clubId];
        const loyalty = getClubLoyalty(clubId);

        if (elements.profileLoyaltyClub) {
            elements.profileLoyaltyClub.textContent = `${club?.name || clubId} (${loyalty.games} games)`;
        }
        if (elements.profileLoyaltyBadges) {
            elements.profileLoyaltyBadges.innerHTML = '';
            loyalty.badges.forEach(badge => {
                const span = document.createElement('span');
                span.className = 'loyalty-badge';
                span.textContent = `${badge.icon} ${badge.name}`;
                elements.profileLoyaltyBadges.appendChild(span);
            });
            if (loyalty.badges.length === 0) {
                const span = document.createElement('span');
                span.className = 'loyalty-badge empty';
                span.textContent = 'No badges yet';
                elements.profileLoyaltyBadges.appendChild(span);
            }
        }
        if (elements.profileLoyaltyProgressFill && loyalty.nextBadge) {
            elements.profileLoyaltyProgressFill.style.width = `${loyalty.progressPercent}%`;
        } else if (elements.profileLoyaltyProgressFill) {
            elements.profileLoyaltyProgressFill.style.width = '100%';
        }
        if (elements.profileLoyaltyProgressText && loyalty.nextBadge) {
            elements.profileLoyaltyProgressText.textContent = `${loyalty.gamesNeeded} games to ${loyalty.nextBadge.name}`;
        } else if (elements.profileLoyaltyProgressText) {
            elements.profileLoyaltyProgressText.textContent = 'All badges earned!';
        }
    } else {
        if (elements.profileLoyaltyClub) {
            elements.profileLoyaltyClub.textContent = 'No club yet';
        }
        if (elements.profileLoyaltyBadges) {
            elements.profileLoyaltyBadges.innerHTML = '';
            const span = document.createElement('span');
            span.className = 'loyalty-badge empty';
            span.textContent = 'Play games to earn badges';
            elements.profileLoyaltyBadges.appendChild(span);
        }
        if (elements.profileLoyaltyProgressFill) {
            elements.profileLoyaltyProgressFill.style.width = '0%';
        }
        if (elements.profileLoyaltyProgressText) {
            elements.profileLoyaltyProgressText.textContent = '';
        }
    }

    // Achievements
    if (elements.profileAchievementsGrid) {
        elements.profileAchievementsGrid.innerHTML = '';
        achievements.forEach(achievement => {
            const div = document.createElement('div');
            div.className = `achievement-card ${achievement.unlocked ? 'unlocked' : 'locked'}`;

            const icon = document.createElement('span');
            icon.className = 'achievement-icon';
            icon.textContent = achievement.icon;

            const info = document.createElement('div');
            info.className = 'achievement-info';

            const name = document.createElement('span');
            name.className = 'achievement-name';
            name.textContent = achievement.name;

            const desc = document.createElement('span');
            desc.className = 'achievement-desc';
            desc.textContent = achievement.description;

            info.appendChild(name);
            info.appendChild(desc);

            // Add progress bar for trackable achievements that aren't unlocked
            if (!achievement.unlocked && achievement.isTrackable) {
                const progressText = document.createElement('span');
                progressText.className = 'achievement-progress-text';
                progressText.textContent = `${achievement.progress}/${achievement.target}`;

                const progressBar = document.createElement('div');
                progressBar.className = 'achievement-progress-bar';

                const progressFill = document.createElement('div');
                progressFill.className = 'achievement-progress-fill';
                progressFill.style.width = `${achievement.progressPercent}%`;

                progressBar.appendChild(progressFill);
                info.appendChild(progressText);
                info.appendChild(progressBar);
            }

            div.appendChild(icon);
            div.appendChild(info);

            elements.profileAchievementsGrid.appendChild(div);
        });
    }

    // Weekly Challenge
    if (elements.profileWeeklyChallenge && weeklyChallenge) {
        elements.profileWeeklyChallenge.innerHTML = '';
        const div = document.createElement('div');
        div.className = `challenge-item ${weeklyChallenge.completed ? 'completed' : ''}`;

        const icon = document.createElement('span');
        icon.className = 'challenge-icon';
        icon.textContent = weeklyChallenge.icon;

        const info = document.createElement('div');
        info.className = 'challenge-info';

        const desc = document.createElement('div');
        desc.className = 'challenge-desc';
        desc.textContent = weeklyChallenge.description;

        const progress = document.createElement('span');
        progress.className = 'challenge-progress';
        progress.textContent = `${weeklyChallenge.progress}/${weeklyChallenge.target}`;

        const progressBar = document.createElement('div');
        progressBar.className = 'challenge-progress-bar';

        const progressFill = document.createElement('div');
        progressFill.className = 'challenge-progress-fill';
        progressFill.style.width = `${weeklyChallenge.progressPercent}%`;

        progressBar.appendChild(progressFill);

        info.appendChild(desc);
        info.appendChild(progress);
        info.appendChild(progressBar);

        const reward = document.createElement('span');
        reward.className = 'challenge-reward';
        reward.textContent = weeklyChallenge.completed
            ? `+${weeklyChallenge.xpReward} XP ✓`
            : `+${weeklyChallenge.xpReward} XP`;

        div.appendChild(icon);
        div.appendChild(info);
        div.appendChild(reward);

        elements.profileWeeklyChallenge.appendChild(div);
    } else if (elements.profileWeeklyChallenge) {
        elements.profileWeeklyChallenge.innerHTML = '<p class="no-challenge">No active challenge</p>';
    }

    // Season Challenges
    if (elements.profileSeasonChallenges) {
        elements.profileSeasonChallenges.innerHTML = '';
        seasonChallenges.forEach(challenge => {
            const div = document.createElement('div');
            div.className = `challenge-item ${challenge.completed ? 'completed' : ''}`;

            const icon = document.createElement('span');
            icon.className = 'challenge-icon';
            icon.textContent = challenge.icon;

            const info = document.createElement('div');
            info.className = 'challenge-info';

            const desc = document.createElement('div');
            desc.className = 'challenge-desc';
            desc.textContent = challenge.description;

            const progress = document.createElement('span');
            progress.className = 'challenge-progress';
            progress.textContent = `${challenge.progress}/${challenge.target}`;

            info.appendChild(desc);
            info.appendChild(progress);

            const reward = document.createElement('span');
            reward.className = 'challenge-reward';
            reward.textContent = challenge.completed
                ? `+${challenge.xpReward} XP ✓`
                : `+${challenge.xpReward} XP`;

            div.appendChild(icon);
            div.appendChild(info);
            div.appendChild(reward);

            elements.profileSeasonChallenges.appendChild(div);
        });

        if (seasonChallenges.length === 0) {
            elements.profileSeasonChallenges.innerHTML = '<p class="no-challenge">No season challenges</p>';
        }
    }

    // Render Choreos Section
    const choreoStatuses = getAllChoreoStatuses();

    // Update choreo count
    if (elements.profileChoreoCount) {
        const unlockedCount = choreoStatuses.filter(c => c.unlocked).length;
        elements.profileChoreoCount.textContent = `${unlockedCount}/${choreoStatuses.length}`;
    }

    // Render choreo grid
    if (elements.profileChoreosGrid) {
        elements.profileChoreosGrid.innerHTML = '';

        choreoStatuses.forEach(choreo => {
            const div = document.createElement('div');
            div.className = `choreo-item${choreo.unlocked ? ' unlocked' : ' locked'}`;

            const icon = document.createElement('span');
            icon.className = 'choreo-icon';
            icon.textContent = choreo.unlocked ? choreo.icon : '🔒';

            const info = document.createElement('div');
            info.className = 'choreo-info';

            const name = document.createElement('span');
            name.className = 'choreo-name';
            name.textContent = choreo.name;

            const status = document.createElement('span');
            status.className = 'choreo-status';
            if (choreo.unlocked) {
                status.textContent = 'Unlocked';
            } else if (choreo.unlockRequirement) {
                if (choreo.unlockRequirement.type === 'level') {
                    status.textContent = `Level ${choreo.unlockRequirement.level}`;
                } else if (choreo.unlockRequirement.type === 'achievement') {
                    status.textContent = choreo.unlockRequirement.achievementName;
                }
            }

            info.appendChild(name);
            info.appendChild(status);

            // Add progress bar for locked choreos with trackable progress
            if (!choreo.unlocked && choreo.progress !== null && choreo.target !== null) {
                const progressText = document.createElement('span');
                progressText.className = 'choreo-progress-text';
                progressText.textContent = `${choreo.progress}/${choreo.target}`;

                const progressBar = document.createElement('div');
                progressBar.className = 'choreo-progress-bar';

                const progressFill = document.createElement('div');
                progressFill.className = 'choreo-progress-fill';
                progressFill.style.width = `${choreo.progressPercent}%`;

                progressBar.appendChild(progressFill);
                info.appendChild(progressText);
                info.appendChild(progressBar);
            }

            div.appendChild(icon);
            div.appendChild(info);

            elements.profileChoreosGrid.appendChild(div);
        });
    }
}

/**
 * Show XP gained popup
 */
export function showXPGained(xpResult) {
    if (!elements.xpPopup) return;

    // Update XP gained text
    if (elements.xpGained) {
        elements.xpGained.textContent = `+${xpResult.xpGained} XP`;
    }

    // Handle level up
    if (xpResult.leveledUp) {
        if (elements.xpLevelUp) {
            elements.xpLevelUp.classList.remove('hidden');
        }
        if (elements.xpNewLevel) {
            elements.xpNewLevel.textContent = `Level ${xpResult.newLevel}`;
        }
        if (elements.xpNewTitle) {
            const title = getLevelTitle(xpResult.newLevel);
            elements.xpNewTitle.textContent = title;
        }
    } else {
        if (elements.xpLevelUp) {
            elements.xpLevelUp.classList.add('hidden');
        }
    }

    // Hide unlock section (will be shown by notifications if needed)
    if (elements.xpUnlock) {
        elements.xpUnlock.classList.add('hidden');
    }

    elements.xpPopup.classList.remove('hidden');

    // Auto-hide after 3 seconds
    setTimeout(() => {
        elements.xpPopup.classList.add('hidden');
    }, 3000);
}

/**
 * Update XP reward display on results screen
 */
function updateXPRewardDisplay(progressionResult) {
    if (!progressionResult || !progressionResult.xp) return;

    const { xp } = progressionResult;

    // Update XP gained amount
    if (elements.xpRewardAmount) {
        elements.xpRewardAmount.textContent = `+${xp.xpGained} XP`;
    }

    // Get current XP progress for the bar
    const xpProgress = getXPForNextLevel();

    // Update mini progress bar fill
    if (elements.xpMiniFill) {
        const percent = Math.min(100, xpProgress.progress * 100);
        elements.xpMiniFill.style.width = `${percent}%`;
    }

    // Update level display
    if (elements.xpMiniLevel) {
        elements.xpMiniLevel.textContent = `Lv. ${progressionResult.level}`;
    }
}

/**
 * Show level up popup with unlock
 */
export function showLevelUpPopup(notification) {
    if (!elements.xpPopup) return;

    if (elements.xpGained) {
        elements.xpGained.textContent = 'LEVEL UP!';
    }
    if (elements.xpLevelUp) {
        elements.xpLevelUp.classList.remove('hidden');
    }
    if (elements.xpNewLevel) {
        elements.xpNewLevel.textContent = `Level ${notification.level}`;
    }
    if (elements.xpNewTitle) {
        elements.xpNewTitle.textContent = notification.title;
    }

    if (notification.unlock && elements.xpUnlock) {
        elements.xpUnlock.classList.remove('hidden');
        if (elements.xpUnlockName) {
            elements.xpUnlockName.textContent = notification.unlock.name;
        }
    } else if (elements.xpUnlock) {
        elements.xpUnlock.classList.add('hidden');
    }

    elements.xpPopup.classList.remove('hidden');

    // Auto-hide after 3 seconds
    setTimeout(() => {
        elements.xpPopup.classList.add('hidden');
    }, 3000);
}

/**
 * Show achievement popup
 */
export function showAchievementPopup(achievement) {
    if (!elements.achievementPopup) return;

    if (elements.achievementPopupIcon) {
        elements.achievementPopupIcon.textContent = achievement.icon;
    }
    if (elements.achievementPopupName) {
        elements.achievementPopupName.textContent = achievement.name;
    }

    elements.achievementPopup.classList.remove('hidden');

    // Auto-hide after 3 seconds
    setTimeout(() => {
        elements.achievementPopup.classList.add('hidden');
    }, 3000);
}

/**
 * Process and show pending notifications
 */
export function showPendingNotifications() {
    const notifications = getPendingNotifications();
    let delay = 0;

    notifications.forEach(notification => {
        setTimeout(() => {
            if (notification.type === 'level_up') {
                showLevelUpPopup(notification);
            } else if (notification.type === 'achievement') {
                showAchievementPopup(notification.achievement);
            } else if (notification.type === 'loyalty_badge') {
                // Use achievement popup for badges too
                showAchievementPopup({
                    icon: notification.badge.icon,
                    name: notification.badge.name,
                    description: `${notification.clubName} Loyalty Badge`
                });
            } else if (notification.type === 'challenge_complete') {
                showAchievementPopup({
                    icon: '🎯',
                    name: 'Challenge Complete!',
                    description: notification.challenge.name
                });
            } else if (notification.type === 'choreo_unlock') {
                // Show choreo unlock notification
                showAchievementPopup({
                    icon: notification.icon || '🎭',
                    name: `${notification.name} Unlocked!`,
                    description: notification.reason || 'New choreo available!'
                });
            }
        }, delay);
        delay += 3500;  // Stagger notifications
    });
}

/**
 * Process game end for progression
 */
function processEndGameProgression(isWin, isMatchday = false, matchdayResult = null) {
    const totalHits = state.playerStats.perfect + state.playerStats.good + state.playerStats.ok;
    const accuracy = state.totalBeats > 0
        ? Math.round((totalHits / state.totalBeats) * 100)
        : 0;

    // Determine if this was a comeback victory (was behind 500+ points and won)
    const wasComeback = isWin && state.wasEverBehind500;

    const gameResult = {
        clubId: state.selectedClub?.id,
        chantId: state.selectedChant?.id,
        score: state.playerScore,
        maxCombo: state.playerMaxCombo,
        perfectHits: state.playerStats.perfect,
        misses: state.playerStats.miss,
        accuracy,
        won: isWin,
        isMatchday,
        matchdayResult,
        rivalClubId: state.rivalClub?.id,
        feverTime: state.feverTimeAccumulated || 0,
        wasComeback  // For Comeback King achievement
    };

    // Save to game history for analytics
    saveGameRecord({
        clubId: state.selectedClub?.id,
        chantId: state.selectedChant?.id,
        chantName: state.selectedChant?.name || state.selectedChant?.id,
        difficulty: state.settings.difficulty,
        gameMode: isMatchday ? 'matchday' : 'practice',
        score: state.playerScore,
        totalBeats: state.totalBeats,
        perfectHits: state.playerStats.perfect,
        goodHits: state.playerStats.good,
        okHits: state.playerStats.ok,
        misses: state.playerStats.miss,
        accuracy,
        maxCombo: state.playerMaxCombo,
        won: isWin,
        sessionId: state.sessionId
    });

    const result = processGameEnd(gameResult);

    // Show XP gained
    if (result.xp) {
        showXPGained(result.xp);
    }

    // Update title badge
    updateTitleLevelBadge();

    // Show notifications after a delay
    setTimeout(() => {
        showPendingNotifications();
    }, 1000);

    return result;
}

// ============================================
// Analytics Dashboard
// ============================================

/**
 * Initialize analytics session on app start
 */
export function initAnalyticsSession() {
    initSession();
}

/**
 * Switch between Stats and Analytics tabs on profile screen
 */
export function switchProfileTab(tab) {
    if (tab === 'stats') {
        elements.profileTabStats?.classList.add('active');
        elements.profileTabAnalytics?.classList.remove('active');
        elements.profileStatsContent?.classList.remove('hidden');
        elements.profileAnalyticsContent?.classList.add('hidden');
    } else if (tab === 'analytics') {
        elements.profileTabStats?.classList.remove('active');
        elements.profileTabAnalytics?.classList.add('active');
        elements.profileStatsContent?.classList.add('hidden');
        elements.profileAnalyticsContent?.classList.remove('hidden');
        renderAnalyticsDashboard();
    }
}

/**
 * Render the analytics dashboard charts and stats
 */
export function renderAnalyticsDashboard() {
    // Session summary
    const sessionStats = getSessionStats();
    if (elements.analyticsSessionGames) {
        elements.analyticsSessionGames.textContent = sessionStats.gamesPlayed;
    }
    if (elements.analyticsSessionAccuracy) {
        elements.analyticsSessionAccuracy.textContent = `${sessionStats.avgAccuracy}%`;
    }
    if (elements.analyticsSessionBest) {
        elements.analyticsSessionBest.textContent = sessionStats.bestScore.toLocaleString();
    }
    if (elements.analyticsSessionTime) {
        elements.analyticsSessionTime.textContent = formatDuration(sessionStats.totalTime);
    }

    // Accuracy trend chart
    if (elements.analyticsAccuracyCanvas) {
        const accuracyData = calculateAccuracyTrend(20);
        renderLineChart(elements.analyticsAccuracyCanvas, {
            values: accuracyData.values,
            labels: accuracyData.labels
        }, {
            lineColor: ANALYTICS.COLORS.perfect,
            fillColor: 'rgba(0, 255, 136, 0.15)'
        });

        // Update trend indicator
        if (elements.analyticsAccuracyTrend) {
            const trendIcon = accuracyData.trend === 'up' ? '↑' :
                              accuracyData.trend === 'down' ? '↓' : '→';
            const trendClass = accuracyData.trend === 'up' ? 'trend-up' :
                               accuracyData.trend === 'down' ? 'trend-down' : 'trend-stable';
            elements.analyticsAccuracyTrend.textContent = trendIcon;
            elements.analyticsAccuracyTrend.className = `trend-indicator ${trendClass}`;
        }
    }

    // Score trend chart
    if (elements.analyticsScoreCanvas) {
        const scoreData = calculateScoreTrend(20);
        renderLineChart(elements.analyticsScoreCanvas, {
            values: scoreData.values,
            labels: scoreData.labels
        }, {
            lineColor: ANALYTICS.COLORS.trend,
            fillColor: ANALYTICS.COLORS.trendFill
        });

        if (elements.analyticsScoreTrend) {
            const trendIcon = scoreData.trend === 'up' ? '↑' :
                              scoreData.trend === 'down' ? '↓' : '→';
            const trendClass = scoreData.trend === 'up' ? 'trend-up' :
                               scoreData.trend === 'down' ? 'trend-down' : 'trend-stable';
            elements.analyticsScoreTrend.textContent = trendIcon;
            elements.analyticsScoreTrend.className = `trend-indicator ${trendClass}`;
        }
    }

    // Hit distribution pie chart
    if (elements.analyticsHitsCanvas) {
        const hitData = calculateHitDistribution();
        renderPieChart(elements.analyticsHitsCanvas, [
            { value: hitData.perfect, color: ANALYTICS.COLORS.perfect, label: 'Perfect' },
            { value: hitData.good, color: ANALYTICS.COLORS.good, label: 'Good' },
            { value: hitData.ok, color: ANALYTICS.COLORS.ok, label: 'OK' },
            { value: hitData.miss, color: ANALYTICS.COLORS.miss, label: 'Miss' }
        ]);
    }

    // Club performance bar chart
    if (elements.analyticsClubCanvas) {
        const clubStats = getClubStats();
        const chartData = clubStats.slice(0, 5).map(club => ({
            label: club.clubId?.toUpperCase() || 'Unknown',
            value: club.avgAccuracy,
            color: ANALYTICS.COLORS.trend
        }));
        renderBarChart(elements.analyticsClubCanvas, chartData, {
            barHeight: 18,
            showValues: true
        });
    }

    // Best/worst chants
    const chantPerf = getChantPerformance();

    if (elements.analyticsBestChants) {
        elements.analyticsBestChants.innerHTML = '';
        if (chantPerf.best.length === 0) {
            elements.analyticsBestChants.innerHTML = '<div class="chant-perf-empty">Play more chants to see stats</div>';
        } else {
            chantPerf.best.forEach(chant => {
                const div = document.createElement('div');
                div.className = 'chant-perf-item';
                div.innerHTML = `
                    <span class="chant-perf-name">${chant.chantName}</span>
                    <span class="chant-perf-accuracy" style="color: ${ANALYTICS.COLORS.perfect}">${chant.avgAccuracy}%</span>
                `;
                elements.analyticsBestChants.appendChild(div);
            });
        }
    }

    if (elements.analyticsWorstChants) {
        elements.analyticsWorstChants.innerHTML = '';
        if (chantPerf.worst.length === 0) {
            elements.analyticsWorstChants.innerHTML = '<div class="chant-perf-empty">Play more chants to see stats</div>';
        } else {
            chantPerf.worst.forEach(chant => {
                const div = document.createElement('div');
                div.className = 'chant-perf-item';
                div.innerHTML = `
                    <span class="chant-perf-name">${chant.chantName}</span>
                    <span class="chant-perf-accuracy" style="color: ${ANALYTICS.COLORS.ok}">${chant.avgAccuracy}%</span>
                `;
                elements.analyticsWorstChants.appendChild(div);
            });
        }
    }
}

// ============================================
// Input Lag Calibration
// ============================================

let calibrationState = {
    isActive: false,
    audioContext: null,
    nextBeatTime: 0,
    beatCount: 0,
    tapTimes: [],
    beatTimes: [],
    intervalId: null
};

/**
 * Start the calibration process
 */
export async function startCalibration() {
    // Initialize audio context if needed
    try {
        await initAudio();
    } catch (e) {
        console.warn('Failed to init audio for calibration:', e);
    }

    // Reset calibration state
    calibrationState = {
        isActive: true,
        audioContext: state.audioContext || new (window.AudioContext || window.webkitAudioContext)(),
        nextBeatTime: 0,
        beatCount: 0,
        tapTimes: [],
        beatTimes: [],
        intervalId: null
    };

    // Show calibration modal
    const modal = document.getElementById('calibration-modal');
    const circle = document.getElementById('calibration-circle');
    const progress = document.getElementById('calibration-progress');
    const instruction = document.getElementById('calibration-instruction');

    if (modal) modal.classList.remove('hidden');
    if (instruction) instruction.textContent = 'Listen to the beat...';
    if (progress) progress.textContent = 'Warming up...';
    if (circle) circle.classList.remove('pulse');

    // Start metronome
    const tempo = CALIBRATION.TEMPO_MS;
    calibrationState.nextBeatTime = performance.now() + 500; // Small delay before first beat

    calibrationState.intervalId = setInterval(() => {
        if (!calibrationState.isActive) {
            clearInterval(calibrationState.intervalId);
            return;
        }

        const now = performance.now();
        if (now >= calibrationState.nextBeatTime) {
            playCalibrationClick();
            calibrationState.beatTimes.push(now);
            calibrationState.beatCount++;

            // Pulse the circle
            if (circle) {
                circle.classList.remove('pulse');
                void circle.offsetWidth;
                circle.classList.add('pulse');
            }

            // Update UI based on phase
            const totalBeats = CALIBRATION.WARMUP_BEATS + CALIBRATION.RECORD_BEATS;
            if (calibrationState.beatCount <= CALIBRATION.WARMUP_BEATS) {
                if (progress) progress.textContent = `Warming up... ${calibrationState.beatCount}/${CALIBRATION.WARMUP_BEATS}`;
            } else {
                const recordedCount = calibrationState.beatCount - CALIBRATION.WARMUP_BEATS;
                if (instruction) instruction.textContent = 'Tap along with the beat!';
                if (progress) progress.textContent = `Recording: ${Math.min(recordedCount, CALIBRATION.RECORD_BEATS)}/${CALIBRATION.RECORD_BEATS}`;
            }

            // Check if calibration is complete
            if (calibrationState.beatCount >= totalBeats) {
                finishCalibration();
            }

            calibrationState.nextBeatTime += tempo;
        }
    }, 10); // Check every 10ms for precise timing

    // Add input listeners for calibration
    document.addEventListener('keydown', handleCalibrationKeyDown);
    document.addEventListener('touchstart', handleCalibrationTouch);
    document.addEventListener('mousedown', handleCalibrationMouse);
}

/**
 * Play metronome click sound
 */
function playCalibrationClick() {
    const ctx = calibrationState.audioContext;
    if (!ctx) return;

    try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.frequency.value = 880; // A5
        osc.type = 'sine';

        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialDecayTo?.(0.001, ctx.currentTime + 0.1) ||
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);

        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.1);
    } catch (e) {
        console.warn('Failed to play calibration click:', e);
    }
}

/**
 * Handle tap during calibration
 */
function handleCalibrationTap() {
    if (!calibrationState.isActive) return;

    // Only record after warmup
    if (calibrationState.beatCount <= CALIBRATION.WARMUP_BEATS) return;

    const now = performance.now();
    calibrationState.tapTimes.push(now);

    // Visual feedback
    const circle = document.getElementById('calibration-circle');
    if (circle) {
        circle.classList.add('tapped');
        setTimeout(() => circle.classList.remove('tapped'), 100);
    }
}

function handleCalibrationKeyDown(e) {
    if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        handleCalibrationTap();
    } else if (e.code === 'Escape') {
        cancelCalibration();
    }
}

function handleCalibrationTouch(e) {
    if (!calibrationState.isActive) return;
    // Don't handle touches on cancel button
    if (e.target.closest('#calibration-cancel')) return;
    e.preventDefault();
    handleCalibrationTap();
}

function handleCalibrationMouse(e) {
    if (!calibrationState.isActive) return;
    // Don't handle clicks on cancel button
    if (e.target.closest('#calibration-cancel')) return;
    handleCalibrationTap();
}

/**
 * Finish calibration and calculate offset
 */
function finishCalibration() {
    calibrationState.isActive = false;
    clearInterval(calibrationState.intervalId);

    // Remove input listeners
    document.removeEventListener('keydown', handleCalibrationKeyDown);
    document.removeEventListener('touchstart', handleCalibrationTouch);
    document.removeEventListener('mousedown', handleCalibrationMouse);

    // Get beats from recording phase only (skip warmup)
    const recordingBeatTimes = calibrationState.beatTimes.slice(CALIBRATION.WARMUP_BEATS);
    const tapTimes = calibrationState.tapTimes;

    // Calculate offsets: for each tap, find the closest beat and compute difference
    const offsets = [];
    for (const tapTime of tapTimes) {
        let closestBeat = null;
        let closestDiff = Infinity;

        for (const beatTime of recordingBeatTimes) {
            const diff = tapTime - beatTime; // Positive = tap after beat (late)
            if (Math.abs(diff) < Math.abs(closestDiff)) {
                closestDiff = diff;
                closestBeat = beatTime;
            }
        }

        // Only include if within outlier threshold
        if (Math.abs(closestDiff) <= CALIBRATION.OUTLIER_THRESHOLD) {
            offsets.push(closestDiff);
        }
    }

    let finalOffset = 0;
    const progress = document.getElementById('calibration-progress');
    const instruction = document.getElementById('calibration-instruction');

    if (offsets.length >= 3) {
        // Calculate average offset
        const avgOffset = offsets.reduce((a, b) => a + b, 0) / offsets.length;

        // Clamp to valid range
        finalOffset = Math.round(Math.max(CALIBRATION.MIN_OFFSET, Math.min(CALIBRATION.MAX_OFFSET, avgOffset)));

        // Save to settings
        const settings = loadSettings();
        settings.inputOffset = finalOffset;
        saveSettings(settings);
        state.settings.inputOffset = finalOffset;

        // Update display
        const sign = finalOffset >= 0 ? '+' : '';
        if (instruction) instruction.textContent = 'Calibration Complete!';
        if (progress) progress.textContent = `Offset: ${sign}${finalOffset}ms`;

        // Update the current offset display
        const offsetDisplay = document.getElementById('current-offset');
        if (offsetDisplay) {
            offsetDisplay.textContent = `${sign}${finalOffset}ms`;
        }
    } else {
        if (instruction) instruction.textContent = 'Not enough taps recorded';
        if (progress) progress.textContent = 'Please try again';
    }

    // Auto-close after delay
    setTimeout(() => {
        const modal = document.getElementById('calibration-modal');
        if (modal) modal.classList.add('hidden');
    }, 2000);
}

/**
 * Cancel calibration without saving
 */
export function cancelCalibration() {
    calibrationState.isActive = false;
    clearInterval(calibrationState.intervalId);

    // Remove input listeners
    document.removeEventListener('keydown', handleCalibrationKeyDown);
    document.removeEventListener('touchstart', handleCalibrationTouch);
    document.removeEventListener('mousedown', handleCalibrationMouse);

    // Hide modal
    const modal = document.getElementById('calibration-modal');
    if (modal) modal.classList.add('hidden');
}
