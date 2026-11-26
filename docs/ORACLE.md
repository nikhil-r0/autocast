# Autocast Oracle Mode

> **Status — Beta: Trusted Code Only, No Real Funds.**  
> Until Tier B container isolation and the separate signing service ship, contractor code (`npm ci --ignore-scripts`, `npm run build`, and server execution) runs under your host OS user account. Environment scrubbing prevents secret env inheritance, **not** host filesystem reads (such as `.oracle-keys/runner-private.pem`, `~/.ssh`, `.env`, or Kane credentials) or outbound network egress. **Do not** execute untrusted deliverables or settle real funds with the single-node runner.

Autocast Oracle Mode turns a sealed `run-manifest.json` into a verifiable, fail-closed acceptance proof for software milestones. Unlike Demo Mode, Oracle Mode **never** edits source code, never rewrites objectives with Gemini, and never blocks payment verification on video rendering or Visual QA.

---

## Core Guarantees & Design Principles

1. **Fail closed on contractor defects; isolate runner faults.** Objective, backend/UI state, commit, and deterministic build failures seal a signed `hold` verdict and exit `1` (`kane_failed`, `state_mismatch`, `commit_mismatch`, `build_failed`). Timeouts, missing `actions.ndjson` traces, and runner/network outages seal `inconclusive` (`timeout`, `missing_trace`, `runner_error`) and exit `4` rather than assigning false contractual fault. No repair worktree, no `agy`, and no auto-patch re-shoot execute (`closed_loop_repair.occurred: false`).
2. **Frozen Day-1 spec input.** Both parties agree on an `AcceptanceSpec` JSON file before work starts (locking `spec_sha256` alongside required `contract_id` and `milestone_id`, plus optional `escrow_address`). Its `objective` is passed to Kane verbatim with `--bug-detection off` so payment gates only on agreed criteria rather than unrelated heuristics.
3. **Scrubbed runner & pinned checkout.** The runner requires `--commit <40-char-sha>` and `--expect-spec-sha256 <64-hex>` at verification time, validates `target.url` against `ORACLE_ALLOWED_HOSTS` (defaulting strictly to the runner-started `http://localhost:8080` origin), extracts the commit via `git archive`, installs dependencies with `npm ci --ignore-scripts --no-audit --no-fund` (no root `node_modules` symlinks and no npm lifecycle scripts), scrubs `ORACLE_SIGNING_KEY` / `ORACLE_WEBHOOK_SECRET` / API keys from build, app, and browser runner environments, enforces `strictPort`, and stamps `application.environment: "runner_pinned"`.
4. **Full `outcome_specs` enforcement.** After Kane passes, the runner verifies all `api_state` endpoints directly AND deterministically replays `actions.ndjson` in headless Playwright when UI assertions (`dom_text`, `visible`, `url`) are declared. Any UI/API mismatch seals `hold` (`state_mismatch`); a missing `actions.ndjson` trace seals `inconclusive` (`missing_trace`, exit `4`).
5. **Payment gates separated from cinematic gates.** `verifyOracleManifest` enforces 9 payment gates—including strict `application.environment === 'runner_pinned'` and Ed25519 signature validity—without requiring `visual_qa`, `security_scan`, or `artifacts.video`.

---

## AcceptanceSpec Schema & Canonical Hash

```json
{
  "version": 1,
  "title": "Ledgerly INV-1042 Invoice Approval",
  "objective": "Click the Review button for row INV-1042, click Approve Invoice in the drawer, enter approval note, click Confirm Approval, then verify drawer status badge shows Approved",
  "outcome_specs": [
    {
      "id": "drawer-status-approved",
      "verification": {
        "type": "dom_text",
        "selector": "[data-testid=\"drawer-status-badge\"]",
        "expected": "Approved"
      }
    },
    {
      "id": "approved-seal-visible",
      "verification": {
        "type": "visible",
        "selector": "[data-testid=\"approved-seal\"]"
      }
    },
    {
      "id": "invoice-api-approved",
      "verification": {
        "type": "api_state",
        "endpoint": "/api/invoices/INV-1042",
        "jsonPath": "status",
        "expected": "Approved"
      }
    }
  ],
  "target": {
    "url": "http://localhost:8080/?logged_in=true",
    "seed_id": "ledgerly-default-v1"
  },
  "parties": {
    "client": "party:client-01",
    "contractor": "party:contractor-01"
  },
  "contract_id": "escrow-contract-2026-001",
  "escrow_address": "0x0000000000000000000000000000000000000000",
  "milestone_id": "milestone-1"
}
```

