<p align="center">
  <img src="docs/cover.jpg" alt="Autocast AI — Demos that can't lie." width="820">
</p>

<h1 align="center">Autocast AI</h1>

<p align="center">
  <strong>The autonomous demo director.</strong><br>
  One plain-English prompt in. A narrated, zoomed, verified product demo out.<br>
  <em>Demos that can't lie.</em>
</p>

<p align="center">
  <a href="https://github.com/nikhil-r0/autocast/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/nikhil-r0/autocast/ci.yml?branch=main&style=flat-square&label=CI" alt="CI"></a>
  <a href="tests/"><img src="https://img.shields.io/badge/Tests-79%20Pass%20%2B%202%20Tier--B%20TODOs-blue?style=flat-square" alt="Tests"></a>
  <a href="scripts/verify-provenance.ts"><img src="https://img.shields.io/badge/Release%20Gates-6%2F6%20Verified-success?style=flat-square" alt="Release Gates"></a>
  <a href="examples/output/sample-demo.mp4"><img src="https://img.shields.io/badge/Committed%20Demo-36s%20Verified-violet?style=flat-square" alt="Committed Demo"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-lightgrey?style=flat-square" alt="License"></a>
</p>

Autocast turns a product workflow into a finished demo video, and it refuses to ship one that the product cannot actually perform. Kane CLI proves the feature works before a frame is recorded. If Kane finds a bug (`740`), Antigravity AI (`agy`) patches the source in an isolated worktree and Kane re-verifies (`100`). Only then does Playwright capture 1080p footage, Kane inspect visual layout, Tesseract OCR scrub for secrets, and Remotion render the final MP4 sealed with a SHA-256 provenance manifest.

For paid software milestones and escrow payouts, Autocast also includes an experimental **Oracle Mode** (**beta: trusted code only, no real funds**) (`autocast --oracle <spec.json> --commit <40-char-sha> --expect-spec-sha256 <64-hex>`) that fails closed without editing code, pins commit/seed/URL, verifies backend `api_state`, seals an Ed25519-signed manifest (`release`, `hold`, or `inconclusive`), and skips video rendering unless requested. See [**docs/ORACLE.md**](docs/ORACLE.md) for the spec schema, payment gates, and threat model.

> **Inspect Without Running:** You do not need to install dependencies to evaluate our evidence. Pre-rendered product demo video and sealed machine evidence packs are committed in [`examples/output/`](examples/output/) and [`docs/catches/catch-ledgerly-approval/`](docs/catches/catch-ledgerly-approval/). Inspect the verified MP4, tamper-evident `run-manifest.json`, and SHA-256 hashes immediately. The longer competition showcase (≈3:45) is produced locally with `npm run render:showcase` and is gitignored under `out/`.

---

## 🎥 Verified Demonstration & Evidence Links

