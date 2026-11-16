import React from 'react';
import { Search, Download, CheckCircle2, ChevronRight, Filter, AlertCircle } from 'lucide-react';
import { Invoice, InvoiceStatus, Vendor } from '../types.js';

interface InvoiceTableProps {
  invoices: Invoice[];
  vendors: Vendor[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onSelectInvoice: (invoice: Invoice) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  vendorFilter: string;
  onVendorFilterChange: (vendor: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onOpenBulkApprove: () => void;
  onOpenExport: () => void;
  onClearFilters: () => void;
  loading: boolean;
}

export const InvoiceTable: React.FC<InvoiceTableProps> = ({
  invoices,
  vendors,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onSelectInvoice,
  statusFilter,
  onStatusFilterChange,
  vendorFilter,
  onVendorFilterChange,
  searchQuery,
  onSearchChange,
  onOpenBulkApprove,
  onOpenExport,
  onClearFilters,
  loading,
}) => {
  const allSelected = invoices.length > 0 && selectedIds.length === invoices.length;
  const isAnySelected = selectedIds.length > 0;

  const getStatusBadge = (status: InvoiceStatus, id: string) => {
    switch (status) {
      case 'Approved':
        return (
          <span
            data-testid={`status-badge-${id}`}
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Approved
          </span>
        );
      case 'Payment failed':
        return (
          <span
            data-testid={`status-badge-${id}`}
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-900"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
            Payment failed
          </span>
        );
      case 'Rejected':
        return (
          <span
            data-testid={`status-badge-${id}`}
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
            Rejected
          </span>
        );
      case 'Pending':
      default:
        return (
          <span
            data-testid={`status-badge-${id}`}
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-900"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            Pending
          </span>
        );
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden transition-all duration-200">
      {/* Table Action Controls Toolbar */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/30">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Search Box */}
          <div className="relative flex-1 sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              data-testid="search-input"
              placeholder="Filter by ID, vendor, or dept..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Status Filter Dropdown */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Filter className="w-3.5 h-3.5" />
            <select
              data-testid="filter-status"
              value={statusFilter}
              onChange={(e) => onStatusFilterChange(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            >
              <option value="All">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Payment failed">Payment failed</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          {/* Vendor Filter Dropdown */}
          <select
            data-testid="filter-vendor"
            value={vendorFilter}
            onChange={(e) => onVendorFilterChange(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
          >
            <option value="All">All Vendors ({vendors.length})</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.name}>
                {v.name}
              </option>
            ))}
          </select>
        </div>

        {/* Right Toolbar Actions */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          {/* Bulk Action Bar (when rows selected) */}
          {isAnySelected && (
            <div className="flex items-center gap-2 animate-in fade-in zoom-in-95 duration-150">
              <span data-testid="selected-count-badge" className="text-xs font-semibold px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                {selectedIds.length} Selected
              </span>
              <button
                onClick={onOpenBulkApprove}
                data-testid="btn-bulk-approve"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm hover:shadow transition-all"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Bulk Approve</span>
              </button>
            </div>
          )}

          {/* Export Report Button */}
          <button
            onClick={onOpenExport}
            data-testid="btn-open-export"
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-lg shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Table Component */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse" data-testid="invoices-table">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              <th className="py-3 px-4 w-10 text-center">
                <input
                  type="checkbox"
                  data-testid="select-all-checkbox"
                  checked={allSelected}
                  onChange={onToggleSelectAll}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  aria-label="Select all rows"
                />
              </th>
              <th className="py-3 px-4 w-28">Invoice #</th>
              <th className="py-3 px-4">Vendor & Category</th>
              <th className="py-3 px-4 w-32">Department</th>
              <th className="py-3 px-4 w-32">Due Date</th>
              <th className="py-3 px-4 w-32 text-right">Amount</th>
              <th className="py-3 px-4 w-36 text-center">Status</th>
              <th className="py-3 px-4 w-24 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {loading ? (
              [1, 2, 3, 4, 5, 6].map((i) => (
                <tr key={i} className="animate-pulse">
                  <td className="py-3 px-4 text-center">
                    <div className="w-4 h-4 bg-slate-200 dark:bg-slate-800 rounded mx-auto"></div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-16"></div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-48"></div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-20"></div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-20"></div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-16 ml-auto"></div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-20 mx-auto"></div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-12 ml-auto"></div>
                  </td>
                </tr>
              ))
            ) : invoices.length === 0 ? (
              /* Empty state */
              <tr>
                <td colSpan={8} className="py-12 px-4 text-center" data-testid="empty-state">
                  <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                    <div className="p-3 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 mb-3">
                      <AlertCircle className="w-6 h-6" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      No invoices match your filter criteria
                    </h4>
                    <p className="text-xs text-slate-500 mt-1 mb-4">
                      Try clearing or adjusting your search term, vendor filter, or status selection.
                    </p>
                    <button
                      onClick={onClearFilters}
                      data-testid="btn-clear-filters"
                      className="px-3.5 py-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-lg transition-colors border border-blue-200 dark:border-blue-900"
                    >
                      Reset All Filters
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              invoices.map((inv) => {
                const isSelected = selectedIds.includes(inv.id);
                return (
                  <tr
                    key={inv.id}
                    data-testid={`invoice-row-${inv.id}`}
                    onClick={() => onSelectInvoice(inv)}
                    className={`hover:bg-blue-50/40 dark:hover:bg-slate-800/60 cursor-pointer transition-colors duration-150 ${
                      isSelected ? 'bg-blue-50/70 dark:bg-blue-950/30' : ''
                    }`}
                  >
                    <td
                      className="py-3.5 px-4 text-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        data-testid={`checkbox-${inv.id}`}
                        checked={isSelected}
                        onChange={() => onToggleSelect(inv.id)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        aria-label={`Select invoice ${inv.id}`}
                      />
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white" data-testid={`invoice-id-${inv.id}`}>
                      {inv.id}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-md" data-testid={`vendor-name-${inv.id}`}>
                        {inv.vendor}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {inv.vendorCategory}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-600 dark:text-slate-300">
                      {inv.department}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-600 dark:text-slate-300">
                      {inv.dueDate}
                    </td>
                    <td
                      data-testid={`amount-${inv.id}`}
                      className="py-3.5 px-4 text-right font-extrabold font-mono text-slate-900 dark:text-white"
                    >
                      ${inv.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {getStatusBadge(inv.status, inv.id)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectInvoice(inv);
                        }}
                        data-testid={`btn-review-${inv.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-colors"
                        aria-label={`Review invoice ${inv.id}`}
                      >
                        <span>Review</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Table Pagination / Record Footer */}
      <div className="p-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/20 flex items-center justify-between text-xs text-slate-500">
        <span>Showing {invoices.length} total records</span>
        <span className="font-mono text-[11px]">Ledger Status: Reconciled</span>
      </div>
    </div>
  );
};
