// ============================================
// beatWorker.js — Web Worker for beat detection (runs off main thread)
// ============================================

let BEAT_DETECTION = null;

function mixToMono(channelData, numChannels) {
    const ch0 = channelData[0];
    const ch1 = numChannels > 1 ? channelData[1] : ch0;
    const mono = new Float32Array(ch0.length);
    if (numChannels > 1) {
        for (let i = 0; i < ch0.length; i++) {
            mono[i] = (ch0[i] + ch1[i]) * 0.5;
        }
    } else {
        mono.set(ch0);
    }
    return mono;
}

function computeFFTMagnitude(windowed, fftSize) {
    const n = fftSize;
    const halfN = n / 2;

    const real = new Float32Array(n);
    const imag = new Float32Array(n);
    for (let i = 0; i < n; i++) {
        real[i] = windowed[i];
    }

    // Bit-reversal permutation
    let j = 0;
    for (let i = 0; i < n; i++) {
        if (i < j) {
            let tmp = real[i]; real[i] = real[j]; real[j] = tmp;
            tmp = imag[i]; imag[i] = imag[j]; imag[j] = tmp;
        }
        let m = n >> 1;
        while (m >= 1 && j >= m) {
            j -= m;
            m >>= 1;
        }
        j += m;
    }

    // Cooley-Tukey butterfly operations
    for (let size = 2; size <= n; size *= 2) {
        const halfSize = size >> 1;
        const angleStep = -2 * Math.PI / size;
        for (let i = 0; i < n; i += size) {
            for (let k = 0; k < halfSize; k++) {
                const angle = angleStep * k;
                const twRe = Math.cos(angle);
                const twIm = Math.sin(angle);
                const evenIdx = i + k;
                const oddIdx = i + k + halfSize;
                const tReal = twRe * real[oddIdx] - twIm * imag[oddIdx];
                const tImag = twRe * imag[oddIdx] + twIm * real[oddIdx];
                real[oddIdx] = real[evenIdx] - tReal;
                imag[oddIdx] = imag[evenIdx] - tImag;
                real[evenIdx] += tReal;
                imag[evenIdx] += tImag;
            }
        }
    }

    // Magnitude spectrum (positive frequencies only)
    const magnitude = new Float32Array(halfN);
    for (let i = 0; i < halfN; i++) {
        magnitude[i] = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]);
    }
    return magnitude;
}

function computeSpectralFlux(samples, sampleRate) {
    const fftSize = BEAT_DETECTION.FFT_SIZE;
    const hopSize = BEAT_DETECTION.HOP_SIZE;
    const numFrames = Math.floor((samples.length - fftSize) / hopSize) + 1;
    const numBins = fftSize >> 1;

    // Precompute Hann window
    const hannWindow = new Float32Array(fftSize);
    for (let i = 0; i < fftSize; i++) {
        hannWindow[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (fftSize - 1)));
    }

    // Precompute frequency band weights per bin (vocal-focused 5-band scheme)
    const binHz = sampleRate / fftSize;
    const bassCutoffBin = Math.floor(BEAT_DETECTION.BASS_CUTOFF_HZ / binHz);
    const lowVocalBin = Math.floor(BEAT_DETECTION.LOW_VOCAL_HZ / binHz);
    const vocalCoreBin = Math.floor(BEAT_DETECTION.VOCAL_CORE_HZ / binHz);
    const sibilanceBin = Math.floor(BEAT_DETECTION.SIBILANCE_HZ / binHz);

    const binWeights = new Float32Array(numBins);
    for (let bin = 0; bin < numBins; bin++) {
        if (bin <= bassCutoffBin) {
            binWeights[bin] = 0.0;
        } else if (bin <= lowVocalBin) {
            binWeights[bin] = BEAT_DETECTION.LOW_VOCAL_WEIGHT;
        } else if (bin <= vocalCoreBin) {
            binWeights[bin] = BEAT_DETECTION.VOCAL_CORE_WEIGHT;
        } else if (bin <= sibilanceBin) {
            binWeights[bin] = BEAT_DETECTION.SIBILANCE_WEIGHT;
        } else {
            binWeights[bin] = 0.0;
        }
    }

    let prevMagnitude = null;
    const spectralFlux = new Float32Array(numFrames);
    const windowed = new Float32Array(fftSize);

    for (let frame = 0; frame < numFrames; frame++) {
        const offset = frame * hopSize;

        for (let i = 0; i < fftSize; i++) {
            windowed[i] = samples[offset + i] * hannWindow[i];
        }

        const magnitude = computeFFTMagnitude(windowed, fftSize);

        if (prevMagnitude !== null) {
            let flux = 0;
            for (let bin = 0; bin < numBins; bin++) {
                const diff = magnitude[bin] - prevMagnitude[bin];
                if (diff > 0) {
                    flux += diff * binWeights[bin];
                }
            }
            spectralFlux[frame] = flux;
        }

        if (prevMagnitude === null) {
            prevMagnitude = new Float32Array(numBins);
        }
        prevMagnitude.set(magnitude);
    }

    return spectralFlux;
}

