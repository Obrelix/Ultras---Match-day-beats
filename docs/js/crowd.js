// ============================================
// crowd.js — Pixel supporter crowd, particles, flags, flares, smoke
// ============================================

import { state } from './state.js';
import { elements } from './ui.js';
import { getComboMultiplier } from './input.js';
import { isChoreoUnlocked, isDebugMode } from './progression.js';

// ============================================
// Performance Optimization: Gradient & Color Cache
// Avoids creating 20+ gradients per frame
// ============================================

const _gradientCache = {
    canvas: null,
    ctx: null,
    gradients: new Map(),
    frameId: 0,
    // Cached hex-to-rgba conversions
    rgbaCache: new Map()
};

// Get or create cached gradient (reuse within same frame)
function getCachedGradient(ctx, type, key, createFn) {
    const cacheKey = `${type}_${key}`;
    let cached = _gradientCache.gradients.get(cacheKey);
    if (!cached || cached.frameId !== _gradientCache.frameId) {
        cached = { gradient: createFn(), frameId: _gradientCache.frameId };
        _gradientCache.gradients.set(cacheKey, cached);
    }
    return cached.gradient;
}

// Fast hex to rgba with caching
function hexToRgbaCached(hex, alpha) {
    if (!hex) return `rgba(100, 150, 255, ${alpha})`;
    const cacheKey = `${hex}_${alpha}`;
    let cached = _gradientCache.rgbaCache.get(cacheKey);
    if (cached) return cached;

    let result;
    if (hex.startsWith('#')) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        result = `rgba(${r}, ${g}, ${b}, ${alpha})`;
    } else if (hex.startsWith('rgb')) {
        result = hex.replace('rgb', 'rgba').replace(')', `, ${alpha})`);
    } else {
        result = `rgba(100, 150, 255, ${alpha})`;
    }
    _gradientCache.rgbaCache.set(cacheKey, result);
    return result;
}

// Advance frame ID (call once per frame)
function advanceGradientFrame() {
    _gradientCache.frameId++;
    // Clear old gradients less frequently (every ~30 seconds at 60fps)
    // This preserves cache benefits while preventing unbounded memory growth
    if (_gradientCache.frameId % 1800 === 0) {
        _gradientCache.gradients.clear();
    }
}

// ============================================
// Performance Optimization: Frame-level State Cache
// Cache frequently accessed state at frame start
// ============================================

const _frameCache = {
    reducedEffects: false,
    primaryColor: '#006633',
    secondaryColor: '#FFFFFF',
    crowdEmotion: 'neutral',
    isFrenzy: false,
    comboMultiplier: 1,
    now: 0,
    // Cached combo strings (avoid allocation during frenzy)
    lastComboCount: -1,
    lastMultiplier: -1,
    comboStr: '',
    multiStr: '',
    fullStr: ''
};

function updateFrameCache(now) {
    _frameCache.now = now;
    _frameCache.reducedEffects = state.settings?.reducedEffects === true;  // Guard against undefined settings
    // Safely access colors with fallbacks
    const colors = state.cachedColors || (state.selectedClub?.colors) || null;
    _frameCache.primaryColor = colors?.primary || '#006633';
    _frameCache.secondaryColor = colors?.secondary || '#FFFFFF';
    _frameCache.crowdEmotion = state.crowdEmotion || 'neutral';
    _frameCache.isFrenzy = (state.playerCombo || 0) > 5 || state.crowdEmotion === 'celebrate';
    _frameCache.comboMultiplier = getComboMultiplier();
}

// ============================================
// Screen Effect System - Shake, Flash, Color Tint
// ============================================

// Apply screen shake transform - returns offset to apply via ctx.translate
function applyScreenShake(now) {
    const shake = state.screenShake;
    if (!shake || !shake.active) return { x: 0, y: 0 };

    const elapsed = now - shake.startTime;
    if (elapsed >= shake.duration) {
        shake.active = false;
        return { x: 0, y: 0 };
    }

    const progress = elapsed / shake.duration;
    let decayFactor;

    switch (shake.decay) {
        case 'exponential':
            decayFactor = Math.pow(1 - progress, 2);
            break;
        case 'bounce':
            // Oscillating decay
            decayFactor = (1 - progress) * Math.abs(Math.cos(progress * Math.PI * 3));
            break;
        case 'explosion':
            // Sharp start, long tail
            decayFactor = Math.pow(1 - progress, 1.5) * (1 + Math.sin(progress * Math.PI * 4) * 0.3);
            break;
        case 'snap':
            // Quick jolt then settle
            decayFactor = progress < 0.3 ? 1 : Math.pow(1 - (progress - 0.3) / 0.7, 3);
            break;
        case 'linear':
        default:
            decayFactor = 1 - progress;
    }

    const intensity = shake.intensity * decayFactor;
    const angle = elapsed * 0.05; // Rotating shake direction
    const x = Math.sin(angle) * intensity * (Math.random() * 0.4 + 0.8);
    const y = Math.cos(angle * 1.3) * intensity * (Math.random() * 0.4 + 0.8);

    return { x, y };
}

// Draw screen flash overlay
function drawScreenFlash(ctx, w, h, now) {
    const flash = state.screenFlash;
    if (!flash || !flash.active) return;

    const elapsed = now - flash.startTime;
    if (elapsed >= flash.duration) {
        flash.active = false;
        return;
    }

    const progress = elapsed / flash.duration;
    // Quick fade-in, gradual fade-out
    const alpha = progress < 0.15
        ? (progress / 0.15) * flash.intensity
        : flash.intensity * (1 - (progress - 0.15) / 0.85);

    // Radial gradient from center
    const gradient = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
    gradient.addColorStop(0, flash.color);
    gradient.addColorStop(1, 'transparent');

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
}

// Get combo color tint for continuous ambient effect at high combos
function getComboColorTint(combo, now) {
    if (combo < 10) return null;

    // Pulsing intensity
    const pulseSpeed = combo >= 50 ? 150 : combo >= 25 ? 200 : 300;
    const baseAlpha = combo >= 50 ? 0.08 : combo >= 25 ? 0.05 : 0.03;
    const pulseRange = combo >= 50 ? 0.04 : 0.02;
    const alpha = baseAlpha + Math.sin(now / pulseSpeed) * pulseRange;

    // Color based on combo level
    let color;
    if (combo >= 100) {
        // Rainbow cycling at 100+
        const hue = (now / 20) % 360;
        color = `hsla(${hue}, 100%, 60%, ${alpha})`;
    } else if (combo >= 50) {
        color = `rgba(255, 68, 0, ${alpha})`; // Deep orange/red
    } else if (combo >= 25) {
        color = `rgba(255, 136, 0, ${alpha})`; // Orange
    } else {
        color = `rgba(255, 215, 0, ${alpha})`; // Gold
    }

    return color;
}

// Draw combo color tint overlay
function drawComboTint(ctx, w, h, combo, now) {
    const tint = getComboColorTint(combo, now);
    if (!tint) return;

    ctx.save();
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
}

// ============================================
// Choreo Configuration System
// Each choreo type defines its unique crowd behavior
// To add a new choreo: add an entry here and implement any new item/overlay renderers
// ============================================

const CHOREO_TYPES = {
    // Type 0: Default - individual movement, no special items
    default: {
        id: 0,
        name: 'default',
        comboMin: 0,
        swayType: 'individual',      // 'individual' | 'synchronized' | 'flag-linked'
        swaySpeed: 120,              // ms per cycle (lower = faster)
        swayAmplitude: 3,            // pixels
        armsPosition: 'normal',      // 'normal' | 'up' | 'scarf-hold'
        jumpPattern: 'default',      // 'default' | 'wave' | 'synchronized'
        showItem: null,              // null | 'scarf' | 'placard' | custom string
        showOverlay: false,          // Whether to show tifo/banner overlay
        overlayRenderer: null        // Function name or null
    },

    // Type 1: Wave - row-based synchronized wave jumping
    wave: {
        id: 1,
        name: 'wave',
        comboMin: 10,
        swayType: 'synchronized',
        swaySpeed: 200,
        swayAmplitude: 5,
        armsPosition: 'normal',
        jumpPattern: 'wave',
        waveRowDelay: 1.2566,        // ~0.4π - phase offset per row
        showItem: null,
        showOverlay: false,
        overlayRenderer: null
    },

    // Type 2: Scarf-Up - arms stretched holding scarves above heads
    scarfUp: {
        id: 2,
        name: 'scarfUp',
        comboMin: 20,
        swayType: 'synchronized',
        swaySpeed: 200,
        swayAmplitude: 5,
        armsPosition: 'scarf-hold',
        jumpPattern: 'default',
        showItem: 'scarf',
        scarfWaveSpeed: 300,         // ms per wave cycle
        scarfWaveAmplitude: 2,       // pixels
        showOverlay: false,
        overlayRenderer: null
    },

    // Type 3: Tifo - placards forming patterns + badge overlay
    tifo: {
        id: 3,
        name: 'tifo',
        comboMin: 30,
        swayType: 'synchronized',
        swaySpeed: 200,
        swayAmplitude: 5,
        armsPosition: 'scarf-hold',
        jumpPattern: 'default',
        showItem: 'placard',
        placardWaveSpeed: 600,       // ms per wave cycle
        placardColorWaveSpeed: 400,  // ms for color alternation
        showOverlay: true,
        overlayRenderer: 'drawTifoOverlay'
    },

    // Type 4: Bounce - synchronized pogo jumping with pumping arms
    bounce: {
        id: 4,
        name: 'bounce',
        comboMin: 40,
        swayType: 'synchronized',
        swaySpeed: 100,              // Faster sway
        swayAmplitude: 8,            // Bigger amplitude
        armsPosition: 'pump',        // Pumping arms up and down
        jumpPattern: 'pogo',         // High synchronized bouncing
        pogoHeight: 28,              // Base jump height (higher than normal)
        pogoSpeed: 150,              // ms per bounce cycle
        showItem: null,
        showOverlay: false,
        overlayRenderer: null
    },

    // Type 5: Clap - synchronized clapping with intense energy
    clap: {
        id: 5,
        name: 'clap',
        comboMin: 50,
        swayType: 'synchronized',
        swaySpeed: 80,               // Even faster
        swayAmplitude: 6,
        armsPosition: 'clap',        // Clapping hands together
        jumpPattern: 'pogo',
        pogoHeight: 22,
        pogoSpeed: 200,              // Synced with clap rhythm
        clapSpeed: 200,              // ms per clap cycle
        showItem: 'placard',
        showOverlay: false,
        overlayRenderer: null
    },

    // Type 6: Inferno - maximum intensity, fire and chaos
    inferno: {
        id: 6,
        name: 'inferno',
        comboMin: 60,
        swayType: 'synchronized',
        swaySpeed: 60,               // Very fast swaying
        swayAmplitude: 12,           // Maximum sway amplitude
        armsPosition: 'scarf-hold',
        jumpPattern: 'pogo',
        pogoHeight: 35,              // Maximum jump height
        pogoSpeed: 100,              // Fastest bounce
        showItem: 'banner',          // Large banners waving
        bannerWaveSpeed: 120,
        bannerHeight: 20,
        showOverlay: true,
        overlayRenderer: 'drawInfernoOverlay'
    },

    // Type 7: Pyro - flares and smoke effects (unlock: centurion achievement)
    pyro: {
        id: 7,
        name: 'pyro',
        comboMin: 70,
        swayType: 'synchronized',
        swaySpeed: 80,
        swayAmplitude: 10,
        armsPosition: 'up',
        jumpPattern: 'pogo',
        pogoHeight: 25,
        pogoSpeed: 140,
        showItem: 'flare',
        showOverlay: true,
        overlayRenderer: 'drawPyroOverlay'
    },

    // Type 8: Moshpit - chaotic crowd energy (unlock: fever_master achievement)
    moshpit: {
        id: 8,
        name: 'moshpit',
        comboMin: 80,
        swayType: 'chaotic',         // Each person moves randomly
        swaySpeed: 50,               // Very fast
        swayAmplitude: 15,           // Large random movements
        armsPosition: 'push',        // Pushing motion
        jumpPattern: 'chaotic',      // Random jump timing
        showItem: null,
        showOverlay: false,
        overlayRenderer: null
    },

    // Type 9: Checkerboard - alternating color placards, stationary (unlock: perfect_chant)
    checkerboard: {
        id: 9,
        name: 'checkerboard',
        comboMin: 90,
        swayType: 'none',            // Stationary crowd
        swaySpeed: 0,
        swayAmplitude: 0,
        armsPosition: 'placard-hold',
        jumpPattern: 'none',         // No jumping - stationary display
        showItem: 'placard-checker', // Alternating primary/secondary colors
        placardPattern: 'checkerboard',
        showOverlay: false,
        overlayRenderer: null
    },

    // Type 10: Columns - vertical striped placards (unlock: level 15)
    columns: {
        id: 10,
        name: 'columns',
        comboMin: 95,
        swayType: 'synchronized',
        swaySpeed: 300,
        swayAmplitude: 2,            // Subtle sway
        armsPosition: 'placard-hold',
        jumpPattern: 'default',
        showItem: 'placard-columns', // Vertical columns of primary/secondary
        placardPattern: 'vertical',
        showOverlay: false,
        overlayRenderer: null
    },

    // Type 11: Ultras - large flags and banners (unlock: rivalry achievement)
    ultras: {
        id: 11,
        name: 'ultras',
        comboMin: 100,
        swayType: 'synchronized',
        swaySpeed: 150,
        swayAmplitude: 6,
        armsPosition: 'flag-hold',
        jumpPattern: 'wave',
        waveRowDelay: 1.2566,
        showItem: 'large-flag',
        flagWaveSpeed: 200,
        showOverlay: true,
        overlayRenderer: 'drawUltrasOverlay'
    },

    // Type 12: Drums - percussion display with alternating drum hits
    drums: {
        id: 12,
        name: 'drums',
        comboMin: 105,
        swayType: 'synchronized',
        swaySpeed: 100,
        swayAmplitude: 4,
        armsPosition: 'drumming',
        jumpPattern: 'synchronized',
        showItem: 'drumsticks',
        drumSpeed: 150,              // ms per drum hit cycle
        showOverlay: false,
        overlayRenderer: null
    },

    // Type 13: Spotlight - phone flashlight display
    spotlight: {
        id: 13,
        name: 'spotlight',
        comboMin: 110,
        swayType: 'synchronized',
        swaySpeed: 400,              // Slow gentle sway
        swayAmplitude: 3,
        armsPosition: 'phone-hold',
        jumpPattern: 'none',         // Stationary for phone display
        showItem: 'phone-light',
        phoneGlowSpeed: 300,         // ms per glow pulse
        showOverlay: true,
        overlayRenderer: 'drawSpotlightOverlay'
    },

    // Type 14: Viking - thunderclap with wide-to-together motion
    viking: {
        id: 14,
        name: 'viking',
        comboMin: 115,
        swayType: 'none',
        swaySpeed: 0,
        swayAmplitude: 0,
        armsPosition: 'viking-clap',
        jumpPattern: 'synchronized',
        pogoHeight: 8,               // Small stomp
        pogoSpeed: 800,              // Slow building rhythm
        vikingClapSpeed: 800,        // ms per clap cycle
        showItem: null,
        showOverlay: false,
        overlayRenderer: null
    },

    // Type 15: Tornado - spinning scarf display
    tornado: {
        id: 15,
        name: 'tornado',
        comboMin: 120,
        swayType: 'synchronized',
        swaySpeed: 150,
        swayAmplitude: 5,
        armsPosition: 'scarf-spin',
        jumpPattern: 'default',
        showItem: 'spinning-scarf',
        spinSpeed: 200,              // ms per rotation
        showOverlay: false,
        overlayRenderer: null
    },

    // Type 16: Anthem - hand on heart, solemn display
    anthem: {
        id: 16,
        name: 'anthem',
        comboMin: 125,
        swayType: 'none',
        swaySpeed: 0,
        swayAmplitude: 0,
        armsPosition: 'heart',
        jumpPattern: 'none',         // Completely stationary
        showItem: null,
        showOverlay: true,
        overlayRenderer: 'drawAnthemOverlay'
    },

    // Type 17: Surge - forward crowd surge with push motion
    surge: {
        id: 17,
        name: 'surge',
        comboMin: 130,
        swayType: 'surge',           // Forward/back wave
        swaySpeed: 120,
        swayAmplitude: 12,           // Large forward movement
        armsPosition: 'push',
        jumpPattern: 'wave',
        waveRowDelay: 0.8,           // Fast cascading
        showItem: null,
        showOverlay: false,
        overlayRenderer: null
    }
};

// Order of choreo types for initial progression (0-59)
const CHOREO_PROGRESSION = ['default', 'wave', 'scarfUp', 'tifo', 'bounce', 'clap'];

// High-intensity cycle (70+): cycles through ALL choreos (excluding default and inferno)
// Inferno is milestone-only (100-109, 200-209, etc.)
const CHOREO_HIGH_CYCLE = ['wave', 'scarfUp', 'tifo', 'bounce', 'clap', 'pyro', 'moshpit', 'checkerboard', 'columns', 'ultras', 'drums', 'spotlight', 'viking', 'tornado', 'anthem', 'surge'];

// Extended progression for combo 60-99+ (new unlockable choreos)
const CHOREO_EXTENDED = [
    { id: 'pyro', comboMin: 70 },
    { id: 'moshpit', comboMin: 80 },
    { id: 'checkerboard', comboMin: 90 },
    { id: 'columns', comboMin: 95 },
    { id: 'ultras', comboMin: 100 },
    { id: 'drums', comboMin: 105 },
    { id: 'spotlight', comboMin: 110 },
    { id: 'viking', comboMin: 115 },
    { id: 'tornado', comboMin: 120 },
    { id: 'anthem', comboMin: 125 },
    { id: 'surge', comboMin: 130 }
];

// Track last logged combo to avoid spam
let _lastLoggedCombo = -1;

// Get current choreo config based on combo count, respecting unlock status
// Uses fallback logic: if desired choreo is locked, use highest unlocked
function getChoreoConfig(combo) {
    let result;
    let debugInfo = { combo, reason: '' };

    // Initial progression (0-69): step through choreos as combo grows
    if (combo < 70) {
        const targetIndex = Math.min(Math.floor(combo / 10), CHOREO_PROGRESSION.length - 1);
        for (let i = targetIndex; i >= 0; i--) {
            const choreoId = CHOREO_PROGRESSION[i];
            if (isChoreoUnlocked(choreoId)) {
                result = CHOREO_TYPES[choreoId];
                debugInfo.reason = `progression[${i}]`;
                break;
            }
        }
        if (!result) {
            result = CHOREO_TYPES.default;
            debugInfo.reason = 'fallback default';
        }
    }
    // Special: INFERNO milestone at 100-109, 200-209, 300-309, etc.
    else if (combo >= 100 && combo % 100 < 10) {
        if (isChoreoUnlocked('inferno')) {
            result = CHOREO_TYPES.inferno;
            debugInfo.reason = `MILESTONE ${Math.floor(combo/100)*100}-${Math.floor(combo/100)*100+9}`;
        }
        // Fall through to regular cycle if inferno not unlocked
    }

    // High combo (70+): cycle through all unlocked choreos
    if (!result) {
        const unlockedHighCycle = CHOREO_HIGH_CYCLE.filter(id => isChoreoUnlocked(id));
        debugInfo.unlockedCount = unlockedHighCycle.length;

        if (unlockedHighCycle.length === 0) {
            result = CHOREO_TYPES.default;
            debugInfo.reason = 'no unlocked choreos';
        } else {
            // Calculate effective combo, excluding inferno windows (10 combos each)
            let effectiveCombo = combo - 70;
            const infernoWindowsPassed = combo >= 110 ? Math.floor((combo - 10) / 100) : 0;
            if (infernoWindowsPassed > 0) {
                effectiveCombo -= infernoWindowsPassed * 10;
            }

            const cycleIndex = Math.floor(effectiveCombo / 10) % unlockedHighCycle.length;
            result = CHOREO_TYPES[unlockedHighCycle[cycleIndex]];

            debugInfo.effectiveCombo = effectiveCombo;
            debugInfo.infernoWindowsPassed = infernoWindowsPassed;
            debugInfo.cycleIndex = cycleIndex;
            debugInfo.cycleLength = unlockedHighCycle.length;
            debugInfo.reason = `cycle[${cycleIndex}] = ${unlockedHighCycle[cycleIndex]}`;
        }
    }

    // Log only when combo changes and debug mode is enabled
    if (isDebugMode() && combo !== _lastLoggedCombo && combo >= 70) {
        _lastLoggedCombo = combo;
        console.log(`%c[CHOREO] Combo ${combo} → ${result.name.toUpperCase()}`,
            'color: #00ff88; font-weight: bold', debugInfo);
    }

    return result;
}

// Get choreo type ID (for backwards compatibility)
function getChoreoType(combo) {
    return getChoreoConfig(combo).id;
}

// Calculate sway offset based on choreo config
function getChoreoSway(choreo, supporter, now, preCalc = {}) {
    const { swayType, swaySpeed, swayAmplitude } = choreo;

    switch (swayType) {
        case 'synchronized':
            // All supporters move together
            const sinVal = preCalc.sinSway !== undefined
                ? preCalc.sinSway
                : Math.sin(now / swaySpeed);
            return sinVal * swayAmplitude;

        case 'flag-linked':
            // Movement linked to flag swing (handled in drawSupporter)
            return 0;

        case 'chaotic':
            // Moshpit style - each supporter moves randomly with high frequency
            const chaosPhase = now / swaySpeed + supporter.jumpPhase * 10;
            const chaosX = Math.sin(chaosPhase * 1.7) * swayAmplitude;
            const chaosY = Math.cos(chaosPhase * 2.3) * swayAmplitude * 0.5;
            // Use supporter.chaosOffset for persistent random direction
            const chaosDir = ((supporter.x * 7 + supporter.row * 13) % 17) / 17;
            return (chaosX + chaosY * chaosDir) * (0.7 + Math.random() * 0.3);

        case 'none':
            // Stationary - no sway
            return 0;

        case 'surge':
            // Forward/back wave motion - each row slightly delayed
            const surgePhase = now / swaySpeed + supporter.row * 0.5;
            return Math.sin(surgePhase) * swayAmplitude;

        case 'individual':
        default:
            // Each supporter has their own phase
            return Math.sin(now / swaySpeed + supporter.jumpPhase) * swayAmplitude;
    }
}

