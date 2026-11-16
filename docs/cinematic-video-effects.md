# AutoCast Cinematic Motion Graphics & Video Effects Reference

> **"Demos that can't lie"** meets trailer-grade cinematic energy.  
> How AutoCast combines verified Kane CLI autonomous computer vision with production-grade Remotion motion graphics.

---

## 1. Overview & Architectural Philosophy

Traditional SaaS product videos suffer from one of two flaws:
1. **Dull Screen Recordings**: Honest and real, but flat, static, and lacking pacing or visual interest.
2. **Animated Mockups (Figma / After Effects / Puppeteer simulators)**: Gorgeous and dynamic, but entirely simulated—showing UI states that don't exist in the real codebase, masking latency, and hiding real edge cases.

**AutoCast eliminates this false dichotomy.** AutoCast records real application flows with Kane CLI vision testing, proves their cryptographic correctness, and envelopes the uncorrupted screen recording in frame-exact React/Remotion motion graphics inspired by leading UI benchmarks (*MagicUI*, *Aceternity UI*, *Remotion Trailer Templates*, and *Cap*).

---

## 2. The 8 Cinematic Video Effects

```
┌────────────────────────────────────────────────────────────────────────┐
│                        AURORA LIVING BACKGROUND                        │
│   (Drifting Chromatic Radial Orbs + Hardware Blur + Tech Dot Grid)     │
│                                                                        │
│   ┌──────────────────────────────────────────────────────────────┐    │
│   │           BROWSER FRAME (3D PERSPECTIVE TILT)                │    │
│   │  ┌────────────────────────────────────────────────────────┐  │    │
│   │  │   TRAVELING BORDER BEAM (Animated SVG Perimeter Glow)  │  │    │
│   │  │                                                        │  │    │
│   │  │   REAL VERIFIED 1080p SCREEN RECORDING                 │  │    │
│   │  │   - Frame-exact Kane Cursor & Click Audio              │  │    │
│   │  │   - Dynamic Camera Zoom Rig                            │  │    │
│   │  │   - Luminous Focus Spotlight Ring                      │  │    │
│   │  │                                                        │  │    │
│   │  │   [KINETIC CUT TRANSITION FLARE ON BOUNDARIES]         │  │    │
│   │  │                                                        │  │    │
│   │  │   [ANIMATED FROSTED GLASS LOWER-THIRD CAPTION]         │  │    │
│   │  └────────────────────────────────────────────────────────┘  │    │
│   └──────────────────────────────────────────────────────────────┘    │
│                                                                        │
│     AMBIENT PARTICLE DUST FIELD  •  ROLLING NUMBER COUNTERS            │
│     METALLIC SHIMMER HEADLINES   •  TACTILE STAMP SEAL OF TRUTH        │
└────────────────────────────────────────────────────────────────────────┘
```

---

### Effect 1: Aurora Mesh Living Background (`AuroraBackground.tsx`)
- **File**: `remotion/components/AuroraBackground.tsx`
- **Inspiration**: *Aceternity UI AuroraBackground*, modern macOS / Apple Keynote stages.
- **Visual Role**: Replaces flat dark backgrounds with an animated living stage. Four multi-colored radial blobs drift smoothly in elliptical paths behind the viewport.
- **Color Palette**:
  - Orb 1 (Top Left): Electric Cyan (`#06b6d4`, `rgba(6, 182, 212, 0.35)`)
  - Orb 2 (Bottom Right): Deep Violet (`#8b5cf6`, `rgba(139, 92, 246, 0.3)`)
  - Orb 3 (Center Bottom): Emerald Glow (`#10b981`, `rgba(16, 185, 129, 0.22)`)
  - Orb 4 (Top Right): Fuchsia Accent (`#d946ef`, `rgba(217, 70, 239, 0.2)`)
- **Key Mechanics**:
  - Sinusoidal floating math: `x = baseX + Math.sin(frame * speedX) * ampX`
  - Heavy hardware-accelerated blur (`filter: blur(95px) saturate(150%)`)
  - Subtle architectural dot grid (`radial-gradient(rgba(255, 255, 255, 0.06) 1px, transparent 1px)`) with 36px pitch
  - Inset vignette darkening to preserve contrast around the main subject.

---

