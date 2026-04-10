"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { ExplorerStats } from "@/hooks/useExplorerSocket";
import { useEffect, useRef, useState } from "react";

/* ── Animated Number Counter ── */
function AnimatedValue({
  value,
  prefix = "",
  suffix = "",
  decimals = 0,
  color,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  color: string;
}) {
  const [displayValue, setDisplayValue] = useState(value);
  const [flash, setFlash] = useState(false);
  const prevRef = useRef(value);

  useEffect(() => {
    if (value !== prevRef.current) {
      setFlash(true);
      const timeout = setTimeout(() => setFlash(false), 600);
      prevRef.current = value;
      setDisplayValue(value);
      return () => clearTimeout(timeout);
    }
  }, [value]);

  return (
    <motion.span
      className={`text-2xl sm:text-3xl font-mono font-light tracking-tight ${color}`}
      animate={flash ? { scale: [1, 1.08, 1] } : {}}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      {prefix}
      {displayValue.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </motion.span>
  );
}

/* ── Single Stat Card ── */
function StatCard({
  label,
  value,
  prefix = "",
  suffix = "",
  decimals = 0,
  sublabel,
  color,
  glowColor,
}: {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  sublabel: string;
  color: string;
  glowColor?: string;
}) {
  return (
    <motion.div
      className="rounded-xl border border-zinc-800/60 bg-zinc-950/80 p-4 flex flex-col gap-1 relative overflow-hidden"
      whileHover={{ borderColor: "rgba(255,255,255,0.12)" }}
      transition={{ duration: 0.2 }}
    >
      {glowColor && (
        <div
          className="absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-[0.06] blur-2xl pointer-events-none"
          style={{ background: glowColor }}
        />
      )}
      <span className="text-[10px] text-zinc-600 tracking-[0.15em] uppercase font-medium relative z-10">
        {label}
      </span>
      <div className="relative z-10">
        <AnimatedValue
          value={value}
          prefix={prefix}
          suffix={suffix}
          decimals={decimals}
          color={color}
        />
      </div>
      <span className="text-[10px] text-zinc-600 font-mono relative z-10">
        {sublabel}
      </span>
    </motion.div>
  );
}

/* ── Main Explorer Stats Row ── */
interface ExplorerStatsProps {
  stats: ExplorerStats;
  connected: boolean;
}

export function ExplorerStatsRow({ stats, connected }: ExplorerStatsProps) {
  return (
    <div className="space-y-3">
      {/* Connection indicator */}
      <div className="flex items-center gap-2 px-1">
        <span
          className={`w-2 h-2 rounded-full ${
            connected
              ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)] animate-pulse"
              : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]"
          }`}
        />
        <span
          className={`text-xs font-mono ${
            connected ? "text-emerald-400/80" : "text-red-400/80"
          }`}
        >
          {connected ? "Live" : "Reconnecting..."}
        </span>
      </div>

      {/* 2 rows × 4 columns */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Total Ops"
          value={stats.total_ops}
          sublabel="cumulative on-chain"
          color="text-white"
          glowColor="#3b82f6"
        />
        <StatCard
          label="OPS/s live"
          value={stats.ops_per_second}
          suffix=" ops/s"
          decimals={1}
          sublabel="moving average"
          color="text-teal-400"
          glowColor="#14b8a6"
        />
        <StatCard
          label="Ledger Time"
          value={stats.avg_ledger_time}
          suffix="s"
          decimals={1}
          sublabel="avg close time"
          color="text-blue-400"
          glowColor="#3b82f6"
        />
        <StatCard
          label="Agent Missions"
          value={stats.total_missions}
          sublabel="research sessions"
          color="text-white"
          glowColor="#a855f7"
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="USDC x402"
          value={stats.total_usdc_x402}
          prefix="$"
          decimals={4}
          sublabel="search payments"
          color="text-amber-400"
          glowColor="#f59e0b"
        />
        <StatCard
          label="Reports Anchored"
          value={stats.reports_anchored}
          sublabel="SHA-256 on-chain"
          color="text-blue-400"
          glowColor="#3b82f6"
        />
        <StatCard
          label="Monitors"
          value={stats.active_monitors}
          sublabel="running jobs"
          color="text-emerald-400"
          glowColor="#10b981"
        />
        <StatCard
          label="Success Rate"
          value={stats.success_rate}
          suffix="%"
          decimals={1}
          sublabel="agent SLA"
          color={
            stats.success_rate >= 95
              ? "text-emerald-400"
              : stats.success_rate >= 80
              ? "text-amber-400"
              : "text-red-400"
          }
          glowColor="#10b981"
        />
      </div>
    </div>
  );
}
