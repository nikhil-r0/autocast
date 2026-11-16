import React from 'react';
import { Layers, CheckCircle2 } from 'lucide-react';

interface BulkApproveModalProps {
  isOpen: boolean;
  selectedIds: string[];
  onConfirm: () => void;
  onCancel: () => void;
  progress: number;
  isProcessing: boolean;
}

export const BulkApproveModal: React.FC<BulkApproveModalProps> = ({
  isOpen,
  selectedIds,
  onConfirm,
  onCancel,
  progress,
  isProcessing,
}) => {
  if (!isOpen) return null;

  return (
    <div
      data-testid="bulk-approve-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 animate-in zoom-in-95 duration-150">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Bulk Batch Approval
            </h3>
            <p className="text-xs text-slate-500">
              {selectedIds.length} invoices selected for batch authorization
            </p>
          </div>
        </div>

        {/* Selected IDs Chips */}
        <div className="mb-5 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Queued for Approval:
          </div>
          <div className="flex flex-wrap gap-1.5">
            {selectedIds.map((id) => (
              <span
                key={id}
                className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200"
              >
                {id}
              </span>
            ))}
          </div>
        </div>

        {/* Progress Bar (if processing) */}
        {isProcessing && (
          <div className="mb-5">
            <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 mb-1.5 font-medium">
              <span>Authorizing batch items...</span>
              <span data-testid="bulk-progress-text">{Math.round(progress)}%</span>
            </div>
            <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                data-testid="bulk-progress-bar"
                className="h-full bg-emerald-500 transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isProcessing}
            data-testid="btn-cancel-bulk"
            className="px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isProcessing}
            data-testid="btn-confirm-bulk"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-semibold rounded-lg shadow-sm hover:shadow transition-all"
          >
            {isProcessing ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                <span>Processing Batch...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Approve All {selectedIds.length}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