// Calculate jump offset based on choreo config
function getChoreoJump(choreo, supporter, beatDecay, multiplier, now, preCalc = {}) {
    const { jumpPattern, waveRowDelay, pogoHeight, pogoSpeed } = choreo;

    switch (jumpPattern) {
        case 'wave':
            // Row-based wave effect
            const baseJump = 18 + (multiplier - 1) * 13;
            const waveBase = preCalc.sinWaveBase !== undefined
                ? preCalc.sinWaveBase
                : now / 250;
            const rowWave = Math.abs(Math.sin(waveBase + supporter.row * (waveRowDelay || 1.2566))) * multiplier * 3;
            return beatDecay * baseJump * supporter.jumpStrength + rowWave;

        case 'synchronized':
            // All jump together (no phase offset)
            const syncJump = 18 + (multiplier - 1) * 13;
            return beatDecay * syncJump * supporter.jumpStrength;

        case 'pogo':
            // High-energy synchronized bouncing - continuous even without beat
            const height = pogoHeight || 25;
            const speed = pogoSpeed || 150;
            // Continuous bounce with beat amplification
            const pogoBase = Math.abs(Math.sin(now / speed)) * height;
            const beatBoost = beatDecay * 10 * multiplier;
            return (pogoBase + beatBoost) * supporter.jumpStrength;

        case 'chaotic':
            // Moshpit style - random individual jumping
            const chaoticPhase = now / 80 + supporter.jumpPhase * 5;
            const chaoticJump = Math.abs(Math.sin(chaoticPhase)) * 20;
            // Random bursts of extra energy
            const burst = ((now + supporter.x * 17) % 500) < 100 ? 15 : 0;
            return (chaoticJump + burst + beatDecay * 10) * supporter.jumpStrength;

        case 'none':
            // Stationary - no jumping (for checkerboard display)
            return 0;

        case 'default':
        default:
            // Individual phase offsets
            const timeSinceBeat = preCalc.timeSinceBeat || 0;
            const baseJumpDefault = 18 + (multiplier - 1) * 13;
            const phaseOffset = Math.sin(timeSinceBeat * 12 + supporter.jumpPhase) * 0.3;
            return beatDecay * baseJumpDefault * supporter.jumpStrength * (1 + phaseOffset);
    }
}

// Draw choreo-specific items (scarves, placards, etc.)
function drawChoreoItem(ctx, choreo, supporter, x, y, now, colors, batch) {
    const { showItem } = choreo;
    const px = supporter.px;

    // Skip if supporter has flag or flare (they're busy) unless choreo requires it
    if ((supporter.hasFlag || supporter.hasFlare) && showItem !== 'flare' && showItem !== 'large-flag') return;

    switch (showItem) {
        case 'scarf':
            drawChoreoScarf(ctx, choreo, supporter, x, y, now, colors, px, batch);
            break;

        case 'placard':
            drawChoreoPlacard(ctx, choreo, supporter, x, y, now, colors, px, batch);
            break;

        case 'banner':
            drawChoreoBanner(ctx, choreo, supporter, x, y, now, colors, px, batch);
            break;

        case 'flare':
            drawChoreoFlare(ctx, choreo, supporter, x, y, now, colors, px, batch);
            break;

        case 'placard-checker':
            drawChoreoCheckerboard(ctx, choreo, supporter, x, y, now, colors, px, batch);
            break;

        case 'placard-columns':
            drawChoreoColumns(ctx, choreo, supporter, x, y, now, colors, px, batch);
            break;

        case 'large-flag':
            drawChoreoLargeFlag(ctx, choreo, supporter, x, y, now, colors, px, batch);
            break;

        case 'drumsticks':
            drawChoreoDrumsticks(ctx, choreo, supporter, x, y, now, colors, px, batch);
            break;

        case 'phone-light':
            drawChoreoPhoneLight(ctx, choreo, supporter, x, y, now, colors, px, batch);
            break;

        case 'spinning-scarf':
            drawChoreoSpinningScarf(ctx, choreo, supporter, x, y, now, colors, px, batch);
            break;

        default:
            // No special item
            break;
    }
}

// Draw stretched scarf above head with reveal animation (#10)
function drawChoreoScarf(ctx, choreo, supporter, x, y, now, colors, px, batch) {
    const primary = colors.primary || '#006633';
    const secondary = colors.secondary || '#FFFFFF';
    const scarfColor = supporter.row % 2 === 0 ? primary : secondary;
    const waveSpeed = choreo.scarfWaveSpeed || 300;
    const waveAmp = choreo.scarfWaveAmplitude || 2;

    // Reveal animation - scarf unfurls from center
    const choreoAge = now - state.choreoStartTime;
    const rowRevealDelay = supporter.row * 60;
    const revealProgress = Math.min(1, Math.max(0, (choreoAge - rowRevealDelay) / 180));

    if (revealProgress < 0.1) return;

    // Scarf width grows as it unfurls
    const fullWidth = 14;
    const scarfWidth = Math.round(fullWidth * revealProgress);
    const offsetX = Math.round((fullWidth - scarfWidth) / 2);

    const scarfWave = Math.sin(now / waveSpeed + supporter.x * 0.025) * waveAmp * revealProgress;
    const scarfY = (y - px + scarfWave) | 0;

    if (scarfWidth > 2) {
        drawPixelRect(ctx, x - 2 * px + offsetX, scarfY, scarfWidth, 1, scarfColor, px, batch);
    }
    if (scarfWidth > 4) {
        const innerWidth = Math.max(2, scarfWidth - 2);
        drawPixelRect(ctx, x - px + Math.round(offsetX * 0.5), scarfY - px, innerWidth, 1, scarfColor, px, batch);
    }
}

// Draw placard held above head with reveal animation (#10)
function drawChoreoPlacard(ctx, choreo, supporter, x, y, now, colors, px, batch) {
    const primary = colors.primary || '#006633';
    const secondary = colors.secondary || '#FFFFFF';
    const waveSpeed = choreo.placardWaveSpeed || 600;
    const colorSpeed = choreo.placardColorWaveSpeed || 400;

    // Tifo reveal animation (#10) - placards flip up row by row
    const choreoAge = now - state.choreoStartTime;
    const rowRevealDelay = supporter.row * 80;  // 80ms delay per row
    const revealProgress = Math.min(1, Math.max(0, (choreoAge - rowRevealDelay) / 200));

    // Skip drawing if not yet revealed
    if (revealProgress < 0.05) return;

    // Animate placard flipping up (scale Y from 0 to 1)
    const scaleY = revealProgress;
    const placardW = 12;
    const placardH = Math.round(10 * scaleY);

    if (placardH < 1) return;

    const placardWave = Math.sin(now / waveSpeed + supporter.x * 0.01) * 1.5 * revealProgress;
    const placardY = (y - 6 * px + placardWave + (10 - placardH) * px * 0.5) | 0;

    // Alternating color wave pattern
    const colorWave = Math.sin(now / colorSpeed + supporter.x * 0.02 + supporter.row * 0.5);
    const placardColor = colorWave > 0 ? primary : secondary;

    // Flash white during reveal
    const flashIntensity = revealProgress < 0.5 ? (1 - revealProgress * 2) * 0.5 : 0;
    let drawColor = placardColor;
    if (flashIntensity > 0 && !_frameCache.reducedEffects) {
        // Blend with white for flash effect
        const r = parseInt(placardColor.slice(1, 3), 16);
        const g = parseInt(placardColor.slice(3, 5), 16);
        const b = parseInt(placardColor.slice(5, 7), 16);
        const fr = Math.round(r + (255 - r) * flashIntensity);
        const fg = Math.round(g + (255 - g) * flashIntensity);
        const fb = Math.round(b + (255 - b) * flashIntensity);
        drawColor = `rgb(${fr},${fg},${fb})`;
    }

    // Draw placard with 3D border effect
    drawPixelRect(ctx, x - px, placardY, placardW + 2, placardH + 2, drawColor, px, batch);
    if (placardH > 2) {
        drawPixelRect(ctx, x - px, placardY, placardW + 2, 1, '#333333', px, batch);
    }
}

// Draw large banner waving above head (inferno choreo)
function drawChoreoBanner(ctx, choreo, supporter, x, y, now, colors, px, batch) {
    const primary = colors.primary || '#006633';
    const secondary = colors.secondary || '#FFFFFF';
    const waveSpeed = choreo.bannerWaveSpeed || 120;
    const bannerHeight = choreo.bannerHeight || 20;

    // Banner waves more intensely
    const wavePhase = now / waveSpeed + supporter.x * 0.03;
    const waveY = Math.sin(wavePhase) * 4;
    const waveX = Math.cos(wavePhase * 0.7) * 3;

    const bannerY = (y - bannerHeight * px + waveY) | 0;
    const bannerX = (x + waveX) | 0;
    const bannerW = 16;
    const bannerH = 14;

    // Alternating stripes on banner
    const stripePhase = Math.sin(now / 200 + supporter.row);
    const topColor = stripePhase > 0 ? primary : secondary;
    const bottomColor = stripePhase > 0 ? secondary : primary;

    // Draw banner body with stripes
    drawPixelRect(ctx, bannerX - 2 * px, bannerY, bannerW, bannerH / 2, topColor, px, batch);
    drawPixelRect(ctx, bannerX - 2 * px, bannerY + (bannerH / 2) * px, bannerW, bannerH / 2, bottomColor, px, batch);

    // Banner pole
    drawPixelRect(ctx, bannerX + 6 * px, bannerY, 2, bannerH + 8, '#666666', px, batch);

    // Wavy edge effect
    const edgeWave = Math.sin(now / 80 + supporter.x * 0.05) * 2;
    drawPixelRect(ctx, bannerX - 2 * px + edgeWave, bannerY - px, 3, 1, topColor, px, batch);
    drawPixelRect(ctx, bannerX + (bannerW - 3) * px + edgeWave, bannerY - px, 3, 1, topColor, px, batch);
}

// Draw flare held above head (pyro choreo) - uses team colors
function drawChoreoFlare(ctx, choreo, supporter, x, y, now, colors, px, batch) {
    const primary = colors.primary || '#ff4400';
    const secondary = colors.secondary || '#ffffff';

    // Flare body
    const flareY = (y - 8 * px) | 0;
    drawPixelRect(ctx, x + 2 * px, flareY, 4, 8, '#444444', px, batch); // Handle
    drawPixelRect(ctx, x + 1 * px, flareY - 3 * px, 6, 3, primary, px, batch); // Flare head (team color)

    // Flame effect
    const flamePhase = now / 50 + supporter.x * 0.1;
    const flameHeight = 4 + Math.sin(flamePhase) * 2;
    const flameOffset = Math.sin(flamePhase * 1.3) * 1;

    // Inner flame (secondary/bright color)
    drawPixelRect(ctx, x + 2 * px + flameOffset, flareY - (3 + flameHeight) * px, 3, flameHeight | 0, secondary, px, batch);
    // Outer flame (primary team color)
    drawPixelRect(ctx, x + 1 * px + flameOffset, flareY - (2 + flameHeight * 0.8) * px, 5, (flameHeight * 0.8) | 0, primary, px, batch);

    // Smoke wisps (small particles rising) - tinted with team color
    if (!_frameCache.reducedEffects && Math.random() < 0.1) {
        const smokeX = x + 3 * px + (Math.random() - 0.5) * 4;
        const smokeY = flareY - (3 + flameHeight) * px;
        drawPixelRect(ctx, smokeX, smokeY, 2, 2, hexToRgbaCached(primary, 0.4), px, batch);
    }
}

// Draw checkerboard placard (checkerboard choreo - stationary display)
function drawChoreoCheckerboard(ctx, choreo, supporter, x, y, now, colors, px, batch) {
    const primary = colors.primary || '#006633';
    const secondary = colors.secondary || '#FFFFFF';

    // True checkerboard: alternate colors so adjacent supporters differ
    // Use supporter spacing (~15px) to calculate column index for proper alternation
    const colIndex = Math.floor(supporter.x / 15);
    const placardColor = ((supporter.row + colIndex) % 2 === 0) ? primary : secondary;

    const placardY = (y - 8 * px) | 0;
    const placardW = 14;
    const placardH = 12;

    // Draw solid placard
    drawPixelRect(ctx, x - px, placardY, placardW, placardH, placardColor, px, batch);
    // Border
    drawPixelRect(ctx, x - px, placardY, placardW, 1, '#333333', px, batch);
    drawPixelRect(ctx, x - px, placardY + (placardH - 1) * px, placardW, 1, '#333333', px, batch);
}

// Draw vertical column placard (columns choreo)
function drawChoreoColumns(ctx, choreo, supporter, x, y, now, colors, px, batch) {
    const primary = colors.primary || '#006633';
    const secondary = colors.secondary || '#FFFFFF';

    // Vertical stripe based on x position
    const stripeIndex = Math.floor(supporter.x / 30) % 2;
    const placardColor = stripeIndex === 0 ? primary : secondary;

    // Subtle wave animation
    const wave = Math.sin(now / 300 + supporter.x * 0.01) * 1;
    const placardY = (y - 8 * px + wave) | 0;
    const placardW = 14;
    const placardH = 12;

    // Draw placard
    drawPixelRect(ctx, x - px, placardY, placardW, placardH, placardColor, px, batch);
    // Light border
    drawPixelRect(ctx, x - px, placardY, placardW, 1, '#555555', px, batch);
}

// Draw large flag (ultras choreo)
function drawChoreoLargeFlag(ctx, choreo, supporter, x, y, now, colors, px, batch) {
    const primary = colors.primary || '#006633';
    const secondary = colors.secondary || '#FFFFFF';
    const waveSpeed = choreo.flagWaveSpeed || 200;

    // Large waving flag
    const wavePhase = now / waveSpeed + supporter.x * 0.02;
    const waveX = Math.sin(wavePhase) * 5;
    const waveY = Math.cos(wavePhase * 0.7) * 3;

    const flagY = (y - 25 * px + waveY) | 0;
    const flagX = (x - 4 * px + waveX) | 0;
    const flagW = 22;
    const flagH = 18;

    // Horizontal stripes
    const stripeH = flagH / 2;
    drawPixelRect(ctx, flagX, flagY, flagW, stripeH, primary, px, batch);
    drawPixelRect(ctx, flagX, flagY + stripeH * px, flagW, stripeH, secondary, px, batch);

    // Flag pole
    drawPixelRect(ctx, flagX + flagW * px / 2 - px, flagY, 2, flagH + 10, '#8B4513', px, batch);

    // Waving edge effect
    const edgeWave = Math.sin(now / 100 + supporter.row) * 2;
    drawPixelRect(ctx, flagX + flagW * px + edgeWave, flagY + 2 * px, 2, flagH - 4, primary, px, batch);
}

// Draw drumsticks above head for drums choreo
function drawChoreoDrumsticks(ctx, choreo, supporter, x, y, now, colors, px, batch) {
    const secondary = colors.secondary || '#FFFFFF';
    const drumSpeed = choreo.drumSpeed || 150;
    const drumPhase = Math.sin(now / drumSpeed);

    // Stick color - darker wood tone with secondary tint
    const stickColor = '#8B7355';
    const stickTip = secondary;

    // Base position above head
    const baseY = y - 4 * px;
    const centerX = x + 5 * px;

    // Left drumstick
    const leftAngle = drumPhase > 0 ? -0.3 : 0.3;
    const leftY = drumPhase > 0 ? baseY - 4 * px : baseY;
    drawPixelRect(ctx, centerX - 4 * px, leftY, 1, 6, stickColor, px, batch);
    drawPixelRect(ctx, centerX - 4 * px, leftY - px, 1, 1, stickTip, px, batch);

    // Right drumstick
    const rightY = drumPhase > 0 ? baseY : baseY - 4 * px;
    drawPixelRect(ctx, centerX + 3 * px, rightY, 1, 6, stickColor, px, batch);
    drawPixelRect(ctx, centerX + 3 * px, rightY - px, 1, 1, stickTip, px, batch);
}

// Draw phone with glowing screen for spotlight choreo
function drawChoreoPhoneLight(ctx, choreo, supporter, x, y, now, colors, px, batch) {
    const glowSpeed = choreo.phoneGlowSpeed || 300;
    const glowPhase = (Math.sin(now / glowSpeed) + 1) * 0.5;

    // Phone position above head
    const phoneX = x + 3 * px;
    const phoneY = y - 6 * px;

    // Phone body (dark rectangle)
    drawPixelRect(ctx, phoneX, phoneY, 4, 6, '#222222', px, batch);

    // Phone screen (glowing)
    const glowIntensity = 0.6 + glowPhase * 0.4;
    const glowColor = `rgba(255, 255, 220, ${glowIntensity})`;
    ctx.fillStyle = glowColor;
    ctx.fillRect(phoneX + px, phoneY + px, 2 * px, 4 * px);

    // Glow effect around phone (if not reduced effects)
    if (!_frameCache.reducedEffects && glowPhase > 0.5) {
        ctx.fillStyle = `rgba(255, 255, 200, ${glowPhase * 0.2})`;
        ctx.fillRect(phoneX - px, phoneY - px, 6 * px, 8 * px);
    }
}

// Draw spinning scarf overhead for tornado choreo
function drawChoreoSpinningScarf(ctx, choreo, supporter, x, y, now, colors, px, batch) {
    const primary = colors.primary || '#006633';
    const spinSpeed = choreo.spinSpeed || 200;
    const spinAngle = (now / spinSpeed) * Math.PI * 2;

    // Center position above head
    const centerX = x + 5 * px;
    const centerY = y - 6 * px;

    // Scarf traces elliptical path overhead
    const radiusX = 6 * px;
    const radiusY = 3 * px;

    // Draw scarf as a series of points tracing the ellipse
    const scarfLength = 8;
    for (let i = 0; i < scarfLength; i++) {
        const angle = spinAngle - i * 0.3;
        const sx = centerX + Math.cos(angle) * radiusX;
        const sy = centerY + Math.sin(angle) * radiusY;
        const alpha = 1 - i * 0.1;
        ctx.fillStyle = primary;
        ctx.globalAlpha = alpha;
        ctx.fillRect((sx - px) | 0, (sy - px / 2) | 0, 2 * px, px);
    }
    ctx.globalAlpha = 1;
}

// Draw choreo overlay (tifo badge, banners, etc.)
function drawChoreoOverlay(ctx, choreo, w, h, now) {
    if (!choreo.showOverlay) return;

    switch (choreo.overlayRenderer) {
        case 'drawTifoOverlay':
            drawTifoOverlay(ctx, w, h, now);
            break;

        case 'drawInfernoOverlay':
            drawInfernoOverlay(ctx, w, h, now);
            break;

        case 'drawPyroOverlay':
            drawPyroOverlay(ctx, w, h, now);
            break;

        case 'drawUltrasOverlay':
            drawUltrasOverlay(ctx, w, h, now);
            break;

        case 'drawSpotlightOverlay':
            drawSpotlightOverlay(ctx, w, h, now);
            break;

        case 'drawAnthemOverlay':
            drawAnthemOverlay(ctx, w, h, now);
            break;

        default:
            break;
    }
}

// Get arms position based on choreo config
function getChoreoArmsPosition(choreo) {
    return choreo.armsPosition || 'normal';
}

// Export choreo system for external access/configuration
export { CHOREO_TYPES, getChoreoConfig, getChoreoType };

// ============================================
// Tifo Display System - supporters hold placards to form club logo
// ============================================

// Generate tifo map from club badge - samples the logo image into a grid
export function generateTifoMap(badgePath, canvasWidth, canvasHeight) {
    return new Promise((resolve) => {
        const img = new Image();

        img.onload = () => {
            // Use naturalWidth/Height for SVGs, fallback to width/height
            let imgW = img.naturalWidth || img.width;
            let imgH = img.naturalHeight || img.height;

            // SVGs might report 0 dimensions - use a default
            if (!imgW || !imgH || imgW === 0 || imgH === 0) {
                imgW = 100;
                imgH = 100;
            }

            console.log('Tifo: Loading badge', badgePath, 'dimensions:', imgW, 'x', imgH);

            // The crowd area is wide (~1140px usable) and short (~300px with ~6 rows)
            // We need a grid that matches the actual supporter density
            const gridCols = 80;   // More columns for horizontal detail
            const gridRows = 6;    // Match actual supporter rows

            // Create intermediate canvas matching the crowd's aspect ratio
            const crowdAspect = 4;  // roughly 1200:300
            const canvasW = 400;
            const canvasH = 100;

            const intermediateCanvas = document.createElement('canvas');
            const intermediateCtx = intermediateCanvas.getContext('2d', { willReadFrequently: true });
            intermediateCanvas.width = canvasW;
            intermediateCanvas.height = canvasH;

            // Fill with transparent
            intermediateCtx.clearRect(0, 0, canvasW, canvasH);

            // Scale logo to fit in center, maintaining aspect ratio
            const logoAspect = imgW / imgH;
            let drawW, drawH;

            // Fit logo height to canvas height, then check width
            drawH = canvasH * 0.95;
            drawW = drawH * logoAspect;

            // If too wide, fit to width instead
            if (drawW > canvasW * 0.5) {
                drawW = canvasW * 0.5;
                drawH = drawW / logoAspect;
            }

            const offsetX = (canvasW - drawW) / 2;
            const offsetY = (canvasH - drawH) / 2;

            try {
                intermediateCtx.drawImage(img, offsetX, offsetY, drawW, drawH);
            } catch (e) {
                console.warn('Tifo: Failed to draw image to canvas', e);
                state.tifoReady = false;
                resolve(null);
                return;
            }

            let imageData;
            try {
                imageData = intermediateCtx.getImageData(0, 0, canvasW, canvasH);
            } catch (e) {
                console.warn('Tifo: getImageData failed (CORS?)', e);
                state.tifoReady = false;
                resolve(null);
                return;
            }

            const pixels = imageData.data;

            // Create tifo map - 2D array of colors with area sampling
            const tifoMap = [];
            let colorCount = 0;

            const cellW = canvasW / gridCols;
            const cellH = canvasH / gridRows;

            for (let row = 0; row < gridRows; row++) {
                const rowColors = [];
                for (let col = 0; col < gridCols; col++) {
                    // Area sample: average colors in this cell
                    const startX = Math.floor(col * cellW);
                    const startY = Math.floor(row * cellH);
                    const endX = Math.floor((col + 1) * cellW);
                    const endY = Math.floor((row + 1) * cellH);

                    let totalR = 0, totalG = 0, totalB = 0, totalA = 0;
                    let sampleCount = 0;

                    for (let sy = startY; sy < endY; sy++) {
                        for (let sx = startX; sx < endX; sx++) {
                            const idx = (sy * canvasW + sx) * 4;
                            totalR += pixels[idx];
                            totalG += pixels[idx + 1];
                            totalB += pixels[idx + 2];
                            totalA += pixels[idx + 3];
                            sampleCount++;
                        }
                    }

                    const avgA = totalA / sampleCount;

                    // Skip mostly transparent cells
                    if (avgA < 40) {
                        rowColors.push(null);
                    } else {
                        const avgR = Math.round(totalR / sampleCount);
                        const avgG = Math.round(totalG / sampleCount);
                        const avgB = Math.round(totalB / sampleCount);
                        const hex = '#' + [avgR, avgG, avgB].map(c => c.toString(16).padStart(2, '0')).join('');
                        rowColors.push(hex);
                        colorCount++;
                    }
                }
                tifoMap.push(rowColors);
            }

            state.tifoMap = tifoMap;
            state.tifoImage = img;
            state.tifoReady = true;
            state.tifoGridCols = gridCols;
            state.tifoGridRows = gridRows;
            console.log('Tifo: Map generated', gridCols, 'x', gridRows, '- colored cells:', colorCount);

            resolve(tifoMap);
        };

        img.onerror = (e) => {
            console.warn('Tifo: Failed to load badge', badgePath, e);
            state.tifoReady = false;
            resolve(null);
        };

        img.src = badgePath;
    });
}

