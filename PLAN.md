# Autocast AI: The Autonomous Demo Director

> One plain-English prompt in. A narrated, zoomed, verified product demo video out.
> Tagline: **Demos that can't lie.** No video is rendered unless Kane CLI proves the feature works, and no video ships unless Kane CLI proves the edit looks right.

**Hackathon:** KaneCLI Online Hackathon (TestMu AI), https://www.kaneclihack.sh
**Build window:** Thu 12 Nov to **Thu 19 Nov, 11:59 PM IST** (10:29 AM PT). No pushes after the deadline.
**Today:** Sun 15 Nov, so about 4.5 working days remain. This plan is sized for that.

---

## Winning strategy (read this before anything else)

1. **The idea is not the risk. Scope is.** If "works end to end" fails on Thursday, nothing else is scored. A thin pipeline that works beats a rich one that half works.
2. **The centerpiece is the shoot loop plus stop-on-bug** ("broken app, Kane fails, no video rendered"). It is the strongest proof for both tie-breaks (Verified, then Closed loop). Open the demo video with it.
3. **The review loop (Loop 3) is a bonus.** Build it only after the full pipeline works end to end. Judges are Kane engineers; an injected layout bug can look staged, so keep it honest and secondary.
4. **Path B is the primary capture path** (Kane authors and verifies, Playwright replays and records). It removes the three biggest risks at once: soft footage, misaligned timings, and LLM thinking gaps. Kane's own video is the fallback, not the plan.
5. **Hard gate: a real end-to-end MP4 by Tue 17 Nov night.** If not, cut down to the minimum (section 8) immediately.
6. **Light install wins Craft.** Silent mode (no TTS key), a bundled sample app, and a pre-rendered output in the repo. Judges must be able to run it with only a Kane login.

**Minimum that wins:** shoot loop with stop-on-bug, one Remotion template, narration or silent mode, one command. Everything else is extra.

### Craft pass (Mon 16 Nov)

Judges score Ships, Verified, Closed loop, and Craft at 25% each. Ties break on Verified, then Closed loop. Recordly and brag only inform Craft. The Kane loop stays the product.

Take these three, and only these:

1. **Click bounce and a short zoom punch** on scenes where `cursor.click` is true. The browser frame keeps its shadow and gains a 10px mat ring. Existing Remotion components only (`Cursor`, `CameraRig`, `BrowserFrame`).
2. **Product words, held long enough to read.** Captions and narration name INV-1001, Acme, Approve Invoice, and the Approved seal. Shape is hook, reveal, two or three highlights, punchline. A line stays up for the whole scene. Banned: streamline, visibility, seamlessly, enterprise-grade.
3. **`out/share-copy.txt`** written next to `demo.mp4` (title, one post, YouTube blurb) for the two required launch posts. A sample is committed at `examples/output/share-copy.txt`.

Do not build Recordly's recorder, timeline, webcam, or marketplace. Its license is AGPL, so do not copy its code. Do not switch the renderer to Hyperframes, and do not add a music library or tone presets. None of that moves Verified or Closed loop. The Tuesday-night MP4 gate still comes first.

---

## 0. Do these first (30 minutes, today)

- [ ] Register on the hackathon site and create or join a team (solo or up to 4).
- [ ] Register on TestMu AI **with the same email** and claim the 10,000 free credits (required to be scored).
- [ ] `npm install -g @testmuai/kane-cli`, then `kane-cli login`, then run one flow so you are eligible.
- [ ] Join the Slack group (Kane engineers answer questions there and can top up credits).
- [ ] Create a **fresh public GitHub repo** (must be initialized on or after 12 Nov; they check commit history). Name suggestion: `autocast-ai`.
- [ ] Install the Kane CLI skill for your coding agent (docs: "Skills" page) and the official Remotion skill (`remotion-dev/skills`) so the agent writes correct code.
- [ ] Add `.testmuai/evidence/`, `out/`, `.env`, and `node_modules/` to `.gitignore` (Kane docs say not to commit evidence packs).

---

## 1. Judging map (what we are optimizing for)

Judges are three TestMu AI engineers. Three bars must be cleared first, or nothing else is scored:

1. It works end to end.
2. Kane CLI caught or proved something.
3. The agent and Kane CLI talked to each other.

Then four equally weighted dimensions (25% each):

