# Ledgerly — Modern Invoice Approval SaaS

> Fictional, deterministic enterprise invoice-approval web application built as a target for autonomous recording and verification with Kane CLI.

---

## 1. Quick Start

Requirements: Node.js 18+ (tested on Node 20 & 24). No external databases, remote fonts, or network APIs required.

```bash
cd examples/ledgerly
npm install
npm start
```

The app will compile static assets (if not already built) and launch an in-memory mock API and SPA server at **`http://localhost:8080`**.

### Demo Credentials
* **Email:** `demo@ledgerly.test` (prefilled)
* **Password:** `demo1234` (prefilled)
* **Role:** Jane Doe, Finance Director
* **Demo Clock:** `2026-11-16` (deterministic, zero relative times)

---

## 2. Verification Flows & Kane CLI Objectives

Each flow has stable selectors, deterministic latency (600–1200ms), explicit `data-testid` attributes, and concluding visual checkpoints.

| # | Flow | Plain-English Kane Objective | Expected Final Assertion |
|---|---|---|---|
| **1** | **Login to Dashboard** | `"Open http://localhost:8080, click the Sign In to Dashboard button with the prefilled credentials, wait for the KPI cards to resolve, and verify Pending approvals shows 12"` | `Pending approvals shows 12` (`[data-testid="kpi-pending-value"]`) |
| **2** | **Approve Single Invoice** | `"Open http://localhost:8080/?logged_in=true, click the row for invoice INV-1042, click Approve Invoice in the drawer, enter authorization note 'Looks good, approved under Q4 infra budget', click Confirm Approval, and verify the Approved seal stamp is visible"` | `Approved seal stamp is visible` (`[data-testid="approved-seal"]` containing `APPROVED`) |
| **3** | **Filter & Bulk Batch Approval** | `"Open http://localhost:8080/?logged_in=true, filter status by Pending, select checkboxes for INV-1041, INV-1040, and INV-1039, click Bulk Approve, confirm the batch, and verify toast message says 'Successfully approved 3 invoice(s)'"` | `Toast contains 'Successfully approved 3 invoice(s)'` (`[data-testid="toast-message"]`) |
| **4** | **Export Audit Report** | `"Open http://localhost:8080/?logged_in=true, click Export CSV, choose statement period 'Nov 1 - Nov 16, 2026', click Export CSV, wait for generation, and verify download filename shows 'ledgerly-export-2026-11-16.csv' with size '142.8 KB'"` | `Filename is 'ledgerly-export-2026-11-16.csv'` (`[data-testid="export-filename"]`) |
| **5** | **Failure Recovery (ACH Retry)** | `"Open http://localhost:8080/?logged_in=true, find the payment failure banner for invoice INV-1028, click the Retry Payment button, and verify the invoice status badge turns to Approved"` | `Status badge for INV-1028 equals Approved` (`[data-testid="status-badge-INV-1028"]`) |
| **6** | **Polish & Command Palette** | `"Open http://localhost:8080/?logged_in=true, press Cmd+K or click the search bar, search for 'INV-1040', click the result to open its drawer, toggle dark mode, and verify dark theme is active"` | `Drawer opens to INV-1040 and html class contains 'dark'` |

---

## 3. Switchable Bugs (`APP_BUG`)

Test Autocast AI and Kane CLI's Stop-on-Bug verification gate by passing the `APP_BUG` environment variable when starting the server:

```bash
APP_BUG=approve-noop npm start
```

| Bug Mode | Injected Behavior | Assertion Broken |
|---|---|---|
| `approve-noop` | Approval endpoint returns success toast payload, but leaves invoice status in `Pending` state. | Breaks Flow 2: assertion `verify the badge says Approved` fails because status remains `Pending`. |
| `stale-kpi` | Approval successfully sets status to `Approved`, but the KPI counter fails to decrement from 12 to 11. | Breaks Flow 2: assertion `verify Pending approvals count decrements to 11` fails (remains 12). |
| `layout-overflow` | Sets vendor name of `INV-1042` to an unhyphenated 120-character string that overflows table cell boundaries. | Breaks Kane Visual Review (Loop 3): flags layout clipping and table column boundary overflow. |
| `slow-network` | Forces all mock API endpoints to wait 4,000ms before responding. | Breaks tight 3-second SLA assertions, testing timeout handling and loading state compliance. |

---

## 4. API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Returns server health, active `APP_BUG`, and demo clock. |
| `POST` | `/api/reset` | Restores in-memory invoices and metrics to initial seed state. |
| `GET` | `/api/invoices` | List invoices with optional `?status=...&vendor=...&search=...`. |
| `GET` | `/api/invoices/:id` | Returns single invoice details and line items. |
| `POST` | `/api/invoices/:id/approve` | Authorizes invoice with `{ note: string }`. |
| `POST` | `/api/invoices/bulk-approve` | Authorizes batch of invoices `{ ids: string[] }`. |
| `POST` | `/api/invoices/:id/retry-payment` | Re-authorizes rejected vendor disbursement. |
| `GET` | `/api/metrics` | Returns executive KPI counts and dollar volumes. |
| `POST` | `/api/export` | Generates audit CSV metadata `{ fileName, fileSize }`. |

---

## 5. Playwright Verification Suite

To run all 6 end-to-end verification tests and refresh 1920x1080 screenshots:

```bash
npx playwright test
```

Generated screenshots:
* `screenshots/flow-1-login.png`
* `screenshots/flow-2-approve.png`
* `screenshots/flow-3-bulk.png`
* `screenshots/flow-4-export.png`
* `screenshots/flow-5-recovery.png`
* `screenshots/flow-6-polish.png`

---

## 6. Docker Support

```bash
docker build -t ledgerly .
docker run -p 8080:8080 -e APP_BUG="" ledgerly
```