// Get tifo color for a supporter based on their position
function getTifoColor(supporter, canvasWidth, canvasHeight) {
    if (!state.tifoReady || !state.tifoMap) return null;

    const tifoMap = state.tifoMap;
    const gridRows = tifoMap.length;
    const gridCols = tifoMap[0]?.length || 0;

    if (gridRows === 0 || gridCols === 0) return null;

    // Map supporter position to tifo grid
    const layout = state.stadiumLayout;
    const edgeMargin = layout?.edgeMargin || 30;

    // Calculate usable width (excluding edges and aisles)
    let usableWidth = canvasWidth - (edgeMargin * 2);
    if (layout?.aislePositions) {
        usableWidth -= layout.aislePositions.length * (layout.aisleWidth || 40);
    }

    // Calculate relative X position (0-1)
    // Adjust for aisles by finding which section the supporter is in
    let adjustedX = supporter.x - edgeMargin;
    if (layout?.aislePositions) {
        for (const aisle of layout.aislePositions) {
            if (supporter.x > aisle.end) {
                adjustedX -= (layout.aisleWidth || 40);
            }
        }
    }
    const relativeX = Math.max(0, Math.min(1, adjustedX / usableWidth));

    // Row mapping: front row (0) = bottom of tifo, back rows = top
    // Invert so back rows show top of logo (more visible)
    const maxRow = 5;  // 0-5 rows typically
    const relativeY = Math.max(0, Math.min(1, (maxRow - supporter.row) / maxRow));

    const col = Math.floor(relativeX * (gridCols - 1));
    const row = Math.floor(relativeY * (gridRows - 1));

    // Bounds check
    if (col < 0 || col >= gridCols || row < 0 || row >= gridRows) {
        return null;
    }

    return tifoMap[row]?.[col] || null;
}

// ============================================
// Batched Drawing System - reduces fillStyle changes for performance
// ============================================

class DrawBatch {
    constructor() {
        this.colorGroups = {};  // color -> {rects: [], count: 0}
        this.faceQueue = [];
        this.faceCount = 0;
    }

    add(color, x, y, w, h) {
        let group = this.colorGroups[color];
        if (!group) {
            group = { rects: new Float32Array(400), count: 0 };  // Pre-allocate for ~100 rects
            this.colorGroups[color] = group;
        }
        const idx = group.count * 4;
        if (idx + 4 > group.rects.length) {
            // Grow array if needed (rare)
            const newRects = new Float32Array(group.rects.length * 2);
            newRects.set(group.rects);
            group.rects = newRects;
        }
        group.rects[idx] = x | 0;      // Faster floor for positive numbers
        group.rects[idx + 1] = y | 0;
        group.rects[idx + 2] = w;
        group.rects[idx + 3] = h;
        group.count++;
    }

    flush(ctx) {
        // Draw all body parts first, grouped by color
        for (const color in this.colorGroups) {
            const group = this.colorGroups[color];
            if (group.count === 0) continue;
            ctx.fillStyle = color;
            const rects = group.rects;
            for (let i = 0, len = group.count * 4; i < len; i += 4) {
                ctx.fillRect(rects[i], rects[i + 1], rects[i + 2], rects[i + 3]);
            }
            group.count = 0;  // Reset count instead of clearing array
        }

        // Draw faces on top
        for (let i = 0; i < this.faceCount; i++) {
            const face = this.faceQueue[i];
            drawFace(ctx, face.x, face.y, face.px, face.eyeOffsetY, face.mouthShape, face.emotion);
        }
        this.faceCount = 0;
    }

    addFace(x, y, px, eyeOffsetY, mouthShape, emotion) {
        if (this.faceCount >= this.faceQueue.length) {
            this.faceQueue.push({ x: 0, y: 0, px: 0, eyeOffsetY: 0, mouthShape: '', emotion: '' });
        }
        const face = this.faceQueue[this.faceCount];
        face.x = x;
        face.y = y;
        face.px = px;
        face.eyeOffsetY = eyeOffsetY;
        face.mouthShape = mouthShape;
        face.emotion = emotion;
        this.faceCount++;
    }

    clear() {
        for (const color in this.colorGroups) {
            this.colorGroups[color].count = 0;
        }
        this.faceCount = 0;
    }

    // Full reset - clears all color groups to prevent memory accumulation
    // Call this between games when club changes
    fullReset() {
        this.colorGroups = {};
        this.faceCount = 0;
        // Keep faceQueue allocated for reuse
    }
}

// Draw face features (eyes and mouth) - called after batch flush to ensure visibility
function drawFace(ctx, x, y, px, eyeOffsetY, mouthShape, emotion) {
    if (emotion === 'deject') {
        ctx.fillStyle = '#000000';
        ctx.fillRect(x + 4 * px, y + 3 * px + eyeOffsetY, px, px);
        ctx.fillRect(x + 6 * px, y + 3 * px + eyeOffsetY, px, px);
        ctx.fillRect(x + 4 * px, y + 5 * px + eyeOffsetY, 3 * px, px);
    } else if (mouthShape === 'open') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x + 4 * px, y + 3 * px, px, px);
        ctx.fillRect(x + 6 * px, y + 3 * px, px, px);
        ctx.fillStyle = '#000000';
        ctx.fillRect(x + 4 * px, y + 5 * px, 3 * px, px);
    } else {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x + 4 * px, y + 3 * px, px, px);
        ctx.fillRect(x + 6 * px, y + 3 * px, px, px);
        ctx.fillStyle = '#000000';
        ctx.fillRect(x + 4 * px + 1, y + 3 * px + 1, Math.max(1, px - 1), Math.max(1, px - 1));
        ctx.fillRect(x + 6 * px + 1, y + 3 * px + 1, Math.max(1, px - 1), Math.max(1, px - 1));
    }
}

// Reusable batch instance to avoid allocations
const supporterBatch = new DrawBatch();

// Reset batch memory between games to prevent color group accumulation
export function resetDrawBatch() {
    supporterBatch.fullReset();
}

// Reusable colors object to avoid per-supporter allocation
const _colorsCache = { primary: '', secondary: '' };

// ============================================
// Sprite Cache System (#11) - Pre-rendered supporter sprites
// Caches basic supporter body (head + torso + standing legs) for common color combos
// ============================================

const SPRITE_CACHE = {
    canvas: null,
    ctx: null,
    ready: false,
    sprites: new Map(),  // Key: "shirtColor_skinColor" -> {x, y, w, h}
    PX: 2.7,
    SPRITE_W: 12,  // pixels (not px units)
    SPRITE_H: 15,
    COLS: 20,      // sprites per row in cache
    nextSlot: 0
};

// Common skin tones to pre-cache (must match initSupporters)
const CACHE_SKIN_TONES = ['#f5d0a9', '#d4a373', '#f79c9c', '#c68642', '#e0ac69'];

// Initialize sprite cache with common color combinations
function initSpriteCache(shirtColors) {
    const px = SPRITE_CACHE.PX;
    const spriteW = Math.ceil(SPRITE_CACHE.SPRITE_W * px);
    const spriteH = Math.ceil(SPRITE_CACHE.SPRITE_H * px);
    const cols = SPRITE_CACHE.COLS;

    // Calculate total sprites needed
    const totalSprites = shirtColors.length * CACHE_SKIN_TONES.length;
    const rows = Math.ceil(totalSprites / cols);

    // Create cache canvas
    const cacheW = cols * spriteW;
    const cacheH = rows * spriteH;

    try {
        SPRITE_CACHE.canvas = new OffscreenCanvas(cacheW, cacheH);
    } catch (e) {
        SPRITE_CACHE.canvas = document.createElement('canvas');
        SPRITE_CACHE.canvas.width = cacheW;
        SPRITE_CACHE.canvas.height = cacheH;
    }
    SPRITE_CACHE.ctx = SPRITE_CACHE.canvas.getContext('2d');
    SPRITE_CACHE.sprites.clear();
    SPRITE_CACHE.nextSlot = 0;

    // Pre-render all combinations
    for (const shirtColor of shirtColors) {
        for (const skinColor of CACHE_SKIN_TONES) {
            renderSpriteToCache(shirtColor, skinColor);
        }
    }

    SPRITE_CACHE.ready = true;
}

// Render a single supporter body sprite to the cache
function renderSpriteToCache(shirtColor, skinColor) {
    const px = SPRITE_CACHE.PX;
    const spriteW = Math.ceil(SPRITE_CACHE.SPRITE_W * px);
    const spriteH = Math.ceil(SPRITE_CACHE.SPRITE_H * px);
    const cols = SPRITE_CACHE.COLS;
    const slot = SPRITE_CACHE.nextSlot++;

    const col = slot % cols;
    const row = Math.floor(slot / cols);
    const offsetX = col * spriteW;
    const offsetY = row * spriteH;

    const ctx = SPRITE_CACHE.ctx;

    // Draw basic supporter body (centered in sprite, no arms)
    // Local coordinates within sprite
    const x = 0;
    const y = 0;

    // Legs (standing pose)
    ctx.fillStyle = '#222244';
    ctx.fillRect(offsetX + 2 * px, offsetY + 11 * px, 2 * px, 3 * px);
    ctx.fillRect(offsetX + 6 * px, offsetY + 11 * px, 2 * px, 3 * px);

    // Torso/shirt
    ctx.fillStyle = shirtColor;
    ctx.fillRect(offsetX + 2 * px, offsetY + 6 * px, 6 * px, 5 * px);

    // Head
    ctx.fillStyle = skinColor;
    ctx.fillRect(offsetX + 3 * px, offsetY + 2 * px, 4 * px, 4 * px);

    // Hair
    ctx.fillStyle = '#222222';
    ctx.fillRect(offsetX + 3 * px, offsetY + 1 * px, 4 * px, 1 * px);

    // Store sprite location
    const key = `${shirtColor}_${skinColor}`;
    SPRITE_CACHE.sprites.set(key, {
        x: offsetX,
        y: offsetY,
        w: spriteW,
        h: spriteH
    });
}

// Get cached sprite for a supporter, or null if not cached
function getCachedSprite(shirtColor, skinColor) {
    if (!SPRITE_CACHE.ready) return null;
    const key = `${shirtColor}_${skinColor}`;
    return SPRITE_CACHE.sprites.get(key) || null;
}

// Draw supporter using cached sprite + dynamic parts
function drawSupporterCached(ctx, s, jumpOffset, armsUp, frenzy, now, choreo, batch, primaryColor, secondaryColor, preCalc) {
    const sprite = getCachedSprite(s.shirtColor, s.skinColor);

    // Fall back to full draw if not cached or during special states
    if (!sprite || state.crowdEmotion === 'deject' || s.hasHat) {
        drawSupporter(ctx, s, jumpOffset, armsUp, frenzy, now, choreo, batch, primaryColor, secondaryColor, preCalc);
        return;
    }

    const px = s.px;
    const baseX = s.x | 0;
    let y = (s.baseY + jumpOffset) | 0;

    const primary = primaryColor || state.cachedColors?.primary || '#006633';
    const secondary = secondaryColor || state.cachedColors?.secondary || '#FFFFFF';

    let currentFrenzy = frenzy;
    let currentRockX = 0;
    let eyeOffsetY = 0;
    let mouthShape = 'normal';

    const emotion = state.crowdEmotion;
    if (emotion === 'celebrate') {
        currentFrenzy = true;
        mouthShape = 'open';
    } else if (currentFrenzy) {
        mouthShape = 'open';
    }

    // Calculate sway
    if (s.hasFlag && currentFrenzy) {
        const flagSwing = getFlagSwing(s, now);
        currentRockX = flagSwing.swingX * 0.4;
        y += (flagSwing.swingY * 0.3) | 0;
    } else if (choreo && choreo.id > 0) {
        currentRockX = getChoreoSway(choreo, s, now, preCalc);
    } else if (currentFrenzy) {
        currentRockX = Math.sin(now / 120 + s.jumpPhase) * 3;
    }
    const x = (baseX + currentRockX) | 0;

    // Beat ripple effect
    const timeSinceBeat = preCalc.timeSinceBeat || 0;
    const rowDelay = s.row * 0.06;
    const rippleProgress = Math.max(0, timeSinceBeat - rowDelay);
    const rippleIntensity = Math.max(0, 1 - rippleProgress * 5) * 0.15;

    if (rippleIntensity > 0.01 && !_frameCache.reducedEffects) {
        ctx.fillStyle = primary;
        ctx.globalAlpha = rippleIntensity;
        ctx.fillRect(x - px, y + 2 * px, 12 * px, 12 * px);
        ctx.globalAlpha = 1;
    }

    // Frenzy glow
    if (currentFrenzy && !_frameCache.reducedEffects) {
        const glowPhase = (Math.sin(now / 200 + s.jumpPhase) + 1) * 0.5;
        ctx.fillStyle = primary;
        ctx.globalAlpha = 0.05 + glowPhase * 0.05;
        ctx.fillRect(x - px, y + 2 * px, 12 * px, 12 * px);
        ctx.globalAlpha = 1;
    }

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(x + px, Math.floor(s.baseY + 2 * px), 8 * px, px);

    // Blit cached sprite (body without arms)
    ctx.drawImage(
        SPRITE_CACHE.canvas,
        sprite.x, sprite.y, sprite.w, sprite.h,
        x, y, sprite.w, sprite.h
    );

    // Draw dynamic arms based on state
    const armsPos = choreo ? getChoreoArmsPosition(choreo) : 'normal';
    drawDynamicArms(ctx, s, x, y, px, armsUp, currentFrenzy, now, choreo, armsPos, batch);

    // Face (drawn directly, not batched for cached sprites)
    drawFace(ctx, x, y, px, eyeOffsetY, mouthShape, emotion);

    // Choreo items
    if (choreo && choreo.showItem && !s.hasFlag && !s.hasFlare) {
        _colorsCache.primary = primary;
        _colorsCache.secondary = secondary;
        drawChoreoItem(ctx, choreo, s, x, y, now, _colorsCache, null);
    } else if (s.hasScarf && s.scarfColor) {
        ctx.fillStyle = s.scarfColor;
        ctx.fillRect(x + 2 * px, y + 5 * px, 6 * px, px);
        if (currentFrenzy) {
            const scarfWave = Math.sin(now / 100 + s.jumpPhase) > 0 ? 1 : -1;
            ctx.fillRect(x + (scarfWave > 0 ? 8 : -2) * px, y + 5 * px, 2 * px, px);
        }
    }
}

// Draw just the arms (extracted for cached sprite system)
function drawDynamicArms(ctx, s, x, y, px, armsUp, frenzy, now, choreo, armsPos, batch) {
    const clapSpeed = choreo?.clapSpeed || 200;

    // Arm transition
    const targetArm = (armsUp || armsPos === 'scarf-hold' || armsPos === 'up' || armsPos === 'placard-hold' || armsPos === 'flag-hold' || armsPos === 'phone-hold' || armsPos === 'scarf-spin') ? 1 : 0;
    if (s.armTransition === undefined) s.armTransition = 0;
    if (targetArm > s.armTransition) {
        s.armTransition = Math.min(1, s.armTransition + 0.08);
    } else if (targetArm < s.armTransition) {
        s.armTransition = Math.max(0, s.armTransition - 0.056);
    }
    const armLerp = s.armTransition;

    ctx.fillStyle = s.skinColor;

    if (armsPos === 'pump' && !s.hasFlag && !s.hasFlare) {
        const pumpPhase = Math.sin(now / 150);
        if (pumpPhase > 0) {
            ctx.fillRect(x - px, y + 1 * px, 2 * px, 4 * px);
            ctx.fillRect(x + 9 * px, y + 1 * px, 2 * px, 4 * px);
            ctx.fillRect(x - px, y, 2 * px, px);
            ctx.fillRect(x + 9 * px, y, 2 * px, px);
        } else {
            ctx.fillRect(x - px, y + 4 * px, 2 * px, 4 * px);
            ctx.fillRect(x + 9 * px, y + 4 * px, 2 * px, 4 * px);
        }
    } else if (armsPos === 'push' && !s.hasFlag && !s.hasFlare) {
        // Moshpit pushing motion - random forward/back arm movements
        const pushPhase = Math.sin(now / 80 + s.jumpPhase * 3);
        if (pushPhase > 0.2) {
            // Arms forward (pushing)
            ctx.fillRect(x - 2 * px, y + 5 * px, 3 * px, 2 * px);
            ctx.fillRect(x + 9 * px, y + 5 * px, 3 * px, 2 * px);
        } else if (pushPhase > -0.2) {
            // Arms mid
            ctx.fillRect(x - px, y + 6 * px, 2 * px, 3 * px);
            ctx.fillRect(x + 9 * px, y + 6 * px, 2 * px, 3 * px);
        } else {
            // Arms back
            ctx.fillRect(x, y + 7 * px, 2 * px, 3 * px);
            ctx.fillRect(x + 8 * px, y + 7 * px, 2 * px, 3 * px);
        }
    } else if (armsPos === 'placard-hold' && !s.hasFlag && !s.hasFlare) {
        // Holding placard steady above head
        ctx.fillRect(x - px, y + 1 * px, 2 * px, 5 * px);
        ctx.fillRect(x + 9 * px, y + 1 * px, 2 * px, 5 * px);
        ctx.fillRect(x, y, 2 * px, px);
        ctx.fillRect(x + 8 * px, y, 2 * px, px);
    } else if (armsPos === 'flag-hold' && !s.hasFlag && !s.hasFlare) {
        // Holding large flag with both arms extended up
        ctx.fillRect(x - px, y, 2 * px, 6 * px);
        ctx.fillRect(x + 9 * px, y, 2 * px, 6 * px);
        ctx.fillRect(x - px, y - px, 2 * px, px);
        ctx.fillRect(x + 9 * px, y - px, 2 * px, px);
    } else if (armsPos === 'clap' && !s.hasFlag && !s.hasFlare) {
        const clapPhase = Math.sin(now / clapSpeed);
        if (clapPhase > 0.3) {
            ctx.fillRect(x + 3 * px, y + 5 * px, 2 * px, 2 * px);
            ctx.fillRect(x + 5 * px, y + 5 * px, 2 * px, 2 * px);
            ctx.fillRect(x + px, y + 6 * px, 2 * px, 3 * px);
            ctx.fillRect(x + 7 * px, y + 6 * px, 2 * px, 3 * px);
        } else {
            ctx.fillRect(x - px, y + 5 * px, 2 * px, 2 * px);
            ctx.fillRect(x + 9 * px, y + 5 * px, 2 * px, 2 * px);
            ctx.fillRect(x - px, y + 6 * px, 3 * px, 2 * px);
            ctx.fillRect(x + 8 * px, y + 6 * px, 3 * px, 2 * px);
        }
    } else if (armsPos === 'scarf-hold' && !s.hasFlag && !s.hasFlare) {
        ctx.fillRect(x - px, y + 1 * px, 2 * px, 5 * px);
        ctx.fillRect(x + 9 * px, y + 1 * px, 2 * px, 5 * px);
        ctx.fillRect(x - px, y, 2 * px, px);
        ctx.fillRect(x + 9 * px, y, 2 * px, px);
    } else if (armsPos === 'drumming' && !s.hasFlag && !s.hasFlare) {
        // Alternating drum hits - left up when right down
        const drumSpeed = choreo?.drumSpeed || 150;
        const drumPhase = Math.sin(now / drumSpeed);
        if (drumPhase > 0) {
            // Left arm up (striking), right arm down
            ctx.fillRect(x - px, y + 1 * px, 2 * px, 4 * px);
            ctx.fillRect(x - px, y - px, 2 * px, 2 * px);
            ctx.fillRect(x + 9 * px, y + 5 * px, 2 * px, 4 * px);
        } else {
            // Right arm up (striking), left arm down
            ctx.fillRect(x - px, y + 5 * px, 2 * px, 4 * px);
            ctx.fillRect(x + 9 * px, y + 1 * px, 2 * px, 4 * px);
            ctx.fillRect(x + 9 * px, y - px, 2 * px, 2 * px);
        }
    } else if (armsPos === 'phone-hold' && !s.hasFlag && !s.hasFlare) {
        // Both arms straight up holding phone
        ctx.fillRect(x - px, y - 2 * px, 2 * px, 6 * px);
        ctx.fillRect(x + 9 * px, y - 2 * px, 2 * px, 6 * px);
        // Hands at top
        ctx.fillRect(x + px, y - 3 * px, 2 * px, 2 * px);
        ctx.fillRect(x + 7 * px, y - 3 * px, 2 * px, 2 * px);
    } else if (armsPos === 'viking-clap' && !s.hasFlag && !s.hasFlare) {
        // Wide spread to together clapping - slow building rhythm
        const vikingSpeed = choreo?.vikingClapSpeed || 800;
        const vikingPhase = Math.sin(now / vikingSpeed);
        if (vikingPhase > 0.3) {
            // Arms together (clap)
            ctx.fillRect(x + 2 * px, y + 4 * px, 3 * px, 3 * px);
            ctx.fillRect(x + 5 * px, y + 4 * px, 3 * px, 3 * px);
        } else if (vikingPhase > -0.3) {
            // Arms mid-spread
            ctx.fillRect(x - px, y + 5 * px, 3 * px, 3 * px);
            ctx.fillRect(x + 8 * px, y + 5 * px, 3 * px, 3 * px);
        } else {
            // Arms wide spread
            ctx.fillRect(x - 3 * px, y + 5 * px, 4 * px, 2 * px);
            ctx.fillRect(x + 9 * px, y + 5 * px, 4 * px, 2 * px);
        }
    } else if (armsPos === 'scarf-spin' && !s.hasFlag && !s.hasFlare) {
        // Circular motion overhead for scarf spin
        const spinSpeed = choreo?.spinSpeed || 200;
        const spinAngle = (now / spinSpeed) * Math.PI * 2;
        const armOffsetX = Math.cos(spinAngle) * 3 * px;
        const armOffsetY = Math.sin(spinAngle) * 2 * px;
        // Arms follow circular path
        ctx.fillRect((x + 4 * px + armOffsetX) | 0, (y + px + armOffsetY) | 0, 2 * px, 4 * px);
        ctx.fillRect((x + 4 * px - armOffsetX) | 0, (y + px - armOffsetY) | 0, 2 * px, 4 * px);
    } else if (armsPos === 'heart' && !s.hasFlag && !s.hasFlare) {
        // Hand on heart - right arm across to left chest, left arm down
        // Right arm across chest
        ctx.fillRect(x + 2 * px, y + 6 * px, 4 * px, 2 * px);
        ctx.fillRect(x + px, y + 5 * px, 2 * px, 2 * px);
        // Left arm down at side
        ctx.fillRect(x + 8 * px, y + 7 * px, 2 * px, 4 * px);
    } else if (frenzy) {
        const armPhase = Math.sin(now / 150 + s.jumpPhase);
        if (armPhase > 0.3) {
            ctx.fillRect(x - px, y + 1 * px, 2 * px, 3 * px);
            ctx.fillRect(x + 9 * px, y + 1 * px, 2 * px, 3 * px);
            ctx.fillRect(x - px, y, 2 * px, px);
            ctx.fillRect(x + 9 * px, y, 2 * px, px);
        } else if (armPhase > -0.3) {
            ctx.fillRect(x - px, y + 2 * px, 2 * px, 4 * px);
            ctx.fillRect(x + 9 * px, y + 5 * px, 3 * px, 2 * px);
        } else {
            ctx.fillRect(x - px, y + 4 * px, 3 * px, 2 * px);
            ctx.fillRect(x + 8 * px, y + 4 * px, 3 * px, 2 * px);
        }
    } else if (armsUp || armLerp > 0.1) {
        const armYOffset = Math.round((7 - 5 * armLerp) * px);
        const armLength = Math.round(4 - armLerp);
        ctx.fillRect(x, y + armYOffset, 2 * px, armLength * px);
        ctx.fillRect(x + 8 * px, y + armYOffset, 2 * px, armLength * px);
        if (armLerp > 0.7) {
            const handY = Math.round((1 + (1 - armLerp) * 2) * px);
            ctx.fillRect(x, y + handY, 2 * px, px);
            ctx.fillRect(x + 8 * px, y + handY, 2 * px, px);
        }
    } else {
        ctx.fillRect(x, y + 7 * px, 2 * px, 4 * px);
        ctx.fillRect(x + 8 * px, y + 7 * px, 2 * px, 4 * px);
    }
}

