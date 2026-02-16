// ============================================
// config.js — All game constants
// ============================================

export const clubs = {
    AEK: {
        id: 'aek',
        name: 'AEK',
        colors: { primary: '#f4f800', secondary: '#000000' },
        badge: 'Logos/AEK_logo.svg',
        chants: [
            { id: 'Mastourosame_dikefale_aete', name: 'Mastourosame_dikefale_aete', audio: 'chants/AEK/Mastourosame_dikefale_aete.mp3', duration: 15 },
            { id: '100_xronia', name: '100_xronia', audio: 'chants/AEK/100_xronia.mp3', duration: 15 },
            { id: 'aekara_agapi_mou', name: 'aekara_agapi_mou', audio: 'chants/AEK/aekara_agapi_mou.mp3', duration: 15 },
            { id: 'aekara_vale_ena_goal', name: 'aekara_vale_ena_goal', audio: 'chants/AEK/aekara_vale_ena_goal.mp3', duration: 15 },
            { id: 'enosis', name: 'enosis', audio: 'chants/AEK/enosis.mp3', duration: 15 },
            { id: 'me_xionia_kai_vroxies', name: 'me_xionia_kai_vroxies', audio: 'chants/AEK/me_xionia_kai_vroxies.mp3', duration: 15 },
            { id: 'eisai_narkotiko', name: 'eisai_narkotiko', audio: 'chants/AEK/eisai_narkotiko.mp3', duration: 15 },
        ]
    },
    aris: {
        id: 'aris',
        name: 'Aris',
        colors: { primary: '#f4f800', secondary: '#000000' },
        badge: 'Logos/Aris_logo.svg',
        chants: [
            { id: 'ari_na_safisw_den_mporw', name: 'ari_na_safisw_den_mporw', audio: 'chants/Aris/ari_na_safisw_den_mporw.mp3', duration: 15 },
            { id: 'aris_kai_den_eimai_kala', name: 'aris_kai_den_eimai_kala', audio: 'chants/Aris/aris_kai_den_eimai_kala.mp3', duration: 15 },
            { id: 'aris', name: 'aris', audio: 'chants/Aris/aris.mp3', duration: 15 },
            { id: 'mas_lene_alites', name: 'mas_lene_alites', audio: 'chants/Aris/mas_lene_alites.mp3', duration: 15 },
            { id: 'mia_omada_ston_kosmo_agapw', name: 'mia_omada_ston_kosmo_agapw', audio: 'chants/Aris/mia_omada_ston_kosmo_agapw.mp3', duration: 15 },
            { id: 'oso_tha_zw', name: 'oso_tha_zw', audio: 'chants/Aris/oso_tha_zw.mp3', duration: 15 },
            { id: 'porothika', name: 'porothika', audio: 'chants/Aris/porothika.mp3', duration: 15 },
            { id: 'salonika_salonika', name: 'salonika_salonika', audio: 'chants/Aris/salonika_salonika.mp3', duration: 15 },
            { id: 'trelogiatre', name: 'trelogiatre', audio: 'chants/Aris/trelogiatre.mp3', duration: 15 },
        ]
    },
    olympiacos: {
        id: 'olympiacos',
        name: 'Olympiacos',
        colors: { primary: '#e41d1d', secondary: '#FFFFFF' },
        badge: 'Logos/Olympiacos_logo.svg',
        chants: [
            { id: 'eisai_arostia_olimpiake', name: 'eisai_arostia_olimpiake', audio: 'chants/Olympiakos/eisai_arostia_olimpiake.mp3', duration: 15 },
            { id: 'eisai_sto_mialo', name: 'eisai_sto_mialo', audio: 'chants/Olympiakos/eisai_sto_mialo.mp3', duration: 15 },
            { id: 'gia_senane_monaha_tragoudo', name: 'gia_senane_monaha_tragoudo', audio: 'chants/Olympiakos/gia_senane_monaha_tragoudo.mp3', duration: 15 },
            { id: 'imoun_paidaki', name: 'imoun_paidaki', audio: 'chants/Olympiakos/imoun_paidaki.mp3', duration: 15 },
            { id: 'mastoura_san_kai_sena', name: 'mastoura_san_kai_sena', audio: 'chants/Olympiakos/mastoura_san_kai_sena.mp3', duration: 15 },
            { id: 'palavosa_gia_sena', name: 'palavosa_gia_sena', audio: 'chants/Olympiakos/palavosa_gia_sena.mp3', duration: 15 },
            { id: 'thira_7_me_tsampouka', name: 'thira_7_me_tsampouka', audio: 'chants/Olympiakos/thira_7_me_tsampouka.mp3', duration: 15 },
            { id: 'tin_teleftea_kiriaki', name: 'tin_teleftea_kiriaki', audio: 'chants/Olympiakos/tin_teleftea_kiriaki.mp3', duration: 15 },
        ]
    },
    panathinaikos: {
        id: 'panathinaikos',
        name: 'Panathinaikos',
        colors: { primary: '#006633', secondary: '#FFFFFF' },
        badge: 'Logos/PAO_logo.svg',
        chants: [
            { id: 'eisai_i_zwi_mou', name: 'eisai_i_zwi_mou', audio: 'chants/Panathinaikos/eisai_i_zwi_mou.mp3', duration: 15 },
            { id: 'sti_leoforo_paizoume', name: 'sti_leoforo_paizoume', audio: 'chants/Panathinaikos/sti_leoforo_paizoume.mp3', duration: 15 },
            { id: 'sta_asteria_thelw_gipedo', name: 'sta_asteria_thelw_gipedo', audio: 'chants/Panathinaikos/sta_asteria_thelw_gipedo.mp3', duration: 15 },
            { id: 'se_gnorisa_apo_paidi_mikro', name: 'se_gnorisa_apo_paidi_mikro', audio: 'chants/Panathinaikos/se_gnorisa_apo_paidi_mikro.mp3', duration: 15 },
            { id: 'prasine_thee', name: 'prasine_thee', audio: 'chants/Panathinaikos/prasine_thee.mp3', duration: 15 },
            { id: 'mia_zwi_gemati_alitia', name: 'mia_zwi_gemati_alitia', audio: 'chants/Panathinaikos/mia_zwi_gemati_alitia.mp3', duration: 15 },
            { id: 'horto_magiko', name: 'horto_magiko', audio: 'chants/Panathinaikos/horto_magiko.mp3', duration: 15 },
            { id: 'ooo_ooooo', name: 'ooo_ooooo', audio: 'chants/Panathinaikos/ooo_ooooo.mp3', duration: 15 },
            { id: 'ton_pao_mou_ton_agapw', name: 'ton_pao_mou_ton_agapw', audio: 'chants/Panathinaikos/ton_pao_mou_ton_agapw.mp3', duration: 15 },
            { id: 'trifyllara_mou_sagapw', name: 'trifyllara_mou_sagapw', audio: 'chants/Panathinaikos/trifyllara_mou_sagapw.mp3', duration: 15 },
        ]
    },
    PAOK: {
        id: 'paok',
        name: 'PAOK',
        colors: { primary: '#000000', secondary: '#ffffff' },
        badge: 'Logos/PAOK_logo.svg',
        chants: [
            { id: 'eisai_sy_narkotiko', name: 'eisai_sy_narkotiko', audio: 'chants/PAOK/eisai_sy_narkotiko.mp3', duration: 15 },
            { id: 'gia_sena_tha_pethanw', name: 'gia_sena_tha_pethanw', audio: 'chants/PAOK/gia_sena_tha_pethanw.mp3', duration: 15 },
            { id: 'ki_otan_tha_paw_ston_trelogiatro', name: 'ki_otan_tha_paw_ston_trelogiatro', audio: 'chants/PAOK/ki_otan_tha_paw_ston_trelogiatro.mp3', duration: 15 },
            { id: 'oi_ekdromes_den_stamatane', name: 'oi_ekdromes_den_stamatane', audio: 'chants/PAOK/oi_ekdromes_den_stamatane.mp3', duration: 15 },
            { id: 'olous_trela_sas_poulame', name: 'olous_trela_sas_poulame', audio: 'chants/PAOK/olous_trela_sas_poulame.mp3', duration: 15 },
            { id: 'paok_sagapw', name: 'paok_sagapw', audio: 'chants/PAOK/paok_sagapw.mp3', duration: 15 },
            { id: 'paokara_eimai_xalia', name: 'paokara_eimai_xalia', audio: 'chants/PAOK/paokara_eimai_xalia.mp3', duration: 15 },
            { id: 'paokara_exw_trela', name: 'paokara_exw_trela', audio: 'chants/PAOK/paokara_exw_trela.mp3', duration: 15 },
            { id: 'paokle', name: 'paokle', audio: 'chants/PAOK/paokle.mp3', duration: 15 },
            { id: 'skotosa_gia_ena_eisitirio', name: 'skotosa_gia_ena_eisitirio', audio: 'chants/PAOK/skotosa_gia_ena_eisitirio.mp3', duration: 15 },
            { id: 'xioliometra_kaname', name: 'xioliometra_kaname', audio: 'chants/PAOK/xioliometra_kaname.mp3', duration: 15 }
        ]
    }
};

