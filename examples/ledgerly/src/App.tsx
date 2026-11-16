import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar.tsx';
import { KPICards } from './components/KPICards.tsx';
import { SpendChart } from './components/SpendChart.tsx';
import { PaymentFailureBanner } from './components/PaymentFailureBanner.tsx';
import { InvoiceTable } from './components/InvoiceTable.tsx';
import { InvoiceDrawer } from './components/InvoiceDrawer.tsx';
import { ApproveModal } from './components/ApproveModal.tsx';
import { BulkApproveModal } from './components/BulkApproveModal.tsx';
import { ExportModal } from './components/ExportModal.tsx';
import { CommandPalette } from './components/CommandPalette.tsx';
import { Toast, ToastMessage } from './components/Toast.tsx';
import { LoginView } from './components/LoginView.tsx';
import { Invoice, Metrics, Vendor } from './types.js';

export const App: React.FC = () => {
  // Check URL query parameters for initial state (e.g. ?logged_in=true or ?flow=2)
  const queryParams = new URLSearchParams(window.location.search);
  const [isLoggedIn, setIsLoggedIn] = useState(queryParams.get('logged_in') === 'true');

  const [isDark, setIsDark] = useState(false);
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);

  // Filter & Selection State
  const [statusFilter, setStatusFilter] = useState('All');
  const [vendorFilter, setVendorFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modals & Drawers
  const [activeInvoice, setActiveInvoice] = useState<Invoice | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [isBulkApproveModalOpen, setIsBulkApproveModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  // Async execution states
  const [approving, setApproving] = useState(false);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [retryingPayment, setRetryingPayment] = useState(false);

  // Toast notifications
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    setToast({ id: String(Date.now()), type, message });
  };

  // Toggle Dark Mode
  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    if (next) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // Fetch initial data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [mRes, vRes, iRes] = await Promise.all([
        fetch('/api/metrics'),
        fetch('/api/vendors'),
        fetch(`/api/invoices?status=${statusFilter}&vendor=${vendorFilter}&search=${encodeURIComponent(searchQuery)}`),
      ]);

      if (mRes.ok) setMetrics(await mRes.json());
      if (vRes.ok) setVendors(await vRes.json());
      if (iRes.ok) setInvoices(await iRes.json());
    } catch (err) {
      console.error('Failed to load API data:', err);
      showToast('error', 'Failed to synchronize ledger records from server');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, vendorFilter, searchQuery]);

  useEffect(() => {
    if (isLoggedIn) {
      fetchData();
    }
  }, [isLoggedIn, fetchData]);

  // Handle row selection
  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === invoices.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(invoices.map((i) => i.id));
    }
  };

  const handleClearFilters = () => {
    setStatusFilter('All');
    setVendorFilter('All');
    setSearchQuery('');
  };

  // Open invoice detail drawer
  const handleSelectInvoice = (invoice: Invoice) => {
    setActiveInvoice(invoice);
    setIsDrawerOpen(true);
  };

  // Flow 2: Approve single invoice
  const handleConfirmApprove = async (note: string) => {
    if (!activeInvoice) return;
    setApproving(true);
    try {
      const res = await fetch(`/api/invoices/${activeInvoice.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note }),
      });
      const data = await res.json();

      if (res.ok) {
        showToast('success', `Invoice ${activeInvoice.id} approved`);
        setIsApproveModalOpen(false);

        // Update active invoice status in drawer
        setActiveInvoice((prev) =>
          prev ? { ...prev, status: data.status, approvalNote: note, approvedAt: '2026-11-16T10:30:00Z' } : null
        );

        // Refresh table & metrics
        fetchData();
      } else {
        showToast('error', data.error || 'Approval failed');
      }
    } catch (err) {
      showToast('error', 'Network error authorizing disbursement');
    } finally {
      setApproving(false);
    }
  };

  // Flow 3: Bulk approve selected invoices
  const handleConfirmBulkApprove = async () => {
    if (selectedIds.length === 0) return;
    setIsBulkProcessing(true);
    setBulkProgress(15);

    const progressTimer = setInterval(() => {
      setBulkProgress((p) => Math.min(90, p + 25));
    }, 200);

    try {
      const res = await fetch('/api/invoices/bulk-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds }),
      });
      const data = await res.json();
      clearInterval(progressTimer);
      setBulkProgress(100);

      if (res.ok) {
        setTimeout(() => {
          setIsBulkProcessing(false);
          setIsBulkApproveModalOpen(false);
          setSelectedIds([]);
          showToast('success', data.message || `Successfully approved ${selectedIds.length} invoices`);
          fetchData();
        }, 400);
      } else {
        setIsBulkProcessing(false);
        showToast('error', data.error || 'Bulk approval failed');
      }
    } catch (err) {
      clearInterval(progressTimer);
      setIsBulkProcessing(false);
      showToast('error', 'Network error during bulk approval');
    }
  };

  // Flow 5: Retry payment
  const handleRetryPayment = async (invoiceId: string) => {
    setRetryingPayment(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/retry-payment`, {
        method: 'POST',
      });
      const data = await res.json();

      if (res.ok) {
        showToast('success', `Payment re-authorized for ${invoiceId}`);
        if (activeInvoice && activeInvoice.id === invoiceId) {
          setActiveInvoice((prev) => (prev ? { ...prev, status: 'Approved', paymentError: undefined } : null));
        }
        fetchData();
      } else {
        showToast('error', data.error || 'Retry payment failed');
      }
    } catch (err) {
      showToast('error', 'Network error re-authorizing payment');
    } finally {
      setRetryingPayment(false);
    }
  };

  // Flow 4: Export report
  const handleExportReport = async (dateRange: string) => {
    const res = await fetch('/api/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dateRange }),
    });
    return await res.json();
  };

  // Reset database state
  const handleResetData = async () => {
    try {
      const res = await fetch('/api/reset', { method: 'POST' });
      if (res.ok) {
        showToast('info', 'Seed state restored to 2026-11-16');
        setSelectedIds([]);
        setIsDrawerOpen(false);
        fetchData();
      }
    } catch (err) {
      showToast('error', 'Failed to reset seed state');
    }
  };

  // If not logged in, show Flow 1 Login screen
  if (!isLoggedIn) {
    return <LoginView onLogin={() => setIsLoggedIn(true)} />;
  }

  // Find first failed invoice for banner (e.g. INV-1028)
  const failedInvoice = invoices.find((inv) => inv.status === 'Payment failed');

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      <Navbar
        isDark={isDark}
        onToggleTheme={toggleTheme}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onResetData={handleResetData}
      />

      <main className="max-w-[1720px] mx-auto px-6 py-6">
        {/* KPI Row (Skeleton into resolved metrics) */}
        <KPICards metrics={metrics} loading={loading} />

        {/* Spend Trend Chart (Linear/Stripe quality) */}
        <SpendChart loading={loading} />

        {/* Payment Failure Alert Banner (Flow 5) */}
        <PaymentFailureBanner
          failedInvoice={failedInvoice}
          onRetry={handleRetryPayment}
          retrying={retryingPayment}
        />

        {/* Invoices Table with Search, Filters, Row Selection, and Actions */}
        <InvoiceTable
          invoices={invoices}
          vendors={vendors}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelectRow}
          onToggleSelectAll={toggleSelectAll}
          onSelectInvoice={handleSelectInvoice}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          vendorFilter={vendorFilter}
          onVendorFilterChange={setVendorFilter}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onOpenBulkApprove={() => setIsBulkApproveModalOpen(true)}
          onOpenExport={() => setIsExportModalOpen(true)}
          onClearFilters={handleClearFilters}
          loading={loading}
        />
      </main>

      {/* Slide-over Invoice Detail Drawer */}
      <InvoiceDrawer
        invoice={activeInvoice}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onOpenApproveModal={() => setIsApproveModalOpen(true)}
        onRetryPayment={handleRetryPayment}
        retryingPayment={retryingPayment}
      />

      {/* Flow 2: Approve Invoice Confirm Modal with Required Note */}
      <ApproveModal
        isOpen={isApproveModalOpen}
        invoice={activeInvoice}
        onConfirm={handleConfirmApprove}
        onCancel={() => setIsApproveModalOpen(false)}
        approving={approving}
      />

      {/* Flow 3: Bulk Approve Batch Modal */}
      <BulkApproveModal
        isOpen={isBulkApproveModalOpen}
        selectedIds={selectedIds}
        onConfirm={handleConfirmBulkApprove}
        onCancel={() => setIsBulkApproveModalOpen(false)}
        progress={bulkProgress}
        isProcessing={isBulkProcessing}
      />

      {/* Flow 4: Export CSV Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        onExport={handleExportReport}
      />

      {/* Flow 6: Command Palette (Ctrl/Cmd+K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        invoices={invoices}
        onSelectInvoice={handleSelectInvoice}
      />

      {/* 4-Second Auto-dismiss Toast */}
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
};

export default App;