### Effect 2: 3D CSS Perspective Tilt (`Demo.tsx`, `BrowserFrame.tsx`)
- **Files**: `remotion/Demo.tsx`, `remotion/components/BrowserFrame.tsx`
- **Inspiration**: *Cap Screen Recorder*, *Linear app previews*.
- **Visual Role**: Imparts Apple keynote physical depth to the floating browser window during wide establishing shots, then flattens during active inspection.
- **Dynamic Physics**:
  - In **Hero Wide Mode** (Scenes 1 & Final): Subtle 3D perspective (`perspective: 1400px`, `rotateX: 2.8deg`, `rotateY: -2.4deg ± 0.6deg` floating drift).
  - In **Studio Split Mode** (Scenes 2 to Penultimate): Smoothly springs to flat 2D (`rotateX: 0deg`, `rotateY: 0deg`) so text, buttons, and verified assertions are 100% distortion-free and legible.
  - Multi-layer drop shadow:
    `box-shadow: 0 0 0 10px #111827, 0 36px 80px rgba(0, 0, 0, 0.75), 0 0 40px rgba(56, 189, 248, 0.12)`

---

### Effect 3: Metallic Gradient Shimmer Typography (`TitleCard.tsx`)
- **File**: `remotion/components/TitleCard.tsx`
- **Inspiration**: *MagicUI ShimmerButton*, *Remotion Trailer Template*.
- **Visual Role**: Gives the headline text a moving metallic sheen while revealing words sequentially.
- **Key Mechanics**:
  - **Word-Level Stagger**: Title is split into words; each word enters with an independent Remotion spring (`frame - index * 3`).
  - **Continuous Metallic Shimmer**:
    ```css
    background: linear-gradient(135deg, #ffffff 0%, #93c5fd 40%, #c084fc 70%, #ffffff 100%);
    background-size: 200% 100%;
    background-position: ${shimmerProgress}% 0;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    ```
  - Animated production badge with pulsing neon border and tech pill.

---

### Effect 4: Animated Rolling Number Stat Counter (`NumberTicker.tsx`)
- **File**: `remotion/components/NumberTicker.tsx`, integrated in `remotion/components/Outro.tsx`
- **Inspiration**: *MagicUI NumberTicker*, financial dashboards.
- **Visual Role**: Quantifies verification results (e.g. `$0.00` → `$4,850.00` reconciled) with cubic easing.
- **API Spec**:
  ```tsx
  interface NumberTickerProps {
    value: number;          // Target number (e.g. 4850)
    startValue?: number;    // Initial value (default 0)
    prefix?: string;        // e.g. '$'
    suffix?: string;        // e.g. ' USD'
    decimals?: number;      // e.g. 2
    startFrame?: number;    // Delay before ticking starts
    durationFrames?: number;// Ticker animation duration
    style?: React.CSSProperties;
  }
  ```
- **Math**: Remotion `interpolate(frame, [startFrame, startFrame + durationFrames], [startVal, targetVal], { easing: Easing.out(Easing.cubic) })` rendered with `font-variant-numeric: tabular-nums`.

---

### Effect 5: Border Beam Traveling Light (`BorderBeam.tsx`)
- **File**: `remotion/components/BorderBeam.tsx`
- **Inspiration**: *MagicUI BorderBeam*.
- **Visual Role**: An animated pulse of colored light circulates around the browser window bezel, signaling active autonomous execution.
- **Key Mechanics**:
  - Computes exact perimeter of rounded rectangle:
    $$P = 2(W + H) + R(2\pi - 4)$$
  - SVG `<rect>` with `strokeDasharray={`${beamLength} ${perimeter - beamLength}`}` and continuous animated `strokeDashoffset`.
  - Dual drop-shadow neon glow (`filter: drop-shadow(...)`).

---

### Effect 6: Ambient Particle Dust Field (`ParticleField.tsx`)
- **File**: `remotion/components/ParticleField.tsx`
- **Visual Role**: Adds depth and cinematic atmosphere behind the viewport without drawing focus away from the UI.
- **Key Mechanics**:
  - **Deterministic Generation**: 24 particles computed using index-based pseudo-random hashing—ensures exact frame reproducibility without `Math.random()` impurities.
  - Multi-chromatic palette: cyan, lavender, violet, emerald, white.
  - Sinusoidal orbit paths with independent harmonic speeds and breathing opacities.