export const GameState = {
    TITLE: 'title',
    MODE_SELECT: 'modeSelect',
    CLUB_SELECT: 'clubSelect',
    CHANT_SELECT: 'chantSelect',
    MATCHDAY_INTRO: 'matchdayIntro',
    PLAYING: 'gameplay',
    CHANT_RESULT: 'chantResult',
    HALFTIME: 'halftime',
    RESULTS: 'results',
    FULLTIME: 'fulltime',
    LEADERBOARD: 'leaderboard',
    REPLAY: 'replay'
};

export const TIMING = {
    PERFECT: 200,
    GOOD: 400,
    OK: 600
};

export const SCORE = {
    PERFECT: 100,
    GOOD: 50,
    OK: 25,
    MISS: 0
};

export const BEAT_DETECTION = {
    FFT_SIZE: 2048,
    HOP_SIZE: 512,
    FLUX_SMOOTH_WINDOW: 3,
    ONSET_THRESHOLD_MULTIPLIER: 1.1,      // Lowered from 1.2 to catch weaker vocal onsets
    ONSET_THRESHOLD_OFFSET: 0.005,
    ONSET_MEDIAN_WINDOW: 11,
    ONSET_MIN_GAP_SEC: 0.10,
    MIN_BPM: 60,
    MAX_BPM: 200,
    GRID_PHASE_CANDIDATES: 100,           // Increased from 50 for finer phase resolution
    GRID_SNAP_WINDOW_SEC: 0.08,
    GRID_SNAP_WEIGHT: 0.3,                // Lowered from 0.5 to keep beats closer to detected onsets
    BASS_CUTOFF_HZ: 100,                  // Lowered from 150 to include more low-frequency drum content
    LOW_VOCAL_HZ: 250,
    LOW_VOCAL_WEIGHT: 0.5,                // Increased from 0.3 to boost low vocal contribution
    VOCAL_CORE_HZ: 3500,
    VOCAL_CORE_WEIGHT: 3.0,
    SIBILANCE_HZ: 6000,
    SIBILANCE_WEIGHT: 0.5,
    MIN_PLAYABLE_GAP_SEC: 0.22,           // Lowered from 0.28 to allow faster rhythms (~270 BPM max)
    MIN_ONSETS_FOR_DIRECT_USE: 5,         // Lowered from 6 to prefer direct onsets over tempo grid
    MAX_BEATS_PER_SECOND: 3.5,
    ABSOLUTE_MIN_FLUX: 0.01               // New: minimum flux to reject peaks in near-silence
};

