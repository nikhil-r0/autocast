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
  <a href="https://github.com/nikhil-r0/autocast/actions"><img src="https://img.shields.io/badge/Build-Passing-emerald?style=flat-square" alt="Build"></a>
  <a href="tests/"><img src="https://img.shields.io/badge/Tests-42%2F42%20Pass%20(100%25)-blue?style=flat-square" alt="Tests"></a>
  <a href="scripts/verify-provenance.ts"><img src="https://img.shields.io/badge/Release%20Gates-6%2F6%20Verified-success?style=flat-square" alt="Release Gates"></a>
  <a href="out/autocast-hackathon-showcase.mp4"><img src="https://img.shields.io/badge/Showcase-3%3A45%20(225s)-violet?style=flat-square" alt="Showcase Duration"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-lightgrey?style=flat-square" alt="License"></a>
</p>

Autocast turns a product workflow into a finished demo video, and it refuses to ship one that the product cannot actually perform. Kane CLI proves the feature works before a frame is recorded. If Kane finds a bug (`740`), Antigravity AI (`agy`) patches the source in an isolated worktree and Kane re-verifies (`100`). Only then does Playwright capture 1080p footage, Kane inspect visual layout, Tesseract OCR scrub for secrets, and Remotion render the final MP4 sealed with a SHA-256 provenance manifest.

> **Inspect Without Running:** You do not need to install dependencies to evaluate our evidence. Pre-rendered videos and sealed machine evidence packs are committed in [`examples/output/`](examples/output/) and [`docs/catches/catch-ledgerly-approval/`](docs/catches/catch-ledgerly-approval/). Inspect the verified MP4, tamper-evident `run-manifest.json`, and SHA-256 hashes immediately.

---

## 🎥 Verified Demonstration & Evidence Links

| Asset | Description | Direct Link |
|---|---|---|
| **🎬 Showcase Video** | 3:45 full hackathon presentation (failure, repair, flowchart, demo, PR) | [`out/autocast-hackathon-showcase.mp4`](out/autocast-hackathon-showcase.mp4) |
| **🎥 Product Demo** | 2:59 standalone product demo of verified Ledgerly invoice flow | [`out/demo.mp4`](out/demo.mp4) |
| **🔗 GitHub PR #2** | Live pull request with Kane assurance report & code diff | [PR #2 on GitHub](https://github.com/nikhil-r0/autocast/pull/2) |
| **🔴 Kane 740 Failure** | Hosted LambdaTest Test Manager run showing failure & console logs | [View Kane 740 Defect](https://test-manager.lambdatest.com/projects/01M7G731FR81J5BGBWP3Y53FHF/test-cases/01M7QBRZR4FRVMB943TNRAG5PV/dashboard/share/US_DI4N4K9JKH8XJIJV21PI9C1O8S14VK91Q077F66Q6H6O7CBY8G3Q2Z1GZ0IR6PFJ?type=summary&agentView=true&fqdn=summary-page) |
| **🟢 Kane 100 Pass** | Hosted LambdaTest Test Manager run proving post-repair pass | [View Kane 100 Pass](https://test-manager.lambdatest.com/projects/01M7G731FR81J5BGBWP3Y53FHF/test-cases/01M7QC3EMRSVJKXF11RPKAZRVG/dashboard/share/US_LEHGINX5N6K8F08SZWYR5A5CNWSKGJSE4G6G4TU5OWLL2SV3WWU6PZD17ZUJLE30?type=summary&agentView=true&fqdn=summary-page) |

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
| `npm test` | Run complete 42-test automated suite (100% pass) |
| `npm run demo -- "<prompt>"` | Run full pipeline: verify, repair, capture, review, render |
| `npm run verify:provenance` | Audit all 6 release gates on rendered demo and manifest |
| `npm run verify:showcase` | Audit all 10 checks on 3:45 competition showcase video |
| `npm run app` | Start bundled Ledgerly demo application on port 8080 |
| `npm run preview` | Open Remotion Studio for interactive video preview |

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
