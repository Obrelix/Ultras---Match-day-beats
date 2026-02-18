// ============================================
// analytics.js - Performance analytics and chart rendering
// ============================================

import { ANALYTICS } from './config.js';
import { loadGameHistory, getOrCreateSession } from './storage.js';
import { state } from './state.js';

// ============================================
// Session Management
// ============================================

/**
 * Initialize session tracking for analytics
 */
export function initSession() {
    const session = getOrCreateSession();
    state.sessionId = session.sessionId;
    state.sessionStartTime = session.sessionStartTime;
    return session;
}

/**
 * Get current session statistics
 * @returns {Object} Session stats: gamesPlayed, avgAccuracy, bestScore, totalTime
 */
export function getSessionStats() {
    const history = loadGameHistory();
    const sessionId = state.sessionId;

    if (!sessionId) {
        return { gamesPlayed: 0, avgAccuracy: 0, bestScore: 0, totalTime: 0 };
    }

    // Filter to current session
    const sessionGames = history.filter(g => g.sessionId === sessionId);

    if (sessionGames.length === 0) {
        return { gamesPlayed: 0, avgAccuracy: 0, bestScore: 0, totalTime: 0 };
    }

    const gamesPlayed = sessionGames.length;
    const avgAccuracy = Math.round(
        sessionGames.reduce((sum, g) => sum + (g.accuracy || 0), 0) / gamesPlayed
    );
    const bestScore = Math.max(...sessionGames.map(g => g.score || 0));
    const totalTime = state.sessionStartTime ? Math.floor((Date.now() - state.sessionStartTime) / 1000) : 0;

    return { gamesPlayed, avgAccuracy, bestScore, totalTime };
}

// ============================================
// Analytics Calculations
// ============================================

/**
 * Calculate accuracy trend over recent games
 * @param {number} windowSize - Number of games to analyze
 * @returns {Object} { values: number[], labels: string[], trend: 'up'|'down'|'stable' }
 */
export function calculateAccuracyTrend(windowSize = ANALYTICS.TREND_WINDOW_SIZE) {
    const history = loadGameHistory();
    const recentGames = history.slice(0, windowSize).reverse(); // Oldest to newest

    if (recentGames.length < ANALYTICS.MIN_GAMES_FOR_TRENDS) {
        return { values: [], labels: [], trend: 'stable', hasData: false };
    }

    const values = recentGames.map(g => g.accuracy || 0);
    const labels = recentGames.map((g, i) => `Game ${i + 1}`);

    // Calculate trend direction
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    let trend = 'stable';
    if (secondAvg > firstAvg + 5) trend = 'up';
    else if (secondAvg < firstAvg - 5) trend = 'down';

    return { values, labels, trend, hasData: true };
}

/**
 * Calculate score progression over recent games
 * @param {number} windowSize - Number of games to analyze
 * @returns {Object} { values: number[], labels: string[], trend: 'up'|'down'|'stable' }
 */
export function calculateScoreTrend(windowSize = ANALYTICS.TREND_WINDOW_SIZE) {
    const history = loadGameHistory();
    const recentGames = history.slice(0, windowSize).reverse();

    if (recentGames.length < ANALYTICS.MIN_GAMES_FOR_TRENDS) {
        return { values: [], labels: [], trend: 'stable', hasData: false };
    }

    const values = recentGames.map(g => g.score || 0);
    const labels = recentGames.map((g, i) => `Game ${i + 1}`);

    // Calculate trend
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    let trend = 'stable';
    if (secondAvg > firstAvg * 1.1) trend = 'up';
    else if (secondAvg < firstAvg * 0.9) trend = 'down';

    return { values, labels, trend, hasData: true };
}

/**
 * Calculate hit distribution totals
 * @returns {Object} { perfect, good, ok, miss, total, hasData }
 */