// Pooled flag/flare queue to avoid array allocations each frame
const _flagFlarePool = [];
let _flagFlareCount = 0;

function resetFlagFlareQueue() {
    _flagFlareCount = 0;
}

function pushFlagFlare(s, jumpY) {
    if (_flagFlareCount >= _flagFlarePool.length) {
        _flagFlarePool.push({ s: null, jumpY: 0 });
    }
    const item = _flagFlarePool[_flagFlareCount++];
    item.s = s;
    item.jumpY = jumpY;
}

// Stadium barrier colors
const BARRIER_COLOR = '#1a1a2e';
const BARRIER_HIGHLIGHT = '#2a2a4e';
const RAILING_COLOR = '#444466';
const RAILING_CHROME = '#666688';

// Bleacher colors (concrete/metal steps)
const BLEACHER_COLORS = {
    step: '#2a2a3a',        // Main step surface
    stepLight: '#363648',   // Lighter variation
    stepDark: '#1e1e2a',    // Shadow/edge
    riser: '#222230',       // Vertical face between steps
    seat: '#3a3a4a',        // Seat back (if visible)
    seatDark: '#2e2e3e',    // Seat shadow
    concrete: '#282838',    // Concrete texture base
    wear: '#252535'         // Worn areas
};

// Stadium structure colors
const STADIUM_COLORS = {
    roofSilhouette: '#0a0a14',
    roofBeam: '#12121e',
    floodlightGlow: 'rgba(255, 255, 220, 0.15)',
    floodlightCore: 'rgba(255, 255, 240, 0.8)',
    adBoard: '#111118',
    adBoardLit: '#1a1a28',
    adBoardGlow: 'rgba(100, 150, 255, 0.3)',
    speaker: '#222233',
    speakerGrill: '#1a1a2a',
    scoreboard: '#0a0a12',
    scoreboardLED: '#00ff44',
    pitchGreen: '#1a4d1a',
    pitchLine: '#2a6a2a',
    bannerPole: '#444455'
};

// Draw stadium roof/canopy silhouette at top
function drawStadiumRoof(ctx, w, h) {
    if (_frameCache.reducedEffects) return;

    // Main roof canopy (curved profile)
    ctx.fillStyle = STADIUM_COLORS.roofSilhouette;

    // Draw curved roof profile
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 10);
    ctx.quadraticCurveTo(w * 0.25, 14, w * 0.5, 12);
    ctx.quadraticCurveTo(w * 0.75, 10, w, 10);
    ctx.lineTo(w, 0);
    ctx.closePath();
    ctx.fill();

    // Roof underside (lighter)
    ctx.fillStyle = '#15152a';
    ctx.beginPath();
    ctx.moveTo(0, 10);
    ctx.quadraticCurveTo(w * 0.25, 14, w * 0.5, 12);
    ctx.quadraticCurveTo(w * 0.75, 10, w, 10);
    ctx.lineTo(w, 12);
    ctx.quadraticCurveTo(w * 0.75, 14, w * 0.5, 16);
    ctx.quadraticCurveTo(w * 0.25, 18, 0, 14);
    ctx.closePath();
    ctx.fill();

    // Roof support beams (diagonal trusses)
    ctx.fillStyle = STADIUM_COLORS.roofBeam;
    const beamSpacing = 60;
    for (let x = 20; x < w - 20; x += beamSpacing) {
        // Main diagonal beam
        ctx.beginPath();
        ctx.moveTo(x, 8);
        ctx.lineTo(x + 12, 28);
        ctx.lineTo(x + 16, 28);
        ctx.lineTo(x + 4, 8);
        ctx.closePath();
        ctx.fill();

        // Cross brace
        ctx.fillStyle = '#1a1a2a';
        ctx.fillRect(x + 2, 15, 12, 2);
        ctx.fillStyle = STADIUM_COLORS.roofBeam;
    }

    // Horizontal roof beam
    ctx.fillStyle = '#0d0d18';
    ctx.fillRect(0, 6, w, 3);

    // Roof edge trim (metallic highlight)
    ctx.fillStyle = '#333348';
    ctx.fillRect(0, 9, w, 1);

    // Roof edge shadow gradient (cached)
    const roofGrad = getCachedGradient(ctx, 'linear', `roof_${w}`, () => {
        const g = ctx.createLinearGradient(0, 10, 0, 35);
        g.addColorStop(0, 'rgba(0, 0, 0, 0.5)');
        g.addColorStop(0.5, 'rgba(0, 0, 0, 0.2)');
        g.addColorStop(1, 'rgba(0, 0, 0, 0)');
        return g;
    });
    ctx.fillStyle = roofGrad;
    ctx.fillRect(0, 10, w, 25);

    // Roof panels (subtle texture)
    ctx.fillStyle = 'rgba(30, 30, 50, 0.3)';
    for (let px = 0; px < w; px += 40) {
        ctx.fillRect(px, 0, 1, 10);
    }
}

