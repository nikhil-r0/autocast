# Day 1 Spike Findings

Date: Sun 15 Nov 2026
Target: Kane CLI v0.10.4 on bundled invoice-app (`http://localhost:8080`)
Session: `spike-1` (id: `5343a436-3905-4c42-a567-e5f4b956839f`)

---

## 1. Spike Checklist Answers

- **Is a video file produced locally? Where? What resolution and fps?**
  - **No local video file** is included in the `.evidence` pack or the local session directory. Kane CLI stores screenshots (`screenshot.jpg`, `annotated.png`), DOM state, and network/action logs locally, and streams video to the Test Manager cloud dashboard.
  - **Decision:** As planned, **Path B (Playwright Replay)** is our primary capture pipeline. Playwright records crisp 1920x1080 video at 30/60 fps with zero compression artifacts and no LLM thinking gaps.

- **Do NDJSON events carry timestamps? Can I compute each step's start offset?**
  - **Yes.** Every NDJSON stream event carries an ISO 8601 timestamp `ts` (e.g., `"ts":"2026-11-15T18:28:18.692Z"`).
  - Additionally, `0-actions.ndjson` inside the evidence pack includes microsecond-precision timestamps and `duration_ms` for every single action.

- **What fields does `step.json` actually contain?**
  ```json
  {
    "kind": "click",
    "status": "passed",
    "summary": "click: Clicking the Approve Invoice button",
    "duration_ms": 5489.3,
    "url": "http://localhost:8080/",
    "action_id": "96678287-5b50-4558-a097-b33a3d310286",
    "element_rect": {
      "x": 1064,
      "y": 740,
      "width": 108,
      "height": 18
    },
    "ordinal": 3,
    "id": "0-3"
  }
  ```
  `0-actions.ndjson` also contains:
  ```json
  "visual_data": {
    "x": 1118,
    "y": 749,
    "bbox": { "x": 1064, "y": 740, "width": 108, "height": 18 },
    "viewport_width": 1920,
    "viewport_height": 1080
  }
  ```
  This gives us **exact click coordinates** `(1118, 749)` and **element bounding boxes** for zooming and cursor animation.

- **Is the cursor visible in the video?**
  - Not in headless raw captures. Remotion will synthesize a smooth, high-fidelity cursor with click ripples using the extracted coordinates.

- **How long are LLM "thinking" gaps between steps?**
  - In Kane's live run, thinking gaps were between 3 to 13 seconds per step.
  - Path B completely eliminates this: Playwright replays the exact sequence smoothly in real-time (~2 seconds per action) without pauses.

- **How many credits does one run cost?**
  - The entire 5-step run consumed **18.97 credits**.
  - With 11,200 credits available, we have budget for over **550 full runs**, easily accommodating the shoot loop and review loops.

- **Can I set window size to 1920x1080?**
  - Yes, Kane CLI defaults to `1920x1080` (confirmed via `kane-cli config show`).

- **Does `code-export` / Playwright export work?**
  - **Yes.** Passing `--code-export --code-language javascript` generated `code-export/test.js` with exact Playwright selectors (`#btn-view-INV-1001`, `internal:role=button[name="Approve Invoice"i]`).

---

## 2. Decision Gate

**Selected Path: Path B (Primary)**
1. **Kane Authors & Verifies:** `kane-cli run "<objective>" --agent` runs first.
   - If Kane fails because of an app bug -> STOP and report (demos can't lie).
   - If Kane passes -> extract step actions, target rects, and selectors.
2. **Playwright Replay & Record:** Replay the validated actions against `TARGET_APP_URL` at 1920x1080 with Playwright `recordVideo`.
3. **Remotion Render:** Feed the crisp video, extracted targets, and generated narration into `storyboard.json` and render via Remotion.
