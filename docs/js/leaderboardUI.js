// ============================================
// leaderboardUI.js — Leaderboard UI rendering
// ============================================

import { LEADERBOARD, createLogger } from './config.js';

const log = createLogger('LeaderboardUI');
import { state } from './state.js';
import {
    initLeaderboard, submitScore, fetchLeaderboard, getPlayerRank,
    getPlayerProfile, setPlayerName, hasPlayerName, isOnline
} from './leaderboard.js';
import { showScreen, elements, screens } from './ui.js';

// ============================================
// UI Elements (populated after DOM ready)
// ============================================

let leaderboardElements = null;

function getLeaderboardElements() {
    if (leaderboardElements) return leaderboardElements;

    leaderboardElements = {
        // Leaderboard screen
        screen: document.getElementById('leaderboard-screen'),
        title: document.getElementById('leaderboard-title'),
        filterBtns: document.querySelectorAll('.leaderboard-filter-btn'),
        entriesList: document.getElementById('leaderboard-entries'),
        loading: document.getElementById('leaderboard-loading'),
        emptyState: document.getElementById('leaderboard-empty'),
        offlineNotice: document.getElementById('leaderboard-offline'),
        backBtn: document.getElementById('leaderboard-back-btn'),

        // Name modal
        nameModal: document.getElementById('name-modal'),
        nameInput: document.getElementById('player-name-input'),
        nameSubmitBtn: document.getElementById('name-submit-btn'),
        nameError: document.getElementById('name-error'),
        nameSkipBtn: document.getElementById('name-skip-btn'),

        // Results screen additions
        viewLeaderboardBtn: document.getElementById('view-leaderboard-btn'),
        playerRank: document.getElementById('player-rank')
    };

    return leaderboardElements;
}

// ============================================
// State
// ============================================

let currentDifficulty = 'normal';
let pendingScoreSubmission = null;
let isUIInitialized = false;  // Prevent duplicate event listener setup

// ============================================
// Initialization
// ============================================

export async function setupLeaderboardUI() {
    if (!LEADERBOARD.ENABLED) return;
    if (isUIInitialized) return;  // Prevent duplicate event listener setup
    isUIInitialized = true;

    const els = getLeaderboardElements();

    // Filter button handlers
    els.filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            els.filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentDifficulty = btn.dataset.difficulty;
            loadLeaderboardScreen();
        });
    });

    // Back button
    if (els.backBtn) {
        els.backBtn.addEventListener('click', () => {
            showScreen('results');
        });
    }

    // View leaderboard button on results screen
    if (els.viewLeaderboardBtn) {
        els.viewLeaderboardBtn.addEventListener('click', () => {
            openLeaderboard();
        });
    }

    // Name modal handlers
    if (els.nameSubmitBtn) {
        els.nameSubmitBtn.addEventListener('click', handleNameSubmit);
    }

    if (els.nameInput) {
        els.nameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleNameSubmit();
        });
    }

    if (els.nameSkipBtn) {
        els.nameSkipBtn.addEventListener('click', () => {
            hideNameModal();
            pendingScoreSubmission = null;
        });
    }

    // Initialize leaderboard connection
    await initLeaderboard();
}

// ============================================
// Score Submission Flow
// ============================================

export async function handleScoreSubmission(scoreData) {
    if (!LEADERBOARD.ENABLED) return;

    pendingScoreSubmission = scoreData;

    // Check if player has a name
    if (!hasPlayerName()) {
        showNameModal();
        return;
    }

    try {
        await doSubmitScore(scoreData);
    } catch (error) {
        log.warn('Score submission failed', error);
        // Silently fail - the offline queue in leaderboard.js will retry later
    }
}

async function doSubmitScore(scoreData) {
    try {
        const result = await submitScore(scoreData);

        if (result.success) {
            // Update rank display on results screen
            await updatePlayerRankDisplay(scoreData);
        }
    } catch (error) {
        log.warn('Score submission error', error);
        // Don't rethrow - the offline queue will handle retries
    } finally {
        pendingScoreSubmission = null;
    }
}