// Draw floodlights with tower structures (optimized - cached gradients)
function drawFloodlights(ctx, w, h, now, isFrenzy) {
    if (_frameCache.reducedEffects) return;

    // Pre-calculate positions once (relative to width)
    const lightPositions = [
        { x: w * 0.08, scale: 0.7 },
        { x: w * 0.25, scale: 0.85 },
        { x: w * 0.5, scale: 1.0 },
        { x: w * 0.75, scale: 0.85 },
        { x: w * 0.92, scale: 0.7 }
    ];
    const flicker = isFrenzy ? (Math.sin(now * 0.01) * 0.1 + 0.9) : 1;

    for (const light of lightPositions) {
        const lx = light.x;
        const scale = light.scale;

        // Light glow cone - use solid fills instead of expensive radial gradients
        // This is a significant performance win with minimal visual difference
        const coneAlpha = 0.08 * flicker * scale;
        ctx.fillStyle = `rgba(255, 255, 210, ${coneAlpha})`;
        ctx.fillRect(lx - 100 * scale, 0, 200 * scale, 120 * scale);
        ctx.fillStyle = `rgba(255, 255, 200, ${coneAlpha * 0.5})`;
        ctx.fillRect(lx - 60 * scale, 0, 120 * scale, 80 * scale);

        // Tower structure (visible mast) - use solid color instead of gradient
        const towerHeight = 18 * scale;
        const towerWidth = 4 * scale;
        ctx.fillStyle = '#333344';
        ctx.fillRect(lx - towerWidth / 2, 0, towerWidth, towerHeight);

        // Light array housing
        const housingW = 22 * scale;
        const housingH = 8 * scale;
        ctx.fillStyle = '#2a2a3a';
        ctx.fillRect(lx - housingW / 2, towerHeight - 2, housingW, housingH);

        // Individual light bulbs (3 per fixture)
        const bulbSpacing = 6 * scale;
        for (let b = -1; b <= 1; b++) {
            const bulbX = lx + b * bulbSpacing;
            const bulbY = towerHeight + 2;

            // Bulb glow
            ctx.fillStyle = `rgba(255, 255, 200, ${0.3 * flicker})`;
            ctx.beginPath();
            ctx.arc(bulbX, bulbY, 3 * scale, 0, Math.PI * 2);
            ctx.fill();

            // Bulb core
            ctx.fillStyle = STADIUM_COLORS.floodlightCore;
            ctx.globalAlpha = 0.8 * flicker;
            ctx.beginPath();
            ctx.arc(bulbX, bulbY, 2 * scale, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }

        // Light rays in frenzy mode
        if (isFrenzy && scale >= 0.85) {
            ctx.save();
            ctx.globalAlpha = 0.04 * flicker;
            ctx.fillStyle = '#ffffff';
            ctx.translate(lx, towerHeight + 4);

            for (let ray = 0; ray < 5; ray++) {
                const rayAngle = (ray - 2) * 0.15 + Math.sin(now / 500 + ray) * 0.05;
                ctx.save();
                ctx.rotate(rayAngle);
                ctx.beginPath();
                ctx.moveTo(-2, 0);
                ctx.lineTo(-8, 100);
                ctx.lineTo(8, 100);
                ctx.lineTo(2, 0);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            }

            ctx.restore();
        }
    }
}

// Convert hex color to rgba string (use cached version for performance)
function hexToRgba(hex, alpha) {
    return hexToRgbaCached(hex, alpha);
}

// Draw advertising boards at bottom
function drawAdBoards(ctx, w, h, now, primaryColor) {
    const boardHeight = 14;
    const boardY = h - boardHeight;

    // Main board background - use cached gradient (static, only depends on h)
    const boardGrad = getCachedGradient(ctx, 'adboard', h, () => {
        const grad = ctx.createLinearGradient(0, boardY, 0, h);
        grad.addColorStop(0, '#1a1a28');
        grad.addColorStop(0.3, STADIUM_COLORS.adBoard);
        grad.addColorStop(1, '#080810');
        return grad;
    });
    ctx.fillStyle = boardGrad;
    ctx.fillRect(0, boardY, w, boardHeight);

    // LED panel effect
    if (!_frameCache.reducedEffects) {
        // Animated LED dots pattern
        ctx.fillStyle = 'rgba(50, 80, 120, 0.3)';
        const dotSpacing = 8;
        for (let dx = 0; dx < w; dx += dotSpacing) {
            for (let dy = boardY + 4; dy < h - 2; dy += 4) {
                ctx.fillRect(dx, dy, 2, 2);
            }
        }

        // Scrolling glow wave
        const glowPhase = (now / 40) % w;
        const grad = ctx.createLinearGradient(glowPhase - 150, 0, glowPhase + 150, 0);
        grad.addColorStop(0, 'rgba(100, 150, 255, 0)');
        grad.addColorStop(0.5, hexToRgba(primaryColor, 0.2));
        grad.addColorStop(1, 'rgba(100, 150, 255, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, boardY + 2, w, boardHeight - 4);

        // Scrolling club name text
        const clubName = state.selectedClub?.name?.toUpperCase() || 'ULTRAS';
        const textWidth = clubName.length * 12;
        const scrollX = -((now / 30) % (textWidth + w));

        ctx.save();
        ctx.beginPath();
        ctx.rect(0, boardY, w, boardHeight);
        ctx.clip();

        ctx.font = 'bold 9px monospace';
        ctx.fillStyle = hexToRgba(primaryColor, 0.6);

        // Draw text multiple times for seamless scroll
        for (let tx = scrollX; tx < w + textWidth; tx += textWidth + 100) {
            ctx.fillText(clubName, tx, boardY + 10);
            ctx.fillText('★', tx + textWidth + 40, boardY + 10);
        }

        ctx.restore();
    }

    // Board segments/panels (frame effect)
    ctx.strokeStyle = '#2a2a3a';
    ctx.lineWidth = 1;
    const panelWidth = 80;
    for (let x = 0; x < w; x += panelWidth) {
        ctx.strokeRect(x + 1, boardY + 1, panelWidth - 2, boardHeight - 2);
    }

    // Top edge frame (metallic)
    ctx.fillStyle = '#3a3a4a';
    ctx.fillRect(0, boardY, w, 2);
    ctx.fillStyle = '#222230';
    ctx.fillRect(0, boardY + 2, w, 1);
}

// Draw stadium speakers/PA system at top corners
function drawStadiumSpeakers(ctx, w, h) {
    if (_frameCache.reducedEffects) return;

    const speakerPositions = [
        { x: 50, angle: 0.2 },
        { x: w - 50, angle: -0.2 }
    ];

    for (const sp of speakerPositions) {
        ctx.save();
        ctx.translate(sp.x, 15);
        ctx.rotate(sp.angle);

        // Speaker housing
        ctx.fillStyle = STADIUM_COLORS.speaker;
        ctx.fillRect(-12, 0, 24, 18);

        // Speaker grill pattern
        ctx.fillStyle = STADIUM_COLORS.speakerGrill;
        for (let gy = 3; gy < 16; gy += 4) {
            ctx.fillRect(-10, gy, 20, 2);
        }

        // Mounting bracket
        ctx.fillStyle = RAILING_CHROME;
        ctx.fillRect(-4, -5, 8, 8);

        ctx.restore();
    }
}

// Draw scoreboard at top center
function drawScoreboard(ctx, w, h, now) {
    if (_frameCache.reducedEffects) return;

    const boardW = 120;
    const boardH = 28;
    const boardX = (w - boardW) / 2;
    const boardY = 12;

    // Scoreboard frame
    ctx.fillStyle = STADIUM_COLORS.scoreboard;
    ctx.fillRect(boardX, boardY, boardW, boardH);

    // Frame border
    ctx.strokeStyle = '#333344';
    ctx.lineWidth = 2;
    ctx.strokeRect(boardX, boardY, boardW, boardH);

    // Inner display area
    ctx.fillStyle = '#060610';
    ctx.fillRect(boardX + 4, boardY + 4, boardW - 8, boardH - 8);

    // LED glow effect
    const glowIntensity = 0.4 + Math.sin(now / 500) * 0.1;
    ctx.fillStyle = `rgba(0, 255, 68, ${glowIntensity * 0.15})`;
    ctx.fillRect(boardX + 4, boardY + 4, boardW - 8, boardH - 8);

    // Display player vs AI score
    ctx.fillStyle = STADIUM_COLORS.scoreboardLED;
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';

    // Format scores
    const pScore = String(state.playerScore).padStart(4, ' ');
    const aScore = String(state.aiScore).padStart(4, ' ');
    ctx.fillText(`${pScore} - ${aScore}`, boardX + boardW / 2, boardY + 22);

    ctx.textAlign = 'left';
}

// Draw club banners hanging from roof/barriers
function drawClubBanners(ctx, w, h, now, primaryColor, secondaryColor) {
    if (_frameCache.reducedEffects) return;

    const bannerPositions = [
        { x: 100, y: 35, w: 40, h: 55 },
        { x: w - 140, y: 35, w: 40, h: 55 }
    ];

    for (const bp of bannerPositions) {
        // Banner wave animation
        const wave = Math.sin(now / 400 + bp.x * 0.01) * 3;

        // Banner pole
        ctx.fillStyle = STADIUM_COLORS.bannerPole;
        ctx.fillRect(bp.x + bp.w / 2 - 2, bp.y - 10, 4, 12);

        // Banner fabric with wave
        ctx.save();
        ctx.translate(bp.x + bp.w / 2, bp.y);

        // Main banner body
        ctx.beginPath();
        ctx.moveTo(-bp.w / 2, 0);
        ctx.lineTo(-bp.w / 2 + wave, bp.h * 0.5);
        ctx.lineTo(-bp.w / 2, bp.h);
        ctx.lineTo(bp.w / 2, bp.h);
        ctx.lineTo(bp.w / 2 + wave, bp.h * 0.5);
        ctx.lineTo(bp.w / 2, 0);
        ctx.closePath();

        // Banner gradient (club colors)
        const bannerGrad = ctx.createLinearGradient(0, 0, 0, bp.h);
        bannerGrad.addColorStop(0, primaryColor || '#006633');
        bannerGrad.addColorStop(0.5, secondaryColor || '#ffffff');
        bannerGrad.addColorStop(1, primaryColor || '#006633');
        ctx.fillStyle = bannerGrad;
        ctx.fill();

        // Banner shadow/fold line
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(wave, bp.h * 0.3);
        ctx.lineTo(wave * 0.5, bp.h * 0.7);
        ctx.stroke();

        ctx.restore();
    }
}

// Draw pitch edge visible at the very bottom
function drawPitchEdge(ctx, w, h) {
    const pitchH = 8;
    const pitchY = h - pitchH;

    // Pitch gradient
    const pitchGrad = ctx.createLinearGradient(0, pitchY, 0, h);
    pitchGrad.addColorStop(0, STADIUM_COLORS.pitchGreen);
    pitchGrad.addColorStop(1, '#0d2a0d');
    ctx.fillStyle = pitchGrad;
    ctx.fillRect(0, pitchY, w, pitchH);

    // Pitch line (touchline)
    ctx.fillStyle = STADIUM_COLORS.pitchLine;
    ctx.fillRect(0, pitchY, w, 2);

    // White touchline marking
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fillRect(0, pitchY + 2, w, 1);
}

// Draw corner flags
function drawCornerFlags(ctx, w, h, now) {
    if (_frameCache.reducedEffects) return;

    const primaryColor = state.cachedColors?.primary || '#006633';
    const flagPositions = [
        { x: 20, side: 1 },
        { x: w - 20, side: -1 }
    ];

    for (const fp of flagPositions) {
        const flagY = h - 25;

        // Flag pole
        ctx.fillStyle = '#cccccc';
        ctx.fillRect(fp.x - 1, flagY, 2, 25);

        // Pole top ball
        ctx.beginPath();
        ctx.arc(fp.x, flagY, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#ffcc00';
        ctx.fill();

        // Flag fabric waving
        const wave1 = Math.sin(now / 200 + fp.x) * 4;
        const wave2 = Math.sin(now / 150 + fp.x + 1) * 3;

        ctx.save();
        ctx.translate(fp.x, flagY);

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(8 * fp.side + wave1, 5, 15 * fp.side + wave2, 3);
        ctx.lineTo(15 * fp.side + wave2, 12);
        ctx.quadraticCurveTo(8 * fp.side + wave1, 10, 0, 15);
        ctx.closePath();

        ctx.fillStyle = primaryColor;
        ctx.fill();

        // Flag highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(4 * fp.side + wave1 * 0.5, 3, 8 * fp.side + wave2 * 0.5, 2);
        ctx.lineTo(8 * fp.side + wave2 * 0.5, 5);
        ctx.quadraticCurveTo(4 * fp.side + wave1 * 0.5, 5, 0, 7);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }
}

// Draw atmospheric haze/smoke layer for stadium atmosphere
function drawAtmosphereHaze(ctx, w, h, now, isFrenzy) {
    if (_frameCache.reducedEffects) return;

    const hazeOpacity = isFrenzy ? 0.08 : 0.03;
    const primaryColor = state.cachedColors?.primary || '#006633';

    // Ambient haze gradient from top
    const hazeGrad = ctx.createLinearGradient(0, 0, 0, h * 0.4);
    hazeGrad.addColorStop(0, `rgba(200, 200, 255, ${hazeOpacity})`);
    hazeGrad.addColorStop(1, 'rgba(200, 200, 255, 0)');
    ctx.fillStyle = hazeGrad;
    ctx.fillRect(0, 0, w, h * 0.4);

    // Frenzy mode: colored atmosphere from floodlights
    if (isFrenzy) {
        const pulseOpacity = 0.03 + Math.sin(now / 300) * 0.02;
        ctx.fillStyle = hexToRgba(primaryColor, pulseOpacity);
        ctx.fillRect(0, 0, w, h * 0.5);
    }

    // Subtle horizontal smoke wisps
    const wispCount = isFrenzy ? 4 : 2;
    for (let i = 0; i < wispCount; i++) {
        const wispY = 30 + i * 40 + Math.sin(now / 800 + i) * 10;
        const wispX = ((now / (10 + i * 5)) + i * 200) % (w + 200) - 100;
        const wispOpacity = isFrenzy ? 0.06 : 0.03;

        const wispGrad = ctx.createRadialGradient(wispX, wispY, 0, wispX, wispY, 60);
        wispGrad.addColorStop(0, `rgba(255, 255, 255, ${wispOpacity})`);
        wispGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = wispGrad;
        ctx.fillRect(wispX - 60, wispY - 30, 120, 60);
    }
}

// Draw goal posts silhouette in the distance
function drawGoalPosts(ctx, w, h) {
    if (_frameCache.reducedEffects) return;

    const goalY = h - 6;
    const goalX = w / 2;
    const postWidth = 3;
    const postHeight = 35;
    const crossbarWidth = 60;

    // Goal net (subtle mesh behind)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.fillRect(goalX - crossbarWidth / 2, goalY - postHeight, crossbarWidth, postHeight);

    // Posts and crossbar
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';

    // Left post
    ctx.fillRect(goalX - crossbarWidth / 2 - postWidth / 2, goalY - postHeight, postWidth, postHeight);

    // Right post
    ctx.fillRect(goalX + crossbarWidth / 2 - postWidth / 2, goalY - postHeight, postWidth, postHeight);

    // Crossbar
    ctx.fillRect(goalX - crossbarWidth / 2, goalY - postHeight - postWidth, crossbarWidth, postWidth);
}

// Draw stadium bleachers (tiered concrete steps behind crowd)
function drawStadiumBleachers(ctx, w, h) {
    const layout = state.stadiumLayout;
    if (!layout) return;

    const { edgeMargin, aisleWidth, aislePositions } = layout;
    const primaryColor = state.cachedColors?.primary || '#006633';

    // Calculate row positions matching supporter layout
    const PX = 2.7;
    const supporterH = 14 * PX;
    const rowSpacing = supporterH + 6;
    const groundY = h - supporterH;
    const numRows = Math.floor(h / supporterH) + 1;

    // Draw from back to front (top to bottom on screen)
    for (let row = numRows - 1; row >= 0; row--) {
        const rowY = groundY - row * rowSpacing;
        const stepHeight = 14;  // Visible step height
        const riserHeight = 8;  // Vertical face between steps

        // Step surface (horizontal tread)
        const stepTop = rowY + supporterH - stepHeight;

        // Alternate colors slightly per row for visual interest
        const isEvenRow = row % 2 === 0;
        const stepColor = isEvenRow ? BLEACHER_COLORS.step : BLEACHER_COLORS.stepLight;

        // Draw step segments (between aisles)
        let segmentStart = edgeMargin;
        let sectionIndex = 0;

        for (let a = 0; a <= aislePositions.length; a++) {
            const segmentEnd = a < aislePositions.length ? aislePositions[a].start : w - edgeMargin;
            const segmentWidth = segmentEnd - segmentStart;

            if (segmentWidth > 0) {
                // Step tread (top surface) with gradient for depth
                const stepGrad = ctx.createLinearGradient(0, stepTop, 0, stepTop + stepHeight);
                stepGrad.addColorStop(0, BLEACHER_COLORS.stepLight);
                stepGrad.addColorStop(0.15, stepColor);
                stepGrad.addColorStop(0.85, stepColor);
                stepGrad.addColorStop(1, BLEACHER_COLORS.stepDark);
                ctx.fillStyle = stepGrad;
                ctx.fillRect(segmentStart, stepTop, segmentWidth, stepHeight);

                // Concrete texture (subtle noise pattern)
                if (!_frameCache.reducedEffects && row % 2 === 0) {
                    ctx.fillStyle = BLEACHER_COLORS.wear;
                    for (let tx = segmentStart; tx < segmentEnd; tx += 40) {
                        if ((tx + row * 17) % 60 < 20) {
                            ctx.fillRect(tx, stepTop + 4, 15, 3);
                        }
                    }
                }

                // Step edge highlight (front edge catches light)
                ctx.fillStyle = '#4a4a5a';
                ctx.fillRect(segmentStart, stepTop, segmentWidth, 2);

                // Riser (vertical face below step) - only visible for rows above ground
                if (row > 0) {
                    // Riser with gradient
                    const riserGrad = ctx.createLinearGradient(0, stepTop + stepHeight, 0, stepTop + stepHeight + riserHeight);
                    riserGrad.addColorStop(0, BLEACHER_COLORS.riser);
                    riserGrad.addColorStop(1, BLEACHER_COLORS.stepDark);
                    ctx.fillStyle = riserGrad;
                    ctx.fillRect(segmentStart, stepTop + stepHeight, segmentWidth, riserHeight);
                }

                // Individual seats with club-colored accents
                const seatSpacing = 18;
                const seatWidth = 10;
                const seatHeight = 8;
                const seatBack = 5;

                for (let sx = segmentStart + 8; sx < segmentEnd - seatWidth; sx += seatSpacing) {
                    // Vary which seats are shown
                    const seatHash = (sx * 7 + row * 13) % 100;
                    if (seatHash > 25) continue;  // Only show some seats (most hidden by supporters)

                    // Seat base
                    ctx.fillStyle = BLEACHER_COLORS.seat;
                    ctx.fillRect(sx, stepTop - seatBack, seatWidth, seatBack + 2);

                    // Seat back with subtle club color tint (every few seats)
                    if (seatHash < 8) {
                        ctx.fillStyle = primaryColor;
                        ctx.globalAlpha = 0.3;
                        ctx.fillRect(sx + 1, stepTop - seatBack + 1, seatWidth - 2, seatBack - 1);
                        ctx.globalAlpha = 1;
                    }

                    // Seat shadow
                    ctx.fillStyle = BLEACHER_COLORS.seatDark;
                    ctx.fillRect(sx, stepTop - 1, seatWidth, 2);
                }

                // Row number markers (on left side of each section)
                if (!_frameCache.reducedEffects && row > 0 && row < 6) {
                    ctx.fillStyle = '#555566';
                    ctx.font = '8px monospace';
                    ctx.fillText(String(row), segmentStart + 4, stepTop + stepHeight - 2);
                }
            }

            // Move to next segment (after aisle)
            if (a < aislePositions.length) {
                segmentStart = aislePositions[a].end;
                sectionIndex++;
            }
        }
    }

    // Section dividers with numbers
    ctx.fillStyle = BLEACHER_COLORS.stepDark;
    const dividerSpacing = 100;
    let sectionNum = 1;
    for (let x = edgeMargin + dividerSpacing; x < w - edgeMargin; x += dividerSpacing) {
        // Check if divider would be in an aisle - skip if so
        let inAisle = false;
        for (const aisle of aislePositions) {
            if (x >= aisle.start && x <= aisle.end) {
                inAisle = true;
                break;
            }
        }
        if (!inAisle) {
            // Divider line
            ctx.fillStyle = BLEACHER_COLORS.stepDark;
            ctx.fillRect(x, 0, 2, h - 20);

            // Section number at top
            if (!_frameCache.reducedEffects) {
                ctx.fillStyle = '#444455';
                ctx.font = 'bold 10px sans-serif';
                ctx.fillText(`${sectionNum}`, x - 4, 45);
            }
            sectionNum++;
        }
    }
}

// Draw stadium barriers (edges and aisles) - called each frame after background gradient
function drawStadiumBarriers(ctx, w, h) {
    const layout = state.stadiumLayout;
    if (!layout) return;

    const { edgeMargin, aisleWidth, aislePositions } = layout;
    const primaryColor = state.cachedColors?.primary || '#006633';

    // Edge barriers (left and right walls) with gradient
    const edgeGrad = ctx.createLinearGradient(0, 0, edgeMargin, 0);
    edgeGrad.addColorStop(0, '#0f0f1a');
    edgeGrad.addColorStop(0.7, BARRIER_COLOR);
    edgeGrad.addColorStop(1, BARRIER_HIGHLIGHT);
    ctx.fillStyle = edgeGrad;
    ctx.fillRect(0, 0, edgeMargin, h);

    const edgeGradR = ctx.createLinearGradient(w - edgeMargin, 0, w, 0);
    edgeGradR.addColorStop(0, BARRIER_HIGHLIGHT);
    edgeGradR.addColorStop(0.3, BARRIER_COLOR);
    edgeGradR.addColorStop(1, '#0f0f1a');
    ctx.fillStyle = edgeGradR;
    ctx.fillRect(w - edgeMargin, 0, edgeMargin, h);

    // Metal edge trim
    ctx.fillStyle = RAILING_CHROME;
    ctx.fillRect(edgeMargin - 3, 0, 3, h);
    ctx.fillRect(w - edgeMargin, 0, 3, h);

    // Aisles between sections
    for (const aisle of aislePositions) {
        // Aisle floor (darker, worn)
        const aisleGrad = ctx.createLinearGradient(aisle.start, 0, aisle.end, 0);
        aisleGrad.addColorStop(0, BARRIER_HIGHLIGHT);
        aisleGrad.addColorStop(0.2, BARRIER_COLOR);
        aisleGrad.addColorStop(0.8, BARRIER_COLOR);
        aisleGrad.addColorStop(1, BARRIER_HIGHLIGHT);
        ctx.fillStyle = aisleGrad;
        ctx.fillRect(aisle.start, 0, aisleWidth, h);

        // Aisle steps (horizontal lines showing stairs)
        ctx.fillStyle = '#252535';
        const stepInterval = 25;
        for (let y = 30; y < h - 20; y += stepInterval) {
            ctx.fillRect(aisle.start + 4, y, aisleWidth - 8, 2);
        }

        // Safety railings on sides
        ctx.fillStyle = RAILING_CHROME;
        ctx.fillRect(aisle.start + 2, 0, 2, h);
        ctx.fillRect(aisle.end - 4, 0, 2, h);

        // Center handrail with posts
        ctx.fillStyle = RAILING_COLOR;
        const railX = aisle.start + aisleWidth / 2 - 2;
        ctx.fillRect(railX, 0, 4, h);

        // Handrail posts
        ctx.fillStyle = RAILING_CHROME;
        for (let y = 20; y < h - 30; y += 50) {
            ctx.fillRect(railX - 2, y, 8, 6);
            // Post cap highlight
            ctx.fillStyle = '#888899';
            ctx.fillRect(railX - 1, y, 6, 2);
            ctx.fillStyle = RAILING_CHROME;
        }

        // Emergency exit sign at bottom of each aisle
        if (!_frameCache.reducedEffects) {
            ctx.fillStyle = '#004400';
            ctx.fillRect(aisle.start + aisleWidth / 2 - 12, h - 45, 24, 10);
            ctx.fillStyle = '#00ff00';
            ctx.globalAlpha = 0.7;
            ctx.font = '7px sans-serif';
            ctx.fillText('EXIT', aisle.start + aisleWidth / 2 - 8, h - 37);
            ctx.globalAlpha = 1;
        }
    }

    // Bottom safety barrier (front of stand)
    // Main barrier
    ctx.fillStyle = BARRIER_COLOR;
    ctx.fillRect(0, h - 14, w, 14);

    // Barrier top rail
    ctx.fillStyle = RAILING_CHROME;
    ctx.fillRect(0, h - 16, w, 4);

    // Rail highlight
    ctx.fillStyle = '#888899';
    ctx.fillRect(0, h - 16, w, 1);

    // Barrier supports/posts
    ctx.fillStyle = RAILING_COLOR;
    const postSpacing = 50;
    for (let x = edgeMargin; x < w - edgeMargin; x += postSpacing) {
        // Skip posts in aisles
        let inAisle = false;
        for (const aisle of aislePositions) {
            if (x >= aisle.start && x <= aisle.end) {
                inAisle = true;
                break;
            }
        }
        if (!inAisle) {
            ctx.fillRect(x - 2, h - 20, 4, 20);
            // Post cap
            ctx.fillStyle = RAILING_CHROME;
            ctx.fillRect(x - 3, h - 22, 6, 4);
            ctx.fillStyle = RAILING_COLOR;
        }
    }

    // Club-colored accent strip on barrier
    if (!_frameCache.reducedEffects) {
        ctx.fillStyle = primaryColor;
        ctx.globalAlpha = 0.4;
        ctx.fillRect(0, h - 6, w, 4);
        ctx.globalAlpha = 1;
    }
}

function shadeColor(hex, percent) {
    let r = parseInt(hex.slice(1, 3), 16);
    let g = parseInt(hex.slice(3, 5), 16);
    let b = parseInt(hex.slice(5, 7), 16);
    r = Math.min(255, Math.max(0, r + Math.round(r * percent / 100)));
    g = Math.min(255, Math.max(0, g + Math.round(g * percent / 100)));
    b = Math.min(255, Math.max(0, b + Math.round(b * percent / 100)));
    return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
}

export function setCrowdEmotion(emotion) {
    state.crowdEmotion = emotion;
    // Optionally, reset/trigger specific animations here if needed
    // For now, drawing logic will react to state.crowdEmotion
}

export function initSupporters(canvasWidth, canvasHeight) {
    state.supporters = [];
    const PX = 2.7;
    const supporterW = 5 * PX;
    // Same density on all devices - other optimizations handle performance
    const spacing = 13;
    const cols = Math.floor(canvasWidth / (supporterW + spacing));
    const supporterH = 14 * PX;
    const rows = Math.floor(canvasHeight / (supporterH));
    const groundY = (canvasHeight) - supporterH;

    // Calculate aisle positions directly (same formula as crowdBg.js)
    const edgeMargin = 30;
    const aisleWidth = 40;
    const sectionDivisor = 500;
    const numSections = Math.max(1, Math.floor(canvasWidth / sectionDivisor));
    const numAisles = numSections - 1;
    const availableWidth = canvasWidth - (2 * edgeMargin) - (numAisles * aisleWidth);
    const sectionWidth = availableWidth / numSections;

    const aislePositions = [];
    for (let a = 0; a < numAisles; a++) {
        const aisleStart = edgeMargin + (a + 1) * sectionWidth + a * aisleWidth;
        aislePositions.push({
            start: aisleStart,
            end: aisleStart + aisleWidth
        });
    }

    // Use cached colors if available, otherwise fallback
    const primary = state.cachedColors?.primary || (state.selectedClub ? state.selectedClub.colors.primary : '#e5ff00');
    const secondary = state.cachedColors?.secondary || (state.selectedClub ? state.selectedClub.colors.secondary : '#000000');

    const palette = [primary, secondary, shadeColor(primary, -30), shadeColor(primary, 30), shadeColor(secondary, -40)];
    const skinTones = ['#f5d0a9', '#d4a373', '#f79c9c', '#c68642', '#e0ac69'];

    // Initialize sprite cache with current palette (#11)
    if (!SPRITE_CACHE.ready || state.cachedColors?.primary !== primary) {
        initSpriteCache(palette);
    }

    const startXOffset = 0;
    for (let row = 0; row < rows; row++) {
        const rowY = groundY - row * (14 * PX + 6);
        const rowScale = 0.7 + row * 0.15;
        const rowOffset = (row % 2 === 0 ? 0 : (supporterW + spacing) / 2);
        for (let col = 0; col < cols; col++) {
            const x = col * (supporterW + spacing) + rowOffset + startXOffset;
            if (x + supporterW > canvasWidth) continue;

            // Skip supporters that touch barrier zones (clean edges)
            const supporterLeft = x;
            const supporterRight = x + supporterW;

            // Skip if touching left edge barrier
            if (supporterLeft < edgeMargin) continue;

            // Skip if touching right edge barrier
            if (supporterRight > canvasWidth - edgeMargin) continue;

            // Skip if touching any aisle (with small buffer for clean edges)
            let touchesAisle = false;
            const aisleBuffer = 2;  // Small buffer to ensure clean separation
            for (const aisle of aislePositions) {
                if (supporterRight > (aisle.start - aisleBuffer) && supporterLeft < (aisle.end + aisleBuffer)) {
                    touchesAisle = true;
                    break;
                }
            }
            if (touchesAisle) continue;
            const roll = Math.random();
            const hasFlag = roll < 0.02;
            const hasFlare = !hasFlag && roll < 0.05;
            const flareColors = [shadeColor(primary, -30), shadeColor(primary, 30), primary, secondary];
            // Varying flag sizes: small pennants to giant tifo flags
            let flagScale = 1;
            if (hasFlag) {
                const fr = Math.random();
                if (fr < 0.45) flagScale = 1 + Math.random();          // small-medium (1-2)
                else if (fr < 0.75) flagScale = 2 + Math.random();     // large (2-3)
                else flagScale = 3 + Math.random() * 1.5;              // giant (3-4.5)
            }
            state.supporters.push({
                x: x,
                baseY: rowY,
                y: rowY,
                row: row,
                scale: rowScale,
                px: PX,
                shirtColor: palette[Math.floor(Math.random() * palette.length)],
                skinColor: skinTones[Math.floor(Math.random() * skinTones.length)],
                scarfColor: Math.random() < 0.4 ? primary : (Math.random() < 0.5 ? secondary : null),
                jumpPhase: Math.random() * Math.PI * 2,
                jumpStrength: 0.6 + Math.random() * 0.4,
                armsUp: false,
                hasHat: Math.random() < 0.15,
                hasScarf: Math.random() < 0.3,
                hasFlag: hasFlag,
                flagColor: Math.random() < 0.5 ? primary : secondary,
                flagStripe: Math.random() < 0.4,
                flagScale: flagScale,
                flagHand: Math.random() < 0.5 ? 'left' : 'right',
                // Flag motion: 0=side-swing, 1=circular, 2=figure-8, 3=pumping
                flagMotion: Math.floor(Math.random() * 4),
                flagSwingPhase: Math.random() * Math.PI * 2,
                flagSwingSpeed: 0.7 + Math.random() * 0.6,
                hasFlare: hasFlare,
                flareColor: flareColors[Math.floor(Math.random() * flareColors.length)],
                flareHand: Math.random() < 0.5 ? 'left' : 'right',
                // Arm transition state (#7)
                armTransition: 0,  // 0 = down, 1 = up
                lastArmState: 'normal'
            });
        }
    }
    state.supporters.sort((a, b) => a.row - b.row);
}

function drawPixelRect(ctx, x, y, w, h, color, px, batch = null) {
    if (batch) {
        batch.add(color, x, y, w * px, h * px);
    } else {
        ctx.fillStyle = color;
        ctx.fillRect(Math.floor(x), Math.floor(y), w * px, h * px);
    }
}

// Calculate flag swing motion - used by both supporter body and flag drawing
function getFlagSwing(s, now) {
    const px = s.px;
    const scale = s.flagScale || 1;
    const motionType = s.flagMotion || 0;
    const swingPhase = s.flagSwingPhase || 0;
    const swingSpeed = s.flagSwingSpeed || 1;

    const t = now / 1000 * swingSpeed + swingPhase;
    const swingAmp = (8 + scale * 6) * px;
    const vertAmp = (4 + scale * 3) * px;

    let swingX = 0, swingY = 0, poleAngle = 0;

    switch (motionType) {
        case 0:  // Side-to-side swing
            swingX = Math.sin(t * 2.5) * swingAmp;
            poleAngle = Math.sin(t * 2.5) * 0.4;
            break;
        case 1:  // Circular motion
            swingX = Math.sin(t * 2) * swingAmp * 0.7;
            swingY = Math.cos(t * 2) * vertAmp * 0.5;
            poleAngle = Math.sin(t * 2) * 0.35;
            break;
        case 2:  // Figure-8 motion
            swingX = Math.sin(t * 2) * swingAmp * 0.8;
            swingY = Math.sin(t * 4) * vertAmp * 0.4;
            poleAngle = Math.sin(t * 2) * 0.35;
            break;
        case 3:  // Pumping up and down
            swingY = Math.sin(t * 3) * vertAmp;
            poleAngle = Math.sin(t * 6) * 0.15;
            break;
    }

    return { swingX, swingY, poleAngle, t, swingSpeed };
}

function drawSupporter(ctx, s, jumpOffset, armsUp, frenzy, now, choreo, batch = null, primaryColor = null, secondaryColor = null, preCalc = {}) {
    const px = s.px;
    const baseX = s.x | 0;  // Faster than Math.floor for positive numbers
    let y = (s.baseY + jumpOffset) | 0;

    // Use passed colors or fallback (with multiple fallback levels)
    const primary = primaryColor || state.cachedColors?.primary || state.selectedClub?.colors?.primary || '#006633';
    const secondary = secondaryColor || state.cachedColors?.secondary || state.selectedClub?.colors?.secondary || '#FFFFFF';

    let currentArmsUp = armsUp;
    let currentFrenzy = frenzy;
    let currentRockX = 0;
    let eyeOffsetY = 0;
    let mouthShape = 'normal';

    const emotion = state.crowdEmotion;
    if (emotion === 'deject') {
        currentArmsUp = false;
        currentFrenzy = false;
        y += 2 * px;
        eyeOffsetY = px;
        mouthShape = 'frown';
    } else if (emotion === 'celebrate') {
        currentFrenzy = true;
        currentArmsUp = true;
        mouthShape = 'open';
    } else if (currentFrenzy) {
        mouthShape = 'open';
    }

    // Calculate sway based on choreo config
    if (s.hasFlag && (currentFrenzy || emotion === 'celebrate')) {
        // Flag carriers linked to flag swing
        const flagSwing = getFlagSwing(s, now);
        currentRockX = flagSwing.swingX * 0.4;
        y += (flagSwing.swingY * 0.3) | 0;
    } else if (choreo && choreo.id > 0) {
        // Use choreo-defined sway
        currentRockX = getChoreoSway(choreo, s, now, preCalc);
    } else if (currentFrenzy) {
        // Frenzy individual rocking
        currentRockX = Math.sin(now / 120 + s.jumpPhase) * 3;
    }
    const x = (baseX + currentRockX) | 0;

    // Beat ripple effect across crowd rows (#9)
    const timeSinceBeat = preCalc.timeSinceBeat || 0;
    const rowDelay = s.row * 0.06;  // Wave propagates back through rows
    const rippleProgress = Math.max(0, timeSinceBeat - rowDelay);
    const rippleIntensity = Math.max(0, 1 - rippleProgress * 5) * 0.15;

    if (rippleIntensity > 0.01 && !_frameCache.reducedEffects) {
        ctx.fillStyle = primary;
        ctx.globalAlpha = rippleIntensity;
        ctx.fillRect(x - px, y + 2 * px, 12 * px, 12 * px);
        ctx.globalAlpha = 1;
    }

    if (currentFrenzy && !_frameCache.reducedEffects) {
        const glowPhase = (Math.sin(now / 200 + s.jumpPhase) + 1) * 0.5;
        ctx.fillStyle = primary;
        ctx.globalAlpha = 0.05 + glowPhase * 0.05;
        ctx.fillRect(x - px, y + 2 * px, 12 * px, 12 * px);
        ctx.globalAlpha = 1;
    }

    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(x + px, Math.floor(s.baseY + 2 * px), 8 * px, px);

    if (currentFrenzy) {
        const kick = Math.sin(now / 100 + s.jumpPhase) > 0;
        if (kick) {
            drawPixelRect(ctx, x + 1 * px, y + 11 * px, 2, 3, '#222244', px, batch);
            drawPixelRect(ctx, x + 7 * px, y + 12 * px, 2, 2, '#222244', px, batch);
        } else {
            drawPixelRect(ctx, x + 1 * px, y + 12 * px, 2, 2, '#222244', px, batch);
            drawPixelRect(ctx, x + 7 * px, y + 11 * px, 2, 3, '#222244', px, batch);
        }
    } else if (state.crowdEmotion === 'deject') {
        // Slumped legs
        drawPixelRect(ctx, x + 2 * px, y + 12 * px, 2, 2, '#222244', px, batch);
        drawPixelRect(ctx, x + 6 * px, y + 12 * px, 2, 2, '#222244', px, batch);
    }
    else {
        drawPixelRect(ctx, x + 2 * px, y + 11 * px, 2, 3, '#222244', px, batch);
        drawPixelRect(ctx, x + 6 * px, y + 11 * px, 2, 3, '#222244', px, batch);
    }

    // Tifo choreo (type 3): coordinated shirt color wave
    let shirtColor = s.shirtColor;
    // if (choreoType === 3) {
    //     const primary = state.selectedClub ? state.selectedClub.colors.primary : '#006633';
    //     const secondary = state.selectedClub ? state.selectedClub.colors.secondary : '#FFFFFF';
    //     shirtColor = Math.sin(now / 400 + s.x / 40 + s.row * 1.5) > 0 ? primary : secondary;
    // }
    // Desaturate slightly if dejected
    if (state.crowdEmotion === 'deject') {
        // This is a simplistic way to desaturate pixel art, might need refinement
        const r = parseInt(shirtColor.slice(1, 3), 16);
        const g = parseInt(shirtColor.slice(3, 5), 16);
        const b = parseInt(shirtColor.slice(5, 7), 16);
        const avg = (r + g + b) / 3;
        shirtColor = '#' + [avg * 0.8, avg * 0.8, avg * 0.8].map(c => Math.floor(c).toString(16).padStart(2, '0')).join('');
    }
    drawPixelRect(ctx, x + 2 * px, y + 6 * px, 6, 5, shirtColor, px, batch);

    // Arms - use choreo config for positioning
    const armsPos = choreo ? getChoreoArmsPosition(choreo) : 'normal';
    const clapSpeed = choreo?.clapSpeed || 200;

    // Smooth arm transition (#7) - update transition state
    const targetArm = (currentArmsUp || armsPos === 'scarf-hold' || armsPos === 'up' || armsPos === 'phone-hold' || armsPos === 'scarf-spin' || armsPos === 'placard-hold' || armsPos === 'flag-hold') ? 1 : 0;
    const transitionSpeed = 0.08;  // How fast arms move (0-1 per frame)
    if (s.armTransition === undefined) s.armTransition = 0;
    if (targetArm > s.armTransition) {
        s.armTransition = Math.min(1, s.armTransition + transitionSpeed);
    } else if (targetArm < s.armTransition) {
        s.armTransition = Math.max(0, s.armTransition - transitionSpeed * 0.7);  // Slower down
    }
    const armLerp = s.armTransition;  // 0 = down, 1 = up

    if (armsPos === 'pump' && !s.hasFlag && !s.hasFlare) {
        // Pumping arms up and down - high energy bounce choreo
        const pumpPhase = Math.sin(now / 150);
        if (pumpPhase > 0) {
            // Arms up
            drawPixelRect(ctx, x - px, y + 1 * px, 2, 4, s.skinColor, px, batch);
            drawPixelRect(ctx, x + 9 * px, y + 1 * px, 2, 4, s.skinColor, px, batch);
            drawPixelRect(ctx, x - px, y, 2, 1, s.skinColor, px, batch);
            drawPixelRect(ctx, x + 9 * px, y, 2, 1, s.skinColor, px, batch);
        } else {
            // Arms down
            drawPixelRect(ctx, x - px, y + 4 * px, 2, 4, s.skinColor, px, batch);
            drawPixelRect(ctx, x + 9 * px, y + 4 * px, 2, 4, s.skinColor, px, batch);
        }
    } else if (armsPos === 'clap' && !s.hasFlag && !s.hasFlare) {
        // Clapping hands together in front
        const clapPhase = Math.sin(now / clapSpeed);
        if (clapPhase > 0.3) {
            // Hands together (clapping)
            drawPixelRect(ctx, x + 3 * px, y + 5 * px, 2, 2, s.skinColor, px, batch);
            drawPixelRect(ctx, x + 5 * px, y + 5 * px, 2, 2, s.skinColor, px, batch);
            // Arms bent inward
            drawPixelRect(ctx, x + px, y + 6 * px, 2, 3, s.skinColor, px, batch);
            drawPixelRect(ctx, x + 7 * px, y + 6 * px, 2, 3, s.skinColor, px, batch);
        } else {
            // Hands apart (preparing to clap)
            drawPixelRect(ctx, x - px, y + 5 * px, 2, 2, s.skinColor, px, batch);
            drawPixelRect(ctx, x + 9 * px, y + 5 * px, 2, 2, s.skinColor, px, batch);
            // Arms extended outward
            drawPixelRect(ctx, x - px, y + 6 * px, 3, 2, s.skinColor, px, batch);
            drawPixelRect(ctx, x + 8 * px, y + 6 * px, 3, 2, s.skinColor, px, batch);
        }
    } else if (armsPos === 'scarf-hold' && !s.hasFlag && !s.hasFlare) {
        // Arms straight up holding item (scarf/placard/banner)
        drawPixelRect(ctx, x - px, y + 1 * px, 2, 5, s.skinColor, px, batch);
        drawPixelRect(ctx, x + 9 * px, y + 1 * px, 2, 5, s.skinColor, px, batch);
        drawPixelRect(ctx, x - px, y, 2, 1, s.skinColor, px, batch);
        drawPixelRect(ctx, x + 9 * px, y, 2, 1, s.skinColor, px, batch);
    } else if (armsPos === 'push' && !s.hasFlag && !s.hasFlare) {
        // Moshpit/surge pushing motion
        const pushPhase = Math.sin(now / 80 + s.jumpPhase * 3);
        if (pushPhase > 0.2) {
            drawPixelRect(ctx, x - 2 * px, y + 5 * px, 3, 2, s.skinColor, px, batch);
            drawPixelRect(ctx, x + 9 * px, y + 5 * px, 3, 2, s.skinColor, px, batch);
        } else if (pushPhase > -0.2) {
            drawPixelRect(ctx, x - px, y + 6 * px, 2, 3, s.skinColor, px, batch);
            drawPixelRect(ctx, x + 9 * px, y + 6 * px, 2, 3, s.skinColor, px, batch);
        } else {
            drawPixelRect(ctx, x, y + 7 * px, 2, 3, s.skinColor, px, batch);
            drawPixelRect(ctx, x + 8 * px, y + 7 * px, 2, 3, s.skinColor, px, batch);
        }
    } else if (armsPos === 'placard-hold' && !s.hasFlag && !s.hasFlare) {
        drawPixelRect(ctx, x - px, y + 1 * px, 2, 5, s.skinColor, px, batch);
        drawPixelRect(ctx, x + 9 * px, y + 1 * px, 2, 5, s.skinColor, px, batch);
        drawPixelRect(ctx, x, y, 2, 1, s.skinColor, px, batch);
        drawPixelRect(ctx, x + 8 * px, y, 2, 1, s.skinColor, px, batch);
    } else if (armsPos === 'flag-hold' && !s.hasFlag && !s.hasFlare) {
        drawPixelRect(ctx, x - px, y, 2, 6, s.skinColor, px, batch);
        drawPixelRect(ctx, x + 9 * px, y, 2, 6, s.skinColor, px, batch);
        drawPixelRect(ctx, x - px, y - px, 2, 1, s.skinColor, px, batch);
        drawPixelRect(ctx, x + 9 * px, y - px, 2, 1, s.skinColor, px, batch);
    } else if (armsPos === 'drumming' && !s.hasFlag && !s.hasFlare) {
        // Alternating drum hits
        const drumSpeed = choreo?.drumSpeed || 150;
        const drumPhase = Math.sin(now / drumSpeed);
        if (drumPhase > 0) {
            drawPixelRect(ctx, x - px, y + 1 * px, 2, 4, s.skinColor, px, batch);
            drawPixelRect(ctx, x - px, y - px, 2, 2, s.skinColor, px, batch);
            drawPixelRect(ctx, x + 9 * px, y + 5 * px, 2, 4, s.skinColor, px, batch);
        } else {
            drawPixelRect(ctx, x - px, y + 5 * px, 2, 4, s.skinColor, px, batch);
            drawPixelRect(ctx, x + 9 * px, y + 1 * px, 2, 4, s.skinColor, px, batch);
            drawPixelRect(ctx, x + 9 * px, y - px, 2, 2, s.skinColor, px, batch);
        }
    } else if (armsPos === 'phone-hold' && !s.hasFlag && !s.hasFlare) {
        // Both arms straight up holding phone
        drawPixelRect(ctx, x - px, y - 2 * px, 2, 6, s.skinColor, px, batch);
        drawPixelRect(ctx, x + 9 * px, y - 2 * px, 2, 6, s.skinColor, px, batch);
        drawPixelRect(ctx, x + px, y - 3 * px, 2, 2, s.skinColor, px, batch);
        drawPixelRect(ctx, x + 7 * px, y - 3 * px, 2, 2, s.skinColor, px, batch);
    } else if (armsPos === 'viking-clap' && !s.hasFlag && !s.hasFlare) {
        // Wide spread to together clapping
        const vikingSpeed = choreo?.vikingClapSpeed || 800;
        const vikingPhase = Math.sin(now / vikingSpeed);
        if (vikingPhase > 0.3) {
            drawPixelRect(ctx, x + 2 * px, y + 4 * px, 3, 3, s.skinColor, px, batch);
            drawPixelRect(ctx, x + 5 * px, y + 4 * px, 3, 3, s.skinColor, px, batch);
        } else if (vikingPhase > -0.3) {
            drawPixelRect(ctx, x - px, y + 5 * px, 3, 3, s.skinColor, px, batch);
            drawPixelRect(ctx, x + 8 * px, y + 5 * px, 3, 3, s.skinColor, px, batch);
        } else {
            drawPixelRect(ctx, x - 3 * px, y + 5 * px, 4, 2, s.skinColor, px, batch);
            drawPixelRect(ctx, x + 9 * px, y + 5 * px, 4, 2, s.skinColor, px, batch);
        }
    } else if (armsPos === 'scarf-spin' && !s.hasFlag && !s.hasFlare) {
        // Circular motion overhead
        const spinSpeed = choreo?.spinSpeed || 200;
        const spinAngle = (now / spinSpeed) * Math.PI * 2;
        const armOffsetX = Math.cos(spinAngle) * 3 * px;
        const armOffsetY = Math.sin(spinAngle) * 2 * px;
        const armX1 = (x + 4 * px + armOffsetX) | 0;
        const armY1 = (y + px + armOffsetY) | 0;
        const armX2 = (x + 4 * px - armOffsetX) | 0;
        const armY2 = (y + px - armOffsetY) | 0;
        drawPixelRect(ctx, armX1, armY1, 2, 4, s.skinColor, px, batch);
        drawPixelRect(ctx, armX2, armY2, 2, 4, s.skinColor, px, batch);
    } else if (armsPos === 'heart' && !s.hasFlag && !s.hasFlare) {
        // Hand on heart
        drawPixelRect(ctx, x + 2 * px, y + 6 * px, 4, 2, s.skinColor, px, batch);
        drawPixelRect(ctx, x + px, y + 5 * px, 2, 2, s.skinColor, px, batch);
        drawPixelRect(ctx, x + 8 * px, y + 7 * px, 2, 4, s.skinColor, px, batch);
    } else if (currentFrenzy) {
        const armPhase = Math.sin(now / 150 + s.jumpPhase);
        if (armPhase > 0.3) {
            drawPixelRect(ctx, x - px, y + 1 * px, 2, 3, s.skinColor, px, batch);
            drawPixelRect(ctx, x + 9 * px, y + 1 * px, 2, 3, s.skinColor, px, batch);
            drawPixelRect(ctx, x - px, y, 2, 1, s.skinColor, px, batch);
            drawPixelRect(ctx, x + 9 * px, y, 2, 1, s.skinColor, px, batch);
        } else if (armPhase > -0.3) {
            drawPixelRect(ctx, x - px, y + 2 * px, 2, 4, s.skinColor, px, batch);
            drawPixelRect(ctx, x + 9 * px, y + 5 * px, 3, 2, s.skinColor, px, batch);
        } else {
            drawPixelRect(ctx, x - px, y + 4 * px, 3, 2, s.skinColor, px, batch);
            drawPixelRect(ctx, x + 8 * px, y + 4 * px, 3, 2, s.skinColor, px, batch);
        }
    } else if (currentArmsUp || armLerp > 0.1) {
        // Smooth arm transition using armLerp (#7)
        // Interpolate Y position: down (7*px) to up (2*px)
        const armYOffset = Math.round((7 - 5 * armLerp) * px);
        const armLength = Math.round(4 - armLerp);  // Shorter when up

        drawPixelRect(ctx, x, y + armYOffset, 2, armLength, s.skinColor, px, batch);
        drawPixelRect(ctx, x + 8 * px, y + armYOffset, 2, armLength, s.skinColor, px, batch);

        // Draw hands/fists when arms are mostly up
        if (armLerp > 0.7) {
            const handY = Math.round((1 + (1 - armLerp) * 2) * px);
            drawPixelRect(ctx, x, y + handY, 2, 1, s.skinColor, px, batch);
            drawPixelRect(ctx, x + 8 * px, y + handY, 2, 1, s.skinColor, px, batch);
        }
    } else if (state.crowdEmotion === 'deject') {
        // Arms down, slightly inward
        drawPixelRect(ctx, x + px, y + 8 * px, 2, 4, s.skinColor, px, batch);
        drawPixelRect(ctx, x + 7 * px, y + 8 * px, 2, 4, s.skinColor, px, batch);
    }
    else {
        drawPixelRect(ctx, x, y + 7 * px, 2, 4, s.skinColor, px, batch);
        drawPixelRect(ctx, x + 8 * px, y + 7 * px, 2, 4, s.skinColor, px, batch);
    }

    drawPixelRect(ctx, x + 3 * px, y + 2 * px, 4, 4, s.skinColor, px, batch); // Head

    if (s.hasHat) {
        drawPixelRect(ctx, x + 2 * px, y + 1 * px, 6, 1, shirtColor, px, batch);
        drawPixelRect(ctx, x + 3 * px, y, 4, 1, shirtColor, px, batch);
    } else {
        drawPixelRect(ctx, x + 3 * px, y + 1 * px, 4, 1, '#222222', px, batch); // Hair
    }

    // Eyes and Mouth - store for later drawing (after batch flush) to ensure they're on top
    // We return the face data so it can be drawn after the batch
    if (batch) {
        batch.addFace(x, y, px, eyeOffsetY, mouthShape, emotion);
    } else {
        drawFace(ctx, x, y, px, eyeOffsetY, mouthShape, emotion);
    }

    // Draw choreo-specific items (scarves, placards, etc.)
    if (choreo && choreo.showItem) {
        _colorsCache.primary = primary;
        _colorsCache.secondary = secondary;
        drawChoreoItem(ctx, choreo, s, x, y, now, _colorsCache, batch);
    } else if (s.hasScarf && s.scarfColor) {
        drawPixelRect(ctx, x + 2 * px, y + 5 * px, 6, 1, s.scarfColor, px, batch);
        if (currentFrenzy) {
            const scarfWave = Math.sin(now / 100 + s.jumpPhase) > 0 ? 1 : -1;
            drawPixelRect(ctx, x + (scarfWave > 0 ? 8 : -2) * px, y + 5 * px, 2, 1, s.scarfColor, px, batch);
        }
    }
}

function drawFeverText(ctx, w, h, now, yPos) {
    const primary = state.cachedColors?.primary || '#006633';

    const sinceStart = now - state.frenzyStartTime;
    const entranceT = Math.min(1, sinceStart / 400);
    const elastic = entranceT < 1
        ? 1 - Math.pow(1 - entranceT, 3) * Math.cos(entranceT * Math.PI * 2)
        : 1;
    const entranceScale = 0.3 + 0.7 * Math.min(1, elastic);
    const entranceAlpha = Math.min(1, sinceStart / 200);

    const pulse = (Math.sin(now / 100) + 1) * 0.5;
    const scale = entranceScale * (1 + pulse * 0.1);

    ctx.save();
    ctx.translate(w / 2, yPos);
    ctx.scale(scale, scale);
    ctx.globalAlpha = entranceAlpha;

    ctx.shadowColor = primary;
    ctx.shadowBlur = 12 + pulse * 8;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    ctx.font = 'bold 26px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 4;
    ctx.strokeText('FEVER!', 0, 0);

    const hue = (now / 5) % 60;
    ctx.fillStyle = `hsl(${hue}, 100%, 55%)`;
    ctx.fillText('FEVER!', 0, 0);

    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.restore();
}

// Choreo name display - shows current crowd choreography to user
function drawChoreoText(ctx, w, h, now, choreo, yPos) {
    // Don't show for default choreo
    if (choreo.name === 'default') return;

    const primary = state.cachedColors?.primary || '#006633';

    // Entrance animation when choreo changes
    const sinceStart = now - state.choreoStartTime;
    const entranceT = Math.min(1, sinceStart / 300);
    const elastic = entranceT < 1
        ? 1 - Math.pow(1 - entranceT, 3) * Math.cos(entranceT * Math.PI * 1.5)
        : 1;
    const entranceScale = 0.5 + 0.5 * Math.min(1, elastic);
    const entranceAlpha = Math.min(1, sinceStart / 200);

    // Subtle pulse
    const pulse = (Math.sin(now / 300) + 1) * 0.5;
    const scale = entranceScale * (1 + pulse * 0.05);

    ctx.save();
    ctx.translate(w / 2, yPos);
    ctx.scale(scale, scale);
    ctx.globalAlpha = entranceAlpha * 0.9;

    // Glow effect
    ctx.shadowColor = primary;
    ctx.shadowBlur = 6 + pulse * 4;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Format choreo name nicely
    const displayName = choreo.name.replace(/([A-Z])/g, ' $1').trim().toUpperCase();

    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.strokeText(displayName, 0, 0);

    // Use team primary color
    ctx.fillStyle = primary;
    ctx.fillText(displayName, 0, 0);

    // Reset
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.restore();
}

function drawFlag(ctx, s, jumpOffset, now) {
    const px = s.px;
    const baseX = Math.floor(s.x);
    const y = Math.floor(s.baseY + jumpOffset);

    // Use cached colors for performance (set in updateCrowdClub)
    const primary = state.cachedColors?.primary || '#006633';
    const secondary = state.cachedColors?.secondary || '#FFFFFF';

    const scale = s.flagScale || 1;

    // Get swing motion from shared helper
    const { swingX, swingY, poleAngle, t, swingSpeed } = getFlagSwing(s, now);

    const x = Math.floor(baseX + swingX);

    // Pole starts from the supporter's raised hand
    const handX = (s.flagHand === 'left') ? x + px : x + 8 * px;
    const handY = y + 3 * px + swingY;

    // Longer pole for bigger flags
    const poleLen = Math.floor((12 + scale * 8) * px);

    // Draw pole with angle (as a line of rectangles for pixel effect)
    const poleW = scale >= 2.5 ? 2 * px : px;
    ctx.fillStyle = '#888888';

    const poleSteps = Math.floor(poleLen / px);
    for (let i = 0; i < poleSteps; i++) {
        const progress = i / poleSteps;
        const segX = handX + Math.sin(poleAngle) * poleLen * progress;
        const segY = handY - Math.cos(poleAngle) * poleLen * progress;
        ctx.fillRect(Math.floor(segX), Math.floor(segY), poleW, px + 1);
    }

    // Calculate pole tip position
    const poleTipX = handX + Math.sin(poleAngle) * poleLen;
    const poleTipY = handY - Math.cos(poleAngle) * poleLen;

    // Flag fabric scales with flagScale
    const flagW = Math.floor((6 + scale * 5) * px);
    const flagH = Math.floor((4 + scale * 3) * px);

    // Fabric wave - ripples along the flag
    const waveSpeed = 180 + scale * 60;
    const wavePhase = now / waveSpeed + s.jumpPhase;
    const baseWaveAmp = 2 + scale * 1.5;
    const swingVelocity = Math.abs(Math.cos(t * 2.5)) * swingSpeed;
    const waveAmp = baseWaveAmp + swingVelocity * 2;

    // Flag attaches along the pole from tip downward
    // Draw as vertical columns, each column attached at a point on the pole
    const numCols = Math.ceil(flagW / px);

    for (let col = 0; col < numCols; col++) {
        const colT = col / numCols;  // 0 at pole, 1 at free edge

        // Attachment point: first column at pole tip, slides down pole for visual connection
        // But for simplicity, attach entire left edge at pole tip level
        const attachX = poleTipX + poleW + col * px;

        // Wave increases toward free edge (right side)
        const wave = Math.sin(wavePhase + colT * 4) * (waveAmp * colT * 2);

        // The flag follows the pole tilt - more at attached edge, less at free edge
        const tiltFollow = poleAngle * (1 - colT * 0.7);
        const tiltOffsetY = -Math.sin(tiltFollow) * col * px * 0.3;

        const sliceX = Math.floor(attachX);
        const sliceY = Math.floor(poleTipY + wave + tiltOffsetY);

        // Draw main flag color as solid rectangle for this column
        ctx.fillStyle = s.flagColor;
        ctx.fillRect(sliceX, sliceY, px + 1, flagH);  // +1 to prevent gaps

        // Draw stripe if flag has one (middle horizontal band)
        if (s.flagStripe) {
            const stripeColor = s.flagColor === primary ? secondary : primary;
            ctx.fillStyle = stripeColor;
            const stripeY = Math.floor(flagH * 0.4);
            const stripeH = Math.max(px, Math.floor(flagH * 0.25));
            ctx.fillRect(sliceX, sliceY + stripeY, px + 1, stripeH);
        }
    }
}

function drawFlare(ctx, s, jumpOffset, now) {
    const px = s.px;
    const baseX = Math.floor(s.x);
    const rockX = Math.sin(now / 120 + s.jumpPhase) * 3;
    const x = Math.floor(baseX + rockX);
    const y = Math.floor(s.baseY + jumpOffset);

    const handX = s.flareHand === 'left' ? x - px : x + 9 * px;
    const flareY = y - 2 * px;

    ctx.fillStyle = '#333333';
    ctx.fillRect(handX, flareY, 2 * px, 5 * px);
    ctx.fillStyle = '#555555';
    ctx.fillRect(handX, flareY + 5 * px, 2 * px, px);

    const flicker = Math.sin(now / 30 + s.jumpPhase * 7) * 0.3;
    const flameH = 3 + Math.floor(Math.abs(Math.sin(now / 50 + s.jumpPhase)) * 3);

    ctx.fillStyle = s.flareColor;
    ctx.globalAlpha = 0.2 + flicker * 0.1;
    ctx.fillRect(handX - 3 * px, flareY - (flameH + 2) * px, 8 * px, (flameH + 3) * px);
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(handX, flareY - flameH * px, 2 * px, flameH * px);
    ctx.fillStyle = s.flareColor;
    ctx.fillRect(handX - px, flareY - (flameH - 1) * px, 4 * px, (flameH - 1) * px);

    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.6 + flicker * 0.3;
    ctx.fillRect(handX, flareY - flameH * px, 2 * px, px);
    ctx.globalAlpha = 1;

    const sparkCount = 3;
    for (let i = 0; i < sparkCount; i++) {
        const sparkPhase = now / 80 + s.jumpPhase + i * 2.1;
        const sparkX = handX + Math.sin(sparkPhase) * 3 * px + px;
        const sparkProgress = ((now / 300 + i * 0.33 + s.jumpPhase) % 1);
        const sparkY = flareY - flameH * px + sparkProgress * 10 * px;
        const sparkAlpha = 1 - sparkProgress;
        if (sparkAlpha > 0) {
            ctx.fillStyle = s.flareColor;
            ctx.globalAlpha = sparkAlpha * 0.8;
            ctx.fillRect(Math.floor(sparkX), Math.floor(sparkY), px, px);
            ctx.globalAlpha = 1;
        }
    }
}

function spawnSmoke(s, jumpOffset, now) {
    const px = s.px;
    const baseX = Math.floor(s.x);
    const rockX = Math.sin(now / 120 + s.jumpPhase) * 3;
    const x = Math.floor(baseX + rockX);
    const y = Math.floor(s.baseY + jumpOffset);

    const handX = s.flareHand === 'left' ? x - px : x + 9 * px;
    const flareY = y - 2 * px;

    // Skip smoke if reduced effects is enabled
    if (_frameCache.reducedEffects) return;

    let smokeR = 180, smokeG = 180, smokeB = 180;
    if (s.flareColor === '#00ff44') { smokeR = 100; smokeG = 200; smokeB = 100; }
    else if (s.flareColor === '#ff2200' || s.flareColor === '#ff4400') { smokeR = 200; smokeG = 160; smokeB = 150; }

    // Smoke density scaling based on combo (#8) - enhanced with intensity multiplier
    const combo = state.playerCombo;
    const multiplier = getComboMultiplier();
    const intensityMult = getSmokeIntensityMultiplier();

    // Dynamic max particles based on combo (scales with intensity)
    const baseMax = 250;
    const maxParticles = Math.floor(baseMax * intensityMult);
    if (state.smokeParticles.length > maxParticles) return;

    // Spawn probability scales with combo (30% base, up to 90% at max intensity)
    const spawnChance = 0.3 + Math.min(0.6, (intensityMult - 1) * 0.3);
    if (Math.random() > spawnChance) return;

    // Bigger, more intense smoke at higher combos
    const sizeBonus = Math.min(10, (intensityMult - 1) * 5);
    const spreadBonus = Math.min(6, (intensityMult - 1) * 3);

    // Slower decay at high intensity = longer lasting smoke
    const decayReduction = Math.max(0.5, 1.0 - (intensityMult - 1) * 0.15);

    state.smokeParticles.push({
        x: handX + px + (Math.random() - 0.5) * (6 + spreadBonus) * px,
        y: flareY - 6 * px,
        vx: (Math.random() - 0.5) * (1.0 + spreadBonus * 0.3),
        vy: -(0.3 + Math.random() * (0.7 + intensityMult * 0.15)),
        life: 1,
        decay: (0.002 + Math.random() * 0.003) * decayReduction,
        size: 6 + sizeBonus + Math.random() * (8 + sizeBonus),
        r: smokeR, g: smokeG, b: smokeB
    });
}

// Draw tifo logo overlay (large badge displayed by the crowd)
function drawTifoOverlay(ctx, w, h, now) {
    if (!state.tifoImage || !state.tifoReady) return;

    const img = state.tifoImage;
    const layout = state.stadiumLayout;
    const edgeMargin = layout?.edgeMargin || 30;

    // Calculate logo size - make it prominent
    // Make badge prominent - use most of the height
    const maxH = h * 0.9;
    const minW = w * 0.25;  // Minimum width for narrow badges

    const imgW = img.naturalWidth || img.width || 100;
    const imgH = img.naturalHeight || img.height || 100;
    const imgAspect = imgW / imgH;

    // Scale to fit height first
    let drawH = maxH;
    let drawW = maxH * imgAspect;

    // Ensure minimum width for narrow badges
    if (drawW < minW) {
        drawW = minW;
        drawH = minW / imgAspect;
    }

    // Don't exceed canvas width
    const maxW = w * 0.7;
    if (drawW > maxW) {
        drawW = maxW;
        drawH = maxW / imgAspect;
    }

    const x = (w - drawW) / 2;
    const y = (h - drawH) / 2;

    // Pulsing effect synced with beat
    const timeSinceBeat = (now - state.crowdBeatTime) / 1000;
    const beatPulse = Math.max(0, 1 - timeSinceBeat * 3);
    const scale = 1 + beatPulse * 0.05;

    // Draw with transparency so supporters show through
    ctx.globalAlpha = 0.5 + beatPulse * 0.15;

    // Add glow effect only if reduced effects is off (shadows are expensive)
    if (!_frameCache.reducedEffects) {
        ctx.save();
        ctx.translate(w / 2, h / 2);
        ctx.scale(scale, scale);
        ctx.translate(-w / 2, -h / 2);
        ctx.shadowColor = state.cachedColors?.primary || '#ffffff';
        ctx.shadowBlur = 25 + beatPulse * 15;
        ctx.drawImage(img, x, y, drawW, drawH);
        ctx.shadowBlur = 0;
        ctx.restore();
    } else {
        // Simple draw without transforms/shadows
        ctx.drawImage(img, x, y, drawW, drawH);
    }

    ctx.globalAlpha = 1;
}

// Draw inferno overlay - fire/heat effect for maximum intensity choreo
function drawInfernoOverlay(ctx, w, h, now) {
    // Smooth pulsing synced with beat (slower decay for less flicker)
    const timeSinceBeat = (now - state.crowdBeatTime) / 1000;
    const beatPulse = Math.max(0, 1 - timeSinceBeat * 1.5);

    // Smooth continuous glow pulse (independent of beat for stability)
    const glowPulse = (Math.sin(now / 400) + 1) * 0.5;

    // Simple fire gradient from bottom - no per-frame alpha changes in gradient
    ctx.globalAlpha = 0.3 + beatPulse * 0.15 + glowPulse * 0.05;
    const fireGrad = ctx.createLinearGradient(0, h, 0, h * 0.2);
    fireGrad.addColorStop(0, '#ff3300');
    fireGrad.addColorStop(0.4, '#ff6600');
    fireGrad.addColorStop(0.7, '#ff9900');
    fireGrad.addColorStop(1, 'rgba(255, 150, 0, 0)');
    ctx.fillStyle = fireGrad;
    ctx.fillRect(0, h * 0.2, w, h * 0.8);
    ctx.globalAlpha = 1;

    // Simple edge vignette (static, no animation)
    const edgeGrad = ctx.createRadialGradient(w / 2, h / 2, h * 0.4, w / 2, h / 2, w * 0.7);
    edgeGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    edgeGrad.addColorStop(1, 'rgba(255, 50, 0, 0.12)');
    ctx.fillStyle = edgeGrad;
    ctx.fillRect(0, 0, w, h);

    // Top glow bar (smooth pulse)
    ctx.globalAlpha = 0.15 + beatPulse * 0.2;
    const topGrad = ctx.createLinearGradient(0, 0, 0, h * 0.25);
    topGrad.addColorStop(0, '#ff4400');
    topGrad.addColorStop(1, 'rgba(255, 68, 0, 0)');
    ctx.fillStyle = topGrad;
    ctx.fillRect(0, 0, w, h * 0.25);
    ctx.globalAlpha = 1;

    // "INFERNO" text - only on strong beats, simple animation
    if (beatPulse > 0.6) {
        const textAlpha = (beatPulse - 0.6) * 2.5; // 0 to 1 as beatPulse goes 0.6 to 1

        ctx.save();
        ctx.globalAlpha = textAlpha;
        ctx.font = 'bold 28px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Simple glow without heavy shadow
        if (!_frameCache.reducedEffects) {
            ctx.shadowColor = '#ff4400';
            ctx.shadowBlur = 15;
        }

        ctx.fillStyle = '#ffcc00';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.strokeText('INFERNO', w / 2, h * 0.12);
        ctx.fillText('INFERNO', w / 2, h * 0.12);

        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
        ctx.restore();
    }
}

// Draw pyro overlay - smoke effect using team colors
function drawPyroOverlay(ctx, w, h, now) {
    const timeSinceBeat = (now - state.crowdBeatTime) / 1000;
    const beatPulse = Math.max(0, 1 - timeSinceBeat * 2);
    const primary = _frameCache.primaryColor || '#ff4400';
    const secondary = _frameCache.secondaryColor || '#ffffff';

    // Team-colored smoke effect from bottom
    ctx.globalAlpha = 0.25 + beatPulse * 0.15;
    const smokeGrad = ctx.createLinearGradient(0, h, 0, h * 0.5);
    smokeGrad.addColorStop(0, primary);
    smokeGrad.addColorStop(0.3, hexToRgbaCached(primary, 0.8));
    smokeGrad.addColorStop(0.6, hexToRgbaCached(primary, 0.3));
    smokeGrad.addColorStop(1, hexToRgbaCached(primary, 0));
    ctx.fillStyle = smokeGrad;
    ctx.fillRect(0, h * 0.5, w, h * 0.5);
    ctx.globalAlpha = 1;

    // Edge glow with team color
    const edgeGrad = ctx.createRadialGradient(w / 2, h * 0.8, 0, w / 2, h * 0.8, w * 0.6);
    edgeGrad.addColorStop(0, hexToRgbaCached(primary, 0.2));
    edgeGrad.addColorStop(1, hexToRgbaCached(primary, 0));
    ctx.fillStyle = edgeGrad;
    ctx.fillRect(0, 0, w, h);

    // "PYRO" text on strong beats - uses team colors
    if (beatPulse > 0.5) {
        const textAlpha = (beatPulse - 0.5) * 2;
        ctx.save();
        ctx.globalAlpha = textAlpha * 0.8;
        ctx.font = 'bold 24px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (!_frameCache.reducedEffects) {
            ctx.shadowColor = primary;
            ctx.shadowBlur = 12;
        }
        ctx.fillStyle = secondary;
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.strokeText('PYRO', w / 2, h * 0.1);
        ctx.fillText('PYRO', w / 2, h * 0.1);
        ctx.shadowBlur = 0;
        ctx.restore();
    }
}

// Draw ultras overlay - dramatic banner/flag effect
function drawUltrasOverlay(ctx, w, h, now) {
    const timeSinceBeat = (now - state.crowdBeatTime) / 1000;
    const beatPulse = Math.max(0, 1 - timeSinceBeat * 2);
    const primary = _frameCache.primaryColor || '#006633';
    const secondary = _frameCache.secondaryColor || '#ffffff';

    // Vertical stripe effect at top
    ctx.globalAlpha = 0.15 + beatPulse * 0.1;
    const stripeW = w / 20;
    for (let i = 0; i < 20; i++) {
        ctx.fillStyle = i % 2 === 0 ? primary : secondary;
        ctx.fillRect(i * stripeW, 0, stripeW, h * 0.1);
    }
    ctx.globalAlpha = 1;

    // Glow from behind crowd
    ctx.globalAlpha = 0.2 + beatPulse * 0.15;
    const glowGrad = ctx.createLinearGradient(0, h * 0.7, 0, h);
    glowGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
    glowGrad.addColorStop(1, primary);
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, h * 0.7, w, h * 0.3);
    ctx.globalAlpha = 1;

    // "ULTRAS" text on strong beats
    if (beatPulse > 0.6) {
        const textAlpha = (beatPulse - 0.6) * 2.5;
        ctx.save();
        ctx.globalAlpha = textAlpha;
        ctx.font = 'bold 26px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (!_frameCache.reducedEffects) {
            ctx.shadowColor = primary;
            ctx.shadowBlur = 15;
        }
        ctx.fillStyle = secondary;
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.strokeText('ULTRAS', w / 2, h * 0.12);
        ctx.fillText('ULTRAS', w / 2, h * 0.12);
        ctx.shadowBlur = 0;
        ctx.restore();
    }
}

