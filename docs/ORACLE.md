# Autocast Oracle Mode

Autocast Oracle Mode turns a sealed `run-manifest.json` into a verifiable, fail-closed acceptance proof for paid software milestones (freelance escrow, bounties, and contract milestones). Unlike demo mode, oracle mode **never** edits source code, never rewrites objectives with Gemini, and never blocks payment on video rendering or Visual QA.

---

## Core Guarantees & Design Principles

1. **Fail closed.** Any Kane failure—including a confirmed `740` defect—seals a signed `hold` verdict and exits non-zero. No repair worktree, no `agy`, and no re-shoot are executed.
2. **Frozen spec input.** Both parties agree on an `AcceptanceSpec` JSON file before work starts. Its `objective` is passed to Kane verbatim without LLM rewriting.
3. **Pinned neutral environment.** The runner validates `target.url` against an allowlist (`ORACLE_ALLOWED_HOSTS`, defaulting strictly to the runner-started `http://localhost:8080` origin), checks out `target.expected_commit`, resets deterministic seed data for `target.seed_id`, and verifies `/api/health` reports the expected commit (`tested_commit`).
4. **Backend truth over DOM.** After Kane passes (`100`), the runner queries `api_state` endpoints directly via `verifyUnderlyingState()` so a UI that fakes success without mutating backend state still seals `hold` (`state_mismatch`).
5. **Payment gates separated from cinematic gates.** `verifyOracleManifest` enforces correctness, commit pinning, backend state, repair non-occurrence, and Ed25519 signature validity—without requiring `visual_qa`, `security_scan`, or `artifacts.video`.

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
    "expected_commit": "<40-char-sha>",
    "seed_id": "ledgerly-default-v1"
  },
  "parties": {
    "client": "client@example.com",
    "contractor": "contractor@example.com"
  },
  "milestone_id": "milestone-1"
}
```

- Unknown keys at any level are rejected by strict Zod schema validation (`AcceptanceSpecSchema`).
- `spec_sha256` is the SHA-256 hex digest over the **canonical JSON** representation (recursively sorted keys, zero whitespace, `undefined` properties omitted).
- Pass `--expect-spec-sha256 <hash>` to bind the run to an escrow contract's pre-recorded spec digest; any mismatch fails with exit code `2` before starting the app.

---

## CLI Usage & Exit Code Contract

```bash
# Run oracle verification (or: autocast oracle examples/oracle/ledgerly-approval.json)
autocast --oracle examples/oracle/ledgerly-approval.json \
  [--expect-spec-sha256 <64-hex>] \
  [--with-video] \
  [--publish stdout-json|webhook|evm]
```

| Exit Code | Meaning |
|---|---|
| `0` | Verdict `release` sealed and signed |
| `1` | Verdict `hold` sealed (`kane_failed`, `state_mismatch`, or `commit_mismatch`) |
| `2` | Config/spec error (invalid spec, `--expect-spec-sha256` mismatch, disallowed URL, missing `ORACLE_SIGNING_KEY`, dirty tree, or Kane exit `2`) |
| `3` | Timeout or cancellation (Kane exit `3`, sealed as `hold` with `hold_reason: "timeout"`) |

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

All eight gates must pass:

1. `manifest.mode === 'oracle'`
2. `manifest.status === 'verified'` and `manifest.oracle.verdict === 'release'` (no `hold_reason`)
3. `manifest.kane_verification.result_code === 100`
4. `manifest.application.state_verified === true`
5. `manifest.closed_loop_repair.occurred === false`
6. `manifest.application.tested_commit === expectedCommit` and `manifest.oracle.expected_commit === expectedCommit`
7. `manifest.oracle.spec_sha256 === expectedSpecSha256`
8. Valid Ed25519 signature over canonical manifest JSON (excluding `signature`) verified against `ORACLE_TRUSTED_KEYS` (where `key_id` equals the SHA-256 hex digest of the SPKI DER public key)

If optional `artifacts.video` or `artifacts.poster` entries exist (e.g. from `--with-video`), their SHA-256 digests are also checked, but they are never required for payment release.

---

## Signing, Key Pinning & Publishing

- `ORACLE_SIGNING_KEY`: Ed25519 PKCS#8 private key PEM string or path (never log or commit).
- `ORACLE_TRUSTED_KEYS`: JSON map (`{ "<key_id>": "<spki-pem>" }`), `{ "keys": ... }`, JSON array, or PEM bundle of trusted runner public keys.
- `ORACLE_RUNNER_ID`: Runner identifier stamped into `oracle.runner_id`.
- `ORACLE_ALLOWED_HOSTS`: Optional comma-separated target host/origin allowlist.
- **Third-party re-verification**:
  - Offline: `npm run reverify:oracle -- --spec <spec.json> --commit <sha> --manifest <run-manifest.json>`
  - Online reshoot: add `--reshoot` to re-run on a clean runner; any verdict divergence is reported as `inconclusive` (exit `4`), never `hold`.
- **Publisher adapters** (`--publish`): `stdout-json` (emits `VerdictPayload` JSON with `manifest_sha256`), `webhook` (`POST` to `ORACLE_WEBHOOK_URL` signed with `X-Autocast-Signature: sha256=<hmac>` using `ORACLE_WEBHOOK_SECRET`), and `evm` (interface stub with zero chain dependencies). Publish failures never alter the sealed verdict.

---

## Threat Model

| Attack / Dispute | How Party Attempts to Cheat | Gate That Stops It |
|---|---|---|
| Mocked / UI-only fix | UI displays `Approved` badge while backend storage stays `Pending` | `verifyUnderlyingState()` checks `api_state` endpoints directly (`hold_reason: state_mismatch`) |
| False failure claim by client | Client disputes screenshot or claims agreed flow failed | Signed `release` manifest binds `spec_sha256`, `tested_commit`, Kane `100`, and `state_verified: true`; anyone can run `verify:oracle` or `reverify:oracle --reshoot` |
| Party-supplied localhost | Contractor points `target.url` at a local mock server on another port | `validateOracleTargetUrl` rejects URLs not matching runner-started origin or `ORACLE_ALLOWED_HOSTS` (exit `2`); `strictPort` rejects occupied ports |
| Wrong commit served | Runner or server runs stale/unpinned code | `/api/health` commit is recorded as `tested_commit`; mismatch seals `hold` (`commit_mismatch`) |
| Spec bait-and-switch | One party weakens assertions or edits spec after signing | Canonical `spec_sha256` checked against `--expect-spec-sha256` and verified in `verifyOracleManifest` |
| Post-run manifest tampering | Editing `verdict`, `tested_commit`, or `result_code` in `run-manifest.json` | Ed25519 signature over canonical JSON fails `verifyOracleManifest` |
| Silent agent auto-repair | Passing `--agent-repair` to patch broken deliverable at payout time | CLI forces `enableAgentRepair = false`, never calls `agy`, and `verifyOracleManifest` requires `closed_loop_repair.occurred === false` |

## Explicit Non-Goals

- **Scope disputes:** If the signed `AcceptanceSpec` only covers the happy path, missing edge-case coverage is a spec-authoring issue, not an oracle failure.
- **Authorship proof:** The oracle proves commit `X` passes spec `Y` under deterministic seed `Z`; it does not prove who wrote the code.
- **Production parity:** The oracle certifies the tested commit and environment, not whether a separate production deployment matches that commit.