async function updatePlayerRankDisplay(scoreData) {
    const els = getLeaderboardElements();
    if (!els.playerRank) return;

    try {
        const rank = await getPlayerRank(
            scoreData.clubId,
            scoreData.chantId,
            scoreData.difficulty,
            scoreData.score
        );

        if (rank && rank > 0 && rank <= 10000) {  // Sanity check rank bounds
            els.playerRank.textContent = `Rank: #${rank}`;
            els.playerRank.classList.remove('hidden');
        }
    } catch (error) {
        log.warn('Failed to get player rank', error);
        // Silently fail - rank display is non-critical
    }
}

// ============================================
// Name Modal
// ============================================

function showNameModal() {
    const els = getLeaderboardElements();
    if (!els.nameModal) return;

    els.nameModal.classList.remove('hidden');
    els.nameInput.value = '';
    els.nameError.classList.add('hidden');
    els.nameInput.focus();
}

function hideNameModal() {
    const els = getLeaderboardElements();
    if (!els.nameModal) return;

    els.nameModal.classList.add('hidden');
}

async function handleNameSubmit() {
    const els = getLeaderboardElements();
    const name = els.nameInput.value.trim();

    // Validate
    if (name.length < LEADERBOARD.NAME_MIN_LENGTH) {
        els.nameError.textContent = `Name must be at least ${LEADERBOARD.NAME_MIN_LENGTH} characters`;
        els.nameError.classList.remove('hidden');
        return;
    }

    if (name.length > LEADERBOARD.NAME_MAX_LENGTH) {
        els.nameError.textContent = `Name must be at most ${LEADERBOARD.NAME_MAX_LENGTH} characters`;
        els.nameError.classList.remove('hidden');
        return;
    }

    // Save name
    setPlayerName(name);
    hideNameModal();

    // Submit pending score
    if (pendingScoreSubmission) {
        try {
            await doSubmitScore(pendingScoreSubmission);
        } catch (error) {
            log.warn('Score submission after name entry failed', error);
            // Silently fail - offline queue will retry
        }
    }
}

// ============================================
// Leaderboard Screen
// ============================================

export function openLeaderboard() {
    const els = getLeaderboardElements();

    // Set initial filter to current difficulty
    currentDifficulty = state.settings.difficulty || 'normal';
    els.filterBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.difficulty === currentDifficulty);
    });

    // Set title with chant name
    if (state.selectedChant) {
        els.title.textContent = `Leaderboard: ${state.selectedChant.name}`;
    }

    showScreen('leaderboard');
    loadLeaderboardScreen();
}

async function loadLeaderboardScreen() {
    const els = getLeaderboardElements();

    if (!state.selectedClub || !state.selectedChant) return;

    // Show loading
    els.loading.classList.remove('hidden');
    els.entriesList.classList.add('hidden');
    els.emptyState.classList.add('hidden');
    els.offlineNotice.classList.add('hidden');

    const result = await fetchLeaderboard(
        state.selectedClub.id,
        state.selectedChant.id,
        currentDifficulty
    );

    els.loading.classList.add('hidden');

    // Show offline notice if applicable
    if (result.offline || result.stale) {
        els.offlineNotice.classList.remove('hidden');
    }

    if (!result.entries.length) {
        els.emptyState.classList.remove('hidden');
        return;
    }

    renderLeaderboardEntries(result.entries);
    els.entriesList.classList.remove('hidden');
}

function renderLeaderboardEntries(entries) {
    const els = getLeaderboardElements();
    els.entriesList.innerHTML = '';

    entries.forEach(entry => {
        const row = document.createElement('div');
        row.className = 'leaderboard-entry';
        if (entry.isCurrentPlayer) row.classList.add('current-player');

        // Medal for top 3
        let rankDisplay = entry.rank;
        if (entry.rank === 1) rankDisplay = '<span class="medal gold">1</span>';
        else if (entry.rank === 2) rankDisplay = '<span class="medal silver">2</span>';
        else if (entry.rank === 3) rankDisplay = '<span class="medal bronze">3</span>';

        row.innerHTML = `
            <div class="entry-rank">${rankDisplay}</div>
            <div class="entry-name">${escapeHtml(entry.playerName)}</div>
            <div class="entry-score">${entry.score.toLocaleString()}</div>
            <div class="entry-combo">${entry.maxCombo}x</div>
        `;

        els.entriesList.appendChild(row);
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// Utility
// ============================================

export function getConnectionStatus() {
    return isOnline() ? 'online' : 'offline';
}
