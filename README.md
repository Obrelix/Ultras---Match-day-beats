# Ultras - Match Day Beats

A Patapon-style browser rhythm game where football ultras compete against an AI rival by keeping rhythm with their club's chants. Tap to the beat, build combos, and outsing the opposition.

## How It Works

Pick your club, choose a chant, and hit **SPACEBAR** in time with the music. The game automatically detects beats from any MP3 using a custom spectral flux analysis pipeline — no BPM tagging needed. Score points for timing accuracy (PERFECT / GOOD / OK), chain hits to build combo multipliers, and watch the pixel crowd go wild in frenzy mode.

## Game Modes

### Practice Mode
Pick any club and chant to play. Perfect for learning timing, testing custom chants, and chasing high scores.

### Match Day Mode
A full football match experience across 6 chants (2 halves, 3 chants each). Score goals based on your accuracy (40%+ required), compete against an AI rival with unique personality, and track your W/D/L record.

## Features

### Core Gameplay
- **Automatic beat detection** — Custom FFT-based spectral flux analysis extracts vocal rhythm directly from audio. No manual BPM configuration.
- **Hold beats** — Long-press mechanic auto-generated from beat clusters. Press at the start, hold through the duration, release at the end for bonus points.
- **Dual-canvas rendering** — Scrolling beat track with timing zones, approach countdown rings, and hit effects on top; pixel art supporter crowd with procedural animations on bottom.
- **Combo multipliers** — Chain consecutive hits for up to 3x score multiplier (thresholds at 5/10/15/20).
- **Perfect streak bonus** — Consecutive PERFECT hits build an extra multiplier (+10% per perfect, up to 2x). Milestone bonuses at 5/10/15/20 perfects.
- **Three difficulty levels** — Easy, Normal, and Hard with varying timing windows.
- **Input calibration** — Measure and compensate for device-specific input lag with a metronome-based calibration tool.
- **Mobile friendly** — Tap/click input alongside keyboard, haptic feedback on supported devices.

### Frenzy Mode & Crowd Effects
- **Frenzy mode** — Hit combo streaks above 5 to trigger crowd frenzy: waving flags, burning flares, billowing smoke, fire particles, and a "FEVER!" HUD.
- **Weather effects** — Rain particles when losing, confetti bursts on victory, smoke intensity scales with combo.
- **Screen shake** — Intense visual feedback on perfect hit streaks.

### Modifiers & Power-ups
- **Difficulty modifiers** — Double Time (1.5x scroll speed), Hidden (beats fade before hit line), Mirror (reversed scroll direction). Stack for score bonuses: 1 mod = +20%, 2 mods = +50%, 3 mods = +100%.
- **Power-ups** — Charge by building combos:
  - **Shield** (10 combo) — Absorbs one miss
  - **Score Burst** (15 combo) — 2x score for 5 seconds
  - **Slow Motion** (20 combo) — Wider timing windows for 5 seconds

### AI Rivals
- **AI personalities** — Each rival club has a unique playstyle:
  - **Aggressive** — Starts strong, loses accuracy over time
  - **Comeback King** — Gets stronger when losing
  - **Consistent** — Steady performance throughout
  - **Clutch** — Peaks in final moments
  - **Wildcard** — Unpredictable streaks of brilliance
- **Rubber banding** — AI adjusts difficulty based on score difference.
- **Mood indicator** — See when the AI is confident or struggling.
- **Trash talk** — AI taunts appear during gameplay based on game events (misses, combo breaks, score lead). Messages use the rival club's colors. Can be toggled in settings.

### Progression System
- **XP & Leveling** — Earn XP from scores, combos, and wins. Level up through 15 ranks from "Newcomer" to "Supreme Ultra".
- **Achievements** — Unlock 10 achievements including Perfect Chant (100% accuracy), Centurion (100 combo), and Rivalry (beat every club).
- **Weekly challenges** — Rotating goals like "Score 10,000 with PAOK" for bonus XP.
- **Season challenges** — Long-term goals across the quarter.
- **Club loyalty** — Track games per club, earn badges (Loyal Fan, Fanatic, Club Legend) after 50/100/200 games.

