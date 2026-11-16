import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Invoice } from '../types.js';

interface PaymentFailureBannerProps {
  failedInvoice?: Invoice;
  onRetry: (invoiceId: string) => void;
  retrying: boolean;
}

export const PaymentFailureBanner: React.FC<PaymentFailureBannerProps> = ({
  failedInvoice,
  onRetry,
  retrying,
}) => {
  if (!failedInvoice || failedInvoice.status !== 'Payment failed') {
    return null;
  }

  return (
    <div
      data-testid="payment-failure-banner"
      className="mb-6 rounded-xl border border-rose-300 dark:border-rose-900/60 bg-rose-50/90 dark:bg-rose-950/40 p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all duration-200"
    >
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-rose-900 dark:text-rose-200">
              Disbursement Authorization Failure &bull; {failedInvoice.id}
            </h4>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-rose-200 dark:bg-rose-900 text-rose-800 dark:text-rose-300">
              ACH Error
            </span>
          </div>
          <p className="text-xs text-rose-700 dark:text-rose-300/90 mt-1 max-w-3xl">
            {failedInvoice.vendor}: {failedInvoice.paymentError || 'ACH settlement rejected: Insufficient ledger transit clearance.'}
          </p>
        </div>
      </div>

      <button
        onClick={() => onRetry(failedInvoice.id)}
        disabled={retrying}
        data-testid="btn-banner-retry"
        className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 text-white text-xs font-semibold rounded-lg shadow-sm hover:shadow transition-all flex-shrink-0"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${retrying ? 'animate-spin' : ''}`} />
        <span>{retrying ? 'Re-authorizing...' : 'Retry Payment'}</span>
      </button>
    </div>
  );
};