function smoothFlux(flux, windowSize) {
    const half = Math.floor(windowSize / 2);
    const smoothed = new Float32Array(flux.length);
    for (let i = 0; i < flux.length; i++) {
        const start = Math.max(0, i - half);
        const end = Math.min(flux.length - 1, i + half);
        let sum = 0;
        for (let j = start; j <= end; j++) {
            sum += flux[j];
        }
        smoothed[i] = sum / (end - start + 1);
    }
    return smoothed;
}

function refineOnsetTime(spectralFlux, peakFrame, frameDuration) {
    const prev = spectralFlux[peakFrame - 1];
    const curr = spectralFlux[peakFrame];
    const next = spectralFlux[peakFrame + 1];
    const denom = prev - 2 * curr + next;
    if (Math.abs(denom) < 1e-10) {
        return peakFrame * frameDuration;
    }
    const offset = 0.5 * (prev - next) / denom;
    if (Math.abs(offset) < 1) {
        return (peakFrame + offset) * frameDuration;
    }
    return peakFrame * frameDuration;
}

function pickOnsets(spectralFlux, hopSize, sampleRate) {
    const numFrames = spectralFlux.length;
    const frameDuration = hopSize / sampleRate;
    const medianWindow = BEAT_DETECTION.ONSET_MEDIAN_WINDOW;

    const threshold = new Float32Array(numFrames);
    for (let i = 0; i < numFrames; i++) {
        const start = Math.max(0, i - medianWindow);
        const end = Math.min(numFrames - 1, i + medianWindow);
        const window = [];
        for (let j = start; j <= end; j++) {
            window.push(spectralFlux[j]);
        }
        window.sort((a, b) => a - b);
        const localMedian = window[Math.floor(window.length / 2)];
        threshold[i] = localMedian * BEAT_DETECTION.ONSET_THRESHOLD_MULTIPLIER
                      + BEAT_DETECTION.ONSET_THRESHOLD_OFFSET;
    }

    const minGapFrames = Math.floor(BEAT_DETECTION.ONSET_MIN_GAP_SEC / frameDuration);
    const onsets = [];
    let lastOnsetFrame = -minGapFrames;

    for (let i = 1; i < numFrames - 1; i++) {
        if (spectralFlux[i] <= threshold[i]) continue;
        if (spectralFlux[i] <= spectralFlux[i - 1] || spectralFlux[i] <= spectralFlux[i + 1]) continue;
        if ((i - lastOnsetFrame) < minGapFrames) continue;

        onsets.push(refineOnsetTime(spectralFlux, i, frameDuration));
        lastOnsetFrame = i;
    }

    return onsets;
}

function thinOnsets(onsets, spectralFlux, hopSize, sampleRate) {
    if (onsets.length === 0) return [];

    const frameDuration = hopSize / sampleRate;
    const minGap = BEAT_DETECTION.MIN_PLAYABLE_GAP_SEC;

    const scored = onsets.map(t => {
        const frame = Math.round(t / frameDuration);
        const strength = (frame >= 0 && frame < spectralFlux.length)
            ? spectralFlux[frame] : 0;
        return { time: t, strength };
    });

    scored.sort((a, b) => b.strength - a.strength);

    const accepted = [];
    for (const candidate of scored) {
        const tooClose = accepted.some(
            a => Math.abs(a.time - candidate.time) < minGap
        );
        if (!tooClose) {
            accepted.push(candidate);
        }
    }

    accepted.sort((a, b) => a.time - b.time);

    const maxPerSec = BEAT_DETECTION.MAX_BEATS_PER_SECOND;
    const filtered = [];
    for (const beat of accepted) {
        const windowStart = beat.time - 1.0;
        const recent = filtered.filter(b => b.time > windowStart).length;
        if (recent < maxPerSec) {
            filtered.push(beat);
        }
    }

    return filtered.map(b => b.time);
}

