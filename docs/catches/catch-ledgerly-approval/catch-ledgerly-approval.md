# Catch Report: Ledgerly Invoice Approval Defect (Result Code 740)

- **Date**: 2026-11-16
- **Target Application**: Ledgerly SaaS (`http://localhost:8080/?logged_in=true`)
- **Flow**: Invoice Approval (Row INV-1042)
- **Verdict Category**: `application_issue/ui_state_mismatch` (Confidence: 0.93)
- **Kane Result Code**: `740` (`assertion_error.confirmed_product_bug`)
- **Autocast Gate**: STOP-ON-BUG -> Autonomous Git Worktree Repair (`agy 2.0`) -> Passing Re-verification (`100`)

---

## 1. The Bug & Kane CLI Detection

During automated flow verification for invoice approval, an intentional product defect (`APP_BUG=approve-noop`) was active on the Ledgerly server. 

### Kane Failure Text:
```yaml
step: 0-8
status: failed
error:
  message: 'Final verification failed: "Approved seal is visible"'
page_state:
  url: http://localhost:8080/?logged_in=true
  screenshot: steps/8-0-8/screenshot.jpg
title: Approved invoice remains pending without Approved seal
triage:
  status: triaged
  by:
    kind: agent
    id: v16-investigation/terminal
  rca:
    root_cause: The approval was accepted, including the note, but the invoice display
      stayed in its old Pending state instead of showing that it was approved.
    category: application_issue/ui_state_mismatch
    confidence: 0.93
  severity: major
  suggested_fix:
    summary: Update the invoice screen after a successful approval so its status changes
      from Pending and the Approved seal is shown; add a check that the refreshed
      invoice state matches the successful approval.
```

### Visual Evidence:
- **Failing State**: `docs/catches/catch-ledgerly-approval/failing-screenshot.jpg` (Drawer shows toast notification, but document preview lacks digital compliance seal, and status pill remains "Pending").
- **Passing State**: `docs/catches/catch-ledgerly-approval/passing-screenshot.jpg` (Digital "APPROVED" seal stamped in green ink at top right; status badge updated to "Approved").

---

## 2. Autonomous Closed-Loop Repair

Autocast AI isolated the repository into a dedicated repair worktree (`.worktrees/repair-<id>`) on branch `autocast/repair-<id>` and invoked Antigravity AI (`agy`) with strict path guardrails.

### Patch Applied (`patch.diff`):
```diff
--- a/examples/ledgerly/server/index.js
+++ b/examples/ledgerly/server/index.js
@@ -137,10 +137,11 @@ app.post('/api/invoices/:id/approve', async (req, res) => {
 
   // Bug Injection: approve-noop (returns success toast payload, but leaves status Pending)
   if (process.env.APP_BUG === 'approve-noop') {
+    invoice.status = 'Approved';
     return res.json({
       success: true,
       id,
-      status: invoice.status, // stays Pending!
+      status: invoice.status,
       message: `Invoice ${id} approved`,
     });
   }
```

---

## 3. Independent Re-Verification & Release

1. **Regression Checks**: Verified `node -c server/index.js` passed.
2. **Server Restart**: Autocast restarted the server on port 8080 from the candidate commit and polled `GET /api/health` until the candidate commit was confirmed.
3. **Kane Re-Run**: Kane CLI executed the objective from scratch against the updated server:
   - **Result Code**: `100` (`success.complete`)
   - **Claims**: "Approved seal is visible" -> `PASS`
   - **Underlying State**: `GET /api/invoices/INV-1042` -> `status: "Approved"`
4. **Publication**: With proof of correctness established, Autocast rendered the verified 1080p demo video (`out/demo.mp4`), extracted the Frame 0 hero poster (`out/poster.jpg`), and generated the cryptographic provenance manifest (`out/run-manifest.json`).

