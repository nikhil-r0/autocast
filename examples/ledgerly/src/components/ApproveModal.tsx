import React, { useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { Invoice } from '../types.js';

interface ApproveModalProps {
  isOpen: boolean;
  invoice: Invoice | null;
  onConfirm: (note: string) => void;
  onCancel: () => void;
  approving: boolean;
}

export const ApproveModal: React.FC<ApproveModalProps> = ({
  isOpen,
  invoice,
  onConfirm,
  onCancel,
  approving,
}) => {
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  if (!isOpen || !invoice) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim()) {
      setError('An authorization note is required for executive audit clearance.');
      return;
    }
    setError('');
    onConfirm(note.trim());
  };

  return (
    <div
      data-testid="approve-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Authorize Invoice Disbursement
              </h3>
              <span className="text-xs font-mono font-semibold text-slate-500">
                {invoice.id} &bull; {invoice.vendor}
              </span>
            </div>
          </div>
          <button
            onClick={onCancel}
            data-testid="btn-close-modal"
            className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Invoice Summary Box */}
        <div className="my-4 p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between text-xs">
          <div>
            <span className="text-slate-500 dark:text-slate-400 block">Total Authorization</span>
            <span className="text-base font-extrabold font-mono text-slate-900 dark:text-white">
              ${invoice.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="text-right">
            <span className="text-slate-500 dark:text-slate-400 block">Department</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {invoice.department}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Required Note Input */}
          <div className="mb-4">
            <label
              htmlFor="approval-note"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Authorization Note <span className="text-rose-500">*</span>
            </label>
            <textarea
              id="approval-note"
              data-testid="input-approval-note"
              rows={3}
              placeholder="e.g. Looks good, approved under Q4 infra budget."
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                if (error) setError('');
              }}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            {error && (
              <p data-testid="approval-note-error" className="text-[11px] text-rose-500 mt-1 font-medium">
                {error}
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={approving}
              data-testid="btn-cancel-approve"
              className="px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={approving}
              data-testid="btn-confirm-approve"
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-xs font-semibold rounded-lg shadow-sm hover:shadow transition-all"
            >
              {approving ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  <span>Authorizing...</span>
                </>
              ) : (
                <span>Confirm Approval</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

