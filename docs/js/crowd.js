// ============================================
// crowd.js — Pixel supporter crowd, particles, flags, flares, smoke
// ============================================

import { state } from './state.js';
import { elements } from './ui.js';
import { getComboMultiplier } from './input.js';

function shadeColor(hex, percent) {
    let r = parseInt(hex.slice(1, 3), 16);
    let g = parseInt(hex.slice(3, 5), 16);
    let b = parseInt(hex.slice(5, 7), 16);
    r = Math.min(255, Math.max(0, r + Math.round(r * percent / 100)));
    g = Math.min(255, Math.max(0, g + Math.round(g * percent / 100)));
    b = Math.min(255, Math.max(0, b + Math.round(b * percent / 100)));
    return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
}

export function initSupporters(canvasWidth, canvasHeight) {
    state.supporters = [];
    const PX = 3;
    const supporterW = 10 * PX;
    const spacing = 4;
    const cols = Math.floor(canvasWidth / (supporterW + spacing));
    const rows = 5;
    const supporterH = 14 * PX;
    const groundY = canvasHeight - supporterH - 4;

    const primary = state.selectedClub ? state.selectedClub.colors.primary : '#006633';
    const secondary = state.selectedClub ? state.selectedClub.colors.secondary : '#FFFFFF';

    const palette = [primary, secondary, shadeColor(primary, -30), shadeColor(primary, 30), shadeColor(secondary, -40)];
    const skinTones = ['#f5d0a9', '#d4a373', '#8d5524', '#c68642', '#e0ac69'];

    for (let row = 0; row < rows; row++) {
        const rowY = groundY - row * (14 * PX + 6);
        const rowScale = 0.7 + row * 0.15;
        const rowOffset = row % 2 === 0 ? 0 : (supporterW + spacing) / 2;
        for (let col = 0; col < cols; col++) {
            const x = col * (supporterW + spacing) + rowOffset;
            if (x + supporterW > canvasWidth) continue;
            const roll = Math.random();
            const hasFlag = roll < 0.08;
            const hasFlare = !hasFlag && roll < 0.18;
            const flareColors = ['#ff2200', '#00ff44', '#ff4400', '#ffcc00'];
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
                hasFlare: hasFlare,
                flareColor: flareColors[Math.floor(Math.random() * flareColors.length)],
                flareHand: Math.random() < 0.5 ? 'left' : 'right'
            });
        }
    }
    state.supporters.sort((a, b) => a.row - b.row);
}

function drawPixelRect(ctx, x, y, w, h, color, px) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.floor(x), Math.floor(y), w * px, h * px);
}