// Spotlight overlay - sparkle/star effect for phone flashlight display
function drawSpotlightOverlay(ctx, w, h, now) {
    if (_frameCache.reducedEffects) return;

    const timeSinceBeat = (now - state.crowdBeatTime) / 1000;
    const beatPulse = Math.max(0, 1 - timeSinceBeat * 2);
    const primary = _frameCache.primaryColor || '#006633';

    // Random sparkle points
    const sparkleCount = 15 + Math.floor(beatPulse * 10);
    ctx.save();

    for (let i = 0; i < sparkleCount; i++) {
        // Use deterministic positions based on index but change with time
        const seed = (i * 127 + Math.floor(now / 500)) % 1000;
        const sparkleX = (seed * 1.234) % w;
        const sparkleY = (seed * 0.567 + i * 23) % (h * 0.6);
        const phase = Math.sin(now / 200 + i * 0.5);
        const alpha = (phase + 1) * 0.25 + beatPulse * 0.2;

        if (alpha > 0.1) {
            // Star shape
            ctx.fillStyle = `rgba(255, 255, 220, ${alpha})`;
            const size = 2 + beatPulse * 2;

            // Draw simple 4-point star
            ctx.beginPath();
            ctx.moveTo(sparkleX, sparkleY - size);
            ctx.lineTo(sparkleX + size / 3, sparkleY);
            ctx.lineTo(sparkleX + size, sparkleY);
            ctx.lineTo(sparkleX + size / 3, sparkleY + size / 3);
            ctx.lineTo(sparkleX, sparkleY + size);
            ctx.lineTo(sparkleX - size / 3, sparkleY + size / 3);
            ctx.lineTo(sparkleX - size, sparkleY);
            ctx.lineTo(sparkleX - size / 3, sparkleY);
            ctx.closePath();
            ctx.fill();
        }
    }

    // Subtle phone glow from crowd area
    ctx.globalAlpha = 0.1 + beatPulse * 0.1;
    const glowGrad = ctx.createLinearGradient(0, h * 0.5, 0, h);
    glowGrad.addColorStop(0, 'rgba(255, 255, 200, 0.3)');
    glowGrad.addColorStop(1, 'rgba(255, 255, 200, 0)');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, h * 0.5, w, h * 0.5);

    ctx.restore();
}

