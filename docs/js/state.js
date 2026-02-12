// ============================================
// state.js — Centralized mutable game state
// ============================================

import { GameState } from './config.js';

export const state = {
    // Navigation
    currentState: GameState.TITLE,
    selectedClub: null,
    selectedChant: null,

    // Settings (loaded from localStorage at startup)
    settings: {
        volume: 1.0,
        sfxVolume: 0.5,
        difficulty: 'normal',
        reducedEffects: false,
        tutorialSeen: false
    },

    // Active timing windows (set from difficulty preset)
    activeTiming: { PERFECT: 200, GOOD: 400, OK: 600 },

    // Pause state
    isPaused: false,
    _pauseTime: 0,

    // Audio
    audioContext: null,
    audioBuffer: null,
    audioSource: null,
    analyser: null,
    dataArray: null,
    masterGain: null,
    sfxGain: null,

    // Beat detection
    detectedBeats: [],
    nextBeatIndex: 0,

    // Game timing
    gameStartTime: 0,
    audioStartTime: 0,
    gameLoopId: null,
    activeBeat: null,

    // Visualizer
    canvasCtx: null,
    gameVisualCtx: null,
    beatFlashIntensity: 0,
    waveformPeaks: null,
    beatResults: [],
    waveformCache: null,
    waveformCacheCtx: null,
    waveformCacheReady: false,
    beatHitEffects: [],
    hitParticles: [],

    // Canvas-drawn feedback & combo
    feedbackText: '',
    feedbackAlpha: 0,
    feedbackColor: '#ffffff',
    feedbackSpawnTime: 0,
    comboDisplayCount: 0,
    comboPrevCount: 0,
    comboBumpTime: 0,
    frenzyStartTime: 0,
    wasFrenzy: false,

    // Supporters crowd
    supporters: [],
    crowdBeatTime: 0,
    frenzyParticles: [],
    smokeParticles: [],

    // Player stats
    playerScore: 0,
    playerCombo: 0,
    playerMaxCombo: 0,
    playerStats: { perfect: 0, good: 0, ok: 0, miss: 0 },
    totalBeats: 0,

    // AI stats
    aiScore: 0,
    aiScorePopups: [],

    // Match Day
    gameMode: null,
    rivalClub: null,
    matchChants: [],
    currentChantIndex: 0,
    currentHalf: 1,
    playerGoals: 0,
    aiGoals: 0,
    chantResults: [],
    crowdEmotion: 'neutral',
    chantResultAnimationId: null, // New: To control the chant result screen animation
    chantResultCtx: null, // New: Context for the chant result visual canvas
};

export function resetGameState() {
    state.playerScore = 0;
    state.playerCombo = 0;
    state.playerMaxCombo = 0;
    state.playerStats = { perfect: 0, good: 0, ok: 0, miss: 0 };
    state.aiScore = 0;
    state.aiScorePopups = [];
    state.totalBeats = 0;
    state.activeBeat = null;
    state.isPaused = false;
    state._pauseTime = 0;

    state.detectedBeats = [];
    state.nextBeatIndex = 0;
    state.beatFlashIntensity = 0;
    state.waveformPeaks = null;
    state.beatResults = [];
    state.waveformCacheReady = false;
    state.beatHitEffects = [];
    state.hitParticles = [];

    state.supporters = [];
    state.crowdBeatTime = 0;
    state.frenzyParticles = [];
    state.smokeParticles = [];

    state.feedbackText = '';
    state.feedbackAlpha = 0;
    state.feedbackSpawnTime = 0;
    state.comboDisplayCount = 0;
    state.comboPrevCount = 0;
    state.comboBumpTime = 0;
    state.frenzyStartTime = 0;
    state.wasFrenzy = false;
    state.crowdEmotion = 'neutral'; // Reset crowd emotion
    state.chantResultAnimationId = null; // Reset chant result animation ID
    state.chantResultCtx = null; // Reset chant result canvas context
}

export function resetMatchState() {
    state.gameMode = null;
    state.rivalClub = null;
    state.matchChants = [];
    state.currentChantIndex = 0;
    state.currentHalf = 1;
    state.playerGoals = 0;
    state.aiGoals = 0;
    state.chantResults = [];
}