export const SCROLL_VIS = {
    LEAD_TIME: 2.25,
    TRAIL_TIME: 2.25,
    PEAKS_PER_SEC: 300,
    BEAT_RADIUS: 12,
};

export const BEAT_RESULT_COLORS = {
    perfect: '#00ff88',
    good: '#88ff00',
    ok: '#ffaa00',
    miss: '#ff4444'
};

export const AI_ACCURACY = 0.75;

export const AI_RUBBER_BAND = {
    SCORE_DIFF_THRESHOLD: 500,
    LOSING_REDUCTION: 0.15,
    WINNING_INCREASE: 0.10,
};

export const DIFFICULTY_PRESETS = {
    easy:   { PERFECT: 300, GOOD: 500, OK: 700, label: 'Easy' },
    normal: { PERFECT: 200, GOOD: 400, OK: 600, label: 'Normal' },
    hard:   { PERFECT: 120, GOOD: 250, OK: 400, label: 'Hard' },
};

export const MATCHDAY = {
    CHANTS_PER_HALF: 3,
    MIN_CHANTS_FOR_MATCHDAY: 6,
    GOAL_COMBO_THRESHOLD: 0.40,
    AI_GOAL_CHANCE: 0.45,
    CHANT_TRANSITION_MS: 3000,
};

