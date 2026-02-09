// ============================================
// ui.js — Screen management, navigation, DOM elements
// ============================================

import { GameState, clubs, MATCHDAY } from './config.js';
import { state } from './state.js';
import { stopAudio } from './audio.js';

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
    currentChantName: document.getElementById('current-chant-name'),
    gameVisualCanvas: document.getElementById('game-visual-canvas'),
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

    // Match scoreboard (in-game)
    matchScoreboard: document.getElementById('match-scoreboard'),
    matchScorePlayer: document.getElementById('match-score-player'),
    matchScoreAi: document.getElementById('match-score-ai'),
    matchHalfLabel: document.getElementById('match-half-label'),
    matchChantProgress: document.getElementById('match-chant-progress'),

    // Chant result
    chantResultPlayerGoals: document.getElementById('chant-result-player-goals'),
    chantResultAiGoals: document.getElementById('chant-result-ai-goals'),
    chantResultMessage: document.getElementById('chant-result-message'),
    chantResultDetail: document.getElementById('chant-result-detail'),

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
    fulltimeMainMenuBtn: document.getElementById('fulltime-main-menu-btn')
};

export function showScreen(screenName) {
    Object.values(screens).forEach(screen => screen.classList.remove('active'));
    screens[screenName].classList.add('active');
    state.currentState = screenName;
}

export function applyClubTheme(club) {
    document.documentElement.style.setProperty('--primary-color', club.colors.primary);
    document.documentElement.style.setProperty('--secondary-color', club.colors.secondary);
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
        const item = document.createElement('div');
        item.className = 'chant-item';
        item.innerHTML = `
            <div class="chant-name">${chant.name}</div>
            <div class="chant-info">Click to play</div>
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

    elements.statPerfect.textContent = state.playerStats.perfect;
    elements.statGood.textContent = state.playerStats.good;
    elements.statOk.textContent = state.playerStats.ok;
    elements.statMiss.textContent = state.playerStats.miss;
    elements.statMaxCombo.textContent = state.playerMaxCombo;

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

    // Evaluate player goal
    const comboRatio = state.totalBeats > 0 ? state.playerMaxCombo / state.totalBeats : 0;
    const playerScored = comboRatio >= MATCHDAY.GOAL_COMBO_THRESHOLD;

    // Evaluate AI goal
    const aiScored = Math.random() < MATCHDAY.AI_GOAL_CHANCE;

    if (playerScored) state.playerGoals++;
    if (aiScored) state.aiGoals++;

    // Record result
    state.chantResults.push({
        chant: state.matchChants[state.currentChantIndex],
        playerScored,
        aiScored,
        comboRatio,
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

    const prevResult = state.chantResults[state.chantResults.length - 1];
    elements.chantResultDetail.textContent =
        `Max combo: ${prevResult.maxCombo}/${prevResult.totalBeats} beats (${Math.round(prevResult.comboRatio * 100)}%)`;

    showScreen('chantResult');

    // Auto-advance after transition delay
    setTimeout(() => {
        if (state.currentChantIndex === MATCHDAY.CHANTS_PER_HALF) {
            state.currentHalf = 2;
            showHalftime();
        } else if (state.currentChantIndex === MATCHDAY.CHANTS_PER_HALF * 2) {
            showFulltime();
        } else {
            if (_startNextChant) _startNextChant();
        }
    }, MATCHDAY.CHANT_TRANSITION_MS);
}

export function showHalftime() {
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

    // Full match summary
    const lines = state.chantResults.map((r, i) => {
        const half = i < MATCHDAY.CHANTS_PER_HALF ? '1st' : '2nd';
        const you = r.playerScored ? 'GOAL' : '-';
        const rival = r.aiScored ? 'GOAL' : '-';
        return `${half} Half - Chant ${(i % MATCHDAY.CHANTS_PER_HALF) + 1}: You ${you} | Rival ${rival}`;
    });
    elements.fulltimeSummary.innerHTML = lines.join('<br>');

    showScreen('fulltime');
}
