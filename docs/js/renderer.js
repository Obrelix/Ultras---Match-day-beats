// ============================================
// renderer.js — Beat track visualizer (top canvas)
// ============================================

import { SCROLL_VIS, BEAT_RESULT_COLORS } from './config.js';
import { state } from './state.js';
import { elements } from './ui.js';

let _resizeHandler = null;

export function initVisualizer() {
    const canvas = elements.gameCanvas;
    state.canvasCtx = canvas.getContext('2d');

    function resizeCanvas() {
        const rect = canvas.getBoundingClientRect();
        canvas.width = Math.floor(rect.width);
        canvas.height = Math.floor(rect.height);

        if (state.audioBuffer) {
            computeWaveformPeaks();
            buildWaveformCache();
        }
    }
    resizeCanvas();

    // Remove previous handler to prevent accumulation across game rounds
    if (_resizeHandler) {
        window.removeEventListener('resize', _resizeHandler);
    }
    _resizeHandler = resizeCanvas;
    window.addEventListener('resize', resizeCanvas);
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

    // Subtle center-line glow
    const glowGrad = ctx.createLinearGradient(0, midY - 2, 0, midY + 2);
    glowGrad.addColorStop(0, 'rgba(255,255,255,0)');
    glowGrad.addColorStop(0.5, 'rgba(255,255,255,0.04)');
    glowGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, midY - 2, cacheW, 4);

    // Draw the full waveform
    ctx.fillStyle = primary;
    ctx.globalAlpha = 0.25;
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
    ctx.globalAlpha = 1;

    state.waveformCacheReady = true;
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

    // --- Background ---
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, w, h);

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
        const peaksPerSec = SCROLL_VIS.PEAKS_PER_SEC;
        const amp = midY * 0.7;

        ctx.fillStyle = primary;
        ctx.globalAlpha = 0.25;
        ctx.beginPath();
        ctx.moveTo(0, midY);

        for (let col = 0; col < w; col++) {
            const t = timeStart + (col / w) * totalWindow;
            const peakIdx = Math.floor(t * peaksPerSec);
            if (peakIdx >= 0 && peakIdx < state.waveformPeaks.length) {
                ctx.lineTo(col, midY - state.waveformPeaks[peakIdx].max * amp);
            } else {
                ctx.lineTo(col, midY);
            }
        }
        for (let col = w - 1; col >= 0; col--) {
            const t = timeStart + (col / w) * totalWindow;
            const peakIdx = Math.floor(t * peaksPerSec);
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

    // Simplified zone bands - use solid fills instead of gradients for performance
    // OK zone (orange)
    ctx.fillStyle = 'rgba(255,170,0,0.07)';
    ctx.fillRect(hitLineX - okHalfW, 0, okHalfW * 2, h);
    // GOOD zone (green)
    ctx.fillStyle = 'rgba(136,255,0,0.07)';
    ctx.fillRect(hitLineX - goodHalfW, 0, goodHalfW * 2, h);
    // PERFECT zone (cyan-green)
    ctx.fillStyle = 'rgba(0,255,136,0.12)';
    ctx.fillRect(hitLineX - perfectHalfW, 0, perfectHalfW * 2, h);

    // Zone boundary hairlines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    for (const halfW of [okHalfW, goodHalfW, perfectHalfW]) {
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

    // Find the next 5 upcoming beat indices (cache for countdown display)
    const upcomingBeats = [];
    for (let i = state.nextBeatIndex; i < state.detectedBeats.length && upcomingBeats.length < 5; i++) {
        const x = timeToX(state.detectedBeats[i]);
        if (x >= hitLineX - okHalfW) upcomingBeats.push(i);
    }

    // Calculate visible beat range to avoid iterating all beats
    const minVisibleTime = audioElapsed - trailTime - 0.5;
    const maxVisibleTime = audioElapsed + leadTime + 0.5;

    // Find starting index using binary search approximation
    let startIdx = Math.max(0, state.nextBeatIndex - 10);
    const beats = state.detectedBeats;
    const beatsLen = beats.length;

    for (let i = startIdx; i < beatsLen; i++) {
        const beatTime = beats[i];

        // Skip beats too far in the past
        if (beatTime < minVisibleTime) continue;
        // Stop if beats are too far in the future
        if (beatTime > maxVisibleTime) break;

        const x = timeToX(beatTime);
        if (x < -beatRMargin || x > w + beatRMargin) continue;

        const isPast = i < state.nextBeatIndex;
        let color, alpha, radius;

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
            const distFromRight = w - x;
            const approach = Math.min(1, distFromRight / leadPx);
            radius = beatR * (0.5 + 0.7 * approach);
            alpha = 0.4 + 0.6 * approach;

            // Motion trails
            if (approach > 0.2 && approach < 0.95) {
                for (let t = 1; t <= 3; t++) {
                    const trailX = x + t * 12;
                    if (trailX > w) break;
                    ctx.globalAlpha = alpha * (0.15 - t * 0.04);
                    ctx.beginPath();
                    ctx.arc(trailX, midY, radius * (0.7 - t * 0.1), 0, Math.PI * 2);
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
        const upcomingIdx = upcomingBeats.indexOf(i);
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

    // --- PERFECT hit particles ---
    {
        const now = performance.now();
        for (let i = state.hitParticles.length - 1; i >= 0; i--) {
            const p = state.hitParticles[i];
            const elapsed = now - p.spawnTime;
            if (elapsed > 350) {
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

    // --- Hit line (multi-layer glow) ---
    ctx.strokeStyle = primary;
    ctx.lineWidth = 8;
    ctx.globalAlpha = 0.15;
    ctx.beginPath();
    ctx.moveTo(hitLineX, 0);
    ctx.lineTo(hitLineX, h);
    ctx.stroke();

    ctx.lineWidth = 4;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.moveTo(hitLineX, 0);
    ctx.lineTo(hitLineX, h);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.moveTo(hitLineX, 0);
    ctx.lineTo(hitLineX, h);
    ctx.stroke();

    // Diamond markers
    const dSize = 5;
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.moveTo(hitLineX, 0);
    ctx.lineTo(hitLineX + dSize, dSize);
    ctx.lineTo(hitLineX, dSize * 2);
    ctx.lineTo(hitLineX - dSize, dSize);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(hitLineX, h);
    ctx.lineTo(hitLineX + dSize, h - dSize);
    ctx.lineTo(hitLineX, h - dSize * 2);
    ctx.lineTo(hitLineX - dSize, h - dSize);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    // Beat flash effect on hit line
    if (state.beatFlashIntensity > 0) {
        ctx.strokeStyle = primary;
        ctx.lineWidth = 10;
        ctx.globalAlpha = state.beatFlashIntensity * 0.6;
        ctx.beginPath();
        ctx.moveTo(hitLineX, 0);
        ctx.lineTo(hitLineX, h);
        ctx.stroke();
        ctx.globalAlpha = 1;
        state.beatFlashIntensity *= 0.9;
        if (state.beatFlashIntensity < 0.01) state.beatFlashIntensity = 0;
    }
}
