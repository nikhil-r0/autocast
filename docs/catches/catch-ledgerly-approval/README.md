# Kane CLI Assurance Evidence: Ledgerly Invoice Approval Defect & Autonomous Repair

This directory contains the machine-verifiable evidence artifacts for AutoCast's closed-loop repair of Ledgerly.

### 🌐 Kane Browser Verification (Hosted ShareLinks)
- **Initial Failure (Kane 740)**: [Watch Kane's original execution & failure trace](https://test-manager.lambdatest.com/projects/01M7G731FR81J5BGBWP3Y53FHF/test-cases/01M7QBRZR4FRVMB943TNRAG5PV/dashboard/share/US_DI4N4K9JKH8XJIJV21PI9C1O8S14VK91Q077F66Q6H6O7CBY8G3Q2Z1GZ0IR6PFJ?type=summary&agentView=true&fqdn=summary-page)
- **Independent Verification (Kane 100)**: [Watch Kane's passing browser execution](https://test-manager.lambdatest.com/projects/01M7G731FR81J5BGBWP3Y53FHF/test-cases/01M7QC3EMRSVJKXF11RPKAZRVG/dashboard/share/US_LEHGINX5N6K8F08SZWYR5A5CNWSKGJSE4G6G4TU5OWLL2SV3WWU6PZD17ZUJLE30?type=summary&agentView=true&fqdn=summary-page)

### 🎬 Product Demonstration & Evidence
- **Edited Product Demo**: [`out/demo.mp4`](https://raw.githubusercontent.com/nikhil-r0/autocast/main/examples/output/sample-demo.mp4) (1080p @ 30 FPS)
- **Hash-Verified Run Manifest**: [`run-manifest.json`](./run-manifest.json) (Sealed SHA-256)

---

## 1. Failure Evidence (Kane Run 1)
- **Result Code**: `740 · Confirmed product bug`
- **Hosted Execution Trace**: [Inspect Kane Failure Run](https://test-manager.lambdatest.com/projects/01M7G731FR81J5BGBWP3Y53FHF/test-cases/01M7QBRZR4FRVMB943TNRAG5PV/dashboard/share/US_DI4N4K9JKH8XJIJV21PI9C1O8S14VK91Q077F66Q6H6O7CBY8G3Q2Z1GZ0IR6PFJ?type=summary&agentView=true&fqdn=summary-page)
- **Defect Trigger**: `APP_BUG=approve-noop` on `examples/ledgerly/server/index.js`
- **Failing Step**: wait: PRIMARY: wait for the drawer status badge to show Approved
- **Failure Summary**: [`failure-summary.json`](./failure-summary.json)
- **Visual Evidence**: ![Failure Screenshot](./failing-screenshot.jpg)

## 2. Autonomous Repair by Antigravity AI
- **Isolated Worktree**: `.worktrees/repair-*`
- **Target File**: `examples/ledgerly/server/index.js`
- **Guardrails**: `tests/**` enforced read-only. 41/41 unit regression tests passed (`npm test`).
- **Test Report**: [`test-report.txt`](./test-report.txt)
- **Git Patch**: [`patch.diff`](./patch.diff)

## 3. Independent Verification (Kane Run 2)
- **Result Code**: `100 · Passed` (2/2 steps verified)
- **Hosted Execution Trace**: [Inspect Kane Verification Run](https://test-manager.lambdatest.com/projects/01M7G731FR81J5BGBWP3Y53FHF/test-cases/01M7QC3EMRSVJKXF11RPKAZRVG/dashboard/share/US_LEHGINX5N6K8F08SZWYR5A5CNWSKGJSE4G6G4TU5OWLL2SV3WWU6PZD17ZUJLE30?type=summary&agentView=true&fqdn=summary-page)
- **Underlying Database State**: `invoice.status === 'Approved'` verified independently via backend API.
- **Success Summary**: [`success-summary.json`](./success-summary.json)
- **Visual Evidence**: ![Passing Screenshot](./passing-screenshot.jpg)

## 4. Hash-Verified Provenance Manifest
- **Manifest File**: [`run-manifest.json`](./run-manifest.json)
- **Run ID**: `autocast-run-1795006674594`
- **Verified Commit**: `adc6a772bfbedc1c0b6a37a1efa836a21c86a7ff`
- **Verification ID**: `/home/home/.testmuai/kaneai/sessions/3117b3b1-46db-44ea-b6a0-732dfa24b749`
- **Hosted Evidence URL**: [Kane ShareLink](https://test-manager.lambdatest.com/projects/01M7G731FR81J5BGBWP3Y53FHF/test-cases/01M7QC3EMRSVJKXF11RPKAZRVG/dashboard/share/US_LEHGINX5N6K8F08SZWYR5A5CNWSKGJSE4G6G4TU5OWLL2SV3WWU6PZD17ZUJLE30?type=summary&agentView=true&fqdn=summary-page)