function estimateTempo(spectralFlux, hopSize, sampleRate) {
    const frameDuration = hopSize / sampleRate;
    const numFrames = spectralFlux.length;

    const minLag = Math.floor(60 / (BEAT_DETECTION.MAX_BPM * frameDuration));
    let maxLag = Math.ceil(60 / (BEAT_DETECTION.MIN_BPM * frameDuration));
    maxLag = Math.min(maxLag, Math.floor(numFrames / 2));

    if (minLag >= maxLag) return null;

    let mean = 0;
    for (let i = 0; i < numFrames; i++) mean += spectralFlux[i];
    mean /= numFrames;

    let variance = 0;
    for (let i = 0; i < numFrames; i++) {
        variance += (spectralFlux[i] - mean) ** 2;
    }
    variance /= numFrames;
    const stddev = Math.sqrt(variance);

    if (stddev < 0.0001) return null;

    const normalized = new Float32Array(numFrames);
    for (let i = 0; i < numFrames; i++) {
        normalized[i] = (spectralFlux[i] - mean) / stddev;
    }

    let bestLag = minLag;
    let bestCorr = -Infinity;
    const autocorr = new Float32Array(maxLag - minLag + 1);

    for (let lag = minLag; lag <= maxLag; lag++) {
        let sum = 0;
        const count = numFrames - lag;
        for (let i = 0; i < count; i++) {
            sum += normalized[i] * normalized[i + lag];
        }
        const corr = sum / count;
        autocorr[lag - minLag] = corr;
        if (corr > bestCorr) {
            bestCorr = corr;
            bestLag = lag;
        }
    }

    let meanCorr = 0;
    for (let i = 0; i < autocorr.length; i++) meanCorr += autocorr[i];
    meanCorr /= autocorr.length;

    if (bestCorr < meanCorr * 2.0 && bestCorr < 0.1) return null;

    const candidates = [{ lag: bestLag, corr: bestCorr }];

    const halfLag = Math.floor(bestLag / 2);
    if (halfLag >= minLag && halfLag <= maxLag) {
        candidates.push({ lag: halfLag, corr: autocorr[halfLag - minLag] });
    }

    const doubleLag = bestLag * 2;
    if (doubleLag >= minLag && doubleLag <= maxLag) {
        candidates.push({ lag: doubleLag, corr: autocorr[doubleLag - minLag] });
    }

    const minCorrThreshold = bestCorr * 0.5;
    const validCandidates = candidates.filter(c => {
        const bpm = 60 / (c.lag * frameDuration);
        return bpm >= BEAT_DETECTION.MIN_BPM && bpm <= BEAT_DETECTION.MAX_BPM && c.corr >= minCorrThreshold;
    });

    if (validCandidates.length > 0) {
        validCandidates.sort((a, b) => b.corr - a.corr);
        bestLag = validCandidates[0].lag;
        bestCorr = validCandidates[0].corr;
    }

    return {
        bpm: 60 / (bestLag * frameDuration),
        beatPeriodSec: bestLag * frameDuration,
        confidence: bestCorr
    };
}

function generateBeatGrid(onsets, tempoResult, totalDurationSec) {
    if (tempoResult === null) {
        console.log('Beat detection: No clear tempo, using raw onsets.');
        return onsets;
    }

    const beatPeriod = tempoResult.beatPeriodSec;

    const numCandidates = BEAT_DETECTION.GRID_PHASE_CANDIDATES;
    let bestPhase = 0;
    let bestPhaseScore = -1;
    const snapWindow = BEAT_DETECTION.GRID_SNAP_WINDOW_SEC * 2;

    for (let c = 0; c < numCandidates; c++) {
        const candidatePhase = c * (beatPeriod / numCandidates);
        let score = 0;

        for (let o = 0; o < onsets.length; o++) {
            const gridPosition = (onsets[o] - candidatePhase) / beatPeriod;
            const distToNearest = Math.abs(gridPosition - Math.round(gridPosition)) * beatPeriod;
            if (distToNearest < snapWindow) {
                score += 1.0 - (distToNearest / snapWindow);
            }
        }

        if (score > bestPhaseScore) {
            bestPhaseScore = score;
            bestPhase = candidatePhase;
        }
    }

    const grid = [];
    let t = bestPhase;
    while (t < totalDurationSec) {
        if (t >= 0) grid.push(t);
        t += beatPeriod;
    }

    const snappedGrid = [];
    for (let g = 0; g < grid.length; g++) {
        let nearestDist = Infinity;
        let nearestOnset = 0;
        for (let o = 0; o < onsets.length; o++) {
            const dist = Math.abs(onsets[o] - grid[g]);
            if (dist < nearestDist) {
                nearestDist = dist;
                nearestOnset = onsets[o];
            }
        }

        if (nearestDist < BEAT_DETECTION.GRID_SNAP_WINDOW_SEC) {
            const w = BEAT_DETECTION.GRID_SNAP_WEIGHT;
            snappedGrid.push(grid[g] * (1 - w) + nearestOnset * w);
        } else {
            snappedGrid.push(grid[g]);
        }
    }

    return snappedGrid;
}

