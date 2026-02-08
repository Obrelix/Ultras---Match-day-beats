// ============================================
// ui.js — Screen management, navigation, DOM elements
// ============================================

import { GameState, clubs } from './config.js';
import { state } from './state.js';
import { stopAudio } from './audio.js';

// DOM Elements (module runs after DOM is parsed due to type="module")
export const screens = {
    title: document.getElementById('title-screen'),
    clubSelect: document.getElementById('club-select-screen'),
    chantSelect: document.getElementById('chant-select-screen'),
    gameplay: document.getElementById('gameplay-screen'),
    results: document.getElementById('results-screen')
};

export const elements = {
    startBtn: document.getElementById('start-btn'),
    backToTitle: document.getElementById('back-to-title'),
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
    statMaxCombo: document.getElementById('stat-max-combo')
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

export function renderClubSelection(onSelectClub) {
    elements.clubGrid.innerHTML = '';

    Object.values(clubs).forEach(club => {
        const card = document.createElement('div');
        card.className = 'club-card';
        card.innerHTML = `
            <div class="club-badge" style="background: ${club.colors.primary}; color: ${club.colors.secondary}">
                ${club.badge}
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

export function endGame() {
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
