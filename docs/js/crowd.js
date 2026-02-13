// ============================================
// crowd.js — Pixel supporter crowd, particles, flags, flares, smoke
// ============================================

import { state } from './state.js';
import { elements } from './ui.js';
import { getComboMultiplier } from './input.js';

// ============================================
// Batched Drawing System - reduces fillStyle changes for performance
// ============================================

class DrawBatch {
    constructor() {
        this.rects = new Map();  // color -> array of {x, y, w, h}
        this.faceQueue = [];     // faces to draw after main batch (ensures eyes on top)
    }

    add(color, x, y, w, h) {
        if (!this.rects.has(color)) {
            this.rects.set(color, []);
        }
        this.rects.get(color).push({ x: Math.floor(x), y: Math.floor(y), w, h });
    }

    flush(ctx) {
        // Draw all body parts first
        for (const [color, rects] of this.rects) {
            ctx.fillStyle = color;
            for (const r of rects) {
                ctx.fillRect(r.x, r.y, r.w, r.h);
            }
        }
        this.rects.clear();

        // Draw faces on top (eyes need to be visible over skin)
        for (const face of this.faceQueue) {
            drawFace(ctx, face.x, face.y, face.px, face.eyeOffsetY, face.mouthShape, face.emotion);
        }
        this.faceQueue = [];
    }