export function calculateHitDistribution() {
    const history = loadGameHistory();

    if (history.length === 0) {
        return { perfect: 0, good: 0, ok: 0, miss: 0, total: 0, hasData: false };
    }

    const totals = history.reduce((acc, g) => {
        acc.perfect += g.perfectHits || 0;
        acc.good += g.goodHits || 0;
        acc.ok += g.okHits || 0;
        acc.miss += g.misses || 0;
        return acc;
    }, { perfect: 0, good: 0, ok: 0, miss: 0 });

    totals.total = totals.perfect + totals.good + totals.ok + totals.miss;
    totals.hasData = totals.total > 0;

    return totals;
}

/**
 * Get performance stats by club
 * @returns {Array} Array of { clubId, clubName, games, avgAccuracy, avgScore, bestScore }
 */
export function getClubStats() {
    const history = loadGameHistory();
    const clubMap = {};

    for (const game of history) {
        const clubId = game.clubId;
        if (!clubId) continue;

        if (!clubMap[clubId]) {
            clubMap[clubId] = {
                clubId,
                clubName: game.chantName?.split('_')[0] || clubId,
                games: 0,
                totalAccuracy: 0,
                totalScore: 0,
                bestScore: 0
            };
        }

        const club = clubMap[clubId];
        club.games++;
        club.totalAccuracy += game.accuracy || 0;
        club.totalScore += game.score || 0;
        club.bestScore = Math.max(club.bestScore, game.score || 0);
    }

    return Object.values(clubMap).map(club => ({
        ...club,
        avgAccuracy: Math.round(club.totalAccuracy / club.games),
        avgScore: Math.round(club.totalScore / club.games)
    })).sort((a, b) => b.games - a.games);
}

/**
 * Get best and worst performing chants
 * @returns {Object} { best: Array, worst: Array }
 */
export function getChantPerformance() {
    const history = loadGameHistory();
    const chantMap = {};

    for (const game of history) {
        const key = `${game.clubId}_${game.chantId}`;
        if (!game.chantId) continue;

        if (!chantMap[key]) {
            chantMap[key] = {
                clubId: game.clubId,
                chantId: game.chantId,
                chantName: game.chantName || game.chantId,
                plays: 0,
                totalAccuracy: 0,
                bestScore: 0
            };
        }

        const chant = chantMap[key];
        chant.plays++;
        chant.totalAccuracy += game.accuracy || 0;
        chant.bestScore = Math.max(chant.bestScore, game.score || 0);
    }

    const chants = Object.values(chantMap)
        .filter(c => c.plays >= 2) // Need at least 2 plays
        .map(c => ({
            ...c,
            avgAccuracy: Math.round(c.totalAccuracy / c.plays)
        }));

    // Sort by average accuracy
    const sorted = [...chants].sort((a, b) => b.avgAccuracy - a.avgAccuracy);

    return {
        best: sorted.slice(0, 3),
        worst: sorted.slice(-3).reverse()
    };
}

/**
 * Calculate learning curve for a specific chant
 * @param {string} clubId
 * @param {string} chantId
 * @returns {Object} { values: number[], dates: string[], improvement: number }
 */
export function calculateLearningCurve(clubId, chantId) {
    const history = loadGameHistory();
    const chantGames = history
        .filter(g => g.clubId === clubId && g.chantId === chantId)
        .reverse(); // Oldest first

    if (chantGames.length < 2) {
        return { values: [], dates: [], improvement: 0, hasData: false };
    }

    const values = chantGames.map(g => g.accuracy || 0);
    const dates = chantGames.map(g => {
        const date = new Date(g.timestamp);
        return `${date.getMonth() + 1}/${date.getDate()}`;
    });

    // Calculate improvement (first play vs best recent)
    const firstAccuracy = values[0];
    const recentBest = Math.max(...values.slice(-5));
    const improvement = recentBest - firstAccuracy;

    return { values, dates, improvement, hasData: true };
}

/**
 * Get overall analytics summary
 * @returns {Object} Summary stats
 */
