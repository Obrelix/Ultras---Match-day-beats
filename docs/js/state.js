// ============================================
// state.js — Centralized mutable game state
// ============================================

import { GameState } from './config.js';

export const state = {
    // Navigation
    currentState: GameState.TITLE,
    navigationHistory: [],  // Stack of previous screen names for back navigation
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
    detectedBeats: [],      // Array of normalized beat objects (tap or hold)
    nextBeatIndex: 0,

    // Hold beat state
    holdState: {
        isHolding: false,           // Whether player is currently holding
        currentBeatIndex: null,     // Index of the hold beat being held
        pressTime: 0,               // Wall-clock time when press started
        pressRating: null,          // Rating of the initial press ('perfect', 'good', 'ok')
        expectedEndTime: 0,         // When the hold should end (wall-clock ms)
        holdProgress: 0,            // 0-1 progress through the hold
        wasBroken: false,           // Whether the hold was broken early
        lastComboTick: 0,           // Last progress value when combo was incremented
        comboTickCount: 0,          // Number of combo ticks given during this hold
    },

    // Game timing
    gameStartTime: 0,
    audioStartTime: 0,
    gameLoopId: null,
    activeBeat: null,

    // Visualizer
    canvasCtx: null,
    crowdBgCanvas: null,
    crowdBgCtx: null,
    stadiumLayout: null,  // Set by crowdBg.js on init/resize
    crowdMode: 'idle',
    hudPositionY: 22,     // Cached HUD Y position (updated on resize, avoids getBoundingClientRect)
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
    feverTimeAccumulated: 0,  // Total seconds spent in fever/frenzy mode this game
    lastFeverCheckTime: 0,    // Last time we checked fever status

    // Supporters crowd
    supporters: [],
    crowdBeatTime: 0,
    smokeParticles: [],
    cachedColors: null,  // Set by updateCrowdClub for performance

    // Weather effects
    rainParticles: [],
    confettiParticles: [],
    weatherIntensity: 0,  // 0-1 for gradual transitions

    // Screen effects (combo visuals)
    screenShake: { active: false, intensity: 0, startTime: 0, duration: 0, decay: 'linear' },
    screenFlash: { active: false, color: '#ffffff', intensity: 0, startTime: 0, duration: 0 },
    lastMilestoneCombo: 0,

    // Tifo display (choreoType 3)
    tifoMap: null,        // 2D array of colors sampled from club logo
    tifoReady: false,     // True when tifo map is loaded and ready
    tifoImage: null,      // Cached Image element of club badge
    tifoGridCols: 80,     // Grid columns for tifo mapping
    tifoGridRows: 6,      // Grid rows for tifo mapping

    // Choreo transition state (#10 - tifo reveal)
    lastChoreoId: 0,       // Track choreo changes for reveal animations
    choreoStartTime: 0,    // When current choreo started

    // Player stats
    playerScore: 0,
    playerCombo: 0,
    playerMaxCombo: 0,
    playerStats: { perfect: 0, good: 0, ok: 0, miss: 0 },
    totalBeats: 0,

    // AI stats
    aiScore: 0,
    aiScorePopups: [],

    // Game Modifiers (Double Time, Hidden, Mirror)
    activeModifiers: {
        doubleTime: false,
        hidden: false,
        mirror: false
    },
    modifierScoreMultiplier: 1.0,  // Combined score multiplier from modifiers

    // Power-ups
    powerups: {
        shield: { charged: false, active: false },
        scoreBurst: { charged: false, active: false, endTime: 0 },
        slowMotion: { charged: false, active: false, endTime: 0 }
    },
    powerupChargeProgress: 0,      // Current combo progress toward next powerup
    activePowerupMultiplier: 1.0,  // Current score multiplier from active powerups

    // AI Personality
    aiPersonality: null,           // Current rival's personality config
    aiMood: 'neutral',             // Current AI mood: 'confident', 'struggling', 'neutral'
    aiStreakCounter: 0,            // For wildcard personality streaks
    aiInStreak: false,             // Whether AI is in a hot streak

    // AI Trash Talk
    trashTalk: {
        lastMessageTime: 0,        // Timestamp of last trash talk message
        consecutiveMisses: 0,      // Track player miss streaks
        messageVisible: false,     // Whether a message is currently shown
        hideTimeoutId: null        // Timeout ID for hiding message
    },
    _nearEndTrashTalkTriggered: false,  // Prevent repeated near-end triggers

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

    // Replay System
    isRecording: false,          // Whether we're recording a replay
    isReplaying: false,          // Whether we're playing back a replay
    replayData: null,            // Current replay data being recorded/played
    replayInputIndex: 0,         // Current input index during playback

    // Analytics Session Tracking
    sessionId: null,             // Current session identifier
    sessionStartTime: 0,         // When current session started

    // Performance: CSS class state tracking (avoids DOM queries)
    _lastFrenzyState: false,
    _lastIntenseState: false,
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

    // Reset hold state
    state.holdState = {
        isHolding: false,
        currentBeatIndex: null,
        pressTime: 0,
        pressRating: null,
        expectedEndTime: 0,
        holdProgress: 0,
        wasBroken: false,
        lastComboTick: 0,
        comboTickCount: 0,
    };
    state.waveformPeaks = null;
    state.beatResults = [];
    state.waveformCacheReady = false;
    state.beatHitEffects = [];
    state.hitParticles = [];

    state.crowdBeatTime = 0;
    state.smokeParticles = [];
    state.rainParticles = [];
    state.confettiParticles = [];
    state.weatherIntensity = 0;
    state.lastChoreoId = 0;
    state.choreoStartTime = 0;

    // Reset screen effects
    state.screenShake = { active: false, intensity: 0, startTime: 0, duration: 0, decay: 'linear' };
    state.screenFlash = { active: false, color: '#ffffff', intensity: 0, startTime: 0, duration: 0 };
    state.lastMilestoneCombo = 0;

    state.feedbackText = '';
    state.feedbackAlpha = 0;
    state.feedbackSpawnTime = 0;
    state.comboDisplayCount = 0;
    state.comboPrevCount = 0;
    state.comboBumpTime = 0;
    state.frenzyStartTime = 0;
    state.wasFrenzy = false;
    state.feverTimeAccumulated = 0;
    state.lastFeverCheckTime = 0;
    state.crowdEmotion = 'neutral';

    // Reset CSS class tracking
    state._lastFrenzyState = false;
    state._lastIntenseState = false;

    // Reset power-ups (keep modifiers as they're set before game starts)
    state.powerups = {
        shield: { charged: false, active: false },
        scoreBurst: { charged: false, active: false, endTime: 0 },
        slowMotion: { charged: false, active: false, endTime: 0 }
    };
    state.powerupChargeProgress = 0;
    state.activePowerupMultiplier = 1.0;

    // Reset AI state
    state.aiMood = 'neutral';
    state.aiStreakCounter = 0;
    state.aiInStreak = false;

    // Reset trash talk state
    state.trashTalk = {
        lastMessageTime: 0,
        consecutiveMisses: 0,
        messageVisible: false,
        hideTimeoutId: null
    };
    state._nearEndTrashTalkTriggered = false;

    // Reset replay state (but keep replayData for watching after game)
    state.isRecording = false;
    state.isReplaying = false;
    state.replayInputIndex = 0;
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
