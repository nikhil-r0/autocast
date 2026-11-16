import { test, expect } from '@playwright/test';
import * as path from 'path';

test.describe('Ledgerly SaaS - E2E Verification Flows', () => {
  test.beforeEach(async ({ request }) => {
    // Reset seed data before each test for determinism
    const res = await request.post('http://localhost:8080/api/reset');
    expect(res.ok()).toBeTruthy();
  });

  // Flow 1: Login to Dashboard
  test('Flow 1: Login to dashboard with prefilled credentials and verify KPI resolution', async ({ page }) => {
    await page.goto('/');

    // Verify login view is visible
    await expect(page.locator('[data-testid="login-view"]')).toBeVisible();
    await expect(page.locator('[data-testid="input-email"]')).toHaveValue('demo@ledgerly.test');
    await expect(page.locator('[data-testid="input-password"]')).toHaveValue('demo1234');

    // Click Sign In
    await page.click('[data-testid="btn-login"]');

    // Verify skeleton renders, then KPI cards resolve
    await expect(page.locator('[data-testid="kpi-cards-grid"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="kpi-pending-value"]')).toHaveText('12');
    await expect(page.locator('[data-testid="spend-chart-card"]')).toBeVisible();

    // Verify Invoices Table is visible
    await expect(page.locator('[data-testid="invoices-table"]')).toBeVisible();

    // Screenshot final state at 1920x1080
    await page.screenshot({
      path: path.join(process.cwd(), 'screenshots', 'flow-1-login.png'),
      fullPage: false,
    });
  });

  // Flow 2: Approve an Invoice (INV-1042)
  test('Flow 2: Approve invoice INV-1042, confirm with note, verify seal and decremented KPI', async ({ page }) => {
    await page.goto('/?logged_in=true');

    // Initial KPI check
    await expect(page.locator('[data-testid="kpi-pending-value"]')).toHaveText('12');

    // Click row INV-1042
    const row = page.locator('[data-testid="invoice-row-INV-1042"]');
    await expect(row).toBeVisible();
    await row.click();

    // Drawer slides in
    const drawer = page.locator('[data-testid="invoice-drawer"]');
    await expect(drawer).toBeVisible();
    await expect(page.locator('[data-testid="drawer-invoice-id"]')).toHaveText('INV-1042');
    await expect(page.locator('[data-testid="doc-preview"]')).toBeVisible();
    await expect(page.locator('[data-testid="line-items-table"]')).toBeVisible();

    // Click Approve Invoice button in drawer
    await page.click('[data-testid="btn-open-approve-modal"]');

    // Approve confirmation modal opens
    const modal = page.locator('[data-testid="approve-modal"]');
    await expect(modal).toBeVisible();

    // Fill in required note
    const noteInput = page.locator('[data-testid="input-approval-note"]');
    await noteInput.fill('Looks good, approved under Q4 infra budget.');

    // Confirm approval
    await page.click('[data-testid="btn-confirm-approve"]');

    // Toast appears
    const toast = page.locator('[data-testid="toast-notification"]');
    await expect(toast).toBeVisible();
    await expect(page.locator('[data-testid="toast-message"]')).toContainText('Invoice INV-1042 approved');

    // Approved seal stamps into document preview
    const seal = page.locator('[data-testid="approved-seal"]');
    await expect(seal).toBeVisible();
    await expect(seal).toContainText('APPROVED');

    // Badge changes to Approved
    await expect(page.locator('[data-testid="drawer-status-badge"]')).toHaveText('Approved');

    // KPI decrements from 12 to 11
    await expect(page.locator('[data-testid="kpi-pending-value"]')).toHaveText('11');

    // Close drawer to verify row badge in table
    await page.click('[data-testid="btn-close-drawer"]');
    await expect(page.locator('[data-testid="status-badge-INV-1042"]')).toContainText('Approved');

    // Screenshot final state at 1920x1080
    await page.screenshot({
      path: path.join(process.cwd(), 'screenshots', 'flow-2-approve.png'),
      fullPage: false,
    });
  });

  // Flow 3: Filter and Bulk Approve
  test('Flow 3: Filter by status, select 3 rows, bulk approve with progress bar, and verify empty state', async ({ page }) => {
    await page.goto('/?logged_in=true');

    // Filter by Pending status
    await page.selectOption('[data-testid="filter-status"]', 'Pending');
    await page.waitForTimeout(900); // await simulated latency

    // Select 3 rows
    await page.click('[data-testid="checkbox-INV-1041"]');
    await page.click('[data-testid="checkbox-INV-1040"]');
    await page.click('[data-testid="checkbox-INV-1039"]');

    // Bulk approve button appears with "3 Selected"
    await expect(page.locator('[data-testid="selected-count-badge"]')).toHaveText('3 Selected');
    await page.click('[data-testid="btn-bulk-approve"]');

    // Modal opens with progress
    const bulkModal = page.locator('[data-testid="bulk-approve-modal"]');
    await expect(bulkModal).toBeVisible();
    await page.click('[data-testid="btn-confirm-bulk"]');

    // Progress bar fills and toast appears
    await expect(page.locator('[data-testid="bulk-progress-bar"]')).toBeVisible();
    const toast = page.locator('[data-testid="toast-notification"]');
    await expect(toast).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="toast-message"]')).toContainText('Successfully approved 3 invoice(s)');

    // Test empty filter state: search nonexistent vendor
    await page.fill('[data-testid="search-input"]', 'NonexistentVendorXYZ');
    await page.waitForTimeout(900);
    const emptyState = page.locator('[data-testid="empty-state"]');
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toContainText('No invoices match your filter criteria');

    // Reset filters
    await page.click('[data-testid="btn-clear-filters"]');
    await page.waitForTimeout(900);
    await expect(page.locator('[data-testid="invoices-table"]')).toBeVisible();

    // Screenshot final state
    await page.screenshot({
      path: path.join(process.cwd(), 'screenshots', 'flow-3-bulk.png'),
      fullPage: false,
    });
  });

  // Flow 4: Export a Report
  test('Flow 4: Choose date range, export CSV with progress ring, and verify download ready state', async ({ page }) => {
    await page.goto('/?logged_in=true');

    // Open export modal
    await page.click('[data-testid="btn-open-export"]');
    const modal = page.locator('[data-testid="export-modal"]');
    await expect(modal).toBeVisible();

    // Select date range
    await page.selectOption('[data-testid="export-date-range"]', 'Nov 1 - Nov 16, 2026');

    // Click Export CSV
    await page.click('[data-testid="btn-generate-export"]');

    // Progress ring appears
    await expect(page.locator('[data-testid="export-progress-ring"]')).toBeVisible();

    // Download ready state appears with filename and filesize
    const readyState = page.locator('[data-testid="export-download-ready"]');
    await expect(readyState).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="export-filename"]')).toHaveText('ledgerly-export-2026-11-16.csv');
    await expect(page.locator('[data-testid="export-filesize"]')).toHaveText('142.8 KB');
    await expect(page.locator('[data-testid="btn-download-file"]')).toBeVisible();

    // Screenshot final state
    await page.screenshot({
      path: path.join(process.cwd(), 'screenshots', 'flow-4-export.png'),
      fullPage: false,
    });
  });

  // Flow 5: Failure and Recovery (Payment Failed Retry)
  test('Flow 5: Payment failure inline banner, retry payment, and verify recovery to Approved status', async ({ page }) => {
    await page.goto('/?logged_in=true');

    // Prominent payment failure banner is visible for INV-1028
    const banner = page.locator('[data-testid="payment-failure-banner"]');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('Disbursement Authorization Failure • INV-1028');
    await expect(banner).toContainText('Starlight Logistics');

    // Row status in table is "Payment failed"
    await expect(page.locator('[data-testid="status-badge-INV-1028"]')).toContainText('Payment failed');

    // Click Retry Payment in the banner
    await page.click('[data-testid="btn-banner-retry"]');

    // Success toast appears
    const toast = page.locator('[data-testid="toast-notification"]');
    await expect(toast).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="toast-message"]')).toContainText('Payment re-authorized for INV-1028');

    // Banner is dismissed because no invoices are in "Payment failed" status
    await expect(banner).not.toBeVisible();

    // Status badge turns green / Approved
    await expect(page.locator('[data-testid="status-badge-INV-1028"]')).toContainText('Approved');

    // Screenshot final state
    await page.screenshot({
      path: path.join(process.cwd(), 'screenshots', 'flow-5-recovery.png'),
      fullPage: false,
    });
  });

  // Flow 6: Polish Moments (Command Palette & Dark Mode)
  test('Flow 6: Command palette search to jump to invoice, dark mode toggle, and KPI hover tooltips', async ({ page }) => {
    await page.goto('/?logged_in=true');

    // Trigger Command Palette with search button or shortcut
    await page.click('[data-testid="search-trigger"]');
    const palette = page.locator('[data-testid="command-palette"]');
    await expect(palette).toBeVisible();

    // Type in command palette to jump to INV-1040
    await page.fill('[data-testid="command-palette-input"]', 'INV-1040');
    const item = page.locator('[data-testid="command-item-INV-1040"]');
    await expect(item).toBeVisible();
    await item.click();

    // Drawer opens directly to INV-1040
    await expect(page.locator('[data-testid="invoice-drawer"]')).toBeVisible();
    await expect(page.locator('[data-testid="drawer-invoice-id"]')).toHaveText('INV-1040');
    await page.click('[data-testid="btn-close-drawer"]');

    // Test Dark Mode toggle
    await page.click('[data-testid="theme-toggle"]');
    const html = page.locator('html');
    await expect(html).toHaveClass(/dark/);

    // Test KPI hover tooltip
    await page.hover('[data-testid="kpi-pending-approvals"]');
    await expect(page.locator('[data-testid="kpi-tooltip-pending"]')).toBeVisible();

    // Screenshot final state
    await page.screenshot({
      path: path.join(process.cwd(), 'screenshots', 'flow-6-polish.png'),
      fullPage: false,
    });
  });
});
