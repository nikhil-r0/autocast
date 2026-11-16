import React, { useState } from 'react';
import { Clock, DollarSign, CheckCircle2, TrendingUp, HelpCircle } from 'lucide-react';
import { Metrics } from '../types.js';

interface KPICardsProps {
  metrics: Metrics | null;
  loading: boolean;
}

export const KPICards: React.FC<KPICardsProps> = ({ metrics, loading }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (loading || !metrics) {
    return (
      <div data-testid="kpi-cards-skeleton" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-28 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between animate-pulse"
          >
            <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/2"></div>
            <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded w-3/4"></div>
          </div>
        ))}
      </div>
    );
  }

  const cards = [
    {
      id: 'pending',
      title: 'Pending Approvals',
      value: String(metrics.pendingApprovals),
      valueTestId: 'kpi-pending-value',
      cardTestId: 'kpi-pending-approvals',
      subtext: 'Requires executive authorization',
      icon: <Clock className="w-4 h-4 text-amber-500" />,
      tooltip: 'Invoices currently in Pending status awaiting director sign-off.',
      badge: 'Action Required',
      badgeColor: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border-amber-200 dark:border-amber-900',
    },
    {
      id: 'pending-amount',
      title: 'Pending Volume',
      value: `$${metrics.pendingAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      valueTestId: 'kpi-pending-amount',
      cardTestId: 'kpi-pending-volume',
      subtext: 'Committed disbursements',
      icon: <DollarSign className="w-4 h-4 text-blue-500" />,
      tooltip: 'Combined dollar volume across all unresolved pending invoices.',
      badge: 'Accrual',
      badgeColor: 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border-blue-200 dark:border-blue-900',
    },
    {
      id: 'approved-amount',
      title: 'Approved This Month',
      value: `$${metrics.approvedThisMonth.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      valueTestId: 'kpi-approved-amount',
      cardTestId: 'kpi-approved-month',
      subtext: '↑ 14% vs. previous billing cycle',
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
      tooltip: 'Total vendor payments authorized and settled in November 2026.',
      badge: 'On Track',
      badgeColor: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900',
    },
    {
      id: 'avg-time',
      title: 'Average Approval SLA',
      value: `${metrics.avgProcessingHours} hrs`,
      valueTestId: 'kpi-avg-time',
      cardTestId: 'kpi-avg-sla',
      subtext: 'Target SLA < 4.0 hrs',
      icon: <TrendingUp className="w-4 h-4 text-indigo-500" />,
      tooltip: 'Median turnaround time from invoice submission to verified approval.',
      badge: 'Optimal',
      badgeColor: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900',
    },
  ];

  return (
    <div data-testid="kpi-cards-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((card, idx) => (
        <div
          key={card.id}
          data-testid={card.cardTestId}
          onMouseEnter={() => setHoveredIndex(idx)}
          onMouseLeave={() => setHoveredIndex(null)}
          className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-200 group"
        >
          {/* Header Row */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              {card.title}
              <HelpCircle className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer" />
            </span>
            <div className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
              {card.icon}
            </div>
          </div>

          {/* Value Row */}
          <div className="flex items-baseline justify-between">
            <span
              data-testid={card.valueTestId}
              className="text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white"
            >
              {card.value}
            </span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${card.badgeColor}`}
            >
              {card.badge}
            </span>
          </div>

          {/* Subtext */}
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-medium">
            {card.subtext}
          </p>

          {/* Interactive Hover Tooltip */}
          {hoveredIndex === idx && (
            <div
              data-testid={`kpi-tooltip-${card.id}`}
              className="absolute left-4 right-4 -top-12 z-40 bg-slate-900 text-white text-xs py-1.5 px-3 rounded-lg shadow-xl border border-slate-700 text-center pointer-events-none animate-in fade-in zoom-in-95 duration-150"
            >
              {card.tooltip}
              <div className="absolute left-1/2 -bottom-1 -translate-x-1/2 w-2 h-2 bg-slate-900 rotate-45 border-r border-b border-slate-700"></div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
