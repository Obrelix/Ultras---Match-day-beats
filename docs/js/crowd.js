// ============================================
// crowd.js — Pixel supporter crowd, particles, flags, flares, smoke
// ============================================

import { state } from './state.js';
import { elements } from './ui.js';
import { getComboMultiplier } from './input.js';

// ============================================
// Coreo Configuration System
// Each coreo type defines its unique crowd behavior
// To add a new coreo: add an entry here and implement any new item/overlay renderers
// ============================================

const COREO_TYPES = {
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
        showItem: null,
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
    }
};

// Order of coreo types for initial progression (0-59)
const COREO_PROGRESSION = ['default', 'wave', 'scarfUp', 'tifo', 'bounce', 'clap'];

// High-intensity cycle (60+): cycles between scarfUp, tifo, bounce, clap
const COREO_HIGH_CYCLE = ['scarfUp', 'tifo', 'bounce', 'clap'];

// Get current coreo config based on combo count
// 0-9=default, 10-19=wave, 20-29=scarfUp, 30-39=tifo, 40-49=bounce, 50-59=clap
// 60+: cycles between scarfUp/tifo/bounce/clap
// 100, 200, 300... (every 100): INFERNO special
function getCoreoConfig(combo) {
    // Special: Inferno triggers at every 100 combo milestone
    if (combo >= 100 && combo % 100 < 10) {
        return COREO_TYPES.inferno;
    }

    // Initial progression (0-59)
    if (combo < 60) {
        const index = Math.floor(combo / 10);
        return COREO_TYPES[COREO_PROGRESSION[index]];
    }

    // High-intensity cycling (60+): rotate through scarfUp, tifo, bounce, clap
    const cycleIndex = Math.floor((combo - 60) / 10) % 4;
    return COREO_TYPES[COREO_HIGH_CYCLE[cycleIndex]];
}

// Get coreo type ID (for backwards compatibility)
function getCoreoType(combo) {
    return getCoreoConfig(combo).id;
}

// Calculate sway offset based on coreo config
function getCoreoSway(coreo, supporter, now, preCalc = {}) {
    const { swayType, swaySpeed, swayAmplitude } = coreo;

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

        case 'individual':
        default:
            // Each supporter has their own phase
            return Math.sin(now / swaySpeed + supporter.jumpPhase) * swayAmplitude;
    }
}

// Calculate jump offset based on coreo config
function getCoreoJump(coreo, supporter, beatDecay, multiplier, now, preCalc = {}) {
    const { jumpPattern, waveRowDelay, pogoHeight, pogoSpeed } = coreo;

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

        case 'default':
        default:
            // Individual phase offsets
            const timeSinceBeat = preCalc.timeSinceBeat || 0;
            const baseJumpDefault = 18 + (multiplier - 1) * 13;
            const phaseOffset = Math.sin(timeSinceBeat * 12 + supporter.jumpPhase) * 0.3;
            return beatDecay * baseJumpDefault * supporter.jumpStrength * (1 + phaseOffset);
    }
}

// Draw coreo-specific items (scarves, placards, etc.)
function drawCoreoItem(ctx, coreo, supporter, x, y, now, colors, batch) {
    const { showItem } = coreo;
    const px = supporter.px;

    // Skip if supporter has flag or flare (they're busy)
    if (supporter.hasFlag || supporter.hasFlare) return;

    switch (showItem) {
        case 'scarf':
            drawCoreoScarf(ctx, coreo, supporter, x, y, now, colors, px, batch);
            break;

        case 'placard':
            drawCoreoPlacard(ctx, coreo, supporter, x, y, now, colors, px, batch);
            break;

        case 'banner':
            drawCoreoBanner(ctx, coreo, supporter, x, y, now, colors, px, batch);
            break;

        default:
            // No special item
            break;
    }
}

