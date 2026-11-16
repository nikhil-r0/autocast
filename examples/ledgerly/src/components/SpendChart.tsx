import React, { useState } from 'react';

interface SpendChartProps {
  loading: boolean;
}

export const SpendChart: React.FC<SpendChartProps> = ({ loading }) => {
  const [activePoint, setActivePoint] = useState<number | null>(null);

  if (loading) {
    return (
      <div data-testid="chart-skeleton" className="h-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 mb-6 animate-pulse flex flex-col justify-between">
        <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/4"></div>
        <div className="h-44 bg-slate-100 dark:bg-slate-800/50 rounded w-full"></div>
      </div>
    );
  }

  const months = ['Jun 2026', 'Jul 2026', 'Aug 2026', 'Sep 2026', 'Oct 2026', 'Nov 2026'];
  const data = [112400, 134200, 128900, 156300, 162100, 184500];

  // SVG coordinate calculations (width: 800, height: 180)
  const minVal = 100000;
  const maxVal = 200000;
  const chartWidth = 800;
  const chartHeight = 160;

  const points = data.map((val, idx) => {
    const x = (idx / (data.length - 1)) * (chartWidth - 80) + 40;
    const y = chartHeight - ((val - minVal) / (maxVal - minVal)) * (chartHeight - 40) - 20;
    return { x, y, val, month: months[idx] };
  });

  const pathD = points.reduce((acc, p, idx) => {
    return idx === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
  }, '');

  const areaD = `${pathD} L ${points[points.length - 1].x} ${chartHeight} L ${points[0].x} ${chartHeight} Z`;

  return (
    <div
      data-testid="spend-chart-card"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 mb-6 shadow-sm"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Disbursement Velocity & Approval Trend
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Aggregated monthly vendor volume (June – November 2026)
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs font-medium">
          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            <span className="w-2.5 h-2.5 rounded-sm bg-blue-500"></span>
            <span>Monthly Total ($)</span>
          </div>
          <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-semibold border border-blue-200 dark:border-blue-900">
            +13.8% YTD
          </span>
        </div>
      </div>

      <div className="relative w-full h-44 overflow-hidden">
        <svg
          data-testid="spend-chart-svg"
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full h-full overflow-visible"
        >
          <defs>
            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0.25, 0.5, 0.75].map((ratio) => (
            <line
              key={ratio}
              x1="30"
              y1={chartHeight * ratio}
              x2={chartWidth - 30}
              y2={chartHeight * ratio}
              stroke="currentColor"
              className="text-slate-100 dark:text-slate-800/80"
              strokeDasharray="4 4"
            />
          ))}

          {/* Area Fill */}
          <path d={areaD} fill="url(#chartGradient)" />

          {/* Stroke Line */}
          <path
            d={pathD}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data Points */}
          {points.map((p, idx) => (
            <g key={idx}>
              <circle
                cx={p.x}
                cy={p.y}
                r={activePoint === idx ? 6 : 4}
                className="fill-white dark:fill-slate-900 stroke-blue-600 stroke-[2.5px] cursor-pointer transition-all duration-150"
                onMouseEnter={() => setActivePoint(idx)}
                onMouseLeave={() => setActivePoint(null)}
              />
              <text
                x={p.x}
                y={chartHeight + 14}
                textAnchor="middle"
                className="text-[11px] font-medium fill-slate-400 dark:fill-slate-500"
              >
                {p.month}
              </text>
            </g>
          ))}
        </svg>

        {/* Hover Point Tooltip */}
        {activePoint !== null && (
          <div
            className="absolute z-30 bg-slate-900 text-white text-xs px-2.5 py-1 rounded shadow-lg pointer-events-none transform -translate-x-1/2 -translate-y-8"
            style={{
              left: `${(points[activePoint].x / chartWidth) * 100}%`,
              top: `${(points[activePoint].y / chartHeight) * 100}%`,
            }}
          >
            ${points[activePoint].val.toLocaleString()}
          </div>
        )}
      </div>
    </div>
  );
};