### Online Features
- **Leaderboards** — Per-chant, per-difficulty online rankings via Firebase.
- **Replay system** — Record inputs, watch replays with beat accuracy overlay, share replay codes.

### Custom Content
- **Custom chant upload** — Upload your own MP3s (up to 20MB, 10 min). Beat detection runs locally.
- **Metronome mode** — Optional click track overlay to help learn timing.

### Quality of Life
- **Persistent settings** — Volume, SFX, difficulty, and effects preferences saved locally.
- **Performance mode** — Reduces visual effects for smoother gameplay.
- **Tutorial** — First-time player guidance.
- **Club theming** — Each club's colors applied across UI and canvas visuals.

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
2. Start a local server from the project root
3. Open `http://localhost:3000` (or your server's port) in your browser

### Controls

| Input | Action |
|-------|--------|
| `SPACEBAR` | Hit beat / Hold for long notes |
| `Click / Tap` | Hit beat / Hold for long notes (mobile) |
| `SHIFT` | Activate charged power-up |
| `ESC` | Pause / Resume |

## Adding Clubs

Add a new entry to the `clubs` object in `docs/js/config.js`:

```javascript
myClub: {
    id: 'myClub',
    name: 'My Club',
    colors: { primary: '#HEX', secondary: '#HEX' },
    badge: 'Logos/myclub.svg',
    chants: [
        { id: 'chant_id', name: 'Chant Name', audio: 'chants/MyClub/file.mp3' }
    ]
}
```

Drop the MP3 files into `docs/chants/MyClub/`. Beats are auto-detected from the audio — no BPM or timing data needed. Clubs need 6+ unique chants to be eligible for Match Day mode.

## Architecture

Pure vanilla HTML + CSS + JavaScript ES6 modules. No frameworks, no build tools, no external dependencies.

```
docs/js/
├── config.js          Constants (clubs, timing, beat detection, modifiers, power-ups, XP, achievements)
├── state.js           Centralized mutable game state
├── audio.js           Web Audio API pipeline, SFX synthesis, metronome
├── beatDetection.js   Spectral flux + onset detection + tempo estimation (custom FFT)
├── beatWorker.js      Web Worker for off-main-thread beat analysis
├── input.js           Input handling, scoring, combo, AI simulation, perfect streaks, trash talk
├── renderer.js        Beat track visualizer (top canvas)
├── crowd.js           Pixel crowd, particles, flags, flares, smoke, weather, HUD (bottom canvas)
├── crowdBg.js         Persistent background canvas manager
├── ui.js              Screen management, DOM elements, calibration UI
├── storage.js         localStorage persistence layer
├── progression.js     XP, leveling, achievements, challenges, loyalty
├── replay.js          Input recording and playback
├── customChants.js    IndexedDB storage for custom uploaded chants
├── leaderboard.js     Firebase Realtime Database integration
├── leaderboardUI.js   Leaderboard screen rendering
├── analytics.js       Session tracking, accuracy trends, performance charts
└── main.js            Entry point, game loop, event wiring
```

### Beat Detection Pipeline

1. **Spectral Flux** — STFT with Hann window and frequency-band weighting (vocal emphasis 250-3500 Hz)
2. **Onset Picking** — Adaptive threshold with local mean and minimum gap enforcement
3. **Onset Thinning** — Greedy non-maximum suppression for playable beat density
4. **Path Selection** — Uses vocal onsets directly if enough are found (>= 8), otherwise falls back to tempo estimation via autocorrelation and a snapped beat grid

Beat analysis runs in a Web Worker to prevent UI blocking.

## Tech Stack

- Vanilla JavaScript (ES6 modules)
- Web Audio API (AudioContext, AnalyserNode, BufferSource, oscillator synthesis)
- Canvas 2D (dual-canvas, OffscreenCanvas waveform cache)
- IndexedDB (custom chant storage)
- Firebase Realtime Database (online leaderboards)
- Custom Cooley-Tukey FFT (no library dependencies)
- CSS custom properties for club theming

## Browser Support

Modern browsers with ES6 module support, Web Audio API, and Canvas 2D:
- Chrome 80+
- Firefox 75+
- Safari 14+
- Edge 80+

## License

MIT
