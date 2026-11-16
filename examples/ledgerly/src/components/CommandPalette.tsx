import React, { useState, useEffect } from 'react';
import { Search, X, FileText, ArrowRight } from 'lucide-react';
import { Invoice } from '../types.js';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  invoices: Invoice[];
  onSelectInvoice: (invoice: Invoice) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  invoices,
  onSelectInvoice,
}) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        // Toggle palette
        if (isOpen) onClose();
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredInvoices = invoices
    .filter((inv) =>
      inv.id.toLowerCase().includes(query.toLowerCase()) ||
      inv.vendor.toLowerCase().includes(query.toLowerCase()) ||
      inv.department.toLowerCase().includes(query.toLowerCase())
    )
    .slice(0, 6);

  return (
    <div
      data-testid="command-palette"
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 border-b border-slate-200 dark:border-slate-800">
          <Search className="w-5 h-5 text-slate-400 mr-3 flex-shrink-0" />
          <input
            data-testid="command-palette-input"
            type="text"
            placeholder="Type an invoice ID, vendor, or command..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            className="w-full py-4 bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
          />
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            aria-label="Close command palette"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="py-2 max-h-80 overflow-y-auto">
          <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Invoices
          </div>
          {filteredInvoices.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-slate-500">
              No matching records found for "{query}".
            </div>
          ) : (
            filteredInvoices.map((inv) => (
              <div
                key={inv.id}
                data-testid={`command-item-${inv.id}`}
                onClick={() => {
                  onSelectInvoice(inv);
                  onClose();
                }}
                className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/80 cursor-pointer transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 group-hover:bg-blue-50 dark:group-hover:bg-blue-950 group-hover:text-blue-600">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-mono font-bold text-slate-900 dark:text-white mr-2">
                      {inv.id}
                    </span>
                    <span className="text-xs text-slate-600 dark:text-slate-300">
                      {inv.vendor}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold font-mono text-slate-700 dark:text-slate-300">
                    ${inv.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
          <span>Navigate with arrows or search</span>
          <span>ESC to close</span>
        </div>
      </div>
    </div>
  );
};