// Anthem overlay - solemn pride glow with team colors
function drawAnthemOverlay(ctx, w, h, now) {
    const primary = _frameCache.primaryColor || '#006633';
    const secondary = _frameCache.secondaryColor || '#ffffff';

    // Subtle radial gradient from center
    ctx.save();

    const centerX = w / 2;
    const centerY = h / 2;
    const maxRadius = Math.max(w, h) * 0.6;

    // Pulsing radial glow
    const pulsePhase = (Math.sin(now / 2000) + 1) * 0.5;
    const glowAlpha = 0.08 + pulsePhase * 0.04;

    ctx.globalAlpha = glowAlpha;
    const radialGrad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, maxRadius);
    radialGrad.addColorStop(0, primary);
    radialGrad.addColorStop(0.4, primary);
    radialGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = radialGrad;
    ctx.fillRect(0, 0, w, h);

    // Top banner with team colors (subtle)
    if (!_frameCache.reducedEffects) {
        ctx.globalAlpha = 0.15;
        const bannerGrad = ctx.createLinearGradient(0, 0, w, 0);
        bannerGrad.addColorStop(0, primary);
        bannerGrad.addColorStop(0.5, secondary);
        bannerGrad.addColorStop(1, primary);
        ctx.fillStyle = bannerGrad;
        ctx.fillRect(0, 0, w, h * 0.05);
    }

    ctx.restore();
}

// Pre-allocated rgba string buffer to avoid string creation in hot loop
const _rgbaBuffer = { str: '' };
function rgbaFast(r, g, b, a) {
    return `rgba(${r},${g},${b},${a.toFixed(2)})`;
}

function updateAndDrawSmoke(ctx, w, h) {
    const particles = state.smokeParticles;
    let len = particles.length;

    // Process in batches and remove dead particles
    for (let i = len - 1; i >= 0; i--) {
        const p = particles[i];

        // Update physics (simplified - removed sin for performance)
        p.x += p.vx;
        p.y += p.vy;
        p.vy *= 0.995;
        p.vx += (Math.random() - 0.5) * 0.08;
        p.life -= p.decay;
        p.size += 0.12;

        // Remove dead or off-screen particles (expanded bounds check)
        if (p.life <= 0 || p.y < -50 || p.x < -50 || p.x > w + 50) {
            // Swap and pop (fast removal)
            particles[i] = particles[--len];
            continue;
        }

        // Skip drawing if above visible area (but keep updating physics)
        if (p.y < -20) continue;

        // Draw
        const alpha = p.life * 0.5;
        const sz = (p.size + 0.5) | 0;  // Fast floor
        const px = (p.x - sz * 0.5) | 0;
        const py = (p.y - sz * 0.5) | 0;

        ctx.globalAlpha = alpha;
        ctx.fillStyle = `rgb(${p.r},${p.g},${p.b})`;
        ctx.fillRect(px, py, sz, sz);
    }

    // Trim array if needed
    particles.length = len;
    ctx.globalAlpha = 1;

    // Hard limit
    if (len > 250) {
        particles.length = 250;
    }
}

// ============================================
// Weather Effects System
// ============================================

// Rain particle colors (bluish-gray shades)
const RAIN_COLORS = ['#aabbcc', '#99aacc', '#88aadd', '#7799cc'];

// Confetti colors (bright celebration colors)
const CONFETTI_COLORS = ['#ff3366', '#ffcc00', '#00ff88', '#ff6600', '#44aaff', '#ff44aa', '#88ff00', '#ffffff'];

/**
 * Spawns rain particles for deject/losing atmosphere
 * @param {number} w - Canvas width
 * @param {number} h - Canvas height
 */
function spawnRainParticles(w, h) {
    // Skip if reduced effects is enabled
    if (_frameCache.reducedEffects) return;

    const particles = state.rainParticles;
    const maxParticles = 150;

    if (particles.length >= maxParticles) return;

    // Spawn 2-4 drops per frame
    const spawnCount = 2 + Math.floor(Math.random() * 3);

    for (let i = 0; i < spawnCount && particles.length < maxParticles; i++) {
        particles.push({
            x: Math.random() * (w + 100) - 50,  // Start slightly off-screen
            y: -10 - Math.random() * 50,         // Start above screen
            vx: -1 - Math.random() * 2,          // Slight wind effect
            vy: 8 + Math.random() * 6,           // Fall speed
            length: 10 + Math.random() * 15,     // Streak length
            alpha: 0.3 + Math.random() * 0.4,
            color: RAIN_COLORS[Math.floor(Math.random() * RAIN_COLORS.length)]
        });
    }
}

/**
 * Updates and draws rain particles
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} w - Canvas width
 * @param {number} h - Canvas height
 */
function updateAndDrawRain(ctx, w, h) {
    const particles = state.rainParticles;
    let len = particles.length;

    ctx.lineWidth = 1;
    ctx.lineCap = 'round';

    for (let i = len - 1; i >= 0; i--) {
        const p = particles[i];

        // Update position
        p.x += p.vx;
        p.y += p.vy;

        // Remove if off-screen
        if (p.y > h + 20 || p.x < -50) {
            particles[i] = particles[--len];
            continue;
        }

        // Draw rain streak
        ctx.globalAlpha = p.alpha;
        ctx.strokeStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + p.vx * 2, p.y - p.length);
        ctx.stroke();
    }

    particles.length = len;
    ctx.globalAlpha = 1;
}

/**
 * Spawns a confetti burst for victory celebration
 * @param {number} w - Canvas width
 * @param {number} h - Canvas height
 * @param {number} count - Number of confetti pieces to spawn
 */
function spawnConfettiBurst(w, h, count) {
    // Skip if reduced effects is enabled
    if (_frameCache.reducedEffects) return;

    const particles = state.confettiParticles;
    const primaryColor = state.cachedColors?.primary || '#ffcc00';

    // Include club primary color in confetti
    const colors = [primaryColor, ...CONFETTI_COLORS];

    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 3 + Math.random() * 5;
        const startX = w * (0.3 + Math.random() * 0.4);  // Spawn in middle area
        const startY = h * (0.4 + Math.random() * 0.3);

        particles.push({
            x: startX,
            y: startY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 3,  // Bias upward initially
            rotation: Math.random() * Math.PI * 2,
            rotSpeed: (Math.random() - 0.5) * 0.3,
            size: 4 + Math.random() * 6,
            color: colors[Math.floor(Math.random() * colors.length)],
            life: 1,
            decay: 0.005 + Math.random() * 0.005,
            shape: Math.random() > 0.5 ? 'rect' : 'circle'
        });
    }
}

/**
 * Updates and draws confetti particles
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} w - Canvas width
 * @param {number} h - Canvas height
 */
function updateAndDrawConfetti(ctx, w, h) {
    const particles = state.confettiParticles;
    let len = particles.length;

    for (let i = len - 1; i >= 0; i--) {
        const p = particles[i];

        // Update physics
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15;  // Gravity
        p.vx *= 0.99;  // Air resistance
        p.rotation += p.rotSpeed;
        p.life -= p.decay;

        // Flutter effect
        p.vx += (Math.random() - 0.5) * 0.3;

        // Remove dead particles
        if (p.life <= 0 || p.y > h + 20) {
            particles[i] = particles[--len];
            continue;
        }

        // Draw confetti
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);

        if (p.shape === 'rect') {
            ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        } else {
            ctx.beginPath();
            ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }

    particles.length = len;
    ctx.globalAlpha = 1;

    // Hard limit
    if (len > 300) {
        particles.length = 300;
    }
}

/**
 * Gets smoke intensity multiplier based on combo
 * @returns {number} Multiplier for smoke effects (1.0 - 3.0)
 */
function getSmokeIntensityMultiplier() {
    const combo = state.playerCombo || 0;
    const multiplier = getComboMultiplier();

    // Base intensity scales from 1.0 to 3.0 based on combo
    if (combo >= 50) return 3.0;
    if (combo >= 30) return 2.5;
    if (combo >= 20) return 2.0;
    if (combo >= 10) return 1.5;
    if (combo >= 5) return 1.2;
    return 1.0;
}

/**
 * Updates weather intensity for smooth transitions
 * @param {string} emotion - Current crowd emotion
 */
function updateWeatherIntensity(emotion) {
    const targetIntensity = emotion === 'deject' ? 1.0 : emotion === 'celebrate' ? 1.0 : 0;

    // Smooth transition
    const transitionSpeed = 0.02;
    if (state.weatherIntensity < targetIntensity) {
        state.weatherIntensity = Math.min(targetIntensity, state.weatherIntensity + transitionSpeed);
    } else if (state.weatherIntensity > targetIntensity) {
        state.weatherIntensity = Math.max(targetIntensity, state.weatherIntensity - transitionSpeed);
    }
}

// Track confetti burst timing to avoid spamming
let _lastConfettiBurst = 0;

/**
 * Main weather effects update and draw function
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} w - Canvas width
 * @param {number} h - Canvas height
 * @param {string} emotion - Current crowd emotion
 */
function updateAndDrawWeatherEffects(ctx, w, h, emotion) {
    // Skip all weather effects if reduced effects is enabled
    if (_frameCache.reducedEffects) {
        // Still clear particles if they exist
        if (state.rainParticles.length > 0) state.rainParticles.length = 0;
        if (state.confettiParticles.length > 0) state.confettiParticles.length = 0;
        return;
    }

    updateWeatherIntensity(emotion);

    const now = performance.now();

    // Rain for deject/losing state
    if (emotion === 'deject') {
        spawnRainParticles(w, h);
    }

    // Draw rain if particles exist
    if (state.rainParticles.length > 0) {
        updateAndDrawRain(ctx, w, h);
    }

    // Confetti burst for celebration (initial burst + periodic smaller bursts)
    if (emotion === 'celebrate') {
        if (now - _lastConfettiBurst > 2000) {  // Burst every 2 seconds
            const burstSize = _lastConfettiBurst === 0 ? 50 : 15;  // Big initial burst
            spawnConfettiBurst(w, h, burstSize);
            _lastConfettiBurst = now;
        }
    } else {
        _lastConfettiBurst = 0;  // Reset for next celebration
    }

    // Draw confetti if particles exist
    if (state.confettiParticles.length > 0) {
        updateAndDrawConfetti(ctx, w, h);
    }
}