export const LEADERBOARD = {
    ENABLED: true,
    CACHE_TTL: 60000,
    TOP_ENTRIES: 10,
    NAME_MIN_LENGTH: 2,
    NAME_MAX_LENGTH: 16,
    OFFLINE_QUEUE_MAX: 20,
    MIN_SUBMIT_INTERVAL: 5000,
    // NOTE: Firebase API keys are intentionally public for client-side apps.
    // Security is enforced via Firebase Security Rules in the Firebase Console.
    // Ensure database rules restrict writes to authenticated users and validate data.
    FIREBASE: {
        apiKey: "AIzaSyCVc2VeW2zDk5-TPDAJt8AO1k5O82hHBdM",  // Get from Firebase Console, restrict to your domain in GCP
        authDomain: "ultras---match-day-beats.firebaseapp.com",
        projectId: "ultras---match-day-beats",
        databaseURL: "https://ultras---match-day-beats-default-rtdb.europe-west1.firebasedatabase.app"
    }
};

// ============================================
// Game Modifiers (Double Time, Hidden, Mirror)
// ============================================

export const MODIFIERS = {
    doubleTime: {
        id: 'doubleTime',
        name: 'Double Time',
        icon: '⏩',
        description: '1.5x speed, 2x score',
        speedMultiplier: 1.5,
        scoreMultiplier: 2.0
    },
    hidden: {
        id: 'hidden',
        name: 'Hidden',
        icon: '👁',
        description: 'Beats fade before hit line',
        fadeStartPercent: 0.6,  // Start fading at 60% of approach
        fadeEndPercent: 0.85    // Fully hidden at 85%
    },
    mirror: {
        id: 'mirror',
        name: 'Mirror',
        icon: '🪞',
        description: 'Reverse scroll direction',
        reversed: true
    }
};

// Score bonus for using modifiers
export const MODIFIER_BONUSES = {
    none: 1.0,
    one: 1.2,    // 20% bonus for 1 modifier
    two: 1.5,    // 50% bonus for 2 modifiers
    three: 2.0   // 100% bonus for all 3
};

// ============================================
// Power-ups System
// ============================================

export const POWERUPS = {
    shield: {
        id: 'shield',
        name: 'Shield',
        icon: '🛡',
        description: 'Absorbs next miss',
        color: '#00aaff',
        chargeCombo: 25,      // Combo needed to charge
        duration: null        // Instant use (one-time protection)
    },
    scoreBurst: {
        id: 'scoreBurst',
        name: 'Score Burst',
        icon: '💥',
        description: '5x score for 3 seconds',
        color: '#ff6600',
        chargeCombo: 50,
        duration: 3000,       // 3 seconds
        multiplier: 5.0
    },
    slowMotion: {
        id: 'slowMotion',
        name: 'Slow Motion',
        icon: '🐌',
        description: 'Slows time briefly',
        color: '#aa00ff',
        chargeCombo: 40,
        duration: 2000,       // 2 seconds
        speedMultiplier: 0.7  // 70% speed
    }
};