| Dimension | What judges want | How Autocast hits it |
|---|---|---|
| **Ships** | A real flow that runs end to end, not slides | `npm run demo -- "<prompt>"` produces an MP4 from a real app, with a bundled sample app so judges can run it |
| **Verified** | Kane caught or confirmed something meaningful | (a) Kane proves the feature works before we render, (b) Kane catches visual layout bugs in our own rendered video |
| **Closed loop** | Kane's result feeds back to the agent; tighter is better | Shoot loop: Kane failure is classified and the agent rewrites the objective or stops with a bug report. Lint loop and review loop (bonus) add more feedback (see section 6) |
| **Craft** | Would a developer install this tonight? | One command, clean README, genuinely good-looking output, usable on any web app. Only hard requirement is a Kane login; TTS optional, sample app bundled |

**Tie-breaks** go to Verified, then Closed loop. Put the most effort there.

---

## 2. Architecture

```
 "Create a demo of the invoice approval flow"
                    |
                    v
          +---------------------+
          |   Agent (Claude     |   writes the Kane objective
          |   Code / Cursor)    |<-------------------------------+
          +---------------------+                                |
                    |                                            |
        (1) SHOOT   v                                            |
          kane-cli run "<objective>" --agent                     |
          real Chrome, vision-driven, assertions                 |
                    |                                            |
                    +--- run failed? ---> classify (bug vs bad objective)
                    |                      retry (max 3) or STOP, no render
                    v
          evidence pack + NDJSON log + video
                    |
        (2) EDIT    v
          parse steps -> storyboard.json
          (captions, narration, zoom targets, cursor path, timings)
                    |
          narration text -> TTS -> audio clips -> measure durations
                    |
          lint storyboard (schema, bounds, audio fit)   <-- loop 2 (cheap, no Kane)
                    |
        (3) REVIEW  v
          Remotion review page /review?frame=N
          kane-cli run "open ...?frame=N and verify ..."  <-- loop 3 (Kane)
                    |
                    +--- fail ---> agent reads failure + screenshot,
                    |              patches component/CSS/storyboard, re-run
                    v
        (4) RENDER  npx remotion render  ->  out/demo.mp4
```

**Principle:** the LLM makes decisions (what to show, what to say). Remotion only renders a JSON file. This keeps rendering deterministic and makes every decision inspectable and testable.

---

## 3. Day 1 spike: validate the risky assumptions

The original draft assumed the `.evidence` zip contains `video.mp4` and timestamped click logs. The docs say otherwise, so test before building anything.

### What the docs say (and what we still have to confirm)

- An evidence pack contains the test definition, a result summary, per-step screenshots (plus annotated copies), console and network logs, run logs, and failure records. Video is optional in the format.
- Per step, `step.json` records kind, status, duration, URL, action id, click coordinates, and element rect.
- Agent mode (`--agent`) streams NDJSON events (`run_start`, `step_start`, ..., `run_end`) to stdout. The `run_end` event includes `test_url`, `session_dir`, `run_dir`, and token usage.
- For `kane-cli run`, a pack is sealed only when the session is **named** (`--name`). `testmd run` always seals one.
- Kane's marketing says each run captures a persistent video and ShareLink; where that file lives locally is unconfirmed.
- `testmd run` can generate runnable Playwright code from a successful run (via frontmatter or flags).

### Spike checklist (target: 2 hours)

Run one real flow on the sample app:

```bash
kane-cli run "Open http://localhost:8080, log in, click the first invoice, wait for the modal, verify the Approved seal" \
  --url http://localhost:8080 --headless --agent --name spike-1 \
  2> spike.stderr.log | tee spike.ndjson
tail -1 spike.ndjson | jq .
```

(Verify flag names with `kane-cli run --help`.)

Then answer these and write the answers in `docs/spike-findings.md`:

- [ ] Is a video file produced locally? Where? What resolution and fps?
- [ ] Do NDJSON events carry timestamps? Can I compute each step's start offset relative to video start?
- [ ] What fields does `step.json` actually contain? (`unzip -l` the pack, then `unzip -p`.)
- [ ] Is the cursor visible in the video?
- [ ] How long are LLM "thinking" gaps between steps (static frames)?
- [ ] How many credits does one run cost? (Read `token_usage`; budget the loops.)
- [ ] Can I set window size to 1920x1080 (Kane configuration docs)?
- [ ] Does `testmd run` plus Playwright export work for this flow? What does the generated code look like?

