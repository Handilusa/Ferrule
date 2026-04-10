"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { ExplorerOperation } from "@/hooks/useExplorerSocket";

/* ── Badge colors by Ferrule type ── */
const TYPE_BADGE: Record<
  string,
  { color: string; bg: string; border: string }
> = {
  x402: {
    color: "text-orange-400",
    bg: "bg-orange-400/10",
    border: "border-orange-400/20",
  },
  ANC: {
    color: "text-blue-400",
    bg: "bg-blue-400/10",
    border: "border-blue-400/20",
  },
  SLA: {
    color: "text-green-400",
    bg: "bg-green-400/10",
    border: "border-green-400/20",
  },
  MANDATE: {
    color: "text-red-400",
    bg: "bg-red-400/10",
    border: "border-red-400/20",
  },
  MPP: {
    color: "text-purple-400",
    bg: "bg-purple-400/10",
    border: "border-purple-400/20",
  },
};

/* ── Skeleton Row ── */
function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800/20 animate-pulse">
      <div className="w-14 h-5 bg-zinc-800/60 rounded-full" />
      <div className="flex-1 h-4 bg-zinc-800/40 rounded" />
      <div className="w-12 h-4 bg-zinc-800/30 rounded" />
    </div>
  );
}

/* ── Time ago helper ── */
function timeAgo(dateStr: string): string {
  const diff = Math.max(0, Date.now() - new Date(dateStr).getTime());
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h`;
}

interface AgentOpFeedProps {
  agentOps: ExplorerOperation[];
}

export function AgentOpFeed({ agentOps }: AgentOpFeedProps) {
  const displayOps = agentOps.slice(0, 15);
  const isLoading = agentOps.length === 0;

  return (
    <div className="flex-1 min-h-0 flex flex-col rounded-xl border border-zinc-800/60 bg-zinc-950/80 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-zinc-800/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-zinc-600 tracking-[0.2em] uppercase font-medium">
            Agent Operations
          </span>
          {!isLoading && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          )}
        </div>
        <span className="text-[10px] text-zinc-600 font-mono">
          {isLoading ? "waiting..." : `${agentOps.length} ops`}
        </span>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {isLoading ? (
          <>
            {[...Array(5)].map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </>
        ) : (
          <AnimatePresence initial={false}>
            {displayOps.map((op) => {
              const badge = TYPE_BADGE[op.ferruleType] || TYPE_BADGE.SLA;
              return (
                <motion.a
                  key={op.id}
                  href={`https://stellar.expert/explorer/testnet/tx/${op.transaction_hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-4 py-2.5 border-b border-zinc-800/20 last:border-0 hover:bg-zinc-900/60 transition-colors cursor-pointer text-[11px] group"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                >
                  {/* Type badge */}
                  <span
                    className={`shrink-0 px-2 py-0.5 rounded-full font-mono font-semibold text-[9px] border ${badge.color} ${badge.bg} ${badge.border}`}
                  >
                    {op.ferruleType}
                  </span>

                  {/* Label + detail */}
                  <div className="flex-1 min-w-0">
                    <span className="text-zinc-300 font-mono truncate block">
                      {op.ferruleLabel}
                    </span>
                    <span className="text-zinc-600 font-mono text-[10px] truncate block">
                      {op.ferruleDetail}
                    </span>
                  </div>

                  {/* Time */}
                  <span className="shrink-0 text-zinc-600 font-mono text-[10px]">
                    {timeAgo(op.created_at)}
                  </span>

                  {/* TX hash */}
                  <span className="shrink-0 text-zinc-700 group-hover:text-teal-400 font-mono text-[10px] transition-colors">
                    {op.transaction_hash.slice(0, 6)}…↗
                  </span>
                </motion.a>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
