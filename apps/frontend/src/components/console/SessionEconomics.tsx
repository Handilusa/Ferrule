"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { FerruleLogo } from "@/components/svg/FerruleLogo";

interface SessionEconomicsProps {
  offChainCount: number;
  onChainCount: number;
  x402Payments: number;
  totalSpent: number;
  networkCost: number;
  budget: number;
  sessionDuration: string | null;
  isComplete: boolean;
  mobileCompact?: boolean;
}

export function SessionEconomics({
  offChainCount,
  onChainCount,
  x402Payments,
  totalSpent,
  networkCost,
  budget,
  sessionDuration,
  isComplete,
  mobileCompact = false,
}: SessionEconomicsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const totalPayments = offChainCount + x402Payments;
  const refundAmount = Math.max(0, budget - totalSpent - networkCost);

  useEffect(() => {
    if (isComplete && containerRef.current) {
      // Receipt printing animation
      const tl = gsap.timeline();
      
      tl.fromTo(".receipt-row", 
        { autoAlpha: 0, x: -10 },
        { autoAlpha: 1, x: 0, duration: 0.4, stagger: 0.15, ease: "power2.out" }
      );
      
      tl.fromTo(".receipt-refund",
        { autoAlpha: 0, scale: 0.95, y: 10 },
        { autoAlpha: 1, scale: 1, y: 0, duration: 0.6, ease: "back.out(1.5)" },
        "-=0.1"
      );
    }
  }, [isComplete]);

  if (!isComplete && !mobileCompact) return null;
  if (!isComplete && mobileCompact) return null;

  return (
    <div ref={containerRef} className={`rounded-xl border border-zinc-800/60 bg-zinc-950/80 overflow-hidden font-mono ${mobileCompact ? 'p-3 border-x-0 rounded-none' : ''}`}>
      <div className={`px-4 py-3 border-b border-zinc-800/40 bg-zinc-900/40 flex justify-between items-center ${mobileCompact ? 'px-0 pt-0 pb-2 border-0 bg-transparent' : ''}`}>
        <div className="flex items-center gap-2">
          <FerruleLogo className="w-3.5 h-3.5 text-zinc-400" />
          <span className="text-[10px] text-zinc-400 tracking-[0.2em] uppercase">Session Settlement Receipt</span>
        </div>
        <span className="text-[10px] text-zinc-500">{sessionDuration || "—"}</span>
      </div>

      <div className={`p-4 flex flex-col gap-3 ${mobileCompact ? 'px-0' : ''}`}>
        
        {/* Receipt Rows */}
        <div className="receipt-row flex justify-between text-xs text-zinc-400 border-b border-zinc-800/40 pb-2 border-dashed">
          <span>Authorized Budget Drop</span>
          <span className="text-zinc-300">${budget.toFixed(4)} USDC</span>
        </div>
        
        <div className="receipt-row flex justify-between text-xs text-zinc-500">
          <span>LLM Agent ({offChainCount} MPP Commits)</span>
          <span className="text-red-400/80">-${(offChainCount * 0.00001).toFixed(5)} USDC</span>
        </div>
        
        <div className="receipt-row flex justify-between text-xs text-zinc-500">
          <span>Search Agents ({x402Payments} x402 Payments)</span>
          <span className="text-red-400/80">-${(x402Payments * 0.0002).toFixed(4)} USDC</span>
        </div>
        
        <div className="receipt-row flex justify-between text-xs text-zinc-500 border-b border-zinc-800/40 pb-3 border-dashed">
          <span>Soroban Network Fees ({onChainCount} TXs)</span>
          <span className="text-red-400/80">-${Math.max(0.0001, networkCost).toFixed(4)} XLM</span>
        </div>

        {/* Big Refund Box */}
        <div className="receipt-refund mt-2 rounded-xl border border-emerald-900/50 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-950/40 to-black p-4 flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute top-0 w-full h-[1px] bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent"></div>
          <span className="text-[10px] text-emerald-500/80 tracking-[0.2em] uppercase mb-1">Unspent Budget Refunded</span>
          <div className="flex items-baseline gap-1">
            <span className="text-emerald-400 text-2xl font-bold tracking-tight">+${refundAmount.toFixed(4)}</span>
            <span className="text-emerald-500/70 text-xs tracking-widest">USDC</span>
          </div>
          <p className="text-[9px] text-zinc-500 mt-2 tracking-wider">Settled on-chain in 1 final transaction.</p>
        </div>

      </div>
    </div>
  );
}