export function drawGameVisuals() {
    if (!state.crowdBgCtx) return;

    const canvas = state.crowdBgCanvas;
    const w = canvas.width;
    const h = canvas.height;
    const ctx = state.crowdBgCtx;
    const now = performance.now();

    // Performance: Update frame-level caches once at frame start
    updateFrameCache(now);
    advanceGradientFrame();

    const multiplier = _frameCache.comboMultiplier;

    // Determine frenzy state based on crowdEmotion for visuals
    const currentFrenzy = _frameCache.isFrenzy;
    const choreo = getChoreoConfig(state.playerCombo);

    // Track choreo transitions for reveal animations (#10)
    if (choreo.id !== state.lastChoreoId) {
        state.lastChoreoId = choreo.id;
        state.choreoStartTime = now;
    }
    const choreoAge = now - state.choreoStartTime;  // ms since choreo started

    if (state.supporters.length === 0) {
        initSupporters(w, h, false); // Explicitly pass false for game visuals
    }

    ctx.clearRect(0, 0, w, h);

    // Apply screen shake transform (affects all drawing)
    const shakeOffset = applyScreenShake(now);
    ctx.save();
    ctx.translate(shakeOffset.x, shakeOffset.y);

    // Sky / stadium background gradient (use cached for static states)
    const emotion = _frameCache.crowdEmotion;
    const reducedEffects = _frameCache.reducedEffects;

    if (emotion === 'deject') {
        const grad = getCachedGradient(ctx, 'linear', `sky_deject_${h}`, () => {
            const g = ctx.createLinearGradient(0, 0, 0, h);
            g.addColorStop(0, '#0f0f1a');
            g.addColorStop(0.6, '#1a1a30');
            g.addColorStop(1, '#252540');
            return g;
        });
        ctx.fillStyle = grad;
    } else if (currentFrenzy && !reducedEffects) {
        // Frenzy gradient changes each frame, create new
        const frenzyPulse = (Math.sin(now / 300) + 1) * 0.5;
        const r = Math.floor(25 + frenzyPulse * 15);
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, `rgb(${r}, 5, 8)`);
        grad.addColorStop(0.6, `rgb(${r + 10}, 8, 15)`);
        grad.addColorStop(1, '#1a0a0e');
        ctx.fillStyle = grad;
    } else {
        const grad = getCachedGradient(ctx, 'linear', `sky_normal_${h}`, () => {
            const g = ctx.createLinearGradient(0, 0, 0, h);
            g.addColorStop(0, '#0a0a1a');
            g.addColorStop(0.6, '#111128');
            g.addColorStop(1, '#1a1a2e');
            return g;
        });
        ctx.fillStyle = grad;
    }
    ctx.fillRect(0, 0, w, h);

    // Stadium floodlight gradient overlay (#5)
    if (!_frameCache.reducedEffects) {
        const lightGrad = ctx.createLinearGradient(0, 0, 0, h);
        const lightIntensity = currentFrenzy ? 0.06 : 0.03;
        lightGrad.addColorStop(0, `rgba(255, 255, 220, ${lightIntensity})`);
        lightGrad.addColorStop(0.3, `rgba(255, 255, 200, ${lightIntensity * 0.5})`);
        lightGrad.addColorStop(0.6, 'rgba(255, 255, 180, 0)');
        lightGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = lightGrad;
        ctx.fillRect(0, 0, w, h);

        // Add subtle horizontal light beams during frenzy
        if (currentFrenzy) {
            const beamPhase = (now / 2000) % 1;
            ctx.fillStyle = `rgba(255, 255, 255, ${0.02 + Math.sin(beamPhase * Math.PI * 2) * 0.01})`;
            ctx.fillRect(0, h * 0.05, w, 2);
            ctx.fillRect(0, h * 0.15, w, 1);
        }
    }

    // Draw atmospheric haze/smoke layer (behind everything)
    drawAtmosphereHaze(ctx, w, h, now, currentFrenzy);

    // Draw stadium roof silhouette at top
    drawStadiumRoof(ctx, w, h);

    // Draw stadium speakers
    drawStadiumSpeakers(ctx, w, h);

    // Draw scoreboard
    drawScoreboard(ctx, w, h, now);

    // Draw floodlights
    drawFloodlights(ctx, w, h, now, currentFrenzy);

    // Cache colors locally to avoid repeated state access (with fallback to selected club)
    const primaryColor = state.cachedColors?.primary || state.selectedClub?.colors?.primary || '#006633';
    const secondaryColor = state.cachedColors?.secondary || state.selectedClub?.colors?.secondary || '#FFFFFF';

    // Draw club banners
    drawClubBanners(ctx, w, h, now, primaryColor, secondaryColor);

    // Draw stadium bleachers (tiered concrete steps behind crowd)
    drawStadiumBleachers(ctx, w, h);

    // Draw stadium barriers (edges, aisles, railings)
    drawStadiumBarriers(ctx, w, h);

    // Draw goal posts silhouette in distance
    drawGoalPosts(ctx, w, h);

    // Draw pitch edge at bottom
    drawPitchEdge(ctx, w, h);

    // Draw corner flags
    drawCornerFlags(ctx, w, h, now);

    // Draw advertising boards at bottom
    drawAdBoards(ctx, w, h, now, primaryColor);

    // Stadium railing accent
    if (state.crowdEmotion === 'deject') {
        ctx.fillStyle = 'rgba(100,100,100,0.08)';
    } else {
        ctx.fillStyle = currentFrenzy ? 'rgba(255,100,0,0.12)' : 'rgba(255,255,255,0.08)';
    }
    ctx.fillRect(0, h * 0.1, w, 3);

    // Beat-synced animation
    const timeSinceBeat = (now - state.crowdBeatTime) / 1000;
    const beatDecay = Math.max(0, 1 - timeSinceBeat * 4);

    // Pre-calculate common trig values for choreo system
    const sinNow150 = Math.sin(now / 150);
    const preCalc = {
        sinSway: Math.sin(now / (choreo.swaySpeed || 200)),
        sinWaveBase: now / 250,
        timeSinceBeat: timeSinceBeat
    };

    let frenzyBounce = 0;
    let sway = Math.sin(now / 400) * 2;

    if (state.crowdEmotion === 'deject') {
        sway = Math.sin(now / 800) * 1;
    } else {
        frenzyBounce = currentFrenzy ? Math.abs(sinNow150) * (4 + multiplier * 2) : 0;
    }

    // Pre-calculate sway addition
    const swayAddition = (beatDecay < 0.01 && !currentFrenzy && state.crowdEmotion !== 'deject') ? sway * 0.5 : 0;
    const showFlags = currentFrenzy || state.crowdEmotion === 'celebrate';

    // Single pass: draw supporters, collect flag/flare data
    supporterBatch.clear();
    resetFlagFlareQueue();

    const supporters = state.supporters;
    const supporterLen = supporters.length;

    for (let i = 0; i < supporterLen; i++) {
        const s = supporters[i];

        let personalJump;
        if (state.crowdEmotion === 'deject') {
            personalJump = -s.jumpStrength * 2;
        } else {
            // Use choreo-based jump calculation
            personalJump = getChoreoJump(choreo, s, beatDecay, multiplier, now, preCalc);
        }
        const jumpY = -(personalJump + frenzyBounce + swayAddition);

        const armsUp = !currentFrenzy && timeSinceBeat < 0.3 && s.jumpStrength > 0.7;

        // Use cached sprites for simple supporters (#11)
        // Cached sprites work best for supporters without special accessories
        // TEMPORARILY DISABLED - using batched drawing for all supporters
        const useCache = false; // SPRITE_CACHE.ready && !s.hasFlag && !s.hasFlare && !s.hasHat &&
                         // state.crowdEmotion !== 'deject' && choreo.id < 3;

        if (useCache) {
            drawSupporterCached(ctx, s, jumpY, armsUp, currentFrenzy, now, choreo, null, primaryColor, secondaryColor, preCalc);
        } else {
            drawSupporter(ctx, s, jumpY, armsUp, currentFrenzy, now, choreo, supporterBatch, primaryColor, secondaryColor, preCalc);
        }

        // Queue flag/flare drawing (needs to be on top of all supporters)
        if ((showFlags && s.hasFlag) || s.hasFlare) {
            pushFlagFlare(s, jumpY);
        }
    }
    // Flush all batched supporter draws at once
    supporterBatch.flush(ctx);

    // Draw flags/flares on top (using pooled queue)
    for (let i = 0; i < _flagFlareCount; i++) {
        const item = _flagFlarePool[i];
        if (showFlags && item.s.hasFlag) {
            drawFlag(ctx, item.s, item.jumpY, now);
        }
        if (item.s.hasFlare) {
            drawFlare(ctx, item.s, item.jumpY, now);
            spawnSmoke(item.s, item.jumpY, now);
        }
    }

    // Draw choreo overlay (tifo badge, banners, etc.) on top of supporters
    drawChoreoOverlay(ctx, choreo, w, h, now);

    // Smoke particles on top of everything
    if (state.smokeParticles.length > 0) {
        updateAndDrawSmoke(ctx, w, h);
    }

    // Weather effects (rain for deject, confetti for celebrate)
    updateAndDrawWeatherEffects(ctx, w, h, emotion);

    // Beat flash overlay
    if (beatDecay > 0.01) {
        if (state.crowdEmotion === 'deject') {
            ctx.fillStyle = 'rgba(50,50,50,0.08)';
        } else {
            ctx.fillStyle = currentFrenzy ? '#ff4400' : primaryColor;
            ctx.globalAlpha = beatDecay * (currentFrenzy ? 0.15 : 0.08);
        }
        ctx.fillRect(0, 0, w, h);
        ctx.globalAlpha = 1;
    }

    // --- HUD text stack: FEVER -> Choreo -> Feedback -> Combo ---
    if (currentFrenzy && !state.wasFrenzy) {
        state.frenzyStartTime = now;
        state.wasFrenzy = true;
    } else if (!currentFrenzy && state.wasFrenzy) {
        state.wasFrenzy = false;
    }

    // Position HUD below the beat track canvas (use cached position to avoid layout thrashing)
    let hudY = state.hudPositionY || 22;

    // 1) FEVER! text (only for celebration/frenzy)
    if (currentFrenzy || state.crowdEmotion === 'celebrate') {
        drawFeverText(ctx, w, h, now, hudY);
        hudY += 30;
    }

    // 2) Choreo name (when not default)
    if (choreo.name !== 'default') {
        drawChoreoText(ctx, w, h, now, choreo, hudY);
        hudY += 22;
    }

    // 3) Feedback text
    if (state.feedbackAlpha > 0) {
        const elapsed = now - state.feedbackSpawnTime;
        const totalDuration = 800;
        const progress = Math.min(1, elapsed / totalDuration);

        let fbScale, floatY, drawAlpha;

        if (progress < 0.08) {
            const t = progress / 0.08;
            fbScale = 0.4 + t * 0.9;
            floatY = 0;
            drawAlpha = Math.min(1, t * 2);
        } else if (progress < 0.15) {
            const t = (progress - 0.08) / 0.07;
            fbScale = 1.3 - t * 0.3;
            floatY = 0;
            drawAlpha = 1;
        } else {
            fbScale = 1.0;
            const t2 = (progress - 0.15) / 0.85;
            floatY = -t2 * 20;
            drawAlpha = 1 - t2 * t2;
        }

        let shakeX = 0;
        if (state.feedbackText === 'MISS' && progress < 0.25) {
            const shakeT = progress / 0.25;
            shakeX = Math.sin(shakeT * Math.PI * 6) * 4 * (1 - shakeT);
        }

        const fontSize = state.feedbackText === 'PERFECT' ? 28 : (state.feedbackText === 'MISS' ? 20 : 24);

        ctx.save();
        ctx.translate(w / 2 + shakeX, hudY + floatY);
        ctx.scale(fbScale, fbScale);

        ctx.shadowColor = state.feedbackColor;
        ctx.shadowBlur = state.feedbackText === 'PERFECT' ? 12 : 6;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        ctx.globalAlpha = drawAlpha;
        ctx.font = `bold ${fontSize}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.strokeText(state.feedbackText, 0, 0);
        ctx.fillStyle = state.feedbackColor;
        ctx.fillText(state.feedbackText, 0, 0);

        // Reset shadow
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
        ctx.restore();

        state.feedbackAlpha = 1 - progress;
        if (state.feedbackAlpha <= 0) { state.feedbackAlpha = 0; state.feedbackText = ''; }

        hudY += 28;
    }

    // 3) Combo counter - shows from combo >= 3, grows progressively
    if (state.comboDisplayCount >= 3) {
        const combo = state.comboDisplayCount;
        const sinceBump = now - state.comboBumpTime;
        const bumpT = Math.min(1, sinceBump / 250);

        // Milestone detection: 10, 25, 50, 75, 100, and every 50 after
        const isMilestone = combo === 10 || combo === 25 || combo === 50 ||
                            combo === 75 || combo === 100 || (combo > 100 && combo % 50 === 0);

        // Smooth easing for milestone bump (ease-out cubic)
        const milestoneBumpScale = isMilestone && bumpT < 0.6
            ? 1 + 0.4 * Math.pow(1 - bumpT / 0.6, 3)
            : 1.0;

        // Regular bump with ease-out
        let comboScale = bumpT < 0.5
            ? 1 + 0.2 * Math.pow(1 - bumpT / 0.5, 2)
            : 1.0;
        comboScale *= milestoneBumpScale;

        // Subtle pulse - intensity scales with combo
        const pulseSpeed = Math.max(60, 140 - combo);
        const pulseAmount = Math.min(0.06, 0.02 + combo * 0.0005);
        const pulse = (Math.sin(now / pulseSpeed) + 1) * 0.5;
        comboScale *= 1 + pulse * pulseAmount;

        // Progressive font sizing with smoother transitions
        let fontSize;
        if (combo >= 75) fontSize = 48;
        else if (combo >= 50) fontSize = 44;
        else if (combo >= 25) fontSize = 38;
        else if (combo >= 10) fontSize = 30;
        else fontSize = 22;

        const multiplier = getComboMultiplier();
        let comboColor;

        // Color based on combo level - rainbow at 100+
        if (combo >= 100) {
            const hue = (now / 12) % 360;
            comboColor = `hsl(${hue}, 100%, 60%)`;
        } else if (combo >= 50) {
            comboColor = '#ff3333';
        } else if (combo >= 25) {
            comboColor = '#ff6600';
        } else if (combo >= 10) {
            comboColor = '#ffaa00';
        } else {
            comboColor = '#dddddd';
        }

        // Cached strings to avoid allocation during frenzy
        if (_frameCache.lastComboCount !== combo || _frameCache.lastMultiplier !== multiplier) {
            _frameCache.comboStr = combo + ' COMBO';
            _frameCache.multiStr = multiplier > 1 ? ` x${multiplier}` : '';
            _frameCache.fullStr = _frameCache.comboStr + _frameCache.multiStr;
            _frameCache.lastComboCount = combo;
            _frameCache.lastMultiplier = multiplier;
        }

        ctx.save();
        ctx.translate(w / 2, hudY);
        ctx.scale(comboScale, comboScale);

        // Explicitly clear any shadow state
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        ctx.font = `bold ${fontSize}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Layer 1: Black outline only
        ctx.strokeStyle = '#000';
        ctx.lineWidth = fontSize >= 38 ? 5 : 4;
        ctx.strokeText(_frameCache.fullStr, 0, 0);

        // Layer 2: Colored fill
        ctx.fillStyle = comboColor;
        ctx.fillText(_frameCache.comboStr, 0, 0);

        // Layer 3: White multiplier suffix
        if (_frameCache.multiStr) {
            ctx.fillStyle = '#ffffff';
            ctx.font = `bold ${Math.floor(fontSize * 0.75)}px monospace`;
            const comboW = ctx.measureText(_frameCache.comboStr).width;
            const multiW = ctx.measureText(_frameCache.multiStr).width;
            ctx.fillText(_frameCache.multiStr, (comboW + multiW) / 2, 0);
        }

        ctx.restore();

        // Milestone burst text (no shadow)
        if (isMilestone && sinceBump < 700) {
            const burstProgress = sinceBump / 700;
            const burstEase = 1 - Math.pow(1 - burstProgress, 3); // ease-out cubic
            const burstScale = 0.7 + Math.sin(burstProgress * Math.PI) * 0.6;
            const burstAlpha = 1 - burstEase;
            const burstY = hudY - 35 - burstEase * 45;

            ctx.save();
            ctx.translate(w / 2, burstY);
            ctx.scale(burstScale, burstScale);
            ctx.globalAlpha = burstAlpha;

            // Explicitly clear shadow state
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;

            ctx.font = 'bold 26px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            ctx.strokeStyle = '#000';
            ctx.lineWidth = 4;
            ctx.strokeText(`${combo} COMBO!`, 0, 0);

            ctx.fillStyle = combo >= 100
                ? `hsl(${(now / 8 + burstProgress * 180) % 360}, 100%, 70%)`
                : '#ffffff';
            ctx.fillText(`${combo} COMBO!`, 0, 0);

            ctx.restore();
        }

        // Combo meter arc: progress to next multiplier threshold
        let nextThreshold, currentBase;
        if (combo < 10) { nextThreshold = 10; currentBase = 5; }
        else if (combo < 15) { nextThreshold = 15; currentBase = 10; }
        else if (combo < 20) { nextThreshold = 20; currentBase = 15; }
        else { nextThreshold = null; }

        if (nextThreshold) {
            const progress = (state.playerCombo - currentBase) / (nextThreshold - currentBase);
            const arcR = fontSize >= 38 ? 18 : 14;
            const arcX = w / 2 + (fontSize >= 38 ? 130 : 100);
            const arcY = hudY;

            ctx.save();
            ctx.beginPath();
            ctx.arc(arcX, arcY, arcR, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255,255,255,0.15)';
            ctx.lineWidth = 3;
            ctx.stroke();

            // Progress arc
            ctx.beginPath();
            ctx.arc(arcX, arcY, arcR, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2, false);
            ctx.strokeStyle = comboColor;
            ctx.lineWidth = 3;
            ctx.stroke();

            // Text inside
            ctx.font = 'bold 9px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#ffffff';
            ctx.fillText(`${state.playerCombo}/${nextThreshold}`, arcX, arcY);
            ctx.restore();
        }
    }

    // Draw combo color tint overlay (subtle ambient glow at high combos)
    if (!reducedEffects) {
        drawComboTint(ctx, w, h, state.playerCombo, now);
    }

    // Draw screen flash effect (on top of everything)
    drawScreenFlash(ctx, w, h, now);

    // Restore from shake transform
    ctx.restore();
}

export function drawAmbientCrowd() {
    if (!state.crowdBgCtx) return;

    const canvas = state.crowdBgCanvas;
    const w = canvas.width;
    const h = canvas.height;
    const ctx = state.crowdBgCtx;
    const now = performance.now();

    // Performance: Update frame cache for ambient mode
    updateFrameCache(now);
    advanceGradientFrame();

    const emotion = _frameCache.crowdEmotion;
    const isCelebrate = emotion === 'celebrate';
    const isDeject = emotion === 'deject';

    if (state.supporters.length === 0) {
        initSupporters(w, h, false);
    }

    ctx.clearRect(0, 0, w, h);

    // Sky / stadium background gradient
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    if (isDeject) {
        grad.addColorStop(0, '#0f0f1a');
        grad.addColorStop(0.6, '#1a1a30');
        grad.addColorStop(1, '#252540');
    } else if (isCelebrate && !_frameCache.reducedEffects) {
        const frenzyPulse = (Math.sin(now / 300) + 1) * 0.5;
        const r = Math.floor(25 + frenzyPulse * 15);
        grad.addColorStop(0, `rgb(${r}, 5, 8)`);
        grad.addColorStop(0.6, `rgb(${r + 10}, 8, 15)`);
        grad.addColorStop(1, '#1a0a0e');
    } else {
        grad.addColorStop(0, '#0a0a1a');
        grad.addColorStop(0.6, '#111128');
        grad.addColorStop(1, '#1a1a2e');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Cache colors locally (with fallback to selected club)
    const primaryColor = state.cachedColors?.primary || state.selectedClub?.colors?.primary || '#006633';
    const secondaryColor = state.cachedColors?.secondary || state.selectedClub?.colors?.secondary || '#FFFFFF';

    // Draw atmospheric haze
    drawAtmosphereHaze(ctx, w, h, now, isCelebrate);

    // Draw stadium roof silhouette at top
    drawStadiumRoof(ctx, w, h);

    // Draw stadium speakers
    drawStadiumSpeakers(ctx, w, h);

    // Draw floodlights (subtle for ambient)
    drawFloodlights(ctx, w, h, now, isCelebrate);

    // Draw club banners
    drawClubBanners(ctx, w, h, now, primaryColor, secondaryColor);

    // Draw stadium bleachers (tiered concrete steps behind crowd)
    drawStadiumBleachers(ctx, w, h);

    // Draw stadium barriers (edges, aisles, railings)
    drawStadiumBarriers(ctx, w, h);

    // Draw goal posts silhouette
    drawGoalPosts(ctx, w, h);

    // Draw pitch edge
    drawPitchEdge(ctx, w, h);

    // Draw corner flags
    drawCornerFlags(ctx, w, h, now);

    // Draw advertising boards at bottom
    drawAdBoards(ctx, w, h, now, primaryColor);

    // Stadium railing accent
    if (isDeject) {
        ctx.fillStyle = 'rgba(100,100,100,0.08)';
    } else {
        ctx.fillStyle = isCelebrate ? 'rgba(255,100,0,0.12)' : 'rgba(255,255,255,0.08)';
    }
    ctx.fillRect(0, h * 0.1, w, 3);

    // Single pass: draw supporters and queue flag/flare data
    supporterBatch.clear();
    resetFlagFlareQueue();

    const supporters = state.supporters;
    const supporterLen = supporters.length;

    for (let i = 0; i < supporterLen; i++) {
        const s = supporters[i];

        let jumpY;
        if (isCelebrate) {
            jumpY = -(Math.abs(Math.sin(now / 200 + s.jumpPhase)) * (5 + s.jumpStrength * 5));
        } else if (isDeject) {
            jumpY = 5;
        } else {
            jumpY = -Math.abs(Math.sin(now / 600 + s.jumpPhase)) * 2;
        }

        drawSupporter(ctx, s, jumpY, isCelebrate, isCelebrate, now, CHOREO_TYPES.default, supporterBatch, primaryColor, secondaryColor, {});

        // Queue flag/flare drawing
        if (isCelebrate && (s.hasFlag || s.hasFlare)) {
            pushFlagFlare(s, jumpY);
        }
    }
    supporterBatch.flush(ctx);

    // Draw flags/flares on top
    for (let i = 0; i < _flagFlareCount; i++) {
        const item = _flagFlarePool[i];
        if (item.s.hasFlag) {
            drawFlag(ctx, item.s, item.jumpY, now);
        }
        if (item.s.hasFlare) {
            drawFlare(ctx, item.s, item.jumpY, now);
            spawnSmoke(item.s, item.jumpY, now);
        }
    }

    // Smoke particles on top of everything
    if (state.smokeParticles.length > 0) {
        updateAndDrawSmoke(ctx, w, h);
    }

    // Weather effects (rain for deject, confetti for celebrate)
    updateAndDrawWeatherEffects(ctx, w, h, emotion);
}