---
name: autocast
description: The Autonomous Demo Director. Generates cinematic, verified product demo videos with closed-loop AI bug repair and proof of correctness. Demos that can't lie.
---

# Autocast AI: The Autonomous Demo Director

Autocast AI is an autonomous, evidence-driven product demo generator that operates across three independent verification loops:
1. **Loop 1: Product Correctness Engine**: Kane CLI shoots and verifies the user flow. If a product bug is confirmed (`result_code: 740`), Antigravity AI (`agy`) autonomously fixes the source code in an isolated git worktree, runs regression tests, restarts the server, and re-verifies.
2. **Loop 2: Cinematic Quality Engine**: Action IR compiles raw actions, captures high-res 1080p replay with cubic-bezier cursor motion, verifies Machine OutcomeSpecs, and subjects rendered preview frames to Kane Visual QA in real Chrome via the local gallery (port 8081).
3. **Loop 3: Release Safety Engine**: Dense video frame OCR scans for secrets, credentials, and API keys with a fail-closed quarantine gate, followed by sealing a tamper-evident `run-manifest.json` with computed SHA-256 digests.

## CLI Usage

```bash
# Generate a verified product demo video
autocast "Approve invoice INV-1042"

# With explicit agent repair enabled
autocast "Approve invoice INV-1042" --agent-repair

# Target a custom application URL
TARGET_APP_URL="http://localhost:8080/?logged_in=true" autocast "Approve invoice INV-1042"
```

## Key Artifacts
- `out/demo.mp4`: Verified 1080p 30fps demo video baked with Frame 0 poster.
- `out/poster.jpg`: Crisp hero frame.
- `out/share-copy.txt`: Multi-channel social copy for X/Twitter and LinkedIn.
- `out/run-manifest.json`: Tamper-evident cryptographic provenance manifest.
- `docs/catches/`: Archival evidence packs of autonomous catches and repairs.