export const POWERUP_KEY = 'ShiftLeft';  // Key to activate power-up

// ============================================
// AI Personalities (per club)
// ============================================

export const AI_PERSONALITIES = {
    aggressive: {
        id: 'aggressive',
        name: 'Aggressive',
        icon: '🔥',
        description: 'Starts strong, tires late',
        baseAccuracy: 0.85,
        // Accuracy decays over time (multiplied by game progress 0-1)
        accuracyDecay: 0.20,   // Loses up to 20% accuracy by end
        rubberBandStrength: 0.5
    },
    comebackKing: {
        id: 'comebackKing',
        name: 'Comeback King',
        icon: '👑',
        description: 'Gets stronger when losing',
        baseAccuracy: 0.70,
        // Extra accuracy when behind
        comebackBonus: 0.25,
        rubberBandStrength: 2.0  // Much stronger rubber-banding
    },
    consistent: {
        id: 'consistent',
        name: 'Consistent',
        icon: '🎯',
        description: 'Steady performance',
        baseAccuracy: 0.75,
        accuracyVariance: 0.05,  // Very small variance
        rubberBandStrength: 0.8
    },
    clutch: {
        id: 'clutch',
        name: 'Clutch',
        icon: '⚡',
        description: 'Peaks in final moments',
        baseAccuracy: 0.70,
        // Accuracy increases in last 30% of song
        clutchBonus: 0.20,
        clutchThreshold: 0.70,  // Last 30% of song
        rubberBandStrength: 1.0
    },
    wildcard: {
        id: 'wildcard',
        name: 'Wildcard',
        icon: '🎲',
        description: 'Unpredictable streaks',
        baseAccuracy: 0.72,
        streakChance: 0.15,     // 15% chance per beat to enter streak
        streakAccuracy: 0.95,   // Near-perfect during streaks
        streakLength: 5,        // Beats per streak
        rubberBandStrength: 0.7
    }
};

// Map clubs to their AI personality
export const CLUB_AI_PERSONALITIES = {
    aek: 'aggressive',
    aris: 'wildcard',
    olympiacos: 'comebackKing',
    panathinaikos: 'consistent',
    paok: 'clutch'
};

// ============================================
// Replay System
// ============================================

export const REPLAY = {
    VERSION: 1,                    // Replay format version for compatibility
    MAX_CODE_LENGTH: 50000,        // Max base64 code length
    COMPRESSION_ENABLED: true      // Use compression for replay codes
};

// ============================================
// XP & Leveling System
// ============================================

export const XP_CONFIG = {
    // XP sources
    SCORE_DIVISOR: 10,              // Score / 10 = base XP
    COMBO_BONUS: 5,                 // XP per max combo point
    WIN_BONUS: 100,                 // XP for winning a practice round
    MATCHDAY_WIN: 500,              // XP for winning a match day
    MATCHDAY_DRAW: 200,             // XP for drawing a match day
    PERFECT_HIT_BONUS: 2,           // Extra XP per perfect hit
    CHALLENGE_MULTIPLIER: 1.5,      // XP multiplier for challenge completion

    // Level thresholds (cumulative XP needed)
    LEVEL_THRESHOLDS: [
        0,      // Level 1
        500,    // Level 2
        1500,   // Level 3
        3000,   // Level 4
        5000,   // Level 5
        8000,   // Level 6
        12000,  // Level 7
        17000,  // Level 8
        23000,  // Level 9
        30000,  // Level 10
        40000,  // Level 11
        52000,  // Level 12
        66000,  // Level 13
        82000,  // Level 14
        100000, // Level 15 (max)
    ],

    // Level titles
    LEVEL_TITLES: [
        'Newcomer',      // 1
        'Supporter',     // 2
        'Fan',           // 3
        'Devoted Fan',   // 4
        'Ultra',         // 5
        'Hardcore Ultra',// 6
        'Capo',          // 7
        'Section Leader',// 8
        'Legendary Capo',// 9
        'Living Legend', // 10
        'Icon',          // 11
        'Hall of Famer', // 12
        'Immortal',      // 13
        'Demigod',       // 14
        'Supreme Ultra', // 15
    ]
};

