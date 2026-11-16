<p align="center">
  <img src="docs/cover.jpg" alt="Autocast AI — Demos that can't lie." width="820">
</p>

<h1 align="center">Autocast AI</h1>

<p align="center">
  <strong>The autonomous demo director.</strong><br>
  One plain-English prompt in. A narrated, zoomed, verified product demo out.<br>
  <em>Demos that can't lie.</em>
</p>

Autocast turns a product flow into a finished demo video, and it refuses to ship one that the product cannot actually perform. Kane CLI proves the feature works before a frame is recorded. A second pass proves the edit looks right before the MP4 is written.

No video is rendered when the product fails. No video ships when the edit fails visual review.

## What you get

A single command produces a 1080p, 30fps H.264 demo:

- A real browser walkthrough of the feature, captured at 1920×1080
- Benefit-led narration and scene captions with automated secret redaction
- Camera zooms with edge-containment protection, a synthesized cursor, and title and outro cards
- Readable-text pacing enforcement (>=0.3s per word settled on screen)
- Hero poster frame extraction (`out/poster.jpg`) and frame-0 preview baking for instant rich social thumbnails on Slack, Discord, and X
- A structured defect report, with screenshots, when the product is broken

A bundled invoice-approval app is included so the pipeline runs without your own product. Point `TARGET_APP_URL` at any web app when you are ready.

## Quick start

**Requirements:** Node.js 18+, Kane CLI signed in (`kane-cli login`), and a Gemini API key if you want generated narration. Without a key, the pipeline falls back to silent captions.

```bash
git clone https://github.com/nikhil-r0/autocast.git
cd autocast
npm install
cp .env.example .env
# Set GEMINI_API_KEY in .env
```

```bash
npm run demo -- "Create a demo of the invoice approval flow"
```

The finished files are `out/demo.mp4` (with frame-0 thumbnail baked in), `out/poster.jpg` (hero settled screenshot), and `out/share-copy.txt` (ready-to-post launch copy). Pre-rendered samples are committed in `examples/output/`.

## How a demo is made

```
"Create a demo of the invoice approval flow"
                |
                v
       Director (Gemini)
       objective + assertion
                |
     1. Shoot — Kane CLI, real Chrome
        product defect?  -->  stop. print the report. no render.
                |
     2. Capture — Playwright replay at 1920×1080
        exact clicks, no model pauses in the footage
                |
     3. Edit — narration, captions, zoom rects, cursor path
        written to storyboard.json
                |
     4. Lint — schema, bounds, timing, frame fit
                |
     5. Review — Kane inspects rendered frames
        clipping, cut-off type, overlapping text
                |
     6. Render — Remotion, H.264, 1080p, 30fps
                |
                v
            out/demo.mp4
```

| Loop | What it checks | What happens on failure |
| --- | --- | --- |
| Shoot | Strict Kane run (`--mode action --bug-detection stop --final-validation on`) against frozen claims | Render is aborted. A structured defect report is printed. |
| Lint | Storyboard validity: schema, zoom bounds, readability floor (>=0.3s/word), secret scrubber, banned superlatives | Render is aborted before Remotion starts. |
| Review | Rendered frames & MP4 stream stay defect-free without edge clipping or text overlap | Kane flags the visual defect; autonomous repair (`fix.ts`) heals layout and re-audits. |
| Pixel Safety | Post-render OCR scan on video pixels using Tesseract | Aborts if any API key or token pattern appears in rendered video pixels. |

Shoot retries are capped at 3 with strictly frozen claims. Review iterations heal layout defects autonomously. All verified telemetry powers trailer-style overlays: Spotlight focus rings, StatChip HUDs, and the Verified End Card centerpiece.

## Verified Catch Evidence

Autocast AI's Loop 3 Visual QA caught an over-panning camera defect in its own rendered video, halted the pipeline, repaired the camera rig constraints, and Kane CLI independently verified the fix. See full before/after evidence in [docs/catches/frame-204-catch.md](docs/catches/frame-204-catch.md).

## Demos that can't lie

If the approval seal is missing, Autocast does not invent one. Kane catches the failure, the pipeline exits, and nothing is rendered:

```bash
TARGET_APP_URL="http://localhost:8080/?broken=approve" npm run demo
```

Pass `--skip-review` to run shoot, capture, lint, and render without the visual review loop.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run demo -- "<prompt>"` | Full pipeline: verify, capture, edit, review, render |
| `npm run app` | Bundled invoice app on port 8080 |
| `npm run preview` | Remotion Studio |
| `npm run render` | Render the current storyboard to `out/demo.mp4` |
| `npm run lint:storyboard` | Validate `storyboard.json` |
| `npm run typecheck` | TypeScript check |

## Configuration

Copy `.env.example` to `.env`.

| Variable | Role |
| --- | --- |
| `GEMINI_API_KEY` | Objectives, narration, and captions. Optional; silent fallback when unset. |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | Alternate model providers. |
| `ELEVENLABS_API_KEY` | Optional voiceover. Blank stays silent. |
| `TARGET_APP_URL` | App under test. Defaults to `http://localhost:8080`. |
| `AUTOCAST_CHAOS` | Forces a layout defect so the review loop can be demonstrated. |

## Layout

```
autocast/
├── src/
│   ├── cli.ts                 # Pipeline entry
│   ├── shoot/                 # Objective, Kane run, stop-on-bug
│   ├── capture/replay.ts      # 1080p Playwright replay
│   ├── edit/                  # Storyboard, lint, redact, poster, shareCopy
│   └── review/kaneReview.ts   # Boundary & frame-level Kane visual QA
├── remotion/                  # Composition, camera, cursor, cards
├── examples/
│   ├── invoice-app/           # Sample product
│   └── output/                # Sample MP4, poster, share-copy, and storyboard
├── docs/                      # Cover, design notes, and comparative reports
└── storyboard.json            # The edit. Change this, not the components.
```

Further reading: [shoot findings](docs/spike-findings.md), [the review loop](docs/loop3-review.md), and [brag comparative audit & roadmap](docs/brag-report.md).
