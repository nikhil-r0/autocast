import React from 'react';
import { X, AlertTriangle, Building2, Calendar, FileText, Check, ShieldCheck } from 'lucide-react';
import { Invoice } from '../types.js';

interface InvoiceDrawerProps {
  invoice: Invoice | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenApproveModal: () => void;
  onRetryPayment: (id: string) => void;
  retryingPayment: boolean;
}

export const InvoiceDrawer: React.FC<InvoiceDrawerProps> = ({
  invoice,
  isOpen,
  onClose,
  onOpenApproveModal,
  onRetryPayment,
  retryingPayment,
}) => {
  if (!isOpen || !invoice) return null;

  const isApproved = invoice.status === 'Approved';
  const isFailed = invoice.status === 'Payment failed';

  return (
    <div className="fixed inset-0 z-40 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-300"
        onClick={onClose}
        data-testid="drawer-backdrop"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div
          data-testid="invoice-drawer"
          className="w-screen max-w-xl bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col justify-between transition-transform duration-300 ease-out animate-in slide-in-from-right"
        >
          {/* Drawer Header */}
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between bg-slate-50/50 dark:bg-slate-800/30">
            <div>
              <div className="flex items-center gap-3">
                <span data-testid="drawer-invoice-id" className="text-xl font-mono font-extrabold text-slate-900 dark:text-white">
                  {invoice.id}
                </span>
                <span
                  data-testid="drawer-status-badge"
                  className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                    isApproved
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800'
                      : isFailed
                      ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border-rose-300 dark:border-rose-800'
                      : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border-amber-300 dark:border-amber-800'
                  }`}
                >
                  {invoice.status}
                </span>
              </div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-1 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <span>{invoice.vendor}</span>
                <span className="text-slate-400 font-normal">&bull; {invoice.vendorCategory}</span>
              </p>
            </div>

            <button
              onClick={onClose}
              data-testid="btn-close-drawer"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Close drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Payment Failed Inline Alert */}
            {isFailed && (
              <div
                data-testid="drawer-payment-alert"
                className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-900/60 flex items-start justify-between gap-3"
              >
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-rose-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <h5 className="text-xs font-bold text-rose-900 dark:text-rose-200 uppercase tracking-wider">
                      Settlement Rejection
                    </h5>
                    <p className="text-xs text-rose-700 dark:text-rose-300 mt-0.5">
                      {invoice.paymentError}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => onRetryPayment(invoice.id)}
                  disabled={retryingPayment}
                  data-testid="btn-retry-drawer-payment"
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-sm flex-shrink-0"
                >
                  {retryingPayment ? 'Retrying...' : 'Retry Payment'}
                </button>
              </div>
            )}

            {/* Document Preview Placeholder (PDF Mockup) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  Original Vendor Document
                </span>
                <span className="text-[11px] text-slate-400 font-mono">PDF &bull; 2.4 MB</span>
              </div>

              <div
                data-testid="doc-preview"
                className="relative rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-5 overflow-hidden shadow-inner"
              >
                {/* Visual Watermark / Seal if Approved */}
                {isApproved && (
                  <div
                    data-testid="approved-seal"
                    className="absolute right-6 top-6 z-20 flex flex-col items-center justify-center p-3 rounded-xl border-4 border-emerald-600 dark:border-emerald-500 bg-white/95 dark:bg-slate-900/95 shadow-xl text-emerald-700 dark:text-emerald-400 animate-stamp"
                  >
                    <div className="flex items-center gap-1.5 text-base font-black tracking-widest uppercase">
                      <ShieldCheck className="w-5 h-5 stroke-[2.5]" />
                      <span>APPROVED</span>
                    </div>
                    <span className="text-[9px] font-mono font-bold uppercase tracking-wider mt-0.5">
                      {invoice.approvedAt || '2026-11-16T10:30:00Z'}
                    </span>
                    <span className="text-[8px] tracking-tight text-slate-500 dark:text-slate-400">
                      Signature: J. Doe (Finance)
                    </span>
                  </div>
                )}

                {/* PDF Wireframe Content */}
                <div className="space-y-4 text-xs">
                  <div className="flex justify-between items-start border-b border-slate-200 dark:border-slate-700/80 pb-3">
                    <div>
                      <div className="font-extrabold text-sm text-slate-900 dark:text-white">
                        {invoice.vendor}
                      </div>
                      <div className="text-slate-500 text-[11px]">100 Technology Plaza, Suite 400</div>
                    </div>
                    <div className="text-right">
                      <div className="text-slate-400 text-[10px] uppercase font-bold">Invoice Ref</div>
                      <div className="font-mono font-bold text-slate-800 dark:text-slate-200">{invoice.id}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-[11px]">
                    <div>
                      <span className="text-slate-400 block font-medium">Billed To:</span>
                      <strong className="text-slate-700 dark:text-slate-300">Ledgerly Technologies Inc.</strong>
                      <div className="text-slate-500">Dept: {invoice.department}</div>
                    </div>
                    <div>
                      <div className="flex items-center gap-1 text-slate-500">
                        <Calendar className="w-3 h-3" />
                        <span>Issue: {invoice.issueDate}</span>
                      </div>
                      <div className="flex items-center gap-1 text-slate-500 mt-1">
                        <Calendar className="w-3 h-3 text-amber-500" />
                        <span>Due: {invoice.dueDate}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Line Items Breakdown */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                Line Items ({invoice.lineItems.length})
              </h4>
              <div
                data-testid="line-items-table"
                className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden"
              >
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold">Description</th>
                      <th className="py-2.5 px-3 font-semibold text-center w-14">Qty</th>
                      <th className="py-2.5 px-3 font-semibold text-right w-24">Price</th>
                      <th className="py-2.5 px-3 font-semibold text-right w-24">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {invoice.lineItems.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-200">
                          {item.description}
                        </td>
                        <td className="py-2.5 px-3 text-center text-slate-500 font-mono">
                          {item.quantity}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-400 font-mono">
                          ${item.unitPrice.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-white font-mono">
                          ${item.total.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50/70 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800">
                    <tr>
                      <td colSpan={3} className="py-3 px-3 text-right font-bold text-slate-700 dark:text-slate-300">
                        Total Amount Due:
                      </td>
                      <td
                        data-testid="drawer-total-amount"
                        className="py-3 px-3 text-right font-extrabold text-sm text-slate-900 dark:text-white font-mono"
                      >
                        ${invoice.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Audit History / Notes */}
            {invoice.approvalNote && (
              <div className="p-3.5 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 text-xs">
                <span className="font-bold text-emerald-800 dark:text-emerald-300 block mb-0.5">
                  Verified Authorization Note:
                </span>
                <p className="text-emerald-700 dark:text-emerald-400">
                  "{invoice.approvalNote}"
                </p>
              </div>
            )}
          </div>

          {/* Drawer Footer Actions */}
          <div className="p-5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-3">
            <button
              onClick={onClose}
              data-testid="btn-drawer-cancel"
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg transition-colors"
            >
              Close
            </button>

            <div className="flex items-center gap-3">
              {!isApproved && (
                <button
                  onClick={onOpenApproveModal}
                  data-testid="btn-open-approve-modal"
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-md hover:shadow-lg transition-all"
                >
                  <Check className="w-4 h-4" />
                  <span>Approve Invoice</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