function drawSupporter(ctx, s, jumpOffset, armsUp, frenzy, now, coreoType) {
    const px = s.px;
    const baseX = Math.floor(s.x);
    const y = Math.floor(s.baseY + jumpOffset);

    // Coreo types 1-3: synchronized sway; type 0: individual rocking
    let rockX;
    if (coreoType >= 1) {
        rockX = Math.sin(now / 200) * 5;
    } else if (frenzy) {
        rockX = Math.sin(now / 120 + s.jumpPhase) * 3;
    } else {
        rockX = 0;
    }
    const x = Math.floor(baseX + rockX);

    if (frenzy && !state.settings.reducedEffects) {
        const glowPhase = (Math.sin(now / 200 + s.jumpPhase) + 1) * 0.5;
        const primary = state.selectedClub ? state.selectedClub.colors.primary : '#006633';
        ctx.fillStyle = primary;
        ctx.globalAlpha = 0.12 + glowPhase * 0.1;
        ctx.fillRect(x - px, y + 2 * px, 12 * px, 12 * px);
        ctx.globalAlpha = 1;
    }

    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(x + px, Math.floor(s.baseY + 2 * px), 8 * px, px);

    if (frenzy) {
        const kick = Math.sin(now / 100 + s.jumpPhase) > 0;
        if (kick) {
            drawPixelRect(ctx, x + 1 * px, y + 11 * px, 2, 3, '#222244', px);
            drawPixelRect(ctx, x + 7 * px, y + 12 * px, 2, 2, '#222244', px);
        } else {
            drawPixelRect(ctx, x + 1 * px, y + 12 * px, 2, 2, '#222244', px);
            drawPixelRect(ctx, x + 7 * px, y + 11 * px, 2, 3, '#222244', px);
        }
    } else {
        drawPixelRect(ctx, x + 2 * px, y + 11 * px, 2, 3, '#222244', px);
        drawPixelRect(ctx, x + 6 * px, y + 11 * px, 2, 3, '#222244', px);
    }

    // Tifo coreo (type 3): coordinated shirt color wave
    let shirtColor = s.shirtColor;
    if (coreoType === 3) {
        const primary = state.selectedClub ? state.selectedClub.colors.primary : '#006633';
        const secondary = state.selectedClub ? state.selectedClub.colors.secondary : '#FFFFFF';
        shirtColor = Math.sin(now / 400 + s.x / 40 + s.row * 1.5) > 0 ? primary : secondary;
    }
    drawPixelRect(ctx, x + 2 * px, y + 6 * px, 6, 5, shirtColor, px);

    if (coreoType === 2 && !s.hasFlag && !s.hasFlare) {
        // Scarf coreo: arms straight up holding scarf taut
        drawPixelRect(ctx, x - px, y + 1 * px, 2, 5, s.skinColor, px);
        drawPixelRect(ctx, x + 9 * px, y + 1 * px, 2, 5, s.skinColor, px);
        drawPixelRect(ctx, x - px, y, 2, 1, s.skinColor, px);
        drawPixelRect(ctx, x + 9 * px, y, 2, 1, s.skinColor, px);
    } else if (frenzy) {
        const armPhase = Math.sin(now / 150 + s.jumpPhase);
        if (armPhase > 0.3) {
            drawPixelRect(ctx, x - px, y + 1 * px, 2, 3, s.skinColor, px);
            drawPixelRect(ctx, x + 9 * px, y + 1 * px, 2, 3, s.skinColor, px);
            drawPixelRect(ctx, x - px, y, 2, 1, s.skinColor, px);
            drawPixelRect(ctx, x + 9 * px, y, 2, 1, s.skinColor, px);
        } else if (armPhase > -0.3) {
            drawPixelRect(ctx, x - px, y + 2 * px, 2, 4, s.skinColor, px);
            drawPixelRect(ctx, x + 9 * px, y + 5 * px, 3, 2, s.skinColor, px);
        } else {
            drawPixelRect(ctx, x - px, y + 4 * px, 3, 2, s.skinColor, px);
            drawPixelRect(ctx, x + 8 * px, y + 4 * px, 3, 2, s.skinColor, px);
        }
    } else if (armsUp) {
        drawPixelRect(ctx, x, y + 2 * px, 2, 4, s.skinColor, px);
        drawPixelRect(ctx, x + 8 * px, y + 2 * px, 2, 4, s.skinColor, px);
        drawPixelRect(ctx, x, y + 1 * px, 2, 1, s.skinColor, px);
        drawPixelRect(ctx, x + 8 * px, y + 1 * px, 2, 1, s.skinColor, px);
    } else {
        drawPixelRect(ctx, x, y + 7 * px, 2, 4, s.skinColor, px);
        drawPixelRect(ctx, x + 8 * px, y + 7 * px, 2, 4, s.skinColor, px);
    }

    drawPixelRect(ctx, x + 3 * px, y + 2 * px, 4, 4, s.skinColor, px);

    if (s.hasHat) {
        drawPixelRect(ctx, x + 2 * px, y + 1 * px, 6, 1, shirtColor, px);
        drawPixelRect(ctx, x + 3 * px, y, 4, 1, shirtColor, px);
    } else {
        drawPixelRect(ctx, x + 3 * px, y + 1 * px, 4, 1, '#222222', px);
    }

    if (frenzy) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x + 4 * px, y + 3 * px, px, px);
        ctx.fillRect(x + 6 * px, y + 3 * px, px, px);
        ctx.fillStyle = '#000000';
        ctx.fillRect(x + 5 * px, y + 5 * px, px, px);
    } else {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x + 4 * px, y + 3 * px, px, px);
        ctx.fillRect(x + 6 * px, y + 3 * px, px, px);
        ctx.fillStyle = '#000000';
        ctx.fillRect(x + 4 * px + 1, y + 3 * px + 1, Math.max(1, px - 1), Math.max(1, px - 1));
        ctx.fillRect(x + 6 * px + 1, y + 3 * px + 1, Math.max(1, px - 1), Math.max(1, px - 1));
    }

    if (coreoType === 2 && !s.hasFlag && !s.hasFlare) {
        // Scarf-up coreo: supporters hold scarves stretched above heads
        const primary = state.selectedClub ? state.selectedClub.colors.primary : '#006633';
        const secondary = state.selectedClub ? state.selectedClub.colors.secondary : '#FFFFFF';
        const scarfColor = s.row % 2 === 0 ? primary : secondary;
        const scarfWave = Math.sin(now / 300 + s.x / 40) * 2;
        const scarfY = y - px + Math.floor(scarfWave);
        drawPixelRect(ctx, x - 2 * px, scarfY, 14, 1, scarfColor, px);
        drawPixelRect(ctx, x - px, scarfY - px, 12, 1, scarfColor, px);
    } else if (s.hasScarf && s.scarfColor) {
        drawPixelRect(ctx, x + 2 * px, y + 5 * px, 6, 1, s.scarfColor, px);
        if (frenzy) {
            const scarfWave = Math.sin(now / 100 + s.jumpPhase) > 0 ? 1 : -1;
            drawPixelRect(ctx, x + (scarfWave > 0 ? 8 : -2) * px, y + 5 * px, 2, 1, s.scarfColor, px);
        }
    }
}

