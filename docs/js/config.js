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
            { id: 'Mastourosame_dikefale_aete', name: 'Mastourosame_dikefale_aete', audio: 'chants/AEK/Mastourosame_dikefale_aete.mp3', duration: 52 },
            { id: '100_xronia', name: '100_xronia', audio: 'chants/AEK/100_xronia.mp3', duration: 49 },
            { id: 'aekara_agapi_mou', name: 'aekara_agapi_mou', audio: 'chants/AEK/aekara_agapi_mou.mp3', duration: 42 },
            { id: 'aekara_vale_ena_goal', name: 'aekara_vale_ena_goal', audio: 'chants/AEK/aekara_vale_ena_goal.mp3', duration: 33 },
            { id: 'enosis', name: 'enosis', audio: 'chants/AEK/enosis.mp3', duration: 39 },
            { id: 'me_xionia_kai_vroxies', name: 'me_xionia_kai_vroxies', audio: 'chants/AEK/me_xionia_kai_vroxies.mp3', duration: 44 },
            { id: 'eisai_narkotiko', name: 'eisai_narkotiko', audio: 'chants/AEK/eisai_narkotiko.mp3', duration: 56 },
        ]
    },
    aris: {
        id: 'aris',
        name: 'Aris',
        colors: { primary: '#f4f800', secondary: '#000000' },
        badge: 'Logos/Aris_logo.svg',
        chants: [
            { id: 'ari_na_safisw_den_mporw', name: 'ari_na_safisw_den_mporw', audio: 'chants/Aris/ari_na_safisw_den_mporw.mp3', duration: 56 },
            { id: 'aris_kai_den_eimai_kala', name: 'aris_kai_den_eimai_kala', audio: 'chants/Aris/aris_kai_den_eimai_kala.mp3', duration: 68 },
            { id: 'aris', name: 'aris', audio: 'chants/Aris/aris.mp3', duration: 30 },
            { id: 'mas_lene_alites', name: 'mas_lene_alites', audio: 'chants/Aris/mas_lene_alites.mp3', duration: 77 },
            { id: 'mia_omada_ston_kosmo_agapw', name: 'mia_omada_ston_kosmo_agapw', audio: 'chants/Aris/mia_omada_ston_kosmo_agapw.mp3', duration: 54 },
            { id: 'oso_tha_zw', name: 'oso_tha_zw', audio: 'chants/Aris/oso_tha_zw.mp3', duration: 53 },
            { id: 'porothika', name: 'porothika', audio: 'chants/Aris/porothika.mp3', duration: 52 },
            { id: 'salonika_salonika', name: 'salonika_salonika', audio: 'chants/Aris/salonika_salonika.mp3', duration: 32 },
            { id: 'trelogiatre', name: 'trelogiatre', audio: 'chants/Aris/trelogiatre.mp3', duration: 46 },
        ]
    },
    olympiacos: {
        id: 'olympiacos',
        name: 'Olympiacos',
        colors: { primary: '#e41d1d', secondary: '#FFFFFF' },
        badge: 'Logos/Olympiacos_logo.svg',
        chants: [
            { id: 'eisai_arostia_olimpiake', name: 'eisai_arostia_olimpiake', audio: 'chants/Olympiakos/eisai_arostia_olimpiake.mp3', duration: 40 },
            { id: 'eisai_sto_mialo', name: 'eisai_sto_mialo', audio: 'chants/Olympiakos/eisai_sto_mialo.mp3', duration: 55 },
            { id: 'gia_senane_monaha_tragoudo', name: 'gia_senane_monaha_tragoudo', audio: 'chants/Olympiakos/gia_senane_monaha_tragoudo.mp3', duration: 59 },
            { id: 'imoun_paidaki', name: 'imoun_paidaki', audio: 'chants/Olympiakos/imoun_paidaki.mp3', duration: 38 },
            { id: 'mastoura_san_kai_sena', name: 'mastoura_san_kai_sena', audio: 'chants/Olympiakos/mastoura_san_kai_sena.mp3', duration: 57 },
            { id: 'palavosa_gia_sena', name: 'palavosa_gia_sena', audio: 'chants/Olympiakos/palavosa_gia_sena.mp3', duration: 38 },
            { id: 'thira_7_me_tsampouka', name: 'thira_7_me_tsampouka', audio: 'chants/Olympiakos/thira_7_me_tsampouka.mp3', duration: 50 },
            { id: 'tin_teleftea_kiriaki', name: 'tin_teleftea_kiriaki', audio: 'chants/Olympiakos/tin_teleftea_kiriaki.mp3', duration: 153 },
        ]
    },
    panathinaikos: {
        id: 'panathinaikos',
        name: 'Panathinaikos',
        colors: { primary: '#006633', secondary: '#FFFFFF' },
        badge: 'Logos/PAO_logo.svg',
        chants: [
            { id: 'eisai_i_zwi_mou', name: 'eisai_i_zwi_mou', audio: 'chants/Panathinaikos/eisai_i_zwi_mou.mp3', duration: 85 },
            { id: 'sti_leoforo_paizoume', name: 'sti_leoforo_paizoume', audio: 'chants/Panathinaikos/sti_leoforo_paizoume.mp3', duration: 32 },
            { id: 'sta_asteria_thelw_gipedo', name: 'sta_asteria_thelw_gipedo', audio: 'chants/Panathinaikos/sta_asteria_thelw_gipedo.mp3', duration: 87 },
            { id: 'se_gnorisa_apo_paidi_mikro', name: 'se_gnorisa_apo_paidi_mikro', audio: 'chants/Panathinaikos/se_gnorisa_apo_paidi_mikro.mp3', duration: 113 },
            { id: 'prasine_thee', name: 'prasine_thee', audio: 'chants/Panathinaikos/prasine_thee.mp3', duration: 31 },
            { id: 'mia_zwi_gemati_alitia', name: 'mia_zwi_gemati_alitia', audio: 'chants/Panathinaikos/mia_zwi_gemati_alitia.mp3', duration: 32 },
            { id: 'horto_magiko', name: 'horto_magiko', audio: 'chants/Panathinaikos/horto_magiko.mp3', duration: 73 },
            { id: 'ooo_ooooo', name: 'ooo_ooooo', audio: 'chants/Panathinaikos/ooo_ooooo.mp3', duration: 35 },
            { id: 'ton_pao_mou_ton_agapw', name: 'ton_pao_mou_ton_agapw', audio: 'chants/Panathinaikos/ton_pao_mou_ton_agapw.mp3', duration: 56 },
            { id: 'trifyllara_mou_sagapw', name: 'trifyllara_mou_sagapw', audio: 'chants/Panathinaikos/trifyllara_mou_sagapw.mp3', duration: 252 },
        ]
    },
    PAOK: {
        id: 'paok',
        name: 'PAOK',
        colors: { primary: '#000000', secondary: '#ffffff' },
        badge: 'Logos/PAOK_logo.svg',
        chants: [
            { id: 'eisai_sy_narkotiko', name: 'eisai_sy_narkotiko', audio: 'chants/PAOK/eisai_sy_narkotiko.mp3', duration: 43 },
            { id: 'gia_sena_tha_pethanw', name: 'gia_sena_tha_pethanw', audio: 'chants/PAOK/gia_sena_tha_pethanw.mp3', duration: 43 },
            { id: 'ki_otan_tha_paw_ston_trelogiatro', name: 'ki_otan_tha_paw_ston_trelogiatro', audio: 'chants/PAOK/ki_otan_tha_paw_ston_trelogiatro.mp3', duration: 48 },
            { id: 'oi_ekdromes_den_stamatane', name: 'oi_ekdromes_den_stamatane', audio: 'chants/PAOK/oi_ekdromes_den_stamatane.mp3', duration: 32 },
            { id: 'olous_trela_sas_poulame', name: 'olous_trela_sas_poulame', audio: 'chants/PAOK/olous_trela_sas_poulame.mp3', duration: 41 },
            { id: 'paok_sagapw', name: 'paok_sagapw', audio: 'chants/PAOK/paok_sagapw.mp3', duration: 31 },
            { id: 'paokara_eimai_xalia', name: 'paokara_eimai_xalia', audio: 'chants/PAOK/paokara_eimai_xalia.mp3', duration: 32 },
            { id: 'paokara_exw_trela', name: 'paokara_exw_trela', audio: 'chants/PAOK/paokara_exw_trela.mp3', duration: 31 },
            { id: 'paokle', name: 'paokle', audio: 'chants/PAOK/paokle.mp3', duration: 55 },
            { id: 'skotosa_gia_ena_eisitirio', name: 'skotosa_gia_ena_eisitirio', audio: 'chants/PAOK/skotosa_gia_ena_eisitirio.mp3', duration: 51 },
            { id: 'xioliometra_kaname', name: 'xioliometra_kaname', audio: 'chants/PAOK/xioliometra_kaname.mp3', duration: 34 }
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

// Perfect Streak Bonus - consecutive PERFECT hits build an extra multiplier
export const PERFECT_STREAK = {
    // Multiplier grows by this amount per consecutive perfect
    BONUS_PER_STREAK: 0.1,      // +10% per perfect (streak 5 = +50%)
    // Maximum bonus multiplier cap
    MAX_BONUS: 2.0,             // Cap at 2x (requires 20 consecutive perfects)
    // Minimum streak to start showing bonus
    MIN_DISPLAY: 3,             // Show "Perfect x3!" at 3+ streak
    // Milestone thresholds for special effects
    MILESTONES: [5, 10, 15, 20],
    // Bonus points at milestones
    MILESTONE_BONUS: {
        5: 50,
        10: 150,
        15: 300,
        20: 500
    }
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

    // Level thresholds (cumulative XP needed) - 100 levels
    LEVEL_THRESHOLDS: [
        0,          // Level 1
        500,        // Level 2
        1200,       // Level 3
        2100,       // Level 4
        3200,       // Level 5
        4500,       // Level 6
        6000,       // Level 7
        7800,       // Level 8
        9800,       // Level 9
        12000,      // Level 10
        14500,      // Level 11
        17200,      // Level 12
        20100,      // Level 13
        23200,      // Level 14
        26500,      // Level 15
        30000,      // Level 16
        33800,      // Level 17
        37800,      // Level 18
        42000,      // Level 19
        46500,      // Level 20
        51200,      // Level 21
        56200,      // Level 22
        61400,      // Level 23
        66900,      // Level 24
        72600,      // Level 25
        78600,      // Level 26
        84900,      // Level 27
        91400,      // Level 28
        98200,      // Level 29
        105200,     // Level 30
        112500,     // Level 31
        120100,     // Level 32
        128000,     // Level 33
        136200,     // Level 34
        144700,     // Level 35
        153500,     // Level 36
        162600,     // Level 37
        172000,     // Level 38
        181800,     // Level 39
        192000,     // Level 40
        202500,     // Level 41
        213400,     // Level 42
        224700,     // Level 43
        236400,     // Level 44
        248500,     // Level 45
        261000,     // Level 46
        274000,     // Level 47
        287400,     // Level 48
        301200,     // Level 49
        315500,     // Level 50
        330200,     // Level 51
        345400,     // Level 52
        361100,     // Level 53
        377300,     // Level 54
        394000,     // Level 55
        411200,     // Level 56
        429000,     // Level 57
        447300,     // Level 58
        466200,     // Level 59
        485600,     // Level 60
        505600,     // Level 61
        526200,     // Level 62
        547400,     // Level 63
        569200,     // Level 64
        591600,     // Level 65
        614700,     // Level 66
        638400,     // Level 67
        662800,     // Level 68
        687900,     // Level 69
        713700,     // Level 70
        740200,     // Level 71
        767500,     // Level 72
        795500,     // Level 73
        824300,     // Level 74
        853900,     // Level 75
        884300,     // Level 76
        915500,     // Level 77
        947600,     // Level 78
        980500,     // Level 79
        1014300,    // Level 80
        1049000,    // Level 81
        1084600,    // Level 82
        1121100,    // Level 83
        1158600,    // Level 84
        1197000,    // Level 85
        1236400,    // Level 86
        1276800,    // Level 87
        1318200,    // Level 88
        1360700,    // Level 89
        1404200,    // Level 90
        1448800,    // Level 91
        1494500,    // Level 92
        1541400,    // Level 93
        1589400,    // Level 94
        1638600,    // Level 95
        1689000,    // Level 96
        1740600,    // Level 97
        1793500,    // Level 98
        1847600,    // Level 99
        1903000,    // Level 100 (max)
    ],

    // Level titles - 100 unique titles
    LEVEL_TITLES: [
        // Tier 1: Newcomer (1-10)
        'Newcomer',           // 1
        'Rookie',             // 2
        'Initiate',           // 3
        'Apprentice',         // 4
        'Regular',            // 5
        'Enthusiast',         // 6
        'Dedicated',          // 7
        'Committed',          // 8
        'Passionate',         // 9
        'True Fan',           // 10
        // Tier 2: Supporter (11-20)
        'Supporter',          // 11
        'Loyal Supporter',    // 12
        'Devoted Supporter',  // 13
        'Faithful',           // 14
        'Steadfast',          // 15
        'Unwavering',         // 16
        'Die-Hard',           // 17
        'Fanatic',            // 18
        'Zealot',             // 19
        'Hardcore',           // 20
        // Tier 3: Ultra (21-30)
        'Ultra',              // 21
        'Young Ultra',        // 22
        'Rising Ultra',       // 23
        'Proven Ultra',       // 24
        'Veteran Ultra',      // 25
        'Elite Ultra',        // 26
        'Senior Ultra',       // 27
        'Master Ultra',       // 28
        'Grand Ultra',        // 29
        'Supreme Ultra',      // 30
        // Tier 4: Capo (31-40)
        'Capo',               // 31
        'Junior Capo',        // 32
        'Assistant Capo',     // 33
        'Deputy Capo',        // 34
        'Lead Capo',          // 35
        'Senior Capo',        // 36
        'Head Capo',          // 37
        'Chief Capo',         // 38
        'Master Capo',        // 39
        'Grand Capo',         // 40
        // Tier 5: Section Leader (41-50)
        'Section Leader',     // 41
        'Block Captain',      // 42
        'Terrace Boss',       // 43
        'Stand Commander',    // 44
        'Curve General',      // 45
        'North End Chief',    // 46
        'South End Chief',    // 47
        'Kop Leader',         // 48
        'Curva Master',       // 49
        'Tribune Lord',       // 50
        // Tier 6: Legend (51-60)
        'Legend',             // 51
        'Rising Legend',      // 52
        'True Legend',        // 53
        'Living Legend',      // 54
        'Eternal Legend',     // 55
        'Mythic Legend',      // 56
        'Fabled Legend',      // 57
        'Storied Legend',     // 58
        'Timeless Legend',    // 59
        'Undying Legend',     // 60
        // Tier 7: Icon (61-70)
        'Icon',               // 61
        'Stadium Icon',       // 62
        'Terrace Icon',       // 63
        'Club Icon',          // 64
        'Fan Icon',           // 65
        'Cult Icon',          // 66
        'Living Icon',        // 67
        'Eternal Icon',       // 68
        'Sacred Icon',        // 69
        'Divine Icon',        // 70
        // Tier 8: Hall of Fame (71-80)
        'Hall of Famer',      // 71
        'Bronze Inductee',    // 72
        'Silver Inductee',    // 73
        'Gold Inductee',      // 74
        'Platinum Member',    // 75
        'Diamond Member',     // 76
        'Elite Member',       // 77
        'Premier Member',     // 78
        'Founder Member',     // 79
        'Legendary Member',   // 80
        // Tier 9: Immortal (81-90)
        'Immortal',           // 81
        'Rising Immortal',    // 82
        'True Immortal',      // 83
        'Ancient Immortal',   // 84
        'Eternal Immortal',   // 85
        'Celestial',          // 86
        'Transcendent',       // 87
        'Ascended',           // 88
        'Exalted',            // 89
        'Demigod',            // 90
        // Tier 10: Supreme (91-100)
        'Minor Deity',        // 91
        'Lesser God',         // 92
        'Football God',       // 93
        'Stadium Deity',      // 94
        'Terrace Titan',      // 95
        'Ultras Olympian',    // 96
        'Pantheon Member',    // 97
        'Elder God',          // 98
        'Prime Deity',        // 99
        'The Absolute',       // 100
    ]
};

// Unlockable cosmetics by level
export const LEVEL_UNLOCKS = {
    1: { type: 'scarf', id: 'basic', name: 'Basic Scarf' },
    5: { type: 'effect', id: 'extra_smoke', name: 'Extra Smoke' },
    10: { type: 'scarf', id: 'striped', name: 'Striped Scarf' },
    15: { type: 'effect', id: 'golden_confetti', name: 'Golden Confetti' },
    20: { type: 'scarf', id: 'premium', name: 'Premium Scarf' },
    25: { type: 'effect', id: 'fireworks', name: 'Victory Fireworks' },
    30: { type: 'title', id: 'supreme', name: 'Supreme Ultra Title' },
    40: { type: 'effect', id: 'pyro_burst', name: 'Pyro Burst' },
    50: { type: 'scarf', id: 'legendary', name: 'Legendary Scarf' },
    60: { type: 'effect', id: 'stadium_lights', name: 'Stadium Lights' },
    70: { type: 'title', id: 'icon', name: 'Icon Title' },
    80: { type: 'effect', id: 'golden_aura', name: 'Golden Aura' },
    90: { type: 'scarf', id: 'immortal', name: 'Immortal Scarf' },
    100: { type: 'title', id: 'absolute', name: 'The Absolute Title' }
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
    first_win: {
        id: 'first_win',
        name: 'First Victory',
        description: 'Win your first Match Day',
        icon: '🏅',
        xpReward: 150
    },
    loyal_fan: {
        id: 'loyal_fan',
        name: 'Loyal Fan',
        description: 'Play 50 games with a single club',
        icon: '💚',
        xpReward: 200
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
// Choreo Unlock System
// ============================================

export const CHOREO_UNLOCKS = {
    // Starting choreos (unlocked by default for all players)
    starting: ['default', 'wave', 'tifo'],

    // Level-based unlocks: level number -> choreo info
    level: {
        5: { choreo: 'scarfUp', name: 'Scarf Display', icon: '🧣' },
        15: { choreo: 'bounce', name: 'Bounce Mode', icon: '🦘' },
        25: { choreo: 'clap', name: 'Clap Sync', icon: '👏' },
        35: { choreo: 'drums', name: 'Drums Display', icon: '🥁' },
        50: { choreo: 'columns', name: 'Vertical Columns', icon: '📊' },
        60: { choreo: 'spotlight', name: 'Spotlight Display', icon: '📱' },
        75: { choreo: 'tornado', name: 'Tornado Display', icon: '🌪️' },
        90: { choreo: 'surge', name: 'Crowd Surge', icon: '🌊' }
    },

    // Achievement-based unlocks: achievement id -> choreo info
    achievement: {
        centurion: { choreo: 'pyro', name: 'Pyro Show', icon: '🔥' },
        fever_master: { choreo: 'moshpit', name: 'Mosh Pit', icon: '🌀' },
        perfect_chant: { choreo: 'checkerboard', name: 'Checkerboard Display', icon: '🏁' },
        rivalry: { choreo: 'ultras', name: 'Ultras Display', icon: '🚩' },
        marathon: { choreo: 'inferno', name: 'Inferno Mode', icon: '🔥' },
        first_win: { choreo: 'viking', name: 'Viking Clap', icon: '👏' },
        loyal_fan: { choreo: 'anthem', name: 'Anthem Display', icon: '🫡' }
    },

    // All choreo IDs in order (for display purposes)
    allChoreos: [
        { id: 'default', name: 'Default', icon: '👥' },
        { id: 'wave', name: 'Wave', icon: '🌊' },
        { id: 'scarfUp', name: 'Scarf Display', icon: '🧣' },
        { id: 'tifo', name: 'Tifo Display', icon: '🎨' },
        { id: 'bounce', name: 'Bounce Mode', icon: '🦘' },
        { id: 'clap', name: 'Clap Sync', icon: '👏' },
        { id: 'inferno', name: 'Inferno Mode', icon: '🔥' },
        { id: 'pyro', name: 'Pyro Show', icon: '🔥' },
        { id: 'moshpit', name: 'Mosh Pit', icon: '🌀' },
        { id: 'checkerboard', name: 'Checkerboard Display', icon: '🏁' },
        { id: 'columns', name: 'Vertical Columns', icon: '📊' },
        { id: 'ultras', name: 'Ultras Display', icon: '🚩' },
        { id: 'drums', name: 'Drums Display', icon: '🥁' },
        { id: 'spotlight', name: 'Spotlight Display', icon: '📱' },
        { id: 'viking', name: 'Viking Clap', icon: '👏' },
        { id: 'tornado', name: 'Tornado Display', icon: '🌪️' },
        { id: 'anthem', name: 'Anthem Display', icon: '🫡' },
        { id: 'surge', name: 'Crowd Surge', icon: '🌊' }
    ]
};

// ============================================
// Hold Beat (Long Press) System
// ============================================

// ============================================
// Analytics Dashboard
// ============================================

export const ANALYTICS = {
    MAX_HISTORY_ENTRIES: 100,      // Maximum games to store (FIFO pruning)
    TREND_WINDOW_SIZE: 10,         // Number of games for trend calculations
    MIN_GAMES_FOR_TRENDS: 3,       // Minimum games needed to show trends
    CHART_ANIMATION_DURATION: 500, // Chart animation in ms
    SESSION_TIMEOUT: 30 * 60 * 1000, // 30 min session timeout
    COLORS: {
        perfect: '#00ff88',
        good: '#88ff00',
        ok: '#ffaa00',
        miss: '#ff4444',
        trend: '#00aaff',
        trendFill: 'rgba(0, 170, 255, 0.15)',
        grid: 'rgba(255, 255, 255, 0.1)',
        label: 'rgba(255, 255, 255, 0.7)'
    }
};

// ============================================
// Input Lag Calibration
// ============================================

export const CALIBRATION = {
    TEMPO_MS: 600,           // 100 BPM metronome tempo
    WARMUP_BEATS: 4,         // Non-recorded beats to warm up
    RECORD_BEATS: 8,         // Beats to record for calibration
    MIN_OFFSET: -150,        // Minimum offset (ms) - player taps early
    MAX_OFFSET: 150,         // Maximum offset (ms) - player taps late
    OUTLIER_THRESHOLD: 250   // Ignore mistaps beyond this deviation (ms)
};

// ============================================
// AI Trash Talk System
// ============================================

export const TRASH_TALK = {
    ENABLED_DEFAULT: true,
    MIN_INTERVAL: 4000,      // Minimum ms between trash talk messages
    DISPLAY_DURATION: 2500,  // How long message stays visible
    MISS_STREAK_THRESHOLD: 3, // Misses in a row to trigger taunt

    // Message categories with weighted random selection
    MESSAGES: {
        // When AI is significantly ahead
        winning: [
            "Is that all you've got?",
            "My grandma has better rhythm!",
            "Too easy!",
            "You call that support?",
            "The away section is louder!",
            "Wake up!",
            "Amateur hour over there!",
            "Even the ball boys are better!"
        ],
        // When AI gets a perfect hit
        aiPerfect: [
            "PERFECT! Watch and learn!",
            "That's how it's done!",
            "Feel the rhythm!",
            "Poetry in motion!",
            "Textbook timing!"
        ],
        // When player misses
        playerMiss: [
            "MISS! Ha!",
            "Oops!",
            "Off beat!",
            "That was painful to watch",
            "Did you even try?",
            "Butterfingers!",
            "Wrong sport?",
            "My turn to shine!"
        ],
        // When player misses multiple times in a row
        missStreak: [
            "Having trouble there?",
            "Maybe try an easier song?",
            "Need a tutorial?",
            "This is embarrassing...",
            "Your crowd is leaving!",
            "Should I slow down for you?"
        ],
        // When AI builds a combo
        aiCombo: [
            "Combo! Can you keep up?",
            "On fire!",
            "Unstoppable!",
            "The ultras are with ME!",
            "Feel that momentum!"
        ],
        // When player breaks their combo
        comboBreak: [
            "There goes your streak!",
            "Combo CRUSHED!",
            "Back to zero!",
            "All that work, gone!",
            "Momentum shift!"
        ],
        // When AI is losing (cocky denial)
        losing: [
            "Lucky streak, that's all!",
            "I'm just warming up!",
            "Don't get comfortable!",
            "The comeback is coming!",
            "You can't keep this up!"
        ],
        // Game start taunts
        gameStart: [
            "Let's see what you've got!",
            "Prepare to lose!",
            "My stadium now!",
            "Hope you're ready!",
            "This won't take long!"
        ],
        // Near end of game (AI winning)
        nearEndWinning: [
            "It's almost over for you!",
            "Too little, too late!",
            "Accept defeat!",
            "The final whistle approaches!"
        ],
        // Near end of game (AI losing)
        nearEndLosing: [
            "Not over yet!",
            "Miracle time!",
            "Never surrender!",
            "One last push!"
        ],
        // Matchday specific - AI scores goal
        aiGoal: [
            "GOOOOAL! Get in!",
            "The net is BULGING!",
            "What a strike!",
            "Your defense is WEAK!",
            "Too clinical!"
        ],
        // Matchday specific - Player scores goal
        playerGoal: [
            "Lucky goal...",
            "Won't happen again!",
            "Fluke!",
            "Enjoy it while it lasts!"
        ]
    }
};

// Personality-specific trash talk styles (modifies tone/frequency)
export const TRASH_TALK_PERSONALITIES = {
    aggressive: {
        frequency: 1.5,      // More frequent trash talk
        categories: ['winning', 'playerMiss', 'aiPerfect', 'comboBreak']
    },
    comebackKing: {
        frequency: 1.0,
        categories: ['losing', 'nearEndLosing', 'comboBreak']
    },
    consistent: {
        frequency: 0.7,      // Less frequent, more measured
        categories: ['winning', 'aiCombo']
    },
    clutch: {
        frequency: 1.2,
        categories: ['nearEndWinning', 'nearEndLosing', 'aiPerfect']
    },
    wildcard: {
        frequency: 1.3,
        categories: ['playerMiss', 'missStreak', 'aiCombo', 'winning', 'losing']
    }
};

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
