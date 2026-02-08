# Ultras - Match Day Beats

A Patapon-style browser rhythm game where football ultras compete against an AI rival by keeping rhythm with their club's chants. Tap to the beat, build combos, and outsing the opposition.

## How It Works

Pick your club, choose a chant, and hit **SPACEBAR** in time with the music. The game automatically detects beats from any MP3 using a custom spectral flux analysis pipeline — no BPM tagging needed. Score points for timing accuracy (PERFECT / GOOD / OK), chain hits to build combo multipliers, and watch the pixel crowd go wild in frenzy mode.

## Features

- **Automatic beat detection** — Custom FFT-based spectral flux analysis extracts vocal rhythm directly from audio. No manual BPM configuration.
- **Dual-canvas rendering** — Scrolling beat track with timing zones, approach countdown rings, and hit effects on top; pixel art supporter crowd with procedural animations on bottom.
- **Frenzy mode** — Hit combo streaks above 5 to trigger crowd frenzy: waving flags, burning flares, billowing smoke, fire particles, and a "FEVER!" HUD.
- **Combo multipliers** — Chain consecutive hits for up to 3x score multiplier (thresholds at 5/10/15/20).
- **AI rival** — Compete head-to-head against an AI opponent with 75% accuracy.
- **Club theming** — Each club has its own color palette applied across the entire UI and canvas visuals.
- **Mobile friendly** — Tap/click input alongside keyboard.

## Getting Started

### Prerequisites

A local HTTP server (ES6 modules require it). Any of these work:

```bash
npx serve .                       # Node.js
python -m http.server 8000        # Python
```

Or use **VS Code Live Server** / any static file server.

### Run

1. Clone the repository
2. Add MP3 chant files to `chants/<ClubName>/` (see [Adding Clubs](#adding-clubs))
3. Start a local server from the project root
4. Open `http://localhost:3000` in your browser

### Controls

| Input | Action |
|-------|--------|
| `SPACEBAR` | Hit the beat |
| `Click / Tap` | Hit the beat (mobile) |

## Adding Clubs

Add a new entry to the `clubs` object in `js/config.js`:

```javascript
myClub: {
    id: 'myClub',
    name: 'My Club',
    colors: { primary: '#HEX', secondary: '#HEX' },
    badge: '🔵',
    chants: [
        { id: 'chant_id', name: 'Chant Name', audio: 'chants/MyClub/file.mp3', duration: 15 }
    ]
}
```

Drop the MP3 files into `chants/MyClub/`. Beats are auto-detected from the audio — no BPM or timing data needed.

## Architecture

Pure vanilla HTML + CSS + JavaScript ES6 modules. No frameworks, no build tools, no dependencies.

```
js/
├── config.js          Constants (clubs, timing windows, beat detection params)
├── state.js           Centralized mutable game state
├── audio.js           Web Audio API pipeline
├── beatDetection.js   Spectral flux + onset detection + tempo estimation (custom FFT)
├── input.js           Input handling, scoring, combo, AI
├── renderer.js        Beat track visualizer (top canvas)
├── crowd.js           Pixel crowd, particles, flags, flares, smoke, HUD (bottom canvas)
├── ui.js              Screen management, DOM elements
└── main.js            Entry point, game loop, event wiring
```

### Beat Detection Pipeline

1. **Spectral Flux** — STFT with Hann window and frequency-band weighting (vocal emphasis)
2. **Onset Picking** — Adaptive threshold with local mean and minimum gap enforcement
3. **Onset Thinning** — Greedy non-maximum suppression for playable beat density
4. **Path Selection** — Uses vocal onsets directly if enough are found (>= 8), otherwise falls back to tempo estimation via autocorrelation and a snapped beat grid

## Tech Stack

- Vanilla JavaScript (ES6 modules)
- Web Audio API (AudioContext, AnalyserNode, BufferSource)
- Canvas 2D (dual-canvas, OffscreenCanvas waveform cache)
- Custom Cooley-Tukey FFT (no library dependencies)
- CSS custom properties for club theming

## License

MIT