- Unknown keys at any level are rejected by strict Zod schema validation (`AcceptanceSpecSchema`).
- Because `expected_commit` is omitted from `AcceptanceSpec`, parties freeze `spec_sha256` on Day 1 before contractor code exists; the submitted `--commit <40-char-sha>` is passed at verification time and bound to `spec_sha256` inside the signed `run-manifest.json`.
- `contract_id` and `milestone_id` are required (with optional `escrow_address`) to prevent cross-contract replay across engagements sharing a template spec. Use opaque pseudonymous identifiers in `parties` rather than raw PII emails, and use genuine auth flows rather than `?logged_in=true` outside controlled local test fixtures.
- `spec_sha256` is the SHA-256 hex digest over canonical JSON (recursively sorted keys, zero whitespace, `undefined` omitted). `--expect-spec-sha256 <hash>` is required in CLI oracle mode and checked before starting the app.

---

## CLI Usage & Exit Code Contract

```bash
# Run oracle verification (or: autocast oracle <spec.json> --commit <40-char-sha> --expect-spec-sha256 <64-hex>)
autocast --oracle examples/oracle/ledgerly-approval.json \
  --commit <40-char-sha> \
  --expect-spec-sha256 <64-hex> \
  [--with-video] \
  [--publish stdout-json|webhook|evm]
```

| Exit Code | Meaning |
|---|---|
| `0` | Verdict `release` sealed and signed |
| `1` | Verdict `hold` sealed (`kane_failed`, `state_mismatch`, `commit_mismatch`, or deterministic `build_failed`) |
| `2` | Config/spec error (invalid spec, missing/mismatched `--expect-spec-sha256`, invalid `--commit`, disallowed URL, missing `ORACLE_SIGNING_KEY`, dirty tree, or Kane exit `2`) |
| `4` | Verdict `inconclusive` sealed (`timeout`, `missing_trace`, transient `runner_error`, or `--reshoot` divergence; never auto-penalizes as `hold`) |

`--agent-repair` is ignored with a warning in oracle mode (`closed_loop_repair.occurred` is always sealed as `false`).

### `inconclusive` Retry & Arbitration Policy

- **Retry limit:** An escrow coordinator may automatically retry up to **2 times** (maximum **3 total runs** on clean runner environments) when `verdict === 'inconclusive'`.
- **Escalation to arbitration:** If all 3 runs remain `inconclusive` (`timeout`, `missing_trace`, or `runner_error`), automated settlement halts and escalates to human/quorum arbitration rather than auto-releasing funds or auto-slashing the contractor.
- **Contractor-caused timeouts:** If timeouts reproduce across runs alongside reproducible app-server stalls or SLA latency breaches (captured in `kane-stderr.log` / server timing diagnostics) rather than browser-runner outages, arbitration converts the repeated `inconclusive` stall into `hold`. Conversely, verified runner/registry outages route to another runner node.

---

## Payment Gates (`verifyOracleManifest`)

Run offline verification via:

```bash
npm run verify:oracle -- out/run-manifest.json \
  --spec examples/oracle/ledgerly-approval.json \
  --commit <expected-commit-sha> \
  [--trusted-keys path/to/trusted-keys.json]
```

All nine gates must pass:

