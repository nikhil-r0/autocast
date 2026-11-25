# Part 2 Feature Drop Plan: Autocast Oracle Mode (78s)

> **Video Title:** *Autocast v0.2 — Oracle Mode: Code That Can't Fake a Payout*  
> **Target Runtime:** **78 seconds** (`2,340` frames @ `30 FPS`, `1920x1080`)  
> **Sequel Context:** Direct continuation of the Part 1 Demo ([YouTube](https://youtu.be/9kUd6yS9JkI) — *"Demos that can't lie"*).  
> **Core Rule:** Zero mocked outputs, zero hardcoded manifest values. Every terminal output, Kane result, 1080p browser replay, `spec_sha256`, `tested_commit`, and Ed25519 `signature` comes directly from live `autocast --oracle` runs and sealed `run-manifest.json` artifacts.

---

## Rubric Alignment Map

| KaneCLI Hackathon Criterion (Weight) | How Part 2 Hits It |
|---|---|
| **Ships (25%)** | Single CLI invocation (`autocast --oracle ... --commit <sha> --with-video --publish stdout-json`) outputs a signed payment manifest, optional 1080p video evidence, and machine-readable payout payload, audited offline via `npm run verify:oracle`. |
| **Verified (25% · Tie-Breaker #1)** | Contrasts a real **fail-closed `hold`** (`APP_BUG=approve-noop`, Kane `740`, exit `1`) against a real **signed `release`** (clean fix, Kane `100`, `application.state_verified: true`, exit `0`) under the exact same Day-1 frozen `AcceptanceSpec` (`spec_sha256` + `contract_id`). |
| **Closed Loop (25% · Tie-Breaker #2)** | Sharp policy contrast with Part 1: the same Kane CLI verification loop triggers autonomous `agy` worktree repair in Demo Mode, whereas in Oracle Mode it **fails closed** (`closed_loop_repair.occurred: false`, zero `agy`, zero retries) when money is on the line. |
| **Craft (25%)** | Tight 78s pacing (`4` clear beats + dedicated end cards), speed-ramped 1080p Playwright replay (`public/oracle-source.mp4`), tactile SFX + `KineticTransition` flares + burned-in `LowerThird` captions for muted viewing, 8-gate offline cryptographic verification, and post-render OCR pixel scan. |

---

## 1. Beat Sheet & Visual Direction (78s Total · 2,340 Frames @ 30 FPS)

### Color Grammar (Locked Across All Beats)
- **Red (`#ef4444`):** `740` failure, `HOLD`, `state_verified: false`
- **Emerald (`#22c55e`):** `100` pass, `RELEASE`, `state_verified: true`, verified gates
- **Amber (`#f59e0b`):** Frozen policy constraints (`closed_loop_repair: false`, Day-1 lock)
- **Cyan (`#38bdf8`):** Cryptographic identifiers (`spec_sha256`, `tested_commit`, `key_id`, `manifest_sha256`)

| Beat | Time / Frames | Layout & Visual Source | Voiceover, Captions & Audio Cues | Rubric Alignment |
|---|---|---|---|---|
| **Beat 1: Hook & Policy Flip** | `0:00 – 0:14` (`14s` / `420f`) | **Remotion Split Policy Card** (`AuroraBackground` + `BorderBeam`) + compact **Frozen Spec Pill** (`contract_id`, `spec_sha256`, omitting commit SHA until delivery) | **Voiceover (~37 words):** *"In Part 1, Autocast caught a silent bug, patched it, and shipped a demo that can't lie. Now meet v0.2 Oracle Mode: code that can't fake a payout. Same Kane engine, opposite policy—no auto-repair, one frozen spec, signed for escrow."*<br>**LowerThird Caption:** `Part 1: 740 → auto-fix` · `Part 2: 740 → HOLD`<br>**SFX:** Subtle ambient swell + `sfx-click.wav` on policy fork reveal. | **Closed Loop** + **Ships** |
| **Beat 2: Fail-Closed `hold` on Buggy Code** | `0:14 – 0:32` (`18s` / `540f`) | **2-Column Staggered Layout** *(avoids 3-card crowding)*:<br>• **Left (`width: 860`):** Filtered `TerminalCard` (6–8 key lines from `hold-terminal.log`, `typingSpeed = 4`)<br>• **Right (`width: 860`):** `KaneCard (740 FAIL)` enters at `f90`, **swaps/morphs at `f280`** to `ManifestBadge (HOLD · repair: false)` | **Voiceover (~42 words):** *"When a buggy approval endpoint returns 200 without updating storage, Kane catches result code 740. Oracle Mode refuses to touch the deliverable—zero worktrees, zero `agy` calls—and seals a signed `hold` manifest exiting code 1."*<br>**LowerThird Caption:** `Kane 740 caught → zero agy repair → signed HOLD`<br>**Transition/SFX:** `KineticTransition` flare at cut; `sfx-click.wav` on CLI line; `sfx-stamp.wav` on `HOLD` seal (`f280`). | **Verified** + **Closed Loop** |
| **Beat 3a: Signed `release` Browser Proof** | `0:32 – 0:50` (`18s` / `540f`) | **3D-Tilted `BrowserFrame` + `BorderBeam` + `CameraRig` Zoom** playing `public/oracle-source.mp4` (speed-ramped `1.45x` on idle typing, snapping to `1.0x` on `Approve Invoice` click & `APPROVED` badge) + **Oracle `FloatingHud` Chips** + **Backend State Pill** (`GET /api/invoices/INV-1042 → status: "Approved"`) | **Voiceover (~34 words):** *"On the fixed commit, `--oracle --commit --with-video` passes Kane 100, verifies `/api/invoices/INV-1042` directly in backend state, and captures 1080p browser proof as optional evidence."*<br>**LowerThird Caption:** `Kane 100 + API state verified → signed RELEASE`<br>**Transition/SFX:** `KineticTransition` flare at cut; `sfx-click.wav` on `Approve Invoice` click & API state pill pop. | **Ships** + **Verified** |
| **Beat 3b: Oracle Verified End Card** | `0:50 – 0:58` (`8s` / `240f`) | **`Outro` (`mode: 'oracle'`)** bound to `release-manifest.json` (`verdict: RELEASE`, `spec_sha256`, `tested_commit`, `state_verified: true`, `repair: false`, `key_id`) | **Voiceover:** *"Ed25519-signed for payout."* *(short 1.5s hold to let stamp settle)*<br>**LowerThird Caption:** *(none — End Card carries copy)*<br>**SFX:** `sfx-stamp.wav` on `RELEASE` seal. | **Verified** + **Craft** |
| **Beat 4a: 8-Gate Offline Verification & Publisher** | `0:58 – 1:12` (`14s` / `420f`) | **2-Column Layout**:<br>• **Left (`width: 860`):** `TerminalCard` (`verify:oracle` + `--publish stdout-json`)<br>• **Right (`width: 860`):** **8-Gate Payment Checklist** animating gates 1–8 green (`12f` per gate) + compact 3-line `VerdictPayload` pill (`manifest_sha256`, `verdict`, `signature`) | **Voiceover (~36 words):** *"Any client or escrow contract verifies all eight payment gates and the runner's Ed25519 signature completely offline—no browser or video required—or streams the payload straight to webhooks or EVM adapters."*<br>**LowerThird Caption:** `8 payment gates verified offline · zero video required`<br>**Transition/SFX:** `KineticTransition` flare at cut; rapid `sfx-click.wav` ticks on gates 1–8. | **Craft** + **Ships** |
| **Beat 4b: Closing Title Card** | `1:12 – 1:18` (`6s` / `180f`) | **`TitleCard`-style Metallic Shimmer Closing Card** (`3.5s+` clean hold): *"Autocast v0.2 — Demos that can't lie. Code that can't fake a payout."* + `autocast --oracle` + `github.com/nikhil-r0/autocast` | **Voiceover (~11 words):** *"Autocast v0.2: demos that can't lie, and code that can't fake a payout."*<br>**SFX:** Subtle fade-out chime. | **Craft** |

*Frame Budget Check:* `420 + 540 + 540 + 240 + 420 + 180 = 2,340` frames = **78.0s** @ 30 FPS.

---

## 2. Exact Execution Runbook (Zero Faked Artifacts)

> **Prerequisite:** Commit all Remotion / script updates cleanly on `main` and verify `npm run preflight` passes before capturing the final runs (`runOraclePreflight` enforces a clean git tree).

### Step 0 — Environment & Key Setup (Run Once Before Filming)

1. Generate a runner Ed25519 keypair outside the repository (or under `.oracle-keys/`, which is gitignored via `.gitignore`):
   ```bash
   mkdir -p .oracle-keys
   openssl genpkey -algorithm ed25519 -out .oracle-keys/runner-private.pem
   openssl pkey -in .oracle-keys/runner-private.pem -pubout -out .oracle-keys/runner-public.pem
   ```
2. Build `ORACLE_TRUSTED_KEYS` JSON keyed by the SHA-256 of the SPKI DER public key (matching `computePublicKeyId` in `src/oracle/sign.ts`):
   ```bash
   node -e "
     const fs = require('fs');
     const crypto = require('crypto');
     const pubPem = fs.readFileSync('.oracle-keys/runner-public.pem', 'utf8');
     const pubKey = crypto.createPublicKey(pubPem);
     const keyId = crypto.createHash('sha256').update(pubKey.export({ type: 'spki', format: 'der' })).digest('hex');
     fs.writeFileSync('.oracle-keys/trusted-keys.json', JSON.stringify({ [keyId]: pubPem }, null, 2));
     console.log('Trusted key_id:', keyId);
   "
   ```
3. Install `examples/ledgerly` dependencies (required for isolated commit builds; ignored by `examples/ledgerly/.gitignore`), build TypeScript, verify Kane CLI auth, and confirm a clean working tree:
   ```bash
   npm --prefix examples/ledgerly ci
   npm run build
   kane-cli --version
   git status --porcelain   # Must be empty before oracle runs
   ```
4. Export oracle environment variables for the session (never print `.oracle-keys/runner-private.pem` in recorded terminal views):
   ```bash
   export ORACLE_SIGNING_KEY=".oracle-keys/runner-private.pem"
   export ORACLE_TRUSTED_KEYS=".oracle-keys/trusted-keys.json"
   export ORACLE_RUNNER_ID="autocast-demo-runner-01"
   export GEMINI_API_KEY=""   # Guarantees deterministic DEFAULT_NARRATIONS during --with-video
   ```
5. Compute the Day-1 frozen `spec_sha256` and capture the 40-char delivery `--commit` SHA:
   ```bash
   SPEC_PATH="examples/oracle/ledgerly-approval.json"
   SPEC_SHA256=$(node -e "import('./dist/oracle/spec.js').then(m => console.log(m.loadAcceptanceSpec('${SPEC_PATH}').specSha256))")
   DELIVERY_COMMIT=$(git rev-parse HEAD)
   echo "SPEC_SHA256=${SPEC_SHA256}"
   echo "DELIVERY_COMMIT=${DELIVERY_COMMIT}"
   ```

### Step 1 — Run 1: Real Fail-Closed `hold` on Buggy Behavior (Exit `1`)

Run with `APP_BUG=approve-noop` and `RUN_ID=oracle-hold`, passing both `--commit` and `--expect-spec-sha256`, capturing verbatim terminal output for Beat 2:
```bash
mkdir -p out/oracle-drop
RUN_ID=oracle-hold APP_BUG=approve-noop \
  node bin/autocast.js --oracle "${SPEC_PATH}" \
  --commit "${DELIVERY_COMMIT}" \
  --expect-spec-sha256 "${SPEC_SHA256}" \
  2>&1 | tee out/oracle-drop/hold-terminal.log
HOLD_EXIT=${PIPESTATUS[0]}
echo "Hold exit code: ${HOLD_EXIT}"   # Must be 1
cp out/runs/oracle-hold/run-manifest.json out/oracle-drop/hold-manifest.json
```
*Expected sealed evidence:* `out/oracle-drop/hold-manifest.json` with `status: "failed"`, `oracle.verdict: "hold"`, `oracle.hold_reason: "kane_failed"`, `kane_verification.result_code: 740`, `closed_loop_repair.occurred: false`, and valid Ed25519 `signature`.

### Step 2 — Run 2: Real Signed `release` + 1080p Playwright Evidence (Exit `0`)

Run cleanly (no `APP_BUG`) with `--with-video` and `--publish stdout-json` under `RUN_ID=oracle-release`:
```bash
RUN_ID=oracle-release \
  node bin/autocast.js --oracle "${SPEC_PATH}" \
  --commit "${DELIVERY_COMMIT}" \
  --expect-spec-sha256 "${SPEC_SHA256}" \
  --with-video \
  --publish stdout-json \
  > out/oracle-drop/release-verdict.json \
  2> out/oracle-drop/release-terminal.log
RELEASE_EXIT=$?
echo "Release exit code: ${RELEASE_EXIT}"   # Must be 0
cp out/runs/oracle-release/run-manifest.json out/oracle-drop/release-manifest.json
cp public/source.mp4 public/oracle-source.mp4   # Preserve isolated copy so demo runs never clobber Beat 3a
```
*Expected sealed evidence:*
- `out/oracle-drop/release-manifest.json`: `status: "verified"`, `oracle.verdict: "release"`, `kane_verification.result_code: 100`, `application.state_verified: true`, `closed_loop_repair.occurred: false`, `artifacts.video` + `artifacts.poster` hashed, and valid Ed25519 `signature`.
- `public/oracle-source.mp4`: genuine 1080p Playwright replay generated by `replayAndRecord()` during Run 2.
- `out/oracle-drop/release-verdict.json`: pure `VerdictPayload` JSON (`spec_sha256`, `tested_commit`, `manifest_sha256`, `verdict: "release"`, `signature`). *(When `--publish stdout-json` is passed, `runOraclePipeline` routes human progress logs to `stderr`, keeping `stdout` clean JSON.)*

### Step 3 — Run 3: Offline 8-Gate Verification (Exit `0`)

Verify the sealed release manifest completely offline (capturing verbatim output for Beat 4a):
```bash
npm run verify:oracle -- out/oracle-drop/release-manifest.json \
  --spec "${SPEC_PATH}" \
  --commit "${DELIVERY_COMMIT}" \
  --trusted-keys .oracle-keys/trusted-keys.json \
  | tee out/oracle-drop/verify-oracle.log
```
*(Optional confidence check: running `npm run verify:oracle -- out/oracle-drop/hold-manifest.json ...` exits `1`, proving payment gates reject the `hold` artifact.)*

### Step 4 — Bind Artifacts, Render `OracleDrop`, & Run OCR + FFprobe Audit

1. Generate voiceover audio stems (via ElevenLabs TTS if `ELEVENLABS_API_KEY` is set, or recorded `.wav`/`.mp3` stems under `public/audio/oracle-beat-*.mp3`), then assemble props from the real sealed manifests, captured logs, and `public/oracle-source.mp4` SHA-256 via `scripts/finalize-oracle-drop.ts` (validated via `verifyOracleManifest`):
   ```bash
   npx tsx scripts/finalize-oracle-drop.ts \
     --spec "${SPEC_PATH}" \
     --commit "${DELIVERY_COMMIT}" \
     --hold-manifest out/oracle-drop/hold-manifest.json \
     --release-manifest out/oracle-drop/release-manifest.json \
     --hold-log out/oracle-drop/hold-terminal.log \
     --release-log out/oracle-drop/release-terminal.log \
     --verify-log out/oracle-drop/verify-oracle.log \
     --verdict-json out/oracle-drop/release-verdict.json \
     --source-video public/oracle-source.mp4 \
     --out out/oracle-drop/oracle-drop-props.json
   ```
2. Render the 78-second Part 2 feature drop video:
   ```bash
   npx remotion render OracleDrop out/oracle-feature-drop.mp4 \
     --codec=h264 \
     --concurrency=2 \
     --props=out/oracle-drop/oracle-drop-props.json
   ```
3. Inspect video stream properties (`1920x1080`, `30 fps`, `78.0s`), run Tesseract OCR pixel safety audit (`scanVideoPixelsForSecrets`) to prove zero `.oracle-keys/` leakage in any frame, and bake the frame-0 poster:
   ```bash
   ffprobe -v error -show_entries format=duration,size:stream=width,height,r_frame_rate,codec_name -of json out/oracle-feature-drop.mp4
   npx tsx -e "import { scanVideoPixelsForSecrets } from './src/edit/ocrScan.js'; scanVideoPixelsForSecrets('out/oracle-feature-drop.mp4').then(r => { console.log(r); if (!r.passed) process.exit(1); });"
   ```

---

## 3. Minimal Remotion / Composition Implementation Plan

To keep Part 1 (`Demo` and `AutoCastShowcase`) 100% unchanged and risk-free, apply additive extensions only:

### A. Additive Oracle Props on Existing Components (Non-Breaking)
- **`remotion/Demo.tsx` (`DemoProps`)**: Add optional `oracle?: OracleManifestOverlay` and `appUrl?: string` (displays `oracle.url` in `<BrowserFrame>` instead of hardcoding `/invoices`).
- **`remotion/components/FloatingHud.tsx` & `remotion/components/Sidebar.tsx`**: Accept optional `oracle?: { verdict: 'release' | 'hold'; resultCode: number; stateVerified: boolean; repairOccurred: boolean }`. When absent, keep exact `✓ Kane Verified` Part 1 badge; when present, render compact chips (`ORACLE: RELEASE`/`HOLD`, `KANE: 100`, `STATE_VERIFIED: true`, `REPAIR: false`).
- **`remotion/components/Outro.tsx`**: Accept optional `oracle?: OracleManifestOverlay`. When provided, render the **Oracle Verified End Card** bound to real props (`oracle.verdict`, `oracle.hold_reason`, `oracle.spec_sha256`, `tested_commit`, `result_code`, `state_verified`, `closed_loop_repair.occurred`, `signature.key_id`).
- **`remotion/components/ManifestBadge.tsx`**: Add optional `mode?: 'demo' | 'oracle'`, `verdict`, `holdReason`, `specSha256`, `repairOccurred`, and `signatureKeyId` props. When `mode === 'oracle'`, render those fields alongside `tested_commit` and `state_verified`, labeling the video SHA row `optional_video_sha256` (or `not attached (payment-decoupled)`).

### B. Dedicated `remotion/OracleDrop.tsx` Composition (78s · 2,340 Frames)
- Register `<Composition id="OracleDrop" component={OracleDrop} width={1920} height={1080} fps={30} durationInFrames={2340} ... />` in `remotion/Root.tsx`.
- Implement Beat 3a timing cleanly: inspect `public/oracle-source.mp4` duration in `finalize-oracle-drop.ts` so `<OffthreadVideo>` speed-ramps idle typing (`1.4x–1.6x`) or trims dead lead-in frames to settle cleanly on the `APPROVED` badge within `540` frames before cutting to Beat 3b (`240f` Oracle `Outro`).
- Mount `KineticTransition` flares on scene boundaries, `sfx-click.wav` / `sfx-stamp.wav` via `<Audio>`, voiceover stems inside each `<Series.Sequence>` (when audio paths exist in props), and concise `LowerThird` captions across Beats 1, 2, 3a, and 4a.
- Props interface (`OracleDropProps`), populated exclusively by `scripts/finalize-oracle-drop.ts` from disk artifacts (`hold-manifest.json`, `release-manifest.json`, captured `.log` files, `release-verdict.json`, `public/oracle-source.mp4`).

### C. Keep `src/oracle/runner.ts` Sealing Order Untouched
- In `src/oracle/runner.ts:207-275`, `defaultCaptureOptionalVideo` renders `Demo` before `sealAndOptionallyPublish` seals `out/run-manifest.json`.
- Because `OracleDrop` consumes `public/oracle-source.mp4` directly in Beat 3a and reads `release-manifest.json` in Beat 3b, **zero changes to `src/oracle/runner.ts` are required**, preserving the tested sealing pipeline intact.

---

## 4. Pre-Flight Risks & Checks

1. **Single-Commit Bug Injection vs. Two Distinct Commits (`--commit` separation)**
   - Since `expected_commit` is passed via `--commit <40-char-sha>` (not hashed inside `AcceptanceSpec`), **one frozen `spec.json` (`spec_sha256` + `contract_id`)** now works identically for both:
     - **Single commit (`APP_BUG=approve-noop` vs. clean):** Simplest for filming (`DELIVERY_COMMIT=$(git rev-parse HEAD)`).
     - **Two commits (`--commit C_bug` vs. `--commit C_fix`):** Contrasts two real git commits under the **exact same `spec_sha256`** (`preparePinnedAppCheckout()` extracts each commit via `git archive`).
   - Either way, verify `examples/ledgerly/node_modules` is installed first (`npm --prefix examples/ledgerly ci`) so isolated checkouts can symlink `node_modules` and run `npm run build` cleanly.
2. **Do Not Use `scripts/finalize-showcase.ts` for Oracle Drops**
   - `scripts/finalize-showcase.ts:30` and `scripts/verify-provenance.ts:28-33` require `mode: 'demo'` + `visual_qa`. Use `npm run verify:oracle` and `scripts/finalize-oracle-drop.ts` backed by `verifyOracleManifest()`.
3. **`out/run-manifest.json` Overwrite Between Run 1 and Run 2**
   - Every `autocast --oracle` run overwrites `out/run-manifest.json` while also saving `out/runs/<runId>/run-manifest.json`. Always pass distinct `RUN_ID=oracle-hold` / `RUN_ID=oracle-release` and copy each run's manifest into `out/oracle-drop/` immediately.
4. **Port `8080` Conflicts & Deterministic Seed Reset**
   - Ensure no manual `npm run app` or stray server holds port `8080` (`strictPort: true` exits `2`). `replayAndRecord` posts `/api/reset` without a body, defaulting to `'ledgerly-default-v1'` (`examples/ledgerly/server/index.js:73`).
5. **Keep Private Signing Keys Off-Screen**
   - Store keys under gitignored `.oracle-keys/` and pass a file path (`ORACLE_SIGNING_KEY=.oracle-keys/runner-private.pem`) rather than pasting PEM text in terminal commands. Confirm clean pixels with `scanVideoPixelsForSecrets('out/oracle-feature-drop.mp4')`.