### Decision gate (end of Day 1)

Try the paths in this order and take the first one that works:

| Order | Condition | Path |
|---|---|---|
| 1 (primary) | Playwright export from `testmd run` works for the flow | **Path B:** Kane authors and verifies the flow, then replay the generated Playwright script with `recordVideo` at 1920x1080, `deviceScaleFactor: 2`, controlled pace, and our own timestamp log. Sharp footage, exact click timings, no thinking gaps |
| 2 | Kane's video exists and step timings align with it | **Path A:** use Kane's video directly, trim dead time with step timings or ffmpeg `freezedetect` |
| 3 | Kane's video exists but timings don't align | **Path A2:** detect static segments with ffmpeg `freezedetect` and align by matching click coordinates to frame changes |
| 4 | Nothing else works | **Path C:** build the video from per-step `screenshot.png` / `annotated.png` with Ken Burns style motion (less authentic, fully deterministic) |

On Path B, Kane still owns verification: the shoot loop must pass in Kane before the Playwright replay runs, and the replay must hit the same assertion. If the replay diverges from Kane's run, treat it as a failure, not a render.

**Spend the first spike hour on Path B** (`testmd run` plus Playwright export). Only fall back to inspecting Kane's video if it fails.

Everything downstream consumes the same `storyboard.json`, so the path only changes the capture adapter.

---

## 4. Tech stack and repo layout

- **Agent:** Claude Code or Cursor with a tight rules file (section 11). Skip LangGraph unless time remains.
- **Driver and verifier:** `@testmuai/kane-cli` (agent mode).
- **Renderer:** Remotion (React), 1920x1080 at 30 fps, H.264.
- **Audio:** TTS adapter (ElevenLabs, OpenAI TTS, or none) plus `ffprobe` for duration.
- **Glue:** Node + TypeScript (single language across pipeline and Remotion).

```
autocast-ai/
  README.md
  plan.md
  CLAUDE.md                  # agent rules (section 11)
  .env.example
  examples/
    invoice-app/             # small bundled sample app judges can run
    output/                  # pre-rendered demo + a recorded Kane run (fallback)
  src/
    cli.ts                   # npm run demo -- "<prompt>"
    shoot/
      kane.ts                # spawn kane-cli, stream NDJSON, return run info
      objective.ts           # prompt -> Kane objective (LLM)
      classify.ts            # failure classification (result_code based)
    edit/
      parsePack.ts           # evidence pack -> normalized steps
      storyboard.ts          # steps -> storyboard.json
      narration.ts           # steps -> narration text
      tts.ts                 # provider adapter + audio cache
      timing.ts              # audio-first timing, dead-time trimming
      lint.ts                # storyboard validation (loop 2)
    review/
      reviewServer.ts        # serves /review?frame=N
      kaneReview.ts          # runs Kane against the review page (loop 3)
      fix.ts                 # feeds failures back to the agent
  remotion/
    Root.tsx
    Demo.tsx                 # composition, calculateMetadata
    components/
      BrowserFrame.tsx
      CameraRig.tsx          # zoom/pan from target rects
      Cursor.tsx             # synthesized cursor + click ripple
      Sidebar.tsx            # step list + caption
      TitleCard.tsx
      Outro.tsx
      Scene.tsx
  public/                    # source video, audio, music (gitignored except samples)
  out/                       # renders (gitignored)
  docs/
    spike-findings.md
```

---

## 5. Data contract: `storyboard.json`

Everything the renderer needs. The agent edits this file, not React code, for most fixes.

```json
{
  "meta": {
    "title": "Invoice approval",
    "fps": 30, "width": 1920, "height": 1080,
    "source": { "video": "source.mp4", "width": 1920, "height": 1080 },
    "music": null
  },
  "scenes": [
    {
      "id": "s02",
      "step_ref": "tests/<id>/steps/002-<step-id>",
      "caption": "Open the first invoice",
      "narration": "Click any invoice to see its full details.",
      "audio": "audio/s02.mp3",
      "audio_sec": 2.4,
      "segments": [
        { "kind": "idle",   "src_start": 2.0, "src_end": 3.4, "speed": 6 },
        { "kind": "action", "src_start": 3.4, "src_end": 5.1, "speed": 1 }
      ],
      "target": { "x": 640, "y": 310, "w": 420, "h": 56 },
      "camera": { "zoom": 1.7 },
      "cursor": { "from": [300, 200], "to": [850, 338], "click": true },
      "hold_sec": 0.4
    }
  ]
}
```

