// ============================================
// renderer.js — Beat track visualizer (top canvas)
// ============================================

import { SCROLL_VIS, BEAT_RESULT_COLORS, MODIFIERS } from './config.js';
import { state } from './state.js';
import { elements } from './ui.js';
import { getComboMultiplier, releaseParticle } from './input.js';

let _resizeHandler = null;

/**
 * Draws a hold beat with enhanced visuals
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} startX - X position of hold start
 * @param {number} endX - X position of hold end
 * @param {number} y - Y position (center)
 * @param {number} height - Height of the hold bar
 * @param {number} progress - 0-1 fill progress
 * @param {string} color - Base color
 * @param {number} alpha - Opacity
 * @param {boolean} wasBroken - Whether the hold was broken
 */
function drawHoldBeat(ctx, startX, endX, y, height, progress, color, alpha, wasBroken) {
    const halfHeight = height * 1.2;  // Slightly taller for visibility
    const minWidth = height * 3;
    const now = performance.now();

    // Handle cases where start is off-screen to the left
    const visibleStartX = Math.max(-halfHeight, startX);
    const width = Math.max(minWidth, Math.abs(endX - visibleStartX));
    const left = Math.min(visibleStartX, endX);

    ctx.globalAlpha = alpha;

    // === Outer glow (when active) ===
    if (progress > 0 && !wasBroken) {
        const glowPulse = 0.3 + Math.sin(now / 150) * 0.15;
        ctx.shadowColor = color;
        ctx.shadowBlur = 15 + glowPulse * 10;
        ctx.fillStyle = 'rgba(0,0,0,0)';
        ctx.beginPath();
        roundedRect(ctx, left - 2, y - halfHeight - 2, width + 4, halfHeight * 2 + 4, halfHeight);
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    // === Background track with gradient ===
    const trackGrad = ctx.createLinearGradient(left, y - halfHeight, left, y + halfHeight);
    if (wasBroken) {
        trackGrad.addColorStop(0, '#661111');
        trackGrad.addColorStop(0.5, '#aa2222');
        trackGrad.addColorStop(1, '#661111');
    } else {
        trackGrad.addColorStop(0, '#1a1a2e');
        trackGrad.addColorStop(0.3, '#2a2a4e');
        trackGrad.addColorStop(0.7, '#2a2a4e');
        trackGrad.addColorStop(1, '#1a1a2e');
    }
    ctx.fillStyle = trackGrad;
    ctx.beginPath();
    roundedRect(ctx, left, y - halfHeight, width, halfHeight * 2, halfHeight);
    ctx.fill();

    // === Inner track lines (rail effect) ===
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(left + halfHeight, y - halfHeight * 0.4);
    ctx.lineTo(left + width - halfHeight, y - halfHeight * 0.4);
    ctx.moveTo(left + halfHeight, y + halfHeight * 0.4);
    ctx.lineTo(left + width - halfHeight, y + halfHeight * 0.4);
    ctx.stroke();

    // === Progress fill with animated gradient ===
    if (progress > 0) {
        const fillWidth = width * progress;

        // Animated color shift based on progress
        const hue = progress < 0.5 ? 200 : (200 - (progress - 0.5) * 100);  // Blue to cyan/green
        const progressColor = wasBroken ? '#ff4444' : `hsl(${hue}, 80%, 55%)`;
        const progressColorLight = wasBroken ? '#ff6666' : `hsl(${hue}, 90%, 70%)`;

        const fillGrad = ctx.createLinearGradient(left, y - halfHeight, left, y + halfHeight);
        fillGrad.addColorStop(0, progressColorLight);
        fillGrad.addColorStop(0.5, progressColor);
        fillGrad.addColorStop(1, progressColorLight);

        ctx.save();
        ctx.beginPath();
        roundedRect(ctx, left, y - halfHeight, width, halfHeight * 2, halfHeight);
        ctx.clip();

        ctx.fillStyle = fillGrad;
        ctx.fillRect(left, y - halfHeight, fillWidth, halfHeight * 2);

        // Animated shimmer effect
        if (!wasBroken && !state.settings.reducedEffects) {
            const shimmerX = left + (now / 10) % (width * 1.5) - width * 0.25;
            const shimmerGrad = ctx.createLinearGradient(shimmerX, 0, shimmerX + 40, 0);
            shimmerGrad.addColorStop(0, 'rgba(255,255,255,0)');
            shimmerGrad.addColorStop(0.5, 'rgba(255,255,255,0.3)');
            shimmerGrad.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = shimmerGrad;
            ctx.fillRect(left, y - halfHeight, fillWidth, halfHeight * 2);
        }

        // Leading edge glow
        const edgeX = left + fillWidth;
        const edgeGrad = ctx.createRadialGradient(edgeX, y, 0, edgeX, y, halfHeight * 1.5);
        edgeGrad.addColorStop(0, 'rgba(255,255,255,0.8)');
        edgeGrad.addColorStop(0.3, progressColorLight);
        edgeGrad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = edgeGrad;
        ctx.fillRect(edgeX - halfHeight * 1.5, y - halfHeight, halfHeight * 3, halfHeight * 2);

        ctx.restore();
    }

    // === Track outline ===
    const outlineGrad = ctx.createLinearGradient(left, y - halfHeight, left, y + halfHeight);
    if (wasBroken) {
        outlineGrad.addColorStop(0, '#ff6666');
        outlineGrad.addColorStop(1, '#cc3333');
    } else if (progress > 0) {
        outlineGrad.addColorStop(0, '#ffffff');
        outlineGrad.addColorStop(0.5, color);
        outlineGrad.addColorStop(1, '#ffffff');
    } else {
        outlineGrad.addColorStop(0, 'rgba(255,255,255,0.6)');
        outlineGrad.addColorStop(1, 'rgba(255,255,255,0.3)');
    }
    ctx.strokeStyle = outlineGrad;
    ctx.lineWidth = 2;
    ctx.beginPath();
    roundedRect(ctx, left, y - halfHeight, width, halfHeight * 2, halfHeight);
    ctx.stroke();

    // === Start marker (diamond shape) ===
    if (startX > -halfHeight) {
        const startSize = halfHeight * 0.9;
        const startPulse = progress > 0 ? 1 + Math.sin(now / 100) * 0.1 : 1;

        // Glow behind start marker
        if (progress === 0) {
            ctx.shadowColor = '#ffffff';
            ctx.shadowBlur = 8;
        }

        // Diamond shape
        ctx.fillStyle = progress > 0 ? color : '#ffffff';
        ctx.beginPath();
        ctx.moveTo(startX, y - startSize * startPulse);
        ctx.lineTo(startX + startSize * 0.7 * startPulse, y);
        ctx.lineTo(startX, y + startSize * startPulse);
        ctx.lineTo(startX - startSize * 0.7 * startPulse, y);
        ctx.closePath();
        ctx.fill();

        ctx.shadowBlur = 0;

        // Inner highlight
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.beginPath();
        ctx.moveTo(startX, y - startSize * 0.5 * startPulse);
        ctx.lineTo(startX + startSize * 0.35 * startPulse, y);
        ctx.lineTo(startX, y + startSize * 0.5 * startPulse);
        ctx.lineTo(startX - startSize * 0.35 * startPulse, y);
        ctx.closePath();
        ctx.fill();
    }

    // === End marker (target circle) ===
    const endSize = halfHeight * 0.8;
    const nearEnd = progress >= 0.85;
    const endPulse = nearEnd ? 1 + Math.sin(now / 80) * 0.15 : 1;

    // Outer ring
    ctx.strokeStyle = nearEnd ? '#00ff88' : 'rgba(255,255,255,0.5)';
    ctx.lineWidth = nearEnd ? 3 : 2;
    ctx.beginPath();
    ctx.arc(endX, y, endSize * endPulse, 0, Math.PI * 2);
    ctx.stroke();

    // Inner fill
    const endGrad = ctx.createRadialGradient(endX, y, 0, endX, y, endSize);
    if (progress >= 0.95) {
        endGrad.addColorStop(0, '#00ff88');
        endGrad.addColorStop(0.7, '#00cc66');
        endGrad.addColorStop(1, '#009944');
    } else if (nearEnd) {
        endGrad.addColorStop(0, '#88ffaa');
        endGrad.addColorStop(1, '#446655');
    } else {
        endGrad.addColorStop(0, '#555566');
        endGrad.addColorStop(1, '#333344');
    }
    ctx.fillStyle = endGrad;
    ctx.beginPath();
    ctx.arc(endX, y, endSize * 0.7 * endPulse, 0, Math.PI * 2);
    ctx.fill();

    // Crosshair on end marker
    if (!nearEnd) {
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(endX - endSize * 0.5, y);
        ctx.lineTo(endX + endSize * 0.5, y);
        ctx.moveTo(endX, y - endSize * 0.5);
        ctx.lineTo(endX, y + endSize * 0.5);
        ctx.stroke();
    }

    // === Connector dots along the track ===
    if (progress === 0 && alpha > 0.3 && !state.settings.reducedEffects) {
        const dotSpacing = 20;
        const dotCount = Math.floor((width - halfHeight * 2) / dotSpacing);
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        for (let i = 1; i < dotCount; i++) {
            const dotX = left + halfHeight + i * dotSpacing;
            const dotPulse = Math.sin(now / 300 + i * 0.5) * 0.5 + 0.5;
            ctx.beginPath();
            ctx.arc(dotX, y, 2 + dotPulse, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // === "HOLD" label with better styling ===
    if (progress === 0 && alpha > 0.5 && startX > 0 && width > 80) {
        const labelX = (startX + endX) / 2;

        // Text shadow/glow
        ctx.shadowColor = color;
        ctx.shadowBlur = 4;
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('HOLD', labelX, y);
        ctx.shadowBlur = 0;

        // Arrow indicators
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        const arrowY = y;
        const arrowOffset = 28;
        // Left arrow
        ctx.beginPath();
        ctx.moveTo(labelX - arrowOffset, arrowY);
        ctx.lineTo(labelX - arrowOffset - 5, arrowY - 4);
        ctx.lineTo(labelX - arrowOffset - 5, arrowY + 4);
        ctx.closePath();
        ctx.fill();
        // Right arrow
        ctx.beginPath();
        ctx.moveTo(labelX + arrowOffset, arrowY);
        ctx.lineTo(labelX + arrowOffset + 5, arrowY - 4);
        ctx.lineTo(labelX + arrowOffset + 5, arrowY + 4);
        ctx.closePath();
        ctx.fill();
    }

    // === Combo counter during active hold ===
    if (progress > 0 && !wasBroken) {
        const combo = state.playerCombo;
        const comboX = visibleStartX + (endX - visibleStartX) * progress;
        const comboY = y - halfHeight - 12;

        // Combo bubble background
        const bubbleWidth = combo >= 100 ? 36 : combo >= 10 ? 28 : 22;
        const bubbleHeight = 16;

        // Pulsing effect on combo
        const pulse = 1 + Math.sin(now / 100) * 0.08;

        ctx.save();
        ctx.translate(comboX, comboY);
        ctx.scale(pulse, pulse);

        // Bubble gradient
        const bubbleGrad = ctx.createLinearGradient(0, -bubbleHeight/2, 0, bubbleHeight/2);
        bubbleGrad.addColorStop(0, '#00ffaa');
        bubbleGrad.addColorStop(1, '#00aa66');
        ctx.fillStyle = bubbleGrad;

        // Draw rounded bubble
        ctx.beginPath();
        roundedRect(ctx, -bubbleWidth/2, -bubbleHeight/2, bubbleWidth, bubbleHeight, 8);
        ctx.fill();

        // Bubble border
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Combo text
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#000000';
        ctx.fillText(`${combo}x`, 0, 0);

        ctx.restore();

        // === Score ticks indicator ===
        const tickCount = state.holdState.comboTickCount || 0;
        if (tickCount > 0) {
            const tickY = y + halfHeight + 8;
            const tickSpacing = 8;
            const totalTickWidth = (tickCount - 1) * tickSpacing;
            const tickStartX = comboX - totalTickWidth / 2;

            for (let i = 0; i < tickCount; i++) {
                const tickX = tickStartX + i * tickSpacing;
                const tickPulse = i === tickCount - 1 ? (1 + Math.sin(now / 80) * 0.3) : 1;

                ctx.fillStyle = i === tickCount - 1 ? '#00ffaa' : '#00aa77';
                ctx.beginPath();
                ctx.arc(tickX, tickY, 3 * tickPulse, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    ctx.globalAlpha = 1;
}

/**
 * Helper to draw a rounded rectangle path
 */
function roundedRect(ctx, x, y, width, height, radius) {
    radius = Math.min(radius, width / 2, height / 2);
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

// Performance: Cache upcoming beats array to avoid recreation each frame
const _upcomingBeatsCache = {
    indices: new Array(5),
    count: 0,
    lastNextBeatIndex: -1
};

export function initVisualizer() {
    const canvas = elements.gameCanvas;
    state.canvasCtx = canvas.getContext('2d');

    // Remove previous handler first to prevent accumulation
    if (_resizeHandler) {
        window.removeEventListener('resize', _resizeHandler);
        _resizeHandler = null;
    }

    // Create new resize handler
    function resizeCanvas() {
        const rect = canvas.getBoundingClientRect();
        canvas.width = Math.floor(rect.width);
        canvas.height = Math.floor(rect.height);

        // Cache HUD Y position to avoid getBoundingClientRect() in hot loop
        state.hudPositionY = rect.bottom + 20;

        if (state.audioBuffer) {
            computeWaveformPeaks();
            buildWaveformCache();
        }
    }

    // Store reference BEFORE adding listener
    _resizeHandler = resizeCanvas;
    window.addEventListener('resize', _resizeHandler);

    // Initial resize
    resizeCanvas();
}

export function computeWaveformPeaks() {
    const duration = state.audioBuffer.duration;
    const ch0 = state.audioBuffer.getChannelData(0);
    const ch1 = state.audioBuffer.numberOfChannels > 1 ? state.audioBuffer.getChannelData(1) : ch0;
    const totalSamples = ch0.length;
    const peaksPerSec = SCROLL_VIS.PEAKS_PER_SEC;
    const totalPeaks = Math.ceil(duration * peaksPerSec);
    const samplesPerPeak = totalSamples / totalPeaks;

    state.waveformPeaks = new Array(totalPeaks);
    for (let i = 0; i < totalPeaks; i++) {
        const start = Math.floor(i * samplesPerPeak);
        const end = Math.min(Math.floor((i + 1) * samplesPerPeak), totalSamples);
        let min = 1, max = -1;
        for (let s = start; s < end; s++) {
            const sample = (ch0[s] + ch1[s]) * 0.5;
            if (sample < min) min = sample;
            if (sample > max) max = sample;
        }
        state.waveformPeaks[i] = { min, max };
    }
}

export function buildWaveformCache() {
    if (!state.waveformPeaks || !state.audioBuffer) return;

    const primary = state.selectedClub ? state.selectedClub.colors.primary : '#006633';
    const peaksPerSec = SCROLL_VIS.PEAKS_PER_SEC;
    const totalPeaks = state.waveformPeaks.length;

    const cacheW = totalPeaks;
    const cacheH = elements.gameCanvas.height || 100;
    const midY = cacheH / 2;
    const amp = midY * 0.7;

    try {
        state.waveformCache = new OffscreenCanvas(cacheW, cacheH);
    } catch (e) {
        state.waveformCache = document.createElement('canvas');
        state.waveformCache.width = cacheW;
        state.waveformCache.height = cacheH;
    }
    state.waveformCacheCtx = state.waveformCache.getContext('2d');

    const ctx = state.waveformCacheCtx;

    // Create gradient for waveform
    const waveGrad = ctx.createLinearGradient(0, 0, 0, cacheH);
    waveGrad.addColorStop(0, primary);
    waveGrad.addColorStop(0.3, shadeColor(primary, 20));
    waveGrad.addColorStop(0.5, shadeColor(primary, 40));
    waveGrad.addColorStop(0.7, shadeColor(primary, 20));
    waveGrad.addColorStop(1, primary);

    // Draw the full waveform with gradient
    ctx.fillStyle = waveGrad;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.moveTo(0, midY);

    for (let i = 0; i < totalPeaks; i++) {
        ctx.lineTo(i, midY - state.waveformPeaks[i].max * amp);
    }
    for (let i = totalPeaks - 1; i >= 0; i--) {
        ctx.lineTo(i, midY - state.waveformPeaks[i].min * amp);
    }
    ctx.closePath();
    ctx.fill();

    // Brighter center line overlay
    ctx.globalAlpha = 0.15;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, midY);
    for (let i = 0; i < totalPeaks; i++) {
        const avg = (state.waveformPeaks[i].max + state.waveformPeaks[i].min) / 2;
        ctx.lineTo(i, midY - avg * amp * 0.5);
    }
    ctx.stroke();

    ctx.globalAlpha = 1;
    state.waveformCacheReady = true;
}

// Helper to lighten/darken a hex color
function shadeColor(color, percent) {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, Math.max(0, (num >> 16) + amt));
    const G = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amt));
    const B = Math.min(255, Math.max(0, (num & 0x0000FF) + amt));
    return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}

export function drawVisualizer() {
    if (!state.canvasCtx) return;

    const canvas = elements.gameCanvas;
    const w = canvas.width;
    const h = canvas.height;
    const primary = state.selectedClub ? state.selectedClub.colors.primary : '#006633';
    const midY = h / 2;
    const ctx = state.canvasCtx;

    // Current audio time
    const audioElapsed = state.audioContext ? state.audioContext.currentTime - state.audioStartTime : 0;

    // Scrolling time window
    const leadTime = SCROLL_VIS.LEAD_TIME;
    const trailTime = SCROLL_VIS.TRAIL_TIME;
    const totalWindow = leadTime + trailTime;
    const timeStart = audioElapsed - trailTime;
    const timeEnd = audioElapsed + leadTime;
    const hitLineX = (trailTime / totalWindow) * w;
    const pxPerSec = w / totalWindow;

    function timeToX(t) {
        return ((t - timeStart) / totalWindow) * w;
    }

    // --- Background with gradient ---
    ctx.clearRect(0, 0, w, h);

    // Base gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#0d0d1a');
    bgGrad.addColorStop(0.3, '#151528');
    bgGrad.addColorStop(0.5, '#1a1a30');
    bgGrad.addColorStop(0.7, '#151528');
    bgGrad.addColorStop(1, '#0d0d1a');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Subtle horizontal scan lines
    if (!state.settings.reducedEffects) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
        for (let y = 0; y < h; y += 4) {
            ctx.fillRect(0, y, w, 1);
        }
    }

    // Center line glow
    const centerGlow = ctx.createLinearGradient(0, midY - 15, 0, midY + 15);
    centerGlow.addColorStop(0, 'rgba(255,255,255,0)');
    centerGlow.addColorStop(0.5, 'rgba(255,255,255,0.03)');
    centerGlow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = centerGlow;
    ctx.fillRect(0, midY - 15, w, 30);

    // --- Scrolling waveform (cached blit) ---
    if (state.waveformCacheReady && state.waveformCache) {
        const peaksPerSec = SCROLL_VIS.PEAKS_PER_SEC;
        const srcX = Math.max(0, Math.floor(timeStart * peaksPerSec));
        const srcEnd = Math.min(state.waveformCache.width, Math.ceil(timeEnd * peaksPerSec));
        const srcW = srcEnd - srcX;
        if (srcW > 0) {
            ctx.drawImage(state.waveformCache, srcX, 0, srcW, state.waveformCache.height, 0, 0, w, h);
        }
    } else if (state.waveformPeaks) {
        // Fallback: draw waveform directly (reduced quality for performance)
        // Sample every 2 pixels to reduce lineTo calls by 50%
        const peaksPerSec = SCROLL_VIS.PEAKS_PER_SEC;
        const amp = midY * 0.7;
        const step = 2;  // Sample every 2 pixels

        ctx.fillStyle = primary;
        ctx.globalAlpha = 0.25;
        ctx.beginPath();
        ctx.moveTo(0, midY);

        // Cache peak indices to avoid redundant calculations
        const peakIndices = new Int32Array(Math.ceil(w / step) + 1);
        for (let i = 0, col = 0; col < w; col += step, i++) {
            const t = timeStart + (col / w) * totalWindow;
            peakIndices[i] = Math.floor(t * peaksPerSec);
        }

        // Draw upper edge
        for (let i = 0, col = 0; col < w; col += step, i++) {
            const peakIdx = peakIndices[i];
            if (peakIdx >= 0 && peakIdx < state.waveformPeaks.length) {
                ctx.lineTo(col, midY - state.waveformPeaks[peakIdx].max * amp);
            } else {
                ctx.lineTo(col, midY);
            }
        }
        // Draw lower edge (reverse, reusing cached indices)
        for (let i = peakIndices.length - 1, col = w - 1; col >= 0; col -= step, i--) {
            const peakIdx = peakIndices[Math.max(0, i)];
            if (peakIdx >= 0 && peakIdx < state.waveformPeaks.length) {
                ctx.lineTo(col, midY - state.waveformPeaks[peakIdx].min * amp);
            } else {
                ctx.lineTo(col, midY);
            }
        }
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
    }

    // --- Timeline ticks (every 0.5s along bottom edge) ---
    {
        const tickStart = Math.ceil(timeStart * 2) / 2;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 1;
        for (let t = tickStart; t <= timeEnd; t += 0.5) {
            const tx = timeToX(t);
            if (tx < 0 || tx > w) continue;
            const isWhole = Math.abs(t - Math.round(t)) < 0.01;
            const tickH = isWhole ? 8 : 4;
            ctx.globalAlpha = isWhole ? 0.18 : 0.08;
            ctx.beginPath();
            ctx.moveTo(tx, h);
            ctx.lineTo(tx, h - tickH);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
    }

    // --- Timing zone bands around hit line (gradient-edged) ---
    const okHalfW = (state.activeTiming.OK / 1000) * pxPerSec;
    const goodHalfW = (state.activeTiming.GOOD / 1000) * pxPerSec;
    const perfectHalfW = (state.activeTiming.PERFECT / 1000) * pxPerSec;

    // OK zone gradient (orange) - outer ring
    const okGrad = ctx.createLinearGradient(hitLineX - okHalfW, 0, hitLineX + okHalfW, 0);
    okGrad.addColorStop(0, 'rgba(255,170,0,0)');
    okGrad.addColorStop(0.15, 'rgba(255,170,0,0.06)');
    okGrad.addColorStop(0.5, 'rgba(255,170,0,0.08)');
    okGrad.addColorStop(0.85, 'rgba(255,170,0,0.06)');
    okGrad.addColorStop(1, 'rgba(255,170,0,0)');
    ctx.fillStyle = okGrad;
    ctx.fillRect(hitLineX - okHalfW, 0, okHalfW * 2, h);

    // GOOD zone gradient (lime green)
    const goodGrad = ctx.createLinearGradient(hitLineX - goodHalfW, 0, hitLineX + goodHalfW, 0);
    goodGrad.addColorStop(0, 'rgba(136,255,0,0)');
    goodGrad.addColorStop(0.2, 'rgba(136,255,0,0.07)');
    goodGrad.addColorStop(0.5, 'rgba(136,255,0,0.1)');
    goodGrad.addColorStop(0.8, 'rgba(136,255,0,0.07)');
    goodGrad.addColorStop(1, 'rgba(136,255,0,0)');
    ctx.fillStyle = goodGrad;
    ctx.fillRect(hitLineX - goodHalfW, 0, goodHalfW * 2, h);

    // PERFECT zone gradient (cyan-green) - inner core
    const perfectGrad = ctx.createLinearGradient(hitLineX - perfectHalfW, 0, hitLineX + perfectHalfW, 0);
    perfectGrad.addColorStop(0, 'rgba(0,255,136,0)');
    perfectGrad.addColorStop(0.25, 'rgba(0,255,136,0.12)');
    perfectGrad.addColorStop(0.5, 'rgba(0,255,136,0.18)');
    perfectGrad.addColorStop(0.75, 'rgba(0,255,136,0.12)');
    perfectGrad.addColorStop(1, 'rgba(0,255,136,0)');
    ctx.fillStyle = perfectGrad;
    ctx.fillRect(hitLineX - perfectHalfW, 0, perfectHalfW * 2, h);

    // Vertical glow in perfect zone
    const perfectVertGlow = ctx.createLinearGradient(0, 0, 0, h);
    perfectVertGlow.addColorStop(0, 'rgba(0,255,136,0.1)');
    perfectVertGlow.addColorStop(0.3, 'rgba(0,255,136,0)');
    perfectVertGlow.addColorStop(0.7, 'rgba(0,255,136,0)');
    perfectVertGlow.addColorStop(1, 'rgba(0,255,136,0.1)');
    ctx.fillStyle = perfectVertGlow;
    ctx.fillRect(hitLineX - perfectHalfW, 0, perfectHalfW * 2, h);

    // Zone boundary lines with gradient fade
    ctx.lineWidth = 1;
    for (const [halfW, color] of [[okHalfW, '255,170,0'], [goodHalfW, '136,255,0'], [perfectHalfW, '0,255,136']]) {
        const lineGrad = ctx.createLinearGradient(0, 0, 0, h);
        lineGrad.addColorStop(0, `rgba(${color},0.3)`);
        lineGrad.addColorStop(0.2, `rgba(${color},0.08)`);
        lineGrad.addColorStop(0.5, `rgba(${color},0.15)`);
        lineGrad.addColorStop(0.8, `rgba(${color},0.08)`);
        lineGrad.addColorStop(1, `rgba(${color},0.3)`);
        ctx.strokeStyle = lineGrad;
        ctx.beginPath();
        ctx.moveTo(hitLineX - halfW, 0);
        ctx.lineTo(hitLineX - halfW, h);
        ctx.moveTo(hitLineX + halfW, 0);
        ctx.lineTo(hitLineX + halfW, h);
        ctx.stroke();
    }

    // --- Beat markers ---
    const beatR = SCROLL_VIS.BEAT_RADIUS;
    const leadPx = leadTime * pxPerSec;
    const beatRMargin = beatR * 3;

    // Modifier flags
    const isMirror = state.activeModifiers?.mirror || false;
    const isHidden = state.activeModifiers?.hidden || false;
    const hiddenFadeStart = MODIFIERS.hidden.fadeStartPercent;
    const hiddenFadeEnd = MODIFIERS.hidden.fadeEndPercent;

    // Helper function for mirror mode - transforms X coordinate
    function applyMirror(x) {
        return isMirror ? w - x : x;
    }

    // Find the next 5 upcoming beat indices (cached to avoid array recreation)
    if (_upcomingBeatsCache.lastNextBeatIndex !== state.nextBeatIndex) {
        _upcomingBeatsCache.count = 0;
        for (let i = state.nextBeatIndex; i < state.detectedBeats.length && _upcomingBeatsCache.count < 5; i++) {
            const beat = state.detectedBeats[i];
            const beatTime = typeof beat === 'object' ? beat.time : beat;
            const x = timeToX(beatTime);
            if (x >= hitLineX - okHalfW) {
                _upcomingBeatsCache.indices[_upcomingBeatsCache.count++] = i;
            }
        }
        _upcomingBeatsCache.lastNextBeatIndex = state.nextBeatIndex;
    }
    const upcomingBeats = _upcomingBeatsCache.indices;
    const upcomingBeatsCount = _upcomingBeatsCache.count;

    // Calculate visible beat range to avoid iterating all beats
    const minVisibleTime = audioElapsed - trailTime - 0.5;
    const maxVisibleTime = audioElapsed + leadTime + 0.5;

    // Find starting index using binary search approximation
    let startIdx = Math.max(0, state.nextBeatIndex - 10);
    const beats = state.detectedBeats;
    const beatsLen = beats.length;

    for (let i = startIdx; i < beatsLen; i++) {
        const beatData = beats[i];
        // Handle both normalized beat objects and raw numbers (backwards compatibility)
        const beatTime = typeof beatData === 'object' ? beatData.time : beatData;
        const isHoldBeat = typeof beatData === 'object' && beatData.type === 'hold';
        const beatEndTime = isHoldBeat ? beatData.endTime : beatTime;

        // For hold beats, check if ANY part is visible (start OR end)
        // Skip only if the entire beat (including hold duration) is too far in the past
        if (beatEndTime < minVisibleTime) continue;
        // Stop if beat start is too far in the future
        if (beatTime > maxVisibleTime) break;

        const x = timeToX(beatTime);

        // Check if this is the currently held beat (always show)
        const isBeingHeld = state.holdState.isHolding && state.holdState.currentBeatIndex === i;

        // For hold beats, check if any part is visible; for tap beats, check if in margin
        if (isHoldBeat) {
            const endX = timeToX(beatEndTime);
            // Skip only if entire hold is off-screen (both start and end)
            if (endX < -beatRMargin && x < -beatRMargin) continue;
            if (x > w + beatRMargin) continue;
        } else {
            if (x < -beatRMargin || x > w + beatRMargin) continue;
        }

        const isPast = i < state.nextBeatIndex;
        let color, alpha, radius;

        // Draw hold beats differently
        if (isHoldBeat) {
            const endTime = beatData.endTime;
            const endX = timeToX(endTime);

            if (isBeingHeld) {
                // Currently being held - always show with full visibility
                // Clamp startX to screen edge if it scrolled past
                const clampedX = Math.max(-beatR * 2, x);
                drawHoldBeat(ctx, clampedX, endX, midY, beatR, state.holdState.holdProgress, '#00aaff', 1, state.holdState.wasBroken);
                continue;
            } else if (isPast) {
                const result = state.beatResults[i];
                if (result && result !== 'miss') continue;
                color = BEAT_RESULT_COLORS.miss;
                const trailPx = trailTime * pxPerSec;
                // Use end position for fade calculation on long holds
                const fadeRef = Math.max(x, endX);
                alpha = Math.max(0, fadeRef / trailPx);
                alpha = alpha * alpha;
                drawHoldBeat(ctx, x, endX, midY, beatR * 0.8, 0, color, alpha, false);
                continue;
            } else {
                // Upcoming hold beat
                const distFromRight = isMirror ? x : w - x;
                const approach = Math.min(1, distFromRight / leadPx);
                alpha = 0.4 + 0.6 * approach;
                color = '#00aaff';  // Blue for hold beats

                // Check if in hit zone
                const distToHitLine = Math.abs(x - hitLineX);
                if (distToHitLine < okHalfW) {
                    if (distToHitLine < perfectHalfW) {
                        color = '#00ffcc';
                    } else if (distToHitLine < goodHalfW) {
                        color = '#00ddaa';
                    }
                    alpha = 1;
                }

                drawHoldBeat(ctx, x, endX, midY, beatR, 0, color, alpha, false);
                continue;
            }
        }

        // Standard tap beat drawing
        if (isPast) {
            const result = state.beatResults[i];
            if (result && result !== 'miss') continue;

            color = BEAT_RESULT_COLORS.miss;
            const trailPx = trailTime * pxPerSec;
            alpha = Math.max(0, x / trailPx);
            alpha = alpha * alpha;
            radius = beatR * 0.8;
        } else {
            color = '#ffcc00';
            const distFromRight = isMirror ? x : w - x;
            const approach = Math.min(1, distFromRight / leadPx);
            radius = beatR * (0.5 + 0.7 * approach);
            alpha = 0.4 + 0.6 * approach;

            // Hidden modifier: fade out beats as they approach hit line
            if (isHidden) {
                const approachProgress = 1 - approach;  // 0 = just spawned, 1 = at hit line
                if (approachProgress >= hiddenFadeStart) {
                    const fadeProgress = (approachProgress - hiddenFadeStart) / (hiddenFadeEnd - hiddenFadeStart);
                    alpha *= Math.max(0, 1 - fadeProgress);
                }
            }

            // Enhanced motion trails (#3) - more trails at higher combos
            if (approach > 0.2 && approach < 0.95) {
                const comboMult = getComboMultiplier();
                const trailCount = comboMult >= 2 ? 5 : comboMult >= 1.5 ? 4 : 3;
                const trailIntensity = 0.15 + (comboMult - 1) * 0.05;

                for (let t = 1; t <= trailCount; t++) {
                    const trailX = x + t * 10;
                    if (trailX > w) break;
                    ctx.globalAlpha = alpha * (trailIntensity - t * 0.03);
                    ctx.beginPath();
                    ctx.arc(trailX, midY, radius * (0.75 - t * 0.08), 0, Math.PI * 2);
                    ctx.fillStyle = color;
                    ctx.fill();
                }

                // Glow trail for high combos
                if (comboMult >= 2 && !state.settings.reducedEffects) {
                    ctx.globalAlpha = alpha * 0.1;
                    ctx.beginPath();
                    ctx.arc(x + 8, midY, radius * 1.3, 0, Math.PI * 2);
                    ctx.fillStyle = color;
                    ctx.fill();
                }
            }
        }

        if (alpha < 0.02) continue;

        // Beat enters the hit zone
        const distToHitLine = Math.abs(x - hitLineX);
        const isInHitZone = !isPast && distToHitLine < okHalfW;
        let strokeColor = '#ffffff';
        let strokeWidth = 2;

        if (isInHitZone) {
            if (distToHitLine < perfectHalfW) {
                color = '#00ff88';
                strokeColor = '#ffffff';
                strokeWidth = 3;
            } else if (distToHitLine < goodHalfW) {
                color = '#88ff00';
                strokeColor = '#ccffcc';
                strokeWidth = 2.5;
            } else {
                color = '#ffaa00';
                strokeColor = '#ffddaa';
                strokeWidth = 2.5;
            }

            radius *= 1.15;
            alpha = 1;

            const pulsePhase = (performance.now() % 400) / 400;
            const pulseAlpha = 0.15 + Math.sin(pulsePhase * Math.PI * 2) * 0.1;
            ctx.beginPath();
            ctx.arc(x, midY, radius + 8, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.globalAlpha = pulseAlpha;
            ctx.fill();
        }

        ctx.globalAlpha = alpha;

        // Approach indicator on next 5 upcoming beats
        let upcomingIdx = -1;
        for (let u = 0; u < upcomingBeatsCount; u++) {
            if (upcomingBeats[u] === i) { upcomingIdx = u; break; }
        }
        if (upcomingIdx !== -1 && !isPast) {
            const timeUntil = beatTime - audioElapsed;
            const countdown = 1.5;
            const ringProgress = Math.max(0, Math.min(1, timeUntil / countdown));
            const fill = 1 - ringProgress;
            const ringRadius = radius * (1 + ringProgress * 0.8);

            const queueFade = 1 / (1 + upcomingIdx * 0.75);

            // Background track ring
            ctx.beginPath();
            ctx.arc(x, midY, ringRadius, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255,255,255,0.12)';
            ctx.lineWidth = 3;
            ctx.globalAlpha = alpha * queueFade;
            ctx.stroke();

            // Filling progress arc
            const sweepAngle = fill * Math.PI * 2;
            const arcWidth = 2 + fill * 2;
            let arcColor;
            if (fill < 0.6) {
                arcColor = '#ffffff';
            } else if (fill < 0.85) {
                arcColor = primary;
            } else {
                arcColor = '#00ff88';
            }
            ctx.beginPath();
            ctx.arc(x, midY, ringRadius, -Math.PI / 2, -Math.PI / 2 + sweepAngle, false);
            ctx.strokeStyle = arcColor;
            ctx.lineWidth = arcWidth;
            ctx.globalAlpha = alpha * (0.4 + 0.6 * fill) * queueFade;
            ctx.stroke();

            // Countdown text
            if (timeUntil > 0.05 && timeUntil <= countdown) {
                const label = timeUntil.toFixed(1);
                ctx.font = upcomingIdx === 0 ? 'bold 11px monospace' : '10px monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                ctx.fillStyle = arcColor;
                ctx.globalAlpha = alpha * (0.5 + 0.5 * fill) * queueFade;
                ctx.fillText(label, x, midY - ringRadius - 4);
            }

            // Urgency pulse on closest beat
            if (upcomingIdx === 0 && timeUntil < 0.3 && timeUntil > 0) {
                const urgency = 1 - (timeUntil / 0.3);
                ctx.beginPath();
                ctx.arc(x, midY, radius + 5 + urgency * 3, 0, Math.PI * 2);
                ctx.strokeStyle = '#00ff88';
                ctx.lineWidth = 1.5;
                ctx.globalAlpha = alpha * urgency * 0.5;
                ctx.stroke();
            }

            ctx.globalAlpha = alpha;
        }

        // Main circle
        ctx.beginPath();
        ctx.arc(x, midY, radius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeWidth;
        ctx.stroke();

        ctx.globalAlpha = 1;
    }

    // --- Beat hit effects (expanding rings) ---
    {
        const now = performance.now();
        for (let i = state.beatHitEffects.length - 1; i >= 0; i--) {
            const fx = state.beatHitEffects[i];
            const elapsed = now - fx.spawnTime;
            if (elapsed > 400) {
                state.beatHitEffects[i] = state.beatHitEffects[state.beatHitEffects.length - 1];
                state.beatHitEffects.pop();
                continue;
            }
            const progress = elapsed / 400;
            const ringR = beatR * (1 + progress * 1.5);
            const ringAlpha = (1 - progress) * 0.6;
            const bx = timeToX(fx.beatTime);
            if (bx < -30 || bx > w + 30) continue;

            ctx.beginPath();
            ctx.arc(bx, midY, ringR, 0, Math.PI * 2);
            ctx.strokeStyle = fx.color;
            ctx.lineWidth = 3 * (1 - progress);
            ctx.globalAlpha = ringAlpha;
            ctx.stroke();

            if (progress > 0.1) {
                const p2 = (progress - 0.1) / 0.9;
                const r2 = beatR * (1 + p2 * 2);
                ctx.beginPath();
                ctx.arc(bx, midY, r2, 0, Math.PI * 2);
                ctx.lineWidth = 2 * (1 - p2);
                ctx.globalAlpha = (1 - p2) * 0.3;
                ctx.stroke();
            }
        }
        ctx.globalAlpha = 1;
    }

    // --- PERFECT hit particles (using object pool) ---
    {
        const now = performance.now();
        for (let i = state.hitParticles.length - 1; i >= 0; i--) {
            const p = state.hitParticles[i];
            const elapsed = now - p.spawnTime;
            if (elapsed > 350) {
                // Return to pool before removing
                releaseParticle(p);
                state.hitParticles[i] = state.hitParticles[state.hitParticles.length - 1];
                state.hitParticles.pop();
                continue;
            }
            const progress = elapsed / 350;
            const px = timeToX(p.beatTime) + p.vx * elapsed * 0.15;
            const py = midY + p.vy * elapsed * 0.15 + 0.0003 * elapsed * elapsed;
            const size = 3 * (1 - progress * 0.5);
            ctx.fillStyle = p.color;
            ctx.globalAlpha = (1 - progress) * 0.8;
            ctx.fillRect(px - size / 2, py - size / 2, size, size);
        }
        ctx.globalAlpha = 1;
    }

    // --- Hit line (multi-layer glow) with dynamic color (#4) ---
    const comboMult = getComboMultiplier();
    let hitLineColor = primary;
    let hitLineGlow = primary;
    let hitLineIntensity = 1;

    // Dynamic hit line color based on combo multiplier
    if (comboMult >= 3) {
        hitLineColor = '#ff3300';  // Red-orange at max combo
        hitLineGlow = '#ff6600';
        hitLineIntensity = 1.5;
    } else if (comboMult >= 2.5) {
        hitLineColor = '#ff6600';  // Orange
        hitLineGlow = '#ff8800';
        hitLineIntensity = 1.35;
    } else if (comboMult >= 2) {
        hitLineColor = '#ffaa00';  // Gold
        hitLineGlow = '#ffcc00';
        hitLineIntensity = 1.2;
    } else if (comboMult >= 1.5) {
        hitLineColor = '#ffcc00';  // Yellow
        hitLineGlow = '#ffdd44';
        hitLineIntensity = 1.1;
    }

    // Animated pulse for high combos
    const hitLinePulse = comboMult >= 1.5 ? (1 + Math.sin(performance.now() / 150) * 0.15 * (comboMult - 1)) : 1;

    // Outer glow (widest, most transparent)
    ctx.strokeStyle = hitLineGlow;
    ctx.lineWidth = 14 * hitLinePulse;
    ctx.globalAlpha = 0.08 * hitLineIntensity;
    ctx.beginPath();
    ctx.moveTo(hitLineX, 0);
    ctx.lineTo(hitLineX, h);
    ctx.stroke();

    // Middle glow
    ctx.lineWidth = 8 * hitLinePulse;
    ctx.globalAlpha = 0.15 * hitLineIntensity;
    ctx.beginPath();
    ctx.moveTo(hitLineX, 0);
    ctx.lineTo(hitLineX, h);
    ctx.stroke();

    // Inner colored glow
    ctx.strokeStyle = hitLineColor;
    ctx.lineWidth = 4;
    ctx.globalAlpha = 0.4 * hitLineIntensity;
    ctx.beginPath();
    ctx.moveTo(hitLineX, 0);
    ctx.lineTo(hitLineX, h);
    ctx.stroke();

    // Core white line
    const coreGrad = ctx.createLinearGradient(0, 0, 0, h);
    coreGrad.addColorStop(0, 'rgba(255,255,255,1)');
    coreGrad.addColorStop(0.15, 'rgba(255,255,255,0.6)');
    coreGrad.addColorStop(0.5, 'rgba(255,255,255,0.85)');
    coreGrad.addColorStop(0.85, 'rgba(255,255,255,0.6)');
    coreGrad.addColorStop(1, 'rgba(255,255,255,1)');
    ctx.strokeStyle = coreGrad;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.moveTo(hitLineX, 0);
    ctx.lineTo(hitLineX, h);
    ctx.stroke();

    // Diamond markers with glow
    const dSize = 6;

    // Top diamond glow
    ctx.shadowColor = hitLineColor;
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.95;
    ctx.beginPath();
    ctx.moveTo(hitLineX, 0);
    ctx.lineTo(hitLineX + dSize, dSize);
    ctx.lineTo(hitLineX, dSize * 2);
    ctx.lineTo(hitLineX - dSize, dSize);
    ctx.closePath();
    ctx.fill();

    // Bottom diamond
    ctx.beginPath();
    ctx.moveTo(hitLineX, h);
    ctx.lineTo(hitLineX + dSize, h - dSize);
    ctx.lineTo(hitLineX, h - dSize * 2);
    ctx.lineTo(hitLineX - dSize, h - dSize);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    // Inner diamond highlight
    ctx.fillStyle = hitLineColor;
    ctx.globalAlpha = 0.6;
    const innerD = dSize * 0.5;
    ctx.beginPath();
    ctx.moveTo(hitLineX, dSize * 0.5);
    ctx.lineTo(hitLineX + innerD, dSize);
    ctx.lineTo(hitLineX, dSize * 1.5);
    ctx.lineTo(hitLineX - innerD, dSize);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(hitLineX, h - dSize * 0.5);
    ctx.lineTo(hitLineX + innerD, h - dSize);
    ctx.lineTo(hitLineX, h - dSize * 1.5);
    ctx.lineTo(hitLineX - innerD, h - dSize);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    // Beat flash effect on hit line
    if (state.beatFlashIntensity > 0) {
        // Wide flash
        ctx.strokeStyle = primary;
        ctx.lineWidth = 16;
        ctx.globalAlpha = state.beatFlashIntensity * 0.4;
        ctx.beginPath();
        ctx.moveTo(hitLineX, 0);
        ctx.lineTo(hitLineX, h);
        ctx.stroke();

        // Intense core flash
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 6;
        ctx.globalAlpha = state.beatFlashIntensity * 0.8;
        ctx.beginPath();
        ctx.moveTo(hitLineX, 0);
        ctx.lineTo(hitLineX, h);
        ctx.stroke();

        ctx.globalAlpha = 1;
        state.beatFlashIntensity *= 0.88;
        if (state.beatFlashIntensity < 0.01) state.beatFlashIntensity = 0;
    }

    // --- Edge vignette effect ---
    if (!state.settings.reducedEffects) {
        const vignetteL = ctx.createLinearGradient(0, 0, 40, 0);
        vignetteL.addColorStop(0, 'rgba(0,0,0,0.5)');
        vignetteL.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = vignetteL;
        ctx.fillRect(0, 0, 40, h);

        const vignetteR = ctx.createLinearGradient(w - 40, 0, w, 0);
        vignetteR.addColorStop(0, 'rgba(0,0,0,0)');
        vignetteR.addColorStop(1, 'rgba(0,0,0,0.5)');
        ctx.fillStyle = vignetteR;
        ctx.fillRect(w - 40, 0, 40, h);
    }
}