1. `manifest.mode === 'oracle'`
2. `manifest.status === 'verified'` and `manifest.oracle.verdict === 'release'` (no `hold_reason`)
3. `manifest.kane_verification.result_code === 100`
4. `manifest.application.state_verified === true`
5. `manifest.closed_loop_repair.occurred === false`
6. `manifest.application.tested_commit === expectedCommit` and `manifest.oracle.expected_commit === expectedCommit`
7. `manifest.oracle.spec_sha256 === expectedSpecSha256`
8. Valid Ed25519 signature over canonical manifest JSON (excluding `signature`) verified against `ORACLE_TRUSTED_KEYS` (`key_id` equals the SHA-256 hex digest of the SPKI DER public key)
9. `manifest.application.environment === 'runner_pinned'` (`'external_unverified'` and unattested values are strictly rejected)

If optional `artifacts.video` or `artifacts.poster` entries exist (e.g. from `--with-video`), their SHA-256 digests are also checked, but they are never required for payment release.

---

## Signing, Key Pinning & Publishing

- `ORACLE_SIGNING_KEY`: Ed25519 PKCS#8 private key PEM string or path (scrubbed from untrusted build, app, and Kane child processes; never print or commit).
- `ORACLE_TRUSTED_KEYS`: JSON map (`{ "<key_id>": "<spki-pem>" }`), `{ "keys": ... }`, JSON array, or PEM bundle of trusted runner public keys.
- `ORACLE_RUNNER_ID`: Runner identifier stamped into `oracle.runner_id`.
- `ORACLE_ALLOWED_HOSTS`: Optional comma-separated target host/origin allowlist (stamps `external_unverified` for non-runner-managed hosts, which Gate 9 rejects for payment release).
- **Third-party re-verification**:
  - Offline: `npm run reverify:oracle -- --spec <spec.json> --commit <sha> --manifest <run-manifest.json>`
  - Online reshoot: add `--reshoot` to re-run on a clean runner; any verdict divergence is reported as `inconclusive` (exit `4`), never `hold`.
- **Publisher adapters** (`--publish`): `stdout-json` (emits `VerdictPayload` JSON with `manifest_sha256`), `webhook` (`POST` to `ORACLE_WEBHOOK_URL` with `X-Autocast-Timestamp` and `X-Autocast-Signature: sha256=<hmac>` signed over `${timestamp}.${body}` using `ORACLE_WEBHOOK_SECRET`), and `evm` (interface stub with zero chain dependencies). Publish failures never alter the sealed verdict.

### Webhook Receiver Verification (Replay Window & Constant-Time Check)

Receivers consuming `--publish webhook` **must** reject stale timestamps, verify signatures in constant time, and deduplicate by `manifest_sha256` (`verifyWebhookSignature` in [`src/oracle/publish.ts`](../src/oracle/publish.ts)):

```ts
import { verifyWebhookSignature } from './src/oracle/publish.js';

// Persist seen hashes in durable storage (Redis/DB Set in production)
const seenManifestSha256s = new Set<string>();

const check = verifyWebhookSignature({
  payloadBody: rawRequestBody,
  signatureHeader: req.headers['x-autocast-signature'],
  timestampHeader: req.headers['x-autocast-timestamp'],
  secret: process.env.ORACLE_WEBHOOK_SECRET!,
  seenManifestSha256s,
  maxSkewSeconds: 300, // 5-minute replay window
});
if (!check.valid) return res.status(401).json({ error: check.error });
```

---

## Threat Model

