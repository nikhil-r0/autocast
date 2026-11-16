# Audit Report: `/brag` vs. Autocast AI

> Comparative study of [latent-spaces/brag](https://github.com/latent-spaces/brag) and strategic adaptation roadmap for Autocast AI.

---

## 1. Executive Summary & Strategic Positioning

`/brag` is an agent skill that turns a project into a stylized 15–25s launch video using Hyperframes (HTML/CSS canvas rendering), motion graphics, and audio. It is growing rapidly in the agentic ecosystem (~6k–21k GitHub stars).

### The Fundamental Difference

| Dimension | `/brag` (Latent Spaces) | Autocast AI |
|---|---|---|
| **Category** | Hype Launch Trailer | Verified Product Walkthrough ("Demos that can't lie") |
| **Execution Model** | **Re-enactment / Simulation**: Recreates UI elements in HTML/CSS, simulates typing and fake clicks | **Execution & Proof**: Drives a real browser against a running web application via `@testmuai/kane-cli` |
| **Verification** | None (pure visual mock; cannot catch broken code) | **Three Closed Loops**: Loop 1 (Shoot), Loop 2 (Lint), Loop 3 (Visual Review) |
| **Failure Mode** | Ships trailer regardless of whether product actually works | **Stop-on-Bug**: Halts and refuses to render if product fails Kane verification |
| **Underlying Engine** | Hyperframes | Remotion (React, WebGL, SVG) + Playwright 1080p replay |
| **Relationship** | Pre-launch hype asset | Post-verification proof & high-converting product demo |

**Conclusion:** `/brag` and Autocast AI do not compete; they are complementary. While `/brag` creates a teaser trailer, Autocast creates an authentic, mathematically framed, verified demo that proves the product actually works.

---

## 2. Deep Audit of the `/brag` Codebase

Based on our clone and audit of `latent-spaces/brag` (including `skills/brag/references/` and `scripts/`):

### A. Composition Brief & Storyboarding (`step-2-plan.md`, `step-3-compose.md`)
* **Strict Separation of Concerns:** The agent writes a `composition-brief.md` as the creative contract (copy, visual identity, product moments, audio arc) and lets the renderer choose implementation mechanics.
* **Readable-Text Rule:** 
  - Short labels (1–3 words): **~0.8s settled time**.
  - Headlines/full sentences: **~0.3s per word settled time** (minimum 1.2s).
  - *Creative Law:* Fast entrances (0.3–0.6s) + adequate hold/settled time. Never pull text off-screen before a human viewer can read it.
* **Grounding Factual Claims:** Any name, number, metric, or feature claim must be verbatim grounded in the project codebase. Tone and framing may be creative, but facts cannot be invented.

### B. Tone Presets (`references/tones.md`)
Seven distinct tone profiles altering pacing, typography, voice, and transitions:
1. `default`: Playful, conversational, 4–5 scenes (3–5s each), clean crossfades.
2. `polished`: Restrained, elegant, 3–4 scenes (4–6s each), slow crossfades (0.6–0.8s).
3. `yc-parody`: Deadpan, hyper-serious startup tropes, heavy typography, hard cuts.
4. `chaotic`: Rapid cuts (some <2s), aggressive SFX, glitch accents.
5. `deadpan`: Big empty negative space, ultra-long holds, single words.
6. `cinematic`: Wide cinematic aspect ratios, dramatic lighting, bold title cards.
7. `app-store`: High-contrast feature cards, device framing, crisp reveals.

### C. Audio Intelligence & Music Cue Analysis (`scripts/analyze_music_cues.py`, `references/audio.md`)
* **`analyze_music_cues.py`**: A Python script using `librosa` and `numpy`:
  - Computes `onset_strength`, `local_onset_contrast`, `rms`, and `bass_energy`.
  - Extracts `strongCues` (intensity thresholding with 0.18s minimum de-duplication gap) for drops, swells, and scene transitions.
  - Generates a full `beat_grid` timestamp array.
* **Two-Layer Musicality:**
  - **Major reveals / scene changes** snap to `strongCues` within $\pm 0.15\text{s}$.
  - **Sequential items** (card stacks, list pills) snap to the `beat_grid` within $\pm 0.10\text{s}$.
* **SFX Library & HF Risk:** Bundles 228 CC0 audio files from Kenney.nl. Employs `sfx-analysis.json` to score high-frequency risk so that repeated clicks or UI taps don't sound harsh or fatiguing.
* **Audio-Reactive Visuals:** Pre-extracts RMS energy to drive subtle brand elements (glow, depth, card presence) rather than cheesy equalizer bars.

### D. Delivery & Distribution (`references/step-4-deliver.md`)
* **Bake Poster Frame as Frame 0:**
  Slack, Twitter/X, and Discord auto-generate link preview thumbnails by capturing **frame 0** of the video file (ignoring MP4 metadata tags). If frame 0 is a black fade or blank screen, the link preview looks broken.
  - Brag extracts the strongest settled hero frame as `brag.jpg`.
  - Replaces frame 0 using ffmpeg overlay (`enable='eq(n,0)'`). This makes the idle thumbnail postable everywhere with 0ms visual delay.
* **Canonical Share Copy (`share-copy.txt`):** Generates 1–3 punchy, tone-matched sentences ready to paste into Twitter, LinkedIn, or Discord.

---

## 3. What to Adapt for Autocast AI (Prioritized)

### Priority 1: Redaction & Safety Pass (Immediate Value)
* **Rationale:** Autocast records a live, working application. Real databases may contain API keys, Stripe secret prefixes, JWTs, staging URLs, or internal developer emails.
* **Action:**
  1. Add a regex redaction pass (`src/edit/redact.ts`) to scrub sensitive strings (`Bearer [a-zA-Z0-9_\-\.]+`, `sk_live_[a-zA-Z0-9]+`, private hostnames) from `storyboard.json` narrations and captions.
  2. In Path B replay, seed predictable, clean dummy fixtures (`INV-1001`, `Jane Doe`, `$4,850.00`).

### Priority 2: Readable-Text Rule (Loop 2 Lint & Loop 3 Kane QA)
* **Rationale:** Product demos fail if captions flash by too quickly for judges or prospects to read.
* **Action:**
  1. **Loop 2 Lint Rule:** Enforce `scene_duration >= (word_count * 0.3) + 0.8s`.
  2. **Loop 3 Kane QA:** Kane validates that text elements are not cut off and stay on screen for adequate reading duration.

### Priority 3: Mid-Transition Frame Auditing (Loop 3 QA)
* **Rationale:** Most visual defects (layer pop-in, muddy layout crossfades, typography overlap) occur on transition boundaries between scenes.
* **Action:**
  1. Expand Loop 3 frame sampling to check boundary frames (e.g. frame $T - 5$ and frame $T + 5$ around scene transitions).
  2. Implement clean dip-to-background or camera-ease transitions between disparate UI pages.

### Priority 4: Hook & Narrative Structure
* **Rationale:** Viewers decide whether to keep watching in the first 2 seconds.
* **Action:**
  1. Ensure Scene 1 immediately hooks the viewer with a clear metric or question.
  2. Cold-open option: Flash the verified outcome (e.g. the Approved compliance seal) for 1.2s before rewinding into the live execution steps.

### Priority 5: Poster Frame Baking (Frame 0 Thumbnails)
* **Rationale:** When sharing `demo.mp4` on Slack, Discord, or X, the preview thumbnail should show the crisp PayFlow dashboard or Approved seal rather than a blank intro frame.
* **Action:**
  1. Identify the strongest settled frame from the storyboard (e.g. Scene 5 seal or Scene 1 dashboard).
  2. Extract `poster.jpg` with ffmpeg.
  3. Bake `poster.jpg` into frame 0 of `demo.mp4` using `enable='eq(n,0)'`.

### Priority 6–10: Post-Hackathon Roadmap
* **Free Local TTS:** Integrate Kokoro for zero-cost offline voiceovers when cloud API keys are absent.
* **Distribution as Agent Skill:** Package Autocast as an installable agent skill (`npx skills add autocast`) so Claude Code, Cursor, or Codex can run it natively.
* **Aspect Ratios:** Support `--format landscape|vertical|square` with responsive sidebar positioning.
* **SFX Sound Design:** Integrate soft CC0 click and seal stamp SFX aligned with our verified click timestamps.
* **Benchmark Suite:** Build 3 standard sample apps (fintech dashboard, developer CLI, e-commerce checkout) to run regression benchmarks on video quality.

---

## 4. What NOT to Copy

1. **Simulated Re-enactments:** Never replace real browser execution with simulated DOM mocks. Kane verification is our core value proposition.
2. **Hallucinated Product Copy:** Never let the LLM invent features or metrics that Kane did not verify on the live app.
3. **Chaotic / Meme Tones:** Keep the focus on crisp, professional, high-trust walkthroughs. Autocast builds trust; it does not parody.
