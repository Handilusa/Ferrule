"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";

interface OpsPerHourChartProps {
  /** Array of hourly ops counts, newest last. Max 24 items. */
  data: number[];
}

export function OpsPerHourChart({ data }: OpsPerHourChartProps) {
  // Ensure we have 24 data points
  const normalizedData = useMemo(() => {
    const arr = [...data];
    while (arr.length < 24) arr.unshift(0);
    return arr.slice(-24);
  }, [data]);

  const maxVal = Math.max(...normalizedData, 1);
  const width = 400;
  const height = 120;
  const padding = { top: 10, right: 10, bottom: 20, left: 10 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  // Build SVG path for area chart
  const points = normalizedData.map((val, i) => {
    const x = padding.left + (i / (normalizedData.length - 1)) * chartW;
    const y = padding.top + chartH - (val / maxVal) * chartH;
    return { x, y };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${padding.top + chartH} L ${points[0].x} ${padding.top + chartH} Z`;

  // Gradient ID
  const gradientId = "ops-area-gradient";

  return (
    <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/80 p-4 overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] text-zinc-600 tracking-[0.15em] uppercase font-medium">
          Ops / Hour
        </span>
        <span className="text-[10px] text-zinc-600 font-mono">last 24h</span>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#14b8a6" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map((frac) => (
          <line
            key={frac}
            x1={padding.left}
            x2={width - padding.right}
            y1={padding.top + chartH * (1 - frac)}
            y2={padding.top + chartH * (1 - frac)}
            stroke="rgba(255,255,255,0.04)"
            strokeWidth="1"
          />
        ))}

        {/* Area fill */}
        <motion.path
          d={areaPath}
          fill={`url(#${gradientId})`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, ease: "easeOut" }}
        />

        {/* Line */}
        <motion.path
          d={linePath}
          fill="none"
          stroke="#14b8a6"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
        />

        {/* Dots on key points */}
        {points.filter((_, i) => i % 6 === 0 || i === points.length - 1).map((p, i) => (
          <motion.circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="2.5"
            fill="#14b8a6"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.5 + i * 0.1, duration: 0.3 }}
          />
        ))}

        {/* X-axis labels */}
        {[0, 6, 12, 18, 23].map((idx) => (
          <text
            key={idx}
            x={padding.left + (idx / 23) * chartW}
            y={height - 4}
            textAnchor="middle"
            className="text-[8px] fill-zinc-700 font-mono"
          >
            {idx}h
          </text>
        ))}
      </svg>
    </div>
  );
}