Field sources: `target`, `cursor.to`, and action timing come from `step.json` (or the Playwright log on Path B). `caption` and `narration` come from the step objective, polished by the LLM.

---

## 6. The three loops (the core of the score)

### Loop 1: Shoot loop (Kane verifies the real app)

1. Agent turns the prompt into a Kane objective (actions plus an assertion, e.g. "verify the 'Approved' seal is visible").
2. Run `kane-cli run ... --agent --name ...`, stream NDJSON, read the final `run_end`.
3. **Pass:** continue to the edit phase.
4. **Fail:** classify using `result_code` (see Kane's Error Codes docs):
   - *Objective problem* (element not found, ambiguous wording): agent rewrites the objective, max 3 attempts.
   - *Product defect* (assertion evaluated and the app was wrong): **stop, render nothing**, print a bug report with the failing step screenshot and Kane's test URL. This is the "demos can't lie" moment.

### Loop 2: Lint loop (fast, no Kane credits)

Before spending Kane runs, validate `storyboard.json` in code: schema, targets within source bounds, `scene_len >= audio_sec + 0.4`, no zoom above the cap, no scene shorter than 1.2 s, total length within a target range. Failures go straight back to the agent as structured errors.

### Loop 3: Review loop (Kane verifies our own video) — BONUS

**Build only after `npm run demo -- "<prompt>"` works end to end.** Loops 1 and 2 already clear all three required bars; this loop strengthens Closed loop but is not the centerpiece.

Kane's vision catches what DOM checks cannot: overlap, clipping, wrong highlight, covered targets.

1. Serve a tiny review page at `/review?frame=N` using `@remotion/player` (`initialFrame`, paused, controls hidden; verify the prop names in the docs). Do **not** depend on a Remotion Studio URL parameter.
2. For each scene, sample 1 or 2 frames (e.g. mid-scene, plus right after the zoom settles).
3. Run Kane per frame with objectives like:
   - `Open http://localhost:5173/review?frame=105 and verify the sidebar shows the text "Step 2: Open the first invoice" fully, with no text cut off or overlapping the video panel.`
   - `Verify the zoomed area shows the invoice row and its Open button without being cropped or covered.`
   - `Verify the cursor is visible and is positioned over the highlighted element.`
4. On failure, pass the agent: Kane's failure record, the step screenshot and `annotated.png`, and the offending scene from `storyboard.json`. The agent patches the component or the storyboard and re-runs **only the failed frames**.
5. Cap at 4 iterations. If still failing, exit non-zero and keep the artifacts.

**Credit control:** use a frame-sampling budget (default: 2 frames per scene, max 12 runs per loop iteration). After the Day 1 spike, set the budget from measured credits per run.

**Not Kane's job:** audio sync. Check narration length against scene duration in code with `ffprobe`.

---

## 7. Editing design spec (what makes it look good)

### Layout (1920x1080)

- Background: dark gradient, single accent color, one typeface (e.g. Inter).
- **Left (about 70%):** the app video inside a rounded browser frame with soft shadow.
- **Right (about 30%):** sidebar with the step list (current step highlighted, past steps checked) and one animated caption line. Do not also burn in subtitles; the sidebar is the text.
- 2 s title card at the start, 2 s outro at the end.

### Camera

- Zoom into `target` with an eased spring, finishing about 0.3 s before the click. On a click scene, add a short zoom punch (about +0.08) that returns. No punch above the 2.0 zoom cap.
- Zoom cap around 1.6x to 1.8x unless the source is higher resolution (soft footage is the main quality risk).
- Wide shot on page loads. Hold, then ease between targets; the camera move is the transition between steps.

### Dead time

- Classify each interval as `idle` (static frames, LLM thinking) or `action` (UI actually changing).
- Speed up idle to about 6x (or jump cut with a short crossfade). Keep action at real time.
- Fallback detection: `ffmpeg -vf freezedetect` to find static segments if logs don't align.

### Cursor

- Synthesized (the real one may not be visible): smooth path between click points, click ripple and a brief scale bounce on `click: true`.

### Narration and timing (audio first)

1. LLM writes narration per scene: 8 to 12 words, present tense, the product's own nouns (invoice id, button, seal). No "now we click". No generic SaaS lines (streamline, visibility, seamlessly). Scene 1 is the hook. The last scene is the punchline. The line stays on screen for the whole scene.
2. Generate TTS per scene (cache by hash of text and voice). Measure with `ffprobe`.
3. `scene_len = max(audio_sec + 0.4, action_len_after_speed)`.
4. If the action is shorter than the narration: hold the last frame or slow down to no less than 0.75x. If longer: speed up idle first, then trim.
5. Remotion `calculateMetadata` sets total duration from the sum of scenes.

TTS provider adapter, chosen by env: `ELEVENLABS_API_KEY`, `OPENAI_API_KEY`, or none (silent plus sidebar only). Silent mode must still work so judges can run it without keys.

### Transitions and music

- `@remotion/transitions` fade or slide **only** between title card, demo, and outro.
- Optional low-volume music bed, ducked under narration with a per-frame volume function. First thing to cut.

### Render settings (starting point; compare on a 5 s test)

```bash
npx remotion render Demo out/demo.mp4 --codec=h264 --crf=16 --image-format=png
```

- PNG frames avoid JPEG fuzz on thin text but are slower. Benchmark `--concurrency` with `npx remotion benchmark`.
- Use the current `Video` from `@remotion/media` (the docs flag older video tags as not optimized); check the docs.
- All animation via `useCurrentFrame()`, `interpolate`, and `spring`. No CSS transitions.

---

## 8. Adaptations from `/brag` (Craft, Safety & Distribution)

Adapted from [latent-spaces/brag](https://github.com/latent-spaces/brag) (audited in `docs/brag-report.md`):

| # | Adaptation | Mechanism in Autocast AI | Status |
|---|---|---|---|
| **1** | **Redact secrets before publishing** | Scrub API keys (`sk_live_...`, `Bearer ...`), private hostnames, tokens, and customer emails from narrations, logs, and video overlays. Seed demo fixtures in replay. | Planned / Medium |
| **2** | **Readable-text rule** | Enforce reading floor: short labels $\ge 0.8\text{s}$ settled; headlines/sentences $\ge 0.3\text{s}$ per word settled (min $1.2\text{s}$). Lint in Loop 2; check in Loop 3 Kane QA. | Planned / Low |
| **3** | **Check mid-transition stills** | Audit boundary frames ($T \pm 5\text{ frames}$) in Loop 3 to catch layer collisions and muddy crossfades. Dip through dark background between disparate views. | Planned / Low |
| **4** | **Hook and narrative shape** | Earn the viewer's attention in the first 2 seconds: cold-open on the outcome (e.g. verified Approved seal), then step highlights, ending on a reconciled ledger punchline. | Implemented / Low |
| **5** | **Poster frame & frame-0 baking** | Extract strongest settled hero frame as `poster.jpg`. Bake into frame 0 of `demo.mp4` via ffmpeg overlay (`enable='eq(n,0)'`) so Slack, Twitter/X, and Discord thumbnails never show a black frame. Generate `share-copy.txt`. | Implemented / Low |

---

## 9. Schedule (IST)

### Day 1, Sun 15 Nov: Setup and spike

- [ ] Section 0 checklist.
- [ ] Sample app (`examples/invoice-app`) running locally, or pick ForgeRoom/ExportEase.
- [ ] Spike (section 3), starting with Path B (`testmd run` plus Playwright export), then `docs/spike-findings.md` and the decision gate.
- [ ] `parsePack.ts` producing normalized steps from one real run.
- [ ] Remotion project scaffolded with the Remotion skill installed.

**Exit criterion:** one real Kane run parsed into a list of steps with click coordinates and a known path (A / B / C).

### Day 2, Mon 16 Nov: Remotion template and first good render

- [ ] `BrowserFrame`, `CameraRig`, `Sidebar`, `Cursor`, `Scene`, `Demo` with `calculateMetadata`.
- [ ] **Early 5 s test render** with real footage: check text sharpness at your zoom, render time, A/V sync.
- [ ] Hand-written `storyboard.json` renders a good-looking 30 s video.
- [ ] Dead-time trimming working.

**Exit criterion:** a hand-fed storyboard produces a video you would be proud to show.

### Day 3, Tue 17 Nov: Agent pipeline, narration, Loop 1

- [ ] `storyboard.ts` generates the JSON from steps automatically.
- [ ] Narration generation plus TTS adapter plus audio-first timing.
- [ ] Loop 1 (classify, retry, stop-on-bug) and Loop 2 (lint).
- [ ] `npm run demo -- "<prompt>"` works end to end on the sample app.
- [ ] Stop-on-bug works: an env flag that breaks the sample app (e.g. `BROKEN=approve` hides the Approved seal) makes Kane fail and Autocast print a bug report with no render.
- [ ] Commit a pre-rendered output to `examples/output/` (the safety net).
- [ ] **Evening:** use Autocast to render a 30 to 45 s sample video for the launch posts.

**Exit criterion (HARD GATE):** one command, one prompt, one MP4, with narration or silent mode. If this is not true by Tuesday night, skip Loop 3 entirely and spend Day 4 making the pipeline reliable and polished.

### Day 4, Wed 18 Nov: Loop 3 (bonus), polish, record, launch buzz

- [ ] Only if the Day 3 gate passed: review page plus `kaneReview.ts` plus fix loop, on at least 3 sampled frames.
- [ ] Add the **chaos flag** (section 9) so the loop can be demonstrated.
- [ ] Title/outro cards, transitions, optional music.
- [ ] README with a judge quick start, `.env.example`, and fallback output in `examples/output/`.
- [ ] **Publish the first two launch posts** (section 10) so they gather engagement before the deadline.
- [ ] Record the demo video (draft cut).

### Day 5, Thu 19 Nov: Submit early

- [ ] Morning: fix only what the draft demo shows is broken. No new features.
- [ ] Final render and final demo recording; upload to YouTube (allow time for processing).
- [ ] Fresh-clone test: clone the repo into an empty folder, follow the README, confirm it runs.
- [ ] Submit the form by **about 4 PM IST**, not the last hour. You can edit until 11:59 PM.

### Cut lines (if behind)

| Behind at | Cut |
|---|---|
| End of Day 2 | Music, outro polish, 60 fps, motion blur |
| End of Day 3 | Cursor ripple, multi-flow support, TTS provider other than one |
| End of Day 3 (gate missed) | Loop 3 entirely, chaos flag, TTS (ship silent mode) |
| End of Day 4 | Transitions beyond a fade, extra sample apps |
| **Never cut** | Loop 1 with stop-on-bug, Loop 2 lint, one command end to end, pre-rendered output in the repo, the fresh-clone test |

---

## 9. Demo video script (3 to 5 minutes, YouTube)

| Time | Content | Judging bar it serves |
|---|---|---|
| 0:00 to 0:20 | **Hook:** play 20 s of a finished Autocast output, no explanation | Craft |
| 0:20 to 0:50 | **Demos can't lie:** same prompt, app broken on purpose, Kane's assertion fails, **no video is rendered**, a bug report with Kane's test URL is printed instead | Verified (tie-break 1) |
| 0:50 to 1:10 | Problem: demo videos are manual and go stale; agents write code but can't check or show their work | Context |
| 1:10 to 1:50 | Fix the app, type the prompt in Claude Code/Cursor; show the Kane run driving the real app; an objective retry if it happens; show pass | Ships, Closed loop |
| 1:50 to 2:40 | Evidence to `storyboard.json` to narration clips to timeline; lint loop catching a bad scene; show the edit assembling | Ships, Closed loop |
| 2:40 to 3:30 | **Bonus loop (if built):** Kane fails a review frame (injected sidebar overlap, stated as injected), the agent reads the failure, patches, Kane passes | Closed loop (tie-break 2) |
| 3:30 to 4:00 | Architecture slide (one), install in one line, where the repo is | Craft |

**Chaos flag:** add an env flag (e.g. `AUTOCAST_CHAOS=sidebar-overlap`) that deliberately breaks the layout so the review loop can be shown on demand. State clearly in the video and README that the bug is injected to demonstrate the loop. Do not present it as an organic bug.

Record the terminal and the browser together so judges see the agent and Kane talking.

---

## 10. Launch buzz (required: at least 2 public posts; more earns bonus)

Post early on Day 4 so engagement accumulates. Platforms: X, LinkedIn, Hacker News, Reddit (e.g. r/SideProject).

1. **X thread:** the generated 30 to 45 s sample video first, then "one prompt, one verified demo", then the three loops, then repo link. Tag the hackathon and #KaneCLIHackDay.
2. **LinkedIn post:** the story angle ("demos that can't lie") plus the same video.
3. **Show HN / Reddit (if time):** concise technical write-up of the closed loop and what we learned about Kane's evidence packs.

Use Autocast to make the launch video (dogfooding is the best proof).

---

## 11. Agent rules file (`CLAUDE.md` / Cursor rules, starter)

```md
# Autocast AI agent rules
- Never write Remotion animation with CSS transitions; use useCurrentFrame, interpolate, spring.
- Do not edit React components for content changes; edit storyboard.json.
- Run `npm run lint:storyboard` before any Kane review run.
- Kane runs: always use `--agent`, parse the final `run_end` line, never scrape human output.
- If a Kane shoot run FAILS an assertion on the product, STOP and report. Do not render.
- Fix only the failing scene or component. No whole-file rewrites.
- Max 3 shoot retries, max 4 review iterations. Then exit non-zero.
- Never commit .env, API keys, evidence packs, or rendered videos.
```

---

## 12. Risks and mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Too much scope for one person in 4.5 days | High | Minimum that wins (top of file); hard gate Tue night; Loop 3 is bonus |
| Evidence pack lacks video or timings don't align | High | Path B is primary; Paths A, A2, C as fallbacks |
| Kane video is low resolution; zoom looks soft | High | Path B with 1080p and device scale factor 2; cap zoom |
| LLM thinking time makes demos sluggish | High | Path B replay has no thinking gaps; idle speed ramp and `freezedetect` for Path A |
| Path B replay diverges from Kane's verified run | Medium | Replay must hit the same assertion; divergence is a failure, never a render |
| Credits run out during loops | Medium | Measure cost per run on Day 1; sample frames; ask on Slack for extras before the deadline |
| Render takes too long on final day | Medium | 5 s test on Day 2; benchmark concurrency; render final by Thu noon |
| TTS key or quota missing for judges | Medium | Silent mode works without keys; ship pre-rendered output in `examples/output/` |
| Judges can't run the target app | Medium | Bundle the sample app; document credentials; include a recorded Kane run as fallback |
| Loop 3 feels contrived or staged to Kane-engineer judges | Medium | Keep it secondary to stop-on-bug; use visual objectives DOM checks can't do (overlap, cropping, highlight position); show Kane's annotated screenshots; say clearly the bug is injected |
| Remotion render quirks (video tag, timeouts) | Medium | Use the current `@remotion/media` video tag; keep a short-render command for debugging |
| Scope creep | High | Cut lines in section 8; no new features on Day 5 |

---

## 13. Submission checklist (by Thu 19 Nov, 11:59 PM IST; target 4 PM)

- [ ] **GitHub URL:** public repo, initialized on or after 12 Nov, no secrets committed.
- [ ] **About:** what it is, which agent, what Kane does (shoot verification plus review loop).
- [ ] **Demo video:** on YouTube, about 3 to 5 minutes.
- [ ] **Live URL:** optional (skip unless a hosted viewer is trivial).
- [ ] **Launch buzz:** at least 2 different public posts, links saved.
- [ ] Registered on TestMu AI with the same email as the hackathon registration; Kane CLI has been run.
- [ ] README: one-command quick start, env vars, sample app, fallback output.
- [ ] Fresh-clone test passed.
- [ ] Credentials for any login (sample app) documented in the README.
- [ ] Remotion license terms checked if you plan to commercialize beyond the hackathon.

---

## 14. Stretch ideas (only after everything above is done)

- **First stretch, highest value:** GitHub Action: on PR, run Autocast and post the verified demo video as a comment (or the bug report if Kane fails). Turns the pitch into a dev workflow tool.
- Multi-flow: one prompt generates a chapter-based video from several Kane runs (`testrun` with parallel execution).
- Mobile: Kane also drives iOS simulator and Android emulator; produce a phone-framed demo.
- Word-level captions and a language switch for narration.
- "README lie detector" mode: turn README steps into a demo and report what is false.
