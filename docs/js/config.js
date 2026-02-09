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
            { id: 'kolisa', name: 'kolisa', audio: 'chants/Panathinaikos/kolisa.mp3', duration: 15 },
            { id: 'sti_leofor_paizoume', name: 'sti_leofor_paizoume', audio: 'chants/Panathinaikos/sti_leofor_paizoume.mp3', duration: 15 },
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
    FULLTIME: 'fulltime'
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
    ONSET_THRESHOLD_MULTIPLIER: 1.2,
    ONSET_THRESHOLD_OFFSET: 0.005,
    ONSET_MEDIAN_WINDOW: 11,
    ONSET_MIN_GAP_SEC: 0.10,
    MIN_BPM: 60,
    MAX_BPM: 200,
    GRID_PHASE_CANDIDATES: 50,
    GRID_SNAP_WINDOW_SEC: 0.08,
    GRID_SNAP_WEIGHT: 0.5,
    BASS_CUTOFF_HZ: 150,
    LOW_VOCAL_HZ: 250,
    LOW_VOCAL_WEIGHT: 0.3,
    VOCAL_CORE_HZ: 3500,
    VOCAL_CORE_WEIGHT: 3.0,
    SIBILANCE_HZ: 6000,
    SIBILANCE_WEIGHT: 0.5,
    MIN_PLAYABLE_GAP_SEC: 0.28,
    MIN_ONSETS_FOR_DIRECT_USE: 6,
    MAX_BEATS_PER_SECOND: 3.5
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

export const MATCHDAY = {
    CHANTS_PER_HALF: 3,
    MIN_CHANTS_FOR_MATCHDAY: 6,
    GOAL_COMBO_THRESHOLD: 0.40,
    AI_GOAL_CHANCE: 0.45,
    CHANT_TRANSITION_MS: 3000,
};