| Asset | Description | Direct Link |
|---|---|---|
| **🎥 Product Demo** | Verified Ledgerly invoice approval flow (committed sample) | [`examples/output/sample-demo.mp4`](examples/output/sample-demo.mp4) |
| **🧾 Run Manifest** | Tamper-evident SHA-256 provenance for the committed demo | [`examples/output/run-manifest.json`](examples/output/run-manifest.json) |
| **🖼 Poster** | Frame-0 hero still used for link previews | [`examples/output/poster.jpg`](examples/output/poster.jpg) |
| **🔗 GitHub PR #2** | Live pull request with Kane assurance report & code diff | [PR #2 on GitHub](https://github.com/nikhil-r0/autocast/pull/2) |
| **🔴 Kane 740 Failure** | Hosted LambdaTest Test Manager run showing failure & console logs | [View Kane 740 Defect](https://test-manager.lambdatest.com/projects/01M7G731FR81J5BGBWP3Y53FHF/test-cases/01M7QBRZR4FRVMB943TNRAG5PV/dashboard/share/US_DI4N4K9JKH8XJIJV21PI9C1O8S14VK91Q077F66Q6H6O7CBY8G3Q2Z1GZ0IR6PFJ?type=summary&agentView=true&fqdn=summary-page) |
| **🟢 Kane 100 Pass** | Hosted LambdaTest Test Manager run proving post-repair pass | [View Kane 100 Pass](https://test-manager.lambdatest.com/projects/01M7G731FR81J5BGBWP3Y53FHF/test-cases/01M7QC3EMRSVJKXF11RPKAZRVG/dashboard/share/US_LEHGINX5N6K8F08SZWYR5A5CNWSKGJSE4G6G4TU5OWLL2SV3WWU6PZD17ZUJLE30?type=summary&agentView=true&fqdn=summary-page) |

Local pipeline outputs (`out/demo.mp4`, `out/autocast-hackathon-showcase.mp4`) are produced by the commands below and intentionally ignored by git.

---

## The Three Decoupled Loops

| Loop | What it checks | What happens on failure |
|---|---|---|
| **1. Shoot (Correctness)** | Strict Kane run (`--bug-detection stop`) on live web app | Confirmed defect (`740`) triggers Antigravity AI (`agy`) repair in Git worktree. No video renders until Kane confirms fix (`100`) and DB state matches. |
| **2. Review (Cinematic)** | Storyboard lint + Kane visual QA in headless Chrome (port 8081) | Storyboard is patched once. If visual flaws persist, MP4 is rendered for diagnostic audit, but stamped `UNVERIFIED DRAFT` and blocked from release. |
| **3. Safety (Release)** | Post-render Tesseract OCR scan on video pixels & text assets | Hard stop: secrets moved to `.quarantine/`. Clean renders receive tamper-evident `run-manifest.json` with SHA-256 hashes. |

---

## Quick Start

**Requirements:** Node.js 18+, Kane CLI (`kane-cli login`), and Antigravity CLI (`agy` in PATH or set `AGY_PATH`). Gemini API key is optional (for AI narration; falls back to silent captions).

```bash
git clone https://github.com/nikhil-r0/autocast.git
cd autocast
npm install
cp .env.example .env
```

`npm install` also builds `dist/` via the `prepare` script so the `autocast` CLI entrypoint is ready.

> *(Optional — AI coding agents only)* If you plan to use an AI coding agent to author or customize Remotion compositions, run `npm run skills:install` to restore the pinned Remotion guidance skills from `skills-lock.json`. This is **not** required to run `npm run demo`, `npm test`, or verification commands.

### Run the Closed-Loop Pipeline with Injected Bug
```bash
APP_BUG=approve-noop npm run demo -- "Create a demo of the invoice approval flow"
```

The output files are `out/demo.mp4` (with frame-0 thumbnail baked in), `out/poster.jpg`, `out/share-copy.txt`, and `out/run-manifest.json`.

---

## Commands

| Command | Purpose |
|---|---|
| `npm run preflight` | Run environment, clean-tree, and git sync auditor |
| `npm test` | Run complete 81-test suite (79 passing + 2 expected Tier B TODO red-team boundaries) |
| `npm run demo -- "<prompt>"` | Run full pipeline: verify, repair, capture, review, render |
| `npm run verify:provenance` | Audit release gates on `out/` or committed `examples/output` evidence |
| `npm run verify:oracle` | Audit Ed25519-signed oracle payment gates on a sealed manifest |
| `npm run reverify:oracle` | Third-party offline verification and `--reshoot` reproducibility check |
| `npm run verify:showcase` | Audit rendered showcase, or committed evidence pack if `out/` is absent |
| `npm run app` | Start bundled Ledgerly demo application on port 8080 |
| `npm run preview` | Open Remotion Studio for interactive video preview |
| `npm run skills:install` | *(Optional)* Restore pinned Remotion agent skills from `skills-lock.json` |

---

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `AGY_PATH` | `agy` | Path to Antigravity CLI binary (or custom location) |
| `TARGET_APP_URL` | `http://localhost:8080` | URL of the web application under test |
| `APP_BUG` | *(none)* | Set `approve-noop` to simulate bug injection and closed-loop repair |
| `GEMINI_API_KEY` | *(none)* | Optional; generates benefit-led voiceover and scene captions |
| `ELEVENLABS_API_KEY` | *(none)* | Optional TTS voiceover; leaves silent when blank |

---

📖 **Deep Dive:** For full architectural diagrams, Kane CLI exit code schemas, lifecycle adapter specs, and the complete test matrix, see [**docs/ARCHITECTURE.md**](docs/ARCHITECTURE.md).
