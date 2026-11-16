# Autocast AI: The Autonomous Demo Director

> **One plain-English prompt in. A narrated, zoomed, verified product demo video out.**  
> Tagline: **Demos that can't lie.** No video is rendered unless Kane CLI proves the feature works, and no video ships unless Kane CLI proves the edit looks right.

---

## ⚡ Quick Start (For Judges)

### 1. Prerequisites
- Node.js (v18+)
- Kane CLI authenticated:
  ```bash
  kane-cli login
  ```

### 2. Install & Configure
```bash
git clone https://github.com/nikhil-r0/autocast.git
cd autocast
npm install
cp .env.example .env
# Add your GEMINI_API_KEY in .env (or run in silent fallback mode)
```

### 3. Generate a Verified Demo Video
Run the autonomous demo pipeline with one command:
```bash
npm run demo -- "Create a demo of the invoice approval flow"
```

The output MP4 video will be rendered into `out/demo.mp4`.  
*(A pre-rendered sample is also available at `examples/output/sample-demo.mp4`)*.

---

## 🛡️ The Centerpiece: Demos Can't Lie (Stop-on-Bug)

Autocast AI refuses to render misleading marketing videos. If an application defect is present, Kane CLI catches the failure, halts the render, and outputs a structured bug report with screenshots:

```bash
# Test the stop-on-bug behavior:
TARGET_APP_URL="http://localhost:8080/?broken=approve" npm run demo
```

**Result:** Autocast detects the missing approval seal, halts execution, and renders **no video**, protecting developer trust.

---

## 🏗️ Architecture: The Three Closed Loops

Autocast AI implements the complete triad of automated verification:

```
 "Create a demo of the invoice approval flow"
                    |
                    v
          +---------------------+
          |   Director LLM      |   (Translates prompt to objective & assertion)
          +---------------------+
                    |
        (1) LOOP 1: SHOOT LOOP (Kane CLI Application Verification)
          kane-cli run "<objective>" --agent
          Real Chrome, Vision-Driven, Automated Assertions
                    |
                    +--- Product Defect? ---> STOP-ON-BUG! Print defect report, NO RENDER.
                    |
        (2) CAPTURE: PATH B REPLAY
          Playwright Replay & Record at 1920x1080
          (Zero LLM thinking gaps, 30fps sharp footage, exact click coordinates)
                    |
        (3) EDIT: STORYBOARD SYNTHESIS
          Gemini 3.5 Flash generates benefit-driven narration & scene captions
          Synthesizes storyboard.json with camera zoom rects & cursor physics
                    |
        (4) LOOP 2: LINT LOOP
          Fast code validation: Schema, zoom bounds, timing fit, boundary constraints
                    |
        (5) LOOP 3: VISUAL REVIEW LOOP (Kane CLI Remotion Verification)
          kane-cli run "Open http://localhost:8080/review?frame=N and verify..."
          Kane inspects rendered video frames for layout clipping, corner cutoffs, and typography overlap
                    |
        (6) RENDER: DETERMINISTIC REMOTION RENDER
          npx remotion render Demo out/demo.mp4 (H.264, 1080p, 30fps, 31 seconds)
```

### The 3 Loops at a Glance:
1. **Loop 1 (Shoot Loop):** Kane verifies the real application feature. Demos can't lie: if the app is broken, render is halted.
2. **Loop 2 (Lint Loop):** Deterministic validator checks storyboard schema, target bounds, and pacing.
3. **Loop 3 (Review Loop):** Kane visually reviews rendered Remotion frames via `/review?frame=N`. Kane's multimodal computer vision catches visual defects that DOM checks cannot: element cropping, aspect ratio distortion, and text overlap.

---

## 📂 Project Structure

```
autocast/
├── src/
│   ├── cli.ts                   # Main CLI entrypoint
│   ├── shoot/
│   │   ├── kane.ts              # Kane CLI agent-mode runner & NDJSON parser
│   │   ├── objective.ts         # Translates prompt to Kane objective via Gemini
│   │   └── classify.ts          # Stop-on-bug classification
│   ├── capture/
│   │   └── replay.ts            # Path B Playwright 1080p recorder
│   ├── edit/
│   │   ├── narration.ts         # Benefit-first narration writer
│   │   ├── storyboard.ts        # storyboard.json synthesis
│   │   └── lint.ts              # Fast pre-render storyboard validator
│   └── types.ts                 # Zod contracts & shared interfaces
├── remotion/
│   ├── Root.tsx                 # Composition registration
│   ├── Demo.tsx                 # Video composition & calculateMetadata
│   └── components/
│       ├── BrowserFrame.tsx     # Window frame & address bar
│       ├── CameraRig.tsx        # Spring-eased zoom & pan
│       ├── Cursor.tsx           # Synthesized cursor path & click ripple
│       ├── Sidebar.tsx          # Step list & animated caption
│       ├── TitleCard.tsx        # Intro animation
│       └── Outro.tsx            # Outro card
├── examples/
│   ├── invoice-app/             # Bundled mock invoice approval app
│   └── output/                  # Pre-rendered sample MP4 & storyboard
└── docs/
    └── spike-findings.md        # Day 1 spike verification findings
```