function spawnFrenzyParticles(w, h) {
    const count = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < count; i++) {
        state.frenzyParticles.push({
            x: Math.random() * w,
            y: h - 20 - Math.random() * 40,
            vx: (Math.random() - 0.5) * 1.5,
            vy: -(1.5 + Math.random() * 2.5),
            life: 1,
            decay: 0.01 + Math.random() * 0.015,
            size: 3 + Math.random() * 5,
            hue: Math.random() < 0.5 ? 0 : (15 + Math.random() * 30)
        });
    }
}

function updateAndDrawParticles(ctx, w, h) {
    for (let i = state.frenzyParticles.length - 1; i >= 0; i--) {
        const p = state.frenzyParticles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy *= 0.98;
        p.life -= p.decay;
        p.size *= 0.99;

        if (p.life <= 0 || p.y < -10) {
            state.frenzyParticles[i] = state.frenzyParticles[state.frenzyParticles.length - 1];
            state.frenzyParticles.pop();
            continue;
        }

        const alpha = p.life * 0.9;
        const px = Math.max(2, Math.floor(p.size));
        ctx.fillStyle = `hsla(${p.hue}, 100%, ${50 + (1 - p.life) * 30}%, ${alpha})`;
        ctx.fillRect(Math.floor(p.x), Math.floor(p.y), px, px);
        if (px > 3) {
            ctx.fillStyle = `hsla(${p.hue + 20}, 100%, 85%, ${alpha * 0.7})`;
            ctx.fillRect(Math.floor(p.x) + 1, Math.floor(p.y) + 1, px - 2, px - 2);
        }
    }
}

function drawFeverText(ctx, w, h, now, yPos) {
    const primary = state.selectedClub ? state.selectedClub.colors.primary : '#006633';

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

    ctx.font = 'bold 26px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 4;
    ctx.strokeText('FEVER!', 0, 0);

    const hue = (now / 5) % 60;
    ctx.fillStyle = `hsl(${hue}, 100%, 55%)`;
    ctx.fillText('FEVER!', 0, 0);

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.restore();
}