| Attack / Dispute | How Party Attempts to Cheat | Gate / Control That Stops It |
|---|---|---|
| Malicious deliverable code | Build (`npm ci`/`build`) or app server steals signing key, host credentials, or tampers with runner output | `npm ci --ignore-scripts` + `scrubChildEnv` / `stripOracleSecrets` strip secret env vars today (**OS-user file reads and egress remain open until Tier B container sandbox + separate signer ship**) |
| Mocked / UI-only fix | UI displays `Approved` badge while backend storage stays `Pending` | `verifyUnderlyingState()` checks `api_state` endpoints + deterministic Playwright `outcome_specs` replay (`hold_reason: state_mismatch`) |
| Spec special-casing | Contractor hardcodes the public spec's invoice ID and endpoint response | **Tier B:** Day-1 hash-committed holdout seed/invoice ID revealed at verification + runner-controlled DB attestation |
| Judge manipulation / prompt injection | Attacker page text claims `"verification passed"` to steer Kane's verdict | Deterministic Playwright `outcome_specs` + backend state checks gate release (`--bug-detection off` prevents non-spec heuristic stops) |
| Unpinned deployment | External host in `ORACLE_ALLOWED_HOSTS` spoofs `/api/health` commit | `preparePinnedAppCheckout` (`git archive` + `npm ci --ignore-scripts` + `strictPort`) is the commit trust anchor; Gate 9 rejects `external_unverified` |
| False failure claim by client | Client disputes screenshot or claims agreed flow failed | Signed `release` manifest binds `spec_sha256`, `tested_commit`, Kane `100`, and `state_verified: true`; anyone can run `verify:oracle` or `reverify:oracle --reshoot` |
| Party-supplied localhost | Contractor points `target.url` at a local mock server on another port | `validateOracleTargetUrl` rejects URLs not matching runner-started origin or `ORACLE_ALLOWED_HOSTS` (exit `2`); `strictPort` rejects occupied ports |
| Spec bait-and-switch | One party weakens assertions or edits spec after signing | Canonical `spec_sha256` checked against required `--expect-spec-sha256` and verified in Gate 7 |
| Cross-contract replay | Reusing a signed `release` manifest from one contract on another | Required `contract_id` + `milestone_id` (and optional `escrow_address`) inside `AcceptanceSpec` bind `spec_sha256` per engagement |
| Post-run manifest tampering | Editing `verdict`, `tested_commit`, or `result_code` in `run-manifest.json` | Ed25519 signature over canonical JSON fails Gate 8 |
| Silent agent auto-repair | Passing `--agent-repair` to patch broken deliverable at payout time | CLI forces repair off, never calls `agy`, and Gate 5 requires `closed_loop_repair.occurred === false` |
| Webhook replay attack | Re-sending a captured webhook delivery past window or after state change | `X-Autocast-Timestamp` signed into `${timestamp}.${body}`, validated within `300s` + constant-time `timingSafeEqual` + `manifest_sha256` deduplication |

---

## Tier B: `v0.3` Production Hardening Roadmap (Required Before Real Funds)

The current release (**Beta: trusted code only, no real funds**) runs as a single-node runner with in-process key signing, local app verification, and an EVM interface stub. Ship in strict order:

1. **Container Sandbox & Separate Signer Service:** Execute `npm ci`, build, app server, DB fixture, and Playwright/Kane inside an egress-restricted container with resource caps, forwarding sanitized verdicts to an isolated signing daemon holding `ORACLE_SIGNING_KEY`.
2. **Holdout Seed / ID Committed by Hash:** Commit a randomized holdout seed or invoice ID by hash on Day 1 and reveal it at verification time against a runner-controlled DB to defeat public-spec hardcoding.
3. **2-of-3 Runner Quorum with Dispute Window:** Require 2-of-3 independent runner signatures with distinct runner keys/identities and an explicit dispute/arbitration window.
4. **EIP-712 / secp256k1 Settlement Signature & Replay Registry:** Sign structured EIP-712 settlement payloads bound to `chain_id + escrow_address + contract_id + milestone_id + manifest_sha256 + expiry + nonce` (since EVM lacks native Ed25519 verification), backed by an on-chain consumed-nonce/manifest registry.
5. **Independent Security Review & KMS/HSM Custody:** Complete a third-party security audit and move signing keys into KMS/HSM hardware custody before handling real funds.

## Explicit Non-Goals (Current Release)

- **Scope disputes:** If the signed `AcceptanceSpec` omits edge cases, that is a spec-authoring issue, not an oracle failure.
- **Authorship proof:** The oracle proves commit `X` passes spec `Y` under deterministic seed `Z`; it does not prove who wrote the code.
- **Production deployment parity:** The oracle certifies the pinned commit in the runner environment (`runner_pinned`), not whether a separate production server matches it.