// Unlockable cosmetics by level
export const LEVEL_UNLOCKS = {
    1: { type: 'scarf', id: 'basic', name: 'Basic Scarf' },
    3: { type: 'effect', id: 'extra_smoke', name: 'Extra Smoke' },
    5: { type: 'scarf', id: 'striped', name: 'Striped Scarf' },
    7: { type: 'effect', id: 'golden_confetti', name: 'Golden Confetti' },
    10: { type: 'scarf', id: 'premium', name: 'Premium Scarf' },
    12: { type: 'effect', id: 'fireworks', name: 'Victory Fireworks' },
    15: { type: 'title', id: 'supreme', name: 'Supreme Ultra Title' }
};

// ============================================
// Achievement System
// ============================================

export const ACHIEVEMENTS = {
    first_blood: {
        id: 'first_blood',
        name: 'First Blood',
        description: 'Win your first match',
        icon: '🩸',
        xpReward: 100
    },
    perfect_chant: {
        id: 'perfect_chant',
        name: 'Perfect Chant',
        description: '100% accuracy on any chant',
        icon: '💯',
        xpReward: 250
    },
    centurion: {
        id: 'centurion',
        name: 'Centurion',
        description: 'Reach 100 combo',
        icon: '💪',
        xpReward: 200
    },
    rivalry: {
        id: 'rivalry',
        name: 'Rivalry',
        description: 'Beat every club in Match Day',
        icon: '🏆',
        xpReward: 500
    },
    untouchable: {
        id: 'untouchable',
        name: 'Untouchable',
        description: 'Win without missing a single beat',
        icon: '🛡️',
        xpReward: 300
    },
    comeback_king: {
        id: 'comeback_king',
        name: 'Comeback King',
        description: 'Win after being down by 500+ points',
        icon: '👑',
        xpReward: 200
    },
    marathon: {
        id: 'marathon',
        name: 'Marathon',
        description: 'Play 100 chants total',
        icon: '🏃',
        xpReward: 150
    },
    dedicated: {
        id: 'dedicated',
        name: 'Dedicated',
        description: 'Play 10 Match Days',
        icon: '⚽',
        xpReward: 150
    },
    high_scorer: {
        id: 'high_scorer',
        name: 'High Scorer',
        description: 'Score 5000 points in a single chant',
        icon: '🎯',
        xpReward: 200
    },
    fever_master: {
        id: 'fever_master',
        name: 'Fever Master',
        description: 'Maintain FEVER mode for 30+ seconds',
        icon: '🔥',
        xpReward: 150
    }
};

// ============================================
// Weekly/Season Challenges
// ============================================

export const CHALLENGE_TYPES = {
    score_with_club: {
        id: 'score_with_club',
        template: 'Score {target} points with {club}',
        icon: '🎵'
    },
    win_matchdays: {
        id: 'win_matchdays',
        template: 'Win {target} Match Days',
        icon: '🏟️'
    },
    perfect_hits: {
        id: 'perfect_hits',
        template: 'Get {target} PERFECT hits',
        icon: '✨'
    },
    combo_total: {
        id: 'combo_total',
        template: 'Accumulate {target} total combo',
        icon: '🔗'
    },
    play_chants: {
        id: 'play_chants',
        template: 'Play {target} chants',
        icon: '🎤'
    }
};