---

### Effect 7: Kinetic Cut Transition Flares (`KineticTransition.tsx`)
- **File**: `remotion/components/KineticTransition.tsx`
- **Inspiration**: High-energy cinematic trailers (*remotion-dev/template-trailer*).
- **Visual Role**: Punctuate scene boundaries with a punchy light streak and radial flash at the cut point.
- **Key Mechanics**:
  - Triggers during the first 7 frames of every scene.
  - Horizontal anamorphic light flare streak (`height: 2px`, `boxShadow: 0 0 16px 4px #38bdf8`) sweeps across the screen while fading from opacity `0.85 → 0`.
  - Soft radial flash centered on the screen.
  - Zero modification to the underlying video frames.

---

### Effect 8: Animated Lower-Third Captions (`LowerThird.tsx`)
- **File**: `remotion/components/LowerThird.tsx`
- **Visual Role**: Elegant frosted-glass caption card at the bottom of the screen when in wide/full-screen mode or HUD layout.
- **Features**:
  - Snappy spring entrance (`transform: translateY(...)`).
  - Step counter pill: `STEP 02/04`.
  - Kane assertion badge: `🛡️ VERIFIED`.
  - High-contrast typography with frosted glass blur (`backdrop-filter: blur(20px)`).

---

## 3. Component Hierarchy

```
Demo (remotion/Demo.tsx)
 ├── AuroraBackground (remotion/components/AuroraBackground.tsx)
 ├── ParticleField (remotion/components/ParticleField.tsx)
 ├── TitleCard (remotion/components/TitleCard.tsx) [Frames 0..75]
 ├── BrowserFrame Container (3D Perspective tilt wrapper)
 │    └── BrowserFrame (remotion/components/BrowserFrame.tsx)
 │         ├── BorderBeam (remotion/components/BorderBeam.tsx)
 │         ├── Window Title Bar & Navigation Controls
 │         └── Series.Sequence
 │              └── Scene (remotion/components/Scene.tsx)
 │                   ├── CameraRig (remotion/components/CameraRig.tsx)
 │                   │    ├── OffthreadVideo
 │                   │    ├── Spotlight (remotion/components/Spotlight.tsx)
 │                   │    └── Cursor (remotion/components/Cursor.tsx)
 │                   ├── KineticTransition (remotion/components/KineticTransition.tsx)
 │                   ├── LowerThird (remotion/components/LowerThird.tsx)
 │                   └── Audio (sfx-click.wav)
 ├── Sidebar (remotion/components/Sidebar.tsx) [Split layout mode]
 ├── FloatingHud (remotion/components/FloatingHud.tsx) [HUD layout mode]
 └── Outro (remotion/components/Outro.tsx) [Final 75 frames]
      ├── NumberTicker (remotion/components/NumberTicker.tsx)
      ├── Verified Claims Card
      └── Audio (sfx-stamp.wav)
```

---

## 4. Verification & Sealing Commands

Every demo video is built, verified, and sealed with tamper-evident cryptographic provenance:

```bash
# 1. Run full test suite (Action IR, Kane verdict, Visual QA heuristics, Provenance)
npm test

# 2. Compile TypeScript
npm run build

# 3. Render 1080p 30fps H.264 video
npm run render

# 4. Seal demo: Hero poster extraction, Frame-0 verification, SHA-256 seal
npx tsx scripts/seal-demo.ts
```

---

## 5. Open Source Benchmark References

| Component / Effect | Open Source Benchmark | Repository |
|--------------------|----------------------|------------|
| Aurora Background | Aceternity UI Aurora | `aceternity/aceternity-ui` |
| Border Beam | Magic UI BorderBeam | `magicuidesign/magicui` |
| Number Ticker | Magic UI NumberTicker | `magicuidesign/magicui` |
| Shimmer Typography | Magic UI ShimmerButton | `magicuidesign/magicui` |
| Kinetic Trailer Cuts | Remotion Trailer Template | `remotion-dev/template-trailer` |
| Browser Frame & 3D Tilt | Cap Screen Recorder | `CapSoftware/Cap` |
| Tactile Click & Stamp SFX | AutoCast WAV Synthesizer | `scripts/generate-sfx.js` |

