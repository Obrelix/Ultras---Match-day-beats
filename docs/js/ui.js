// ============================================
// ui.js — Screen management, navigation, DOM elements
// ============================================

import { GameState, clubs, MATCHDAY, ACHIEVEMENTS, LOYALTY_CONFIG } from './config.js';
import { state } from './state.js';
import { stopAudio } from './audio.js';
import { saveHighScore, loadHighScore, saveMatchdayStats, loadMatchdayStats } from './storage.js';
import { setCrowdEmotion } from './crowd.js';
import { setCrowdMode } from './crowdBg.js';
import { stopRecording } from './replay.js';
import {
    processGameEnd, getPlayerProfile, getAllAchievements,
    getWeeklyChallenge, getSeasonChallenges, getClubLoyalty,
    getPendingNotifications, getLevelBadge, loadProgression, getLevelTitle,
    getXPForNextLevel
} from './progression.js';
// DOM Elements (module runs after DOM is parsed due to type="module")
export const screens = {
    title: document.getElementById('title-screen'),
    modeSelect: document.getElementById('mode-select-screen'),
    clubSelect: document.getElementById('club-select-screen'),
    chantSelect: document.getElementById('chant-select-screen'),
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

export function showScreen(screenName) {
    Object.values(screens).forEach(screen => screen.classList.remove('active'));
    screens[screenName].classList.add('active');
    state.currentState = screenName;
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

            const name = document.createElement('span');
            name.className = 'achievement-name';
            name.textContent = achievement.name;

            const desc = document.createElement('span');
            desc.className = 'achievement-desc';
            desc.textContent = achievement.description;

            div.appendChild(icon);
            div.appendChild(name);
            div.appendChild(desc);

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
        rivalClubId: state.rivalClub?.id
    };

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