// Weekly challenge pool (rotates each week)
export const WEEKLY_CHALLENGES = [
    { type: 'score_with_club', clubId: 'paok', target: 10000, xpReward: 200 },
    { type: 'score_with_club', clubId: 'aek', target: 10000, xpReward: 200 },
    { type: 'score_with_club', clubId: 'olympiacos', target: 10000, xpReward: 200 },
    { type: 'score_with_club', clubId: 'panathinaikos', target: 10000, xpReward: 200 },
    { type: 'score_with_club', clubId: 'aris', target: 10000, xpReward: 200 },
    { type: 'win_matchdays', target: 3, xpReward: 300 },
    { type: 'perfect_hits', target: 100, xpReward: 150 },
    { type: 'combo_total', target: 500, xpReward: 200 },
    { type: 'play_chants', target: 20, xpReward: 150 }
];

// Season challenges (longer-term goals)
export const SEASON_CHALLENGES = [
    { type: 'win_matchdays', target: 50, xpReward: 2000, name: 'Season Champion' },
    { type: 'perfect_hits', target: 1000, xpReward: 1500, name: 'Precision Master' },
    { type: 'combo_total', target: 5000, xpReward: 1500, name: 'Combo Legend' },
    { type: 'play_chants', target: 200, xpReward: 1000, name: 'Dedicated Fan' }
];

// ============================================
// Club Loyalty System
// ============================================

export const LOYALTY_CONFIG = {
    LOYAL_FAN_THRESHOLD: 50,        // Games needed for "Loyal Fan" badge
    FANATIC_THRESHOLD: 100,         // Games needed for "Fanatic" badge
    LEGEND_THRESHOLD: 200,          // Games needed for "Club Legend" badge

    BADGES: {
        loyal_fan: {
            id: 'loyal_fan',
            name: 'Loyal Fan',
            icon: '💚',
            threshold: 50
        },
        fanatic: {
            id: 'fanatic',
            name: 'Fanatic',
            icon: '🔥',
            threshold: 100
        },
        club_legend: {
            id: 'club_legend',
            name: 'Club Legend',
            icon: '👑',
            threshold: 200
        }
    }
};

// ============================================
// Hold Beat (Long Press) System
// ============================================

export const HOLD_BEAT = {
    MIN_DURATION: 0.3,           // Minimum hold duration (seconds)
    MAX_DURATION: 15.0,           // Maximum hold duration (seconds)
    RELEASE_WINDOW: 300,         // Release timing tolerance (ms)
    HOLD_GRACE_PERIOD: 100,      // Grace before hold counts as broken (ms)
    // Auto-generation settings
    AUTO_GENERATE: true,         // Enable auto-generation of hold beats
    COMBINE_THRESHOLD: 0.30,     // Combine beats closer than this (seconds)
    MIN_CLUSTER_SIZE: 2,         // Minimum consecutive beats to form a hold
};

export const HOLD_SCORING = {
    PRESS_WEIGHT: 0.4,           // 40% of score from press timing
    HOLD_WEIGHT: 0.3,            // 30% of score from hold duration
    RELEASE_WEIGHT: 0.3,         // 30% of score from release timing
    HOLD_BREAK_PENALTY: 0.5,     // 50% penalty if hold was broken
    COMBO_TICK_INTERVAL: 0.2,    // Increment combo every 20% of hold progress
    SCORE_PER_TICK: 15,          // Score awarded per combo tick during hold
};

/**
 * Normalizes a beats array to uniform format.
 * Converts mixed arrays (numbers and hold objects) to consistent beat objects.
 * @param {Array} beats - Mixed array of beat times or hold beat objects
 * @returns {Array} Normalized array of beat objects
 *
 * Input formats:
 *   - number: tap beat at that time (e.g., 0.5)
 *   - {time: number, duration: number}: hold beat
 *
 * Output format:
 *   - {time: number, type: 'tap'}
 *   - {time: number, type: 'hold', duration: number, endTime: number}
 */
