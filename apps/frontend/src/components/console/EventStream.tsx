"use client";

import type { FeedEvent } from "@/hooks/useFerruleSocket";

const TYPE_CONFIG: Record<FeedEvent["type"], { color: string; bg: string }> = {
  commit:  { color: "text-teal-400",   bg: "bg-teal-400/10" },
  x402:    { color: "text-purple-400",  bg: "bg-purple-400/10" },
  onchain: { color: "text-amber-400",   bg: "bg-amber-400/10" },
  settle:  { color: "text-emerald-400", bg: "bg-emerald-400/10" },
  agent:   { color: "text-blue-400",    bg: "bg-blue-400/10" },
  error:   { color: "text-red-400",     bg: "bg-red-400/10" },
  system:  { color: "text-zinc-500",    bg: "bg-zinc-500/10" },
};

interface EventStreamProps {
  events: FeedEvent[];
}

export function EventStream({ events }: EventStreamProps) {
  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/80 p-4">
        <div className="text-[10px] text-zinc-600 tracking-[0.2em] uppercase mb-3">Event Stream</div>
        <div className="text-sm text-zinc-600 font-mono">Waiting for mission deployment...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col rounded-xl border border-zinc-800/60 bg-zinc-950/80 overflow-hidden">
      <div className="shrink-0 px-4 py-3 border-b border-zinc-800/40 flex items-center justify-between">
        <span className="text-[10px] text-zinc-600 tracking-[0.2em] uppercase">Event Stream</span>
        <span className="text-[10px] text-zinc-600 font-mono">{events.length} events</span>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {events.map((evt) => {
          const cfg = TYPE_CONFIG[evt.type] || TYPE_CONFIG.system;
          return (
            <div
              key={evt.id}
              className="flex items-start gap-3 px-4 py-2.5 border-b border-zinc-800/20 last:border-0 hover:bg-zinc-900/50 transition-colors text-[11px]"
            >
              {/* Timestamp */}
              <span className="text-zinc-600 font-mono shrink-0 w-14 text-right">
                +{evt.elapsed.toFixed(1)}s
              </span>

              {/* Type badge */}
              <span
                className={`shrink-0 px-2 py-0.5 rounded font-mono font-semibold text-[9px] ${cfg.color} ${cfg.bg}`}
              >
                {evt.label}
              </span>

              {/* Detail */}
              <span className="text-zinc-400 font-mono flex-1 truncate leading-tight mt-0.5">
                {evt.detail}
              </span>

              {/* Signature or TX hash (if present) */}
              {evt.signature && (
                <span className="text-zinc-600 font-mono shrink-0 mt-0.5" title={`sig: ${evt.signature}`}>
                  [{evt.signature.slice(0, 8)}…]
                </span>
              )}
              {evt.txId && evt.txId !== "pending_settlement" && (
                <a
                  href={`https://stellar.expert/explorer/testnet/tx/${evt.txId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-teal-400/80 hover:text-teal-300 font-mono shrink-0 mt-0.5 underline underline-offset-2"
                >
                  {evt.txId.slice(0, 6)}…↗
                </a>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
