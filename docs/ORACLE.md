# Autocast Oracle Mode

Autocast Oracle Mode turns a sealed `run-manifest.json` into a verifiable, fail-closed acceptance proof for software milestones (freelance escrow, bounties, and contract deliveries). Unlike Demo Mode, Oracle Mode **never** edits source code, never rewrites objectives with Gemini, and never blocks payment on video rendering or Visual QA.

---

## Core Guarantees & Design Principles

1. **Fail closed on acceptance defects.** Any objective failure (`kane_failed`, `commit_mismatch`, `state_mismatch`) seals a signed `hold` verdict and exits `1`. Timeouts and cancellations seal `inconclusive` (exit `4`) rather than falsely assigning contractual fault. No repair worktree, no `agy`, and no auto-patch re-shoot execute (`closed_loop_repair.occurred: false`).
2. **Frozen Day-1 spec input.** Both parties agree on an `AcceptanceSpec` JSON file before work starts (locking `spec_sha256` alongside required `contract_id` and `milestone_id`, plus optional `escrow_address`). Its `objective` is passed to Kane verbatim with `--bug-detection off` so payment gates only on the agreed criteria rather than unrelated heuristics.
3. **Scrubbed runner & pinned checkout.** The runner requires `--commit <40-char-sha>` and `--expect-spec-sha256 <64-hex>` at verification time, validates `target.url` against `ORACLE_ALLOWED_HOSTS` (defaulting strictly to the runner-started `http://localhost:8080` origin), isolates the commit via `git archive`, installs pinned dependencies from lockfile (no root `node_modules` symlinks), scrubs `ORACLE_SIGNING_KEY` / `ORACLE_WEBHOOK_SECRET` / API keys from build, app, and browser runner environments, enforces `strictPort`, and stamps `application.environment: "runner_pinned"`.
4. **Full `outcome_specs` enforcement.** After Kane passes, the runner verifies all `api_state` endpoints directly AND deterministically replays `actions.ndjson` in headless Playwright when UI assertions (`dom_text`, `visible`, `url`) are declared, sealing `hold` (`state_mismatch`) if any declared assertion fails or lacks trace proof.
5. **Payment gates separated from cinematic gates.** `verifyOracleManifest` enforces 9 payment gates—including `runner_pinned`/`deployment_attested` and Ed25519 signature validity—without requiring `visual_qa`, `security_scan`, or `artifacts.video`.

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
| `1` | Verdict `hold` sealed (`kane_failed`, `state_mismatch`, or `commit_mismatch`) |
| `2` | Config/spec error (invalid spec, missing/mismatched `--expect-spec-sha256`, invalid `--commit`, disallowed URL, missing `ORACLE_SIGNING_KEY`, dirty tree, or Kane exit `2`) |
| `4` | Verdict `inconclusive` sealed (Kane timeout/cancellation or `--reshoot` divergence; never treated as contractual `hold`) |

`--agent-repair` is ignored with a warning in oracle mode (`closed_loop_repair.occurred` is always sealed as `false`).

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
9. `manifest.application.environment === 'runner_pinned'` or `'deployment_attested'` (`'external_unverified'` is rejected)

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

---

## Threat Model

| Attack / Dispute | How Party Attempts to Cheat | Gate / Control That Stops It |
|---|---|---|
| Malicious deliverable code | Build (`npm ci`/`build`) or app server steals signing key or tampers with runner output | `scrubChildEnv` / `stripOracleSecrets` strips `ORACLE_SIGNING_KEY`, `ORACLE_WEBHOOK_SECRET`, and API keys from build, app, and Kane processes (`v0.3`: container sandbox + isolated signer service) |
| Mocked / UI-only fix | UI displays `Approved` badge while backend storage stays `Pending` | `verifyUnderlyingState()` checks `api_state` endpoints + deterministic Playwright `outcome_specs` replay (`hold_reason: state_mismatch`) |
| Spec special-casing | Contractor hardcodes the public spec's invoice ID and endpoint response | `v0.3`: Day-1 hash-committed holdout seed/invoice ID revealed at verification + runner-controlled DB attestation |
| Judge manipulation / prompt injection | Attacker page text claims `"verification passed"` to steer Kane's verdict | Deterministic Playwright `outcome_specs` + backend state checks gate release (`--bug-detection off` prevents non-spec heuristic stops) |
| Unpinned deployment | External host in `ORACLE_ALLOWED_HOSTS` spoofs `/api/health` commit | `preparePinnedAppCheckout` (`git archive` + `npm ci` + `strictPort`) is the commit trust anchor; Gate 9 rejects `external_unverified` |
| False failure claim by client | Client disputes screenshot or claims agreed flow failed | Signed `release` manifest binds `spec_sha256`, `tested_commit`, Kane `100`, and `state_verified: true`; anyone can run `verify:oracle` or `reverify:oracle --reshoot` |
| Party-supplied localhost | Contractor points `target.url` at a local mock server on another port | `validateOracleTargetUrl` rejects URLs not matching runner-started origin or `ORACLE_ALLOWED_HOSTS` (exit `2`); `strictPort` rejects occupied ports |
| Spec bait-and-switch | One party weakens assertions or edits spec after signing | Canonical `spec_sha256` checked against required `--expect-spec-sha256` and verified in Gate 7 |
| Cross-contract replay | Reusing a signed `release` manifest from one contract on another | Required `contract_id` + `milestone_id` (and optional `escrow_address`) inside `AcceptanceSpec` bind `spec_sha256` per engagement |
| Post-run manifest tampering | Editing `verdict`, `tested_commit`, or `result_code` in `run-manifest.json` | Ed25519 signature over canonical JSON fails Gate 8 |
| Silent agent auto-repair | Passing `--agent-repair` to patch broken deliverable at payout time | CLI forces repair off, never calls `agy`, and Gate 5 requires `closed_loop_repair.occurred === false` |

---

## Tier B: `v0.3` Production Hardening Roadmap (Out of Scope for Current Release)

The current release runs as a single-node runner with in-process key signing, local app verification, and an EVM interface stub. Before handling live financial escrow at scale, `v0.3` addresses:

1. **Container Sandbox & Separate Signer Service:** Execute deliverable build, app server, DB fixture, and Playwright/Kane inside an egress-restricted container with resource limits, forwarding structured attestations to an isolated signing daemon holding `ORACLE_SIGNING_KEY`.
2. **Independent Runner DB & Holdout Challenges:** Verify persistence directly against a runner-owned read-only DB connection and a Day-1 hash-committed holdout seed/invoice ID revealed only at verification time.
3. **Multi-Runner Quorum (`k`-of-`n`):** Define a 2-of-3 independent runner quorum policy with distinct runner identities and keys, plus formal appeal windows.
4. **On-Chain EVM Settlement & Replay Registry:** Bind EIP-712 / relayer authorizations to `chain_id + escrow_address + contract_id + milestone_id + manifest_sha256 + expiry + nonce` (since EVM lacks native Ed25519 verification), with the escrow contract recording consumed `manifest_sha256` / `nonce` entries.

## Explicit Non-Goals (Current Release)

- **Scope disputes:** If the signed `AcceptanceSpec` omits edge cases, that is a spec-authoring issue, not an oracle failure.
- **Authorship proof:** The oracle proves commit `X` passes spec `Y` under deterministic seed `Z`; it does not prove who wrote the code.
- **Production deployment parity:** The oracle certifies the pinned commit in the runner environment (`runner_pinned`), not whether a separate production server matches it.
