# Part 2 Feature Drop Plan: Autocast Oracle Mode (Audio-Driven Runtime)

> **Video Title:** *Autocast Oracle — Milestone Decisions, Backed by Signed & Verifiable Proof*  
> **Resolution & Codec:** `1920x1080`, `30 FPS`, `h264` (final runtime determined by measured voiceover stems + padding, not a hardcoded duration)  
> **Core Rule:** Zero mocked outputs, zero fixture stand-ins, zero manually supplied assertion strings. Opening animations illustrate the escrow dispute and Oracle workflow visually (explicitly labeled *illustrative*); every terminal output, Kane result (`740` vs `100`), 1080p browser replay, `spec_sha256`, `tested_commit`, API assertion check, and Ed25519 `signature` in Beats `2–4a` comes directly from fresh live `autocast --oracle` runs across two genuinely distinct commits (`C_bug` vs. `C_fix`) and offline verification via [`verify-oracle.ts`](file:///mnt/extra-maal/autocast/scripts/verify-oracle.ts).

---

## 0. Authoritative Production Sequence

1. **Finalise Script (Section 1):** Lock conversational, documentary narration (~140–150 WPM in opening beats) with accurate claims and beta caveats.
2. **Generate Voiceover Stems:** Synthesize `public/audio/oracle-beat-{0a,0b,1,2,3a,3b,4a,4b}.mp3`, inspect cadence/pauses, and compute exact per-beat durations with `ffprobe`.
3. **Build & Inspect Opening Animations:** Build **Animation A** (*The Escrow Problem*, Beat 0a) and **Animation B** (*The Oracle Workflow*, Beat 0b) + **Animation C** (*Trust Seal* bridge), and visually verify stills before wiring the rest of the film.
4. **Complete All Code & Runbook Fixes (Section 4 Checklist):** Implement beta Gate 10 headline, honest `OracleEndCard` wording, fail-closed `filterLog` + signal extraction, derived `apiStateLine`, `TerminalCard` wrapping, 8-beat TypeScript wiring, per-run `out/runs/<runId>/demo.mp4` + replay seal fix, and `--source-trim-before` / `--source-playback-rate` flags.
5. **Execute Fresh Two-Commit Live Runs & Offline Verify (Section 3):** Run `C_bug` (`hold`), `C_fix` (`release --with-video`), and offline `verify:oracle --allow-unisolated-beta` cleanly on `main`.
6. **Inspect Footage, Finalise, Render & QA:** Inspect captured `public/oracle-source.mp4` to select exact start trim (keeping `1.0x` normal playback unless warranted), render `out/oracle-feature-drop.mp4`, spot-check frames across all 8 beats, and run `ffprobe` + `scanVideoPixelsForSecrets`.

---

## 1. Timed Voiceover Script (Source of Truth)

> **Tone:** Conversational, slightly cinematic documentary. Explain locked milestone escrow **before** introducing commits, hashes, or Ed25519 signatures. Describe `C_bug` accurately (`state_verified: false` on Kane `740`) and make the **Gate 10 container-isolation beta limit** unmistakable.

| Beat | Base Min Frames | Narration Script (Word Count) | Visual Intent & Captions |
|---|---|---|---|
| **Beat 0a** (*The client–contractor dispute*) | `300f` (`10s+`, padded from audio) | *"You're funding a software milestone. The contractor says it's done. The dashboard says approved—but the feature still fails. Should escrow release the money?"* *(24 words · ~144 WPM)* | **Animation A — The Escrow Problem:** Left **Contractor** card (*Submits milestone*), Right **Client** card (*Needs proof before approving*), Center **Locked Escrow Vault** (*Milestone funds: Locked in escrow* — deposited and still locked, not already paid out), mismatch alert (`Dashboard: Invoice Approved` vs `Actual acceptance check: Invoice Pending`), bottom label: `Illustrative scenario — not a captured Oracle test result.`<br>**Caption:** `Milestone funds locked in escrow · Conflicting claims need proof` |
| **Beat 0b** (*Oracle enters the workflow*) | `300f` (`10s+`, padded from audio) | *"AutoCast Oracle locks the acceptance rules, pins the submitted commit, and tests the delivery without changing its code."* *(18 words · ~110 WPM — lets workflow settle cleanly)* | **Animation B — The Oracle Workflow:** Animated SVG pipeline (`Frozen Spec` → `Pinned Commit` → `Kane Verification` → `Deterministic Assertions` → `Signed Verdict`) + **One Frozen AcceptanceSpec** branching to two signed evaluations (`C_bug → 740 HOLD` vs `C_fix → 100 RELEASE`).<br>**Caption:** `Two deliveries · One frozen contract · Zero code modification` |
| **Beat 1** (*Demo Mode vs Oracle Mode*) | `300f` (`10s+`, padded from audio) | *"Demo Mode can repair failures. Oracle Mode cannot. It judges the exact commit submitted against the contract both parties agreed."* *(20 words · ~120 WPM)* | **Policy Split Card (Ledgerly Case):** `DEMO MODE (740 → auto-fix)` vs `ORACLE MODE (Fail → HOLD)` + compact frozen contract badge (`contract_id`, `spec_sha256`).<br>**Caption:** `Demo Mode repairs · Oracle Mode grades as-submitted` · **SFX:** `sfx-click.wav` |
| **Beat 2** (*Buggy commit `C_bug` — signed `HOLD`*) | `540f` (`18s+`, padded from audio) | *"First, we evaluate a buggy commit against the frozen Ledgerly contract. The interface claims approval, but Kane cannot verify the agreed acceptance objective. With repair disabled, Oracle seals a signed HOLD."* *(31 words)* | **Live Run 1 (`C_bug`):** Left [`TerminalCard`](file:///mnt/extra-maal/autocast/remotion/components/TerminalCard.tsx) renders curated signal lines from `out/oracle-drop/hold-terminal.log` (pinned commit, Kane CLI invocation, `🚨 [Oracle HOLD] Kane failed (confirmed_product_bug, code=740)`). Right [`OracleVerdictSlab`](file:///mnt/extra-maal/autocast/remotion/components/OracleVerdictSlab.tsx) flips at `swapAt` to `ManifestBadge: HOLD · repair: locked off · state: unverified`.<br>**Caption:** `Commit C_bug · Objective failed · Signed HOLD (exit 1)` · **SFX:** `sfx-stamp.wav` |
| **Beat 3a** (*Fixed commit `C_fix` — verification + browser proof*) | `540f` (`18s+`, padded from audio) | *"Next, a corrected commit is submitted against the exact same spec hash. Kane passes at 100, deterministic checks verify declared UI visibility and `/api/invoices/INV-1042` API assertions, and Playwright records optional 1080p browser proof."* *(35 words)* | **Live Run 2 (`C_fix`):** 3D-tilted [`BrowserFrame`](file:///mnt/extra-maal/autocast/remotion/components/BrowserFrame.tsx) playing trimmed `public/oracle-source.mp4` at normal `1.0x` playback rate (skipping empty lead-in frames only so Ledgerly loads crisply right away) + **Derived Backend Assertion Pill** auto-populated from verified `AcceptanceSpec` `api_state` rule when `release.application.state_verified === true`.<br>**Caption:** `Commit C_fix · Kane 100 + declared UI & API assertions verified` |
| **Beat 3b** (*Signed `RELEASE` card*) | `135f` (`4.5s+`, padded from audio) | *"Both checks pass, sealing Ed25519-signed acceptance evidence."* *(7 words)* | **Animation C (Start) — The Trust Seal:** [`OracleEndCard`](file:///mnt/extra-maal/autocast/remotion/components/OracleEndCard.tsx) stamped `RELEASE` (`spec_sha256`, `C_fix`, `state_verified: true`, `repair: locked off`, `key_id`, subtitle: `"Ed25519-signed acceptance proof · inspect offline"`).<br>**SFX:** `sfx-stamp.wav` |
| **Beat 4a** (*Offline 10-gate verification*) | `420f` (`14s+`, padded from audio) | *"Anyone with the trusted public key verifies the manifest completely offline—no browser or video needed—while Gate ten explicitly refuses production real-funds release in this unisolated beta until container sandboxing ships."* *(31 words)* | **Animation C (Complete) — `TransitionSeries` into Offline Inspection:** Left [`TerminalCard`](file:///mnt/extra-maal/autocast/remotion/components/TerminalCard.tsx) displays real curated `out/oracle-drop/verify-oracle.log` lines (Manifest, Spec, Commit, Gates `1–10`, `RELEASE MANIFEST VERIFIED — BETA ISOLATION LIMITATION` + `Gate 10: NOT CLEARED — NOT AUTHORIZED FOR REAL FUNDS`). Right [`OracleGateList`](file:///mnt/extra-maal/autocast/remotion/components/OracleGateList.tsx) ticks Gates `1–9` green and marks Gate `10` (`Container isolated (Tier B)`) red.<br>**Caption:** `9/10 gates verified offline · Gate 10 blocks real-funds release in beta` |
| **Beat 4b** (*Closing title card*) | `180f` (`6s+`, padded from audio) | *"Autocast Oracle: milestone decisions backed by signed, verifiable proof."* *(9 words)* | **Closing [`TitleCard`](file:///mnt/extra-maal/autocast/remotion/components/TitleCard.tsx):** Title *"Autocast Oracle — Milestone decisions backed by signed, verifiable proof."* + pills (`SIGNED ACCEPTANCE EVIDENCE`, `OFFLINE 10-GATE VERIFY`, `github.com/nikhil-r0/autocast`). |

---

## 2. Remotion Animation & Tooling Inventory

### A. 3 Motion-Graphics Sequences (`<= 2` Dominant Effects per Scene)

1. **Sequence A (`Beat 0a · ExplainEscrowBeat`):** Dark navy [`AuroraBackground`](file:///mnt/extra-maal/autocast/remotion/components/AuroraBackground.tsx); clean vector Contractor & Client cards; pulsing central **Locked Escrow Vault** padlock card; animated dashed SVG connector (`strokeDashoffset`); stark status mismatch pill (`Dashboard: Invoice Approved` vs `Acceptance check: Pending`); explicit bottom caption `"Illustrative scenario — not a captured Oracle test result."`
2. **Sequence B (`Beat 0b · ExplainWorkflowBeat`):** 5-stage horizontal Oracle pipeline (`Frozen Spec` → `Pinned Commit` → `Kane Check` → `Assertions` → `Signed Verdict`) wired via animated SVG line sweep + spring-staggered stage badges, with the twin `C_bug (740 HOLD)` vs `C_fix (100 RELEASE)` cards below sharing one invariant `AcceptanceSpec`.
3. **Sequence C (`Beat 3b → Beat 4a` Bridge):** `@remotion/transitions` (`<TransitionSeries>` `fade()`/`slide()`) seamlessly transitioning the Ed25519 `RELEASE` trust seal into the 10-gate offline verifier and curated terminal log (removing any dead dark transition gap).

### B. Verified On-Device & Online Tooling

- **Remotion & Transitions:** `remotion`, `@remotion/cli`, `@remotion/media`, `@remotion/player`, `@remotion/transitions` (all installed in [`package.json`](file:///mnt/extra-maal/autocast/package.json); optionally promote `@remotion/paths`/`@remotion/shapes` if imported directly and align `zod` `4.6.7`).
- **Voiceover / TTS Generation:**
  - `pip3` (`/home/home/.local/bin/pip3`) → install `edge-tts` (`en-US-AndrewNeural` / `en-US-BrianNeural`, free Microsoft neural documentary voices, crisp natural pauses) **or** `GEMINI_API_KEY` (already populated in `.env`) as backup. Measure each generated `.mp3` with `ffprobe` so audio dictates `beatFrames`.
- **Capture, Frame Inspection & Security QA:** `ffmpeg 8.0.1`, `ffprobe`, `tesseract.js` (`scanVideoPixelsForSecrets`), `playwright 1.49.1`, `kane-cli 0.10.4`, `openssl`, [`generate-sfx.js`](file:///mnt/extra-maal/autocast/scripts/generate-sfx.js).

---

## 3. Exact Execution Runbook (After Step 2–4 Fixes Ship)

### Step A — Voiceover Stems First (Stage 2)
1. Synthesize all 8 narration tracks (`public/audio/oracle-beat-{0a,0b,1,2,3a,3b,4a,4b}.mp3`) matching Section 1 wording verbatim.
2. Probe durations via `ffprobe` to verify relaxed pacing and absence of clipping.

### Step B — Two Live Commits & Real Oracle Evaluations (Stage 5)
1. Ensure `.oracle-keys/runner-private.pem` & `.oracle-keys/trusted-keys.json` exist (gitignored).
2. Run Run 1 on genuine `C_bug` commit (`BUG_COMMIT`, committed `approve-noop` defect):
   ```bash
   mkdir -p out/oracle-drop
   RUN_ID=oracle-hold node bin/autocast.js --oracle "${SPEC_PATH}" \
     --commit "${BUG_COMMIT}" --expect-spec-sha256 "${SPEC_SHA256}" --single-run \
     2>&1 | tee out/oracle-drop/hold-terminal.log
   cp out/runs/oracle-hold/run-manifest.json out/oracle-drop/hold-manifest.json
   ```
3. Run Run 2 on genuine `C_fix` commit (`FIX_COMMIT`, persistence fixed) with `--with-video`:
   ```bash
   RUN_ID=oracle-release node bin/autocast.js --oracle "${SPEC_PATH}" \
     --commit "${FIX_COMMIT}" --expect-spec-sha256 "${SPEC_SHA256}" \
     --single-run --with-video --publish stdout-json \
     > out/oracle-drop/release-verdict.json 2> out/oracle-drop/release-terminal.log
   cp out/runs/oracle-release/run-manifest.json out/oracle-drop/release-manifest.json
   cp out/runs/oracle-release/oracle-source.mp4 public/oracle-source.mp4
   ```
4. Run Run 3 offline verification:
   ```bash
   npm run verify:oracle -- out/oracle-drop/release-manifest.json \
     --spec "${SPEC_PATH}" --commit "${FIX_COMMIT}" \
     --trusted-keys .oracle-keys/trusted-keys.json \
     --allow-unisolated-beta \
     | tee out/oracle-drop/verify-oracle.log
   ```

### Step C — Inspect Live Video Lead-In, Finalize, Render & Audit (Stage 6)
1. Inspect `public/oracle-source.mp4` frames with `ffmpeg` (`-ss 0..10`) to find the exact first clean populated Ledgerly UI frame (`TRIM_FRAMES`) and keep `--source-playback-rate 1`.
2. Finalize strictly from **Steps B.2–B.4 live outputs** (zero `examples/oracle/fixtures/*`, zero manual `--api-state-line`):
   ```bash
   npx tsx scripts/finalize-oracle-drop.ts \
     --spec "${SPEC_PATH}" \
     --hold-manifest out/oracle-drop/hold-manifest.json \
     --release-manifest out/oracle-drop/release-manifest.json \
     --hold-log out/oracle-drop/hold-terminal.log \
     --verify-log out/oracle-drop/verify-oracle.log \
     --source-video public/oracle-source.mp4 \
     --source-trim-before "${TRIM_FRAMES}" \
     --source-playback-rate 1 \
     --trusted-keys .oracle-keys/trusted-keys.json \
     --out out/oracle-drop/oracle-drop-props.json
   ```
3. Render `out/oracle-feature-drop.mp4`, spot-check frames across all 8 beats with `ffmpeg`, verify `ffprobe`, and run `scanVideoPixelsForSecrets('out/oracle-feature-drop.mp4')`.

---

## 4. Outstanding Implementation & Audit-Fix Checklist (Stage 4)

- [ ] **1. Honest Beta Verification Headline ([`verify-oracle.ts`](file:///mnt/extra-maal/autocast/scripts/verify-oracle.ts)):**
  - When `isolation !== 'container'` under `--allow-unisolated-beta`, print:
    - `⚠️ RELEASE MANIFEST VERIFIED — BETA ISOLATION LIMITATION`
    - `❌ Gate 10: NOT CLEARED — NOT AUTHORIZED FOR REAL FUNDS`
  - Reserve `🎉 ORACLE PAYMENT VERDICT: RELEASE CONFIRMED` strictly for `isolation === 'container'`.
- [ ] **2. Honest End Card Wording ([`OracleEndCard.tsx`](file:///mnt/extra-maal/autocast/remotion/components/OracleEndCard.tsx)):**
  - Change `"Ed25519-signed for payout"` → `"Ed25519-signed acceptance proof · inspect offline"`.
- [ ] **3. Remove Manual `--api-state-line` & Derive From Verified Manifest + Spec ([`finalize-oracle-drop.ts`](file:///mnt/extra-maal/autocast/scripts/finalize-oracle-drop.ts)):**
  - Delete `--api-state-line` CLI flag. Automatically derive `apiStateLine` from `loaded.spec.outcome_specs` (`type === 'api_state'`) **only when** verified `release.application.state_verified === true` and `release.oracle.spec_sha256 === loaded.specSha256`.
- [ ] **4. Fail-Closed Log Loading, High-Signal Curated Lines & Trim Flags ([`finalize-oracle-drop.ts`](file:///mnt/extra-maal/autocast/scripts/finalize-oracle-drop.ts)):**
  - Throw immediately if `--hold-log` or `--verify-log` is supplied and missing on disk (no silent placeholder fallback).
  - Strip decorative `===` rules and select curated key lines (commit pin + `🚨 [Oracle HOLD]` for Beat 2; `Manifest`, `Spec`, `Commit`, Gates `1–10`, `Gate 10: NOT CLEARED`, and `RELEASE MANIFEST VERIFIED` banner for Beat 4a).
  - Wire `--source-trim-before` and `--source-playback-rate` CLI flags cleanly into props.
- [ ] **5. Clean Terminal Wrapping ([`TerminalCard.tsx`](file:///mnt/extra-maal/autocast/remotion/components/TerminalCard.tsx)):**
  - Replace `wordBreak: 'break-all'` with `wordBreak: 'normal'` + `overflowWrap: 'anywhere'`, `fontSize: 15`, `gap: 5`.
- [ ] **6. Complete 8-Beat Wiring (`remotion/oracle/format.ts`, `remotion/OracleDrop.tsx`, `scripts/finalize-oracle-drop.ts`):**
  1. `ORACLE_BEAT_FRAMES = [300, 300, 300, 540, 540, 135, 420, 180] as const`
  2. `calculateOracleDropMetadata` & `OracleDrop` (`beatFrames?.length === 8`)
  3. `OracleDropProps.audio` includes `beat0a` & `beat0b`
  4. `beatFramesFor()` probes `oracle-beat-0a` & `oracle-beat-0b`
  5. Render `ExplainEscrowBeat` (Beat 0a) & `ExplainWorkflowBeat` (Beat 0b) before `PolicyBeat` (Beat 1) and use `<TransitionSeries>` (`@remotion/transitions`) cleanly across beats to eliminate any dead dark gaps.
- [ ] **7. Capture Replay Seal Fix & Per-Run Video Save ([`src/capture/replay.ts`](file:///mnt/extra-maal/autocast/src/capture/replay.ts) + [`src/oracle/runner.ts`](file:///mnt/extra-maal/autocast/src/oracle/runner.ts)):**
  - Verify `default-outcome-seal` (`[data-testid="approved-seal"]`) while the drawer is still open in Scene 5 (before Scene 6 closes it), and save per-run optional video artifacts cleanly inside `runDir` (`out/runs/${runId}/demo.mp4` + `out/runs/${runId}/oracle-source.mp4`).
- [ ] **8. Update Unit Tests (`tests/oracle-publish-reverify.test.ts`):**
  - Assert fail-closed missing `--verify-log`/`--hold-log`, curated signal-line filtering, derived `apiStateLine` (from `state_verified === true`), 8-beat `beatFrames`, and `--allow-unisolated-beta` terminal output.