function analyzeBeats(samples, sampleRate, totalDuration) {
    // Step 1: Compute spectral flux and smooth it
    const rawFlux = computeSpectralFlux(samples, sampleRate);
    const spectralFlux = smoothFlux(rawFlux, BEAT_DETECTION.FLUX_SMOOTH_WINDOW);

    // Step 2: Pick onsets
    let onsets = pickOnsets(spectralFlux, BEAT_DETECTION.HOP_SIZE, sampleRate);

    if (onsets.length < 4) {
        const lowerThreshold = BEAT_DETECTION.ONSET_THRESHOLD_MULTIPLIER - 0.15;
        const numFrames = spectralFlux.length;
        const frameDuration = BEAT_DETECTION.HOP_SIZE / sampleRate;
        const medianWindow = BEAT_DETECTION.ONSET_MEDIAN_WINDOW;
        const threshold = new Float32Array(numFrames);
        for (let i = 0; i < numFrames; i++) {
            const start = Math.max(0, i - medianWindow);
            const end = Math.min(numFrames - 1, i + medianWindow);
            const window = [];
            for (let j = start; j <= end; j++) window.push(spectralFlux[j]);
            window.sort((a, b) => a - b);
            const localMedian = window[Math.floor(window.length / 2)];
            threshold[i] = localMedian * lowerThreshold
                          + BEAT_DETECTION.ONSET_THRESHOLD_OFFSET;
        }
        const minGapFrames = Math.floor(BEAT_DETECTION.ONSET_MIN_GAP_SEC / frameDuration);
        onsets = [];
        let lastOnsetFrame = -minGapFrames;
        for (let i = 1; i < numFrames - 1; i++) {
            if (spectralFlux[i] <= threshold[i]) continue;
            if (spectralFlux[i] <= spectralFlux[i - 1] || spectralFlux[i] <= spectralFlux[i + 1]) continue;
            if ((i - lastOnsetFrame) < minGapFrames) continue;
            onsets.push(refineOnsetTime(spectralFlux, i, frameDuration));
            lastOnsetFrame = i;
        }
        console.log(`Beat detection: Retried with lower threshold, found ${onsets.length} onsets`);
    }

    const thinnedOnsets = thinOnsets(onsets, spectralFlux, BEAT_DETECTION.HOP_SIZE, sampleRate);

    // Step 3: Prefer vocal onsets for natural rhythm; fall back to grid
    let beats;
    if (thinnedOnsets.length >= BEAT_DETECTION.MIN_ONSETS_FOR_DIRECT_USE) {
        beats = thinnedOnsets;
        console.log(`Beat analysis: Using ${beats.length} vocal onsets in ${totalDuration.toFixed(1)}s`);
    } else {
        const tempoResult = estimateTempo(spectralFlux, BEAT_DETECTION.HOP_SIZE, sampleRate);
        beats = generateBeatGrid(onsets, tempoResult, totalDuration);
        console.log(`Beat analysis: Grid fallback - ${beats.length} beats in ${totalDuration.toFixed(1)}s`);
        if (tempoResult) {
            console.log(`  Tempo: ${tempoResult.bpm.toFixed(1)} BPM (confidence: ${tempoResult.confidence.toFixed(3)})`);
        }
    }
    console.log(`  Raw onsets detected: ${onsets.length}, thinned: ${thinnedOnsets.length}`);

    return beats;
}

// Worker message handler
self.onmessage = function(e) {
    const requestId = e.data.requestId;  // Track request ID for race condition prevention

    try {
        const { channelData, numChannels, sampleRate, duration, config } = e.data;

        // Set the config
        BEAT_DETECTION = config;

        // Channel data is already Float32Array (transferred via Transferable)
        // No conversion needed - just use directly
        const channels = channelData;

        // Mix to mono
        const samples = mixToMono(channels, numChannels);

        // Analyze beats
        const beats = analyzeBeats(samples, sampleRate, duration);

        // Send results back with requestId
        self.postMessage({ requestId, beats, error: null });
    } catch (error) {
        console.error('Beat worker error:', error);
        // Send error back to main thread with requestId
        self.postMessage({ requestId, beats: [], error: error.message || 'Beat analysis failed' });
    }
};