export function getAnalyticsSummary() {
    const history = loadGameHistory();

    if (history.length === 0) {
        return {
            totalGames: 0,
            totalHits: 0,
            avgAccuracy: 0,
            avgScore: 0,
            bestScore: 0,
            bestCombo: 0,
            winRate: 0,
            hasData: false
        };
    }

    const totalGames = history.length;
    const wins = history.filter(g => g.won).length;

    const totalHits = history.reduce((sum, g) =>
        sum + (g.perfectHits || 0) + (g.goodHits || 0) + (g.okHits || 0), 0);

    const avgAccuracy = Math.round(
        history.reduce((sum, g) => sum + (g.accuracy || 0), 0) / totalGames
    );

    const avgScore = Math.round(
        history.reduce((sum, g) => sum + (g.score || 0), 0) / totalGames
    );

    const bestScore = Math.max(...history.map(g => g.score || 0));
    const bestCombo = Math.max(...history.map(g => g.maxCombo || 0));
    const winRate = Math.round((wins / totalGames) * 100);

    return {
        totalGames,
        totalHits,
        avgAccuracy,
        avgScore,
        bestScore,
        bestCombo,
        winRate,
        hasData: true
    };
}

// ============================================
// Chart Rendering (Pure Canvas)
// ============================================

/**
 * Render a line chart
 * @param {HTMLCanvasElement} canvas
 * @param {Object} data - { values: number[], labels: string[] }
 * @param {Object} options - { lineColor, fillColor, showDots, animate }
 */
