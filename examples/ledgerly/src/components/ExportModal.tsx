import React, { useState } from 'react';
import { Download, FileSpreadsheet, CheckCircle2, X } from 'lucide-react';
import { DEMO_CLOCK } from '../data/seed.ts';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (dateRange: string) => Promise<{ fileName: string; fileSize: string }>;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  onExport,
}) => {
  const [dateRange, setDateRange] = useState('Nov 1 - Nov 16, 2026');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ fileName: string; fileSize: string } | null>(null);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const data = await onExport(dateRange);
      setResult(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    onClose();
  };

  return (
    <div
      data-testid="export-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Export Financial Audit Report
              </h3>
              <p className="text-xs text-slate-500">
                Generate reconciled invoice and payment records
              </p>
            </div>
          </div>
          <button
            onClick={handleReset}
            data-testid="btn-close-export"
            className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Date Range Selection (if not ready) */}
        {!result ? (
          <div className="my-5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Select Statement Period
            </label>
            <select
              data-testid="export-date-range"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              disabled={loading}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Nov 1 - Nov 16, 2026">Current Period (Nov 1 – Nov 16, 2026)</option>
              <option value="Oct 1 - Oct 31, 2026">Previous Month (October 2026)</option>
              <option value="Jul 1 - Sep 30, 2026">Third Quarter (Q3 2026)</option>
              <option value="Jan 1 - Nov 16, 2026">Year to Date (Fiscal 2026)</option>
            </select>

            <div className="mt-4 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs text-slate-500">
              Report output includes line items, authorization signatures, department cost allocations, and settlement states.
            </div>

            {/* Spinner Progress Ring */}
            {loading && (
              <div
                data-testid="export-progress-ring"
                className="mt-6 flex flex-col items-center justify-center gap-3 py-4"
              >
                <div className="w-8 h-8 border-3 border-blue-200 dark:border-blue-900 border-t-blue-600 rounded-full animate-spin"></div>
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Compiling CSV data records...
                </span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 mt-6 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={handleReset}
                disabled={loading}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={loading}
                data-testid="btn-generate-export"
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-semibold rounded-lg shadow-sm hover:shadow transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>
        ) : (
          /* Download Ready State */
          <div data-testid="export-download-ready" className="my-5 animate-in fade-in duration-200">
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 flex items-start gap-3">
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                  Download Ready
                </h4>
                <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">
                  Your export file was compiled and verified at {DEMO_CLOCK}.
                </p>

                <div className="mt-3 p-2.5 rounded bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 font-mono text-xs flex justify-between">
                  <span data-testid="export-filename" className="font-semibold text-slate-800 dark:text-slate-200">
                    {result.fileName}
                  </span>
                  <span data-testid="export-filesize" className="text-slate-500">
                    {result.fileSize}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={handleReset}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleReset}
                data-testid="btn-download-file"
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm hover:shadow transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Ready CSV</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
