"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

interface ChannelCardsProps {
  channelId: string | null;
  channelStatus: "idle" | "open" | "streaming" | "closing" | "settled";
  budget: number;
  totalSpent: number;
  offChainCount: number;
  x402Payments: number;
  transactions: { type: string; txId: string }[];
}

const STATUS_STYLE: Record<string, { label: string; dot: string; text: string }> = {
  idle:      { label: "Idle",      dot: "bg-zinc-600", text: "text-zinc-500" },
  open:      { label: "Open",      dot: "bg-teal-400", text: "text-teal-400" },
  streaming: { label: "Streaming", dot: "bg-teal-400 animate-pulse", text: "text-teal-400" },
  closing:   { label: "Closing",   dot: "bg-amber-400 animate-pulse", text: "text-amber-400" },
  settled:   { label: "Settled",   dot: "bg-emerald-400", text: "text-emerald-400" },
};

export function ChannelCards({
  channelId,
  channelStatus,
  budget,
  totalSpent,
  offChainCount,
  x402Payments,
  transactions,
}: ChannelCardsProps) {
  const mppSpent = offChainCount * 0.00001;
  const x402Spent = x402Payments * 0.0002;
  const pct = budget > 0 ? Math.min((totalSpent / budget) * 100, 100) : 0;
  const barColor = pct >= 80 ? "bg-amber-400" : "bg-teal-400";
  const status = STATUS_STYLE[channelStatus] || STATUS_STYLE.idle;

  const openTx = transactions.find((t) => t.type === "channel_open");
  const closeTx = transactions.find((t) => t.type === "channel_close");
  const hashTx = transactions.find((t) => t.type === "manage_data");

  const x402Ref = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (x402Payments === 1 && x402Ref.current) {
      // First appearance: Elastic scale up + stagger children
      const tl = gsap.timeline();
      tl.from(x402Ref.current, {
        y: 30,
        scale: 0.9,
        opacity: 0,
        duration: 0.8,
        ease: "elastic.out(1, 0.75)",
      })
      .from(".x402-item", {
        y: 10,
        opacity: 0,
        duration: 0.4,
        stagger: 0.1,
        ease: "power2.out",
        clearProps: "all"
      }, "-=0.6");
    } else if (x402Payments > 1 && x402Ref.current) {
      // Subsequent increments: Quick pulse/flash effect
      gsap.fromTo(x402Ref.current, 
        { scale: 1.03, borderColor: "rgba(168, 85, 247, 0.8)", backgroundColor: "rgba(168, 85, 247, 0.1)" }, 
        { scale: 1, borderColor: "rgba(168, 85, 247, 0.3)", backgroundColor: "rgba(24, 24, 27, 0.8)", duration: 0.4, ease: "power2.out" }
      );
    }
  }, [x402Payments]);

  return (
    <div className="flex flex-col gap-3">
      {/* MPP Session Channel */}
      <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/80 p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] text-zinc-600 tracking-[0.15em] uppercase font-medium">
            MPP Session Channel
          </span>
          <span className={`flex items-center gap-1.5 text-[10px] font-medium ${status.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
            {status.label}
          </span>
        </div>

        {channelId && (
          <div className="text-xs text-zinc-500 font-mono mb-3 truncate" title={channelId}>
            ID: {channelId.slice(0, 12)}…{channelId.slice(-6)}
          </div>
        )}

        {/* Progress bar */}
        <div className="mb-2">
          <div className="flex justify-between text-[10px] font-mono mb-1">
            <span className="text-zinc-500">${mppSpent.toFixed(6)} spent</span>
            <span className="text-zinc-500">${budget.toFixed(2)} budget</span>
          </div>
          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ease-out ${barColor}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="text-right text-[10px] text-zinc-600 font-mono mt-0.5">
            {pct.toFixed(1)}%
          </div>
        </div>

        <div className="flex gap-4 text-[10px] text-zinc-500 font-mono mb-3">
          <span>{offChainCount} commits</span>
        </div>

        {/* On-Chain Transaction Links — prominent cards */}
        {(openTx || closeTx) && (
          <div className="flex flex-col gap-2">
            {openTx && openTx.txId !== "pending_settlement" && (
              <a
                href={`https://stellar.expert/explorer/testnet/tx/${openTx.txId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-teal-400/20 bg-teal-400/[0.04] hover:bg-teal-400/[0.08] hover:border-teal-400/40 transition-all group"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-teal-400/15 text-teal-400 font-semibold tracking-wider uppercase">Open</span>
                  <span className="text-xs font-mono text-teal-400/80 group-hover:text-teal-300">
                    {openTx.txId.slice(0, 10)}…{openTx.txId.slice(-6)}
                  </span>
                </div>
                <span className="text-teal-400/60 group-hover:text-teal-300 text-sm">↗</span>
              </a>
            )}
            {closeTx && closeTx.txId !== "pending_settlement" && (
              <a
                href={`https://stellar.expert/explorer/testnet/tx/${closeTx.txId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-emerald-400/20 bg-emerald-400/[0.04] hover:bg-emerald-400/[0.08] hover:border-emerald-400/40 transition-all group"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-400/15 text-emerald-400 font-semibold tracking-wider uppercase">Settle</span>
                  <span className="text-xs font-mono text-emerald-400/80 group-hover:text-emerald-300">
                    {closeTx.txId.slice(0, 10)}…{closeTx.txId.slice(-6)}
                  </span>
                </div>
                <span className="text-emerald-400/60 group-hover:text-emerald-300 text-sm">↗</span>
              </a>
            )}
          </div>
        )}
      </div>

      {/* x402 Payment Channel: Rendered conditionally when triggered */}
      {x402Payments > 0 && (
        <div ref={x402Ref} className="rounded-xl border border-purple-500/30 bg-zinc-950/80 p-4 transform-gpu">
          <div className="flex items-center justify-between mb-2 x402-item">
            <span className="text-[10px] text-zinc-600 tracking-[0.15em] uppercase font-medium">
              x402 Payments
            </span>
            <span className="text-[10px] text-purple-400/80 font-mono">
              per-request
            </span>
          </div>
          <div className="flex items-baseline gap-2 mb-1 x402-item">
            <span className="text-xl font-mono text-purple-400 font-medium">{x402Payments}</span>
            <span className="text-xs text-zinc-500">search queries</span>
          </div>
          <div className="text-[10px] text-zinc-600 font-mono x402-item">
            ${x402Spent.toFixed(6)} USDC · $0.0002/query
          </div>
        </div>
      )}

      {/* On-Chain Verification Card */}
      {hashTx && (
        <div className="rounded-xl border border-emerald-500/30 bg-zinc-950/80 p-4 transform-gpu">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-zinc-600 tracking-[0.15em] uppercase font-medium">
              Report Immutable Hash
            </span>
            <span className="text-[10px] text-emerald-400/80 font-mono">manageData</span>
          </div>
          <div className="text-xs text-zinc-300 font-mono mb-2">
            On-Chain Anchor Available
          </div>
          <a
            href={`https://stellar.expert/explorer/testnet/tx/${hashTx.txId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-emerald-400/20 bg-emerald-400/[0.04] hover:bg-emerald-400/[0.08] hover:border-emerald-400/40 transition-all group"
          >
            <div className="flex items-center gap-2">
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-400/15 text-emerald-400 font-semibold tracking-wider uppercase">Verify</span>
              <span className="text-xs font-mono text-emerald-400/80 group-hover:text-emerald-300">
                {hashTx.txId.slice(0, 10)}…{hashTx.txId.slice(-6)}
              </span>
            </div>
            <span className="text-emerald-400/60 group-hover:text-emerald-300 text-sm">↗</span>
          </a>
        </div>
      )}
    </div>
  );
}