// Draw stretched scarf above head with reveal animation (#10)
function drawCoreoScarf(ctx, coreo, supporter, x, y, now, colors, px, batch) {
    const primary = colors.primary || '#006633';
    const secondary = colors.secondary || '#FFFFFF';
    const scarfColor = supporter.row % 2 === 0 ? primary : secondary;
    const waveSpeed = coreo.scarfWaveSpeed || 300;
    const waveAmp = coreo.scarfWaveAmplitude || 2;

    // Reveal animation - scarf unfurls from center
    const coreoAge = now - state.coreoStartTime;
    const rowRevealDelay = supporter.row * 60;
    const revealProgress = Math.min(1, Math.max(0, (coreoAge - rowRevealDelay) / 180));

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
function drawCoreoPlacard(ctx, coreo, supporter, x, y, now, colors, px, batch) {
    const primary = colors.primary || '#006633';
    const secondary = colors.secondary || '#FFFFFF';
    const waveSpeed = coreo.placardWaveSpeed || 600;
    const colorSpeed = coreo.placardColorWaveSpeed || 400;

    // Tifo reveal animation (#10) - placards flip up row by row
    const coreoAge = now - state.coreoStartTime;
    const rowRevealDelay = supporter.row * 80;  // 80ms delay per row
    const revealProgress = Math.min(1, Math.max(0, (coreoAge - rowRevealDelay) / 200));

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
    if (flashIntensity > 0 && !state.settings.reducedEffects) {
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

// Draw large banner waving above head (inferno coreo)
function drawCoreoBanner(ctx, coreo, supporter, x, y, now, colors, px, batch) {
    const primary = colors.primary || '#006633';
    const secondary = colors.secondary || '#FFFFFF';
    const waveSpeed = coreo.bannerWaveSpeed || 120;
    const bannerHeight = coreo.bannerHeight || 20;

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

// Draw coreo overlay (tifo badge, banners, etc.)
function drawCoreoOverlay(ctx, coreo, w, h, now) {
    if (!coreo.showOverlay) return;

    switch (coreo.overlayRenderer) {
        case 'drawTifoOverlay':
            drawTifoOverlay(ctx, w, h, now);
            break;

        case 'drawInfernoOverlay':
            drawInfernoOverlay(ctx, w, h, now);
            break;

        default:
            break;
    }
}

// Get arms position based on coreo config
function getCoreoArmsPosition(coreo) {
    return coreo.armsPosition || 'normal';
}

// Export coreo system for external access/configuration
export { COREO_TYPES, getCoreoConfig, getCoreoType };

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

// Reusable colors object to avoid per-supporter allocation
const _colorsCache = { primary: '', secondary: '' };

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

// Bleacher colors (concrete/metal steps)
const BLEACHER_COLORS = {
    step: '#2a2a3a',        // Main step surface
    stepLight: '#363648',   // Lighter variation
    stepDark: '#1e1e2a',    // Shadow/edge
    riser: '#222230',       // Vertical face between steps
    seat: '#3a3a4a',        // Seat back (if visible)
    seatDark: '#2e2e3e'     // Seat shadow
};

// Draw stadium bleachers (tiered concrete steps behind crowd)
function drawStadiumBleachers(ctx, w, h) {
    const layout = state.stadiumLayout;
    if (!layout) return;

    const { edgeMargin, aisleWidth, aislePositions } = layout;

    // Calculate row positions matching supporter layout
    const PX = 2.7;
    const supporterH = 14 * PX;
    const rowSpacing = supporterH + 6;
    const groundY = h - supporterH;
    const numRows = Math.floor(h / supporterH) + 1;

    // Draw from back to front (top to bottom on screen)
    for (let row = numRows - 1; row >= 0; row--) {
        const rowY = groundY - row * rowSpacing;
        const stepHeight = 12;  // Visible step height
        const riserHeight = 6;  // Vertical face between steps

        // Step surface (horizontal tread)
        const stepTop = rowY + supporterH - stepHeight;

        // Alternate colors slightly per row for visual interest
        const isEvenRow = row % 2 === 0;
        const stepColor = isEvenRow ? BLEACHER_COLORS.step : BLEACHER_COLORS.stepLight;

        // Draw step segments (between aisles)
        let segmentStart = edgeMargin;

        for (let a = 0; a <= aislePositions.length; a++) {
            const segmentEnd = a < aislePositions.length ? aislePositions[a].start : w - edgeMargin;
            const segmentWidth = segmentEnd - segmentStart;

            if (segmentWidth > 0) {
                // Step tread (top surface)
                ctx.fillStyle = stepColor;
                ctx.fillRect(segmentStart, stepTop, segmentWidth, stepHeight);

                // Step edge highlight (front edge catches light)
                ctx.fillStyle = BLEACHER_COLORS.stepLight;
                ctx.fillRect(segmentStart, stepTop, segmentWidth, 2);

                // Riser (vertical face below step) - only visible for rows above ground
                if (row > 0) {
                    ctx.fillStyle = BLEACHER_COLORS.riser;
                    ctx.fillRect(segmentStart, stepTop + stepHeight, segmentWidth, riserHeight);

                    // Shadow at bottom of riser
                    ctx.fillStyle = BLEACHER_COLORS.stepDark;
                    ctx.fillRect(segmentStart, stepTop + stepHeight + riserHeight - 2, segmentWidth, 2);
                }

                // Seat backs (small rectangles indicating folded seats)
                // Only draw every few pixels for a subtle effect
                const seatSpacing = 20;
                const seatWidth = 8;
                const seatHeight = 6;
                ctx.fillStyle = BLEACHER_COLORS.seat;
                for (let sx = segmentStart + 10; sx < segmentEnd - seatWidth; sx += seatSpacing) {
                    // Add slight variation
                    if ((sx + row * 7) % 3 !== 0) {
                        ctx.fillRect(sx, stepTop - seatHeight + 2, seatWidth, seatHeight);
                        // Seat shadow
                        ctx.fillStyle = BLEACHER_COLORS.seatDark;
                        ctx.fillRect(sx, stepTop - 2, seatWidth, 2);
                        ctx.fillStyle = BLEACHER_COLORS.seat;
                    }
                }
            }

            // Move to next segment (after aisle)
            if (a < aislePositions.length) {
                segmentStart = aislePositions[a].end;
            }
        }
    }

    // Add subtle vertical dividers (seat section markers)
    ctx.fillStyle = BLEACHER_COLORS.stepDark;
    const dividerSpacing = 120;
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
            ctx.fillRect(x, 0, 2, h);
        }
    }
}

// Draw stadium barriers (edges and aisles) - called each frame after background gradient
function drawStadiumBarriers(ctx, w, h) {
    const layout = state.stadiumLayout;
    if (!layout) return;

    const { edgeMargin, aisleWidth, aislePositions } = layout;

    // Edge barriers (left and right walls)
    ctx.fillStyle = BARRIER_COLOR;
    ctx.fillRect(0, 0, edgeMargin, h);
    ctx.fillRect(w - edgeMargin, 0, edgeMargin, h);

    // Edge highlights
    ctx.fillStyle = BARRIER_HIGHLIGHT;
    ctx.fillRect(edgeMargin - 4, 0, 4, h);
    ctx.fillRect(w - edgeMargin, 0, 4, h);

    // Aisles between sections
    for (const aisle of aislePositions) {
        // Aisle background
        ctx.fillStyle = BARRIER_COLOR;
        ctx.fillRect(aisle.start, 0, aisleWidth, h);

        // Aisle edge highlights
        ctx.fillStyle = BARRIER_HIGHLIGHT;
        ctx.fillRect(aisle.start, 0, 3, h);
        ctx.fillRect(aisle.end - 3, 0, 3, h);

        // Center railing
        ctx.fillStyle = RAILING_COLOR;
        ctx.fillRect(aisle.start + aisleWidth / 2 - 2, 0, 4, h);
    }

    // Bottom railing (front of stand)
    ctx.fillStyle = RAILING_COLOR;
    ctx.fillRect(0, h - 8, w, 8);
    ctx.fillStyle = BARRIER_HIGHLIGHT;
    ctx.fillRect(0, h - 10, w, 2);
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

function drawSupporter(ctx, s, jumpOffset, armsUp, frenzy, now, coreo, batch = null, primaryColor = null, secondaryColor = null, preCalc = {}) {
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

    // Calculate sway based on coreo config
    if (s.hasFlag && (currentFrenzy || emotion === 'celebrate')) {
        // Flag carriers linked to flag swing
        const flagSwing = getFlagSwing(s, now);
        currentRockX = flagSwing.swingX * 0.4;
        y += (flagSwing.swingY * 0.3) | 0;
    } else if (coreo && coreo.id > 0) {
        // Use coreo-defined sway
        currentRockX = getCoreoSway(coreo, s, now, preCalc);
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

    if (rippleIntensity > 0.01 && !state.settings.reducedEffects) {
        ctx.fillStyle = primary;
        ctx.globalAlpha = rippleIntensity;
        ctx.fillRect(x - px, y + 2 * px, 12 * px, 12 * px);
        ctx.globalAlpha = 1;
    }

    if (currentFrenzy && !state.settings.reducedEffects) {
        const glowPhase = (Math.sin(now / 200 + s.jumpPhase) + 1) * 0.5;
        ctx.fillStyle = primary;
        ctx.globalAlpha = 0.12 + glowPhase * 0.1;
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

    // Tifo coreo (type 3): coordinated shirt color wave
    let shirtColor = s.shirtColor;
    // if (coreoType === 3) {
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

    // Arms - use coreo config for positioning
    const armsPos = coreo ? getCoreoArmsPosition(coreo) : 'normal';
    const clapSpeed = coreo?.clapSpeed || 200;

    // Smooth arm transition (#7) - update transition state
    const targetArm = (currentArmsUp || armsPos === 'scarf-hold' || armsPos === 'up') ? 1 : 0;
    const transitionSpeed = 0.08;  // How fast arms move (0-1 per frame)
    if (s.armTransition === undefined) s.armTransition = 0;
    if (targetArm > s.armTransition) {
        s.armTransition = Math.min(1, s.armTransition + transitionSpeed);
    } else if (targetArm < s.armTransition) {
        s.armTransition = Math.max(0, s.armTransition - transitionSpeed * 0.7);  // Slower down
    }
    const armLerp = s.armTransition;  // 0 = down, 1 = up

    if (armsPos === 'pump' && !s.hasFlag && !s.hasFlare) {
        // Pumping arms up and down - high energy bounce coreo
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

    // Draw coreo-specific items (scarves, placards, etc.)
    if (coreo && coreo.showItem) {
        _colorsCache.primary = primary;
        _colorsCache.secondary = secondary;
        drawCoreoItem(ctx, coreo, s, x, y, now, _colorsCache, batch);
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

    let smokeR = 180, smokeG = 180, smokeB = 180;
    if (s.flareColor === '#00ff44') { smokeR = 100; smokeG = 200; smokeB = 100; }
    else if (s.flareColor === '#ff2200' || s.flareColor === '#ff4400') { smokeR = 200; smokeG = 160; smokeB = 150; }

    // Smoke density scaling based on combo (#8)
    const combo = state.playerCombo;
    const multiplier = getComboMultiplier();

    // Dynamic max particles based on combo
    const maxParticles = combo >= 50 ? 400 : combo >= 20 ? 350 : 300;
    if (state.smokeParticles.length > maxParticles) return;

    // Spawn probability scales with combo (30% base, up to 80% at high combos)
    const spawnChance = 0.3 + Math.min(0.5, (multiplier - 1) * 0.2);
    if (Math.random() > spawnChance) return;

    // Bigger, more intense smoke at higher combos
    const sizeBonus = Math.min(6, (multiplier - 1) * 3);
    const spreadBonus = Math.min(4, (multiplier - 1) * 2);

    state.smokeParticles.push({
        x: handX + px + (Math.random() - 0.5) * (6 + spreadBonus) * px,
        y: flareY - 6 * px,
        vx: (Math.random() - 0.5) * (1.0 + spreadBonus * 0.2),
        vy: -(0.3 + Math.random() * (0.7 + multiplier * 0.1)),
        life: 1,
        decay: 0.002 + Math.random() * 0.003,
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
    if (!state.settings.reducedEffects) {
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

// Draw inferno overlay - fire/heat effect for maximum intensity coreo
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
        if (!state.settings.reducedEffects) {
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

        if (p.life <= 0 || p.y < -20) {
            // Swap and pop (fast removal)
            particles[i] = particles[--len];
            continue;
        }

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

export function drawGameVisuals() {
    if (!state.crowdBgCtx) return;

    const canvas = state.crowdBgCanvas;
    const w = canvas.width;
    const h = canvas.height;
    const ctx = state.crowdBgCtx;
    const now = performance.now();
    const multiplier = getComboMultiplier();

    // Determine frenzy state based on crowdEmotion for visuals
    const currentFrenzy = state.crowdEmotion === 'celebrate' || state.playerCombo > 5;
    const coreo = getCoreoConfig(state.playerCombo);

    // Track coreo transitions for reveal animations (#10)
    if (coreo.id !== state.lastCoreoId) {
        state.lastCoreoId = coreo.id;
        state.coreoStartTime = now;
    }
    const coreoAge = now - state.coreoStartTime;  // ms since coreo started

    if (state.supporters.length === 0) {
        initSupporters(w, h, false); // Explicitly pass false for game visuals
    }

    ctx.clearRect(0, 0, w, h);

    // Sky / stadium background gradient
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    if (state.crowdEmotion === 'deject') {
        grad.addColorStop(0, '#0f0f1a');
        grad.addColorStop(0.6, '#1a1a30');
        grad.addColorStop(1, '#252540');
    } else if (currentFrenzy && !state.settings.reducedEffects) {
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

    // Stadium floodlight gradient overlay (#5)
    if (!state.settings.reducedEffects) {
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

    // Draw stadium bleachers (tiered concrete steps behind crowd)
    drawStadiumBleachers(ctx, w, h);

    // Draw stadium barriers (edges, aisles, railings)
    drawStadiumBarriers(ctx, w, h);

    // Stadium railing
    if (state.crowdEmotion === 'deject') {
        ctx.fillStyle = 'rgba(100,100,100,0.08)';
    } else {
        ctx.fillStyle = currentFrenzy ? 'rgba(255,100,0,0.12)' : 'rgba(255,255,255,0.08)';
    }
    ctx.fillRect(0, h * 0.1, w, 3);

    // Cache colors locally to avoid repeated state access (with fallback to selected club)
    const primaryColor = state.cachedColors?.primary || state.selectedClub?.colors?.primary || '#006633';
    const secondaryColor = state.cachedColors?.secondary || state.selectedClub?.colors?.secondary || '#FFFFFF';

    // Beat-synced animation
    const timeSinceBeat = (now - state.crowdBeatTime) / 1000;
    const beatDecay = Math.max(0, 1 - timeSinceBeat * 4);

    // Pre-calculate common trig values for coreo system
    const sinNow150 = Math.sin(now / 150);
    const preCalc = {
        sinSway: Math.sin(now / (coreo.swaySpeed || 200)),
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
            // Use coreo-based jump calculation
            personalJump = getCoreoJump(coreo, s, beatDecay, multiplier, now, preCalc);
        }
        const jumpY = -(personalJump + frenzyBounce + swayAddition);

        const armsUp = !currentFrenzy && timeSinceBeat < 0.3 && s.jumpStrength > 0.7;
        drawSupporter(ctx, s, jumpY, armsUp, currentFrenzy, now, coreo, supporterBatch, primaryColor, secondaryColor, preCalc);

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

    // Draw coreo overlay (tifo badge, banners, etc.) on top of supporters
    drawCoreoOverlay(ctx, coreo, w, h, now);

    // Smoke particles on top of everything
    if (state.smokeParticles.length > 0) {
        updateAndDrawSmoke(ctx, w, h);
    }

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

    // --- HUD text stack: FEVER -> Feedback -> Combo ---
    if (currentFrenzy && !state.wasFrenzy) {
        state.frenzyStartTime = now;
        state.wasFrenzy = true;
    } else if (!currentFrenzy && state.wasFrenzy) {
        state.wasFrenzy = false;
    }

    // Position HUD below the beat track canvas
    const gameCanvasEl = elements.gameCanvas;
    let hudY = 22;
    if (gameCanvasEl) {
        const rect = gameCanvasEl.getBoundingClientRect();
        hudY = rect.bottom + 20;
    }

    // 1) FEVER! text (only for celebration/frenzy)
    if (currentFrenzy || state.crowdEmotion === 'celebrate') {
        drawFeverText(ctx, w, h, now, hudY);
        hudY += 30;
    }

    // 2) Feedback text
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

    // 3) Frenzy progress indicator (combo 2-5, pre-frenzy)
    if (state.comboDisplayCount >= 2 && state.comboDisplayCount <= 5 && !currentFrenzy) {
        const progressText = `COMBO ${state.comboDisplayCount}/6 → FEVER!`;
        ctx.save();
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.strokeText(progressText, w / 2, hudY);
        const gradProgress = state.comboDisplayCount / 6;
        const hue = 30 + gradProgress * 30;
        ctx.fillStyle = `hsl(${hue}, 100%, 60%)`;
        ctx.globalAlpha = 0.7 + gradProgress * 0.3;
        ctx.fillText(progressText, w / 2, hudY);
        ctx.globalAlpha = 1;
        ctx.restore();
        hudY += 24;
    }

    // 4) Combo counter (frenzy mode, combo > 5)
    if (state.comboDisplayCount > 5) {
        const sinceBump = now - state.comboBumpTime;
        const bumpT = Math.min(1, sinceBump / 200);

        let comboScale;
        if (bumpT < 0.4) {
            comboScale = 1 + (1 - bumpT / 0.4) * 0.25;
        } else {
            comboScale = 1.0;
        }

        const pulse = (Math.sin(now / 120) + 1) * 0.5;
        comboScale *= 1 + pulse * 0.04;

        const multiplier = getComboMultiplier();
        let comboColor, glowColor;
        if (multiplier >= 3) {
            comboColor = '#ff4444'; glowColor = '#ff0000';
        } else if (multiplier >= 2) {
            comboColor = '#ff8800'; glowColor = '#ff6600';
        } else if (multiplier >= 1.5) {
            comboColor = '#ffd700'; glowColor = '#ffaa00';
        } else {
            comboColor = '#cccccc'; glowColor = '#888888';
        }

        const comboStr = state.comboDisplayCount + ' COMBO';
        const multiStr = multiplier > 1 ? ` x${multiplier}` : '';
        const fullStr = comboStr + multiStr;

        ctx.save();
        ctx.translate(w / 2, hudY);
        ctx.scale(comboScale, comboScale);
        ctx.font = 'bold 20px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Layer 1: black outline (no shadow)
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 4;
        ctx.strokeText(fullStr, 0, 0);

        // Layer 2: colored fill with glow
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 10 + pulse * 6 + multiplier * 3;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.fillStyle = comboColor;
        ctx.fillText(comboStr, 0, 0);

        // Turn off shadow before drawing multiplier
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;

        // Layer 3: multiplier suffix (no shadow)
        if (multiStr) {
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 16px monospace';
            const comboW = ctx.measureText(comboStr).width;
            const multiW = ctx.measureText(multiStr).width;
            ctx.fillText(multiStr, (comboW + multiW) / 2, 0);
        }

        ctx.globalAlpha = 1;
        ctx.restore();

        // Combo meter arc: progress to next multiplier threshold
        let nextThreshold, currentBase;
        if (state.playerCombo < 10) { nextThreshold = 10; currentBase = 5; }
        else if (state.playerCombo < 15) { nextThreshold = 15; currentBase = 10; }
        else if (state.playerCombo < 20) { nextThreshold = 20; currentBase = 15; }
        else { nextThreshold = null; }

        if (nextThreshold) {
            const progress = (state.playerCombo - currentBase) / (nextThreshold - currentBase);
            const arcR = 14;
            const arcX = w / 2 + 100;
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
}

export function drawAmbientCrowd() {
    if (!state.crowdBgCtx) return;

    const canvas = state.crowdBgCanvas;
    const w = canvas.width;
    const h = canvas.height;
    const ctx = state.crowdBgCtx;
    const now = performance.now();

    const emotion = state.crowdEmotion;
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
    } else if (isCelebrate && !state.settings.reducedEffects) {
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

    // Draw stadium bleachers (tiered concrete steps behind crowd)
    drawStadiumBleachers(ctx, w, h);

    // Draw stadium barriers (edges, aisles, railings)
    drawStadiumBarriers(ctx, w, h);

    // Stadium railing
    if (isDeject) {
        ctx.fillStyle = 'rgba(100,100,100,0.08)';
    } else {
        ctx.fillStyle = isCelebrate ? 'rgba(255,100,0,0.12)' : 'rgba(255,255,255,0.08)';
    }
    ctx.fillRect(0, h * 0.1, w, 3);

    // Cache colors locally (with fallback to selected club)
    const primaryColor = state.cachedColors?.primary || state.selectedClub?.colors?.primary || '#006633';
    const secondaryColor = state.cachedColors?.secondary || state.selectedClub?.colors?.secondary || '#FFFFFF';

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

        drawSupporter(ctx, s, jumpY, isCelebrate, isCelebrate, now, COREO_TYPES.default, supporterBatch, primaryColor, secondaryColor, {});

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
}