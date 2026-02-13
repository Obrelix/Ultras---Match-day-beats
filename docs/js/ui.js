// ============================================
// ui.js — Screen management, navigation, DOM elements
// ============================================

import { GameState, clubs, MATCHDAY } from './config.js';
import { state } from './state.js';
import { stopAudio } from './audio.js';
import { saveHighScore, loadHighScore, saveMatchdayStats, loadMatchdayStats } from './storage.js';
import { setCrowdEmotion } from './crowd.js';
import { setCrowdMode } from './crowdBg.js';

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
    fulltime: document.getElementById('fulltime-screen')
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

    // Volume / Settings
    volumeToggle: document.getElementById('volume-toggle'),
    volumePanel: document.getElementById('volume-panel'),
    volumeSlider: document.getElementById('volume-slider'),
    sfxVolumeSlider: document.getElementById('sfx-volume-slider'),
    reducedEffectsToggle: document.getElementById('reduced-effects-toggle'),

    // AI score popup
    aiScorePopupContainer: document.getElementById('ai-score-popup-container'),

    // High score
    highScoreDisplay: document.getElementById('high-score-display'),
    highScoreValue: document.getElementById('high-score-value'),
};

export function showScreen(screenName) {
    Object.values(screens).forEach(screen => screen.classList.remove('active'));
    screens[screenName].classList.add('active');
    state.currentState = screenName;
}

export function applyClubTheme(club) {
    document.documentElement.style.setProperty('--primary-color', club.colors.primary);
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
        card.innerHTML = `
            <div class="club-badge" style="background: ${club.colors.primary}">
                <img src="${club.badge}" alt="${club.name}">
            </div>
            <div class="club-name">${club.name}</div>
        `;
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
        item.innerHTML = `
            <div class="chant-name">${chant.name}</div>
            <div class="chant-info">${highScore > 0 ? `Best: ${highScore}` : 'Click to play'}</div>
        `;
        item.addEventListener('click', () => onSelectChant(chant));
        elements.chantList.appendChild(item);
    });
}

export function renderMatchdayIntro() {
    const player = state.selectedClub;
    const rival = state.rivalClub;

    elements.matchupPlayerBadge.innerHTML = `<img src="${player.badge}" alt="${player.name}">`;
    elements.matchupPlayerBadge.style.background = player.colors.primary;
    elements.matchupPlayerName.textContent = player.name;

    elements.matchupRivalBadge.innerHTML = `<img src="${rival.badge}" alt="${rival.name}">`;
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
    }

    showScreen('results');
}

// Match Day: called when a chant ends during matchday mode
// onStartNextChant is set by main.js via setMatchdayChantStarter
let _startNextChant = null;

export function setMatchdayChantStarter(fn) {
    _startNextChant = fn;
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

    const prevResult = state.chantResults[state.chantResults.length - 1];
    elements.chantResultDetail.textContent =
        `Accuracy: ${Math.round(prevResult.accuracy * 100)}% | Max combo: ${prevResult.maxCombo} — Score 40% to score a goal!`;

    // Set up next-chant button
    let btnText, btnAction;
    if (state.currentChantIndex === MATCHDAY.CHANTS_PER_HALF) {
        btnText = 'HALF TIME';
        btnAction = () => {
            state.currentHalf = 2;
            showHalftime();
        };
    } else if (state.currentChantIndex === MATCHDAY.CHANTS_PER_HALF * 2) {
        btnText = 'FULL TIME';
        btnAction = () => {
            showFulltime();
        };
    } else {
        btnText = 'NEXT CHANT';
        btnAction = () => {
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

    // Summary of first half
    const lines = state.chantResults.map((r, i) =>
        `Chant ${i + 1}: ${r.playerScored ? 'GOAL' : '-'} | Rival: ${r.aiScored ? 'GOAL' : '-'}`
    );
    elements.halftimeSummary.innerHTML = lines.join('<br>');

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

    // Full match summary
    const lines = state.chantResults.map((r, i) => {
        const half = i < MATCHDAY.CHANTS_PER_HALF ? '1st' : '2nd';
        const you = r.playerScored ? 'GOAL' : '-';
        const rival = r.aiScored ? 'GOAL' : '-';
        return `${half} Half - Chant ${(i % MATCHDAY.CHANTS_PER_HALF) + 1}: You ${you} | Rival ${rival}`;
    });
    elements.fulltimeSummary.innerHTML = lines.join('<br>');

    // Persist matchday stats
    const stats = loadMatchdayStats();
    stats.played++;
    if (state.playerGoals > state.aiGoals) stats.won++;
    else if (state.playerGoals < state.aiGoals) stats.lost++;
    else stats.drawn++;
    saveMatchdayStats(stats);

    showScreen('fulltime');
}
