"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { ExplorerLedger } from "@/hooks/useExplorerSocket";

/* ── Skeleton Row ── */
function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-zinc-800/20 animate-pulse">
      <div className="w-16 h-4 bg-zinc-800/60 rounded" />
      <div className="w-20 h-4 bg-zinc-800/40 rounded" />
      <div className="w-12 h-4 bg-zinc-800/40 rounded" />
      <div className="flex-1" />
      <div className="w-16 h-4 bg-zinc-800/30 rounded" />
    </div>
  );
}

/* ── Time ago helper ── */
function timeAgo(dateStr: string): string {
  const diff = Math.max(0, Date.now() - new Date(dateStr).getTime());
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  return `${mins}m ago`;
}

interface LedgerFeedProps {
  ledgers: ExplorerLedger[];
}

export function LedgerFeed({ ledgers }: LedgerFeedProps) {
  const displayLedgers = ledgers.slice(0, 10);
  const isLoading = ledgers.length === 0;

  return (
    <div className="flex-1 min-h-0 flex flex-col rounded-xl border border-zinc-800/60 bg-zinc-950/80 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-zinc-800/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-zinc-600 tracking-[0.2em] uppercase font-medium">
            Latest Ledgers
          </span>
          {!isLoading && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          )}
        </div>
        <span className="text-[10px] text-zinc-600 font-mono">
          {isLoading ? "waiting..." : `${ledgers.length} cached`}
        </span>
      </div>

      {/* Column headers */}
      <div className="shrink-0 flex items-center gap-4 px-4 py-2 text-[9px] text-zinc-600 uppercase tracking-wider font-medium border-b border-zinc-800/30">
        <span className="w-20">#Sequence</span>
        <span className="w-16">Time</span>
        <span className="w-12 text-right">Ops</span>
        <span className="flex-1" />
        <span className="w-16 text-right">Fee</span>
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
            {displayLedgers.map((ledger) => (
              <motion.a
                key={ledger.sequence}
                href={`https://stellar.expert/explorer/testnet/ledger/${ledger.sequence}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 px-4 py-2.5 border-b border-zinc-800/20 last:border-0 hover:bg-zinc-900/60 transition-colors cursor-pointer text-[11px] group"
                initial={{ opacity: 0, y: -20, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              >
                {/* Sequence */}
                <span className="w-20 font-mono text-teal-400 group-hover:text-teal-300 transition-colors">
                  #{ledger.sequence.toLocaleString()}
                </span>

                {/* Time */}
                <span className="w-16 font-mono text-zinc-500">
                  {timeAgo(ledger.closed_at)}
                </span>

                {/* Ops count */}
                <span className="w-12 text-right font-mono text-zinc-300">
                  {ledger.operation_count}
                  <span className="text-zinc-600 ml-0.5">ops</span>
                </span>

                <span className="flex-1" />

                {/* Base fee */}
                <span className="w-16 text-right font-mono text-zinc-500">
                  {ledger.base_fee}
                  <span className="text-zinc-700 ml-0.5">str</span>
                </span>

                {/* External link icon */}
                <svg
                  className="w-3 h-3 text-zinc-700 group-hover:text-teal-400 transition-colors"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </motion.a>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
