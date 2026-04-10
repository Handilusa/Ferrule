"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";

interface MissionsPerDayChartProps {
  /** Array of daily mission counts, newest last. Max 7 items. */
  data: number[];
  /** Day labels like ["Mon", "Tue", ...] */
  labels?: string[];
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function MissionsPerDayChart({ data, labels }: MissionsPerDayChartProps) {
  const normalizedData = useMemo(() => {
    const arr = [...data];
    while (arr.length < 7) arr.unshift(0);
    return arr.slice(-7);
  }, [data]);

  const dayLabels = useMemo(() => {
    if (labels && labels.length >= 7) return labels.slice(-7);
    // Generate labels based on current day
    const today = new Date().getDay(); // 0=Sun
    const result: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const dayIdx = (today - i + 7) % 7;
      result.push(DAY_LABELS[dayIdx === 0 ? 6 : dayIdx - 1]);
    }
    return result;
  }, [labels]);

  const maxVal = Math.max(...normalizedData, 1);
  const width = 400;
  const height = 120;
  const padding = { top: 10, right: 10, bottom: 22, left: 10 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const barGap = 8;
  const barWidth = (chartW - barGap * (normalizedData.length - 1)) / normalizedData.length;

  // Gradient ID
  const gradientId = "missions-bar-gradient";

  return (
    <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/80 p-4 overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] text-zinc-600 tracking-[0.15em] uppercase font-medium">
          Missions / Day
        </span>
        <span className="text-[10px] text-zinc-600 font-mono">last 7 days</span>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.2" />
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

        {/* Bars */}
        {normalizedData.map((val, i) => {
          const barH = Math.max((val / maxVal) * chartH, 2);
          const x = padding.left + i * (barWidth + barGap);
          const y = padding.top + chartH - barH;

          return (
            <g key={i}>
              <motion.rect
                x={x}
                y={y}
                width={barWidth}
                height={barH}
                rx={3}
                ry={3}
                fill={`url(#${gradientId})`}
                initial={{ height: 0, y: padding.top + chartH }}
                animate={{ height: barH, y }}
                transition={{ delay: i * 0.08, duration: 0.5, ease: "easeOut" }}
              />

              {/* Value label on top of bar */}
              {val > 0 && (
                <motion.text
                  x={x + barWidth / 2}
                  y={y - 4}
                  textAnchor="middle"
                  className="text-[8px] fill-emerald-400 font-mono"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.08 + 0.3 }}
                >
                  {val}
                </motion.text>
              )}

              {/* Day label */}
              <text
                x={x + barWidth / 2}
                y={height - 4}
                textAnchor="middle"
                className="text-[8px] fill-zinc-700 font-mono"
              >
                {dayLabels[i]}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