function drawFlag(ctx, s, jumpOffset, now) {
    const px = s.px;
    const baseX = Math.floor(s.x);
    const rockX = Math.sin(now / 120 + s.jumpPhase) * 3;
    const x = Math.floor(baseX + rockX);
    const y = Math.floor(s.baseY + jumpOffset);

    const primary = state.selectedClub ? state.selectedClub.colors.primary : '#006633';
    const secondary = state.selectedClub ? state.selectedClub.colors.secondary : '#FFFFFF';

    const poleX = x + 5 * px;
    const poleLen = 10 * px;
    const poleTop = y - poleLen;
    const poleBottom = y + 2 * px;
    ctx.fillStyle = '#888888';
    ctx.fillRect(poleX, poleTop, px, poleBottom - poleTop);

    const flagW = 8 * px;
    const flagH = 5 * px;
    const wavePhase = now / 200 + s.jumpPhase;

    ctx.save();
    for (let col = 0; col < flagW; col += px) {
        const t = col / flagW;
        const wave = Math.sin(wavePhase + t * 4) * (2 + t * 4);
        const sliceX = poleX + px + col;
        const sliceY = poleTop + wave;

        ctx.fillStyle = s.flagColor;
        ctx.fillRect(sliceX, sliceY, px, flagH);

        if (s.flagStripe) {
            const stripeColor = s.flagColor === primary ? secondary : primary;
            ctx.fillStyle = stripeColor;
            ctx.fillRect(sliceX, sliceY + 3 * px, px, px);
        }
    }
    ctx.restore();
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

    for (let i = 0; i < 2; i++) {
        state.smokeParticles.push({
            x: handX + px + (Math.random() - 0.5) * 4 * px,
            y: flareY - 6 * px,
            vx: (Math.random() - 0.5) * 0.8,
            vy: -(0.4 + Math.random() * 0.8),
            life: 1,
            decay: 0.005 + Math.random() * 0.005,
            size: 4 + Math.random() * 6,
            r: smokeR, g: smokeG, b: smokeB
        });
    }
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

        const alpha = p.life * 0.35;
        const sz = Math.floor(p.size);
        ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${alpha})`;
        ctx.fillRect(Math.floor(p.x - sz / 2), Math.floor(p.y - sz / 2), sz, sz);
    }
    if (state.smokeParticles.length > 300) {
        state.smokeParticles.splice(0, state.smokeParticles.length - 300);
    }
}

export function drawGameVisuals() {
    if (!state.gameVisualCtx) return;

    const canvas = elements.gameVisualCanvas;
    const w = canvas.width;
    const h = canvas.height;
    const ctx = state.gameVisualCtx;
    const now = performance.now();
    const multiplier = getComboMultiplier();
    const frenzy = state.playerCombo > 5;
    // Coreo cycles every 10 combos: 0=base, 1=sway+row-wave, 2=scarf-up, 3=tifo
    const coreoType = state.playerCombo >= 10 ? Math.floor(state.playerCombo / 10) % 4 : 0;

    if (state.supporters.length === 0) {
        initSupporters(w, h);
    }

    ctx.clearRect(0, 0, w, h);

    // Sky / stadium background gradient
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    if (frenzy && !state.settings.reducedEffects) {
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

    // Stadium railing
    ctx.fillStyle = frenzy ? 'rgba(255,100,0,0.12)' : 'rgba(255,255,255,0.08)';
    ctx.fillRect(0, h * 0.1, w, 3);

    // Beat-synced animation
    const timeSinceBeat = (now - state.crowdBeatTime) / 1000;
    const beatDecay = Math.max(0, 1 - timeSinceBeat * 4);

    // Jump height scales with combo multiplier
    const baseJump = 18 + (multiplier - 1) * 13;
    const jumpHeight = beatDecay * baseJump;
    const frenzyBounce = frenzy ? Math.abs(Math.sin(now / 150)) * (4 + multiplier * 2) : 0;

    const sway = Math.sin(now / 400) * 2;

    if (frenzy && beatDecay > 0.9 && !state.settings.reducedEffects) {
        spawnFrenzyParticles(w, h);
    }

    if (state.smokeParticles.length > 0) {
        updateAndDrawSmoke(ctx, w, h);
    }

    // Draw supporters, flags, and flares
    for (let i = 0; i < state.supporters.length; i++) {
        const s = state.supporters[i];

        let personalJump;
        if (coreoType === 1) {
            // Row-wave coreo: rows bounce in coordinated sequence
            const rowWave = Math.abs(Math.sin(now / 250 + s.row * (Math.PI / 2.5))) * multiplier * 3;
            personalJump = jumpHeight * s.jumpStrength + rowWave;
        } else {
            const phaseOffset = Math.sin(timeSinceBeat * 12 + s.jumpPhase) * 0.3;
            personalJump = jumpHeight * s.jumpStrength * (1 + phaseOffset);
        }
        const jumpY = -(personalJump + frenzyBounce + (beatDecay < 0.01 && !frenzy ? sway * 0.5 : 0));

        const armsUp = !frenzy && timeSinceBeat < 0.3 && s.jumpStrength > 0.7;

        if (frenzy && s.hasFlag) {
            drawFlag(ctx, s, jumpY, now);
        }

        drawSupporter(ctx, s, jumpY, armsUp, frenzy, now, coreoType);

        if (frenzy && s.hasFlare) {
            drawFlare(ctx, s, jumpY, now);
            if (!state.settings.reducedEffects && Math.random() < 0.3) {
                spawnSmoke(s, jumpY, now);
            }
        }
    }

    // Fire particles
    if (state.frenzyParticles.length > 0) {
        updateAndDrawParticles(ctx, w, h);
    }

    // Beat flash overlay
    if (beatDecay > 0.01) {
        const primary = state.selectedClub ? state.selectedClub.colors.primary : '#006633';
        ctx.fillStyle = frenzy ? '#ff4400' : primary;
        ctx.globalAlpha = beatDecay * (frenzy ? 0.15 : 0.08);
        ctx.fillRect(0, 0, w, h);
        ctx.globalAlpha = 1;
    }

    // --- HUD text stack: FEVER -> Feedback -> Combo ---
    if (frenzy && !state.wasFrenzy) {
        state.frenzyStartTime = now;
        state.wasFrenzy = true;
    } else if (!frenzy && state.wasFrenzy) {
        state.wasFrenzy = false;
    }

    let hudY = 22;

    // 1) FEVER! text
    if (frenzy) {
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

        ctx.globalAlpha = drawAlpha;
        ctx.font = `bold ${fontSize}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.strokeText(state.feedbackText, 0, 0);
        ctx.fillStyle = state.feedbackColor;
        ctx.fillText(state.feedbackText, 0, 0);

        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
        ctx.restore();

        state.feedbackAlpha = 1 - progress;
        if (state.feedbackAlpha <= 0) { state.feedbackAlpha = 0; state.feedbackText = ''; }

        hudY += 28;
    }

    // 3) Frenzy progress indicator (combo 2-5, pre-frenzy)
    if (state.comboDisplayCount >= 2 && state.comboDisplayCount <= 5 && !frenzy) {
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
        ctx.fillStyle = comboColor;
        ctx.fillText(comboStr, 0, 0);

        // Layer 3: multiplier suffix
        if (multiStr) {
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 16px monospace';
            const comboW = ctx.measureText(comboStr).width;
            const multiW = ctx.measureText(multiStr).width;
            ctx.fillText(multiStr, (comboW + multiW) / 2, 0);
        }

        ctx.shadowBlur = 0;
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
            // Background ring
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