export function renderLineChart(canvas, data, options = {}) {
    const ctx = canvas.getContext('2d');
    const { values, labels } = data;

    if (!values || values.length === 0) {
        drawEmptyState(ctx, canvas.width, canvas.height, 'No data yet');
        return;
    }

    const w = canvas.width;
    const h = canvas.height;
    const padding = { top: 20, right: 20, bottom: 30, left: 40 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    // Clear canvas
    ctx.clearRect(0, 0, w, h);

    // Calculate scales
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const range = maxVal - minVal || 1;
    const padding10 = range * 0.1;
    const yMin = Math.max(0, minVal - padding10);
    const yMax = maxVal + padding10;
    const yRange = yMax - yMin || 1;

    // Draw grid lines
    ctx.strokeStyle = ANALYTICS.COLORS.grid;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);

    for (let i = 0; i <= 4; i++) {
        const y = padding.top + (chartH * i / 4);
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(w - padding.right, y);
        ctx.stroke();
    }
    ctx.setLineDash([]);

    // Draw Y-axis labels
    ctx.fillStyle = ANALYTICS.COLORS.label;
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';

    for (let i = 0; i <= 4; i++) {
        const val = Math.round(yMax - (yRange * i / 4));
        const y = padding.top + (chartH * i / 4);
        ctx.fillText(val.toString(), padding.left - 5, y + 3);
    }

    // Calculate points
    const points = values.map((val, i) => ({
        x: padding.left + (i / (values.length - 1 || 1)) * chartW,
        y: padding.top + (1 - (val - yMin) / yRange) * chartH
    }));

    // Draw fill area
    if (options.fillColor !== false) {
        ctx.fillStyle = options.fillColor || ANALYTICS.COLORS.trendFill;
        ctx.beginPath();
        ctx.moveTo(points[0].x, padding.top + chartH);
        points.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.lineTo(points[points.length - 1].x, padding.top + chartH);
        ctx.closePath();
        ctx.fill();
    }

    // Draw line
    ctx.strokeStyle = options.lineColor || ANALYTICS.COLORS.trend;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    ctx.beginPath();
    points.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();

    // Draw dots
    if (options.showDots !== false) {
        points.forEach(p => {
            ctx.fillStyle = options.lineColor || ANALYTICS.COLORS.trend;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#1a1a2e';
            ctx.beginPath();
            ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    // Draw X-axis labels
    ctx.fillStyle = ANALYTICS.COLORS.label;
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';

    const labelStep = Math.ceil(labels.length / 6);
    labels.forEach((label, i) => {
        if (i % labelStep === 0) {
            const x = padding.left + (i / (labels.length - 1 || 1)) * chartW;
            ctx.fillText(label, x, h - 8);
        }
    });
}

/**
 * Render a donut/pie chart
 * @param {HTMLCanvasElement} canvas
 * @param {Array} segments - [{ value, color, label }]
 * @param {Object} options - { innerRadius, showLabels }
 */
export function renderPieChart(canvas, segments, options = {}) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    const total = segments.reduce((sum, s) => sum + (s.value || 0), 0);

    if (total === 0) {
        drawEmptyState(ctx, w, h, 'No hits recorded');
        return;
    }

    // Clear canvas
    ctx.clearRect(0, 0, w, h);

    const centerX = w / 2;
    const centerY = h / 2 - 10;
    const outerRadius = Math.min(w, h) / 2 - 30;
    const innerRadius = options.innerRadius ?? outerRadius * 0.6;

    let startAngle = -Math.PI / 2;

    // Draw segments
    segments.forEach(segment => {
        if (segment.value <= 0) return;

        const sliceAngle = (segment.value / total) * Math.PI * 2;
        const endAngle = startAngle + sliceAngle;

        ctx.fillStyle = segment.color;
        ctx.beginPath();
        ctx.arc(centerX, centerY, outerRadius, startAngle, endAngle);
        ctx.arc(centerX, centerY, innerRadius, endAngle, startAngle, true);
        ctx.closePath();
        ctx.fill();

        // Add subtle border
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();

        startAngle = endAngle;
    });

    // Draw center text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(total.toLocaleString(), centerX, centerY - 5);

    ctx.fillStyle = ANALYTICS.COLORS.label;
    ctx.font = '10px monospace';
    ctx.fillText('total hits', centerX, centerY + 10);

    // Draw legend
    if (options.showLabels !== false) {
        const legendY = h - 20;
        const legendWidth = segments.length * 70;
        const startX = (w - legendWidth) / 2;

        segments.forEach((segment, i) => {
            const x = startX + i * 70;

            // Color box
            ctx.fillStyle = segment.color;
            ctx.fillRect(x, legendY, 10, 10);

            // Label
            ctx.fillStyle = ANALYTICS.COLORS.label;
            ctx.font = '9px monospace';
            ctx.textAlign = 'left';
            const percent = Math.round((segment.value / total) * 100);
            ctx.fillText(`${segment.label} ${percent}%`, x + 14, legendY + 8);
        });
    }
}

/**
 * Render a horizontal bar chart
 * @param {HTMLCanvasElement} canvas
 * @param {Array} data - [{ label, value, color }]
 * @param {Object} options - { barHeight, showValues }
 */
export function renderBarChart(canvas, data, options = {}) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    if (!data || data.length === 0) {
        drawEmptyState(ctx, w, h, 'No data available');
        return;
    }

    // Clear canvas
    ctx.clearRect(0, 0, w, h);

    const padding = { top: 10, right: 20, bottom: 10, left: 80 };
    const chartW = w - padding.left - padding.right;
    const barHeight = options.barHeight || 20;
    const barGap = 8;

    const maxValue = Math.max(...data.map(d => d.value || 0)) || 1;

    data.forEach((item, i) => {
        const y = padding.top + i * (barHeight + barGap);
        const barWidth = (item.value / maxValue) * chartW;

        // Draw label
        ctx.fillStyle = ANALYTICS.COLORS.label;
        ctx.font = '10px monospace';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(item.label, padding.left - 8, y + barHeight / 2);

        // Draw bar background
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.fillRect(padding.left, y, chartW, barHeight);

        // Draw bar
        ctx.fillStyle = item.color || ANALYTICS.COLORS.trend;
        ctx.fillRect(padding.left, y, barWidth, barHeight);

        // Draw value
        if (options.showValues !== false && barWidth > 30) {
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 10px monospace';
            ctx.textAlign = 'left';
            ctx.fillText(item.value.toString(), padding.left + barWidth + 5, y + barHeight / 2);
        }
    });
}

/**
 * Draw empty state message on canvas
 */
function drawEmptyState(ctx, w, h, message) {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = ANALYTICS.COLORS.label;
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(message, w / 2, h / 2);
}

// ============================================
// Utility: Format time duration
// ============================================

export function formatDuration(seconds) {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins < 60) return `${mins}m ${secs}s`;
    const hours = Math.floor(mins / 60);
    return `${hours}h ${mins % 60}m`;
}