export function normalizeBeats(beats) {
    if (!beats || !Array.isArray(beats)) return [];

    return beats.map(beat => {
        if (typeof beat === 'number') {
            // Simple tap beat
            return { time: beat, type: 'tap' };
        } else if (typeof beat === 'object' && beat !== null && typeof beat.time === 'number') {
            // Hold beat or already normalized beat
            if (typeof beat.duration === 'number' && beat.duration >= HOLD_BEAT.MIN_DURATION) {
                return {
                    time: beat.time,
                    type: 'hold',
                    duration: Math.min(beat.duration, HOLD_BEAT.MAX_DURATION),
                    endTime: beat.time + Math.min(beat.duration, HOLD_BEAT.MAX_DURATION)
                };
            } else if (beat.type === 'hold' && beat.endTime) {
                // Already normalized hold beat
                return beat;
            } else if (beat.type === 'tap') {
                // Already normalized tap beat
                return beat;
            } else {
                // Object with time but no valid duration - treat as tap
                return { time: beat.time, type: 'tap' };
            }
        }
        // Invalid format - skip (will be filtered out)
        console.warn('Invalid beat format:', beat);
        return null;
    }).filter(beat => beat !== null);
}

/**
 * Auto-generates hold beats by combining closely-spaced beats into holds.
 * Scans through beats and finds clusters where consecutive beats are closer
 * than HOLD_BEAT.COMBINE_THRESHOLD. Clusters with MIN_CLUSTER_SIZE or more
 * beats become hold beats spanning from first to last beat in the cluster.
 *
 * @param {Array} beats - Array of raw beat times (numbers) from beat detection
 * @returns {Array} Normalized array with auto-generated hold beats
 *
 * Example:
 *   Input:  [1.0, 1.15, 1.30, 1.45, 2.5, 3.0, 3.12, 3.24, 3.36, 4.5]
 *   Output: [
 *     {time: 1.0, type: 'hold', duration: 0.45, endTime: 1.45},  // cluster of 4
 *     {time: 2.5, type: 'tap'},                                   // isolated
 *     {time: 3.0, type: 'hold', duration: 0.36, endTime: 3.36},  // cluster of 4
 *     {time: 4.5, type: 'tap'}                                    // isolated
 *   ]
 */
export function autoGenerateHoldBeats(beats) {
    if (!beats || !Array.isArray(beats) || beats.length === 0) return [];
    if (!HOLD_BEAT.AUTO_GENERATE) {
        // Auto-generation disabled, just normalize as tap beats
        return beats.map(time => ({ time, type: 'tap' }));
    }

    const threshold = HOLD_BEAT.COMBINE_THRESHOLD;
    const minClusterSize = HOLD_BEAT.MIN_CLUSTER_SIZE;
    const result = [];

    // Sort beats by time (should already be sorted, but ensure)
    const sortedBeats = [...beats].sort((a, b) => a - b);

    let i = 0;
    while (i < sortedBeats.length) {
        // Start a potential cluster
        const clusterStart = i;
        let clusterEnd = i;

        // Extend cluster while beats are close together
        while (clusterEnd < sortedBeats.length - 1) {
            const gap = sortedBeats[clusterEnd + 1] - sortedBeats[clusterEnd];
            if (gap <= threshold) {
                clusterEnd++;
            } else {
                break;
            }
        }

        const clusterSize = clusterEnd - clusterStart + 1;

        if (clusterSize >= minClusterSize) {
            // Create a hold beat spanning the cluster
            const startTime = sortedBeats[clusterStart];
            const endTime = sortedBeats[clusterEnd];
            const duration = endTime - startTime;

            // Only create hold if duration meets minimum
            if (duration >= HOLD_BEAT.MIN_DURATION) {
                result.push({
                    time: startTime,
                    type: 'hold',
                    duration: Math.min(duration, HOLD_BEAT.MAX_DURATION),
                    endTime: startTime + Math.min(duration, HOLD_BEAT.MAX_DURATION)
                });
            } else {
                // Duration too short, keep first beat as tap
                result.push({ time: startTime, type: 'tap' });
            }
        } else {
            // Not enough beats for a hold, add as individual taps
            for (let j = clusterStart; j <= clusterEnd; j++) {
                result.push({ time: sortedBeats[j], type: 'tap' });
            }
        }

        i = clusterEnd + 1;
    }

    return result;
}