    clear() {
        this.rects.clear();
        this.faceQueue = [];
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

// Stadium barrier colors
const BARRIER_COLOR = '#1a1a2e';
const BARRIER_HIGHLIGHT = '#2a2a4e';
const RAILING_COLOR = '#444466';

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
    const PX = 3;
    const supporterW = 5 * PX;
    // Same density on all devices - other optimizations handle performance
    const spacing = 20;
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
                flareHand: Math.random() < 0.5 ? 'left' : 'right'
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

function drawSupporter(ctx, s, jumpOffset, armsUp, frenzy, now, coreoType, batch = null) {
    const px = s.px;
    const baseX = Math.floor(s.x);
    let y = Math.floor(s.baseY + jumpOffset);

    let currentArmsUp = armsUp;
    let currentFrenzy = frenzy;
    let currentRockX = 0;
    let eyeOffsetX = 0;
    let eyeOffsetY = 0;
    let mouthShape = 'normal'; // 'normal', 'frown', 'open'

    if (state.crowdEmotion === 'deject') {
        currentArmsUp = false;
        currentFrenzy = false; // Override frenzy if dejected
        y += 2 * px; // Slight slump
        // Make supporters look down
        eyeOffsetY = px;
        mouthShape = 'frown';
    } else if (state.crowdEmotion === 'celebrate') {
        currentFrenzy = true; // Force frenzy-like behavior for celebration
        currentArmsUp = true;
        mouthShape = 'open';
    } else if (currentFrenzy) {
        // Gameplay frenzy (combo > 5): open mouth, same as celebrate
        mouthShape = 'open';
    }


    // Coreo types 1-3: synchronized sway; type 0: individual rocking
    // Flag carriers follow their flag motion for realistic body sway
    if (s.hasFlag && (currentFrenzy || state.crowdEmotion === 'celebrate')) {
        const flagSwing = getFlagSwing(s, now);
        // Body sways less than the flag pole - about 40% of flag motion
        currentRockX = flagSwing.swingX * 0.4;
        // Also shift Y slightly for pumping/circular motions
        y += Math.floor(flagSwing.swingY * 0.3);
    } else if (coreoType >= 1) {
        currentRockX = Math.sin(now / 200) * 5;
    } else if (currentFrenzy) {
        currentRockX = Math.sin(now / 120 + s.jumpPhase) * 3;
    } else {
        currentRockX = 0;
    }
    const x = Math.floor(baseX + currentRockX);

    if (currentFrenzy && !state.settings.reducedEffects) {
        const glowPhase = (Math.sin(now / 200 + s.jumpPhase) + 1) * 0.5;
        const primary = state.cachedColors?.primary || '#006633';
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

    // Arms
    if ((coreoType === 2 ||coreoType === 3) && !s.hasFlag && !s.hasFlare) {
        // Scarf coreo: arms straight up holding scarf taut
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
    } else if (currentArmsUp) {
        drawPixelRect(ctx, x, y + 2 * px, 2, 4, s.skinColor, px, batch);
        drawPixelRect(ctx, x + 8 * px, y + 2 * px, 2, 4, s.skinColor, px, batch);
        drawPixelRect(ctx, x, y + 1 * px, 2, 1, s.skinColor, px, batch);
        drawPixelRect(ctx, x + 8 * px, y + 1 * px, 2, 1, s.skinColor, px, batch);
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
        const faceData = { x, y, px, eyeOffsetY, mouthShape, emotion: state.crowdEmotion };
        if (!batch.faceQueue) batch.faceQueue = [];
        batch.faceQueue.push(faceData);
    } else {
        // Direct draw mode (no batch)
        drawFace(ctx, x, y, px, eyeOffsetY, mouthShape, state.crowdEmotion);
    }

    if (coreoType === 2 && !s.hasFlag && !s.hasFlare) {
        // Scarf-up coreo: supporters hold scarves stretched above heads
        const primary = state.cachedColors?.primary || '#006633';
        const secondary = state.cachedColors?.secondary || '#FFFFFF';
        const scarfColor = s.row % 2 === 0 ? primary : secondary;
        const scarfWave = Math.sin(now / 300 + s.x / 40) * 2;
        const scarfY = y - px + Math.floor(scarfWave);
        drawPixelRect(ctx, x - 2 * px, scarfY, 14, 1, scarfColor, px, batch);
        drawPixelRect(ctx, x - px, scarfY - px, 12, 1, scarfColor, px, batch);
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

    // Limit smoke particles for performance
    if (state.smokeParticles.length > 300) return;

    // Spawn 1 particle per call (reduced from 2) with 50% chance for less density
    if (Math.random() < 0.5) return;

    state.smokeParticles.push({
        x: handX + px + (Math.random() - 0.5) * 6 * px,
        y: flareY - 6 * px,
        vx: (Math.random() - 0.5) * 1.0,
        vy: -(0.3 + Math.random() * 0.7),
        life: 1,
        decay: 0.002 + Math.random() * 0.003,
        size: 6 + Math.random() * 8,
        r: smokeR, g: smokeG, b: smokeB
    });
}

function updateAndDrawSmoke(ctx, w, h) {
    for (let i = state.smokeParticles.length - 1; i >= 0; i--) {
        const p = state.smokeParticles[i];
        p.x += p.vx + Math.sin(p.life * 3) * 0.3;
        p.y += p.vy;
        p.vy *= 0.995;
        p.vx += (Math.random() - 0.5) * 0.1;
        p.life -= p.decay;
        p.size += 0.15;

        if (p.life <= 0 || p.y < -20) {
            state.smokeParticles[i] = state.smokeParticles[state.smokeParticles.length - 1];
            state.smokeParticles.pop();
            continue;
        }

        const alpha = p.life * 0.6;
        const sz = Math.floor(p.size);
        ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${alpha})`;
        ctx.fillRect(Math.floor(p.x - sz / 2), Math.floor(p.y - sz / 2), sz, sz);
    }
    if (state.smokeParticles.length > 300) {
        state.smokeParticles.splice(0, state.smokeParticles.length - 300);
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
    const coreoType = state.playerCombo >= 10 ? Math.floor(state.playerCombo / 10) % 4 : 0;

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

    // Draw stadium barriers (edges, aisles, railings)
    drawStadiumBarriers(ctx, w, h);

    // Stadium railing
    if (state.crowdEmotion === 'deject') {
        ctx.fillStyle = 'rgba(100,100,100,0.08)';
    } else {
        ctx.fillStyle = currentFrenzy ? 'rgba(255,100,0,0.12)' : 'rgba(255,255,255,0.08)';
    }
    ctx.fillRect(0, h * 0.1, w, 3);

    // Beat-synced animation
    const timeSinceBeat = (now - state.crowdBeatTime) / 1000;
    const beatDecay = Math.max(0, 1 - timeSinceBeat * 4);

    let jumpHeight = 0;
    let frenzyBounce = 0;
    let sway = Math.sin(now / 400) * 2;

    if (state.crowdEmotion === 'deject') {
        // Very minimal movement
        jumpHeight = beatDecay * 2;
        sway = Math.sin(now / 800) * 1;
    } else {
        // Jump height scales with combo multiplier or celebration
        const baseJump = 18 + (multiplier - 1) * 13;
        jumpHeight = beatDecay * baseJump;
        frenzyBounce = currentFrenzy ? Math.abs(Math.sin(now / 150)) * (4 + multiplier * 2) : 0;
    }

    // First pass: draw all supporters (base layer) - use batching for performance
    supporterBatch.clear();
    const jumpYValues = [];
    for (let i = 0; i < state.supporters.length; i++) {
        const s = state.supporters[i];

        let personalJump;
        if (state.crowdEmotion === 'deject') {
            personalJump = -s.jumpStrength * 2;
        } else if (coreoType === 1) {
            const rowWave = Math.abs(Math.sin(now / 250 + s.row * (Math.PI / 2.5))) * multiplier * 3;
            personalJump = jumpHeight * s.jumpStrength + rowWave;
        } else {
            const phaseOffset = Math.sin(timeSinceBeat * 12 + s.jumpPhase) * 0.3;
            personalJump = jumpHeight * s.jumpStrength * (1 + phaseOffset);
        }
        const jumpY = -(personalJump + frenzyBounce + (beatDecay < 0.01 && !currentFrenzy && state.crowdEmotion !== 'deject' ? sway * 0.5 : 0));
        jumpYValues.push(jumpY);

        const armsUp = !currentFrenzy && timeSinceBeat < 0.3 && s.jumpStrength > 0.7;
        drawSupporter(ctx, s, jumpY, armsUp, currentFrenzy, now, coreoType, supporterBatch);
    }
    // Flush all batched supporter draws at once (reduces fillStyle changes)
    supporterBatch.flush(ctx);

    // Second pass: flags, flares on top of all supporters
    for (let i = 0; i < state.supporters.length; i++) {
        const s = state.supporters[i];
        const jumpY = jumpYValues[i];

        if ((currentFrenzy || state.crowdEmotion === 'celebrate') && s.hasFlag) {
            drawFlag(ctx, s, jumpY, now);
        }

        // Flares always visible with smoke
        if (s.hasFlare) {
            drawFlare(ctx, s, jumpY, now);
            spawnSmoke(s, jumpY, now);
        }
    }

    // Smoke particles on top of everything
    if (state.smokeParticles.length > 0) {
        updateAndDrawSmoke(ctx, w, h);
    }

    // Beat flash overlay
    if (beatDecay > 0.01) {
        const primary = state.cachedColors?.primary || '#006633';
        if (state.crowdEmotion === 'deject') {
            ctx.fillStyle = 'rgba(50,50,50,0.08)';
        } else {
            ctx.fillStyle = currentFrenzy ? '#ff4400' : primary;
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

    // Draw stadium barriers (edges, aisles, railings)
    drawStadiumBarriers(ctx, w, h);

    // Stadium railing
    if (isDeject) {
        ctx.fillStyle = 'rgba(100,100,100,0.08)';
    } else {
        ctx.fillStyle = isCelebrate ? 'rgba(255,100,0,0.12)' : 'rgba(255,255,255,0.08)';
    }
    ctx.fillRect(0, h * 0.1, w, 3);

    // First pass: draw all supporters (base layer) - use batching for performance
    supporterBatch.clear();
    const jumpYValues = [];
    for (let i = 0; i < state.supporters.length; i++) {
        const s = state.supporters[i];

        let jumpY = 0;
        if (isCelebrate) {
            jumpY = -(Math.abs(Math.sin(now / 200 + s.jumpPhase)) * (5 + s.jumpStrength * 5));
        } else if (isDeject) {
            jumpY = 5;
        } else {
            jumpY = -Math.abs(Math.sin(now / 600 + s.jumpPhase)) * 2;
        }
        jumpYValues.push(jumpY);

        drawSupporter(ctx, s, jumpY, isCelebrate, isCelebrate, now, 0, supporterBatch);
    }
    // Flush all batched supporter draws at once (reduces fillStyle changes)
    supporterBatch.flush(ctx);

    // Second pass: flags, flares on top of all supporters
    for (let i = 0; i < state.supporters.length; i++) {
        const s = state.supporters[i];
        const jumpY = jumpYValues[i];

        if (isCelebrate && s.hasFlag) {
            drawFlag(ctx, s, jumpY, now);
        }

        if (isCelebrate && s.hasFlare) {
            drawFlare(ctx, s, jumpY, now);
            spawnSmoke(s, jumpY, now);
        }
    }

    // Smoke particles on top of everything
    if (state.smokeParticles.length > 0) {
        updateAndDrawSmoke(ctx, w, h);
    }
}